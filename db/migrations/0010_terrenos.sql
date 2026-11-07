-- Mundo WorkEnd (07/11/2026): lotes reservados por usuários. A planta do mundo (quais lotes existem e o que tem
-- construído em cada um) fica no código (src/office/data/mundo.ts); aqui só entram os lotes que alguém reservou.
-- Chave do lote: "<quarteirão i>,<quarteirão j>,<lote k>" (k: 0 NO, 1 NE, 2 SO, 3 SE), ex.: "-1,0,2".
CREATE TABLE IF NOT EXISTS terreno (
  chave         TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'reservado',   -- reservado | ativo (ativo = pago; pagamento entra depois)
  empresa_nome  TEXT NOT NULL,
  cor           TEXT NOT NULL DEFAULT '#1D4ED8',
  logo          BYTEA,                               -- imagem pequena (até 400 KB), servida em /api/terrenos/<chave>/logo
  logo_tipo     TEXT,
  reservado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- um chão por usuário nesta fase
CREATE UNIQUE INDEX IF NOT EXISTS terreno_usuario_unico ON terreno (usuario_id);
