import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const moderateText = async (text: string): Promise<{ safe: boolean; reason?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following text for explicit content, sexual content, violence, or offensive material. 
      Return a JSON object with "safe" (boolean) and "reason" (string, optional).
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["safe"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"safe": true}');
    return result;
  } catch (error) {
    console.error("Moderation error:", error);
    return { safe: true }; // Default to safe if AI fails, but ideally we'd be more strict
  }
};

export const moderateImage = async (base64Image: string): Promise<{ safe: boolean; reason?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } },
          { text: "Analyze this image for explicit content, sexual content, violence, or offensive material. Return a JSON object with 'safe' (boolean) and 'reason' (string, optional)." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            safe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["safe"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"safe": true}');
    return result;
  } catch (error) {
    console.error("Image moderation error:", error);
    return { safe: true };
  }
};

export const generateBotProfiles = async (count: number): Promise<any[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Generate ${count} unique social media bot profiles for a community app called Kinterra. 
      Each profile should have a username, bio, interests (list), and a personality style.
      Return as a JSON array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              username: { type: Type.STRING },
              bio: { type: Type.STRING },
              interests: { type: Type.ARRAY, items: { type: Type.STRING } },
              personality: { type: Type.STRING }
            },
            required: ["username", "bio", "interests", "personality"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Bot generation error:", error);
    return [];
  }
};

export const getBotResponse = async (botProfile: any, userMessage: string, chatHistory: string[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are ${botProfile.username}, a user on Kinterra. 
      Your personality: ${botProfile.personality}. 
      Your interests: ${botProfile.interests.join(", ")}.
      Chat history: ${chatHistory.join("\n")}
      User says: "${userMessage}"
      Respond naturally and briefly.`,
    });

    return response.text || "Hey there!";
  } catch (error) {
    console.error("Bot response error:", error);
    return "That's interesting!";
  }
};
