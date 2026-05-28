-- ============================================================
-- Decifrai — Trigger de snapshot diário do ranking
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona a coluna rank_yesterday na tabela de rankings
--    (pule se já existir)
ALTER TABLE rankings
  ADD COLUMN IF NOT EXISTS rank_position  INTEGER,
  ADD COLUMN IF NOT EXISTS rank_yesterday INTEGER;

-- 2. Função que recalcula rank_position para todos os jogadores
--    e salva o valor anterior em rank_yesterday
CREATE OR REPLACE FUNCTION refresh_ranking()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Salva posição atual antes de recalcular
  UPDATE rankings
  SET rank_yesterday = rank_position
  WHERE rank_position IS NOT NULL;

  -- Recalcula as posições ordenando por score
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, wins DESC, updated_at ASC) AS new_pos
    FROM rankings
  )
  UPDATE rankings r
  SET rank_position = ranked.new_pos
  FROM ranked
  WHERE r.id = ranked.id;
END;
$$;

-- 3. Agendamento via pg_cron (extensão disponível no Supabase)
--    Roda todo dia à meia-noite (horário UTC)
--    Habilite pg_cron em: Dashboard → Extensions → pg_cron
SELECT cron.schedule(
  'daily-ranking-refresh',   -- nome do job (único)
  '0 0 * * *',               -- cron expression: todo dia às 00:00 UTC
  'SELECT refresh_ranking()'
);

-- 4. Para rodar manualmente e testar:
--    SELECT refresh_ranking();

-- ============================================================
-- Como calcular o delta no frontend:
--
--   const delta = (player.rank_yesterday ?? player.rank_position)
--                 - player.rank_position;
--
--   <RankDelta delta={delta} />
--
--   delta > 0 → subiu posições (ex: era 5°, agora é 2°, delta = +3)
--   delta < 0 → caiu posições
--   delta = 0 → mesma posição
-- ============================================================
