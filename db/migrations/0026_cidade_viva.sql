-- Cidade viva (12/11/2026): vagas ("Estamos contratando"), missões de visitante, praça de eventos, feira de sábado,
-- roupas e acessórios do personagem e lote duplo. Só acrescenta tabelas e colunas.

-- vagas abertas pelas empresas e candidaturas de quem procura trabalho
CREATE TABLE IF NOT EXISTS vaga (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT 'presencial',
  local TEXT NOT NULL DEFAULT '',
  salario TEXT NOT NULL DEFAULT '',
  aberta BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vaga_usuario_idx ON vaga (usuario_id, aberta);
CREATE TABLE IF NOT EXISTS candidatura (
  id TEXT PRIMARY KEY,
  vaga_id TEXT NOT NULL REFERENCES vaga(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vaga_id, usuario_id)
);

-- lojas visitadas (missão "Explorador")
CREATE TABLE IF NOT EXISTS visita_loja (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  terreno_chave TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, terreno_chave)
);

-- eventos no palco da praça
CREATE TABLE IF NOT EXISTS evento_praca (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  terreno_chave TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  cancelado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evento_praca_inicio_idx ON evento_praca (inicio) WHERE NOT cancelado;

-- barracas da feira de sábado (6 vagas por sábado)
CREATE TABLE IF NOT EXISTS barraca (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  vaga SMALLINT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT '#E2575B',
  tipo TEXT NOT NULL DEFAULT 'artesanato',
  contato JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'reservada',
  reservado_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dia, vaga)
);

-- roupas e acessórios: o que cada um comprou e o que está usando
CREATE TABLE IF NOT EXISTS item_comprado (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, item)
);
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS acessorios JSONB NOT NULL DEFAULT '[]'::jsonb;

-- lote duplo: o lote vizinho alugado como anexo do lote principal (mesmo dono)
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS anexo_de TEXT;
