-- Excluir minha conta (21/11/2026, LGPD art. 18): o titular apaga a própria conta em Meu perfil (src/server/exclusao.ts).
-- Só acrescenta: uma tabela, uma coluna, a conta técnica que guarda os pagamentos e uma exceção estreita na trava dos
-- extratos. Nada é apagado nem muda de valor aqui.

-- 1) Registro mínimo de cada exclusão, para provar que ela foi feita. Sem dado pessoal: o id antigo vira hash
--    (sha256 de "exclusao:<id>"), mais a data, o motivo e as contagens do que foi apagado e anonimizado.
CREATE TABLE IF NOT EXISTS conta_excluida (
  titular_hash TEXT PRIMARY KEY,
  excluida_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo       TEXT NOT NULL DEFAULT 'pedido do titular',
  resumo       JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2) Os pagamentos ficam guardados (obrigação fiscal e contábil), sem identificar a pessoa. pagamento.usuario_id não
--    aceita vazio e apaga junto com a conta (ON DELETE CASCADE): por isso os pagamentos de quem excluiu a conta passam
--    para esta conta técnica, que não entra (sem senha, suspensa e com um e-mail que não existe). titular_excluido
--    guarda o mesmo código anônimo dos extratos ("exc_" + começo do hash) para juntar os registros de uma mesma conta.
INSERT INTO usuario (id, email, nome, empresa_nome, senha_hash, banido_em, banido_motivo)
VALUES ('usr_contas_excluidas', 'contas-excluidas@workend.invalid', 'Contas excluídas', '', 'desativada', now(),
  'Conta técnica: guarda, sem dado pessoal, os pagamentos das contas excluídas a pedido do titular. Não entra no site.')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE pagamento ADD COLUMN IF NOT EXISTS titular_excluido TEXT;
CREATE INDEX IF NOT EXISTS pagamento_titular_excluido_idx ON pagamento (titular_excluido) WHERE titular_excluido IS NOT NULL;

-- 3) Os extratos de créditos e de unidades de IA (0042) continuam imutáveis: ninguém apaga nem muda valor, saldo, tipo
--    ou data. A única exceção é a exclusão de conta, que liga workend.anonimizar só dentro da própria transação
--    (set_config local) e troca apenas a identificação: titular, empresa, agente, descrição e chave.
CREATE OR REPLACE FUNCTION workend_extrato_imutavel() RETURNS trigger AS $$
DECLARE
  ident CONSTANT text[] := ARRAY['usuario_id', 'empresa_id', 'agente_id', 'descricao', 'chave'];
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('workend.anonimizar', true) = 'sim'
     AND (to_jsonb(NEW) - ident) = (to_jsonb(OLD) - ident) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Extrato imutável: lance um ajuste ou estorno em vez de alterar ou apagar (%).', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;
