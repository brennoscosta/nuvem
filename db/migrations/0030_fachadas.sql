-- Prédios e fachadas (12/11/2026, lote visual): quando o lote foi inaugurado (passou de reservado para ativo pela
-- primeira vez). A cena faz o prédio subir e mostra 24 h de festa (arco de balões, faixa e fogos). Renovação não muda.
-- Os lotes que já estavam ativos ficam sem data (sem festa).
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS inaugurado_em TIMESTAMPTZ;
