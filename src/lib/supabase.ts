/**
 * Supabase Client
 *
 * Used for:
 * - Staff authentication
 * - Time tracking
 * - Tickets
 * - Task management
 * - Audit logs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if we have valid credentials
let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Export a client that gracefully handles missing env vars
export const supabase = supabaseClient || {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => ({ data: null, error: { message: 'Supabase not configured' } }),
    insert: () => ({ data: null, error: { message: 'Supabase not configured' } }),
    update: () => ({ data: null, error: { message: 'Supabase not configured' } }),
    delete: () => ({ data: null, error: { message: 'Supabase not configured' } }),
    eq: () => ({ data: null, error: { message: 'Supabase not configured' } }),
  }),
} as unknown as SupabaseClient;

// Server-side client with service key (for API routes)
export function createServerClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('Supabase service key not configured');
    return null;
  }
  return createClient(supabaseUrl, serviceKey);
}
