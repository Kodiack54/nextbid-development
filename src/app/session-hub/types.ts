export interface WorkerStatus {
  isRunning: boolean;
  queue: number;
  processed: number;
  lastActivity: string | null;
  error: string | null;
}

export interface Session {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  message_count?: number;
  source_type?: string;
  source_name?: string;
  project_path?: string;
  processed_by_chad?: boolean;
  processed_by_jen?: boolean;
  processed_by_susan?: boolean;
}

export interface BucketData {
  bugs: number;
  features: number;
  todos: number;
  errors: number;
  knowledge: number;
  decisions: number;
  total: number;
}
