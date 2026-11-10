-- 10/11/2026: evolução automática das skills dos 39 especialistas (treino cruzado entre os agentes).
-- Cada skill tem versões; vale a ativa. Sem versão no banco, vale a do código (src/office/data/especialistas.ts).
-- Os limites dos cargos não evoluem: ficam no código.
CREATE TABLE IF NOT EXISTS skill_versao (
  id              BIGSERIAL PRIMARY KEY,
  especialista_id TEXT NOT NULL,
  skill           TEXT NOT NULL,
  versao          INT NOT NULL,
  quando_usar     TEXT NOT NULL,
  passos          TEXT NOT NULL,
  origem          TEXT NOT NULL DEFAULT 'evolucao',   -- codigo | evolucao
  nota_antes      NUMERIC(5,2),
  nota_depois     NUMERIC(5,2),
  placar          TEXT,                               -- vitórias da nova x da antiga nos casos de treino
  motivo          TEXT,
  revisores       TEXT,
  ciclo_id        BIGINT,
  ativa           BOOLEAN NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (especialista_id, skill, versao)
);
CREATE UNIQUE INDEX IF NOT EXISTS skill_versao_uma_ativa ON skill_versao (especialista_id, skill) WHERE ativa;
CREATE TABLE IF NOT EXISTS evolucao_ciclo (
  id         BIGSERIAL PRIMARY KEY,
  inicio     TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim        TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'rodando',   -- rodando | concluido | teto | erro
  origem     TEXT NOT NULL DEFAULT 'agenda',    -- agenda | manual
  avaliadas  INT NOT NULL DEFAULT 0,
  melhoradas INT NOT NULL DEFAULT 0,
  custo_brl  NUMERIC(10,4) NOT NULL DEFAULT 0,
  resumo     JSONB,
  erro       TEXT
);
CREATE TABLE IF NOT EXISTS evolucao_tentativa (
  id              BIGSERIAL PRIMARY KEY,
  ciclo_id        BIGINT,
  especialista_id TEXT NOT NULL,
  skill           TEXT NOT NULL,
  resultado       TEXT NOT NULL,                -- adotada | mantida | erro
  placar          TEXT,
  nota_antes      NUMERIC(5,2),
  nota_depois     NUMERIC(5,2),
  motivo          TEXT,
  custo_brl       NUMERIC(10,4) NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evolucao_tentativa_skill ON evolucao_tentativa (especialista_id, skill, criado_em DESC);
CREATE TABLE IF NOT EXISTS config_sistema (
  nome          TEXT PRIMARY KEY,
  valor         JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
