-- WE-18 (22/11/2026): atendente de IA no WhatsApp do lojista (src/server/whatsapp.ts). Só acrescenta tabelas novas; nada
-- é apagado nem muda de valor. Sem as variáveis de ambiente (WHATSAPP_CHAVE e as da Meta) nenhuma linha nasce aqui.
-- O número de quem escreve nunca fica aberto: vai cifrado (para responder), com um HMAC (para achar a mesma pessoa) e
-- com uma máscara para o dono ler. O id da Meta das mensagens (wamid) carrega o número, então também só entra o hash.

-- 1) a conexão do número da loja com a WhatsApp Business Platform (Cloud API): uma por empresa
CREATE TABLE IF NOT EXISTS whatsapp_conexao (
  empresa_id          TEXT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
  conectado_por       TEXT REFERENCES usuario(id) ON DELETE SET NULL, -- dono ou sócio que conectou
  terreno_chave       TEXT NOT NULL,                  -- a loja que atende (o número dela no mapa sai daqui)
  via                 TEXT NOT NULL CHECK (via IN ('manual', 'cadastro')),
  phone_number_id     TEXT NOT NULL UNIQUE,
  waba_id             TEXT NOT NULL,
  token_cifrado       TEXT NOT NULL,                  -- token permanente, cifrado com WHATSAPP_CHAVE (AES-256-GCM)
  segredo_app_cifrado TEXT,                           -- via manual com o aplicativo do próprio lojista: a chave secreta dele
  verificacao_hash    TEXT,                           -- token de verificação do webhook desse aplicativo (sha-256)
  verificacao_cifrada TEXT,                           -- o mesmo, cifrado, para o painel mostrar ao dono
  numero_exibido      TEXT NOT NULL DEFAULT '',       -- o número público da própria loja (display_phone_number)
  nome_verificado     TEXT NOT NULL DEFAULT '',
  inscrito            BOOLEAN NOT NULL DEFAULT false, -- o aplicativo ficou inscrito no WABA (subscribed_apps)
  modelo_nome         TEXT,                           -- modelo aprovado na Meta, para fora da janela de 24 h
  modelo_idioma       TEXT,
  modelo_categoria    TEXT,                           -- utilidade | marketing | autenticacao (o custo da Meta)
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_conexao_verificacao_idx ON whatsapp_conexao (verificacao_hash) WHERE verificacao_hash IS NOT NULL;

-- 2) quem escreveu para a loja pelo WhatsApp. O id é o código de visitante sem conta (anon_wa_...), o mesmo que vai em
--    mensagem.visitante_anonimo, com a conversa em nome da conta técnica "Visitante sem conta" (0057)
CREATE TABLE IF NOT EXISTS whatsapp_contato (
  id                TEXT PRIMARY KEY,
  empresa_id        TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  numero_hash       TEXT NOT NULL,    -- HMAC do número com a empresa: a mesma pessoa em outra loja tem outro código
  numero_cifrado    TEXT NOT NULL,    -- só para responder
  numero_mascara    TEXT NOT NULL,    -- o que o dono lê: +55 (79) •••••-1234
  ultima_do_cliente TIMESTAMPTZ,      -- a última mensagem dele abre a janela de 24 h da Meta
  humano_ate        TIMESTAMPTZ,      -- com uma pessoa até aqui: a IA não responde nesta conversa
  humano_por        TEXT,             -- cliente (pediu atendente) | dono (assumiu no painel)
  aviso_janela_em   TIMESTAMPTZ,      -- último aviso ao dono de conversa fora da janela sem modelo
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero_hash)
);
CREATE INDEX IF NOT EXISTS whatsapp_contato_empresa_idx ON whatsapp_contato (empresa_id, atualizado_em DESC);

-- 3) mensagens recebidas já vistas: a Meta reenvia o mesmo webhook quando demora; o hash do wamid segura a repetição
CREATE TABLE IF NOT EXISTS whatsapp_recebida (
  wamid_hash  TEXT PRIMARY KEY,
  empresa_id  TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  contato_id  TEXT REFERENCES whatsapp_contato(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'recebida', -- recebida | respondida | sem_resposta | erro
  recebida_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) o que saiu pela Cloud API (resposta da IA, do dono, do transbordo ou modelo), com a situação que a Meta devolve e o
--    custo da Meta que foi descontado das unidades de IA (ia_lancamento, categoria whatsapp)
CREATE TABLE IF NOT EXISTS whatsapp_envio (
  wamid_hash    TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  contato_id    TEXT REFERENCES whatsapp_contato(id) ON DELETE CASCADE,
  mensagem_id   TEXT,
  quem          TEXT NOT NULL, -- ia | dono | transbordo | aviso | modelo
  tipo          TEXT NOT NULL, -- texto | modelo
  categoria     TEXT NOT NULL, -- servico | utilidade | marketing | autenticacao
  custo_brl     NUMERIC(10,4) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'enviada', -- enviada | entregue | lida | falhou
  erro          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_envio_contato_idx ON whatsapp_envio (contato_id, criado_em DESC);
