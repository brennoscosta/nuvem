// Converte os renders ao entardecer (PNG do estúdio) para os WebP da página inicial
import sharp from "sharp";
const O = "/root/workend-arte/render", D = "/root/workend-work/public/workend/render";
for (const w of [2400, 1600, 1000]) await sharp(`${O}/hero.png`).resize({ width: w }).webp({ quality: w > 1600 ? 74 : 78 }).toFile(`${D}/hero-${w}.webp`);
for (const w of [2000, 1600, 1000]) await sharp(`${O}/dollhouse.png`).resize({ width: w }).webp({ quality: 78 }).toFile(`${D}/dollhouse-${w}.webp`);
for (const id of ["vidro", "moderno", "sobrado", "loja", "galpao", "container"]) await sharp(`${O}/predio-${id}.png`).webp({ quality: 80 }).toFile(`${D}/predio-${id}.webp`);
console.log("ok");
