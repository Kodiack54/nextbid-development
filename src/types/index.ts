// Shared types for the dev environment

export type DevServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  droplet_name: string;
  droplet_ip: string;
  server_path: string;
  server_path_test?: string;
  port_dev: number;
  port_test: number;
  port_prod: number;
  is_locked: boolean;
  table_prefix?: string;
  database_schema?: Record<string, { columns: string[]; types: Record<string, string> }>;
  lock?: {
    locked_by_name: string;
    locked_at: string;
    purpose: string;
  };
  // Dev server management
  dev_server_status?: DevServerStatus;
  dev_server_started_at?: string;
  dev_server_started_by?: string;
  dev_server_error?: string;
  pm2_process_name?: string;
  // Project metadata
  git_repo?: string;
  logo_url?: string;
  created_at?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  portKey: 'port_dev' | 'port_test' | 'port_prod';
  readOnly?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SessionSummary {
  summary: string;
  key_points: string[];
  action_items: string[];
  context_for_next_session: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  model?: string;
}

export interface Session {
  id: string;
  status: string;
  user_id: string;
  project_id?: string;
  started_at: string;
}

export type PanelType = 'files' | 'terminal' | 'ai-usage' | 'browser' | 'schema' | 'chatlog' | 'hub' | 'storage' | 'projects' | 'docs' | 'health' | null;

export const ENVIRONMENTS: Environment[] = [
  { id: 'dev', name: 'Dev Studio', portKey: 'port_dev' },
  { id: 'test', name: 'Test', portKey: 'port_test' },
  { id: 'prod', name: 'Production', portKey: 'port_prod', readOnly: true },
];
