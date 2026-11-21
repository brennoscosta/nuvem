-- Plano Vitrine grátis (WE-13, 21/11/2026; decisão do dono: grátis e SEM quiosque). Só acrescenta.
-- 1) A página grátis da conta (src/server/planoVitrine.ts): a marca e a atendente enquanto a conta não tem lote nem quiosque.
--    A empresa é a mesma da conta (empresa.id = emp_<usuário>), então o endereço (loja_endereco), a vitrine (produto), o
--    "Sobre" e os contatos já são da conta e vão junto quando a loja for para a cidade. O número (a partir de 10001, nunca
--    bate com lote, quiosque nem sede) deixa a página usar as mesmas rotas da loja; o endereço público é só o slug.
CREATE SEQUENCE IF NOT EXISTS loja_vitrine_numero_seq START 10001;
CREATE TABLE IF NOT EXISTS loja_vitrine (
  usuario_id    TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  empresa_id    TEXT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL UNIQUE DEFAULT nextval('loja_vitrine_numero_seq'),
  empresa_nome  TEXT NOT NULL,
  cor           TEXT NOT NULL DEFAULT '#1D4ED8',
  nicho         TEXT NOT NULL DEFAULT 'negocios',
  logo          BYTEA,
  logo_tipo     TEXT,
  escritorio    JSONB,                       -- só a atendente, como no quiosque (data/quiosques.ts › equipeDoQuiosque)
  publicada_em  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loja_vitrine_empresa_idx ON loja_vitrine (empresa_id);
-- 2) Unidades de IA: de onde veio a mensalidade do mês. 'vitrine' = a da página grátis; quando a conta abre um lote ou
--    quiosque no mesmo mês, entra só a diferença para a mensalidade da loja (src/server/unidadesIA.ts › travarIA).
ALTER TABLE ia_carteira ADD COLUMN IF NOT EXISTS plano_mes TEXT;
