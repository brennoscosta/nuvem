-- 08/11/2026: pra quem olha de fora ver o personagem andando fluido, a presença guarda também pra onde ele está indo
-- e em que velocidade (os outros navegadores continuam o movimento entre uma batida e outra).
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS dest_x REAL;
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS dest_z REAL;
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS vel REAL NOT NULL DEFAULT 0;
