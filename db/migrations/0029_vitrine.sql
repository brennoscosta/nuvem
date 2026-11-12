-- Vitrine de produtos (12/11/2026): fotos e preços dentro da loja, com botão para o WhatsApp do dono. O WorkEnd não
-- intermedeia o dinheiro. A vitrine é da conta (como a equipe): aparece no lote principal ativo do dono.
-- A foto fica no banco (até 200 KB, já reduzida no navegador): /app/uploads não sobrevive a uma publicação.
CREATE TABLE IF NOT EXISTS produto (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco_centavos INTEGER, -- nulo = "sob consulta"
  descricao TEXT NOT NULL DEFAULT '',
  foto BYTEA,
  foto_tipo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS produto_usuario_idx ON produto (usuario_id, ordem);
