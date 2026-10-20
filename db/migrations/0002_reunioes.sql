-- Reuniões convocadas (base pra conversa entre agentes na fase seguinte)
CREATE TABLE IF NOT EXISTS reuniao (
  id             TEXT PRIMARY KEY,
  empresa_id     TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  convocador_id  TEXT REFERENCES agente(id) ON DELETE SET NULL,
  participantes  JSONB NOT NULL DEFAULT '[]',
  setores        JSONB NOT NULL DEFAULT '[]',
  pauta          TEXT NOT NULL DEFAULT '',
  ata            TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'aberta', -- aberta | encerrada
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  encerrado_em   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reuniao_empresa_idx ON reuniao(empresa_id, criado_em);
