-- Seguir loja e avisos no celular (13/11/2026): quem segue uma loja recebe no sino a promoção, o evento e o produto novo;
-- os avisos do sino também chegam no aparelho (web push, sem conteúdo: o celular busca o aviso no servidor).

-- quem segue qual loja (a loja é da conta do dono)
CREATE TABLE IF NOT EXISTS seguidor (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dono_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, dono_id)
);
CREATE INDEX IF NOT EXISTS seguidor_dono_idx ON seguidor (dono_id);

-- último aviso de promoção ou produto mandado aos seguidores de uma loja (no máximo 1 a cada 6 h por tipo)
CREATE TABLE IF NOT EXISTS seguidor_envio (
  dono_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dono_id, tipo)
);

-- inscrições de push de cada aparelho
CREATE TABLE IF NOT EXISTS push_inscricao (
  endpoint TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  aparelho TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_ok TIMESTAMPTZ,
  falhas INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_inscricao_usuario_idx ON push_inscricao (usuario_id);
