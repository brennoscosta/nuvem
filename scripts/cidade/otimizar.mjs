// Otimiza um GLB gerado no Higgsfield pra uso na cena: normaliza (base no y=0, altura 1), simplifica,
// textura JPG (512 por padrão), material sem metalness. Uso: node otimizar.mjs <entrada.glb> <saida.glb> [triangulos] [textura]
import { NodeIO } from "@gltf-transform/core";
import { weld, simplify, prune, dedup, clearNodeTransform, quantize, dequantize } from "@gltf-transform/functions";
import { KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptSimplifier } from "meshoptimizer";
import { execSync } from "node:child_process";
import fs from "node:fs";

const [, , inFile, outFile, triArg, texArg] = process.argv;
const alvoTris = Number(triArg || 3000);
const tamTex = Number(texArg || 512);
const io = new NodeIO().registerExtensions([KHRMeshQuantization]); const doc = await io.read(inFile); const root = doc.getRoot();
await doc.transform(dequantize()); // entrada já quantizada (ex.: reotimizar um modelo nosso): volta pra float antes de mexer
for (const m of root.listMaterials()) { m.setMetallicFactor(0); m.setRoughnessFactor(0.8); }
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
const ratio = Math.min(1, alvoTris / Math.max(1, tris));
await MeshoptSimplifier.ready;
// arredonda normais/UVs pra que a solda junte vértices de triângulos vizinhos (senão cada aresta vira "borda" e nada simplifica)
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) for (const [nome, passo] of [["NORMAL", 0.05], ["TEXCOORD_0", 1 / 1024], ["POSITION", 1e-4]]) {
  const acc = p.getAttribute(nome); if (!acc) continue; const n = acc.getCount(), k = acc.getElementSize(), e = new Array(k).fill(0), out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) { acc.getElement(i, e); for (let j = 0; j < k; j++) out[i * k + j] = Math.round(e[j] / passo) * passo; }
  acc.setNormalized(false).setArray(out);
}
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(process.env.ERRO || 0.01) }));
// normaliza: centro em x/z, base em y=0, altura = 1
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
const el = [0, 0, 0];
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const acc = p.getAttribute("POSITION"); for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, el); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], el[k]); mx[k] = Math.max(mx[k], el[k]); } } }
const H = mx[1] - mn[1], cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
// lê com getElement (respeita acessores quantizados) e grava em float32; o quantize() do fim requantiza
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const acc = p.getAttribute("POSITION"); const n = acc.getCount(), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { acc.getElement(i, el); a[i * 3] = (el[0] - cx) / H; a[i * 3 + 1] = (el[1] - mn[1]) / H; a[i * 3 + 2] = (el[2] - cz) / H; } acc.setNormalized(false).setArray(a); }
// textura
for (const tex of root.listTextures()) {
  fs.writeFileSync("/tmp/t_in.img", Buffer.from(tex.getImage()));
  execSync(`convert /tmp/t_in.img -resize ${tamTex}x${tamTex} -quality 82 /tmp/t_out.jpg`);
  tex.setImage(new Uint8Array(fs.readFileSync("/tmp/t_out.jpg"))).setMimeType("image/jpeg").setURI("");
}
// quantiza (KHR_mesh_quantization: posição int16, normal int8, uv uint16) — o three lê nativamente; arquivo ~3x menor
await doc.transform(prune(), dedup(), weld(), quantize());
await io.write(outFile, doc);
let tris2 = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris2 += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(JSON.stringify({ in: inFile, out: outFile, trisAntes: tris, trisDepois: tris2, largura: +((mx[0] - mn[0]) / H).toFixed(3), prof: +((mx[2] - mn[2]) / H).toFixed(3), bytes: fs.statSync(outFile).size }));
