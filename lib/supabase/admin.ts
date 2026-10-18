import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { isDemoMode, assertDemoModeSafety } from '@/lib/demo/demoMode';

const cacheFn = (React as any)?.cache || ((fn: any) => fn);

export const createSupabaseAdminClient = cacheFn(() => {
  if (isDemoMode()) {
    assertDemoModeSafety();
  }

  const url = process.env.SUPABASE_URL || (isDemoMode() ? 'https://demo-mock.supabase.co' : '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || (isDemoMode() ? 'demo-mock-service-role-key' : '');

  return createClient(
    url,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
});