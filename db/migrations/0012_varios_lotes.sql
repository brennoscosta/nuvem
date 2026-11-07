-- 07/11/2026: a trava de "um lote por conta" sai do banco e fica só no código (reservarTerreno): o admin pode ter
-- vários lotes (testes) e em breve qualquer empresa vai poder comprar os lotes do lado e emendar.
DROP INDEX IF EXISTS terreno_usuario_unico;
CREATE INDEX IF NOT EXISTS terreno_usuario_idx ON terreno (usuario_id);
