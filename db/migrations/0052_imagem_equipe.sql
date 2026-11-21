-- Imagens da equipe do cliente (21/11/2026): o dono pede uma imagem na conversa da Minha equipe, vê o custo em unidades
-- de IA, confirma e quem tem imagem no cargo (designer, social media) gera. Cada pedido fica aqui, do cartão com o custo
-- até a entrega. A imagem fica no banco (WebP), como a logomarca e as fotos da vitrine: /app/uploads é apagado a cada
-- publicação. Só aditiva: tabela nova, nada muda nas que existem.
CREATE TABLE IF NOT EXISTS imagem_equipe (
  id                TEXT PRIMARY KEY,
  empresa_id        TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  usuario_id        TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, -- quem pediu (titular ou sócio)
  pedido_agente_id  TEXT NOT NULL REFERENCES agente(id) ON DELETE CASCADE,  -- com quem o dono falou (o CEO que passou ou o próprio designer)
  agente_id         TEXT REFERENCES agente(id) ON DELETE CASCADE,           -- quem gera (nulo: a empresa não tem ninguém de imagem)
  dono_mensagem_id  TEXT,          -- a mensagem do dono com o pedido
  mensagem_id       TEXT,          -- a resposta com o cartão do custo
  entrega_id        TEXT,          -- a mensagem da entrega, com a imagem
  conversa_interna_id TEXT,        -- quando outra pessoa passou o pedido ao designer
  pedido            TEXT NOT NULL,
  prompt            TEXT NOT NULL DEFAULT '',
  formato           TEXT NOT NULL DEFAULT 'quadrado',  -- quadrado | vertical | horizontal (src/server/imagens.ts)
  ref_logo          BOOLEAN NOT NULL DEFAULT false,
  ref_produto       TEXT,          -- produto da vitrine usado como referência
  status            TEXT NOT NULL DEFAULT 'proposta',  -- proposta | gerando | pronta | falhou | cancelada | sem_designer
  unidades          INTEGER NOT NULL DEFAULT 0,        -- o custo mostrado ao dono (o mesmo que sai da carteira)
  custo_brl         NUMERIC(10,4) NOT NULL DEFAULT 0,
  dados             BYTEA,
  mime              TEXT,
  largura           INTEGER,
  altura            INTEGER,
  tamanho           INTEGER,
  produto_vitrine   TEXT,          -- produto da vitrine que passou a usar esta imagem como foto
  erro              TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  gerada_em         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS imagem_equipe_empresa_idx ON imagem_equipe (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS imagem_equipe_pedido_agente_idx ON imagem_equipe (pedido_agente_id, criado_em DESC);
