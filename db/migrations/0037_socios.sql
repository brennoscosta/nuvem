-- Sócios de um lote (17/11/2026, pedido do dono: as sedes do bday.fm, da AppZone e do NUVCAM são "divididas entre Layon
-- e Breno"). Quem está aqui tem o mesmo acesso do titular à equipe de IA, às conversas internas e aos conectores da
-- empresa (src/server/equipeCliente.ts › loteDoDono). O titular continua em usuario_id.
ALTER TABLE terreno ADD COLUMN IF NOT EXISTS socios text[] NOT NULL DEFAULT '{}';
