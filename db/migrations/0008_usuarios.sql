-- Usuários do WorkEnd (donos de escritório). Cadastro e-mail + senha (scrypt). Sem verificação de e-mail por enquanto.
CREATE TABLE IF NOT EXISTS usuario (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,              -- sempre minúsculo
  nome          TEXT NOT NULL,
  empresa_nome  TEXT NOT NULL DEFAULT '',
  senha_hash    TEXT NOT NULL,                     -- scrypt: salt.hash (base64url)
  interesse_em  TIMESTAMPTZ,                       -- clicou em "me avise quando der pra comprar"
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acesso TIMESTAMPTZ
);
