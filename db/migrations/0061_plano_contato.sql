-- WE-19 (22/11/2026): contatos da página de planos. "Fale com a gente" da Sede (sob consulta) e o interesse no Equipe
-- enquanto a cobrança dele não existe. Só acrescenta uma tabela nova: nada é apagado nem muda de valor.
CREATE TABLE IF NOT EXISTS plano_contato (
  id TEXT PRIMARY KEY,
  plano TEXT NOT NULL CHECK (plano IN ('sede', 'equipe')),
  nome TEXT NOT NULL,
  empresa TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  usuario_id TEXT REFERENCES usuario(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_contato_criado_idx ON plano_contato (criado_em DESC);
