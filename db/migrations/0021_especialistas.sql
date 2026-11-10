-- 10/11/2026: ficha completa dos agentes à venda (skills com passo a passo, limites, personalidade, nível e área)
-- e registro das sementes já aplicadas (os 39 especialistas entram no catálogo uma vez só).
ALTER TABLE agente_catalogo ADD COLUMN IF NOT EXISTS ficha JSONB;
CREATE TABLE IF NOT EXISTS semente (
  nome        TEXT PRIMARY KEY,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
