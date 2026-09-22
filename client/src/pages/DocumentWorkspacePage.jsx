import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  BookOpen,
  ListOrdered,
  HelpCircle,
  Send,
  Sparkles,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Info,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CreatorProfileCard from '../components/CreatorProfileCard';
import Markdown from '../components/Markdown';

// Groups retrieved-chunk sources by page number, preserving first-seen
// order, so the citation row shows one badge per page instead of one per
// chunk (a dense page can contribute more than one of the top-K chunks).
function groupSourcesByPage(sources) {
  const byPage = new Map();
  for (const src of sources) {
    if (!byPage.has(src.page)) {
      byPage.set(src.page, { page: src.page, texts: [] });
    }
    byPage.get(src.page).texts.push(src.text);
  }
  return [...byPage.values()];
}

export default function DocumentWorkspacePage() {
  const { id } = useParams();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'chat';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [doc, setDoc] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [inputQuery, setInputQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState({});
  const [activeSourcePreview, setActiveSourcePreview] = useState(null);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [fileOpenError, setFileOpenError] = useState('');

  // Phase 12 analysis loading states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isExtractingPoints, setIsExtractingPoints] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const chatEndRef = useRef(null);

  const loadDocument = useCallback(async () => {
    setNotFound(false);
    setLoadError('');
    try {
      const documentData = await api.getDocumentById(id);
      if (documentData) {
        setDoc(documentData);
        setMessages(documentData.initialMessages || []);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else if (err.status === 401) {
        signOut();
      } else {
        setLoadError(err.message || 'Failed to load this document.');
      }
    }
  }, [id, signOut]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    if (searchParams.get('tab')) {
      setActiveTab(searchParams.get('tab'));
    }
  }, [searchParams]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || isAiThinking) return;

    const queryText = inputQuery.trim();
    setInputQuery('');

    const userMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: queryText,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsAiThinking(true);

    try {
      const backendResult = await api.askQuestion({
        documentId: doc?.id,
        question: queryText,
        sessionId
      });

      const aiMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: backendResult.answer,
        sources: backendResult.sources || [],
        grounded: backendResult.grounded !== false,
        profile: backendResult.profile || null,
        createdAt: new Date().toISOString()
      };

      const newMessages = [aiMessage];
      if (backendResult.externalAnswer) {
        // A separate bubble, never merged into the grounded message above —
        // this content did not come from the document and must never be
        // mistaken for a cited answer.
        newMessages.push({
          id: 'ext-' + Date.now(),
          role: 'assistant',
          isExternal: true,
          content: backendResult.externalAnswer,
          createdAt: new Date().toISOString()
        });
      }
      setMessages(prev => [...prev, ...newMessages]);
      if (backendResult.sessionId) {
        setSessionId(backendResult.sessionId);
      }
    } catch (err) {
      // A failed request must never be papered over with an invented
      // answer — that's the opposite of what this app promises (cited,
      // grounded answers only). Show the real failure instead.
      if (err.status === 401) {
        signOut();
        return;
      }
      const errorMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        isError: true,
        content: err.message || 'Something went wrong. Please try again.',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleCopySummary = () => {
    if (doc?.summary) {
      navigator.clipboard.writeText(doc.summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleRegenerateSummary = useCallback(async () => {
    if (isGeneratingSummary || !doc) return;
    setIsGeneratingSummary(true);
    try {
      const res = await api.generateSummary(doc.id);
      if (res && res.summary) {
        setDoc(prev => ({ ...prev, summary: res.summary }));
      }
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [doc, isGeneratingSummary]);

  const handleExtractKeyPoints = useCallback(async () => {
    if (isExtractingPoints || !doc) return;
    setIsExtractingPoints(true);
    try {
      const res = await api.extractKeyPoints(doc.id);
      if (res && res.keyPoints) {
        setDoc(prev => ({ ...prev, keyPoints: res.keyPoints }));
      }
    } catch (err) {
      console.error('Key points error:', err);
    } finally {
      setIsExtractingPoints(false);
    }
  }, [doc, isExtractingPoints]);

  const handleGenerateQuiz = useCallback(async () => {
    if (isGeneratingQuiz || !doc) return;
    setIsGeneratingQuiz(true);
    try {
      const res = await api.generateQuiz(doc.id, 3);
      if (res && res.mcqs) {
        setDoc(prev => ({ ...prev, mcqs: res.mcqs }));
        setSelectedQuizAnswers({});
      }
    } catch (err) {
      console.error('Quiz error:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [doc, isGeneratingQuiz]);

  // Auto-generate analysis content the first time its tab is opened. Each
  // handler above already guards on its own "is this already loaded/in
  // flight" state, so including them here (now stable via useCallback,
  // rather than a lint-silencing omission) doesn't cause repeat calls —
  // once doc.summary/keyPoints/mcqs is set, the corresponding branch's
  // guard condition is false and the effect body is a no-op on re-runs.
  useEffect(() => {
    if (!doc) return;
    if (activeTab === 'summary' && !doc.summary && !isGeneratingSummary) {
      handleRegenerateSummary();
    } else if (activeTab === 'keypoints' && (!doc.keyPoints || doc.keyPoints.length === 0) && !isExtractingPoints) {
      handleExtractKeyPoints();
    } else if (activeTab === 'quiz' && (!doc.mcqs || doc.mcqs.length === 0) && !isGeneratingQuiz) {
      handleGenerateQuiz();
    }
  }, [activeTab, doc, isGeneratingSummary, isExtractingPoints, isGeneratingQuiz, handleRegenerateSummary, handleExtractKeyPoints, handleGenerateQuiz]);

  const handleOpenOriginalFile = async () => {
    if (!doc || isOpeningFile) return;
    setFileOpenError('');
    setIsOpeningFile(true);

    // Open the tab synchronously, inside the click handler — opening it
    // only after the `await` below loses the user-gesture context and gets
    // silently popup-blocked in real browsers.
    const newTab = window.open('', '_blank', 'noopener,noreferrer');

    try {
      const url = await api.getFileUrl(doc.id);
      if (url && newTab) {
        newTab.location.href = url;
      } else {
        newTab?.close();
        setFileOpenError('The original file is not available for this document.');
      }
    } finally {
      setIsOpeningFile(false);
    }
  };

  const handleSelectQuizOption = (qId, optionIdx) => {
    setSelectedQuizAnswers(prev => ({
      ...prev,
      [qId]: optionIdx
    }));
  };

  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <FileText className="w-8 h-8 mx-auto mb-3 text-parchment-dim" />
        <p className="text-sm text-parchment-dim mb-4">
          This document no longer exists, or you don't have access to it.
        </p>
        <Link to="/dashboard" className="btn-brass px-4 py-2 text-sm inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to the Stacks</span>
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <FileText className="w-8 h-8 mx-auto mb-3 text-red-400/70" />
        <p className="text-sm text-parchment-dim mb-4">{loadError}</p>
        <button onClick={loadDocument} className="btn-brass px-4 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin text-brass mb-3">
          <Sparkles className="w-8 h-8" />
        </div>
        <p className="text-sm text-parchment-dim">Loading document workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Breadcrumb & Document Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-brass/25">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-sm border border-ink-line text-parchment-dim hover:text-brass-light hover:border-brass/50 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-10 h-10 rounded-sm bg-brass flex items-center justify-center text-ink shrink-0">
            <FileText className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-parchment tracking-tight truncate max-w-md">
                {doc.fileName}
              </h1>
              <span className="index-label text-brass border border-brass/40 px-1.5 py-0.5 rounded-sm">
                {doc.fileType}
              </span>
            </div>
            <p className="text-xs text-parchment-dim mt-1 font-mono">
              {doc.totalPages} Pages • {doc.status === 'ready' ? 'RAG Vectors Ready' : 'Processing'} • Indexed
            </p>
          </div>
        </div>

        {/* Feature Tab Navigation */}
        <div className="flex items-center border border-ink-line rounded-sm overflow-x-auto">
          <button
            onClick={() => handleTabChange('chat')}
            className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap border-r last:border-r-0 border-ink-line ${
              activeTab === 'chat'
                ? 'bg-brass text-ink font-semibold'
                : 'text-parchment-dim hover:text-parchment hover:bg-ink-soft'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI Chat (RAG)</span>
          </button>

          <button
            onClick={() => handleTabChange('summary')}
            className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap border-r last:border-r-0 border-ink-line ${
              activeTab === 'summary'
                ? 'bg-brass text-ink font-semibold'
                : 'text-parchment-dim hover:text-parchment hover:bg-ink-soft'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>

          <button
            onClick={() => handleTabChange('keypoints')}
            className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap border-r last:border-r-0 border-ink-line ${
              activeTab === 'keypoints'
                ? 'bg-brass text-ink font-semibold'
                : 'text-parchment-dim hover:text-parchment hover:bg-ink-soft'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Key Points</span>
          </button>

          <button
            onClick={() => handleTabChange('quiz')}
            className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap border-r last:border-r-0 border-ink-line ${
              activeTab === 'quiz'
                ? 'bg-brass text-ink font-semibold'
                : 'text-parchment-dim hover:text-parchment hover:bg-ink-soft'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Quiz &amp; MCQs</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="mt-6">
        {/* ==================== TAB 1: AI CHAT (RAG) ==================== */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Chat Thread (3 cols) */}
            <div className="lg:col-span-3 flex flex-col h-[650px] sheet overflow-hidden">
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-md ${
                        msg.role === 'user'
                          ? 'bg-ink-text text-parchment rounded-tr-none'
                          : msg.isError
                          ? 'bg-red-50 border border-red-300 text-ink-text rounded-tl-none'
                          : msg.isExternal
                          ? 'bg-sky-50 border border-sky-300 text-ink-text rounded-tl-none'
                          : msg.grounded === false
                          ? 'bg-amber-50 border border-amber-300 text-ink-text rounded-tl-none'
                          : 'sheet-well text-ink-text rounded-tl-none'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className={`flex items-center gap-2 mb-2 pb-2 border-b index-label ${
                          msg.isError
                            ? 'border-red-300 text-red-700'
                            : msg.isExternal
                            ? 'border-sky-300 text-sky-700'
                            : msg.grounded === false ? 'border-amber-300 text-amber-700' : 'border-ink/15 text-brass-dim'
                        }`}>
                          {msg.isError ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Couldn't get an answer</span>
                            </>
                          ) : msg.isExternal ? (
                            <>
                              <Globe className="w-3.5 h-3.5" />
                              <span>General Knowledge — Not from your document, unverified</span>
                            </>
                          ) : msg.grounded === false ? (
                            <>
                              <Info className="w-3.5 h-3.5" />
                              <span>Not found in this document</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>SmartDocs AI Assistant</span>
                            </>
                          )}
                        </div>
                      )}

                      {msg.role === 'assistant' ? (
                        <Markdown>{msg.content}</Markdown>
                      ) : (
                        // User text is shown literally — never parsed as markdown.
                        <div className="whitespace-pre-line font-sans">{msg.content}</div>
                      )}

                      {/* Creator Profile Card */}
                      {msg.profile && <CreatorProfileCard profile={msg.profile} />}

                      {/* Source Citations Badges — one per unique page. The
                          top-K retrieved chunks can include more than one
                          chunk from the same page (a dense page splits into
                          several ~800-char chunks), so group by page rather
                          than rendering a badge per chunk — otherwise the
                          same page number shows up twice in the row. */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-ink/15">
                          <p className="index-label text-ink-text/50 mb-1.5">
                            Grounded Citations:
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {groupSourcesByPage(msg.sources).map((group) => (
                              <button
                                key={group.page}
                                onClick={() => setActiveSourcePreview(group)}
                                className="tab-brass hover:bg-brass-light transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>Page {group.page}</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isAiThinking && (
                  <div className="flex justify-start">
                    <div className="sheet-well rounded-tl-none p-4 text-xs text-ink-text/70 flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-brass animate-spin" />
                      <span>Searching indexed chunks and synthesizing answer...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Prompt Suggestions */}
              <div className="px-4 py-2.5 border-t border-ink/15 flex items-center gap-2 overflow-x-auto text-[11px] text-ink-text/60">
                <span className="shrink-0 index-label text-ink-text/45">Suggested:</span>
                <button
                  onClick={() => setInputQuery('Give me a brief summary of the main points.')}
                  className="px-2.5 py-1 rounded-sm border border-ink/20 hover:border-brass hover:text-ink-text text-ink-text/70 whitespace-nowrap transition-colors"
                >
                  Document summary
                </button>
                <button
                  onClick={() => setInputQuery('What are the key methodologies or concepts presented?')}
                  className="px-2.5 py-1 rounded-sm border border-ink/20 hover:border-brass hover:text-ink-text text-ink-text/70 whitespace-nowrap transition-colors"
                >
                  Key concepts
                </button>
                <button
                  onClick={() => setInputQuery('Which page discusses the primary conclusions?')}
                  className="px-2.5 py-1 rounded-sm border border-ink/20 hover:border-brass hover:text-ink-text text-ink-text/70 whitespace-nowrap transition-colors"
                >
                  Primary conclusions
                </button>
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-ink/15 flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a question about this document..."
                  className="field-paper flex-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isAiThinking}
                  className="btn-brass px-4 py-2.5 flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Right Context & Source Panel (1 col) */}
            <div className="space-y-4">
              <div className="sheet p-5">
                <h3 className="index-label text-ink-text/60 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-brass-dim" />
                  <span>Document Details</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-ink-text/60">
                    <span>File Name:</span>
                    <span className="text-ink-text font-medium truncate max-w-[140px]">{doc.fileName}</span>
                  </div>
                  <div className="flex justify-between text-ink-text/60">
                    <span>Total Pages:</span>
                    <span className="text-ink-text font-medium">{doc.totalPages}</span>
                  </div>
                  <div className="flex justify-between text-ink-text/60">
                    <span>Embedding:</span>
                    <span className="text-brass-dim font-mono">Dense vector</span>
                  </div>
                  <div className="flex justify-between text-ink-text/60">
                    <span>Retrieval:</span>
                    <span className="text-brass-dim font-mono">Cosine similarity</span>
                  </div>
                </div>
                <button
                  onClick={handleOpenOriginalFile}
                  disabled={isOpeningFile}
                  className="mt-4 w-full btn-brass px-3 py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  {isOpeningFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>Open Original File</span>
                </button>
                {fileOpenError && (
                  <p className="mt-2 text-[11px] text-red-700">{fileOpenError}</p>
                )}
              </div>

              {/* Source Chunk Preview Widget */}
              {activeSourcePreview ? (
                <div className="sheet p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="index-label text-brass-dim">
                      Citation Page {activeSourcePreview.page}
                    </span>
                    <button
                      onClick={() => setActiveSourcePreview(null)}
                      className="text-[11px] text-ink-text/50 hover:text-ink-text underline"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-3">
                    {activeSourcePreview.texts.map((text, i) => (
                      <p key={i} className="text-xs text-ink-text/80 italic leading-relaxed">
                        "{text}"
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-md border border-ink-line text-xs text-parchment-dim leading-relaxed">
                  <p className="index-label text-brass mb-1.5">Grounded RAG Pipeline</p>
                  Click on any <span className="text-brass font-mono">Page #</span> source pill inside the chat to inspect the exact retrieved context passage.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: EXECUTIVE SUMMARY ==================== */}
        {activeTab === 'summary' && (
          <div className="max-w-4xl mx-auto sheet p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/15 mb-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-text flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brass-dim" />
                  <span>Executive Document Summary</span>
                </h2>
                <p className="text-xs text-parchment-dim mt-1 font-mono">Automated synthesis of {doc.fileName}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerateSummary}
                  disabled={isGeneratingSummary}
                  className="btn-brass px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{isGeneratingSummary ? 'Synthesizing...' : 'Regenerate'}</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 text-xs font-medium rounded-sm border border-ink/20 text-ink-text/70 hover:text-ink-text hover:border-brass flex items-center gap-1.5 transition-colors"
                >
                  {copiedSummary ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                </button>
              </div>
            </div>

            <div className="max-w-none text-sm text-ink-text/90 leading-relaxed">
              {doc.summary ? (
                <Markdown>{doc.summary}</Markdown>
              ) : (
                'Summary is currently being generated...'
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: KEY POINTS ==================== */}
        {activeTab === 'keypoints' && (
          <div className="max-w-4xl mx-auto sheet p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/15 mb-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-text flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-brass-dim" />
                  <span>Extracted Key Takeaways &amp; Concepts</span>
                </h2>
                <p className="text-xs text-parchment-dim mt-1 font-mono">Core principles extracted directly from document passages</p>
              </div>

              <button
                onClick={handleExtractKeyPoints}
                disabled={isExtractingPoints}
                className="btn-brass px-3 py-1.5 text-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                {isExtractingPoints ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isExtractingPoints ? 'Extracting...' : 'Refresh Key Points'}</span>
              </button>
            </div>

            {doc.keyPoints && doc.keyPoints.length > 0 ? (
              <div className="space-y-3">
                {doc.keyPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="p-4 sheet-well flex items-start gap-3.5"
                  >
                    <div className="w-6 h-6 rounded-full bg-brass text-ink flex items-center justify-center font-mono font-semibold text-[11px] shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="text-sm text-ink-text leading-relaxed">
                      <Markdown>{point}</Markdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-ink-text/60">
                Key points are being extracted from the document.
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: REVISION QUIZ & MCQS ==================== */}
        {activeTab === 'quiz' && (
          <div className="max-w-4xl mx-auto sheet p-6 sm:p-8">
            <div className="pb-4 border-b border-ink/15 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-text flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-brass-dim" />
                  <span>Revision Quiz &amp; Practice Questions</span>
                </h2>
                <p className="text-xs text-parchment-dim mt-1 font-mono">Test your comprehension with document-based multiple-choice questions</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className="btn-brass px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  {isGeneratingQuiz ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isGeneratingQuiz ? 'Generating...' : 'New Questions'}</span>
                </button>

                <button
                  onClick={() => setSelectedQuizAnswers({})}
                  className="text-xs font-medium px-3 py-1.5 rounded-sm border border-ink/20 text-ink-text/70 hover:text-ink-text hover:border-brass flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Quiz</span>
                </button>
              </div>
            </div>

            {doc.mcqs && doc.mcqs.length > 0 ? (
              <div className="space-y-6">
                {doc.mcqs.map((q, qIndex) => {
                  const selected = selectedQuizAnswers[q.id];
                  const hasAnswered = selected !== undefined;
                  const isCorrect = selected === q.correctIndex;

                  return (
                    <div
                      key={q.id}
                      className="p-5 sheet-well"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <span className="w-6 h-6 rounded-sm bg-sage text-paper font-mono font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          Q{qIndex + 1}
                        </span>
                        <h4 className="font-display text-base font-semibold text-ink-text leading-relaxed">{q.question}</h4>
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIndex) => {
                          const isOptionSelected = selected === optIndex;
                          const isThisCorrect = optIndex === q.correctIndex;

                          let optionStyle = 'bg-paper border-ink/20 text-ink-text/80 hover:border-brass';

                          if (hasAnswered) {
                            if (isThisCorrect) {
                              optionStyle = 'bg-sage border-sage text-paper font-semibold';
                            } else if (isOptionSelected && !isThisCorrect) {
                              optionStyle = 'bg-ink-text/80 border-ink-text text-paper/70 line-through';
                            }
                          } else if (isOptionSelected) {
                            optionStyle = 'bg-brass/25 border-brass text-ink-text';
                          }

                          return (
                            <button
                              key={optIndex}
                              disabled={hasAnswered}
                              onClick={() => handleSelectQuizOption(q.id, optIndex)}
                              className={`p-3 rounded-sm border text-sm text-left transition-colors flex items-center justify-between ${optionStyle}`}
                            >
                              <span>{opt}</span>
                              {hasAnswered && isThisCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-paper shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Reveal */}
                      {hasAnswered && (
                        <div className={`mt-4 p-3 rounded-sm text-sm border ${
                          isCorrect
                            ? 'bg-sage/15 border-sage/40 text-sage'
                            : 'bg-ink/10 border-ink/20 text-ink-text/80'
                        }`}>
                          <p className="font-semibold mb-0.5">{isCorrect ? '✓ Correct Answer!' : '✗ Incorrect'}</p>
                          <div className="text-ink-text/80">
                            <Markdown>{q.explanation}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-ink-text/60">
                Generating practice questions from document chunks...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

