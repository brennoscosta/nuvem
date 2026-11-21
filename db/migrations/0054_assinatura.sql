-- Assinatura recorrente (WE-09, 21/11/2026): o lote (ou o quiosque) é cobrado todo mês pelo Mercado Pago, no cartão de
-- crédito (API de assinaturas: preapproval) ou, quando o Mercado Pago liberar na API, no Pix Automático. Só acrescenta
-- tabelas: nada do Pix avulso muda. Cada cobrança aprovada vira uma linha em `pagamento` (id começando com "pagr_") e
-- estende o pago_ate pelo mesmo caminho do Pix (mercadopago.ts › aplicar › PRODUTOS.lote/quiosque › ativarTerreno).
-- usuario_id sem chave estrangeira de propósito: se a conta for excluída, a assinatura continua aqui até ser cancelada
-- no Mercado Pago (o ciclo em src/server/assinaturas.ts cancela a que ficou sem lote ou sem conta).

CREATE TABLE IF NOT EXISTS assinatura (
  id                 TEXT PRIMARY KEY,                    -- vira o external_reference no Mercado Pago
  usuario_id         TEXT NOT NULL,
  terreno_chave      TEXT NOT NULL,                       -- lote principal ou quiosque; o lote extra vai junto do principal
  tipo               TEXT NOT NULL,                       -- lote | quiosque (o tipo do pagamento de cada cobrança)
  meio               TEXT NOT NULL,                       -- cartao | pix_automatico
  estado             TEXT NOT NULL DEFAULT 'pendente',    -- pendente | ativa | falhando | cancelada | encerrada | recusada
  externo_id         TEXT UNIQUE,                         -- id do preapproval no Mercado Pago
  valor              NUMERIC(10,2) NOT NULL,              -- mensalidade das renovações (lote + lotes extras, ou quiosque)
  primeiro_valor     NUMERIC(10,2) NOT NULL,              -- 1ª cobrança (com a oferta de entrada, quando houver)
  oferta             TEXT,                                -- oferta da 1ª cobrança (fundador | feira | indicado)
  desconto           NUMERIC(10,2) NOT NULL DEFAULT 0,
  primeiro_pagamento TEXT,                                -- linha de `pagamento` reservada para a 1ª cobrança
  primeira           BOOLEAN NOT NULL DEFAULT false,      -- 1ª contratação da conta (vale para os 7 dias de arrependimento)
  inicio             TEXT NOT NULL DEFAULT 'agora',       -- agora (lote reservado) | vencimento (lote já ativo)
  proxima_cobranca   TIMESTAMPTZ,
  tentativas         INT NOT NULL DEFAULT 0,              -- tentativa da cobrança que está falhando (retry_attempt)
  ultima_falha       TEXT,
  ultima_falha_em    TIMESTAMPTZ,
  lembrete_em        TIMESTAMPTZ,                         -- último lembrete de 3 dias antes
  valor_ajustado_em  TIMESTAMPTZ,                         -- quando a mensalidade foi atualizada no Mercado Pago
  idem               TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativada_em         TIMESTAMPTZ,
  cancelada_em       TIMESTAMPTZ,
  motivo_fim         TEXT,
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  bruto              JSONB
);
-- um terreno tem no máximo uma assinatura valendo; o mesmo clique repetido devolve a mesma assinatura
CREATE UNIQUE INDEX IF NOT EXISTS assinatura_terreno_viva_idx ON assinatura (terreno_chave) WHERE estado IN ('pendente', 'ativa', 'falhando');
CREATE UNIQUE INDEX IF NOT EXISTS assinatura_idem_idx ON assinatura (usuario_id, idem) WHERE idem IS NOT NULL;
CREATE INDEX IF NOT EXISTS assinatura_usuario_idx ON assinatura (usuario_id, criado_em DESC);

-- cada cobrança do Mercado Pago (authorized_payment), com a tentativa e a linha de `pagamento` que ela virou
CREATE TABLE IF NOT EXISTS assinatura_cobranca (
  externo_id     TEXT PRIMARY KEY,                        -- id do authorized_payment
  assinatura_id  TEXT NOT NULL REFERENCES assinatura(id),
  pagamento_ref  TEXT,                                    -- pagamento.id
  status         TEXT,                                    -- status do authorized_payment
  pagamento_status TEXT,                                  -- status do pagamento (approved, rejected...)
  detalhe        TEXT,
  tentativa      INT NOT NULL DEFAULT 0,
  valor          NUMERIC(10,2),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assinatura_cobranca_assinatura_idx ON assinatura_cobranca (assinatura_id, criado_em DESC);

-- caixa de entrada dos avisos (webhooks) de assinatura: gravado antes de responder; o mesmo id não processa duas vezes,
-- e o que ficou sem processar (queda no meio) o ciclo refaz
CREATE TABLE IF NOT EXISTS assinatura_evento (
  evento_id     TEXT PRIMARY KEY,
  topico        TEXT NOT NULL,
  recurso_id    TEXT NOT NULL,
  recebido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado_em TIMESTAMPTZ,
  tentativas    INT NOT NULL DEFAULT 0,
  erro          TEXT
);
CREATE INDEX IF NOT EXISTS assinatura_evento_pendente_idx ON assinatura_evento (recebido_em) WHERE processado_em IS NULL;

-- cancelamento nos 7 dias da 1ª contratação: só o pedido; a devolução é feita à mão pelo admin no Mercado Pago
CREATE TABLE IF NOT EXISTS devolucao_pedido (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL,
  assinatura_id TEXT NOT NULL REFERENCES assinatura(id),
  valor         NUMERIC(10,2) NOT NULL,
  pagamentos    TEXT[] NOT NULL DEFAULT '{}',
  motivo        TEXT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'aberto',           -- aberto | resolvido
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em  TIMESTAMPTZ,
  resolvido_por TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS devolucao_pedido_assinatura_idx ON devolucao_pedido (assinatura_id);

-- a cobrança aprovada vira uma linha em `pagamento` ligada à assinatura; o mesmo pagamento do Mercado Pago nunca vira
-- duas linhas (trava contra webhook repetido ou chegando junto com a conferência)
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS assinatura_id TEXT;
CREATE INDEX IF NOT EXISTS pagamento_assinatura_idx ON pagamento (assinatura_id) WHERE assinatura_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pagamento_assinatura_mp_idx ON pagamento (pagamento_id) WHERE assinatura_id IS NOT NULL AND pagamento_id IS NOT NULL;
