import sharp from "sharp";
const M = "/root/workend-work/public/workend/marca";
// logotipo para e-mail: 2× a altura usada no e-mail (30 px → 60 px), tinta sobre transparente
await sharp(`${M}/workend-logotipo.svg`, { density: 600 }).resize({ height: 60 }).png().toFile(`${M}/workend-logotipo-email.png`);
// ícones a partir do favicon (o W)
for (const s of [32, 180, 192, 512]) await sharp(`${M}/workend-favicon.svg`, { density: 1200 }).resize(s, s).png().toFile(`${M}/workend-icone-${s}.png`);
console.log("ok");
