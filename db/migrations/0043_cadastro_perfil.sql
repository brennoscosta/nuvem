-- Perfil de cadastro (20/11/2026, frente "cadastro"): logo depois de criar a conta a pessoa conta ao WorkEnd o que quer
-- mostrar e o que quer encontrar. Vira o perfil público em /perfil/<apelido>, entra na busca (/encontrar, aba Perfis,
-- casando "oferece" com "procura") e na lista de cadastros do admin (com exportação em CSV).
-- As etapas respondidas ficam em "etapas": o painel lembra as que faltam. Foto no banco (até 200 KB, reduzida no navegador).
CREATE TABLE IF NOT EXISTS perfil_cadastro (
  usuario_id     TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  apelido        TEXT UNIQUE,                       -- endereço do perfil público: /perfil/<apelido>
  objetivo       TEXT CHECK (objetivo IN ('mostrar', 'encontrar', 'ambos')),
  tipo           TEXT CHECK (tipo IN ('empresa', 'autonomo', 'loja_online', 'criador', 'prestador', 'outro')),
  nome           TEXT NOT NULL DEFAULT '',          -- nome do negócio ou nome profissional
  nichos         TEXT[] NOT NULL DEFAULT '{}',      -- ids em NICHOS (src/office/data/mundo.ts)
  cidade         TEXT NOT NULL DEFAULT '',
  uf             TEXT NOT NULL DEFAULT '',
  atendimento    TEXT CHECK (atendimento IN ('online', 'presencial', 'ambos')),
  oferece        TEXT[] NOT NULL DEFAULT '{}',      -- etiquetas: produtos e serviços
  oferece_texto  TEXT NOT NULL DEFAULT '',
  procura        TEXT[] NOT NULL DEFAULT '{}',      -- etiquetas: o que quer encontrar
  procura_texto  TEXT NOT NULL DEFAULT '',
  site           TEXT NOT NULL DEFAULT '',
  instagram      TEXT NOT NULL DEFAULT '',
  whatsapp       TEXT NOT NULL DEFAULT '',          -- só dígitos (DDD + número)
  foto           BYTEA,
  foto_tipo      TEXT,
  publico        BOOLEAN NOT NULL DEFAULT TRUE,     -- tem perfil público e aparece na busca
  -- o que mais aparece no perfil público; WhatsApp e e-mail só se a pessoa quiser
  mostrar        JSONB NOT NULL DEFAULT '{"procura": true, "cidade": true, "links": true, "cidade3d": true, "whatsapp": false, "email": false}'::jsonb,
  busca          TEXT NOT NULL DEFAULT '',          -- texto sem acento e em minúsculas para a busca (montado no servidor)
  etapas         TEXT[] NOT NULL DEFAULT '{}',      -- etapas do formulário já respondidas
  pulou_em       TIMESTAMPTZ,                       -- deixou o formulário para depois
  concluido_em   TIMESTAMPTZ,                       -- respondeu todas as etapas
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS perfil_cadastro_criado_idx ON perfil_cadastro (criado_em DESC);
CREATE INDEX IF NOT EXISTS perfil_cadastro_publico_idx ON perfil_cadastro (atualizado_em DESC) WHERE publico;
