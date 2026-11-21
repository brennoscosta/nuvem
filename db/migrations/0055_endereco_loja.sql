-- Endereço próprio da loja (WE-11, 21/11/2026): workend.online/<slug>. Só acrescenta uma tabela.
-- O endereço é da EMPRESA (empresa.id, a mesma que guarda a equipe, as conversas e o "Sobre"), não do lote: trocar de
-- lote, voltar depois de vencer ou passar da página grátis para um lote mantém o endereço. Cada empresa tem uma linha
-- atual; as antigas (atual = false) continuam valendo e levam para a atual com redirecionamento permanente.
-- As sedes não entram aqui: o endereço delas é o id fixo (data/sedes.ts › id).
CREATE TABLE IF NOT EXISTS loja_endereco (
  slug        TEXT PRIMARY KEY,
  empresa_id  TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  atual       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS loja_endereco_atual_idx ON loja_endereco (empresa_id) WHERE atual;
