import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    return createBrowserClient(supabaseUrl, supabaseKey);
  }

  // Secure client proxy: delegates authentication actions to server routes
  // without leaking or requiring private Supabase API keys in the browser bundle.
  return {
    auth: {
      async getUser() {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) return { data: { user: null }, error: null };
          const json = await res.json();
          return { data: { user: json.data?.user || null }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: err };
        }
      },
      async getSession() {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) return { data: { session: null }, error: null };
          const json = await res.json();
          const user = json.data?.user;
          return {
            data: { session: user ? { user, access_token: '', refresh_token: '' } : null },
            error: null,
          };
        } catch (err: any) {
          return { data: { session: null }, error: err };
        }
      },
      async setSession(tokens: { access_token: string; refresh_token: string }) {
        try {
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokens),
          });
          const json = await res.json();
          if (!res.ok) return { data: { session: null, user: null }, error: new Error(json.error || 'Failed to set session') };
          return { data: { session: json.data?.session, user: json.data?.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: err };
        }
      },
      async exchangeCodeForSession(code: string) {
        try {
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const json = await res.json();
          if (!res.ok) return { data: { session: null, user: null }, error: new Error(json.error || 'Failed to exchange code') };
          return { data: { session: json.data?.session, user: json.data?.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: err };
        }
      },
      async verifyOtp(params: { token_hash: string; type: string }) {
        try {
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          const json = await res.json();
          if (!res.ok) return { data: { session: null, user: null }, error: new Error(json.error || 'Failed to verify OTP') };
          return { data: { session: json.data?.session, user: json.data?.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: err };
        }
      },
      async updateUser(attributes: { password?: string; data?: any }) {
        try {
          const res = await fetch('/api/auth/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attributes),
          });
          const json = await res.json();
          if (!res.ok) return { data: { user: null }, error: new Error(json.error || 'Failed to update user') };
          return { data: { user: json.data?.user }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: err };
        }
      },
      async signOut() {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
          return { error: null };
        } catch (err: any) {
          return { error: err };
        }
      },
      onAuthStateChange(_callback: (event: any, session: any) => void) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },
    },
    from(_table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              try {
                const res = await fetch('/api/auth/me', { cache: 'no-store' });
                if (!res.ok) return { data: null, error: null };
                const json = await res.json();
                return { data: json.data?.profile || null, error: null };
              } catch {
                return { data: null, error: null };
              }
            },
          }),
        }),
      };
    },
  } as any;
}