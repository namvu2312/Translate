
import React, { useState, useEffect, useCallback } from 'react';
import type { TranslationResult, SelectedText } from './types';
import { extractTextFromFile, translateAndPhoneticize } from './services/geminiService';
import { exportToExcel } from './services/excelService';
import Spinner from './components/Spinner';

// --- Icon Components ---
const UploadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);
const TrashIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);
const TranslateIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13l4-4M19 17v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m14-8a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V9a2 2 0 012-2h2z" /></svg>
);
const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);
const XCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

// --- Child Components (defined outside App to prevent re-creation on re-renders) ---

interface FileUploadProps {
  onFileChange: (file: File) => void;
  onReset: () => void;
  file: File | null;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onReset, file, isLoading }) => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
    <h2 className="text-xl font-bold mb-4 text-sky-300">1. Upload File</h2>
    <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-4">
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
        disabled={isLoading || !!file}
      />
      {!file ? (
        <>
            <UploadIcon />
            <label htmlFor="file-upload" className="cursor-pointer text-sky-400 hover:text-sky-300 font-semibold">
            Choose an image or PDF
            </label>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, PDF</p>
        </>
      ) : (
        <div className="text-center">
            <p className="font-semibold text-green-400">File Selected:</p>
            <p className="text-sm text-gray-300 break-all">{file.name}</p>
        </div>
      )}
    </div>
    <button
        onClick={onReset}
        disabled={!file && !isLoading}
        className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
    >
        <TrashIcon /> Reset
    </button>
  </div>
);

interface TextViewerProps {
  text: string;
  onTextSelect: (selected: string) => void;
}

const TextViewer: React.FC<TextViewerProps> = ({ text, onTextSelect }) => {
  const handleMouseUp = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      onTextSelect(selection);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-sky-300">2. Extracted Text</h2>
      <div className="flex-grow bg-gray-900 rounded-md p-4 overflow-auto" onMouseUp={handleMouseUp}>
        {text ? (
            <pre className="text-gray-300 whitespace-pre-wrap text-sm">{text}</pre>
        ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
                Text from your file will appear here.
            </div>
        )}
      </div>
       <p className="text-xs text-gray-500 mt-2 text-center">Highlight text above to add it to the selection panel.</p>
    </div>
  );
};

interface ResultsPanelProps {
  selectedTexts: SelectedText[];
  onRemoveText: (id: string) => void;
  onTranslate: () => void;
  onExport: () => void;
  isTranslating: boolean;
  results: TranslationResult[];
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ selectedTexts, onRemoveText, onTranslate, onExport, isTranslating, results }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
        <h2 className="text-xl font-bold mb-4 text-sky-300">3. Select & Translate</h2>
        
        <div className="border border-gray-700 rounded-md p-3 mb-4 flex-shrink-0 h-40 overflow-y-auto">
            <h3 className="font-semibold text-gray-400 mb-2">Selected Text Snippets:</h3>
            {selectedTexts.length > 0 ? (
                 <ul className="space-y-2">
                    {selectedTexts.map(({id, text}) => (
                        <li key={id} className="bg-gray-700 p-2 rounded-md text-sm flex justify-between items-center group">
                            <span className="truncate pr-2">{text}</span>
                            <button onClick={() => onRemoveText(id)} className="text-gray-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity">
                                <XCircleIcon />
                            </button>
                        </li>
                    ))}
                 </ul>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">Text you highlight will be listed here.</div>
            )}
        </div>

        <button 
            onClick={onTranslate} 
            disabled={selectedTexts.length === 0 || isTranslating}
            className="w-full flex items-center justify-center px-4 py-3 bg-sky-600 text-white font-bold rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors mb-4"
        >
            {isTranslating ? <Spinner text="Translating..." /> : <><TranslateIcon /> Translate Selection</>}
        </button>
        
        <div className="flex-grow overflow-auto border border-gray-700 rounded-md">
            <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-sky-300 uppercase bg-gray-700 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3">English</th>
                        <th scope="col" className="px-4 py-3">Word Type</th>
                        <th scope="col" className="px-4 py-3">Phonetic</th>
                        <th scope="col" className="px-4 py-3">Vietnamese</th>
                        <th scope="col" className="px-4 py-3">Example</th>
                    </tr>
                </thead>
                <tbody>
                    {results.length > 0 ? results.map((res, index) => (
                         <tr key={index} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                            <td className="px-4 py-3 font-medium text-white">{res.english}</td>
                            <td className="px-4 py-3">{res.wordType}</td>
                            <td className="px-4 py-3">{res.phonetic}</td>
                            <td className="px-4 py-3">{res.vietnamese}</td>
                            <td className="px-4 py-3">{res.example}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center py-8 text-gray-500">Translation results will show here.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <button
            onClick={onExport}
            disabled={results.length === 0}
            className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
            <DownloadIcon /> Export to Excel
        </button>
  </div>
);


// --- Main App Component ---

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [extractedText, setExtractedText] = useState('');
  const [selectedTexts, setSelectedTexts] = useState<SelectedText[]>([]);
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);

  const handleReset = useCallback(() => {
    setFile(null);
    setIsLoading(false);
    setIsTranslating(false);
    setError(null);
    setExtractedText('');
    setSelectedTexts([]);
    setTranslationResults([]);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, []);

  useEffect(() => {
    if (!file) {
      return;
    }

    const processFile = async () => {
      setIsLoading(true);
      setError(null);
      setExtractedText('');
      setSelectedTexts([]);
      setTranslationResults([]);
      try {
        const text = await extractTextFromFile(file);
        setExtractedText(text);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred during text extraction.');
      } finally {
        setIsLoading(false);
      }
    };
    
    processFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  
  const handleFileChange = (selectedFile: File) => {
    handleReset();
    setFile(selectedFile);
  };
  
  const handleTextSelection = (text: string) => {
    if(!selectedTexts.some(st => st.text === text)) {
      const newSelection = { id: `${Date.now()}-${text.slice(0, 10)}`, text };
      setSelectedTexts(prev => [...prev, newSelection]);
    }
  };

  const handleRemoveSelectedText = (id: string) => {
    setSelectedTexts(prev => prev.filter(st => st.id !== id));
  };
  
  const handleTranslate = async () => {
    if (selectedTexts.length === 0) return;
    setIsTranslating(true);
    setError(null);
    setTranslationResults([]);
    try {
      const texts = selectedTexts.map(st => st.text);
      const results = await translateAndPhoneticize(texts);
      // Sort results to match selection order, as API might not preserve it
      const sortedResults = texts.map(originalText => 
        results.find(res => res.english === originalText)
      ).filter((item): item is TranslationResult => !!item);
      setTranslationResults(sortedResults);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };
  
  const handleExport = () => {
    exportToExcel(translationResults, `translation_export_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">
          AI Text Extractor & Translator
        </h1>
        <p className="text-gray-400 mt-2">Powered by Google Gemini</p>
      </header>
      
      {error && (
        <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                <svg className="fill-current h-6 w-6 text-red-300" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </button>
        </div>
      )}
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{height: 'calc(100vh - 12rem)'}}>
        <FileUpload onFileChange={handleFileChange} onReset={handleReset} file={file} isLoading={isLoading} />
        {isLoading ? (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center">
                 <Spinner text="Extracting text..." />
            </div>
        ) : (
            <TextViewer text={extractedText} onTextSelect={handleTextSelection} />
        )}
        <ResultsPanel 
            selectedTexts={selectedTexts} 
            onRemoveText={handleRemoveSelectedText}
            onTranslate={handleTranslate}
            onExport={handleExport}
            isTranslating={isTranslating}
            results={translationResults}
        />
      </main>
    </div>
  );
}

export default App;