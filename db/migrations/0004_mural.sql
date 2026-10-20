-- Mural: o chat da fachada. Visitantes leem; quem está autenticado (hoje só o CEO/admin) escreve.
-- texto = conteúdo completo (só admin vê); publico = versão curta/subjetiva que visitantes veem.
CREATE TABLE IF NOT EXISTS mural (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresa(id),
  autor_tipo TEXT NOT NULL,            -- humano | agente | sistema
  autor_nome TEXT NOT NULL,
  agente_id TEXT REFERENCES agente(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  publico TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mural_empresa_criado ON mural (empresa_id, criado_em DESC);
