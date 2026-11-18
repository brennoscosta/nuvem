-- Pedidos feitos na conversa com a atendente da loja (17/11/2026, pedido do dono: "funcionalidades baseadas no que
-- oferecemos, vendas e resultados para empresas"). O WorkEnd NÃO intermedeia o dinheiro: o Pix é gerado com a chave do
-- próprio dono (recebimento_pix) e quem confirma o recebimento é ele, no painel de Vendas.
CREATE TABLE IF NOT EXISTS pedido (
  id                 TEXT PRIMARY KEY,
  numero             INTEGER NOT NULL,                 -- sequência por dono (#1, #2…)
  usuario_id         TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, -- dono da loja (a vitrine é da conta)
  lote               TEXT,                             -- chave do terreno onde a venda aconteceu
  cliente_nome       TEXT NOT NULL DEFAULT '',
  cliente_contato    TEXT NOT NULL DEFAULT '',
  cliente_usuario_id TEXT,                             -- quando o cliente estava logado
  conversa           TEXT,                             -- conversa com a atendente, quando houver
  itens              JSONB NOT NULL DEFAULT '[]',      -- [{ produtoId, nome, precoCentavos, qtd }]
  subtotal_centavos  INTEGER NOT NULL,
  desconto_centavos  INTEGER NOT NULL DEFAULT 0,
  total_centavos     INTEGER NOT NULL,
  cupom_codigo       TEXT,
  tipo               TEXT NOT NULL DEFAULT 'pedido',   -- pedido | sinal (sinal de agendamento)
  agendamento_id     TEXT,
  status             TEXT NOT NULL DEFAULT 'aguardando', -- aguardando | pago | entregue | cancelado
  pix_copia_cola     TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em            TIMESTAMPTZ,
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pedido_numero_idx ON pedido (usuario_id, numero);
CREATE INDEX IF NOT EXISTS pedido_dono_idx ON pedido (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS pedido_status_idx ON pedido (usuario_id, status);

-- Chave Pix de recebimento do dono (para gerar o Pix copia e cola dos pedidos)
CREATE TABLE IF NOT EXISTS recebimento_pix (
  usuario_id    TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  chave         TEXT NOT NULL,
  nome          TEXT NOT NULL,   -- nome do recebedor (até 25 caracteres, sem acento no BR Code)
  cidade        TEXT NOT NULL,   -- cidade do recebedor (até 15 caracteres, sem acento no BR Code)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
