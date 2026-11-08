-- 08/11/2026: rede do WorkEnd entre personagens — amizade, negociações e chamadas (call por WebRTC com sinalização aqui).
CREATE TABLE IF NOT EXISTS amizade (
  id            TEXT PRIMARY KEY,
  de_id         TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,  -- quem pediu
  para_id       TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,  -- quem recebeu o pedido
  status        TEXT NOT NULL DEFAULT 'pendente',                         -- pendente | aceita | recusada
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS amizade_par_uq ON amizade (LEAST(de_id, para_id), GREATEST(de_id, para_id));
CREATE INDEX IF NOT EXISTS amizade_para_idx ON amizade (para_id, status);

CREATE TABLE IF NOT EXISTS negociacao (
  id            TEXT PRIMARY KEY,
  de_id         TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,  -- quem propôs
  para_id       TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  texto         TEXT NOT NULL DEFAULT '',
  valor         NUMERIC(12,2),                                            -- opcional
  status        TEXT NOT NULL DEFAULT 'aberta',                           -- aberta | aceita | recusada | cancelada | concluida
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS negociacao_de_idx ON negociacao (de_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS negociacao_para_idx ON negociacao (para_id, criado_em DESC);

-- chamadas (áudio/vídeo direto entre os dois navegadores; o servidor só troca os sinais)
CREATE TABLE IF NOT EXISTS chamada (
  id            TEXT PRIMARY KEY,
  de_id         TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,  -- quem ligou
  para_id       TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  video         BOOLEAN NOT NULL DEFAULT TRUE,
  status        TEXT NOT NULL DEFAULT 'tocando',                          -- tocando | ativa | encerrada | recusada | perdida
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atendida_em   TIMESTAMPTZ,
  encerrada_em  TIMESTAMPTZ,
  visto_de      TIMESTAMPTZ NOT NULL DEFAULT now(),                       -- última consulta de cada lado (cai = encerra)
  visto_para    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chamada_aberta_idx ON chamada (status, criado_em DESC);
CREATE TABLE IF NOT EXISTS sinal (
  seq           BIGSERIAL PRIMARY KEY,
  chamada_id    TEXT NOT NULL REFERENCES chamada(id) ON DELETE CASCADE,
  de_id         TEXT NOT NULL,
  tipo          TEXT NOT NULL,                                            -- offer | answer | ice
  dados         JSONB NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sinal_chamada_idx ON sinal (chamada_id, seq);
