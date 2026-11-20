-- Praça que dá lucro (20/11/2026): anúncios pagos no telão da Praça de Eventos, evento em destaque e patrocínio da praça.
-- Fluxo: o dono cria em /app/divulgar (aguardando_pagamento, reserva de 70 min) → Pix aprovado (em_analise) → o admin
-- aprova (aprovado: entra na grade) ou recusa com motivo (recusado: o Pix é devolvido à mão). Estorno: estornado.
CREATE TABLE IF NOT EXISTS anuncio_praca (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  terreno_chave TEXT,
  tipo TEXT NOT NULL,                       -- telao | destaque | patrocinio
  formato TEXT NOT NULL DEFAULT 'modelo',   -- modelo (logo, nome e frase) | imagem | video
  frase TEXT NOT NULL DEFAULT '',
  midia BYTEA,
  midia_tipo TEXT,
  evento_id TEXT REFERENCES evento_praca(id) ON DELETE SET NULL,
  inicio DATE NOT NULL,                     -- dia de Brasília em que começa
  dias INT NOT NULL DEFAULT 1,
  valor NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  reservado_ate TIMESTAMPTZ,
  pagamento_ref TEXT,
  pago_em TIMESTAMPTZ,
  decidido_em TIMESTAMPTZ,
  decidido_por TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anuncio_praca_status_idx ON anuncio_praca (status, tipo, inicio);
CREATE INDEX IF NOT EXISTS anuncio_praca_usuario_idx ON anuncio_praca (usuario_id, criado_em DESC);
