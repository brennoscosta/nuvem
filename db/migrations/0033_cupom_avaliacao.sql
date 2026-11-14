-- Negócios 2 (13/11/2026): cupons da loja, avaliação do atendimento da agenda e loja destaque da semana. Só acrescenta.

-- cupons criados pelo dono (até 3 ativos) e os códigos que cada visitante pegou
CREATE TABLE IF NOT EXISTS cupom (
  id TEXT PRIMARY KEY,
  dono_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  regra TEXT NOT NULL DEFAULT '',
  validade DATE NOT NULL,
  limite INT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cupom_dono_idx ON cupom (dono_id, ativo);
CREATE TABLE IF NOT EXISTS cupom_resgate (
  id TEXT PRIMARY KEY,
  cupom_id TEXT NOT NULL REFERENCES cupom(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_em TIMESTAMPTZ,
  UNIQUE (cupom_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS cupom_resgate_usuario_idx ON cupom_resgate (usuario_id, criado_em DESC);

-- avaliação do atendimento da agenda: entra na mesma tabela das negociações, então já conta na nota da loja.
-- Uma por agendamento; negociacao_id fica vazio nesses casos.
ALTER TABLE avaliacao ALTER COLUMN negociacao_id DROP NOT NULL;
ALTER TABLE avaliacao ADD COLUMN IF NOT EXISTS agendamento_id TEXT REFERENCES agendamento(id) ON DELETE CASCADE;
ALTER TABLE avaliacao ADD COLUMN IF NOT EXISTS servico TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS avaliacao_agendamento_idx ON avaliacao (agendamento_id) WHERE agendamento_id IS NOT NULL;

-- loja destaque de cada semana (segunda a domingo): calculada na segunda e guardada para o aviso sair uma vez só
CREATE TABLE IF NOT EXISTS destaque_semana (
  semana DATE PRIMARY KEY,
  dono_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  terreno_chave TEXT NOT NULL,
  visitas INT NOT NULL,
  conversas INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
