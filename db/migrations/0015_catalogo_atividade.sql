-- 08/11/2026: (1) agentes que o WorkEnd vende — o admin cria e treina (skills, APIs ligadas, preço); o dono da loja
-- contrata do catálogo. (2) atividade do mundo — tudo que acontece (cadastro, compra, escritório, contratação…) fica
-- registrado pro admin ver e pro dono da loja receber por e-mail. (3) pagamento ganha tipo (lote | layout).
CREATE TABLE IF NOT EXISTS agente_catalogo (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  cargo         TEXT NOT NULL,
  setor         TEXT NOT NULL,               -- setor sugerido (vai pro setor de mesmo nome se houver vaga)
  descricao     TEXT NOT NULL DEFAULT '',    -- treino: o que sabe e faz
  saudacao      TEXT NOT NULL DEFAULT '',
  skills        JSONB NOT NULL DEFAULT '[]', -- lista de habilidades (texto curto)
  apis          JSONB NOT NULL DEFAULT '[]', -- integrações: chatgpt_texto, chatgpt_imagem, landing_page, email, agenda, whatsapp…
  preco         NUMERIC(10,2) NOT NULL DEFAULT 0, -- R$/mês (0 = incluso no plano)
  boneco        TEXT NOT NULL DEFAULT 'classico',
  camisa        TEXT NOT NULL DEFAULT '#1D4ED8',
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  ordem         INT NOT NULL DEFAULT 0,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- (a tabela "evento" já existe: é a dos eventos do escritório da Nuvem; a do mundo chama "atividade")
DROP INDEX IF EXISTS evento_criado_idx;
CREATE TABLE IF NOT EXISTS atividade (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL,     -- cadastro | reserva | pagamento | escritorio | contratacao | layout | contato | admin
  usuario_id    TEXT REFERENCES usuario(id) ON DELETE SET NULL,
  terreno_chave TEXT,
  titulo        TEXT NOT NULL,
  dados         JSONB,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atividade_criado_idx ON atividade (criado_em DESC);
CREATE INDEX IF NOT EXISTS atividade_usuario_idx ON atividade (usuario_id);
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'lote';
