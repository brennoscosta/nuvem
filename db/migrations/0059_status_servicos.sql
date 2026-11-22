-- WE-23 (22/11/2026): histórico da página pública de status (/status). A agenda interna (src/instrumentation.ts ›
-- src/server/statusServicos.ts) confere os serviços a cada 5 minutos e grava uma linha por serviço; o que passa de 8 dias
-- é apagado na própria conferência. Só aditiva: tabela nova, nada muda nas outras.
CREATE TABLE IF NOT EXISTS status_checagem (
  id        BIGSERIAL PRIMARY KEY,
  servico   TEXT NOT NULL,                -- site | banco | cidade | pagamentos | email | ia
  estado    TEXT NOT NULL,                -- ok | falha | desligado (o serviço não está configurado, como o e-mail sem chave)
  ms        INTEGER,                      -- quanto a resposta demorou
  detalhe   TEXT NOT NULL DEFAULT '',     -- curto e sem dado pessoal ("HTTP 503", "tempo esgotado")
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_checagem_tempo_idx ON status_checagem (criado_em);
