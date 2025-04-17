import {onRequest} from "firebase-functions/v2/https";
import {getDatabase} from "firebase-admin/database";
import {Request, Response} from "express";

const db = getDatabase();

/**
 * Отримати коментарі для конкретного поста.
 */
export const fetchComments = onRequest(
  {
    region: "europe-west3",
  },
  async (req: Request, res: Response) => {
    const {postId} = req.query;

    if (!postId || typeof postId !== "string") {
      res.status(400).json({error: "Missing or invalid postId"});
      return;
    }

    try {
      const snapshot = await db.ref(`posts/${postId}/comments`).get();
      const result: any[] = [];

      snapshot.forEach((child) => {
        result.push(child.val());
      });

      res.status(200).json(result);
    } catch (error) {
      console.error("fetchComments error:", error);
      res.status(500).json({error: "Failed to fetch comments"});
    }
  }
);

/**
 * Зберегти масив коментарів для поста.
 */
export const saveComments = onRequest(
  {
    region: "europe-west3",
  },
  async (req: Request, res: Response) => {
    const {postId, comments} = req.body;

    if (!postId || !Array.isArray(comments)) {
      res.status(400).json({error: "Missing or invalid postId/comments"});
      return;
    }

    try {
      const commentMap: Record<string, any> = {};

      comments.forEach((comment: any, index: number) => {
        commentMap[String(index)] = comment;
      });

      await db.ref(`posts/${postId}/comments`).set(commentMap);
      res.status(200).json({success: true});
    } catch (error) {
      console.error("saveComments error:", error);
      res.status(500).json({error: "Failed to save comments"});
    }
  }
);
