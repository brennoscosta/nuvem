-- Vendas confirmadas por período (17/11/2026, painel "Quanto a sua equipe trouxe" em /app/resultados): a soma é pela data
-- do pagamento (pago_em), então o índice por dono + pago_em deixa a consulta ler só o período, sem passar por todos os
-- pedidos pagos da loja. Só entram as linhas já pagas (pago_em preenchido). Não muda a tabela pedido (0038).
CREATE INDEX IF NOT EXISTS pedido_pago_idx ON pedido (usuario_id, pago_em) WHERE pago_em IS NOT NULL;
