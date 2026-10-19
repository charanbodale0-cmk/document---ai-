import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, MessageSquare, Upload, BarChart3,
  CheckCircle2, Clock, AlertCircle, HardDrive,
  ArrowRight, Sparkles, BookOpen, Zap,
} from 'lucide-react';
import { getDashboardStats, getHealth } from '../services/api';
import type { DashboardStats, HealthResponse } from '../types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getDashboardStats().catch(() => null),
      getHealth().catch(() => null),
    ]).then(([s, h]) => {
      if (s) setStats(s);
      if (h) setHealth(h);
      if (!s && !h) setError('Could not connect to backend. Is the server running on port 8000?');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1">
          <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center animate-fade-in">
        <div className="glass-card p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Documents', value: stats?.total_documents ?? 0, icon: FileText, color: 'from-indigo-500 to-violet-500' },
    { label: 'Processed', value: stats?.processed_documents ?? 0, icon: CheckCircle2, color: 'from-emerald-500 to-teal-500' },
    { label: 'Questions Asked', value: stats?.total_questions ?? 0, icon: MessageSquare, color: 'from-amber-500 to-orange-500' },
    { label: 'Storage Used', value: formatBytes(stats?.storage_used_bytes ?? 0), icon: HardDrive, color: 'from-sky-500 to-blue-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Demo mode banner */}
      {health?.demo_mode && (
        <div className="demo-banner rounded-xl">
          ⚡ Running in <strong>Demo Mode</strong> — Configure your Anthropic API key in <code>.env</code> for full AI features.
        </div>
      )}

      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-navy-800)]">
            Welcome to <span className="gradient-text">DocuMind AI</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your AI-powered document intelligence assistant</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => navigate('/documents')}>
            <Upload className="w-4 h-4" /> Upload Document
          </button>
          <button className="btn-secondary" onClick={() => navigate('/chat')}>
            <Sparkles className="w-4 h-4" /> Start Chat
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{label}</span>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                <Icon className="w-[18px] h-[18px] text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-navy-800)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions + Getting started */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick actions */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Upload PDF', desc: 'Add documents', icon: Upload, path: '/documents', color: 'bg-indigo-50 text-indigo-600' },
              { label: 'Ask AI', desc: 'Chat with docs', icon: MessageSquare, path: '/chat', color: 'bg-violet-50 text-violet-600' },
              { label: 'Compare', desc: 'Analyze differences', icon: BookOpen, path: '/compare', color: 'bg-emerald-50 text-emerald-600' },
            ].map(({ label, desc, icon: Icon, path, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="glass-card p-4 text-left hover:scale-[1.02] transition-transform cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-sm text-[var(--color-navy-800)]">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Getting started checklist */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Getting Started</h3>
          <div className="glass-card p-4 space-y-3">
            {[
              { text: 'Backend connected', done: !!health },
              { text: 'API key configured', done: health?.api_key_configured ?? false },
              { text: 'Upload first document', done: (stats?.total_documents ?? 0) > 0 },
              { text: 'Ask your first question', done: (stats?.total_questions ?? 0) > 0 },
            ].map(({ text, done }) => (
              <div key={text} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${done ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3 h-3 text-gray-400" />}
                </div>
                <span className={`text-sm ${done ? 'text-gray-700 line-through' : 'text-gray-600'}`}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent documents & conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Documents</h3>
            <button onClick={() => navigate('/documents')} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="glass-card divide-y divide-gray-50">
            {stats?.recent_documents && stats.recent_documents.length > 0 ? (
              stats.recent_documents.map(doc => (
                <div key={doc.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.original_filename}</p>
                      <p className="text-xs text-gray-400">{formatBytes(doc.file_size)} · {doc.num_pages} pages</p>
                    </div>
                  </div>
                  <span className={`status-badge status-${doc.processing_status}`}>
                    {doc.processing_status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No documents yet</p>
                <button className="btn-primary mt-3 text-xs" onClick={() => navigate('/documents')}>
                  Upload your first PDF
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Conversations</h3>
            <button onClick={() => navigate('/chat')} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="glass-card divide-y divide-gray-50">
            {stats?.recent_conversations && stats.recent_conversations.length > 0 ? (
              stats.recent_conversations.map(conv => (
                <div key={conv.id} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => navigate('/chat')}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-gray-400">{conv.message_count} messages · {timeAgo(conv.updated_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No conversations yet</p>
                <button className="btn-secondary mt-3 text-xs" onClick={() => navigate('/chat')}>
                  <Zap className="w-3.5 h-3.5" /> Start a conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
