-- 08/11/2026: personagem do visitante (quem entra pra consumir): anda pelo mundo com o nome num balãozinho, vê os
-- outros online e interage (conversa, chat ao vivo, negócios, troca de redes sociais). R$ 5,90/mês (de 19,90).
CREATE TABLE IF NOT EXISTS personagem (
  usuario_id    TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL,              -- id em TIPOS_AVATAR (gênero + estilo)
  boneco        TEXT NOT NULL,
  roupa         TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  redes         JSONB NOT NULL DEFAULT '{}', -- { instagram, linkedin, whatsapp, site }
  mostrar_redes BOOLEAN NOT NULL DEFAULT FALSE, -- redes visíveis pra todo mundo (senão só quem pedir e for aceito)
  pago_ate      TIMESTAMPTZ,                -- NULL = ainda não pagou (pode montar, não entra no mapa)
  x             REAL NOT NULL DEFAULT 0, z REAL NOT NULL DEFAULT 21.3, rot REAL NOT NULL DEFAULT 0,
  visto_em      TIMESTAMPTZ,                -- última presença (online = últimos 20 s)
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personagem_visto_idx ON personagem (visto_em DESC);
-- recados entre personagens (a tabela "mensagem" já é do chat dos agentes da Nuvem) (conversa, chat ao vivo, negócios, pedido de redes)
CREATE TABLE IF NOT EXISTS recado (
  id          TEXT PRIMARY KEY,
  de_id       TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  para_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'chat',  -- chat | negocio | redes_pedido | redes_aceite
  texto       TEXT NOT NULL,
  lida_em     TIMESTAMPTZ,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recado_par_idx ON recado (LEAST(de_id, para_id), GREATEST(de_id, para_id), criado_em);
CREATE INDEX IF NOT EXISTS recado_para_idx ON recado (para_id, lida_em);
