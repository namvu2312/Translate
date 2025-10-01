import { GoogleGenAI } from "@google/genai";
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

export const translateAndPhoneticize = async (
  texts: string[],
  onResult: (result: TranslationResult) => void
): Promise<void> => {
  if (!texts || texts.length === 0) {
    return;
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
  You will return a stream of individual JSON objects, **one per line**. Each object must have three keys: 'english', 'phonetic', and 'vietnamese'. The 'english' key must exactly match one of the input phrases.
  **DO NOT** wrap the objects in a JSON array (like \`[\` or \`]\`).
  **DO NOT** use markdown formatting (like \`\`\`json).
  Each line of your output must be a single, complete, valid JSON object.`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    let buffer = '';
    for await (const chunk of responseStream) {
      buffer += chunk.text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last, potentially incomplete line

      for (const line of lines) {
        if (line.trim()) {
          try {
            const result = JSON.parse(line);
            onResult(result as TranslationResult);
          } catch (e) {
            console.warn("Skipping invalid JSON line from stream:", line, e);
          }
        }
      }
    }
    // Process any remaining text in the buffer
    if (buffer.trim()) {
        try {
            const result = JSON.parse(buffer);
            onResult(result as TranslationResult);
        } catch (e) {
             console.warn("Skipping invalid JSON from final buffer:", buffer, e);
        }
    }

  } catch (e) {
    console.error("Failed during streaming or parsing Gemini response:", e);
    throw new Error("The translation service failed during streaming. Please try again.");
  }
};
