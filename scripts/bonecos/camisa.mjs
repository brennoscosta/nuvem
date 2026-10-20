// Pinta a camisa do boneco (cor do setor) e grava o logo no peito, direto no atlas de textura.
// Uso: node camisa.mjs <entrada.glb> <saida.glb> <corHex> <logoMask.pgm>
// Roda DEPOIS do rig.mjs com KEEP_TEX=1 (malha normalizada: altura 1, pés no y=0; textura original).
import {NodeIO} from '@gltf-transform/core';
import {execSync} from 'child_process';
import fs from 'fs';
const [,, inFile, outFile, cor, maskFile] = process.argv;
const io = new NodeIO(); const doc = await io.read(inFile); const root = doc.getRoot();
const prim = root.listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray(), NR = prim.getAttribute('NORMAL').getArray(), I = prim.getIndices().getArray();
const tex = root.listTextures()[0]; fs.writeFileSync('/tmp/c_in.img', Buffer.from(tex.getImage()));
const [TW, TH] = execSync('identify -format "%w %h" /tmp/c_in.img').toString().trim().split(' ').map(Number);
// --- logo (PGM P5) ---
const pgm = fs.readFileSync(maskFile); let off = 0; const tok = []; while (tok.length < 4) { let s = ''; while (pgm[off] === 0x20 || pgm[off] === 0x0a || pgm[off] === 0x0d) off++; while (!(pgm[off] === 0x20 || pgm[off] === 0x0a || pgm[off] === 0x0d)) s += String.fromCharCode(pgm[off++]); tok.push(s); } off++;
const MW = +tok[1], MH = +tok[2]; const M = pgm.subarray(off);
const logoAt = (u, v) => (u < 0 || u >= 1 || v < 0 || v >= 1) ? 0 : M[Math.floor(v * MH) * MW + Math.floor(u * MW)];
// --- posição do logo no peito (espaço do modelo) ---
const LW = +(process.env.LOGO_W || 0.15), LH = LW * MH / MW, LY = +(process.env.LOGO_Y || 0.44);
const lx0 = -LW / 2, ly0 = LY - LH / 2;
const SHIRT_Y0 = +(process.env.SHIRT_Y0 || 0.33), SHIRT_Y1 = +(process.env.SHIRT_Y1 || 0.66);
const edge = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
// Rasteriza triângulos no atlas. filtro(v[]) decide se o triângulo entra; pinta(x,y,w0,w1,w2,v[]) escreve.
function raster(filtro, pinta) {
  let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]]; if (!filtro(v)) continue; n++;
    const px = v.map(i => UV[2 * i] * TW), py = v.map(i => UV[2 * i + 1] * TH);
    const area = edge(px[0], py[0], px[1], py[1], px[2], py[2]); if (Math.abs(area) < 1e-6) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...px)) - 1), x1 = Math.min(TW - 1, Math.ceil(Math.max(...px)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...py)) - 1), y1 = Math.min(TH - 1, Math.ceil(Math.max(...py)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const w0 = edge(px[1], py[1], px[2], py[2], cx, cy) / area, w1 = edge(px[2], py[2], px[0], py[0], cx, cy) / area, w2 = 1 - w0 - w1;
      if (w0 < -0.08 || w1 < -0.08 || w2 < -0.08) continue;
      pinta(x, y, w0, w1, w2, v);
    }
  }
  return n;
}
// 1) máscara geométrica da camisa: triângulos na faixa de altura da camisa
const G = new Uint8Array(TW * TH);
const tGeo = raster(v => v.every(i => P[3 * i + 1] > SHIRT_Y0 && P[3 * i + 1] < SHIRT_Y1), (x, y) => { G[y * TW + x] = 255; });
// 2) decal do logo: frente do peito
const D = new Uint8Array(TW * TH);
const tLogo = raster(
  v => v.some(i => NR[3 * i + 2] > 0.15 && P[3 * i + 2] > -0.02 && Math.abs(P[3 * i]) < LW / 2 + 0.02 && P[3 * i + 1] > ly0 - 0.02 && P[3 * i + 1] < ly0 + LH + 0.02),
  (x, y, w0, w1, w2, v) => {
    const u = w0 * (P[3 * v[0]] - lx0) / LW + w1 * (P[3 * v[1]] - lx0) / LW + w2 * (P[3 * v[2]] - lx0) / LW;
    const vv = 1 - (w0 * (P[3 * v[0] + 1] - ly0) / LH + w1 * (P[3 * v[1] + 1] - ly0) / LH + w2 * (P[3 * v[2] + 1] - ly0) / LH);
    if (logoAt(u, vv) > 100) D[y * TW + x] = 255;
  });
const pgmOut = (name, A) => fs.writeFileSync(name, Buffer.concat([Buffer.from(`P5\n${TW} ${TH}\n255\n`), Buffer.from(A)]));
pgmOut('/tmp/geo.pgm', G); pgmOut('/tmp/decal.pgm', D);
// 3) máscara por cor (tom lavanda da camisa original) AND máscara geométrica
execSync(`convert /tmp/c_in.img -colorspace HSL -fx "(u.r>0.60 && u.r<0.84 && u.g>0.07 && u.b>0.25 && u.b<0.8) ? 1 : 0" -colorspace gray \\( /tmp/geo.pgm -morphology Dilate Diamond:1 \\) -compose Multiply -composite -morphology Close Diamond:1 -blur 0x0.5 /tmp/shirtmask.png`);
// 4) camisa na cor nova mantendo o sombreado; depois o logo em branco
execSync(`convert /tmp/c_in.img -colorspace gray -level 10%,88% \\( +clone -fill '${cor}' -colorize 100 \\) -compose Multiply -composite -modulate 125,105,100 /tmp/shirt_col.png`);
execSync(`convert /tmp/c_in.img /tmp/shirt_col.png /tmp/shirtmask.png -compose Over -composite /tmp/c_mid.png`);
execSync(`convert /tmp/c_mid.png \\( /tmp/decal.pgm -morphology Dilate Diamond:1 \\) -compose Screen -composite -resize 512x512 -quality 86 /tmp/c_out.jpg`);
tex.setImage(new Uint8Array(fs.readFileSync('/tmp/c_out.jpg'))).setMimeType('image/jpeg').setURI('');
await io.write(outFile, doc);
console.log(JSON.stringify({tGeo, tLogo, tex: [TW, TH], bytes: fs.statSync(outFile).size}));
