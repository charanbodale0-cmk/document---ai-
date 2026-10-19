/* DocuMind AI — API Service Layer */

import axios from 'axios';
import type {
  Document, DocumentListResponse, ChatRequest, ChatResponse,
  Conversation, ConversationDetail, DashboardStats, HealthResponse,
  SummaryResponse, CompareResponse, StudyResponse, ExtractionResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for AI responses
  headers: { 'Content-Type': 'application/json' },
});

// ── Health ─────────────────────────────────────────────────────

export const getHealth = () =>
  api.get<HealthResponse>('/health').then(r => r.data);

// ── Dashboard ──────────────────────────────────────────────────

export const getDashboardStats = () =>
  api.get<DashboardStats>('/dashboard/stats').then(r => r.data);

// ── Documents ──────────────────────────────────────────────────

export const uploadDocument = (file: File, onProgress?: (pct: number) => void) =>
  api.post<Document>('/documents/upload', (() => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
  })(), {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  }).then(r => r.data);

export const getDocuments = (params?: {
  skip?: number; limit?: number; search?: string; status?: string;
  sort_by?: string; sort_order?: string;
}) => api.get<DocumentListResponse>('/documents', { params }).then(r => r.data);

export const getDocument = (id: string) =>
  api.get<Document>(`/documents/${id}`).then(r => r.data);

export const deleteDocument = (id: string) =>
  api.delete(`/documents/${id}`).then(r => r.data);

export const retryDocument = (id: string) =>
  api.post<Document>(`/documents/${id}/retry`).then(r => r.data);

// ── Chat ───────────────────────────────────────────────────────

export const sendChatMessage = (req: ChatRequest) =>
  api.post<ChatResponse>('/chat', req).then(r => r.data);

// ── Conversations ──────────────────────────────────────────────

export const getConversations = () =>
  api.get<Conversation[]>('/conversations').then(r => r.data);

export const getConversation = (id: string) =>
  api.get<ConversationDetail>(`/conversations/${id}`).then(r => r.data);

export const renameConversation = (id: string, title: string) =>
  api.put(`/conversations/${id}`, { title }).then(r => r.data);

export const deleteConversation = (id: string) =>
  api.delete(`/conversations/${id}`).then(r => r.data);

// ── AI Features ────────────────────────────────────────────────

export const summarizeDocument = (docId: string, summaryType: string = 'short') =>
  api.post<SummaryResponse>(`/documents/${docId}/summary`, { summary_type: summaryType }).then(r => r.data);

export const compareDocuments = (docIds: string[]) =>
  api.post<CompareResponse>('/documents/compare', { document_ids: docIds }).then(r => r.data);

export const generateStudyQuestions = (docId: string, questionType: string = 'mixed', numQuestions: number = 5) =>
  api.post<StudyResponse>(`/documents/${docId}/study-questions`, {
    question_type: questionType, num_questions: numQuestions,
  }).then(r => r.data);

export const extractInformation = (docId: string, extractionType: string = 'all') =>
  api.post<ExtractionResponse>(`/documents/${docId}/extract`, {
    extraction_type: extractionType,
  }).then(r => r.data);

export default api;
