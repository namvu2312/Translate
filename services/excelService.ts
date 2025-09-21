
import type { TranslationResult } from '../types';

export const exportToExcel = (data: TranslationResult[], fileName: string): void => {
  if (typeof XLSX === 'undefined') {
    alert('Excel export library is not available. Please check your internet connection and try again.');
    console.error("XLSX library not found.");
    return;
  }
  
  if (!data || data.length === 0) {
    console.error("No data to export.");
    return;
  }

  const dataToExport = data.map(item => ({
    "Tiếng Anh": item.english,
    "Từ loại": item.wordType,
    "Phiên âm": item.phonetic,
    "Tiếng Việt": item.vietnamese,
    "Ví dụ": item.example
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 30 }, // English
    { wch: 20 }, // Word Type
    { wch: 30 }, // Phonetic
    { wch: 30 }, // Vietnamese
    { wch: 50 }, // Example
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Translations");

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};