import { createClient } from '@supabase/supabase-js';
import React from 'react';

const cacheFn = (React as any)?.cache || ((fn: any) => fn);

export const createSupabaseAdminClient = cacheFn(() =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
);