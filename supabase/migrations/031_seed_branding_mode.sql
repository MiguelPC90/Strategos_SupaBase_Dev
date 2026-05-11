-- ─────────────────────────────────────────────────────────────
-- 031 — Seed default branding_mode in app_config
-- ─────────────────────────────────────────────────────────────
-- Topbar now supports 2 cobranding modes:
--   · 'stratgos' (default) — Stratgos wordmark only
--   · 'cobrand'             — Stratgos g-mark + client logo + name
--
-- Frontend defaults to 'stratgos' if key is missing, but seeding
-- the default makes the key visible in Admin Geral.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.app_config (config_key, data)
VALUES ('branding_mode', 'stratgos')
ON CONFLICT (config_key) DO NOTHING;
