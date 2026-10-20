-- Funções reais: conexões com serviços externos (OAuth), arquivos enviados e tarefas dos agentes.

-- Conta externa conectada (YouTube hoje; Instagram, TikTok depois). Tokens ficam aqui, no nosso banco.
CREATE TABLE IF NOT EXISTS conexao (
  id             TEXT PRIMARY KEY,
  empresa_id     TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  provedor       TEXT NOT NULL,                   -- youtube | instagram | tiktok
  conta_nome     TEXT NOT NULL DEFAULT '',        -- nome do canal / perfil
  conta_id       TEXT NOT NULL DEFAULT '',
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL DEFAULT '',
  expira_em      TIMESTAMPTZ,
  escopo         TEXT NOT NULL DEFAULT '',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, provedor)
);

-- Arquivo enviado pelo dono (vídeo, imagem). Por enquanto fica no disco do servidor; depois vai pra um bucket.
CREATE TABLE IF NOT EXISTS arquivo (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  tamanho    BIGINT NOT NULL,
  caminho    TEXT NOT NULL,                       -- caminho local (ou URL do bucket no futuro)
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A tabela 'tarefa' do esquema inicial nunca foi usada (era um esboço pra Fase 3); recriada aqui com o formato definitivo.
DROP TABLE IF EXISTS tarefa;

-- Tarefa dada a um agente. dados = entrada (título, legenda, plataformas...), plano = o que o agente propôs,
-- resultado = o que saiu (links, erros). status: planejando | aguardando_aprovacao | executando | concluida | falhou | cancelada
CREATE TABLE tarefa (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  agente_id     TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,                    -- publicar_video
  status        TEXT NOT NULL DEFAULT 'planejando',
  titulo        TEXT NOT NULL DEFAULT '',
  dados         JSONB NOT NULL DEFAULT '{}'::jsonb,
  plano         JSONB,
  resultado     JSONB,
  erro          TEXT,
  criado_por    TEXT NOT NULL DEFAULT 'admin',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tarefa_agente_idx ON tarefa(agente_id, criado_em DESC);
