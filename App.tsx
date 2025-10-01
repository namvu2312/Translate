import React, { useState, useEffect, useCallback } from 'react';
import type { TranslationResult, SelectedText } from './types';
import { extractTextFromFile, translateAndPhoneticize } from './services/geminiService';
import { exportToExcel } from './services/excelService';
import Spinner from './components/Spinner';
import { Analytics } from '@vercel/analytics/react';
// --- Icon Components ---
const UploadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);
const TrashIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);
const TranslateIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13l4-4M19 17v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m14-8a2 2 0 012 2v2a2 2 0 01-2-2h-2a2 2 0 01-2-2V9a2 2 0 012-2h2z" /></svg>
);
const DownloadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);
const XCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const FeedbackIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

// --- Child Components (defined outside App to prevent re-creation on re-renders) ---

interface FileUploadProps {
  onFileChange: (file: File) => void;
  onReset: () => void;
  file: File | null;
  isLoading: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onReset, file, isLoading, className }) => (
  <div className={`bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col justify-between border border-gray-700 ${className || ''}`}>
    <div>
        <h2 className="text-xl font-bold mb-4 text-sky-300">1. Upload File</h2>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-4">
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
  className?: string;
}

const TextViewer: React.FC<TextViewerProps> = ({ text, onTextSelect, className }) => {
  const handleSelection = () => {
    // Add a small delay to allow mobile browsers to finalize the text selection
    // before we try to read it. This is a common pattern for touch devices.
    setTimeout(() => {
        const selection = window.getSelection()?.toString().trim();
        if (selection) {
          onTextSelect(selection);
        }
    }, 100);
  };

  return (
    <div className={`bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 ${className || ''}`}>
      <h2 className="text-xl font-bold mb-4 text-sky-300">2. Extracted Text</h2>
      <div 
        className="flex-grow bg-gray-900 rounded-md p-4 overflow-auto" 
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
      >
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
  className?: string;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ selectedTexts, onRemoveText, onTranslate, onExport, isTranslating, results, className }) => (
    <div className={`bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 ${className || ''}`}>
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
            className="w-full flex items-center justify-center px-4 py-3 bg-sky-600 text-white font-bold rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors mb-2"
        >
            {isTranslating ? <Spinner text="Translating..." /> : <><TranslateIcon /> Translate Selection</>}
        </button>

        <button
            onClick={onExport}
            disabled={results.length === 0}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors mb-4"
        >
            <DownloadIcon /> Export to Excel
        </button>
        
        <div className="flex-grow overflow-auto border border-gray-700 rounded-md">
            <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-sky-300 uppercase bg-gray-700 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3">English</th>
                        <th scope="col" className="px-4 py-3">Phonetic</th>
                        <th scope="col" className="px-4 py-3">Vietnamese</th>
                    </tr>
                </thead>
                <tbody>
                    {results.length > 0 ? results.map((res, index) => (
                         <tr key={index} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                            <td className="px-4 py-3 font-medium text-white">{res.english}</td>
                            <td className="px-4 py-3">{res.phonetic}</td>
                            <td className="px-4 py-3">{res.vietnamese}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={3} className="text-center py-8 text-gray-500">
                                {isTranslating ? 'Receiving results...' : 'Translation results will show here.'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
  </div>
);

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async () => {
    if (feedbackText.trim() === '') {
      return;
    }
    setSubmissionState('submitting');

    try {
      const response = await fetch('https://formspree.io/f/xnngjbnq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ feedback: feedbackText }),
      });

      if (response.ok) {
        setSubmissionState('success');
        setTimeout(() => {
          onClose();
        }, 2500); // Close after 2.5 seconds
      } else {
        setSubmissionState('error');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmissionState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" aria-modal="true" role="dialog">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-sky-300">Góp Ý & Báo Lỗi</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" disabled={submissionState === 'submitting' || submissionState === 'success'}>
             <XCircleIcon />
          </button>
        </div>
        
        {submissionState === 'success' ? (
            <div className="bg-green-900 border border-green-500 text-green-200 text-center px-4 py-3 rounded-lg relative">
                Cảm ơn bạn đã góp ý! Cửa sổ sẽ tự động đóng.
            </div>
        ) : (
            <>
                <p className="text-gray-400 mb-4 text-sm">Cảm ơn bạn đã dành thời gian. Mọi góp ý sẽ giúp ứng dụng tốt hơn.</p>
                {submissionState === 'error' && (
                     <div className="bg-red-900 border border-red-500 text-red-200 text-center px-4 py-3 rounded-lg relative mb-4">
                        Gửi thất bại. Vui lòng kiểm tra kết nối và thử lại.
                    </div>
                )}
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Nhập nội dung góp ý của bạn ở đây..."
                  className="w-full h-40 bg-gray-900 text-gray-300 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  aria-label="Feedback input"
                  disabled={submissionState === 'submitting'}
                />
                <div className="flex justify-end mt-6 space-x-3">
                  {/* FIX: Removed `|| submissionState === 'success'` from the disabled check. This comparison caused a TypeScript error because the 'submissionState' type is narrowed within this conditional render block and can never be 'success'. The button only needs to be disabled while submitting. */}
                  <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition" disabled={submissionState === 'submitting'}>
                    Hủy
                  </button>
                  {/* FIX: Removed `|| submissionState === 'success'` from the disabled check for the same reason as the button above. */}
                  <button 
                    onClick={handleSubmit} 
                    disabled={!feedbackText.trim() || submissionState === 'submitting'}
                    className="px-4 py-2 bg-sky-600 text-white font-bold rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition w-24 flex items-center justify-center"
                  >
                    {submissionState === 'submitting' ? <Spinner /> : 'Gửi'}
                  </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};


// --- Main App Component ---

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  
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
      
      const handleNewResult = (newResult: TranslationResult) => {
        setTranslationResults(prevResults => [...prevResults, newResult]);
      };
      
      await translateAndPhoneticize(texts, handleNewResult);

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };
  
  const handleExport = () => {
    const textsInOrder = selectedTexts.map(st => st.text);
    const sortedResults = textsInOrder.map(originalText => 
        translationResults.find(res => res.english === originalText)
    ).filter((item): item is TranslationResult => !!item);
    exportToExcel(sortedResults, `translation_export_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 lg:p-8 relative">
       <button
          onClick={() => setIsFeedbackModalOpen(true)}
          className="fixed top-4 right-4 z-40 flex items-center px-3 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors shadow-lg text-sm"
          aria-label="Open feedback form"
        >
          <FeedbackIcon /> Góp Ý
        </button>

        {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}

      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">
          AI Text Extractor & Translator
        </h1>
      </header>
      
      {error && (
        <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <XCircleIcon />
          </button>
        </div>
      )}

      {isLoading && (
          <div className="flex flex-col items-center justify-center my-8">
              <Spinner text="Extracting text from your file..." />
              <p className="text-gray-400 mt-2 text-sm">This may take a moment for large files.</p>
          </div>
      )}
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto h-[calc(100vh-12rem)]">
        <FileUpload 
            onFileChange={handleFileChange}
            onReset={handleReset}
            file={file}
            isLoading={isLoading}
        />
        <TextViewer text={extractedText} onTextSelect={handleTextSelection} />
        <ResultsPanel 
            selectedTexts={selectedTexts}
            onRemoveText={handleRemoveSelectedText}
            onTranslate={handleTranslate}
            onExport={handleExport}
            isTranslating={isTranslating}
            results={translationResults}
        />
        <Analytics />
      </main>
    </div>
  );
}

export default App;
