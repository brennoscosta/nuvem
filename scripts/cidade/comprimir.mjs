// Comprime os modelos da cidade para abrir mais rápido no celular (12/11/2026): geometria quantizada e comprimida com
// meshopt (EXT_meshopt_compression, o three/drei já descomprime sozinho) e texturas em WebP no mesmo tamanho.
// Não mexe na forma nem no tamanho das texturas: o desenho fica igual. Uso (na raiz do projeto):
//   node scripts/cidade/comprimir.mjs [pasta-de-entrada] [pasta-de-saída]   (padrão: public/modelos → public/modelos)
// Rodar de novo num arquivo já comprimido não estraga nada (ele é lido, descomprimido e comprimido de novo).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, dequantize, quantize, meshopt, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [, , entrada = "public/modelos", saida = "public/modelos"] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
fs.mkdirSync(saida, { recursive: true });
let antes = 0, depois = 0;
for (const f of fs.readdirSync(entrada).filter((x) => x.endsWith(".glb")).sort()) {
  const de = path.join(entrada, f), para = path.join(saida, f);
  const t0 = fs.statSync(de).size;
  const doc = await io.read(de);
  await doc.transform(
    // os modelos do Higgsfield vêm como "sopa de triângulos" (cada vértice repetido): soldar os iguais deixa a
    // compressão funcionar (o meshopt depende da ordem e do reaproveitamento dos vértices)
    dequantize(), weld(), dedup(), prune(),
    // a POSIÇÃO não é quantizada (integração de 12/11/2026): quantizada, ela vira inteiro normalizado e a escala vai para o
    // nó; o sombreador das fachadas e das janelas acesas (scene/PredioMaterial.tsx) lê a posição do modelo e errava a conta
    // (copa das árvores e paredes da casa velha sumiam). Só normais e coordenadas de textura são quantizadas.
    quantize({ pattern: /^(NORMAL|TEXCOORD_\d+)$/, quantizeNormal: 10, quantizeTexcoord: 12 }),
    meshopt({ encoder: MeshoptEncoder, level: process.env.NIVEL === "medium" ? "medium" : "high" }),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: Number(process.env.QUALIDADE || 82) }),
  );
  await io.write(para, doc);
  const t1 = fs.statSync(para).size; antes += t0; depois += t1;
  console.log(f.padEnd(26), `${(t0 / 1024).toFixed(0).padStart(5)} KB → ${(t1 / 1024).toFixed(0).padStart(5)} KB`);
}
console.log(`total: ${(antes / 1048576).toFixed(2)} MB → ${(depois / 1048576).toFixed(2)} MB`);
