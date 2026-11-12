-- Resultados, avisos, ofertas e promoção (12/11/2026): painel de resultados do lote, central de avisos (sino), oferta de
-- entrada (fundador e feira), indicação com desconto e promoção na fachada. Só acrescenta tabelas e colunas.

-- visitas por dia (painel de resultados). visitante = id do usuário ou "a:<hash>" de quem não entrou na conta.
-- dono_id guarda de quem era a loja no dia: o painel continua certo se o dono trocar de lote.
CREATE TABLE IF NOT EXISTS visita_dia (
  terreno_chave TEXT NOT NULL,
  dono_id TEXT NOT NULL,
  dia DATE NOT NULL,
  visitante TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'mapa', -- mapa | pagina
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (terreno_chave, dia, visitante)
);
CREATE INDEX IF NOT EXISTS visita_dia_dono_idx ON visita_dia (dono_id, dia);

-- cliques que levam o visitante para fora (WhatsApp, Instagram, site, produto da vitrine)
CREATE TABLE IF NOT EXISTS clique_loja (
  id BIGSERIAL PRIMARY KEY,
  dono_id TEXT NOT NULL,
  terreno_chave TEXT,
  tipo TEXT NOT NULL, -- whatsapp | instagram | site | email | produto
  ref TEXT, -- id do produto, quando for da vitrine
  visitante TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clique_loja_dono_idx ON clique_loja (dono_id, criado_em);

-- central de avisos (sino). ref evita repetir o mesmo aviso (ex.: uma conversa vira um aviso só, que volta a ficar
-- não lido a cada mensagem nova).
CREATE TABLE IF NOT EXISTS aviso (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL,
  lido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, ref)
);
CREATE INDEX IF NOT EXISTS aviso_usuario_idx ON aviso (usuario_id, criado_em DESC);

-- "Me avise" de um evento da praça (o aviso sai 10 minutos antes)
CREATE TABLE IF NOT EXISTS evento_lembrete (
  evento_id TEXT NOT NULL REFERENCES evento_praca(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, usuario_id)
);

-- promoção na fachada: { texto, ate, desde }
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS promocao JSONB;

-- oferta de entrada e indicação
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS codigo_indicacao TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS usuario_codigo_indicacao_idx ON usuario (codigo_indicacao) WHERE codigo_indicacao IS NOT NULL;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS oferta TEXT; -- fundador | feira | indicado
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0; -- quanto a oferta tirou do preço
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS credito_usado NUMERIC(10,2) NOT NULL DEFAULT 0; -- crédito de indicação usado
CREATE TABLE IF NOT EXISTS indicacao (
  indicado_id TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  indicador_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | liberada | estornada
  credito NUMERIC(10,2) NOT NULL DEFAULT 0,
  pagamento_id TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  liberada_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS indicacao_indicador_idx ON indicacao (indicador_id);
