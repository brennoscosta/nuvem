// Otimiza um GLB gerado no Higgsfield pra uso na cena: normaliza (base no y=0, altura 1), simplifica,
// textura 512 JPG, material sem metalness. Uso: node otimizar.mjs <entrada.glb> <saida.glb> [triangulos]
import { NodeIO } from "@gltf-transform/core";
import { weld, simplify, prune, dedup, clearNodeTransform, normals } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { execSync } from "node:child_process";
import fs from "node:fs";

const [, , inFile, outFile, triArg] = process.argv;
const alvoTris = Number(triArg || 3000);
const io = new NodeIO(); const doc = await io.read(inFile); const root = doc.getRoot();
for (const m of root.listMaterials()) { m.setMetallicFactor(0); m.setRoughnessFactor(0.8); }
for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
const ratio = Math.min(1, alvoTris / Math.max(1, tris));
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.003 }), normals({ overwrite: true }));
// normaliza: centro em x/z, base em y=0, altura = 1
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute("POSITION").getArray(); for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); } }
const H = mx[1] - mn[1], cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const acc = p.getAttribute("POSITION"); const a = acc.getArray().slice(); for (let i = 0; i < a.length; i += 3) { a[i] = (a[i] - cx) / H; a[i + 1] = (a[i + 1] - mn[1]) / H; a[i + 2] = (a[i + 2] - cz) / H; } acc.setArray(a); }
// textura
for (const tex of root.listTextures()) {
  fs.writeFileSync("/tmp/t_in.img", Buffer.from(tex.getImage()));
  execSync("convert /tmp/t_in.img -resize 512x512 -quality 82 /tmp/t_out.jpg");
  tex.setImage(new Uint8Array(fs.readFileSync("/tmp/t_out.jpg"))).setMimeType("image/jpeg").setURI("");
}
await doc.transform(prune(), dedup());
await io.write(outFile, doc);
let tris2 = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris2 += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(JSON.stringify({ in: inFile, out: outFile, trisAntes: tris, trisDepois: tris2, largura: +((mx[0] - mn[0]) / H).toFixed(3), prof: +((mx[2] - mn[2]) / H).toFixed(3), bytes: fs.statSync(outFile).size }));
