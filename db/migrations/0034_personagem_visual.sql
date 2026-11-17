-- 16/11/2026: personagem personalizável (pele, cabelo e penteado, barba, óculos, tipo e cor da roupa, calça e tênis).
-- O visual fica aqui em JSON (fonte do painel "Meu personagem"); a coluna boneco recebe o mesmo visual codificado
-- (v1:…), que é o que o mapa, a rede, a busca e as conversas já leem. '{}' = usa o boneco do tipo escolhido.
ALTER TABLE personagem ADD COLUMN IF NOT EXISTS visual JSONB NOT NULL DEFAULT '{}'::jsonb;
