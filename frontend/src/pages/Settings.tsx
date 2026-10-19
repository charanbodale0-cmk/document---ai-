import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Brain, Database, Server, Shield, Info } from 'lucide-react';
import { getHealth } from '../services/api';
import type { HealthResponse } from '../types';

export default function Settings() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-navy-800)] flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" /> Settings
        </h2>
        <p className="text-sm text-gray-500 mt-1">Application configuration and system information</p>
      </div>

      {/* System Status */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-indigo-500" /> System Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">Backend Status</span>
            <span className={`status-badge ${health ? 'status-completed' : 'status-failed'}`}>
              {health ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">Version</span>
            <span className="font-medium">{health?.version || '-'}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">API Key</span>
            <span className={`status-badge ${health?.api_key_configured ? 'status-completed' : 'status-failed'}`}>
              {health?.api_key_configured ? 'Configured' : 'Not Set'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">Mode</span>
            <span className={`status-badge ${health?.demo_mode ? 'status-pending' : 'status-completed'}`}>
              {health?.demo_mode ? 'Demo Mode' : 'Production'}
            </span>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-violet-500" /> AI Configuration
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">Claude Model</span>
            <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
              {health?.claude_model || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-500">Embedding Model</span>
            <span className="font-mono text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-lg">
              {health?.embedding_model || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* API Key Setup */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-amber-500" /> API Key Configuration
        </h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="mb-2">
            <strong>Important:</strong> For security, the API key must be set via the server environment, not through the browser.
          </p>
          <ol className="list-decimal ml-5 space-y-1 text-xs">
            <li>Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to <code className="bg-amber-100 px-1 rounded">.env</code> in the backend directory</li>
            <li>Set <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY=your_key_here</code></li>
            <li>Restart the backend server</li>
          </ol>
        </div>
      </div>

      {/* Security */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-500" /> Security & Privacy
        </h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>• All documents are stored locally on your machine</p>
          <p>• API keys are never sent to the browser</p>
          <p>• Document content is only sent to Claude API when you ask questions</p>
          <p>• This is a single-user local application — no authentication is enforced</p>
          <p>• For production deployment, add authentication and HTTPS</p>
        </div>
      </div>

      {/* About */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-sky-500" /> About DocuMind AI
        </h3>
        <p className="text-sm text-gray-600">
          DocuMind AI is an AI-powered document intelligence and research assistant.
          Upload PDF documents, ask questions, get cited answers, generate summaries,
          compare documents, and more — all powered by Retrieval-Augmented Generation (RAG)
          with Anthropic Claude.
        </p>
        <p className="text-xs text-gray-400 mt-3">
          Built with React, TypeScript, FastAPI, SQLAlchemy, PyMuPDF, Sentence Transformers, FAISS, and Claude API.
        </p>
      </div>
    </div>
  );
}
