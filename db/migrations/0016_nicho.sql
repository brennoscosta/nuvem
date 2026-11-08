-- 08/11/2026: nicho da empresa (aparece no balão em cima do lote no lugar de "Empresa ativa")
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS nicho TEXT NOT NULL DEFAULT 'negocios';
