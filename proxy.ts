import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode, sanitizeDemoRuntimeEnvironment } from '@/lib/demo/demoMode';

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const { pathname } = req.nextUrl;

  // 0. Demo Mode: Fast-bypass for demo routes and role redirection for protected routes
  if (isDemoMode()) {
    // Demo hub and interactive role demo routes fast bypass immediately
    if (pathname === '/demo' || pathname.startsWith('/demo/')) {
      return res;
    }

    // Redirect protected routes to corresponding interactive demo workspaces
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/demo/admin', req.url));
    }
    if (pathname.startsWith('/judge') || pathname.startsWith('/judging')) {
      return NextResponse.redirect(new URL('/demo/judge', req.url));
    }
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/team') ||
      pathname.startsWith('/submit') ||
      pathname.startsWith('/SubmissionForm') ||
      pathname.startsWith('/submission-result') ||
      pathname.startsWith('/account')
    ) {
      return NextResponse.redirect(new URL('/demo/participant', req.url));
    }

    // Public routes and other routes bypass Supabase session resolution in demo mode
    if (pathname !== '/login') {
      return res;
    }
  }

  // 1. Explicitly public routes (never require authentication)
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/about' ||
    pathname === '/schedule' ||
    pathname === '/problem-statements' ||
    pathname.startsWith('/problem-statements/') ||
    pathname === '/prizes' ||
    pathname === '/judges' ||
    pathname === '/sponsors' ||
    pathname === '/gallery' ||
    pathname === '/faq' ||
    pathname === '/contact' ||
    pathname === '/enter' ||
    pathname === '/results' ||
    pathname === '/guidelines' ||
    pathname === '/timeline' ||
    pathname === '/demo' ||
    pathname.startsWith('/demo/') ||
    pathname.startsWith('/project/');

  // 2. Auth routes
  const isLoginRoute = pathname === '/login';

  // 3. Protected portal routes
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/team') ||
    pathname.startsWith('/submit') ||
    pathname.startsWith('/SubmissionForm') ||
    pathname.startsWith('/submission-result') ||
    pathname.startsWith('/judge') ||
    pathname.startsWith('/judging') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/account');

  // If public route and not login, fast bypass
  if (!isProtectedRoute && !isLoginRoute) {
    return res;
  }

  // Resolve Supabase user from session cookies
  let user = null;
  let supabase: any = null;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get: (name) => req.cookies.get(name)?.value,
            set: (name, value, options: CookieOptions) => {
              req.cookies.set({ name, value, ...options });
              res.cookies.set({ name, value, ...options });
            },
            remove: (name, options: CookieOptions) => {
              req.cookies.set({ name, value: '', ...options });
              res.cookies.set({ name, value: '', ...options });
            },
          },
        }
      );

      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      user = null;
      supabase = null;
    }
  }

  // Unauthenticated user attempting to access protected route -> redirect to /login
  if (isProtectedRoute && !user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role resolution for authenticated users
  if (user && supabase) {
    // The profile table is the authoritative role source. Metadata is not used
    // for authorization decisions because it can lag behind an administrative
    // role change.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = profile?.role || 'participant';

    // Prevent authenticated users from staying on /login, unless explicitly requesting re-authentication or logout
    const hasReauthParam =
      req.nextUrl.searchParams.has('reauth') ||
      req.nextUrl.searchParams.has('logout') ||
      req.nextUrl.searchParams.has('reason') ||
      req.nextUrl.searchParams.has('error');

    if (isLoginRoute && !hasReauthParam) {
      if (role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
      if (role === 'judge') return NextResponse.redirect(new URL('/judge', req.url));
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Role-based route guard for /admin
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Role-based route guard for /judge or /judging
    if ((pathname.startsWith('/judge') || pathname.startsWith('/judging')) && !['judge', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|fonts|logo.*|images|api).*)',
  ],
};

export default proxy;
