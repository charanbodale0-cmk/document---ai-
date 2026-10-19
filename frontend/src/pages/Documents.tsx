import { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileText, Trash2, RefreshCw, Search,
  ChevronDown, AlertCircle, CheckCircle2, Clock,
  Loader2, X, Eye, Sparkles, BookOpen, ListFilter,
} from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, retryDocument } from '../services/api';
import type { Document } from '../types';

function formatBytes(b: number) {
  if (b === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusIcon = (s: string) => {
  switch (s) {
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'partial': return <AlertCircle className="w-4 h-4 text-amber-500" />;
    default: return <Clock className="w-4 h-4 text-amber-500" />;
  }
};

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getDocuments({ search, status: statusFilter, limit: 50 })
      .then(r => { setDocs(r.documents); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    setUploadPct(0);

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError(`"${file.name}" is not a PDF file.`);
        continue;
      }
      try {
        await uploadDocument(file, pct => setUploadPct(pct));
      } catch (err: any) {
        setUploadError(err.response?.data?.detail || `Failed to upload "${file.name}"`);
      }
    }
    setUploading(false);
    setUploadPct(0);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document and all its data?')) return;
    try {
      await deleteDocument(id);
      load();
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch {}
  };

  const handleRetry = async (id: string) => {
    try {
      await retryDocument(id);
      load();
    } catch {}
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = () => setDragActive(false);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Upload zone */}
      <div
        className={`drop-zone ${dragActive ? 'active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-indigo-500 mx-auto animate-spin" />
            <p className="text-sm text-gray-600">Uploading & processing... {uploadPct}%</p>
            <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">
              Drag & drop PDF files here, or <span className="text-indigo-600">click to browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF files up to 50 MB</p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {uploadError}
          <button onClick={() => setUploadError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input-field w-auto text-sm py-2"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <p className="text-sm text-gray-500">{total} document{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex gap-1"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
        </div>
      ) : docs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-600">No documents found</h3>
          <p className="text-sm text-gray-400 mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div
              key={doc.id}
              className={`glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer transition-all ${selectedDoc?.id === doc.id ? 'ring-2 ring-indigo-300' : ''}`}
              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{doc.original_filename}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatBytes(doc.file_size)}</span>
                    <span className="text-xs text-gray-400">{doc.num_pages} pages</span>
                    <span className="text-xs text-gray-400">{doc.num_chunks} chunks</span>
                    <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`status-badge status-${doc.processing_status}`}>
                  {statusIcon(doc.processing_status)}
                  {doc.processing_status}
                </span>

                {(doc.processing_status === 'failed' || doc.processing_status === 'partial') && (
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={e => { e.stopPropagation(); handleRetry(doc.id); }}>
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                )}

                <button className="btn-danger text-xs py-1.5 px-3" onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected document detail */}
      {selectedDoc && (
        <div className="glass-card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{selectedDoc.original_filename}</h3>
            <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {selectedDoc.processing_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
              <strong>Error:</strong> {selectedDoc.processing_error}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-400">Size</span><p className="font-medium">{formatBytes(selectedDoc.file_size)}</p></div>
            <div><span className="text-gray-400">Pages</span><p className="font-medium">{selectedDoc.num_pages}</p></div>
            <div><span className="text-gray-400">Chunks</span><p className="font-medium">{selectedDoc.num_chunks}</p></div>
            <div><span className="text-gray-400">Characters</span><p className="font-medium">{selectedDoc.text_length.toLocaleString()}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
