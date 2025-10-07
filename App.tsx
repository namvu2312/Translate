import React, { useState, useEffect, useCallback } from 'react';
import type { TranslationResult, SelectedText } from './types';
import { extractTextFromFile, translateAndPhoneticize } from './services/geminiService';
import { exportToExcel } from './services/excelService';
import Spinner from './components/Spinner';
import { FiFileText } from 'react-icons/fi';
import { BsCardList } from 'react-icons/bs';
import { MdGTranslate } from 'react-icons/md';

// --- Icon Components ---
const UploadIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
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
  <div className={`bg-slate-800/50 p-6 rounded-xl shadow-lg h-full flex flex-col justify-between border border-slate-700/50 ${className || ''}`}>
    <div>
        <h2 className="text-lg font-semibold mb-4 text-white">1. Upload File</h2>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg p-4 text-center">
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
                <label htmlFor="file-upload" className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Choose an image or PDF
                </label>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, PDF</p>
            </>
        ) : (
            <div>
                <p className="font-semibold text-green-400">File Selected:</p>
                <p className="text-sm text-slate-300 break-all">{file.name}</p>
            </div>
        )}
        </div>
    </div>
    <button
        onClick={onReset}
        disabled={!file && !isLoading}
        className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-slate-600 text-slate-300 font-bold rounded-md hover:bg-slate-700 hover:text-white disabled:border-slate-700 disabled:text-slate-500 disabled:bg-transparent disabled:cursor-not-allowed transition-colors btn-lift"
    >
        <TrashIcon /> <span className="ml-2">Reset</span>
    </button>
  </div>
);

interface TextViewerProps {
  text: string;
  onTextSelect: (selected: string) => void;
  className?: string;
}

const TextViewer: React.FC<TextViewerProps> = ({ text, onTextSelect, className }) => {
  const handleSelection = useCallback(() => {
    // Add a small delay to allow mobile browsers to finalize the text selection
    // before we try to read it. This is a common pattern for touch devices.
    setTimeout(() => {
        const selection = window.getSelection()?.toString().trim();
        if (selection) {
          onTextSelect(selection);
        }
    }, 100);
  }, [onTextSelect]);

  return (
    <div className={`bg-slate-800/50 p-6 rounded-xl shadow-lg h-full flex flex-col border border-slate-700/50 ${className || ''}`}>
      <h2 className="text-lg font-semibold mb-4 text-white">2. Extracted Text</h2>
      <div 
        className="flex-grow bg-slate-900/70 rounded-md p-4 overflow-auto" 
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
      >
        {text ? (
            <pre className="text-slate-300 whitespace-pre-wrap text-sm">{text}</pre>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center empty-state-container">
                <FiFileText className="text-5xl opacity-30 mb-4 empty-state-icon" />
                <p className="text-sm">Nội dung văn bản sẽ hiện ra ở đây.</p>
                <p className="text-sm">Hãy thử tải lên một file để xem điều kỳ diệu!</p>
            </div>
        )}
      </div>
       <p className="text-xs text-slate-500 mt-2 text-center">Highlight text above to add it to the selection panel.</p>
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
    <div className={`bg-slate-800/50 p-6 rounded-xl shadow-lg h-full flex flex-col border border-slate-700/50 ${className || ''}`}>
        <h2 className="text-lg font-semibold mb-4 text-white">3. Select & Translate</h2>
        
        <div className="border border-slate-700 rounded-md p-3 mb-4 flex-shrink-0 h-40 overflow-y-auto">
            <h3 className="font-semibold text-slate-400 mb-2">Selected Text Snippets:</h3>
            {selectedTexts.length > 0 ? (
                 <ul className="space-y-2">
                    {selectedTexts.map(({id, text}) => (
                        <li key={id} className="bg-slate-700/50 p-2 rounded-md text-sm flex justify-between items-center group animate-fadeInDown">
                            <span className="truncate pr-2 text-slate-300">{text}</span>
                            <button onClick={() => onRemoveText(id)} className="text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity">
                                <XCircleIcon />
                            </button>
                        </li>
                    ))}
                 </ul>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm text-center px-4 empty-state-container">
                    <BsCardList className="text-5xl opacity-30 mb-4 empty-state-icon" />
                    <p>Các từ bạn bôi đen sẽ được thu thập tại đây.</p>
                </div>
            )}
        </div>

        <button 
            onClick={onTranslate} 
            disabled={selectedTexts.length === 0 || isTranslating}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-500 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20 mb-2 btn-lift btn-lift-blue"
        >
            {isTranslating ? <Spinner text="Translating..." /> : <><TranslateIcon /> Translate Selection</>}
        </button>

        <button
            onClick={onExport}
            disabled={results.length === 0}
            className="w-full flex items-center justify-center px-4 py-2 border border-slate-600 text-slate-300 font-bold rounded-md hover:bg-slate-700 hover:text-white disabled:border-slate-700 disabled:text-slate-500 disabled:bg-transparent disabled:cursor-not-allowed transition-colors mb-4 btn-lift"
        >
            <DownloadIcon /> Export to Excel
        </button>
        
        <div className="flex-grow overflow-auto border border-slate-700 rounded-md">
            <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3">English</th>
                        <th scope="col" className="px-4 py-3">Phonetic</th>
                        <th scope="col" className="px-4 py-3">Vietnamese</th>
                        <th scope="col" className="px-4 py-3">Example</th>
                    </tr>
                </thead>
                <tbody>
                    {results.length > 0 ? results.map((res, index) => (
                         <tr 
                            key={index} 
                            className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors animate-fadeIn"
                            style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                         >
                            <td className="px-4 py-3 font-medium text-slate-100">{res.english}</td>
                            <td className="px-4 py-3">{res.phonetic}</td>
                            <td className="px-4 py-3">{res.vietnamese}</td>
                            <td className="px-4 py-3">{res.example}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="text-center py-8 text-slate-500">
                                {isTranslating ? 'Receiving results...' : (
                                    <div className="flex flex-col items-center justify-center empty-state-container">
                                        <MdGTranslate className="text-5xl opacity-30 mb-4 empty-state-icon" />
                                        <p>Kết quả dịch, phiên âm và ví dụ đang chờ bạn.</p>
                                    </div>
                                )}
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
      <div className="bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-100">Góp Ý & Báo Lỗi</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" disabled={submissionState === 'submitting' || submissionState === 'success'}>
             <XCircleIcon />
          </button>
        </div>
        
        {submissionState === 'success' ? (
            <div className="bg-green-900 border border-green-500 text-green-200 text-center px-4 py-3 rounded-lg relative">
                Cảm ơn bạn đã góp ý! Cửa sổ sẽ tự động đóng.
            </div>
        ) : (
            <>
                <p className="text-slate-400 mb-4 text-sm">Cảm ơn bạn đã dành thời gian. Mọi góp ý sẽ giúp ứng dụng tốt hơn.</p>
                {submissionState === 'error' && (
                     <div className="bg-red-900 border border-red-500 text-red-200 text-center px-4 py-3 rounded-lg relative mb-4">
                        Gửi thất bại. Vui lòng kiểm tra kết nối và thử lại.
                    </div>
                )}
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Nhập nội dung góp ý của bạn ở đây..."
                  className="w-full h-40 bg-slate-900 text-slate-300 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  aria-label="Feedback input"
                  disabled={submissionState === 'submitting'}
                />
                <div className="flex justify-end mt-6 space-x-3">
                  <button onClick={onClose} className="px-4 py-2 border border-slate-600 text-slate-300 font-semibold rounded-md hover:bg-slate-700 transition" disabled={submissionState === 'submitting'}>
                    Hủy
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={!feedbackText.trim() || submissionState === 'submitting'}
                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition w-24 flex items-center justify-center"
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
  
  const handleTextSelection = useCallback((text: string) => {
    const newSelection = { id: `${Date.now()}-${text.slice(0, 10)}`, text };
    setSelectedTexts(prev => {
        // Check for duplicates inside the updater to prevent stale closures and ensure stability
        if (prev.some(st => st.text === text)) {
            return prev;
        }
        return [...prev, newSelection];
    });
  }, []);

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
    <div 
        className="min-h-screen bg-slate-900 text-slate-200 p-4 lg:p-8 relative"
        style={{backgroundImage: 'radial-gradient(circle at top, hsl(215 30% 15%), hsl(215 30% 11%))'}}
    >
       <button
          onClick={() => setIsFeedbackModalOpen(true)}
          className="fixed top-4 right-4 z-40 flex items-center px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-md hover:bg-slate-700 transition-colors shadow-lg text-sm"
          aria-label="Open feedback form"
        >
          <FeedbackIcon /> Góp Ý
        </button>

        {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}

      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
          AI Text Extractor & Translator
        </h1>
      </header>
      
      {error && (
        <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6 max-w-7xl mx-auto">
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
              <p className="text-slate-400 mt-2 text-sm">This may take a moment for large files.</p>
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
      </main>
    </div>
  );
}

export default App;