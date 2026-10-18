import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { isDemoMode, assertDemoModeSafety } from "@/lib/demo/demoMode";

const safeCache = typeof cache === 'function' ? cache : (<T extends (...args: any[]) => any>(fn: T): T => fn);

export const createSupabaseServerClient = safeCache(async () => {
  const cookieStore = await cookies();

  if (isDemoMode()) {
    assertDemoModeSafety();
  }

  const supabaseUrl = process.env.SUPABASE_URL || (isDemoMode() ? "https://demo-mock.supabase.co" : "");
  const supabaseKey = process.env.SUPABASE_ANON_KEY || (isDemoMode() ? "demo-mock-anon-key" : "");

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cannot set cookies during Server Component render, ignore
          }
        },
      },
    }
  );
});