-- Frente "visitante" (20/11/2026): passaporte da cidade, cupom do passaporte, pedidos dos moradores e caça aos presentes
-- de Natal (src/server/passaporte.ts, src/office/data/passaporte.ts).

-- um carimbo por pessoa e por lugar (loja, quiosque ou sede, pela chave), ganho ao ser atendido na recepção
CREATE TABLE IF NOT EXISTS passaporte_carimbo (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  loja_chave TEXT NOT NULL,          -- chave do lote principal, do quiosque (quiosque-1xx) ou da sede
  dono_id TEXT NOT NULL,             -- dono no dia do carimbo (o cupom do passaporte confere por ele)
  empresa_nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#1D4ED8',
  numero INTEGER,                    -- número da loja (sedes: 0 e 901 em diante; quiosques: 101 em diante)
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, loja_chave)
);
CREATE INDEX IF NOT EXISTS passaporte_carimbo_dia_idx ON passaporte_carimbo (usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS passaporte_carimbo_dono_idx ON passaporte_carimbo (usuario_id, dono_id);

-- marcos alcançados (insígnias do perfil público), com o item exclusivo e o bônus em créditos que deram
CREATE TABLE IF NOT EXISTS passaporte_marco (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  marco TEXT NOT NULL,               -- turista, viajante, desbravador ou natal-<ano>
  item TEXT,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, marco)
);
CREATE INDEX IF NOT EXISTS passaporte_marco_mes_idx ON passaporte_marco (criado_em) WHERE bonus > 0;

-- o cupom que a recepcionista oferece a quem chega com o passaporte (um por loja; fora da lista pública)
ALTER TABLE cupom ADD COLUMN IF NOT EXISTS passaporte BOOLEAN NOT NULL DEFAULT false;

-- pedidos dos moradores: aceito → feito (atendido na loja indicada) → agradecido (o morador agradeceu); ou recusado
CREATE TABLE IF NOT EXISTS morador_pedido (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  morador_id TEXT NOT NULL,
  dia DATE NOT NULL,
  loja_chave TEXT NOT NULL,
  empresa_nome TEXT NOT NULL,
  numero INTEGER,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aceito',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  feito_em TIMESTAMPTZ,
  agradecido_em TIMESTAMPTZ,
  UNIQUE (usuario_id, morador_id, dia)
);
CREATE INDEX IF NOT EXISTS morador_pedido_loja_idx ON morador_pedido (usuario_id, loja_chave, status);

-- presentes de Natal achados (os do dia saem de um sorteio fixo pela data)
CREATE TABLE IF NOT EXISTS natal_presente (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  temporada INTEGER NOT NULL,
  dia DATE NOT NULL,
  idx INTEGER NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, dia, idx)
);
CREATE INDEX IF NOT EXISTS natal_presente_temporada_idx ON natal_presente (usuario_id, temporada);
