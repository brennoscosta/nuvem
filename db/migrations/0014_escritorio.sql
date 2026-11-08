-- 07/11/2026: o escritório do cliente (layout, setores, equipe) fica em JSON no próprio terreno.
-- Nasce quando o lote é ativado (pagamento) com atendente + CEO; o dono edita no painel "Montar escritório".
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS escritorio JSONB;
