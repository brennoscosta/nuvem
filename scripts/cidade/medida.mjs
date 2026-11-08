// Mede a caixa (largura x, altura y, profundidade z) de um GLB. Uso: node scripts/cidade/medida.mjs <modelo.glb>
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/core";
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
const b = getBounds(scene);
const [x, y, z] = [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(3));
console.log(JSON.stringify({ x, y, z, minY: +b.min[1].toFixed(3), proporcao: { xPorY: +(x / y).toFixed(3), zPorY: +(z / y).toFixed(3) } }));
