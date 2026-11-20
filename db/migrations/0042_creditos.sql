-- Créditos WorkEnd e Unidades de IA (20/11/2026, frente "creditos"). Duas moedas, cada uma com carteira e extrato:
--  1) Créditos: por USUÁRIO, 1 crédito = R$ 1,00, comprados em pacotes no Pix e usados para pagar tudo o que o WorkEnd
--     vende. Dois baldes: "comprado" (pode voltar em dinheiro em até 7 dias, CDC) e "bônus" (não volta em dinheiro).
--  2) Unidades de IA: por EMPRESA, 1 unidade = R$ 0,01 de custo real de IA. Todo lote ativo recebe a mensalidade inclusa
--     (vence no fim do mês); a comprada com créditos não vence. O consumo tira primeiro da inclusa.
-- Os extratos são imutáveis (só INSERT): correção é um lançamento novo de ajuste ou estorno.

-- ================= Créditos =================
CREATE TABLE IF NOT EXISTS credito_carteira (
  usuario_id    TEXT PRIMARY KEY,
  comprado      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (comprado >= 0),
  bonus         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS credito_lancamento (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('compra', 'bonus', 'uso', 'estorno', 'ajuste', 'devolucao')),
  comprado       NUMERIC(12,2) NOT NULL DEFAULT 0, -- variação do balde comprado (+ entra, − sai)
  bonus          NUMERIC(12,2) NOT NULL DEFAULT 0, -- variação do balde bônus
  saldo_comprado NUMERIC(12,2) NOT NULL,           -- saldo depois deste lançamento
  saldo_bonus    NUMERIC(12,2) NOT NULL,
  descricao      TEXT NOT NULL,
  pagamento_id   TEXT,                             -- pagamento ligado (pacote comprado, produto pago, Pix com reserva)
  chave          TEXT UNIQUE,                      -- idempotência: a mesma operação nunca lança duas vezes
  motivo         TEXT,                             -- ajuste e devolução do admin
  admin_id       TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credito_lancamento_usuario_idx ON credito_lancamento (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS credito_lancamento_pagamento_idx ON credito_lancamento (pagamento_id) WHERE pagamento_id IS NOT NULL;

-- pagamento: quanto dos créditos da carteira entrou (o campo valor continua sendo só o que vai no Pix), a chave de
-- idempotência do clique e a devolução marcada pelo admin (o estorno do Pix é feito à mão no Mercado Pago)
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS creditos_carteira NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS idem TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pagamento_idem_idx ON pagamento (usuario_id, idem) WHERE idem IS NOT NULL;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS devolvido_em TIMESTAMPTZ;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS devolvido_valor NUMERIC(10,2);
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS devolvido_por TEXT;
CREATE INDEX IF NOT EXISTS pagamento_reserva_idx ON pagamento (usuario_id) WHERE status = 'pendente' AND creditos_carteira > 0;

-- crédito de indicação (src/server/ofertas.ts) vira bônus na carteira: ganho liberado menos o que já foi usado em
-- pagamentos aprovados. Um Pix antigo ainda aberto com desconto de indicação, se for pago depois, desconta do bônus
-- (src/server/mercadopago.ts › aplicar). Ninguém perde valor.
INSERT INTO credito_carteira (usuario_id, bonus)
SELECT x.uid, x.saldo FROM (
  SELECT i.indicador_id AS uid,
    sum(i.credito) - COALESCE((SELECT sum(p.credito_usado) FROM pagamento p WHERE p.usuario_id = i.indicador_id AND p.status = 'aprovado'), 0) AS saldo
  FROM indicacao i WHERE i.status = 'liberada' GROUP BY i.indicador_id
) x WHERE x.saldo > 0
ON CONFLICT (usuario_id) DO NOTHING;
INSERT INTO credito_lancamento (id, usuario_id, tipo, comprado, bonus, saldo_comprado, saldo_bonus, descricao, chave)
SELECT 'cl_mig_' || substr(md5(c.usuario_id), 1, 16), c.usuario_id, 'bonus', 0, c.bonus, 0, c.bonus,
  'Crédito de indicação convertido em bônus (saldo de 20/11/2026)', 'migracao-indicacao:' || c.usuario_id
FROM credito_carteira c WHERE c.bonus > 0
ON CONFLICT (chave) DO NOTHING;

-- ================= Unidades de IA =================
CREATE TABLE IF NOT EXISTS ia_carteira (
  empresa_id    TEXT PRIMARY KEY,
  mes           TEXT NOT NULL,                          -- 'AAAA-MM' (horário de Brasília) da mensalidade em vigor
  inclusa       INT NOT NULL DEFAULT 0 CHECK (inclusa >= 0),
  comprada      INT NOT NULL DEFAULT 0 CHECK (comprada >= 0),
  base_mes      INT NOT NULL DEFAULT 0,                 -- o que entrou no mês (para o aviso de 20%)
  avisado       TEXT,                                   -- último aviso do mês: '20' ou '0'
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ia_lancamento (
  id             TEXT PRIMARY KEY,
  empresa_id     TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('mensalidade', 'compra', 'uso', 'vencimento', 'ajuste', 'estorno')),
  inclusa        INT NOT NULL DEFAULT 0,                -- variação de cada balde
  comprada       INT NOT NULL DEFAULT 0,
  saldo_inclusa  INT NOT NULL,
  saldo_comprada INT NOT NULL,
  agente_id      TEXT,                                  -- uso: quem gastou
  categoria      TEXT,                                  -- uso: conversa | tarefa | imagem
  modelo         TEXT,
  custo_brl      NUMERIC(12,6),                         -- uso: custo real da chamada (o admin compara com o vendido)
  descricao      TEXT NOT NULL,
  pagamento_id   TEXT,
  chave          TEXT UNIQUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ia_lancamento_empresa_idx ON ia_lancamento (empresa_id, criado_em DESC);

-- ================= Agentes comprados =================
-- Compra única por lote (fica enquanto o lote estiver ativo). Quem sai da equipe continua contratado e volta sem pagar.
CREATE TABLE IF NOT EXISTS agente_contratado (
  id            TEXT PRIMARY KEY,
  terreno_chave TEXT NOT NULL,
  usuario_id    TEXT NOT NULL,
  catalogo_id   TEXT NOT NULL,
  membro_id     TEXT NOT NULL,
  nome          TEXT NOT NULL,
  cargo         TEXT NOT NULL,
  preco         NUMERIC(10,2) NOT NULL,
  pagamento_id  TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'ativo',          -- ativo | estornado
  personalidade_id TEXT,                                -- src/office/data/personalidades.ts
  escopo        JSONB,                                  -- { foco, faz } (src/office/data/escopo.ts)
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (terreno_chave, membro_id)
);
CREATE INDEX IF NOT EXISTS agente_contratado_usuario_idx ON agente_contratado (usuario_id);

-- ================= extratos imutáveis =================
CREATE OR REPLACE FUNCTION workend_extrato_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Extrato imutável: lance um ajuste ou estorno em vez de alterar ou apagar (%).', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS credito_lancamento_imutavel ON credito_lancamento;
CREATE TRIGGER credito_lancamento_imutavel BEFORE UPDATE OR DELETE ON credito_lancamento FOR EACH ROW EXECUTE FUNCTION workend_extrato_imutavel();
DROP TRIGGER IF EXISTS ia_lancamento_imutavel ON ia_lancamento;
CREATE TRIGGER ia_lancamento_imutavel BEFORE UPDATE OR DELETE ON ia_lancamento FOR EACH ROW EXECUTE FUNCTION workend_extrato_imutavel();
