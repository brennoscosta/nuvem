// Placas num desenho só (24/11/2026, mapa lento): várias placas com texto, cada uma com a própria textura, viravam 3 a 5
// desenhos por placa (as de rua e as de bairro somavam 75 por quadro). Aqui todas as artes vão para uma textura só (um
// "atlas", em células) e as peças de todas as placas viram uma malha por material: as faces numa, o ferro noutra.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface Atlas { textura: THREE.CanvasTexture; cols: number; rows: number; folga: number; w: number; h: number }

// Uma célula de w×h por arte, com uma folga em volta (a imagem reduzida de longe não puxa a cor da vizinha)
export function montarAtlas(n: number, w: number, h: number, desenhar: (g: CanvasRenderingContext2D, i: number) => void, cols = 2): Atlas | null {
  if (typeof document === "undefined" || n === 0) return null;
  const folga = 6, cw = w + folga * 2, ch = h + folga * 2, c = Math.min(cols, n), rows = Math.ceil(n / c);
  const tela = document.createElement("canvas"); tela.width = c * cw; tela.height = rows * ch;
  const g = tela.getContext("2d")!;
  for (let i = 0; i < n; i++) {
    const x = (i % c) * cw + folga, y = Math.floor(i / c) * ch + folga;
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); desenhar(g, i); g.restore();
    // a folga repete a borda da arte
    g.drawImage(tela, x, y, w, 1, x, y - folga, w, folga); g.drawImage(tela, x, y + h - 1, w, 1, x, y + h, w, folga);
    g.drawImage(tela, x, y - folga, 1, h + folga * 2, x - folga, y - folga, folga, h + folga * 2);
    g.drawImage(tela, x + w - 1, y - folga, 1, h + folga * 2, x + w, y - folga, folga, h + folga * 2);
  }
  const textura = new THREE.CanvasTexture(tela); textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 8;
  return { textura, cols: c, rows, folga, w, h };
}

export interface Peca { geo: THREE.BufferGeometry; m: THREE.Matrix4; celula?: number }

// Junta as peças numa geometria só, cada uma na sua posição. Com atlas, o UV de cada face vai para a sua célula.
export function juntarPecas(pecas: Peca[], atlas?: Atlas | null): THREE.BufferGeometry | null {
  if (!pecas.length) return null;
  const geos = pecas.map(({ geo, m, celula }) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const nome of Object.keys(g.attributes)) if (nome !== "position" && nome !== "normal" && nome !== "uv") g.deleteAttribute(nome);
    g.applyMatrix4(m);
    if (atlas && celula != null && g.attributes.uv) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const cw = atlas.w + atlas.folga * 2, ch = atlas.h + atlas.folga * 2, W = atlas.cols * cw, H = atlas.rows * ch;
      const x0 = (celula % atlas.cols) * cw + atlas.folga, y0 = Math.floor(celula / atlas.cols) * ch + atlas.folga;
      // textura de canvas vem de cabeça para baixo (flipY): v = 1 é o topo do canvas
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * atlas.w) / W, 1 - (y0 + (1 - uv.getY(i)) * atlas.h) / H);
    }
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  });
  const out = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  out?.computeBoundingSphere();
  return out;
}

// Matriz de posição + giro (em y, ou nos três eixos) para montar as peças
const aux = new THREE.Object3D();
export function matriz(pos: [number, number, number], rot: number | [number, number, number] = 0, pai?: THREE.Matrix4): THREE.Matrix4 {
  aux.position.set(...pos);
  if (typeof rot === "number") aux.rotation.set(0, rot, 0); else aux.rotation.set(...rot);
  aux.scale.set(1, 1, 1); aux.updateMatrix();
  return pai ? new THREE.Matrix4().multiplyMatrices(pai, aux.matrix) : aux.matrix.clone();
}
