-- Escritório Nuvem — esquema inicial
-- Multiempresa desde o início: tudo pendurado em empresa.

CREATE TABLE IF NOT EXISTS empresa (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  nome        TEXT NOT NULL,
  sobre       TEXT NOT NULL DEFAULT '',          -- conhecimento geral compartilhado por todos os agentes
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agente (
  id              TEXT PRIMARY KEY,
  empresa_id      TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  area            TEXT NOT NULL,                 -- engenharia | marketing | vendas | suporte | diretoria
  nivel           TEXT NOT NULL,                 -- estagiario | junior | pleno | senior | gerente | diretor | ceo
  funcao          TEXT NOT NULL DEFAULT '',
  personalidade   TEXT NOT NULL DEFAULT '',
  tom_de_voz      TEXT NOT NULL DEFAULT '',
  descricao       TEXT NOT NULL DEFAULT '',      -- identidade livre: quem é, como pensa, como trata as pessoas
  modelo          TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  boneco          TEXT NOT NULL DEFAULT 'classico',
  mesa_id         TEXT,
  chefe_id        TEXT REFERENCES agente(id) ON DELETE SET NULL,
  teto_diario_brl NUMERIC(10,2) NOT NULL DEFAULT 20,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agente_empresa_idx ON agente(empresa_id);

-- O que o agente sabe (memória de longo prazo)
CREATE TABLE IF NOT EXISTS conhecimento (
  id         TEXT PRIMARY KEY,
  agente_id  TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  conteudo   TEXT NOT NULL,
  origem     TEXT NOT NULL DEFAULT 'manual',     -- manual | arquivo | treino
  ativo      BOOLEAN NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conhecimento_agente_idx ON conhecimento(agente_id);

-- Procedimento que o agente sabe executar
CREATE TABLE IF NOT EXISTS skill (
  id          TEXT PRIMARY KEY,
  agente_id   TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  quando_usar TEXT NOT NULL DEFAULT '',
  passos      TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  ordem       INT NOT NULL DEFAULT 0,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_agente_idx ON skill(agente_id);

-- Regra permanente aprendida no treinamento
CREATE TABLE IF NOT EXISTS regra (
  id                 TEXT PRIMARY KEY,
  agente_id          TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  texto              TEXT NOT NULL,
  origem_mensagem_id TEXT,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regra_agente_idx ON regra(agente_id);

-- Conversa com o agente
CREATE TABLE IF NOT EXISTS mensagem (
  id         TEXT PRIMARY KEY,
  agente_id  TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  papel      TEXT NOT NULL,                      -- user | assistant | system | tool
  autor      TEXT NOT NULL DEFAULT 'admin',      -- admin | agente:<id> | sistema
  conteudo   TEXT NOT NULL,
  avaliacao  SMALLINT,                           -- 1 bom, -1 ruim
  correcao   TEXT,
  custo_brl  NUMERIC(10,4) NOT NULL DEFAULT 0,
  tokens_in  INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mensagem_agente_idx ON mensagem(agente_id, criado_em);

CREATE TABLE IF NOT EXISTS tarefa (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  agente_id     TEXT REFERENCES agente(id) ON DELETE SET NULL,
  criada_por    TEXT NOT NULL DEFAULT 'admin',
  titulo        TEXT NOT NULL,
  descricao     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'aberta',  -- aberta | em_andamento | em_revisao | concluida | bloqueada | cancelada
  resultado     TEXT NOT NULL DEFAULT '',
  pai_id        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tarefa_empresa_idx ON tarefa(empresa_id, status);

-- Evento da cena (mesmo contrato de src/office/data/eventos.ts)
CREATE TABLE IF NOT EXISTS evento (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  agente_id  TEXT REFERENCES agente(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  texto      TEXT,
  payload    JSONB,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evento_empresa_idx ON evento(empresa_id, criado_em);

-- Consumo de IA por agente
CREATE TABLE IF NOT EXISTS uso_ia (
  id         TEXT PRIMARY KEY,
  agente_id  TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  modelo     TEXT NOT NULL,
  tokens_in  INT NOT NULL,
  tokens_out INT NOT NULL,
  custo_brl  NUMERIC(10,4) NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uso_ia_agente_idx ON uso_ia(agente_id, criado_em);
