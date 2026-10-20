-- Fala pública do agente: frase curta e subjetiva que visitantes (sem login) veem
ALTER TABLE agente ADD COLUMN IF NOT EXISTS fala_publica TEXT NOT NULL DEFAULT '';
ALTER TABLE agente ADD COLUMN IF NOT EXISTS fala_publica_em TIMESTAMPTZ;
