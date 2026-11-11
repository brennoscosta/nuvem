-- Rede completa (11/11/2026).
-- 1) Negociação até o fim: um lado marca como concluída (status 'entregue', concluida_por) e o outro confirma
--    ('concluida', concluida_em) ou diz que ainda não terminou (volta a 'aceita').
ALTER TABLE negociacao ADD COLUMN IF NOT EXISTS concluida_por TEXT REFERENCES usuario(id) ON DELETE SET NULL;
ALTER TABLE negociacao ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;
-- 2) Avaliação depois do negócio concluído: cada lado avalia o outro uma vez (1 a 5 estrelas e um comentário).
CREATE TABLE IF NOT EXISTS avaliacao (
  id TEXT PRIMARY KEY,
  negociacao_id TEXT NOT NULL REFERENCES negociacao(id) ON DELETE CASCADE,
  de_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  para_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  texto TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (negociacao_id, de_id)
);
CREATE INDEX IF NOT EXISTS avaliacao_para_idx ON avaliacao (para_id, criado_em DESC);
-- 3) Perfil profissional do personagem, para quem procura profissionais (/encontrar).
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS profissao TEXT NOT NULL DEFAULT '';
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS nicho TEXT NOT NULL DEFAULT '';
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS servicos TEXT NOT NULL DEFAULT '';
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS preco TEXT NOT NULL DEFAULT '';
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS local TEXT NOT NULL DEFAULT '';
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS portfolio JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS disponivel BOOLEAN NOT NULL DEFAULT true;
