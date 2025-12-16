import { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import { Upload, Send, FileText, MessageCircle, Loader2, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FolderOpen, File, RefreshCw, ArrowRight, Sun, Moon } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const S3_UPLOAD_URL = process.env.REACT_APP_S3_UPLOAD_URL;
const CHAT_API_URL = process.env.REACT_APP_CHAT_API_URL;
const LIST_DOCUMENTS_API_URL = process.env.REACT_APP_LIST_DOCUMENTS_API_URL;

// Theme Context
const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-stone-100 text-stone-500'}`}>
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function LandingPage() {
  const { dark } = useTheme();
  return (
    <div className={`min-h-screen font-outfit flex items-center justify-center px-4 ${dark ? 'bg-zinc-950' : 'bg-stone-50'}`}>
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <ThemeToggle />
        </div>
        <h1 className={`text-4xl md:text-5xl font-semibold mb-3 tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
          LearnBuds
        </h1>
        <p className={`mb-10 text-lg ${dark ? 'text-zinc-500' : 'text-stone-500'}`}>
          Study smarter with AI
        </p>

        <div className="space-y-3 mb-12">
          {[
            { n: '1', t: 'Upload your study materials' },
            { n: '2', t: 'Ask questions about your content' },
            { n: '3', t: 'Get instant, accurate answers' },
          ].map((item) => (
            <div key={item.n} className={`flex items-center gap-3 text-left p-4 rounded-xl border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${dark ? 'bg-zinc-800 text-zinc-400' : 'bg-stone-100 text-stone-600'}`}>{item.n}</div>
              <span className={dark ? 'text-zinc-300' : 'text-stone-700'}>{item.t}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <SignInButton mode="modal">
            <button className={`w-full px-6 py-3.5 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${dark ? 'bg-white text-zinc-900 hover:bg-zinc-200' : 'bg-stone-900 text-white hover:bg-stone-800'}`}>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className={`w-full px-6 py-3.5 font-medium rounded-xl border transition-colors ${dark ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}>
              Create Account
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

function DocumentsSidebar({ userId, activeDocUrl, setActiveDocUrl, refreshTrigger, onDocumentSelect }) {
  const { dark } = useTheme();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(LIST_DOCUMENTS_API_URL, { params: { user_id: userId } });
      const docs = Array.isArray(response.data) ? response.data : [];
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments, refreshTrigger]);

  const handleDocumentClick = (doc) => {
    setActiveDocUrl(doc.url);
    if (onDocumentSelect) onDocumentSelect();
  };

  return (
    <div className={`h-full flex flex-col border-r ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-stone-50 border-stone-200'}`}>
      <div className={`flex items-center justify-between p-4 border-b ${dark ? 'border-zinc-800' : 'border-stone-200'}`}>
        <h2 className={`font-medium text-sm ${dark ? 'text-white' : 'text-stone-900'}`}>Documents</h2>
        <button onClick={fetchDocuments} disabled={isLoading} className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${dark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-600'}`}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className={`w-6 h-6 animate-spin ${dark ? 'text-zinc-600' : 'text-stone-400'}`} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className={`text-sm mb-2 ${dark ? 'text-zinc-500' : 'text-stone-500'}`}>{error}</p>
            <button onClick={fetchDocuments} className={`text-sm underline ${dark ? 'text-zinc-400' : 'text-stone-600'}`}>Retry</button>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <File className={`w-8 h-8 mb-2 ${dark ? 'text-zinc-700' : 'text-stone-300'}`} />
            <p className={`text-sm ${dark ? 'text-zinc-600' : 'text-stone-400'}`}>No documents yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => {
              const isActive = activeDocUrl === doc.url;
              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    isActive 
                      ? (dark ? 'bg-white text-zinc-900' : 'bg-stone-900 text-white')
                      : (dark ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700')
                  }`}
                >
                  <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? (dark ? 'text-zinc-900' : 'text-white') : (dark ? 'text-zinc-500' : 'text-stone-400')}`} />
                  <span className="text-sm truncate">{doc.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isLoading && !error && documents.length > 0 && (
        <div className={`p-3 border-t ${dark ? 'border-zinc-800' : 'border-stone-200'}`}>
          <p className={`text-xs text-center ${dark ? 'text-zinc-600' : 'text-stone-400'}`}>{documents.length} file{documents.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}

function PDFViewer({ pdfUrl }) {
  const { dark } = useTheme();
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleResize = () => setScale(window.innerWidth < 768 ? 0.6 : 1.0);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { setPageNumber(1); setIsLoading(true); setError(null); }, [pdfUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => { setNumPages(numPages); setIsLoading(false); setError(null); }, []);
  const onDocumentLoadError = useCallback((error) => { console.error('PDF load error:', error); setError('Failed to load PDF'); setIsLoading(false); }, []);

  const btnClass = `p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${dark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-stone-100 text-stone-600'}`;

  if (!pdfUrl) {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-center p-8 ${dark ? 'bg-zinc-900' : 'bg-white'}`}>
        <FileText className={`w-12 h-12 mb-4 ${dark ? 'text-zinc-700' : 'text-stone-200'}`} />
        <p className={dark ? 'text-zinc-500' : 'text-stone-400'}>Select a document to view</p>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${dark ? 'bg-zinc-900' : 'bg-white'}`}>
      <div className={`flex items-center justify-between p-3 border-b ${dark ? 'border-zinc-800' : 'border-stone-200'}`}>
        <div className="flex items-center gap-1">
          <button onClick={() => setPageNumber(p => Math.max(p - 1, 1))} disabled={pageNumber <= 1} className={btnClass}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-sm px-2 min-w-[60px] text-center ${dark ? 'text-zinc-400' : 'text-stone-600'}`}>{pageNumber} / {numPages || '?'}</span>
          <button onClick={() => setPageNumber(p => Math.min(p + 1, numPages || 1))} disabled={pageNumber >= (numPages || 1)} className={btnClass}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(s - 0.2, 0.4))} disabled={scale <= 0.4} className={btnClass}>
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className={`text-sm w-14 text-center ${dark ? 'text-zinc-400' : 'text-stone-600'}`}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(s + 0.2, 2.5))} disabled={scale >= 2.5} className={btnClass}>
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-auto p-4 flex justify-center ${dark ? 'bg-zinc-950' : 'bg-stone-100'}`}>
        {isLoading && <Loader2 className={`w-6 h-6 animate-spin ${dark ? 'text-zinc-600' : 'text-stone-400'}`} />}
        {error && <p className={dark ? 'text-zinc-500' : 'text-stone-500'}>{error}</p>}
        <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading="" className="shadow-sm">
          <Page pageNumber={pageNumber} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} />
        </Document>
      </div>
    </div>
  );
}

function ChatPanel({ userId, question, setQuestion, chatHistory, setChatHistory, isLoading, setIsLoading }) {
  const { dark } = useTheme();
  
  const handleSendQuestion = async () => {
    if (!question.trim() || !userId) return;
    const userQuestion = question.trim();
    setQuestion('');
    setChatHistory(prev => [...prev, { type: 'user', content: userQuestion }]);
    setIsLoading(true);
    try {
      const response = await axios.post(CHAT_API_URL, { question: userQuestion, user_id: userId }, { headers: { 'Content-Type': 'application/json' } });
      const answer = response.data?.answer || response.data?.body || response.data?.message || JSON.stringify(response.data);
      setChatHistory(prev => [...prev, { type: 'assistant', content: answer }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { type: 'error', content: 'Failed to get response. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendQuestion(); } };

  return (
    <div className={`h-full flex flex-col ${dark ? 'bg-zinc-900' : 'bg-white'}`}>
      <div className={`p-4 border-b ${dark ? 'border-zinc-800' : 'border-stone-200'}`}>
        <h2 className={`font-medium text-sm ${dark ? 'text-white' : 'text-stone-900'}`}>Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageCircle className={`w-8 h-8 mb-3 ${dark ? 'text-zinc-700' : 'text-stone-200'}`} />
            <p className={`text-sm ${dark ? 'text-zinc-500' : 'text-stone-400'}`}>Ask a question about your documents</p>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.type === 'user' 
                  ? (dark ? 'bg-white text-zinc-900 rounded-br-md' : 'bg-stone-900 text-white rounded-br-md')
                  : msg.type === 'error' 
                  ? 'bg-red-500/10 text-red-500 rounded-bl-md'
                  : (dark ? 'bg-zinc-800 text-zinc-200 rounded-bl-md' : 'bg-stone-100 text-stone-700 rounded-bl-md')
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`p-3 rounded-2xl rounded-bl-md ${dark ? 'bg-zinc-800' : 'bg-stone-100'}`}>
              <Loader2 className={`w-4 h-4 animate-spin ${dark ? 'text-zinc-500' : 'text-stone-400'}`} />
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 border-t ${dark ? 'border-zinc-800' : 'border-stone-200'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            disabled={isLoading}
            className={`flex-1 border rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none disabled:opacity-50 ${
              dark 
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-600' 
                : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 focus:border-stone-400'
            }`}
          />
          <button
            onClick={handleSendQuestion}
            disabled={!question.trim() || isLoading}
            className={`p-3 rounded-xl transition-colors ${
              question.trim() && !isLoading 
                ? (dark ? 'bg-white text-zinc-900 hover:bg-zinc-200' : 'bg-stone-900 text-white hover:bg-stone-800')
                : (dark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-stone-100 text-stone-300 cursor-not-allowed')
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileNav({ activeTab, setActiveTab }) {
  const { dark } = useTheme();
  const tabs = [
    { id: 'documents', label: 'Files', icon: FolderOpen },
    { id: 'viewer', label: 'View', icon: FileText },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
  ];

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 border-t z-50 ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
      <div className="flex justify-around items-center py-2 px-4 safe-area-pb">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${isActive ? (dark ? 'text-white' : 'text-stone-900') : (dark ? 'text-zinc-500' : 'text-stone-400')}`}>
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard() {
  const { dark } = useTheme();
  const { user } = useUser();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState('documents');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ type: null, message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [activeDocUrl, setActiveDocUrl] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') { setSelectedFile(file); setUploadStatus({ type: null, message: '' }); }
    else if (file) { setUploadStatus({ type: 'error', message: 'PDF only' }); setSelectedFile(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) { setUploadStatus({ type: 'error', message: 'Select a file' }); return; }
    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });
    try {
      const uploadUrl = `${S3_UPLOAD_URL}/${encodeURIComponent(userId)}/${encodeURIComponent(selectedFile.name)}`;
      await axios.put(uploadUrl, selectedFile, { headers: { 'Content-Type': 'application/pdf' } });
      setUploadStatus({ type: 'success', message: 'Uploaded' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setUploadStatus({ type: null, message: '' }), 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({ type: 'error', message: 'Failed' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`min-h-screen font-outfit ${dark ? 'bg-zinc-950' : 'bg-stone-50'}`}>
      <div className="h-screen flex flex-col">
        <header className={`flex items-center justify-between px-4 md:px-6 py-3 border-b ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200'}`}>
          <h1 className={`text-lg md:text-xl font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>LearnBuds</h1>
          
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <button className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">{selectedFile ? selectedFile.name.slice(0, 12) + '...' : 'Choose'}</span>
                </button>
              </div>
              
              <button onClick={handleUpload} disabled={!selectedFile || isUploading} className={`px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm ${
                selectedFile && !isUploading 
                  ? (dark ? 'bg-white text-zinc-900 hover:bg-zinc-200' : 'bg-stone-900 text-white hover:bg-stone-800')
                  : (dark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-stone-100 text-stone-400 cursor-not-allowed')
              }`}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>

            {uploadStatus.type && (
              <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${uploadStatus.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {uploadStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{uploadStatus.message}</span>
              </div>
            )}

            <ThemeToggle />
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </div>
      </header>

        {uploadStatus.type && (
          <div className={`md:hidden mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${uploadStatus.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{uploadStatus.message}</span>
          </div>
        )}

        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="w-56"><DocumentsSidebar userId={userId} activeDocUrl={activeDocUrl} setActiveDocUrl={setActiveDocUrl} refreshTrigger={refreshTrigger} /></div>
          <div className="flex-1"><PDFViewer pdfUrl={activeDocUrl} /></div>
          <div className={`w-80 border-l ${dark ? 'border-zinc-800' : 'border-stone-200'}`}><ChatPanel userId={userId} question={question} setQuestion={setQuestion} chatHistory={chatHistory} setChatHistory={setChatHistory} isLoading={isLoading} setIsLoading={setIsLoading} /></div>
        </div>

        <div className="md:hidden flex-1 overflow-hidden pb-16">
          {activeTab === 'documents' && <DocumentsSidebar userId={userId} activeDocUrl={activeDocUrl} setActiveDocUrl={setActiveDocUrl} refreshTrigger={refreshTrigger} onDocumentSelect={() => setActiveTab('viewer')} />}
          {activeTab === 'viewer' && <PDFViewer pdfUrl={activeDocUrl} />}
          {activeTab === 'chat' && <ChatPanel userId={userId} question={question} setQuestion={setQuestion} chatHistory={chatHistory} setChatHistory={setChatHistory} isLoading={isLoading} setIsLoading={setIsLoading} />}
        </div>

        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SignedOut><LandingPage /></SignedOut>
      <SignedIn><Dashboard /></SignedIn>
    </ThemeProvider>
  );
}

export default App;
