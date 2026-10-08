import { NextResponse } from 'next/server';
import type { ApiSuccess, ApiError } from '@/types';

// ── Success ───────────────────────────────────────────────────
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { data, ...(meta && { meta }) },
    { status }
  );
}

// ── Named error shortcuts ─────────────────────────────────────
function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, ...(code && { code }), ...(details ? { details } : {}) },
    { status }
  );
}

export const Errors = {
  UNAUTHORIZED:  (msg = 'Unauthorized') => errorResponse(msg,          401, 'UNAUTHORIZED'),
  FORBIDDEN:     (msg = 'Forbidden')    => errorResponse(msg,          403, 'FORBIDDEN'),
  NOT_FOUND:     (r = 'Resource') => errorResponse(`${r} not found`,   404, 'NOT_FOUND'),
  BAD_REQUEST:   (msg = 'Bad request', details?: unknown) => errorResponse(msg, 400, 'BAD_REQUEST', details),
  CONFLICT:      (msg = 'Conflict')     => errorResponse(msg,          409, 'CONFLICT'),
  RATE_LIMITED:  (msg = 'Too many requests. Please try again later.') => errorResponse(msg, 429, 'RATE_LIMITED'),
  INTERNAL:      (msg = 'Internal server error') => errorResponse(msg, 500, 'INTERNAL_ERROR'),
} as const;
