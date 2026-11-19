-- Moradores da cidade (19/11/2026): a memória de cada morador (src/office/data/moradores.ts) com cada pessoa e as
-- mensagens de cada conversa. A afinidade (-100 a 100) decide o tom: desconfiado, conhecido, simpático ou amigo.
CREATE TABLE IF NOT EXISTS morador_relacao (
  morador_id     TEXT NOT NULL,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  afinidade      INT NOT NULL DEFAULT 0 CHECK (afinidade BETWEEN -100 AND 100),
  conversas      INT NOT NULL DEFAULT 0,          -- quantas conversas já tiveram
  mensagens      INT NOT NULL DEFAULT 0,          -- quantas mensagens a pessoa já mandou
  primeira_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversa_em    TIMESTAMPTZ,                      -- começo da conversa atual
  resumo         TEXT NOT NULL DEFAULT '',         -- resumo da última conversa
  assunto        TEXT NOT NULL DEFAULT '',         -- último assunto ("a praia", "indicação de empresa")
  plano          TEXT NOT NULL DEFAULT '',         -- o que a pessoa disse que ia fazer ("abrir a sua loja")
  fatos          JSONB NOT NULL DEFAULT '{}'::jsonb, -- nome que quer ser chamada, empresa, trabalho, gostos
  humor          TEXT NOT NULL DEFAULT 'tranquilo', -- último humor do morador com a pessoa
  grosserias     INT NOT NULL DEFAULT 0,
  bloqueado_ate  TIMESTAMPTZ,                      -- depois de muita grosseria, ele se recusa a conversar até aqui
  pergunta       TEXT,                             -- o que o morador perguntou e espera resposta (nome, trabalho, gosto, plano)
  PRIMARY KEY (morador_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS morador_relacao_usuario_idx ON morador_relacao (usuario_id);

CREATE TABLE IF NOT EXISTS morador_mensagem (
  id          TEXT PRIMARY KEY,
  morador_id  TEXT NOT NULL,
  usuario_id  TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  conversa    INT NOT NULL,                        -- número da conversa (morador_relacao.conversas na hora)
  autor       TEXT NOT NULL CHECK (autor IN ('visitante', 'morador')),
  texto       TEXT NOT NULL,
  acao        TEXT,                                -- botão escolhido (cumprimentar, agora, cidade, indicacao, sobre_mim, despedir, desculpa)
  ia          BOOLEAN NOT NULL DEFAULT false,      -- a resposta veio da IA (senão, do roteiro)
  indicacao   JSONB,                               -- empresa indicada na resposta
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS morador_mensagem_idx ON morador_mensagem (morador_id, usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS morador_mensagem_ia_idx ON morador_mensagem (usuario_id, criado_em) WHERE ia;

-- custo de IA dos moradores: uso_ia exige um agente; os moradores usam um registro próprio, desligado (não aparece em
-- nenhum escritório), na empresa da Nuvem. O teto mensal soma uso_ia deste agente.
INSERT INTO empresa (id, slug, nome) VALUES ('emp_nuvem', 'nuvem', 'Nuvem') ON CONFLICT (id) DO NOTHING;
INSERT INTO agente (id, empresa_id, nome, area, nivel, funcao, descricao, modelo, ativo, teto_diario_brl)
VALUES ('ag_moradores', 'emp_nuvem', 'Moradores da cidade', 'atendimento', 'junior', 'Moradores do mapa do WorkEnd',
        'Registro de custo das conversas com os moradores da cidade (src/server/moradores.ts). Não é um funcionário.', 'gpt-4o-mini', false, 0)
ON CONFLICT (id) DO NOTHING;

-- 19/11/2026: o gpt-4.1-nano foi desativado pela OpenAI (404 model_not_found). Quem usava passa para o gpt-4o-mini, o
-- modelo barato que continua no ar e aceita os mesmos parâmetros.
UPDATE agente SET modelo = 'gpt-4o-mini', atualizado_em = now() WHERE modelo = 'gpt-4.1-nano';
UPDATE config_sistema SET valor = jsonb_set(valor, '{modelo}', '"gpt-4o-mini"'), atualizado_em = now() WHERE nome = 'evolucao' AND valor->>'modelo' = 'gpt-4.1-nano';
UPDATE config_sistema SET valor = jsonb_set(valor, '{modeloJuiz}', '"gpt-4o-mini"'), atualizado_em = now() WHERE nome = 'evolucao' AND valor->>'modeloJuiz' = 'gpt-4.1-nano';
