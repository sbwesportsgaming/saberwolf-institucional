-- v1.6.82 — Sistema de 3 Chaves: fase todos contra todos
-- Este patch não cria tabela nova.
-- A estrutura da fase inicial é salva no JSONB public.tournaments.settings.structure
-- pelo fluxo real do painel de organizador/Admin.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournaments'
      AND column_name = 'settings'
  ) THEN
    RAISE EXCEPTION 'Coluna public.tournaments.settings não encontrada. A v1.6.82 precisa salvar a estrutura em settings.structure.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournaments'
      AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'Coluna public.tournaments.metadata não encontrada. A v1.6.82 usa metadata para auditoria da estrutura.';
  END IF;

  RAISE NOTICE 'v1.6.82 OK: Sistema de 3 Chaves usa settings.structure para salvar a fase todos contra todos no Supabase.';
END $$;
