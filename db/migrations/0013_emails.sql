-- 07/11/2026: e-mails do WorkEnd (SendGrid). Os layouts ficam editáveis no /app/admin; o que não foi editado usa o
-- padrão do código (src/server/email.ts). Cada envio fica registrado (mesmo sem chave do SendGrid, pra conferir).
CREATE TABLE IF NOT EXISTS email_modelo (
  chave         TEXT PRIMARY KEY,          -- cadastro | reserva | pagamento | vencimento | contato
  assunto       TEXT NOT NULL,
  html          TEXT NOT NULL,             -- corpo com {{variaveis}}; o cabeçalho/rodapé do WorkEnd é posto em volta
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_enviado (
  id         TEXT PRIMARY KEY,
  para       TEXT NOT NULL,
  chave      TEXT NOT NULL,
  assunto    TEXT NOT NULL,
  status     TEXT NOT NULL,                -- enviado | erro | sem_chave
  erro       TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_enviado_criado_idx ON email_enviado (criado_em DESC);
