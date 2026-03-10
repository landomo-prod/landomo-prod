import { createBrowserClient } from '@supabase/ssr';

const RAW_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(RAW_SUPABASE_URL && SUPABASE_ANON_KEY);

function resolveSupabaseUrl(): string {
  // Relative paths like "/supabase" need the browser origin prepended
  if (RAW_SUPABASE_URL.startsWith('/')) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${RAW_SUPABASE_URL}`;
    }
    // SSR fallback — won't be used for auth but avoids crash
    return `http://46.225.167.44:8000`;
  }
  return RAW_SUPABASE_URL;
}

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createBrowserClient(resolveSupabaseUrl(), SUPABASE_ANON_KEY);
}
