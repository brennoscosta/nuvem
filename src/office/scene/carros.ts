// Carros desenhados em código (21/11/2026, pedido do dono: "o visual dos carros é feio, estão distorcidos e mal feitos").
// Antes eram três modelos gerados por IA (Tripo, ~6 mil triângulos e uma textura cada) e um clone por carro: proporções
// erradas (o hatch com 3,65 × 1,83 m e o utilitário com 2 m de largura), superfícies amassadas, e os faróis e as lanternas
// postos para um carro de 4,4 m (soltos no ar no hatch, enterrados no utilitário); cada carro custava umas 8 chamadas de
// desenho. Agora cada tipo (hatch, sedã, utilitário esportivo, van, táxi e ônibus) tem medidas de carro de verdade e é
// montado com volumes: carroceria com capô, porta-malas e caixas de roda redondas; cabine mais estreita que a carroceria,
// com para-brisa e vigia inclinados e as laterais caindo para dentro; colunas, teto, para-choques, grade, placas,
// retrovisores, frisos das portas e maçanetas. Tudo vira duas geometrias mescladas por tipo: a pintura (branca: a cor de
// cada carro vem da instância) e o resto (vidros, borrachas, grade, placas). Rodas, faróis e lanternas são instâncias à
// parte (scene/Transito.tsx), para girar, esterçar e acender.
// Medidas no sistema do carro: frente em +x, chão em y = 0, largura em z (lado direito em +z), centro em x = z = 0.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TipoCarro = "hatch" | "sedan" | "suv" | "van" | "taxi" | "onibus";
// lente (farol, lanterna ou letreiro): centro e tamanho (w na largura, h na altura, d na profundidade)
export interface Lente { x: number; y: number; z: number; w: number; h: number; d?: number }
export interface Desenho {
  pintura: THREE.BufferGeometry; resto: THREE.BufferGeometry;
  rodas: [number, number][]; raioRoda: number; entreEixos: number;
  farois: Lente[]; lanternas: Lente[]; letreiros: (Lente & { cor: string })[];
  meio: number; largura: number; alturaFarol: number;
}
type V2 = [number, number];
type V3 = [number, number, number];

const cor = (h: string) => new THREE.Color(h);
const BRANCO = cor("#FFFFFF"), VIDRO_BAIXO = cor("#17212B"), VIDRO_ALTO = cor("#5A7189"), BORRACHA = cor("#1D1F23"), PLASTICO = cor("#2E3237"),
  GRADE = cor("#141619"), PLACA = cor("#E4E8EC"), CROMO = cor("#B9C0C8"), ARO = cor("#8E969F"), PRETO = cor("#131518");
const _c = new THREE.Color();
// deixa só posição, normal e cor (a de cada vértice vem de f): as peças se juntam numa malha
function colorir(geo: THREE.BufferGeometry, f: (x: number, y: number, z: number) => THREE.Color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const nome of Object.keys(g.attributes)) if (nome !== "position" && nome !== "normal") g.deleteAttribute(nome);
  g.clearGroups();
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = f(p.getX(i), p.getY(i), p.getZ(i)); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}
const liso = (c: THREE.Color) => () => c;
const lim = (v: number) => Math.min(1, Math.max(0, v));
// pintura branca (a cor vem da instância), um pouco mais escura embaixo
const tinta = (_x: number, y: number) => _c.copy(BRANCO).multiplyScalar(0.8 + 0.2 * lim((y - 0.25) / 0.6));
// vidro: escuro embaixo, clareando para cima (o céu refletido)
const vidro = (y0: number, y1: number) => (_x: number, y: number) => _c.copy(VIDRO_BAIXO).lerp(VIDRO_ALTO, Math.pow(lim((y - y0) / (y1 - y0)), 1.4));

function caixa(sx: number, sy: number, sz: number, x: number, y: number, z: number, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g;
}
// barra quadrada de a até b
function barra(a: V3, b: V3, esp: number) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
  const g = new THREE.BoxGeometry(esp, L, esp);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); return g;
}
// carroceria: o contorno de cima (da frente embaixo até a traseira embaixo, no perfil) e, por baixo, a soleira com as
// caixas de roda em arco; extrudada na largura, com as quinas arredondadas (chanfro)
function casco(cima: V2[], soleira: number, rodas: number[], r: number, largura: number, chanfro: number) {
  const s = new THREE.Shape();
  s.moveTo(cima[0][0], cima[0][1]);
  for (let i = 1; i < cima.length; i++) s.lineTo(cima[i][0], cima[i][1]);
  const R = r + 0.05 + chanfro, xs = [...rodas].sort((a, b) => a - b);
  s.lineTo(cima[cima.length - 1][0], soleira);
  for (const wx of xs) { s.lineTo(wx - R, soleira); s.lineTo(wx - R, r); s.absarc(wx, r, R, Math.PI, 0, true); s.lineTo(wx + R, soleira); }
  s.lineTo(cima[0][0], soleira);
  const prof = largura - 2 * chanfro;
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, steps: 1, curveSegments: 7, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro, bevelSegments: 2 });
  g.translate(0, 0, -prof / 2);
  return g;
}
// cabine (o vidro inteiro): o contorno no perfil extrudado na largura; as laterais caem para dentro em cima
const CH_CAB = 0.03;
function cabine(pts: V2[], largura: number, estreita: number, y0: number, y1: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: largura, steps: 1, bevelEnabled: true, bevelThickness: CH_CAB, bevelSize: CH_CAB, bevelSegments: 1 });
  g.translate(0, 0, -largura / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - estreita * lim((p.getY(i) - y0) / (y1 - y0))));
  g.computeVertexNormals();
  return g;
}
const meiaCabine = (largura: number, estreita: number, y: number, y0: number, y1: number) => (largura / 2 + CH_CAB) * (1 - estreita * lim((y - y0) / (y1 - y0)));

// ---------- carros de passeio (hatch, sedã, utilitário esportivo e táxi) ----------
interface Passeio {
  W: number; r: number; eixoF: number; eixoT: number; soleira: number;
  cima: V2[]; cab: V2[]; cinta: number; teto: number; // contornos; altura da cintura (embaixo das janelas) e do teto
  a: [V2, V2]; c: [V2, V2]; espC: number; b: number; tetoX: V2; // colunas A e C (de baixo para cima), largura da C, coluna B
  farol: Lente; lanterna: Lente; frenteX: number; trasX: number; // faces da frente e de trás na altura do para-choque
  portas: number[]; macanetas: number[]; retrovisor: V2;
  saia?: boolean; barras?: boolean; taxi?: boolean;
}
function passeio(p: Passeio): Desenho {
  const W = p.W, chanfro = 0.05, estreita = 0.12, lc = W - 0.3;
  const pint: THREE.BufferGeometry[] = [], resto: THREE.BufferGeometry[] = [];
  pint.push(colorir(casco(p.cima, p.soleira, [p.eixoF, p.eixoT], p.r, W, chanfro), tinta));
  resto.push(colorir(cabine(p.cab, lc, estreita, p.cinta, p.teto), vidro(p.cinta, p.teto)));
  const hwT = meiaCabine(lc, estreita, p.teto, p.cinta, p.teto);
  // chapa do teto, um pouco acima do vidro (o chanfro da cabine sobe até 5 cm acima do teto: o vidro aparecia por cima)
  pint.push(colorir(caixa(p.tetoX[1] - p.tetoX[0], 0.05, hwT * 2 + 0.02, (p.tetoX[0] + p.tetoX[1]) / 2, p.teto + 0.04, 0), tinta));
  const R = p.r + 0.05 + chanfro;
  for (const lado of [1, -1]) {
    const em = ([x, y]: V2, fora = 0.012): V3 => [x, y, lado * (meiaCabine(lc, estreita, y, p.cinta, p.teto) + fora)];
    pint.push(colorir(barra(em(p.a[0]), em(p.a[1]), 0.075), tinta));
    pint.push(colorir(barra(em(p.c[0]), em(p.c[1]), p.espC), tinta));
    resto.push(colorir(barra(em([p.b, p.cinta + 0.03]), em([p.b - 0.06, p.teto - 0.02]), 0.085), liso(PRETO)));
    pint.push(colorir(caixa(0.13, 0.09, 0.15, p.retrovisor[0], p.retrovisor[1], lado * (W / 2 + 0.065)), tinta));
    // frisos das portas (acima da caixa de roda, quando passam por ela) e maçanetas
    for (const x of p.portas) {
      const emArco = Math.abs(x - p.eixoF) < R || Math.abs(x - p.eixoT) < R;
      const y0 = emArco ? p.r + R + 0.02 : p.soleira + 0.06, y1 = p.cinta - 0.05;
      resto.push(colorir(caixa(0.012, y1 - y0, 0.006, x, (y0 + y1) / 2, lado * (W / 2 + 0.002)), liso(PRETO)));
    }
    for (const x of p.macanetas) resto.push(colorir(caixa(0.12, 0.025, 0.02, x, p.cinta - 0.1, lado * (W / 2 + 0.008)), liso(CROMO)));
    if (p.saia) resto.push(colorir(caixa(p.eixoF - p.eixoT - 2 * R - 0.06, 0.15, 0.03, (p.eixoF + p.eixoT) / 2, p.soleira + 0.03, lado * (W / 2 + 0.01)), liso(PLASTICO)));
    if (p.barras) resto.push(colorir(caixa(p.tetoX[1] - p.tetoX[0] - 0.2, 0.04, 0.05, (p.tetoX[0] + p.tetoX[1]) / 2, p.teto + 0.1, lado * (hwT - 0.1)), liso(PLASTICO)));
    if (p.taxi) resto.push(colorir(caixa(p.eixoF - p.eixoT - 2 * R - 0.1, 0.07, 0.008, (p.eixoF + p.eixoT) / 2, p.cinta - 0.2, lado * (W / 2 + 0.004)), liso(cor("#1F4FA8"))));
  }
  // grade, para-choques e placas
  resto.push(colorir(caixa(0.05, 0.12, W * 0.42, p.frenteX - 0.015, p.farol.y - 0.11, 0), liso(GRADE)));
  resto.push(colorir(caixa(0.12, 0.17, W + 0.03, p.frenteX - 0.03, p.soleira + 0.13, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.12, 0.17, W + 0.03, p.trasX + 0.03, p.soleira + 0.13, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.02, 0.11, 0.38, p.frenteX + 0.04, p.soleira + 0.14, 0), liso(PLACA)));
  resto.push(colorir(caixa(0.02, 0.11, 0.38, p.trasX - 0.012, p.lanterna.y - 0.19, 0), liso(PLACA)));
  const letreiros: Desenho["letreiros"] = [];
  if (p.taxi) {
    const x = (p.tetoX[0] + p.tetoX[1]) / 2, y = p.teto + 0.065;
    resto.push(colorir(caixa(0.66, 0.04, 0.34, x, y + 0.02, 0), liso(PRETO)));
    letreiros.push({ x, y: y + 0.11, z: 0, w: 0.3, h: 0.13, d: 0.6, cor: "#FFE7A1" });
  }
  const zr = W / 2 - 0.12;
  return {
    pintura: mergeGeometries(pint)!, resto: mergeGeometries(resto)!,
    rodas: [[p.eixoF, zr], [p.eixoF, -zr], [p.eixoT, zr], [p.eixoT, -zr]], raioRoda: p.r, entreEixos: p.eixoF - p.eixoT,
    farois: [1, -1].map((l) => ({ ...p.farol, z: l * p.farol.z })), lanternas: [1, -1].map((l) => ({ ...p.lanterna, z: l * p.lanterna.z })), letreiros,
    meio: Math.max(p.frenteX, -p.trasX), largura: W, alturaFarol: p.farol.y,
  };
}

// hatch: 3,95 × 1,72 × 1,48 m, entre-eixos 2,55 m, rodas de 60 cm
const HATCH: Passeio = {
  W: 1.72, r: 0.3, eixoF: 1.25, eixoT: -1.3, soleira: 0.26,
  cima: [[1.86, 0.26], [1.92, 0.46], [1.86, 0.66], [1.64, 0.76], [0.84, 0.86], [-1.7, 0.91], [-1.85, 0.84], [-1.92, 0.58], [-1.92, 0.26]],
  cab: [[0.9, 0.8], [0.08, 1.4], [-1.38, 1.41], [-1.74, 0.94], [-1.74, 0.8]], cinta: 0.88, teto: 1.4,
  a: [[0.86, 0.9], [0.08, 1.4]], c: [[-1.74, 0.95], [-1.38, 1.41]], espC: 0.13, b: -0.32, tetoX: [-1.4, 0.1],
  farol: { x: 1.925, y: 0.64, z: 0.58, w: 0.34, h: 0.11 }, lanterna: { x: -1.93, y: 0.78, z: 0.62, w: 0.22, h: 0.15 }, frenteX: 1.96, trasX: -1.97,
  portas: [0.72, -0.36, -1.25], macanetas: [-0.18, -1.08], retrovisor: [0.8, 0.97],
};
// sedã: 4,48 × 1,76 × 1,47 m, entre-eixos 2,68 m, porta-malas
const SEDAN: Passeio = {
  W: 1.76, r: 0.31, eixoF: 1.38, eixoT: -1.3, soleira: 0.25,
  cima: [[2.12, 0.25], [2.18, 0.46], [2.12, 0.66], [1.84, 0.75], [1.06, 0.85], [-1.26, 0.89], [-2.02, 0.92], [-2.16, 0.86], [-2.19, 0.58], [-2.19, 0.25]],
  cab: [[1.12, 0.79], [0.28, 1.38], [-0.62, 1.4], [-1.34, 0.92], [-1.34, 0.79]], cinta: 0.87, teto: 1.39,
  a: [[1.08, 0.89], [0.28, 1.38]], c: [[-1.34, 0.93], [-0.62, 1.4]], espC: 0.11, b: -0.2, tetoX: [-0.64, 0.3],
  farol: { x: 2.185, y: 0.64, z: 0.6, w: 0.38, h: 0.1 }, lanterna: { x: -2.23, y: 0.78, z: 0.6, w: 0.32, h: 0.12 }, frenteX: 2.22, trasX: -2.24,
  portas: [0.9, -0.22, -1.1], macanetas: [-0.05, -0.95], retrovisor: [1.02, 0.96],
};
// utilitário esportivo: 4,42 × 1,84 × 1,68 m, mais alto do chão, saia de plástico e barras no teto
const SUV: Passeio = {
  W: 1.84, r: 0.36, eixoF: 1.36, eixoT: -1.32, soleira: 0.33,
  cima: [[2.1, 0.33], [2.16, 0.56], [2.12, 0.84], [1.88, 0.96], [1.02, 1.04], [-1.88, 1.08], [-2.08, 1.05], [-2.16, 0.88], [-2.16, 0.33]],
  cab: [[1.08, 0.98], [0.32, 1.58], [-1.8, 1.6], [-2.04, 1.1], [-2.04, 0.98]], cinta: 1.06, teto: 1.59,
  a: [[1.04, 1.07], [0.32, 1.58]], c: [[-2.04, 1.1], [-1.8, 1.6]], espC: 0.16, b: -0.34, tetoX: [-1.82, 0.34],
  farol: { x: 2.175, y: 0.84, z: 0.62, w: 0.4, h: 0.11 }, lanterna: { x: -2.22, y: 0.96, z: 0.7, w: 0.16, h: 0.24 }, frenteX: 2.2, trasX: -2.21,
  portas: [0.86, -0.36, -1.25], macanetas: [-0.18, -1.05], retrovisor: [1.0, 1.15], saia: true, barras: true,
};

// ---------- van (utilitário de carga): 5,0 × 1,98 × 2,30 m, cabine curta, baú alto ----------
function van(): Desenho {
  const W = 1.98, r = 0.34, ch = 0.06, eixoF = 1.68, eixoT = -1.55, soleira = 0.3;
  const pint: THREE.BufferGeometry[] = [], resto: THREE.BufferGeometry[] = [];
  pint.push(colorir(casco([[2.4, 0.3], [2.44, 0.55], [2.4, 0.86], [2.18, 1.04], [1.8, 1.13], [1.2, 2.14], [-2.38, 2.18], [-2.44, 2.08], [-2.44, 0.3]], soleira, [eixoF, eixoT], r, W, ch), tinta));
  // para-brisa deitado sobre a face inclinada (de (1,80; 1,13) a (1,20; 2,14), mais o chanfro)
  const ang = Math.atan2(0.6, 1.01), nx = Math.cos(ang), ny = Math.sin(ang), off = ch + 0.012;
  resto.push(colorir(caixa(0.02, 1.0, W - 0.3, 1.5 + nx * off, 1.635 + ny * off, 0, ang), vidro(1.15, 2.15)));
  for (const lado of [1, -1]) {
    resto.push(colorir(caixa(0.7, 0.62, 0.012, 0.88, 1.64, lado * (W / 2 + 0.006)), vidro(1.3, 1.95))); // janela da porta
    resto.push(colorir(caixa(0.07, 0.22, 0.16, 1.72, 1.55, lado * (W / 2 + 0.1)), liso(PRETO))); // retrovisor
    for (const x of [0.45, -1.1]) resto.push(colorir(caixa(0.012, x === 0.45 ? 1.65 : 1.55, 0.006, x, x === 0.45 ? 1.16 : 1.2, lado * (W / 2 + 0.002)), liso(PRETO)));
    resto.push(colorir(caixa(0.12, 0.025, 0.02, 0.32, 1.18, lado * (W / 2 + 0.008)), liso(CROMO)));
  }
  // traseira: as duas portas com vidro, grade, para-choques e placas
  resto.push(colorir(caixa(0.012, 1.7, 0.012, -2.505, 1.25, 0), liso(PRETO)));
  for (const z of [0.45, -0.45]) resto.push(colorir(caixa(0.012, 0.42, 0.62, -2.505, 1.78, z), vidro(1.55, 2.0)));
  resto.push(colorir(caixa(0.05, 0.18, W * 0.5, 2.485, 0.72, 0), liso(GRADE)));
  resto.push(colorir(caixa(0.14, 0.2, W + 0.04, 2.47, 0.42, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.14, 0.2, W + 0.04, -2.47, 0.42, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.02, 0.11, 0.38, 2.55, 0.42, 0), liso(PLACA)));
  resto.push(colorir(caixa(0.02, 0.11, 0.38, -2.55, 0.62, 0), liso(PLACA)));
  const zr = W / 2 - 0.13;
  return {
    pintura: mergeGeometries(pint)!, resto: mergeGeometries(resto)!,
    rodas: [[eixoF, zr], [eixoF, -zr], [eixoT, zr], [eixoT, -zr]], raioRoda: r, entreEixos: eixoF - eixoT,
    farois: [0.68, -0.68].map((z) => ({ x: 2.47, y: 0.94, z, w: 0.32, h: 0.15 })), lanternas: [0.88, -0.88].map((z) => ({ x: -2.51, y: 0.8, z, w: 0.12, h: 0.42 })), letreiros: [],
    meio: 2.5, largura: W, alturaFarol: 0.94,
  };
}

// ---------- ônibus urbano: 10,6 × 2,5 × 3,0 m, rodas de 1 m, janelas em faixa, portas do lado direito ----------
function onibus(): Desenho {
  const W = 2.5, r = 0.5, ch = 0.1, eixoF = 2.85, eixoT = -2.75, soleira = 0.42;
  const pint: THREE.BufferGeometry[] = [], resto: THREE.BufferGeometry[] = [];
  pint.push(colorir(casco([[5.12, 0.42], [5.2, 0.7], [5.18, 2.62], [5.0, 2.92], [-5.05, 2.92], [-5.2, 2.75], [-5.2, 0.7], [-5.12, 0.42]], soleira, [eixoF, eixoT], r, W, ch), tinta));
  resto.push(colorir(caixa(0.04, 1.42, W - 0.36, 5.3, 1.95, 0), vidro(1.2, 2.7))); // para-brisa
  for (const lado of [1, -1]) {
    resto.push(colorir(caixa(8.5, 0.98, 0.02, -0.65, 2.05, lado * (W / 2 + 0.006)), vidro(1.55, 2.55))); // faixa de janelas
    for (const x of [-4.85, -3.5, -2.15, -0.8, 0.55, 1.9, 3.25, 3.58]) pint.push(colorir(caixa(0.12, 1.0, 0.02, x, 2.05, lado * (W / 2 + 0.014)), tinta));
    resto.push(colorir(caixa(10.2, 0.16, 0.02, 0, 1.22, lado * (W / 2 + 0.006)), liso(BRANCO))); // faixa branca
    resto.push(colorir(caixa(0.07, 0.3, 0.2, 5.12, 2.45, lado * (W / 2 + 0.14)), liso(PRETO))); // retrovisor
  }
  resto.push(colorir(caixa(1.0, 1.95, 0.02, 4.25, 1.5, W / 2 + 0.012), vidro(0.6, 2.5))); // porta da frente
  resto.push(colorir(caixa(1.1, 1.95, 0.02, -0.2, 1.5, W / 2 + 0.012), vidro(0.6, 2.5))); // porta do meio
  resto.push(colorir(caixa(0.14, 0.3, W + 0.04, 5.27, 0.55, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.14, 0.3, W + 0.04, -5.27, 0.55, 0), liso(PLASTICO)));
  resto.push(colorir(caixa(0.02, 0.11, 0.38, -5.35, 0.9, 0), liso(PLACA)));
  const zr = W / 2 - 0.17;
  return {
    pintura: mergeGeometries(pint)!, resto: mergeGeometries(resto)!,
    rodas: [[eixoF, zr], [eixoF, -zr], [eixoT, zr], [eixoT, -zr]], raioRoda: r, entreEixos: eixoF - eixoT,
    farois: [0.92, -0.92].map((z) => ({ x: 5.31, y: 0.92, z, w: 0.32, h: 0.16 })), lanternas: [1.0, -1.0].map((z) => ({ x: -5.31, y: 1.0, z, w: 0.16, h: 0.4 })),
    letreiros: [{ x: 5.31, y: 2.72, z: 0, w: 1.7, h: 0.26, cor: "#FFB020" }],
    meio: 5.3, largura: W, alturaFarol: 0.92,
  };
}

const CACHE = new Map<TipoCarro, Desenho>();
export function desenhoCarro(t: TipoCarro): Desenho {
  let d = CACHE.get(t);
  if (!d) {
    d = t === "hatch" ? passeio(HATCH) : t === "sedan" ? passeio(SEDAN) : t === "taxi" ? passeio({ ...SEDAN, taxi: true }) : t === "suv" ? passeio(SUV) : t === "van" ? van() : onibus();
    CACHE.set(t, d);
  }
  return d;
}
// meio comprimento de cada tipo (o trânsito guarda a distância do carro da frente por ele)
export const MEIO_CARRO: Record<TipoCarro, number> = { hatch: 1.97, sedan: 2.24, taxi: 2.24, suv: 2.21, van: 2.5, onibus: 5.3 };

// roda (raio 1; a instância escala pelo raio): pneu, aro, cubo e três raios na face de fora (+z)
let geoRoda: THREE.BufferGeometry | null = null;
export function rodaGeo() {
  if (geoRoda) return geoRoda;
  const L = 0.62;
  const raios = [0, 1, 2].map((k) => { const g = new THREE.BoxGeometry(0.13, 0.56, 0.03); g.translate(0, 0.33, 0); g.rotateZ((k * 2 * Math.PI) / 3); g.translate(0, 0, L / 2 + 0.02); return colorir(g, liso(CROMO)); });
  geoRoda = mergeGeometries([
    colorir(new THREE.CylinderGeometry(1, 1, L, 16, 1).rotateX(Math.PI / 2), liso(BORRACHA)),
    colorir(new THREE.CylinderGeometry(0.66, 0.66, L + 0.02, 12, 1).rotateX(Math.PI / 2), liso(ARO)),
    colorir(new THREE.CylinderGeometry(0.2, 0.2, L + 0.05, 8, 1).rotateX(Math.PI / 2), liso(CROMO)),
    ...raios,
  ])!;
  return geoRoda;
}

// cores de carro das ruas brasileiras (branco, prata, preto e cinza na frente); o táxi é amarelo e o ônibus, azul
export const CORES_CARRO = ["#F1F2F4", "#F1F2F4", "#F1F2F4", "#AFB5BC", "#AFB5BC", "#AFB5BC", "#24272C", "#24272C", "#6C7279", "#6C7279", "#A8232C", "#1F4E8A", "#2F5C47", "#CDBB97", "#5D8DB6", "#6B1F2C"];
export const COR_TAXI = "#F2C200", COR_ONIBUS = "#0A6CFF";

// carros estacionados (a lanchonete): todos numa geometria só, com a cor de cada um gravada nos vértices e as rodas no lugar
export function geometriaParados(itens: { x: number; z: number; rot: number; tipo: TipoCarro; cor: string }[]) {
  const partes: THREE.BufferGeometry[] = [], m = new THREE.Matrix4(), w = new THREE.Matrix4(), tint = new THREE.Color();
  for (const it of itens) {
    const d = desenhoCarro(it.tipo);
    m.makeRotationY(it.rot).setPosition(it.x, 0, it.z);
    const p = d.pintura.clone(); tint.set(it.cor);
    const c = p.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint.r, c.getY(i) * tint.g, c.getZ(i) * tint.b);
    partes.push(p.applyMatrix4(m), d.resto.clone().applyMatrix4(m));
    for (const [wx, wz] of d.rodas) {
      w.makeTranslation(wx, d.raioRoda, wz); if (wz < 0) w.multiply(new THREE.Matrix4().makeRotationY(Math.PI)); w.multiply(new THREE.Matrix4().makeScale(d.raioRoda, d.raioRoda, d.raioRoda));
      partes.push(rodaGeo().clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, w)));
    }
  }
  return mergeGeometries(partes)!;
}
