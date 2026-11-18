-- Pedidos pela atendente (17/11/2026, complemento da 0038, que fica como está):
-- 1) o cupom ganha um desconto em número, para a atendente aplicar no total do pedido. Até aqui o cupom era só texto
--    ("10% no pão") e o dono conferia no balcão. Sem número, o cupom continua só de balcão.
ALTER TABLE cupom ADD COLUMN IF NOT EXISTS desconto_pct INTEGER;       -- 1 a 90 (% sobre o subtotal do pedido)
ALTER TABLE cupom ADD COLUMN IF NOT EXISTS desconto_centavos INTEGER;  -- ou um valor fixo, em centavos
ALTER TABLE cupom ADD COLUMN IF NOT EXISTS minimo_centavos INTEGER;    -- pedido mínimo para valer (opcional)
-- 2) o código usado num pedido fica preso a ele; se o pedido for cancelado, o código volta a valer
ALTER TABLE cupom_resgate ADD COLUMN IF NOT EXISTS pedido_id TEXT;
-- 3) quem cancelou (cliente ou dono), para o cartão do pedido e a página de Vendas
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS cancelado_por TEXT;
CREATE INDEX IF NOT EXISTS pedido_cliente_idx ON pedido (cliente_usuario_id, usuario_id, status);
CREATE INDEX IF NOT EXISTS pedido_conversa_idx ON pedido (conversa);
