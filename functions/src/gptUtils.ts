// functions/src/gptUtils.ts
import fetch from "node-fetch";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";

export const openaiKey = defineSecret("OPENAI_KEY");

/**
 * Генерує embedding-вектор з тексту, використовуючи OpenAI API.
 * @param {string} text - Вхідний текст для генерації embedding.
 * @return {Promise<number[]>} Вектор embedding або пустий масив у разі помилки.
 */
export async function generateEmbeddingFromText(
  text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-small",
    }),
  });

  const result = await response.json();
  const embedding = result?.data?.[0]?.embedding;
  if (Array.isArray(embedding)) {
    return embedding;
  } else {
    console.error("Failed to generate embedding:", result);
    return [];
  }
}

/**
 * Надсилає запит до OpenAI GPT-4 з зображенням і текстовою інструкцією.
 * @param {string} imageUrl - Посилання на зображення
 * @param {string} instruction - Інструкція для GPT
 * @return {Promise<string>} - Відповідь GPT як текст
 */
export async function sendChatRequest(
  imageUrl: string,
  instruction: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {type: "image_url", image_url: {url: imageUrl}},
            {type: "text", text: instruction},
          ],
        },
      ],
    }),
  });

  const json = await response.json();

  const content = json?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  } else {
    console.error("GPT response error:", JSON.stringify(json, null, 2));
    return "";
  }
}

/**
 * Генерує стислий опис зображення для творчих користувачів.
 */
export const generateTagString = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req, res) => {
    const {imageUrl} = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({error: "Missing or invalid imageUrl"});
      return;
    }

    const instruction = `
  Опиши зображення стисло, як система для творчих людей 
  (дизайнерів, фотографів, художників). Уникай вигадок, вкажи:
  1. Тип сцени (інтер’єр, пейзаж, портрет, графіка тощо);
  2. Основні об'єкти, їх розташування (на передньому плані, в центрі, на фоні);
  3. Візуальні особливості: кольори, стиль, текстури, композиція, освітлення;
  4. Можливий творчий напрям (наприклад: мінімалізм, ретро, урбан, сюрреалізм).
  
  Без оцінок і емоцій. Опиши 1-2 реченням те, що об'єктивно видно на зображенні.
  `;

    try {
      const response = await sendChatRequest(imageUrl, instruction);
      res.status(200).json({description: response.trim()});
    } catch (error) {
      console.error("generateTagString error:", error);
      res.status(500).json({error: "Failed to generate tag string"});
    }
  }
);

export const generateTextEmbedding = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req, res) => {
    const {text} = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({error: "Missing or invalid text"});
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: "text-embedding-3-small",
        }),
      });

      const result = await response.json();
      const embedding = result?.data?.[0]?.embedding;

      if (Array.isArray(embedding)) {
        res.status(200).json({embedding});
      } else {
        console.error("Failed to extract embedding:", result);
        res.status(500).json({error: "Failed to generate embedding"});
      }
    } catch (error) {
      console.error("generateTextEmbedding error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);

/**
   * Визначає ймовірність того, що зображення згенероване AI.
   */
export const aiConfidenceLevel = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req, res) => {
    const {imageUrl} = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({error: "Missing or invalid imageUrl"});
      return;
    }

    const instruction = `
        Проаналізуй це зображення за посиланням: ${imageUrl}.
        На скільки відсотків (від 0 до 100) воно 
        ймовірно згенероване штучним інтелектом?
        Відповідай лише числом без знаку %, без коментарів. Наприклад: 78
        `;

    try {
      const response = await sendChatRequest(imageUrl, instruction);
      const trimmed = response.trim();
      const number = Math.min(Math.max(parseInt(trimmed) || 0, 0), 100);
      res.status(200).json({confidence: number});
    } catch (error) {
      console.error("aiConfidenceLevel error:", error);
      res.status(500).json({error: "Failed to estimate AI confidence"});
    }
  }
);

/**
 * Генерує текстовий prompt для створення аватарки на основі заданих інтересів.
 * @param {string[]} tags - Масив інтересів користувача.
 * @return {string} Згенерований prompt для DALL·E.
 */
function generateAvatarPrompt(tags: string[]): string {
  return `Згенеруй фото профілю вигаданої людини, 
    яка цікавиться наступними темами: ${tags.join(", ")}.
    Фото повинно виглядати сучасно, креативно, відповідно до своїх інтересів. 
    Уникай тексту, складного фону чи надто реалістичного зображення. 
    Стиль: легкий, абстрактний або мінімалістичний. Розмір: 100x100 пікселів.`;
}

export const generateAvatarImageBase64 = onRequest(
  {
    region: "europe-west3",
    secrets: [openaiKey],
  },
  async (req, res) => {
    try {
      const {tags = [], customPrompt} = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({error: "tags must be an array"});
        return;
      }

      const prompt =
          typeof customPrompt === "string" && customPrompt.trim().length > 0 ?
            customPrompt :
            generateAvatarPrompt(tags);

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
      });

      const json = await response.json();
      const base64 = json?.data?.[0]?.b64_json;

      if (typeof base64 === "string") {
        res.status(200).json({base64Image: base64});
      } else {
        console.error("Unexpected OpenAI response:", json);
        res.status(500).json({error: "Image generation failed"});
      }
    } catch (error) {
      console.error("generateAvatarImageBase64 error:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
);
