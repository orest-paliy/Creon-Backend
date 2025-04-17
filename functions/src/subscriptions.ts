import {onRequest} from "firebase-functions/v2/https";
import {Request, Response} from "express";
import {getDatabase} from "firebase-admin/database";

export const subscribeToUser = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response) => {
    const {currentUserId, userIdToSubscribe} = req.body;

    if (!currentUserId || !userIdToSubscribe) {
      res.status(400).json({error: "Missing currentUserId"});
      return;
    }

    try {
      const updates: { [key: string]: any } = {
        [`/users/${currentUserId}/subscriptions/${userIdToSubscribe}`]: true,
        [`/users/${userIdToSubscribe}/followers/${currentUserId}`]: true,
      };

      await getDatabase().ref().update(updates);
      res.status(200).json({success: true});
    } catch (error) {
      console.error("subscribeToUser error:", error);
      res.status(500).json({error: "Failed to subscribe"});
    }
  }
);

export const unsubscribeFromUser = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response) => {
    const {currentUserId, userIdToUnsubscribe} = req.body;

    if (!currentUserId || !userIdToUnsubscribe) {
      res.status(400).json({error: "Missing currentUserId"});
      return;
    }

    try {
      const updates: { [key: string]: any } = {
        [`/users/${currentUserId}/subscriptions/${userIdToUnsubscribe}`]: null,
        [`/users/${userIdToUnsubscribe}/followers/${currentUserId}`]: null,
      };

      await getDatabase().ref().update(updates);
      res.status(200).json({success: true});
    } catch (error) {
      console.error("unsubscribeFromUser error:", error);
      res.status(500).json({error: "Failed to unsubscribe"});
    }
  }
);

export const isSubscribed = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response) => {
    const {currentUserId, targetUserId} = req.query;

    if (!currentUserId || !targetUserId) {
      res.status(400).json({error: "Missing currentUserId or targetUserId"});
      return;
    }

    try {
      const snapshot = await getDatabase()
        .ref(`users/${currentUserId}/subscriptions/${targetUserId}`)
        .get();

      const isSubscribed = snapshot.exists();
      res.status(200).json({isSubscribed});
    } catch (error) {
      console.error("isSubscribed error:", error);
      res.status(500).json({error: "Failed to check subscription status"});
    }
  }
);

export const fetchSubscriptions = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response) => {
    const {userId} = req.query;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({error: "Missing or invalid userId"});
      return;
    }

    try {
      const snapshot = await getDatabase()
        .ref(`users/${userId}/subscriptions`)
        .get();

      if (!snapshot.exists()) {
        res.status(200).json({subscriptions: []});
        return;
      }

      const data = snapshot.val();
      const ids = Object.keys(data);
      res.status(200).json({subscriptions: ids});
    } catch (error) {
      console.error("fetchSubscriptions error:", error);
      res.status(500).json({error: "Failed to fetch subscriptions"});
    }
  }
);

export const fetchFollowers = onRequest(
  {region: "europe-west3"},
  async (req: Request, res: Response) => {
    const {userId} = req.query;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({error: "Missing or invalid userId"});
      return;
    }

    try {
      const snapshot = await getDatabase()
        .ref(`users/${userId}/followers`)
        .get();

      if (!snapshot.exists()) {
        res.status(200).json({followers: []});
        return;
      }

      const data = snapshot.val();
      const ids = Object.keys(data);
      res.status(200).json({followers: ids});
    } catch (error) {
      console.error("fetchFollowers error:", error);
      res.status(500).json({error: "Failed to fetch followers"});
    }
  }
);
