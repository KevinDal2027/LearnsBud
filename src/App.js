import { useState, useRef, useCallback, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import { Upload, Send, FileText, MessageCircle, Loader2, CheckCircle2, AlertCircle,
  BookOpen, Sparkles, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileUp, 
  LogIn, FolderOpen, File, RefreshCw } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const S3_UPLOAD_URL = process.env.REACT_APP_S3_UPLOAD_URL;
const CHAT_API_URL = process.env.REACT_APP_CHAT_API_URL;
const LIST_DOCUMENTS_API_URL = process.env.REACT_APP_LIST_DOCUMENTS_API_URL;

// Landing page for signed out users
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-outfit flex items-center justify-center">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-2xl">
        {/* Logo */}
        <div className="inline-flex items-center gap-4 mb-6 md:mb-8">
          <div className="p-3 md:p-4 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-2xl md:rounded-3xl shadow-2xl shadow-emerald-500/30">
            <BookOpen className="w-8 h-8 md:w-12 md:h-12 text-slate-900" />
          </div>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4 md:mb-6">
          Study Helper
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-8 md:mb-12 leading-relaxed px-2">
          Your AI-powered study companion. Upload PDFs, ask questions, and learn faster.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
            <FileUp className="w-6 h-6 md:w-8 md:h-8 text-emerald-400 mx-auto mb-2 md:mb-3" />
            <h3 className="text-white font-semibold mb-1 md:mb-2 text-sm md:text-base">Upload PDFs</h3>
            <p className="text-slate-400 text-xs md:text-sm">Securely upload your study materials</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
            <MessageCircle className="w-6 h-6 md:w-8 md:h-8 text-cyan-400 mx-auto mb-2 md:mb-3" />
            <h3 className="text-white font-semibold mb-1 md:mb-2 text-sm md:text-base">Ask Questions</h3>
            <p className="text-slate-400 text-xs md:text-sm">Get instant AI-powered answers</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-teal-400 mx-auto mb-2 md:mb-3" />
            <h3 className="text-white font-semibold mb-1 md:mb-2 text-sm md:text-base">Learn Faster</h3>
            <p className="text-slate-400 text-xs md:text-sm">Understand complex topics easily</p>
          </div>
        </div>

        {/* Auth Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <SignInButton mode="modal">
            <button className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl md:rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-6 md:px-8 py-3 md:py-4 bg-slate-800 border border-slate-600 text-white font-semibold rounded-xl md:rounded-2xl hover:bg-slate-700 hover:border-slate-500 transition-all duration-300">
              Create Account
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

// Documents Sidebar Component
function DocumentsSidebar({ userId, activeDocUrl, setActiveDocUrl, refreshTrigger, onDocumentSelect }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(LIST_DOCUMENTS_API_URL, {
        params: { user_id: userId }
      });
      
      const docs = Array.isArray(response.data) ? response.data : [];
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  const handleDocumentClick = (doc) => {
    setActiveDocUrl(doc.url);
    if (onDocumentSelect) {
      onDocumentSelect(); // Switch to PDF view on mobile
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-semibold text-sm md:text-base">My Documents</h2>
        </div>
        <button
          onClick={fetchDocuments}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-50"
          title="Refresh documents"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <p className="text-slate-400 text-sm">Loading documents...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-red-300 text-sm mb-3">{error}</p>
            <button
              onClick={fetchDocuments}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-all"
            >
              Try Again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <File className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm mb-1">No documents yet</p>
            <p className="text-slate-500 text-xs">Upload a PDF to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => {
              const isActive = activeDocUrl === doc.url;
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30'
                      : 'hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    isActive ? 'bg-emerald-500/20' : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                  }`}>
                    <FileText className={`w-4 h-4 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isActive ? 'text-emerald-300' : 'text-slate-300'
                    }`}>
                      {doc.name}
                    </p>
                    {doc.created_at && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(doc.created_at)}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0"></div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Count Footer */}
      {!isLoading && !error && documents.length > 0 && (
        <div className="p-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// PDF Viewer Component
function PDFViewer({ pdfUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set initial scale based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setScale(0.6);
      } else {
        setScale(1.0);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setPageNumber(1);
    setIsLoading(true);
    setError(null);
  }, [pdfUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF');
    setIsLoading(false);
  }, []);

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.4));

  if (!pdfUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8">
        <FileText className="w-12 h-12 md:w-16 md:h-16 text-slate-600 mb-4" />
        <p className="text-slate-400 text-base md:text-lg mb-2">No PDF selected</p>
        <p className="text-slate-500 text-xs md:text-sm">Select a document from the sidebar or upload a new one</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-2 md:p-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 md:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-slate-300 text-xs md:text-sm px-1 md:px-2 min-w-[60px] text-center">
            {pageNumber} / {numPages || '?'}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1.5 md:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.4}
            className="p-1.5 md:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-slate-300 text-xs md:text-sm w-12 md:w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 2.5}
            className="p-1.5 md:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto p-2 md:p-4 flex justify-center bg-slate-900/50">
        {isLoading && (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
            <p className="text-red-300">{error}</p>
          </div>
        )}
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          className="shadow-2xl"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

// Chat Panel Component
function ChatPanel({ userId, question, setQuestion, chatHistory, setChatHistory, isLoading, setIsLoading }) {
  const handleSendQuestion = async () => {
    if (!question.trim() || !userId) return;

    const userQuestion = question.trim();
    setQuestion('');
    setChatHistory(prev => [...prev, { type: 'user', content: userQuestion }]);
    setIsLoading(true);

    try {
      const response = await axios.post(CHAT_API_URL, {
        question: userQuestion,
        user_id: userId,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const answer = response.data?.answer || response.data?.body || response.data?.message || JSON.stringify(response.data);
      setChatHistory(prev => [...prev, { type: 'assistant', content: answer }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { 
        type: 'error', 
        content: error.response?.data?.message || 'Failed to get response. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/20">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-3 md:p-4 border-b border-slate-700/50">
        <div className="p-2 bg-cyan-500/20 rounded-xl">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
        </div>
        <h2 className="text-base md:text-lg font-semibold text-white">Ask Questions</h2>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 scrollbar-thin">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <Sparkles className="w-10 h-10 md:w-12 md:h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm md:text-base">Ask a question about your documents</p>
            <p className="text-slate-500 text-xs md:text-sm mt-2">Your AI study assistant is ready!</p>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] md:max-w-[85%] p-3 md:p-4 rounded-2xl ${
                  msg.type === 'user'
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-br-md'
                    : msg.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
                    : 'bg-slate-700/50 text-slate-200 rounded-bl-md'
                }`}
              >
                {msg.type === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-600/50">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-cyan-400">AI Response</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-xs md:text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/50 p-3 md:p-4 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-slate-400 text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t border-slate-700/50">
        <div className="flex gap-2 md:gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your question..."
            disabled={isLoading}
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSendQuestion}
            disabled={!question.trim() || isLoading}
            className={`p-2.5 md:p-3 rounded-xl transition-all duration-300 ${
              question.trim() && !isLoading
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile Bottom Navigation
function MobileNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'viewer', label: 'PDF', icon: FileText },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 z-50">
      <div className="flex justify-around items-center py-2 px-4 safe-area-pb">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs font-medium">{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Main Dashboard Component
function Dashboard() {
  const { user } = useUser();
  const userId = user?.id;

  // Mobile tab state
  const [activeTab, setActiveTab] = useState('documents');

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ type: null, message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Active document state
  const [activeDocUrl, setActiveDocUrl] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Chat state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadStatus({ type: null, message: '' });
    } else if (file) {
      setUploadStatus({ type: 'error', message: 'Please select a PDF file' });
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) {
      setUploadStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const uploadUrl = `${S3_UPLOAD_URL}/${encodeURIComponent(userId)}/${encodeURIComponent(selectedFile.name)}`;
      
      await axios.put(uploadUrl, selectedFile, {
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      setUploadStatus({ type: 'success', message: `Uploaded!` });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setRefreshTrigger(prev => prev + 1);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setUploadStatus({ type: null, message: '' });
      }, 3000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({ 
        type: 'error', 
        message: 'Upload failed' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentSelect = () => {
    setActiveTab('viewer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-outfit">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        <header className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg md:rounded-xl shadow-lg shadow-emerald-500/20">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-slate-900" />
            </div>
            <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Study Helper
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="px-2 md:px-4 py-1.5 md:py-2 bg-slate-700/50 border border-slate-600 rounded-lg md:rounded-xl text-slate-300 hover:bg-slate-600/50 transition-all flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {selectedFile ? selectedFile.name.slice(0, 15) + '...' : 'Choose PDF'}
                  </span>
                  <span className="sm:hidden">
                    {selectedFile ? 'File' : 'PDF'}
                  </span>
                </button>
              </div>
              
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl font-medium flex items-center gap-1 md:gap-2 transition-all text-xs md:text-sm ${
                  selectedFile && !isUploading
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/25'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>

            {uploadStatus.type && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                uploadStatus.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-300' 
                  : 'bg-red-500/20 text-red-300'
              }`}>
                {uploadStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="max-w-[150px] truncate">{uploadStatus.message}</span>
              </div>
            )}

            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8 md:w-10 md:h-10"
                }
              }}
            />
          </div>
        </header>

        {uploadStatus.type && (
          <div className={`md:hidden mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
            uploadStatus.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-300' 
              : 'bg-red-500/20 text-red-300'
          }`}>
            {uploadStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{uploadStatus.message}</span>
          </div>
        )}

        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-slate-700/50">
            <DocumentsSidebar 
              userId={userId}
              activeDocUrl={activeDocUrl}
              setActiveDocUrl={setActiveDocUrl}
              refreshTrigger={refreshTrigger}
            />
          </div>

          <div className="flex-1 border-r border-slate-700/50 bg-slate-800/30">
            <PDFViewer pdfUrl={activeDocUrl} />
          </div>

          <div className="w-96">
            <ChatPanel 
              userId={userId}
              question={question}
              setQuestion={setQuestion}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        </div>

        <div className="md:hidden flex-1 overflow-hidden pb-16">
          {activeTab === 'documents' && (
            <DocumentsSidebar 
              userId={userId}
              activeDocUrl={activeDocUrl}
              setActiveDocUrl={setActiveDocUrl}
              refreshTrigger={refreshTrigger}
              onDocumentSelect={handleDocumentSelect}
            />
          )}
          {activeTab === 'viewer' && (
            <PDFViewer pdfUrl={activeDocUrl} />
          )}
          {activeTab === 'chat' && (
            <ChatPanel 
              userId={userId}
              question={question}
              setQuestion={setQuestion}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
        </div>

        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}

export default App;
