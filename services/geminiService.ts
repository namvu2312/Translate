
import { GoogleGenAI, Type } from "@google/genai";
import type { TranslationResult } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    // This is a fallback for development; in production, the key must be set.
    console.warn("API_KEY environment variable not set. The application may not function correctly.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY as string });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file as data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  const data = await base64EncodedDataPromise;
  return {
    inlineData: {
      data,
      mimeType: file.type,
    },
  };
};

export const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    const filePart = await fileToGenerativePart(file);
    const textPart = { text: "Extract all text from this document. Respond only with the extracted text, preserving formatting and line breaks." };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [filePart, textPart] },
    });

    return response.text;
  } catch (error) {
    console.error("Error extracting text:", error);
    throw new Error("Failed to extract text from the file. Please try a different file or check the console for details.");
  }
};

export const translateAndPhoneticize = async (texts: string[]): Promise<TranslationResult[]> => {
  if (!texts || texts.length === 0) {
    return [];
  }

  const prompt = `For the following list of English phrases, provide the Vietnamese translation and the IPA phonetic transcription for each phrase.
  
  Phrases:
  ${texts.map(text => `- "${text}"`).join('\n')}
  
  Return the result as a valid JSON array of objects. Each object must have three keys: 'english', 'phonetic', and 'vietnamese'. The 'english' key must exactly match the input phrase.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              english: {
                type: Type.STRING,
                description: 'The original English phrase.',
              },
              phonetic: {
                type: Type.STRING,
                description: 'The IPA phonetic transcription of the English phrase.',
              },
              vietnamese: {
                type: Type.STRING,
                description: 'The Vietnamese translation of the phrase.',
              },
            },
            required: ["english", "phonetic", "vietnamese"],
          },
        },
      },
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    return result as TranslationResult[];
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", e);
    throw new Error("The translation service returned an invalid format. Please try again.");
  }
};
