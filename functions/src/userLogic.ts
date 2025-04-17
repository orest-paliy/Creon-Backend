// functions/src/userLogic.ts
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {getDatabase} from "firebase-admin/database";
import {getStorage} from "firebase-admin/storage";
import {Request, Response} from "express";

export const fetchUserProfile = onRequest(
  {
    region: "europe-west3",
  },
  async (req, res) => {
    const {uid} = req.query;

    if (!uid || typeof uid !== "string") {
      res.status(400).json({error: "Missing or invalid uid"});
      return;
    }

    try {
      const snapshot = await admin.database().ref(`users/${uid}`).get();

      if (!snapshot.exists()) {
        res.status(404).json({error: "User not found"});
        return;
      }

      const data = snapshot.val();

      const {
        uid: userId,
        email,
        interests,
        embedding,
        avatarURL,
        createdAt,
        subscriptions,
        followers,
      } = data;

      if (
        typeof userId !== "string" ||
        typeof email !== "string" ||
        !Array.isArray(interests) ||
        !Array.isArray(embedding) ||
        typeof avatarURL !== "string" ||
        typeof createdAt !== "number"
      ) {
        res.status(400).json({error: "Invalid user profile data"});
        return;
      }

      res.status(200).json({
        uid: userId,
        email,
        interests,
        embedding,
        avatarURL,
        createdAt,
        subscriptions: subscriptions ? Object.keys(subscriptions) : [],
        followers: followers ? Object.keys(followers) : [],
      });
    } catch (error) {
      console.error("fetchUserProfile error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

export const createUserProfile = onRequest(
  {
    region: "europe-west3",
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        uid,
        email,
        interests,
        embedding,
        avatarURL,
        createdAt,
        subscriptions = [],
        followers = [],
      } = req.body;

      if (
        !uid || !email || !avatarURL ||
          !Array.isArray(interests) ||
          !Array.isArray(embedding)
      ) {
        res.status(400).json({error: "Missing or invalid user profile fields"});
        return;
      }

      const userProfile = {
        uid,
        email,
        interests,
        embedding,
        avatarURL,
        createdAt: createdAt ?? Date.now(),
        subscriptions: Array.isArray(subscriptions) ?
          Object.fromEntries(subscriptions.map((id) => [id, true])) :
          {},
        followers: Array.isArray(followers) ?
          Object.fromEntries(followers.map((id) => [id, true])) :
          {},
      };

      const db = getDatabase();
      await db.ref(`users/${uid}`).set(userProfile);

      res.status(200).json({success: true});
    } catch (error) {
      console.error("createUserProfile error:", error);
      res.status(500).json({error: "Failed to create user profile"});
    }
  }
);

export const checkIfUserProfileExists = onRequest(
  {
    region: "europe-west3",
  },
  async (req, res) => {
    const {uid} = req.query;

    if (!uid || typeof uid !== "string") {
      res.status(400).json({error: "Missing or invalid uid"});
      return;
    }

    try {
      const snapshot = await getDatabase().ref(`users/${uid}`).get();
      const exists = snapshot.exists();
      res.status(200).json({exists});
    } catch (error) {
      console.error("checkIfUserProfileExists error:", error);
      res.status(500).json({error: "Failed to check user profile"});
    }
  }
);

export const uploadAvatarImage = onRequest(
  {
    region: "europe-west3",
  },
  async (req: Request, res: Response) => {
    const {imageBase64, uid} = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string" ||
        !uid || typeof uid !== "string") {
      res.status(400).json({error: "Missing or invalid imageBase64 or uid"});
      return;
    }

    try {
      const buffer = Buffer.from(imageBase64, "base64");
      const file = getStorage().bucket().file(`avatars/${uid}.jpg`);

      await file.save(buffer, {
        metadata: {
          contentType: "image/jpeg",
        },
      });

      await file.makePublic();

      const imageUrl = `https://storage.googleapis.com/${file.bucket.name}/${file.name}`;
      res.status(200).json({imageUrl});
    } catch (error) {
      console.error("uploadAvatarImage error:", error);
      res.status(500).json({error: "Failed to upload avatar image"});
    }
  }
);

export const updateUserEmbedding = onRequest(
  {
    region: "europe-west3",
  },
  async (req, res) => {
    try {
      const {uid, postEmbedding, alpha, direction} = req.body;

      if (!uid || !Array.isArray(postEmbedding) ||
        typeof alpha !== "number" ||
        !["toward", "away"].includes(direction)) {
        res.status(400).json({error: "Invalid input parameters"});
        return;
      }

      const db = getDatabase();
      const userRef = db.ref(`users/${uid}/embedding`);
      const snapshot = await userRef.get();

      if (!snapshot.exists()) {
        res.status(404).json({error: "User embedding not found"});
        return;
      }

      const userEmbedding: number[] = snapshot.val();

      if (userEmbedding.length !== postEmbedding.length) {
        res.status(400).json({error:
        "Embedding vectors must be of the same length"});
        return;
      }

      const updatedEmbedding = userEmbedding.map((u, i) => {
        const p = postEmbedding[i];
        return direction === "toward" ?
          (1 - alpha) * u + alpha * p :
          (1 - alpha) * u - alpha * p;
      });

      await userRef.set(updatedEmbedding);

      res.status(200).json({success: true});
    } catch (error) {
      console.error("Error updating user embedding:", error);
      res.status(500).json({error: "Internal server error"});
    }
  });
