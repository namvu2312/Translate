
export interface TranslationResult {
  english: string;
  phonetic: string;
  vietnamese: string;
}

export interface SelectedText {
    id: string;
    text: string;
}

// Informs TypeScript about the global XLSX object loaded from the CDN
declare global {
    const XLSX: any;
}
