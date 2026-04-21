-- Migration 010: Enrich pds_entries JSONB item arrays with id, created_at, hidden_at
-- Each item gains: id (uuid text), created_at (ISO timestamp text), hidden_at (null by default).
-- Existing text/date/status fields are preserved untouched.
-- Safe to run multiple times — items that already have an 'id' field are skipped.
-- Requires: migration 008 (pds_entries.program_id / plano_id columns must exist).

DO $$
DECLARE
  r    RECORD;
  cols TEXT[] := ARRAY['commitments_items','progress_items','next_steps_items','attention_items'];
  col  TEXT;
  arr  JSONB;
  item JSONB;
  out  JSONB;
  i    INT;
BEGIN
  FOR r IN SELECT id FROM public.pds_entries LOOP
    FOREACH col IN ARRAY cols LOOP

      EXECUTE format('SELECT %I FROM public.pds_entries WHERE id = $1', col)
        USING r.id INTO arr;

      CONTINUE WHEN arr IS NULL OR jsonb_array_length(arr) = 0;

      out := '[]'::JSONB;

      FOR i IN 0 .. jsonb_array_length(arr) - 1 LOOP
        item := arr -> i;

        IF item ? 'id' THEN
          -- Already enriched — preserve as-is.
          out := out || jsonb_build_array(item);
        ELSE
          -- Legacy item — merge enrichment fields.
          out := out || jsonb_build_array(
            item || jsonb_build_object(
              'id',         gen_random_uuid()::TEXT,
              'created_at', now()::TEXT,
              'hidden_at',  NULL
            )
          );
        END IF;
      END LOOP;

      EXECUTE format(
        'UPDATE public.pds_entries SET %I = $1 WHERE id = $2',
        col
      ) USING out, r.id;

    END LOOP;
  END LOOP;
END;
$$;
