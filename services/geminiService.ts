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

  const prompt = `You are an expert linguist and translator. Your task is to provide Vietnamese translations and highly accurate IPA phonetic transcriptions for a list of English phrases.

  **CRITICAL INSTRUCTIONS FOR PHONETICS:**
  1. For the IPA phonetic transcription of each phrase, you **MUST** use the British English pronunciation from the Oxford Learner's Dictionaries (oxfordlearnersdictionaries.com) as your sole and authoritative source.
  2. Use your web search capability to look up each word or the full phrase on that specific website.
  3. If you find an entry, use its IPA transcription exactly as provided. For multi-word phrases, combine the IPA of individual words.
  4. If a word cannot be found in the Oxford Learner's Dictionaries after searching, use "N/A" for its phonetic part. Do not guess or use other sources.

  **Input Phrases:**
  ${texts.map(text => `- "${text}"`).join('\n')}
  
  **Output Format:**
  Return the result as a single, valid JSON array of objects. Each object must have three keys: 'english', 'phonetic', and 'vietnamese'. The 'english' key must exactly match the input phrase. Do not include any text or markdown formatting (like \`\`\`json) outside of the JSON array itself.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const jsonStr = response.text.trim();
    // More robust parsing to handle potential markdown fences if the model adds them
    const startIndex = jsonStr.indexOf('[');
    const endIndex = jsonStr.lastIndexOf(']');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Invalid JSON array format received from the translation service.");
    }
    const jsonArrayStr = jsonStr.substring(startIndex, endIndex + 1);
    
    const result = JSON.parse(jsonArrayStr);
    return result as TranslationResult[];
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", e);
    throw new Error("The translation service returned an invalid format. Please try again.");
  }
};
