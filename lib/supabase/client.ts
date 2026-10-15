import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      '❌ Missing Supabase env vars in browser client'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}