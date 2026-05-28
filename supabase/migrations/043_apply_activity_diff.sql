-- Migration 043: transactional apply of bulk-import diff (new + modified + deleted)
-- Applied manually via Supabase Dashboard SQL Editor (macOS 11 / no CLI).

CREATE OR REPLACE FUNCTION apply_activity_diff(
  p_plano_id   uuid,
  p_program_id uuid,
  p_n0         text,
  p_n1         text,
  p_n2         text,
  p_new        jsonb,      -- array of new activity objects
  p_modified   jsonb,      -- array of { id, ...fields }
  p_deleted    jsonb       -- array of uuid strings
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count  int := 0;
  v_mod_count  int := 0;
  v_del_count  int := 0;
  v_max_sort   int;
  v_rec        jsonb;
BEGIN
  -- 1. Deletes first (CASCADE handles activity_dependencies)
  IF jsonb_array_length(p_deleted) > 0 THEN
    DELETE FROM activities
    WHERE id IN (
      SELECT (jsonb_array_elements_text(p_deleted))::uuid
    );
    GET DIAGNOSTICS v_del_count = ROW_COUNT;
  END IF;

  -- 2. Modifications
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_modified) LOOP
    UPDATE activities SET
      level  = (v_rec->>'level')::int,
      name   = v_rec->>'name',
      n3     = COALESCE(v_rec->>'n3', ''),
      n4     = COALESCE(v_rec->>'n4', ''),
      n5     = COALESCE(v_rec->>'n5', ''),
      n6     = COALESCE(v_rec->>'n6', ''),
      bs     = NULLIF(v_rec->>'bs',    '')::date,
      bf     = NULLIF(v_rec->>'bf',    '')::date,
      rs     = NULLIF(v_rec->>'rs',    '')::date,
      rf     = NULLIF(v_rec->>'rf',    '')::date,
      pct    = (v_rec->>'pct')::numeric,
      notes  = NULLIF(v_rec->>'notes', ''),
      status = CASE
                 WHEN (v_rec->>'pct')::numeric >= 100 THEN 'Concluída'
                 ELSE 'Em dia'
               END
    WHERE id = (v_rec->>'id')::uuid;
    v_mod_count := v_mod_count + 1;
  END LOOP;

  -- 3. New activities — append after current max sort_order
  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_sort
  FROM activities
  WHERE plano_id = p_plano_id;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_new) LOOP
    v_max_sort := v_max_sort + 1;
    INSERT INTO activities (
      program_id, plano_id,
      level, name,
      n0, n1, n2,
      n3, n4, n5, n6,
      id0, id1, id2,
      bs, bf, rs, rf,
      pct, pct_prev, status,
      notes, sort_order, source
    ) VALUES (
      p_program_id, p_plano_id,
      (v_rec->>'level')::int, v_rec->>'name',
      p_n0, p_n1, p_n2,
      COALESCE(v_rec->>'n3', ''), COALESCE(v_rec->>'n4', ''),
      COALESCE(v_rec->>'n5', ''), COALESCE(v_rec->>'n6', ''),
      p_n0, '', '',
      NULLIF(v_rec->>'bs',    '')::date,
      NULLIF(v_rec->>'bf',    '')::date,
      NULLIF(v_rec->>'rs',    '')::date,
      NULLIF(v_rec->>'rf',    '')::date,
      (v_rec->>'pct')::numeric, 0,
      CASE WHEN (v_rec->>'pct')::numeric >= 100 THEN 'Concluída' ELSE 'Em dia' END,
      NULLIF(v_rec->>'notes', ''), v_max_sort, 'manual'
    );
    v_new_count := v_new_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'new',      v_new_count,
    'modified', v_mod_count,
    'deleted',  v_del_count
  );
END;
$$;
