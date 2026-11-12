-- Outdoors nas avenidas da borda do mapa (12/11/2026). Cada vaga (slot) é alugada por uma empresa com lote ativo,
-- por 30 dias no Pix. O anúncio é montado com a marca da empresa (nome, cor, logo, área) e uma frase curta.
CREATE TABLE IF NOT EXISTS outdoor (
  slot TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES usuario(id) ON DELETE SET NULL,
  terreno_chave TEXT,
  frase TEXT NOT NULL DEFAULT '',
  reservado_ate TIMESTAMPTZ,
  pago_ate TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
