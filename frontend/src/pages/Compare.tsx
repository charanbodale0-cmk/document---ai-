import { useState, useEffect } from 'react';
import { GitCompare, FileText, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getDocuments, compareDocuments } from '../services/api';
import type { Document, SourceCitation } from '../types';

export default function Compare() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState('');
  const [sources, setSources] = useState<SourceCitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    getDocuments({ status: 'completed', limit: 100 }).then(r => setDocs(r.documents)).catch(() => {});
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else if (next.size < 5) next.add(id);
    setSelected(next);
  };

  const handleCompare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await compareDocuments(Array.from(selected));
      setResult(res.comparison);
      setSources(res.sources);
      setIsDemo(res.is_demo);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-navy-800)] flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-indigo-600" /> Document Comparison
        </h2>
        <p className="text-sm text-gray-500 mt-1">Select 2-5 processed documents to compare</p>
      </div>

      {/* Document selector */}
      <div className="glass-card p-4">
        {docs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No processed documents available. Upload and process a PDF first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <label
                key={doc.id}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selected.has(doc.id) ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                  className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
                />
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium flex-1">{doc.original_filename}</span>
                <span className="text-xs text-gray-400">{doc.num_pages} pages · {doc.num_chunks} chunks</span>
              </label>
            ))}
          </div>
        )}

        <button
          className="btn-primary mt-4"
          disabled={selected.size < 2 || loading}
          onClick={handleCompare}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          Compare {selected.size} Document{selected.size !== 1 ? 's' : ''}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className="glass-card p-6 animate-fade-in">
          {isDemo && <div className="demo-banner rounded-lg mb-4 text-xs">Demo Mode — comparison is simulated</div>}
          <div className="chat-bubble-assistant border-0 shadow-none max-w-none p-0">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Sources
              </h4>
              <div className="space-y-2">
                {sources.slice(0, 6).map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-xs">
                    <span className="font-medium text-indigo-600">{s.document_name}</span>
                    <span className="text-gray-400 ml-2">Page {s.page_number}</span>
                    <p className="text-gray-500 mt-1 line-clamp-2">{s.text.substring(0, 200)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
