-- ============================================================
-- SECRET DATABASE EDITING UTILITIES
-- Run in: Supabase SQL Editor or direct Azure Postgres connection
-- ============================================================

-- 1. Override judge review scores directly
CREATE OR REPLACE FUNCTION public.secret_override_score(
  p_submission_id UUID,
  p_judge_id UUID,
  p_innovation INT,
  p_technical INT,
  p_presentation INT,
  p_impact INT,
  p_feedback TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.judge_reviews (
    submission_id, judge_id, score_innovation, score_technical, score_presentation, score_impact, feedback, is_complete
  ) VALUES (
    p_submission_id, p_judge_id, p_innovation, p_technical, p_presentation, p_impact, p_feedback, true
  )
  ON CONFLICT (submission_id, judge_id) DO UPDATE SET
    score_innovation   = EXCLUDED.score_innovation,
    score_technical    = EXCLUDED.score_technical,
    score_presentation = EXCLUDED.score_presentation,
    score_impact       = EXCLUDED.score_impact,
    feedback           = EXCLUDED.feedback,
    is_complete        = true,
    updated_at         = NOW();
END;
$$;

-- 2. Alter timestamps on any table (bypasses updated_at triggers)
CREATE OR REPLACE FUNCTION public.secret_edit_timestamp(
  p_table_name TEXT,
  p_row_id UUID,
  p_column_name TEXT,
  p_new_timestamp TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format(
    'ALTER TABLE public.%I DISABLE TRIGGER ALL; '
    'UPDATE public.%I SET %I = %L WHERE id = %L; '
    'ALTER TABLE public.%I ENABLE TRIGGER ALL;',
    p_table_name, p_table_name, p_column_name, p_new_timestamp, p_row_id, p_table_name
  );
END;
$$;

-- 3. Delete any row secretly
CREATE OR REPLACE FUNCTION public.secret_delete_row(
  p_table_name TEXT,
  p_row_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format('DELETE FROM public.%I WHERE id = %L', p_table_name, p_row_id);
END;
$$;
