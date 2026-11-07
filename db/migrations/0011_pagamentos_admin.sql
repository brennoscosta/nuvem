-- Mundo WorkEnd, fase 2 (07/11/2026): reserva vale 10 minutos; pagar (Mercado Pago, R$ 99/mês por lote) ativa o
-- chão por 30 dias; admin do WorkEnd vê tudo, libera e bane.
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS reservado_ate TIMESTAMPTZ;   -- fim da reserva sem pagamento
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS pago_ate      TIMESTAMPTZ;   -- até quando está pago (status ativo)
UPDATE terreno SET reservado_ate = reservado_em + interval '10 minutes' WHERE reservado_ate IS NULL AND status = 'reservado';

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS papel         TEXT NOT NULL DEFAULT 'dono';  -- dono | admin
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS banido_em     TIMESTAMPTZ;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS banido_motivo TEXT;
UPDATE usuario SET papel = 'admin' WHERE email = 'souzacostabrenno@gmail.com';

CREATE TABLE IF NOT EXISTS pagamento (
  id             TEXT PRIMARY KEY,                 -- vira o external_reference no Mercado Pago
  terreno_chave  TEXT NOT NULL,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  provedor       TEXT NOT NULL DEFAULT 'mercadopago',
  preferencia_id TEXT,                             -- id da preferência (checkout)
  pagamento_id   TEXT,                             -- id do pagamento no provedor, quando houver
  status         TEXT NOT NULL DEFAULT 'pendente', -- pendente | aprovado | rejeitado | estornado | cancelado
  valor          NUMERIC(10,2) NOT NULL,
  meses          INT NOT NULL DEFAULT 1,
  metodo         TEXT,                             -- pix, credit_card...
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em        TIMESTAMPTZ,
  bruto          JSONB                             -- resposta do provedor (pra auditoria)
);
CREATE INDEX IF NOT EXISTS pagamento_usuario ON pagamento (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS pagamento_terreno ON pagamento (terreno_chave, criado_em DESC);
