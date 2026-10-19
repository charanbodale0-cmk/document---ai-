import { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, FileText, Trash2, MessageSquare,
  Loader2, Copy, Check, ChevronDown, AlertCircle,
  BookOpen, Sparkles, Lightbulb, ClipboardList, Search as SearchIcon,
  Edit3, X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  getDocuments, getConversations, getConversation,
  sendChatMessage, deleteConversation, renameConversation,
} from '../services/api';
import type { Document, Conversation, ConversationDetail, SourceCitation, Message } from '../types';

const suggestedPrompts = [
  'Summarize this document',
  'What are the main concepts?',
  'List the key findings',
  'Explain the conclusions',
  'What are the important definitions?',
  'Find information about the methodology',
];

export default function Chat() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; sources?: SourceCitation[] }>>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [showSources, setShowSources] = useState<string | null>(null);
  const [convId, setConvId] = useState<string>('');
  const [editTitle, setEditTitle] = useState('');
  const [editingConvId, setEditingConvId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocuments({ status: 'completed', limit: 100 }).then(r => setDocs(r.documents)).catch(() => {});
    loadConversations();
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = () => {
    getConversations().then(setConversations).catch(() => {});
  };

  const openConversation = async (id: string) => {
    try {
      const detail = await getConversation(id);
      setActiveConv(detail);
      setConvId(id);
      if (detail.document_id) setSelectedDocId(detail.document_id);
      setMessages(detail.messages.map(m => ({
        role: m.role,
        content: m.content,
        sources: m.sources ? JSON.parse(m.sources) : undefined,
      })));
    } catch {}
  };

  const newConversation = () => {
    setActiveConv(null);
    setConvId('');
    setMessages([]);
    setError('');
  };

  const handleSend = async (text?: string) => {
    const q = text || question.trim();
    if (!q || loading) return;

    setQuestion('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await sendChatMessage({
        question: q,
        document_id: selectedDocId || undefined,
        conversation_id: convId || undefined,
      });

      setConvId(res.conversation_id);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
      }]);
      loadConversations();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to get response. Check backend connection.';
      setError(detail);
      setMessages(prev => prev.slice(0, -1)); // remove the user msg on failure
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleDeleteConv = async (id: string) => {
    try {
      await deleteConversation(id);
      if (convId === id) newConversation();
      loadConversations();
    } catch {}
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await renameConversation(id, editTitle.trim());
      setEditingConvId('');
      loadConversations();
    } catch {}
  };

  const selectedDoc = docs.find(d => d.id === selectedDocId);

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 animate-fade-in">
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0 flex flex-col glass-card overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <button className="btn-primary w-full text-sm justify-center" onClick={newConversation}>
              <Plus className="w-4 h-4" /> New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No conversations yet</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${convId === conv.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  onClick={() => openConversation(conv.id)}
                >
                  {editingConvId === conv.id ? (
                    <input
                      className="input-field text-xs py-1"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRename(conv.id)}
                      onBlur={() => setEditingConvId('')}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{conv.title}</p>
                        <p className="text-[10px] text-gray-400">{conv.message_count} msgs{conv.document_name ? ` · ${conv.document_name}` : ''}</p>
                      </div>
                      <div className="hidden group-hover:flex gap-1">
                        <button className="p-1 hover:bg-gray-200 rounded" onClick={e => { e.stopPropagation(); setEditingConvId(conv.id); setEditTitle(conv.title); }}>
                          <Edit3 className="w-3 h-3 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-red-100 rounded" onClick={e => { e.stopPropagation(); handleDeleteConv(conv.id); }}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document selector */}
        <div className="glass-card p-3 mb-3 flex items-center gap-3 flex-wrap">
          <button
            className="lg:hidden btn-secondary text-xs py-1.5"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={selectedDocId}
            onChange={e => setSelectedDocId(e.target.value)}
            className="input-field text-sm py-1.5 flex-1 max-w-sm"
          >
            <option value="">Select a document (optional)</option>
            {docs.map(d => (
              <option key={d.id} value={d.id}>{d.original_filename} ({d.num_pages} pages)</option>
            ))}
          </select>
          {selectedDoc && (
            <span className="text-xs text-gray-400">{selectedDoc.num_chunks} chunks indexed</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[var(--color-navy-800)] mb-2">Ask DocuMind AI</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                {selectedDoc
                  ? `Ask any question about "${selectedDoc.original_filename}"`
                  : 'Select a document above, then ask questions about its content'}
              </p>

              {selectedDoc && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {suggestedPrompts.map(prompt => (
                    <button
                      key={prompt}
                      className="btn-secondary text-xs text-left py-2.5"
                      onClick={() => handleSend(prompt)}
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                {msg.role === 'assistant' ? (
                  <>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                      <button
                        className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        onClick={() => handleCopy(msg.content, `msg-${i}`)}
                      >
                        {copied === `msg-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === `msg-${i}` ? 'Copied' : 'Copy'}
                      </button>
                      {msg.sources && msg.sources.length > 0 && (
                        <button
                          className="text-[11px] text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                          onClick={() => setShowSources(showSources === `msg-${i}` ? null : `msg-${i}`)}
                        >
                          <BookOpen className="w-3 h-3" />
                          {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                    {showSources === `msg-${i}` && msg.sources && (
                      <div className="mt-2 space-y-2 animate-fade-in">
                        {msg.sources.map((src, si) => (
                          <div key={si} className="bg-indigo-50/60 rounded-lg p-3 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-3 h-3 text-indigo-500" />
                              <span className="font-medium text-indigo-700">{src.document_name}</span>
                              <span className="text-indigo-400">Page {src.page_number}</span>
                              <span className="text-gray-400">({(src.relevance_score * 100).toFixed(0)}% match)</span>
                            </div>
                            <p className="text-gray-600 leading-relaxed">{src.text.substring(0, 300)}{src.text.length > 300 ? '...' : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="chat-bubble-assistant">
                <div className="flex items-center gap-2">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  <span className="text-xs text-gray-400 ml-2">Analyzing documents...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mx-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div className="glass-card p-3">
          <div className="flex gap-2">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={selectedDoc ? 'Ask about your document...' : 'Select a document first...'}
              className="input-field resize-none text-sm min-h-[44px] max-h-32"
              rows={1}
            />
            <button
              className="btn-primary px-4 flex-shrink-0"
              onClick={() => handleSend()}
              disabled={loading || !question.trim()}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
