import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {Request, Response} from "express";
import {Post} from "./types";
import {openaiKey, generateEmbeddingFromText} from "./gptUtils";
import {v4 as uuidv4} from "uuid";
import {Pinecone} from "@pinecone-database/pinecone";

export * from "./gptUtils";
import sharp from "sharp";

admin.initializeApp({
  databaseURL: "",
  storageBucket: "",
});

export * from "./comments";
export * from "./userLogic";
export * from "./subscriptions";
export * from "./safeSearchCheck";
export * from "./publicationsFetchLogic";


const db = admin.database();
const storage = admin.storage();

/**
 * Завантажує всі пости з бази даних.
 * @return {Promise<Post[]>} Масив об'єктів типу Post
 */
async function getAllPosts(): Promise<Post[]> {
  const snapshot = await db.ref("posts").get();
  const posts: Post[] = [];

  snapshot.forEach((child) => {
    const data = child.val();
    posts.push({
      id: child.key!,
      ...data,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt ?? null,
    });
  });

  return posts;
}

/**
 * Обчислює косинусну схожість між двома векторами.
 * @param {number[]} a - Перший вектор
 * @param {number[]} b - Другий вектор
 * @return {number} Значення косинусної схожості (від 0 до 1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

export const fetchPostById = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    const {postId} = req.query;

    if (!postId || typeof postId !== "string") {
      res.status(400).json({error: "Missing or invalid postId"});
      return;
    }

    try {
      const snapshot = await db.ref(`posts/${postId}`).get();
      if (!snapshot.exists()) {
        res.status(404).json({error: "Post not found"});
        return;
      }

      const data = snapshot.val();
      const post: Post = {
        id: postId,
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt ?? null,
      };

      res.status(200).json(post);
    } catch (error) {
      console.error("fetchPostById error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const fetchUserPosts = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    const {userId} = req.query;
    if (typeof userId !== "string") {
      res.status(400).json({error: "Missing userId"});
      return;
    }

    try {
      const posts = await getAllPosts();
      const userPosts = posts.filter((post) => post.authorId === userId);
      res.status(200).json(userPosts);
    } catch (error) {
      console.error("fetchUserPosts error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const fetchAllPostsSortedByDate = onRequest(
  {region: "europe-west3"},
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const posts = await getAllPosts();
      posts.sort((a, b) => b.createdAt - a.createdAt);
      res.status(200).json(posts);
    } catch (error) {
      console.error("fetchAllPostsSortedByDate error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const fetchLikedPosts = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    const {userId} = req.query;
    if (typeof userId !== "string") {
      res.status(400).json({error: "Missing userId"});
      return;
    }

    try {
      const posts = await getAllPosts();
      const likedPosts = posts.filter(
        (post) => post.likedBy?.includes(userId)
      );

      res.status(200).json(likedPosts);
    } catch (error) {
      console.error("fetchLikedPosts error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const fetchPostsFromSubscriptions = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    const {userId} = req.query;

    if (typeof userId !== "string") {
      res.status(400).json({error: "Missing or invalid userId"});
      return;
    }

    try {
      // 1. Запит до функції fetchSubscriptions
      const subsURL = `https://fetchsubscriptions-vqfzkomcjq-ey.a.run.app?userId=${userId}`;
      const subsResponse = await fetch(subsURL);
      const subsData = await subsResponse.json();

      const subscriptions = subsData.subscriptions ?? [];

      if (subscriptions.length === 0) {
        res.status(200).json([]);
        return;
      }
      const posts = await getAllPosts();
      const filteredPosts = posts
        .filter((post) => subscriptions.includes(post.authorId))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 70);

      res.status(200).json(filteredPosts);
    } catch (error) {
      console.error("fetchPostsFromSubscriptions error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);


/**
 * Повертає масив рекомендованих постів, схожих на заданий embedding.
 * @param {number[]} embedding - Вхідний embedding-вектор
 * @param {number} threshold - Поріг схожості (0.0–1.0)
 * @param {number} limit - Максимальна кількість постів
 * @return {Promise<Post[]>} Масив рекомендованих постів
 */
export async function getRecommendedPostsByEmbedding(
  embedding: number[],
  threshold = 0.4,
  limit = 10
): Promise<Post[]> {
  const posts = await getAllPosts();

  const scored = posts
    .filter(
      (post) =>
        post.embedding &&
        post.embedding.length === embedding.length &&
        !areEmbeddingsEqual(embedding, post.embedding!)
    )
    .map((post) => {
      const score = cosineSimilarity(embedding, post.embedding!);
      return {post, score};
    })
    .filter(({score}) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({post}) => post);

  return scored;
}

/**
 * Check if two embedding vectors are exactly equal.
 * @param {number[]} a - First embedding vector
 * @param {number[]} b - Second embedding vector
 * @return {boolean} True if all values are strictly equal
 */
function areEmbeddingsEqual(a: number[], b: number[]): boolean {
  return a.every((val, i) => val === b[i]);
}


export const fetchRecommendedPosts = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    const {embedding, similarityThreshold = 0.4, limit = 10} = req.body;

    if (!embedding || !Array.isArray(embedding)) {
      res.status(400).json({error: "Missing or invalid embedding"});
      return;
    }

    try {
      const posts = await getRecommendedPostsByEmbedding(
        embedding, similarityThreshold, limit);
      res.status(200).json(posts);
    } catch (error) {
      console.error("fetchRecommendedPosts error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const fetchSimilarPostsByText = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req: Request, res: Response): Promise<void> => {
    const {query, threshold = 0.4, limit = 10} = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({error: "Missing or invalid query"});
      return;
    }

    try {
      const embedding = await generateEmbeddingFromText(query);
      if (!embedding.length) {
        res.status(500).json({error: "Failed to get embedding"});
        return;
      }

      const posts = await getRecommendedPostsByEmbedding(
        embedding, threshold, limit);
      res.status(200).json(posts);
    } catch (error) {
      console.error("fetchSimilarPostsByText error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);


export const uploadImage = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {imageBase64} = req.body;

      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({error: "Missing or invalid imageBase64"});
        return;
      }

      // Декодуємо base64
      const originalBuffer = Buffer.from(imageBase64, "base64");

      // Масштабуємо зображення до max 1024px
      const resizedBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({width: 1024, height: 1024, fit: "inside"})
        .jpeg({quality: 80})
        .toBuffer();

      const imageId = uuidv4();
      const file = storage.bucket().file(`posts/${imageId}.jpg`);

      // Завантажуємо
      await file.save(resizedBuffer, {
        metadata: {
          contentType: "image/jpeg",
        },
      });

      await file.makePublic();

      const imageUrl = `https://storage.googleapis.com/${file.bucket.name}/${file.name}`;
      res.status(200).json({imageUrl});
    } catch (error) {
      console.error("uploadImage error:", error);
      res.status(500).json({error: "Image upload failed"});
    }
  }
);


export const uploadPost = onRequest(
  {
    region: "europe-west3",
    secrets: ["PINECONE_API_KEY"],
  },
  async (req, res) => {
    try {
      const post = req.body;

      if (!post || !post.id || !Array.isArray(post.embedding)) {
        res.status(400).json({error: "Missing post, id or embedding"});
        return;
      }

      // 1. Зберігаємо публікацію в Realtime DB
      await db.ref("posts").child(post.id).set(post);

      // 2. Підключаємо Pinecone з секретом
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
      });

      const index = pinecone.index("publications");

      await index.upsert([
        {
          id: post.id,
          values: post.embedding,
        },
      ]);

      res.status(200).json({success: true});
    } catch (error) {
      console.error("uploadPost error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const deletePost = onRequest(
  {
    region: "europe-west3",
  },
  async (req, res) => {
    const {postId} = req.body;

    if (!postId || typeof postId !== "string") {
      res.status(400).json({error: "Missing or invalid postId"});
      return;
    }

    try {
      await db.ref(`posts/${postId}`).remove();
      res.status(200).json({success: true});
    } catch (err) {
      console.error("Failed to delete post:", err);
      res.status(500).json({error: "Failed to delete post"});
    }
  });

