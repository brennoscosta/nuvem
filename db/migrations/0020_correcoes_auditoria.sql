-- 09/11/2026: correções da auditoria.
-- Segredo que assina as sessões, gerado pelo sistema (antes derivava da senha do admin).
CREATE TABLE IF NOT EXISTS segredo_sistema (
  nome      TEXT PRIMARY KEY,
  valor     TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Lote vencido sai do mapa, mas a marca e a equipe ficam guardadas e voltam na próxima reserva do mesmo dono.
CREATE TABLE IF NOT EXISTS terreno_arquivo (
  id           BIGSERIAL PRIMARY KEY,
  chave        TEXT NOT NULL,
  usuario_id   TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  empresa_nome TEXT NOT NULL,
  cor          TEXT NOT NULL,
  nicho        TEXT NOT NULL,
  logo         BYTEA,
  logo_tipo    TEXT,
  escritorio   JSONB,
  pago_ate     TIMESTAMPTZ,
  arquivado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS terreno_arquivo_usuario ON terreno_arquivo (usuario_id, arquivado_em DESC);
-- Aviso de vencimento: uma vez por ciclo pago (renovar zera).
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS avisado_em TIMESTAMPTZ;
-- Trocar a senha pelo link; trocar derruba as sessões abertas antes da troca.
CREATE TABLE IF NOT EXISTS redefinicao_senha (
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  expira_em  TIMESTAMPTZ NOT NULL,
  usada_em   TIMESTAMPTZ,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS senha_trocada_em TIMESTAMPTZ;
