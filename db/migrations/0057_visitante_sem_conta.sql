-- WE-14 (21/11/2026): visitante sem conta fala com a recepção da loja (src/server/visitanteAnonimo.ts).
-- Só acrescenta: uma coluna, um índice e a conta técnica. Nada é apagado nem muda de valor aqui.

-- 1) mensagem.visitante_id aponta para usuario(id) (0023) e o visitante sem conta não tem conta. As conversas dele ficam
--    em nome desta conta técnica, que não entra (sem senha, suspensa e com um e-mail que não existe), como a de
--    "Contas excluídas" (0053). Assim tudo o que já separa "conversa do dono" (visitante_id nulo) de "conversa de
--    visitante" continua certo, e o dono lê o nome "Visitante sem conta" na lista de visitantes.
INSERT INTO usuario (id, email, nome, empresa_nome, senha_hash, banido_em, banido_motivo)
VALUES ('usr_visitante_sem_conta', 'visitante-sem-conta@workend.invalid', 'Visitante sem conta', '', 'desativada', now(),
  'Conta técnica: guarda as conversas de quem fala com a recepção de uma loja sem ter conta. Não entra no site.')
ON CONFLICT (id) DO NOTHING;

-- 2) qual visitante sem conta é: o código aleatório do cookie assinado (anon_...), sem dado pessoal. Nulo nas conversas
--    de quem tem conta e nas do dono.
ALTER TABLE mensagem ADD COLUMN IF NOT EXISTS visitante_anonimo TEXT;
CREATE INDEX IF NOT EXISTS mensagem_anonimo_idx ON mensagem (agente_id, visitante_anonimo, criado_em) WHERE visitante_anonimo IS NOT NULL;
