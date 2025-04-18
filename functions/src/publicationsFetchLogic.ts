import {getDatabase} from "firebase-admin/database";
import {Pinecone} from "@pinecone-database/pinecone";
import {Post} from "./types";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {openaiKey, generateEmbeddingFromText} from "./gptUtils";


/**
 * Допоміжна функція, яка робить запит
 * до Pinecone для пошуку найближчих векторів
 * і повертає відповідні публікації з Firebase.
 *
 * @param {string} apiKey - API ключ Pinecone (отримується через секрет).
 * @param {number[]} embedding - Вектор, з яким порівнюються пости.
 * @param {number} [limit=10] - Максимальна кількість результатів.
 * @return {Promise<Post[]>} Масив рекомендованих публікацій.
 */
export async function fetchRecommendedPostsFromPinecone(
  apiKey: string,
  embedding: number[],
  limit = 10
): Promise<Post[]> {
  try {
    const pinecone = new Pinecone({apiKey});
    const index = pinecone.index("publications");

    const queryResult = await index.query({
      vector: embedding,
      topK: limit,
      includeMetadata: false,
    });

    const ids = (queryResult.matches ?? [])
      .filter((match) => match.score !== 1)
      .map((match) => match.id);


    const db = getDatabase();
    const posts: Post[] = [];

    for (const id of ids) {
      const snapshot = await db.ref(`posts/${id}`).get();
      if (snapshot.exists()) {
        posts.push(snapshot.val());
      }
    }

    return posts;
  } catch (error) {
    console.error("fetchRecommendedPostsFromPinecone error:", error);
    return [];
  }
}

const PINECONE_API_KEY = defineSecret("PINECONE_API_KEY");

export const getRecommendedPosts = onRequest(
  {
    region: "europe-west3",
    secrets: [PINECONE_API_KEY],
  },
  async (req, res) => {
    try {
      const {embedding, limit = 10} = req.body;

      if (!Array.isArray(embedding)) {
        res.status(400).json({error: "Invalid or missing embedding"});
        return;
      }

      const posts = await fetchRecommendedPostsFromPinecone(
        PINECONE_API_KEY.value(),
        embedding,
        limit
      );

      res.status(200).json(posts);
    } catch (err) {
      console.error("getRecommendedPosts error:", err);
      res.status(500).json({error: "Failed to get recommended posts"});
    }
  }
);

export const getSimilarPostsByTextInput = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req, res) => {
    const {query, limit = 10} = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({error: "Missing or invalid query"});
      return;
    }

    try {
      // 1. Отримуємо embedding від GPT
      const embedding = await generateEmbeddingFromText(query);
      if (!embedding.length) {
        res.status(500).json({error: "Failed to generate embedding"});
        return;
      }

      // 2. Надсилаємо запит до функції getRecommendedPosts
      const response = await fetch("https://getrecommendedposts-vqfzkomcjq-ey.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embedding,
          limit,
        }),
      });

      const posts = await response.json();

      // 3. Повертаємо результат
      res.status(200).json(posts);
    } catch (error) {
      console.error("fetchSimilarPostsByText error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);
