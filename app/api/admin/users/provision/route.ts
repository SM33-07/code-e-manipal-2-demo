import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { Errors, successResponse } from '@/lib/utils/response';
import { provisionAccount, ProvisioningError } from '@/lib/admin/provisioning';
import type { UserRole } from '@/types';

export const POST = withAuth(async (req: NextRequest, { user: adminUser }) => {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid JSON request body');
    }

    const role = body?.role as UserRole;
    const name = typeof body?.name === 'string' ? body.name : '';
    const canonicalIdentifier = typeof body?.canonical_identifier === 'string'
      ? body.canonical_identifier
      : undefined;

    if (!name.trim()) return Errors.BAD_REQUEST('Name is required');
    if (!['participant', 'judge', 'admin'].includes(role)) {
      return Errors.BAD_REQUEST('Role must be participant, judge, or admin');
    }

    const account = await provisionAccount(
      { name, role, canonicalIdentifier },
      adminUser.id
    );

    const response = successResponse(
      {
        account: {
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          identifier: account.identifier,
          login_id: account.login_id,
        },
        temporary_password: account.password,
        verification: account.verification,
        notice: 'Credentials are displayed once. They are never stored or logged in plaintext.',
      },
      undefined,
      201
    );
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error) {
    if (error instanceof ProvisioningError) {
      if (error.status === 409) return Errors.CONFLICT(error.message);
      if (error.status === 400) return Errors.BAD_REQUEST(error.message);
      return Errors.INTERNAL(error.message);
    }
    return Errors.INTERNAL();
  }
}, 'admin');
