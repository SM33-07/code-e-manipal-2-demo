-- ============================================================================
-- Code-e-Manipal 2.0 — Rollback Demo Identifier Archival Migration
-- File: scripts/rollback-demo-identifiers.sql
--
-- Reverts the identifiers changed by archive-demo-identifiers.sql back to their
-- exact original states prior to archival.
--
-- CAUTION: Do NOT execute this rollback if real team leaders have already been
-- provisioned and claimed these identifiers.
-- ============================================================================

BEGIN;

-- 1. Restore TEAM-001 (participant@learnit-muj.com was originally is_disabled = false)
UPDATE public.profiles
SET identifier = 'TEAM-001', login_id = NULL, is_disabled = false, updated_at = NOW()
WHERE id = '4e41c7c9-a875-4319-b78d-36fa9638248d' AND identifier = 'DEMO-TEAM-001';

-- 2. Restore TEAM-002 (yashsrivastava3345@gmail.com was originally is_disabled = true)
UPDATE public.profiles
SET identifier = 'TEAM-002', login_id = NULL, is_disabled = true, updated_at = NOW()
WHERE id = '0c5446bf-4a0e-48c2-a03c-995cfb686cf6' AND identifier = 'DEMO-TEAM-002';

-- 3. Restore TEAM-003 (yashsrivastava345@gmail.com was originally is_disabled = true)
UPDATE public.profiles
SET identifier = 'TEAM-003', login_id = NULL, is_disabled = true, updated_at = NOW()
WHERE id = '210a4521-2ee4-4d7f-87dc-4372b8aea182' AND identifier = 'DEMO-TEAM-003';

-- 4. Restore TEAM-007 (afy6wqzv8@mozmail.com was originally is_disabled = true)
UPDATE public.profiles
SET identifier = 'TEAM-007', login_id = NULL, is_disabled = true, updated_at = NOW()
WHERE id = '6daf8d15-d62e-4ed0-b13c-896fed110a06' AND identifier = 'DEMO-TEAM-007';

-- 5. Restore TEAM-009 (jsja@gmail.com was originally is_disabled = true)
UPDATE public.profiles
SET identifier = 'TEAM-009', login_id = NULL, is_disabled = true, updated_at = NOW()
WHERE id = '12825ab1-73cf-4c91-91d3-5db99555329f' AND identifier = 'DEMO-TEAM-009';

-- 6. Restore TEAM-010 (test@gmail.com was originally is_disabled = true)
UPDATE public.profiles
SET identifier = 'TEAM-010', login_id = NULL, is_disabled = true, updated_at = NOW()
WHERE id = 'f8088113-e0a7-46ae-bd27-764ca6c39334' AND identifier = 'DEMO-TEAM-010';

-- Audit rollback for each affected profile using their valid profile UUID
INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
SELECT id, 'DEMO_IDENTIFIER_ARCHIVAL_ROLLED_BACK', 'profiles', id::text,
       json_build_object('restored_identifier', identifier, 'email', email)
FROM public.profiles
WHERE id IN (
  '4e41c7c9-a875-4319-b78d-36fa9638248d',
  '0c5446bf-4a0e-48c2-a03c-995cfb686cf6',
  '210a4521-2ee4-4d7f-87dc-4372b8aea182',
  '6daf8d15-d62e-4ed0-b13c-896fed110a06',
  '12825ab1-73cf-4c91-91d3-5db99555329f',
  'f8088113-e0a7-46ae-bd27-764ca6c39334'
);

COMMIT;
