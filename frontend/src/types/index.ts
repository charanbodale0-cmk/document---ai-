/* DocuMind AI — TypeScript Types */

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  num_pages: number;
  num_chunks: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  processing_error: string | null;
  text_length: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface SourceCitation {
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_id: string;
  text: string;
  relevance_score: number;
}

export interface ChatRequest {
  question: string;
  document_id?: string;
  conversation_id?: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  conversation_id: string;
  message_id: string;
  model_used: string | null;
  token_usage: number | null;
  is_demo: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: string | null;
  token_usage: number | null;
  model_used: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  document_name: string | null;
}

export interface ConversationDetail {
  id: string;
  title: string;
  document_id: string | null;
  document_name: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_documents: number;
  processed_documents: number;
  total_conversations: number;
  total_messages: number;
  total_questions: number;
  storage_used_bytes: number;
  recent_documents: Document[];
  recent_conversations: Conversation[];
  processing_success_rate: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  api_key_configured: boolean;
  demo_mode: boolean;
  embedding_model: string;
  claude_model: string;
}

export interface SummaryResponse {
  summary: string;
  document_id: string;
  document_name: string;
  summary_type: string;
  sources: SourceCitation[];
  is_demo: boolean;
}

export interface CompareResponse {
  comparison: string;
  document_names: string[];
  sources: SourceCitation[];
  is_demo: boolean;
}

export interface StudyResponse {
  questions: string;
  document_id: string;
  document_name: string;
  is_demo: boolean;
}

export interface ExtractionResponse {
  extracted_data: string;
  document_id: string;
  document_name: string;
  is_demo: boolean;
}
