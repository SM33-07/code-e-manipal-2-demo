-- ============================================================================
-- Code-e-Manipal 2.0 — Safe Demo Identifier Archival Migration
-- File: scripts/archive-demo-identifiers.sql
--
-- Safely reassigns verified demo identifiers to DEMO-TEAM-XXX so legitimate
-- team leaders can receive their canonical identifiers.
--
-- Safeguards:
--  - Checks exact expected before-state before updating.
--  - Does NOT delete any profiles or teams.
--  - Preserves team 'Hi 2' foreign key relationships for participant@learnit-muj.com.
--  - Audit logs record each action using the valid target user's UUID.
-- ============================================================================

BEGIN;

-- 1. Archive TEAM-001 (Template test account; preserves team 'Hi 2')
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-001', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = '4e41c7c9-a875-4319-b78d-36fa9638248d'
    AND email = 'participant@learnit-muj.com'
    AND identifier = 'TEAM-001'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for participant@learnit-muj.com (UUID 4e41c7c9-a875-4319-b78d-36fa9638248d), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  '4e41c7c9-a875-4319-b78d-36fa9638248d',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  '4e41c7c9-a875-4319-b78d-36fa9638248d',
  json_build_object('previous_identifier', 'TEAM-001', 'new_identifier', 'DEMO-TEAM-001', 'email', 'participant@learnit-muj.com', 'previous_disabled', false)
);

-- 2. Archive TEAM-002 (Early disabled test account)
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-002', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = '0c5446bf-4a0e-48c2-a03c-995cfb686cf6'
    AND email = 'yashsrivastava3345@gmail.com'
    AND identifier = 'TEAM-002'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for yashsrivastava3345@gmail.com (UUID 0c5446bf-4a0e-48c2-a03c-995cfb686cf6), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  '0c5446bf-4a0e-48c2-a03c-995cfb686cf6',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  '0c5446bf-4a0e-48c2-a03c-995cfb686cf6',
  json_build_object('previous_identifier', 'TEAM-002', 'new_identifier', 'DEMO-TEAM-002', 'email', 'yashsrivastava3345@gmail.com', 'previous_disabled', true)
);

-- 3. Archive TEAM-003 (Early disabled test account)
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-003', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = '210a4521-2ee4-4d7f-87dc-4372b8aea182'
    AND email = 'yashsrivastava345@gmail.com'
    AND identifier = 'TEAM-003'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for yashsrivastava345@gmail.com (UUID 210a4521-2ee4-4d7f-87dc-4372b8aea182), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  '210a4521-2ee4-4d7f-87dc-4372b8aea182',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  '210a4521-2ee4-4d7f-87dc-4372b8aea182',
  json_build_object('previous_identifier', 'TEAM-003', 'new_identifier', 'DEMO-TEAM-003', 'email', 'yashsrivastava345@gmail.com', 'previous_disabled', true)
);

-- 4. Archive TEAM-007 (Firefox Relay burner address: 'test acc')
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-007', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = '6daf8d15-d62e-4ed0-b13c-896fed110a06'
    AND email = 'afy6wqzv8@mozmail.com'
    AND identifier = 'TEAM-007'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for afy6wqzv8@mozmail.com (UUID 6daf8d15-d62e-4ed0-b13c-896fed110a06), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  '6daf8d15-d62e-4ed0-b13c-896fed110a06',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  '6daf8d15-d62e-4ed0-b13c-896fed110a06',
  json_build_object('previous_identifier', 'TEAM-007', 'new_identifier', 'DEMO-TEAM-007', 'email', 'afy6wqzv8@mozmail.com', 'previous_disabled', true)
);

-- 5. Archive TEAM-009 (Dummy test account: 'xyyx')
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-009', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = '12825ab1-73cf-4c91-91d3-5db99555329f'
    AND email = 'jsja@gmail.com'
    AND identifier = 'TEAM-009'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for jsja@gmail.com (UUID 12825ab1-73cf-4c91-91d3-5db99555329f), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  '12825ab1-73cf-4c91-91d3-5db99555329f',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  '12825ab1-73cf-4c91-91d3-5db99555329f',
  json_build_object('previous_identifier', 'TEAM-009', 'new_identifier', 'DEMO-TEAM-009', 'email', 'jsja@gmail.com', 'previous_disabled', true)
);

-- 6. Archive TEAM-010 (Dummy test account: 'Test')
DO $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.profiles
  SET identifier = 'DEMO-TEAM-010', login_id = NULL, is_disabled = true, updated_at = NOW()
  WHERE id = 'f8088113-e0a7-46ae-bd27-764ca6c39334'
    AND email = 'test@gmail.com'
    AND identifier = 'TEAM-010'
    AND role = 'participant';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Aborted: Expected exactly 1 row for test@gmail.com (UUID f8088113-e0a7-46ae-bd27-764ca6c39334), got %', v_rows;
  END IF;
END $$;

INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
VALUES (
  'f8088113-e0a7-46ae-bd27-764ca6c39334',
  'DEMO_IDENTIFIER_ARCHIVED',
  'profiles',
  'f8088113-e0a7-46ae-bd27-764ca6c39334',
  json_build_object('previous_identifier', 'TEAM-010', 'new_identifier', 'DEMO-TEAM-010', 'email', 'test@gmail.com', 'previous_disabled', true)
);

COMMIT;
