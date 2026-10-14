import { NextResponse } from 'next/server.js';
import type { ApiSuccess, ApiError } from '@/types';

export const NO_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Surrogate-Control': 'no-store',
};

// ── Success ───────────────────────────────────────────────────
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { data, ...(meta && { meta }) },
    { status, headers }
  );
}

// ── Named error shortcuts ─────────────────────────────────────
function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, ...(code && { code }), ...(details ? { details } : {}) },
    { status, headers }
  );
}

export const Errors = {
  UNAUTHORIZED:  (msg = 'Unauthorized', headers?: HeadersInit) => errorResponse(msg,          401, 'UNAUTHORIZED', undefined, headers),
  FORBIDDEN:     (msg = 'Forbidden', headers?: HeadersInit)    => errorResponse(msg,          403, 'FORBIDDEN', undefined, headers),
  NOT_FOUND:     (r = 'Resource', headers?: HeadersInit) => errorResponse(`${r} not found`,   404, 'NOT_FOUND', undefined, headers),
  BAD_REQUEST:   (msg = 'Bad request', details?: unknown, headers?: HeadersInit) => errorResponse(msg, 400, 'BAD_REQUEST', details, headers),
  CONFLICT:      (msg = 'Conflict', headers?: HeadersInit)     => errorResponse(msg,          409, 'CONFLICT', undefined, headers),
  RATE_LIMITED:  (msg = 'Too many requests. Please try again later.', headers?: HeadersInit) => errorResponse(msg, 429, 'RATE_LIMITED', undefined, headers),
  INTERNAL:      (msg = 'Internal server error', headers?: HeadersInit) => errorResponse(msg, 500, 'INTERNAL_ERROR', undefined, headers),
} as const;
