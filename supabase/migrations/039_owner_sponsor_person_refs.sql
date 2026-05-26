-- 039_owner_sponsor_person_refs.sql
-- Adds structured person-reference columns for owner and sponsor on planos.
-- B-adaptado model: _person_ids (uuid[]) + _primary_id (FK) + _label_override (text).
-- DO NOT apply from CLI — apply manually via Supabase Dashboard SQL Editor.

BEGIN;

ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS owner_person_ids       uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_primary_id       uuid    REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_label_override   text,
  ADD COLUMN IF NOT EXISTS sponsor_person_ids     uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sponsor_primary_id     uuid    REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sponsor_label_override text;

-- Back-fill owner_person_ids + owner_primary_id from the legacy owner text column.
-- Splits on '|' and ',' (with optional surrounding whitespace), looks up people.name
-- case-insensitively. Unmatched names are silently skipped (result stays empty array).
WITH name_list AS (
  SELECT
    p.id            AS plano_id,
    trim(t.raw)     AS raw_name,
    t.ord
  FROM planos p,
       regexp_split_to_table(p.owner, '\s*[|,]\s*') WITH ORDINALITY AS t(raw, ord)
  WHERE p.owner IS NOT NULL
    AND p.owner <> ''
    AND trim(t.raw) <> ''
),
matched AS (
  SELECT
    nl.plano_id,
    pe.id   AS person_id,
    nl.ord
  FROM name_list nl
  JOIN people pe ON lower(trim(pe.name)) = lower(nl.raw_name)
)
UPDATE planos pl
SET
  owner_person_ids = (
    SELECT array_agg(m.person_id ORDER BY m.ord)
    FROM matched m
    WHERE m.plano_id = pl.id
  ),
  owner_primary_id = (
    SELECT m.person_id
    FROM matched m
    WHERE m.plano_id = pl.id
    ORDER BY m.ord
    LIMIT 1
  )
FROM (SELECT DISTINCT plano_id FROM matched) sub
WHERE pl.id = sub.plano_id;

-- Back-fill sponsor_person_ids + sponsor_primary_id from the legacy sponsor text column.
WITH name_list AS (
  SELECT
    p.id            AS plano_id,
    trim(t.raw)     AS raw_name,
    t.ord
  FROM planos p,
       regexp_split_to_table(p.sponsor, '\s*[|,]\s*') WITH ORDINALITY AS t(raw, ord)
  WHERE p.sponsor IS NOT NULL
    AND p.sponsor <> ''
    AND trim(t.raw) <> ''
),
matched AS (
  SELECT
    nl.plano_id,
    pe.id   AS person_id,
    nl.ord
  FROM name_list nl
  JOIN people pe ON lower(trim(pe.name)) = lower(nl.raw_name)
)
UPDATE planos pl
SET
  sponsor_person_ids = (
    SELECT array_agg(m.person_id ORDER BY m.ord)
    FROM matched m
    WHERE m.plano_id = pl.id
  ),
  sponsor_primary_id = (
    SELECT m.person_id
    FROM matched m
    WHERE m.plano_id = pl.id
    ORDER BY m.ord
    LIMIT 1
  )
FROM (SELECT DISTINCT plano_id FROM matched) sub
WHERE pl.id = sub.plano_id;

COMMIT;
