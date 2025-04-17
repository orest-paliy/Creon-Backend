import {onRequest} from "firebase-functions/v2/https";
import {ImageAnnotatorClient} from "@google-cloud/vision";
import fetch from "node-fetch";

// Клієнт Vision API
const visionClient = new ImageAnnotatorClient();

export const checkImageForUnsafeContent = onRequest(
  {region: "europe-west3"},
  async (req, res) => {
    const {imageUrl} = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({error: "Missing or invalid imageUrl"});
      return;
    }

    try {
      // Завантаження зображення як буфер
      const buffer = await fetch(imageUrl).then((res) => res.buffer());

      const [result] = await visionClient
        .safeSearchDetection({image: {content: buffer}});
      const annotations = result.safeSearchAnnotation;

      if (!annotations) {
        res.status(500).json({error: "No annotations found."});
        return;
      }

      res.status(200).json({
        adult: annotations.adult,
        violence: annotations.violence,
        racy: annotations.racy,
        medical: annotations.medical,
        spoof: annotations.spoof,
      });
    } catch (error) {
      console.error("SafeSearch error:", error);
      res.status(500).json({error: "Failed to analyze image."});
    }
  }
);
