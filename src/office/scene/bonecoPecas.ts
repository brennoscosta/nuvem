// Peças do boneco desenhado em código (separadas de scene/Boneco.tsx em 20/11/2026, editor completo do personagem).
// Só three.js, sem React: dá para conferir no node que um personagem antigo sai igual, peça por peça
// (teste de compatibilidade da frente personagem).
// Cada peça (coxa, braço, cabeça, cabelo...) fica presa a um osso. Em vez de ~25 malhas por boneco (25 draw calls),
// as peças viram UMA malha com esqueleto (SkinnedMesh), com a cor de cada peça gravada nos vértices. A geometria é
// compartilhada entre bonecos iguais; cada boneco tem só os próprios ossos.
// Campos do editor (altura, biotipo, rosto, parte de baixo, sapatos): sem o campo, cada peça sai com a mesma medida,
// a mesma cor e na mesma ordem de antes.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import type { Boneco as BonecoDef } from "../data/bonecos";

export const OSSOS = ["hips", "spine", "chest", "head", "upperArmL", "lowerArmL", "handL", "upperArmR", "lowerArmR", "handR", "upperLegL", "lowerLegL", "footL", "upperLegR", "lowerLegR", "footR"] as const;
export type Osso = (typeof OSSOS)[number];
export const S = { ombro: 0.2, bracoR: 0.055, bracoL: 0.17, antebracoL: 0.16, pernaR: 0.075, coxaL: 0.22, canelaL: 0.2, cabecaR: 0.23 };

// osso pai e posição relativa a ele (pose de descanso). A ordem de OSSOS já tem o pai antes do filho.
export const OSSO_PAI: Record<Osso, [Osso | null, [number, number, number]]> = {
  hips: [null, [0, 0.5, 0]],
  spine: ["hips", [0, 0.08, 0]], chest: ["spine", [0, 0.1, 0]], head: ["chest", [0, 0.3, 0]],
  upperArmL: ["chest", [S.ombro, 0.16, 0]], lowerArmL: ["upperArmL", [0, -S.bracoL, 0]], handL: ["lowerArmL", [0, -S.antebracoL - 0.01, 0]],
  upperArmR: ["chest", [-S.ombro, 0.16, 0]], lowerArmR: ["upperArmR", [0, -S.bracoL, 0]], handR: ["lowerArmR", [0, -S.antebracoL - 0.01, 0]],
  upperLegL: ["hips", [0.09, -0.02, 0]], lowerLegL: ["upperLegL", [0, -S.coxaL, 0]], footL: ["lowerLegL", [0, -S.canelaL - 0.02, 0.03]],
  upperLegR: ["hips", [-0.09, -0.02, 0]], lowerLegR: ["upperLegR", [0, -S.coxaL, 0]], footR: ["lowerLegR", [0, -S.canelaL - 0.02, 0.03]],
};

const geoCache = new Map<string, THREE.BufferGeometry>();
export function g<T extends THREE.BufferGeometry>(k: string, criar: () => T) { let x = geoCache.get(k); if (!x) { x = criar(); geoCache.set(k, x); } return x; }
// Remodelado em 16/11/2026 ("tá tudo quadrado"): formas arredondadas, rosto, cabelos e tênis de verdade. No modo leve os
// segmentos caem ~30%. Fica em torno de 4 a 5 mil triângulos por boneco (2,5 mil no leve), numa malha só.
const seg = (n: number) => Math.max(5, Math.round(n * (leve() ? 0.7 : 1)));
export const capsula = (r: number, len: number, radial = 10) => g(`c${r}-${len}-${radial}`, () => new THREE.CapsuleGeometry(r, len, seg(3), seg(radial)).translate(0, -len / 2, 0));
export const esfera = (r: number, w = 12, h = 8) => g(`s${r}-${w}-${h}`, () => new THREE.SphereGeometry(r, seg(w), seg(h)));
export const bola = (w = 12, h = 8) => esfera(1, w, h); // elipsoide: esfera de raio 1 escalada pela peça
export const caixa = (x: number, y: number, z: number) => g(`b${x}-${y}-${z}`, () => new THREE.BoxGeometry(x, y, z));
export const cilindro = (rt: number, rb: number, h: number, segs: number) => g(`y${rt}-${rb}-${h}-${segs}`, () => new THREE.CylinderGeometry(rt, rb, h, seg(segs)));
const arco = () => g("arco", () => new THREE.TorusGeometry(0.235, 0.012, 6, 20, Math.PI));
export const anel = (r: number, t: number, arc = Math.PI * 2) => g(`n${r}-${t}-${arc}`, () => new THREE.TorusGeometry(r, t, seg(arc < 4 ? 5 : 6), seg(arc < 4 ? 10 : 18), arc));
// tronco torneado (cintura, peito, ombros e a base do pescoço), em volta do eixo y; achatado na frente/costas pela peça
const PERFIL_TRONCO: [number, number][] = [[0.001, -0.2], [0.14, -0.19], [0.152, -0.06], [0.172, 0.08], [0.174, 0.2], [0.158, 0.29], [0.11, 0.345], [0.07, 0.37], [0.001, 0.372]];
const tronco = () => g("tronco", () => new THREE.LatheGeometry(PERFIL_TRONCO.map(([r, y]) => new THREE.Vector2(r, y)), seg(18)));
// saia do vestido: do quadril (justo) até o meio da coxa (rodada)
const saia = () => g("saia", () => new THREE.LatheGeometry([[0.001, -0.29], [0.27, -0.29], [0.26, -0.26], [0.2, -0.05], [0.165, 0.08], [0.001, 0.085]].map(([r, y]) => new THREE.Vector2(r, y)), seg(18)));
// saia curta (20/11/2026): da cintura até um palmo acima do joelho
const saiaCurta = () => g("saiaCurta", () => new THREE.LatheGeometry([[0.001, -0.2], [0.215, -0.2], [0.21, -0.18], [0.172, -0.03], [0.156, 0.075], [0.001, 0.08]].map(([r, y]) => new THREE.Vector2(r, y)), seg(18)));
// calota de cabelo: o topo de uma esfera (abertura theta), inclinada para trás para cobrir a nuca e deixar a testa
const calota = (theta: number, inclina: number) => g(`cal${theta}-${inclina}`, () => new THREE.SphereGeometry(1, seg(20), seg(10), 0, Math.PI * 2, 0, theta).rotateX(inclina));
const blackPower = () => g("black", () => new THREE.IcosahedronGeometry(1, leve() ? 1 : 2));
const cacho = () => g("cacho", () => new THREE.IcosahedronGeometry(1, 1)); // cachinho do crespo (poucos triângulos)

export const misturar = (a: string, b: string, k: number) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`; };
export const escurecer = (hex: string, k: number) => misturar(hex, "#000000", k);
type V3 = [number, number, number];
export type Peca = { osso: Osso; geo: THREE.BufferGeometry; cor: string; pos?: V3; rot?: V3; esc?: V3 };
const R = S.cabecaR;

// largura do corpo e grossura de braços e pernas por biotipo (médio = 1: o boneco de sempre)
const LARG = { magro: 0.9, medio: 1, forte: 1.13 } as const;
const MEMBRO = { magro: 0.88, medio: 1, forte: 1.15 } as const;
export const corpoDe = (def: Pick<BonecoDef, "biotipo">) => { const b = def.biotipo ?? "medio"; return { lg: LARG[b] ?? 1, lb: MEMBRO[b] ?? 1 }; };
// frente do peito (coordenadas do osso chest): raio do tronco na altura y e o ponto da superfície num x, com o giro
// para a peça ficar deitada nele (logo do uniforme, botões, bolsos)
function raioTronco(y: number) {
  for (let i = 1; i < PERFIL_TRONCO.length; i++) { const [r0, y0] = PERFIL_TRONCO[i - 1], [r1, y1] = PERFIL_TRONCO[i]; if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1); }
  return 0.001;
}
export function pontoNoPeito(y: number, x: number, lg: number) {
  const a = raioTronco(y) * lg, b = a * 0.76, k = Math.min(0.98, Math.abs(x) / a);
  const z = b * Math.sqrt(1 - k * k);
  return { z, giro: Math.atan2(x / (a * a), z / (b * b)) };
}
const zPeito = (y: number, x = 0, lg = 1) => pontoNoPeito(y, x, lg).z;
// superfície do rosto (coordenadas do osso head; o centro da cabeça fica em y = 0,2)
const zRosto = (x: number, y: number) => 0.223 * Math.sqrt(Math.max(0, 1 - (x / 0.23) ** 2 - ((y - 0.2) / 0.239) ** 2));

// cabelo de cada estilo (cor do cabelo), preso ao osso da cabeça; o centro da cabeça fica em y = 0,2
function cabelo(p: Peca[], estilo: string, cab: string, pele: string) {
  const H = (geo: THREE.BufferGeometry, pos: V3, esc: V3, rot?: V3, cor = cab) => p.push({ osso: "head", geo, cor, pos, esc, rot });
  const nuca = () => H(bola(), [0, 0.15, -0.115], [0.19, 0.13, 0.12]);
  const k = R * 1.06;
  const kk: V3 = [k, k * 1.04, k * 0.98]; // mesma forma oval da cabeça
  switch (estilo) {
    case "careca": return;
    case "curto": H(calota(Math.PI * 0.46, -0.5), [0, 0.205, 0], kk); H(bola(12, 8), [0.035, 0.34, 0.16], [0.13, 0.045, 0.065], [0.15, 0, -0.28]); nuca(); return;
    case "topete": H(calota(Math.PI * 0.43, -0.55), [0, 0.205, 0], kk); H(bola(), [0, 0.405, 0.1], [0.13, 0.07, 0.125], [0.55, 0, 0]); H(bola(10, 8), [0, 0.39, 0.19], [0.1, 0.05, 0.06], [0.9, 0, 0]); nuca(); return;
    case "moicano":
      H(calota(Math.PI * 0.44, -0.45), [0, 0.2, 0], [R * 1.035, R * 1.075, R * 1.005], undefined, misturar(pele, cab, 0.45)); // lados raspados
      for (const [y, z, a] of [[0.43, 0.13, 0.7], [0.46, 0.02, 0.1], [0.43, -0.1, -0.5], [0.36, -0.19, -1]] as V3[]) H(bola(10, 8), [0, y, z], [0.042, 0.075, 0.085], [a, 0, 0]); // crista
      return;
    case "cacheado":
      H(blackPower(), [0, 0.33, -0.08], [0.3, 0.27, 0.27]);
      for (const [x, y, z] of [[0.17, 0.26, 0.12], [-0.17, 0.26, 0.12], [0.09, 0.33, 0.16], [-0.09, 0.33, 0.16], [0, 0.35, 0.17], [0.21, 0.16, 0.03], [-0.21, 0.16, 0.03]] as V3[]) H(blackPower(), [x, y, z], [0.06, 0.06, 0.06]);
      return;
    case "coque": H(calota(Math.PI * 0.5, -0.32), [0, 0.205, 0], kk); H(bola(), [0, 0.45, -0.13], [0.095, 0.09, 0.095]); nuca(); return;
    case "rabo":
      H(calota(Math.PI * 0.5, -0.36), [0, 0.205, 0], kk); nuca();
      H(anel(0.04, 0.012), [0, 0.31, -0.24], [1, 1, 1], [Math.PI / 2 - 0.22, 0, 0], "#2A2D33");
      p.push({ osso: "head", geo: capsula(0.045, 0.22, 10), cor: cab, pos: [0, 0.31, -0.245], rot: [0.22, 0, 0] }); return;
    case "longo":
      H(calota(Math.PI * 0.5, -0.36), [0, 0.205, 0], kk);
      p.push({ osso: "head", geo: capsula(0.17, 0.2, 14), cor: cab, pos: [0, 0.17, -0.11], esc: [1.05, 1, 0.5] });
      for (const s of [1, -1]) H(bola(), [s * 0.2, 0.1, 0.03], [0.055, 0.15, 0.075]);
      return;
    // 20/11/2026: raspado (máquina), crespo, black power e tranças
    case "raspado": H(calota(Math.PI * 0.5, -0.36), [0, 0.203, 0], [R * 1.02, R * 1.06, R * 0.995], undefined, misturar(pele, cab, 0.62)); return;
    case "crespo":
      H(calota(Math.PI * 0.47, -0.42), [0, 0.205, 0], [R * 1.09, R * 1.12, R * 1.05]);
      for (const [x, y, z] of [[0, 0.46, -0.02], [0.12, 0.44, 0.07], [-0.12, 0.44, 0.07], [0.17, 0.41, -0.07], [-0.17, 0.41, -0.07], [0, 0.45, 0.12], [0.07, 0.43, -0.15], [-0.08, 0.42, -0.15], [0.21, 0.34, 0.05], [-0.21, 0.34, 0.05]] as V3[]) H(cacho(), [x, y, z], [0.055, 0.05, 0.055]);
      return;
    case "blackpower":
      H(blackPower(), [0, 0.35, -0.12], [0.37, 0.33, 0.33]);
      for (const [x, y, z] of [[0.15, 0.36, 0.15], [-0.15, 0.36, 0.15], [0.05, 0.4, 0.15], [-0.05, 0.4, 0.15], [0.26, 0.26, 0.04], [-0.26, 0.26, 0.04]] as V3[]) H(blackPower(), [x, y, z], [0.07, 0.07, 0.07]);
      return;
    case "trancas": {
      H(calota(Math.PI * 0.5, -0.36), [0, 0.205, 0], kk); nuca();
      const ponta = misturar(cab, "#D4A63A", 0.55);
      for (let i = 0; i < 7; i++) {
        const a = -1.05 + (i * 2.1) / 6, x = Math.sin(a) * 0.205, z = -Math.cos(a) * 0.17 - 0.03;
        p.push({ osso: "head", geo: capsula(0.024, 0.3, 6), cor: cab, pos: [x, 0.27, z], rot: [0.12, 0, Math.sin(a) * 0.18] });
        H(esfera(0.028, 6, 5), [x + Math.sin(a) * 0.054, -0.06, z - 0.04], [1, 1, 1], undefined, ponta);
      }
      return;
    }
  }
}

// boca de cada jeito; z = onde fica (um pouco mais à frente por cima da barba)
function boca(def: BonecoDef, z: number): Peca[] {
  switch (def.boca ?? "sorriso") {
    case "risada": return [{ osso: "head", geo: bola(10, 6), cor: "#5A1F1A", pos: [0, 0.12, z - 0.002], esc: [0.036, 0.022, 0.012] }, { osso: "head", geo: caixa(0.042, 0.01, 0.006), cor: "#FFFFFF", pos: [0, 0.133, z + 0.009] }];
    case "neutra": return [{ osso: "head", geo: caixa(0.046, 0.009, 0.01), cor: "#9E3B30", pos: [0, 0.126, z + 0.003] }];
    case "deLado": return [{ osso: "head", geo: anel(0.03, 0.008, Math.PI), cor: "#9E3B30", pos: [0.012, 0.125, z], rot: [-0.25, 0, Math.PI + 0.35] }];
    default: return [{ osso: "head", geo: anel(0.034, 0.008, Math.PI), cor: "#9E3B30", pos: [0, 0.122, z], rot: [-0.25, 0, Math.PI] }]; // sorriso
  }
}

export function pecas(def: BonecoDef, camisa: string, cracha: string, headset: boolean, semChapeu = false, semOculos = false): Peca[] {
  const { pele, cabelo: cab, calca } = def; const preto = "#2A2D33";
  const traje = def.traje ?? "camisa";
  const praia = traje === "semCamisa" || traje === "biquini" || traje === "saida"; // perna de fora, chinelo, sem crachá
  const vestido = traje === "vestido";
  const terno = traje === "terno" || traje === "ternoGrife";
  const mangaLonga = traje === "blazer" || traje === "moletom" || traje === "jaqueta" || traje === "social" || terno || traje === "jaquetaCouro";
  const semManga = traje === "regata" || traje === "semCamisa" || traje === "biquini";
  const corTronco = traje === "semCamisa" || traje === "biquini" ? pele : camisa;
  const peleSombra = escurecer(pele, 0.08);
  const { lg, lb } = corpoDe(def);
  const baixo = praia || vestido ? null : def.baixo ?? "calca"; // na praia e de vestido quem manda é o traje
  const sapato = praia ? "chinelo" : def.sapato ?? "tenis";
  const F = (x: number, y: number, z: number): V3 => [x * lg, y, z * lg]; // ponto do peito acompanhando a largura do corpo
  const p: Peca[] = [];
  // quadril e pernas
  p.push({ osso: "hips", geo: bola(), cor: vestido ? camisa : calca, pos: [0, 0.03, 0], esc: [0.16 * lg, 0.085, 0.1 * lg] });
  if (!praia && !vestido) p.push({ osso: "hips", geo: anel(0.148, 0.012), cor: preto, pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0], esc: [lg, 0.74 * lg, 1] }); // cinto
  for (const lado of ["L", "R"] as const) {
    const sx = lado === "L" ? 1 : -1;
    const pernaDeFora = praia || vestido || baixo === "saia";
    const canelaDeFora = pernaDeFora || baixo === "bermuda";
    p.push(
      { osso: `upperLeg${lado}`, geo: capsula(S.pernaR * lb, S.coxaL), cor: pernaDeFora ? pele : calca },
      { osso: `lowerLeg${lado}`, geo: capsula(S.pernaR * 0.88 * lb, S.canelaL), cor: canelaDeFora ? pele : calca },
    );
    if (praia && traje !== "saida") p.push({ osso: `upperLeg${lado}`, geo: capsula(S.pernaR * 1.12 * lb, S.coxaL * 0.45), cor: calca }); // bermuda/biquíni
    if (baixo === "bermuda") p.push({ osso: `upperLeg${lado}`, geo: anel(S.pernaR * lb + 0.004, 0.013), cor: escurecer(calca, 0.18), pos: [0, -S.coxaL + 0.01, 0], rot: [Math.PI / 2, 0, 0] }); // barra no joelho
    if (baixo === "jeans") p.push(
      { osso: `lowerLeg${lado}`, geo: anel(S.pernaR * 0.88 * lb + 0.003, 0.016), cor: misturar(calca, "#FFFFFF", 0.22), pos: [0, -S.canelaL + 0.02, 0], rot: [Math.PI / 2, 0, 0] }, // barra dobrada
      { osso: `upperLeg${lado}`, geo: caixa(0.006, S.coxaL, 0.006), cor: misturar(calca, "#E9C46A", 0.45), pos: [sx * S.pernaR * lb * 0.98, -S.coxaL / 2, 0] }, // costura de fora
    );
    // pés: chinelo na praia; tênis modelado (cabedal, sola, listra e cadarço); sapato social, sandália e tênis de grife
    const pe = `foot${lado}` as const;
    const cs = def.calcado ?? "#F4F4F4";
    if (sapato === "chinelo") p.push(
      { osso: pe, geo: bola(), cor: pele, pos: [0, -0.005, 0.04], esc: [0.05, 0.032, 0.105] },
      { osso: pe, geo: bola(12, 6), cor: "#3B2A22", pos: [0, -0.033, 0.035], esc: [0.062, 0.012, 0.12] },
    );
    else if (sapato === "sandalia") p.push(
      { osso: pe, geo: bola(), cor: pele, pos: [0, -0.005, 0.04], esc: [0.05, 0.032, 0.105] },
      { osso: pe, geo: bola(12, 6), cor: cs, pos: [0, -0.033, 0.035], esc: [0.064, 0.013, 0.122] },
      { osso: pe, geo: caixa(0.104, 0.014, 0.026), cor: cs, pos: [0, 0.024, 0.075] }, // tira da frente
      { osso: pe, geo: caixa(0.108, 0.016, 0.022), cor: cs, pos: [0, 0.03, -0.02] }, // tira do tornozelo
    );
    else if (sapato === "social") p.push(
      { osso: pe, geo: bola(12, 8), cor: cs, pos: [0, 0, 0.042], esc: [0.058, 0.042, 0.13] },
      { osso: pe, geo: bola(12, 5), cor: "#17191D", pos: [0, -0.028, 0.044], esc: [0.062, 0.012, 0.134] },
      { osso: pe, geo: caixa(0.06, 0.022, 0.045), cor: "#17191D", pos: [0, -0.03, -0.045] }, // salto
      { osso: pe, geo: bola(8, 6), cor: misturar(cs, "#FFFFFF", 0.35), pos: [0, 0.03, 0.09], esc: [0.026, 0.008, 0.03] }, // brilho do couro
    );
    else if (sapato === "tenisGrife") p.push(
      { osso: pe, geo: bola(12, 8), cor: cs, pos: [0, 0.014, 0.035], esc: [0.066, 0.058, 0.122] },
      { osso: pe, geo: cilindro(0.058, 0.062, 0.06, 12), cor: cs, pos: [0, 0.06, -0.005] }, // cano alto
      { osso: pe, geo: anel(0.058, 0.01), cor: "#D4A63A", pos: [0, 0.09, -0.005], rot: [Math.PI / 2, 0, 0] }, // gola dourada
      { osso: pe, geo: bola(12, 5), cor: "#FFFFFF", pos: [0, -0.026, 0.036], esc: [0.072, 0.02, 0.13] },
      { osso: pe, geo: caixa(0.006, 0.018, 0.09), cor: "#D4A63A", pos: [0.066, 0.01, 0.03] },
      { osso: pe, geo: caixa(0.006, 0.018, 0.09), cor: "#D4A63A", pos: [-0.066, 0.01, 0.03] },
      { osso: pe, geo: caixa(0.044, 0.008, 0.012), cor: "#FFFFFF", pos: [0, 0.07, 0.058] },
    );
    else {
      const sola = def.tenis ? "#1F2227" : misturar(cs, "#FFFFFF", 0.6);
      p.push(
        { osso: pe, geo: bola(12, 8), cor: cs, pos: [0, 0.008, 0.035], esc: [0.064, 0.05, 0.12] },
        { osso: pe, geo: bola(12, 5), cor: sola, pos: [0, -0.024, 0.036], esc: [0.07, 0.019, 0.127] },
        { osso: pe, geo: caixa(0.044, 0.008, 0.012), cor: "#FFFFFF", pos: [0, 0.056, 0.058] },
        { osso: pe, geo: caixa(0.04, 0.008, 0.012), cor: "#FFFFFF", pos: [0, 0.05, 0.088] },
      );
      if (def.tenis) p.push({ osso: pe, geo: bola(12, 5), cor: def.tenis, pos: [0, 0.012, 0.028], esc: [0.067, 0.011, 0.088] });
    }
    // braços: ombro arredondado, manga (curta ou comprida) e a mão com polegar
    const corManga = semManga ? pele : camisa;
    p.push({ osso: `upperArm${lado}`, geo: esfera((semManga ? 0.052 : 0.058) * lb, 10, 8), cor: semManga ? pele : camisa });
    if (mangaLonga) p.push(
      { osso: `upperArm${lado}`, geo: capsula(0.058 * lb, S.bracoL), cor: camisa },
      { osso: `lowerArm${lado}`, geo: capsula(0.052 * lb, S.antebracoL), cor: camisa },
      { osso: `lowerArm${lado}`, geo: anel(0.046 * lb, 0.012), cor: terno ? "#F4F4F0" : escurecer(camisa, traje === "moletom" ? 0.15 : traje === "social" ? 0.1 : 0.25), pos: [0, -S.antebracoL + 0.005, 0], rot: [Math.PI / 2, 0, 0] }, // punho
    );
    else p.push(
      { osso: `upperArm${lado}`, geo: capsula(S.bracoR * 0.86 * lb, S.bracoL, 10), cor: pele },
      { osso: `lowerArm${lado}`, geo: capsula(S.bracoR * 0.8 * lb, S.antebracoL, 10), cor: pele },
    );
    if (!semManga && !mangaLonga) p.push({ osso: `upperArm${lado}`, geo: cilindro(0.058 * lb, 0.055 * lb, S.bracoL * 0.5, 14), cor: corManga, pos: [0, -S.bracoL * 0.25, 0] }); // manga curta com barra
    if (traje === "polo") p.push({ osso: `upperArm${lado}`, geo: anel(0.056 * lb, 0.009), cor: escurecer(camisa, 0.18), pos: [0, -S.bracoL * 0.5 + 0.004, 0], rot: [Math.PI / 2, 0, 0] }); // barra da manga
    if (traje === "blusa") p.push({ osso: `upperArm${lado}`, geo: esfera(0.07 * lb, 10, 8), cor: camisa, pos: [0, -0.025, 0], esc: [1, 0.8, 1] }); // manga bufante
    p.push(
      { osso: `hand${lado}`, geo: bola(10, 8), cor: pele, pos: [0, -0.035, 0], esc: [0.045, 0.058, 0.033] },
      { osso: `hand${lado}`, geo: esfera(0.018, 6, 5), cor: pele, pos: [-sx * 0.01, -0.025, 0.03] }, // polegar
    );
  }
  if (baixo === "saia") p.push({ osso: "hips", geo: saiaCurta(), cor: calca, pos: [0, 0, 0], esc: [lg, 1, 0.84 * lg] });
  // tronco (camiseta, blazer, jaqueta, moletom, regata, vestido ou pele) e pescoço
  p.push({ osso: "chest", geo: tronco(), cor: corTronco, pos: [0, 0, 0], esc: [lg, 1, 0.76 * lg] });
  p.push({ osso: "head", geo: cilindro(0.066, 0.07, 0.12, 10), cor: peleSombra, pos: [0, 0.0, -0.005] });
  if (traje === "camisa") p.push(
    { osso: "chest", geo: caixa(0.045, 0.06, 0.006), cor: cracha, pos: F(-0.088, -0.01, 0.104), rot: [0, -0.62, 0] }, // crachá
    { osso: "chest", geo: anel(0.078, 0.016), cor: escurecer(camisa, 0.12), pos: F(0, 0.335, 0.005), rot: [Math.PI / 2 - 0.25, 0, 0], esc: [lg, 0.85 * lg, 1] }, // gola
  );
  if (traje === "blazer") {
    const lapela = escurecer(camisa, 0.28);
    p.push(
      { osso: "chest", geo: caixa(0.1, 0.25, 0.012), cor: "#F4F4F0", pos: F(0, 0.2, 0.128) }, // camiseta por baixo
      { osso: "chest", geo: caixa(0.05, 0.22, 0.014), cor: lapela, pos: F(0.065, 0.22, 0.126), rot: [0, 0.25, 0.32] },
      { osso: "chest", geo: caixa(0.05, 0.22, 0.014), cor: lapela, pos: F(-0.065, 0.22, 0.126), rot: [0, -0.25, -0.32] },
      { osso: "chest", geo: esfera(0.013, 8, 6), cor: "#1F2227", pos: F(0.055, 0.07, 0.13) },
      { osso: "hips", geo: bola(), cor: camisa, pos: [0, 0.06, 0], esc: [0.17 * lg, 0.06, 0.118 * lg] }, // barra do blazer
    );
  }
  if (traje === "jaqueta") p.push(
    { osso: "chest", geo: caixa(0.012, 0.42, 0.01), cor: "#C9CDD3", pos: F(0, 0.1, 0.133) }, // zíper
    { osso: "chest", geo: anel(0.085, 0.024), cor: escurecer(camisa, 0.15), pos: F(0, 0.33, 0), rot: [Math.PI / 2 - 0.15, 0, 0], esc: [lg, 0.85 * lg, 1] }, // gola alta
    { osso: "hips", geo: anel(0.15, 0.02), cor: escurecer(camisa, 0.2), pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], esc: [lg, 0.78 * lg, 1] }, // barra
  );
  if (traje === "moletom") p.push(
    { osso: "chest", geo: bola(), cor: escurecer(camisa, 0.1), pos: F(0, 0.31, -0.1), esc: [0.15 * lg, 0.09, 0.085 * lg], rot: [-0.4, 0, 0] }, // capuz caído nas costas
    { osso: "chest", geo: caixa(0.17, 0.09, 0.012), cor: escurecer(camisa, 0.12), pos: F(0, -0.06, 0.122) }, // bolso canguru
    { osso: "chest", geo: caixa(0.008, 0.09, 0.008), cor: "#F4F4F0", pos: F(0.03, 0.25, 0.128) }, // cordões
    { osso: "chest", geo: caixa(0.008, 0.09, 0.008), cor: "#F4F4F0", pos: F(-0.03, 0.25, 0.128) },
    { osso: "hips", geo: anel(0.15, 0.022), cor: escurecer(camisa, 0.15), pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], esc: [lg, 0.78 * lg, 1] },
  );
  // roupas novas (20/11/2026)
  if (traje === "social") {
    const esc = escurecer(camisa, 0.12), claro = misturar(camisa, "#FFFFFF", 0.6);
    p.push(
      { osso: "chest", geo: anel(0.08, 0.017), cor: esc, pos: F(0, 0.335, 0.004), rot: [Math.PI / 2 - 0.25, 0, 0], esc: [lg, 0.86 * lg, 1] }, // gola
      { osso: "chest", geo: caixa(0.05, 0.034, 0.01), cor: esc, pos: [0.028 * lg, 0.312, zPeito(0.312, 0.028, lg) + 0.004], rot: [0.5, 0, -0.6] }, // pontas da gola
      { osso: "chest", geo: caixa(0.05, 0.034, 0.01), cor: esc, pos: [-0.028 * lg, 0.312, zPeito(0.312, 0.028, lg) + 0.004], rot: [0.5, 0, 0.6] },
      { osso: "chest", geo: caixa(0.02, 0.26, 0.006), cor: esc, pos: [0, 0.15, zPeito(0.15, 0, lg) + 0.001], rot: [-0.05, 0, 0] }, // vista dos botões
    );
    for (const y of [0.05, 0.12, 0.19, 0.26]) p.push({ osso: "chest", geo: esfera(0.007, 6, 4), cor: claro, pos: [0, y, zPeito(y, 0, lg) + 0.005] });
    const bolso = pontoNoPeito(0.17, 0.075 * lg, lg);
    p.push({ osso: "chest", geo: caixa(0.05, 0.05, 0.005), cor: esc, pos: [0.075 * lg, 0.17, bolso.z + 0.002], rot: [0, bolso.giro, 0] }); // bolso
  }
  if (traje === "polo") {
    const gola = escurecer(camisa, 0.1);
    p.push(
      { osso: "chest", geo: anel(0.082, 0.022), cor: gola, pos: F(0, 0.33, 0.004), rot: [Math.PI / 2 - 0.3, 0, 0], esc: [lg, 0.86 * lg, 0.7] }, // gola
      { osso: "chest", geo: caixa(0.03, 0.09, 0.006), cor: gola, pos: [0, 0.27, zPeito(0.27, 0, lg) + 0.002], rot: [-0.15, 0, 0] }, // carcela
      { osso: "chest", geo: esfera(0.007, 6, 4), cor: "#F4F4F0", pos: [0, 0.29, zPeito(0.29, 0, lg) + 0.006] },
      { osso: "chest", geo: esfera(0.007, 6, 4), cor: "#F4F4F0", pos: [0, 0.255, zPeito(0.255, 0, lg) + 0.006] },
    );
  }
  if (traje === "blusa") p.push(
    { osso: "chest", geo: bola(10, 8), cor: pele, pos: [0, 0.305, zPeito(0.305, 0, lg) - 0.03], esc: [0.085 * lg, 0.05, 0.04] }, // decote
    { osso: "hips", geo: bola(), cor: camisa, pos: [0, 0.075, 0], esc: [0.175 * lg, 0.055, 0.125 * lg] }, // babado da barra
  );
  if (terno) {
    const grife = traje === "ternoGrife";
    const lapela = grife ? "#14161A" : escurecer(camisa, 0.22), botao = grife ? "#D4A63A" : "#1F2227", gravata = grife ? "#14161A" : "#8B1E2D";
    p.push(
      { osso: "chest", geo: caixa(0.085, 0.2, 0.012), cor: "#F4F4F0", pos: F(0, 0.23, 0.127) }, // camisa por baixo
      { osso: "chest", geo: caixa(0.028, 0.16, 0.012), cor: gravata, pos: F(0, 0.2, 0.135), rot: [-0.05, 0, 0] }, // gravata
      { osso: "chest", geo: caixa(0.034, 0.028, 0.016), cor: gravata, pos: F(0, 0.3, 0.123) }, // nó
      { osso: "chest", geo: caixa(0.05, 0.24, 0.014), cor: lapela, pos: F(0.055, 0.2, 0.128), rot: [0, 0.25, 0.26] },
      { osso: "chest", geo: caixa(0.05, 0.24, 0.014), cor: lapela, pos: F(-0.055, 0.2, 0.128), rot: [0, -0.25, -0.26] },
      { osso: "chest", geo: esfera(0.012, 8, 6), cor: botao, pos: F(0, 0.07, 0.133) },
      { osso: "chest", geo: esfera(0.012, 8, 6), cor: botao, pos: F(0, 0, 0.13) },
      { osso: "hips", geo: bola(), cor: camisa, pos: [0, 0.06, 0], esc: [0.17 * lg, 0.06, 0.118 * lg] }, // barra do paletó
    );
    if (grife) {
      const lenco = pontoNoPeito(0.2, 0.1 * lg, lg), broche = pontoNoPeito(0.25, 0.075 * lg, lg);
      p.push(
        { osso: "chest", geo: caixa(0.036, 0.018, 0.008), cor: "#F4F4F0", pos: [0.1 * lg, 0.2, lenco.z + 0.004], rot: [0, lenco.giro, 0] }, // lenço no bolso
        { osso: "chest", geo: esfera(0.009, 6, 5), cor: "#D4A63A", pos: [-0.075 * lg, 0.25, broche.z + 0.014] }, // broche
        { osso: "chest", geo: caixa(0.04, 0.006, 0.006), cor: "#D4A63A", pos: F(0, 0.18, 0.142) }, // prendedor de gravata
      );
    }
  }
  if (traje === "jaquetaCouro") {
    const lap = escurecer(camisa, 0.3), metal = "#C9CDD3";
    p.push(
      { osso: "chest", geo: caixa(0.1, 0.25, 0.012), cor: "#F4F4F0", pos: F(0, 0.2, 0.127) }, // camiseta por baixo
      { osso: "chest", geo: caixa(0.07, 0.2, 0.016), cor: lap, pos: F(0.07, 0.24, 0.124), rot: [0, 0.3, 0.42] }, // lapela larga
      { osso: "chest", geo: caixa(0.07, 0.2, 0.016), cor: lap, pos: F(-0.07, 0.24, 0.124), rot: [0, -0.3, -0.42] },
      { osso: "chest", geo: caixa(0.007, 0.32, 0.008), cor: metal, pos: F(0.075, 0.08, 0.128), rot: [0, 0.3, 0.06] }, // zíper
      { osso: "hips", geo: anel(0.15, 0.02), cor: lap, pos: [0, 0.085, 0], rot: [Math.PI / 2, 0, 0], esc: [lg, 0.78 * lg, 1] }, // barra com cinto
      { osso: "hips", geo: caixa(0.03, 0.026, 0.012), cor: metal, pos: [0.105 * lg, 0.085, 0.085 * lg], rot: [0, 0.6, 0] }, // fivela
    );
  }
  if (vestido) p.push({ osso: "hips", geo: saia(), cor: camisa, pos: [0, 0, 0], esc: [lg, 1, 0.82 * lg] });
  if (traje === "biquini") p.push({ osso: "chest", geo: bola(), cor: camisa, pos: F(0, 0.2, 0.04), esc: [0.17 * lg, 0.06, 0.12 * lg] }); // top
  if (traje === "saida") p.push({ osso: "hips", geo: cilindro(0.17, 0.3, 0.3, 14), cor: camisa, pos: [0, -0.1, 0], esc: [lg, 1, lg] }); // saída de praia (saia)
  if (def.prancha) p.push(
    { osso: "chest", geo: bola(), cor: def.prancha, pos: F(-0.3, 0.05, 0), esc: [0.05, 0.62, 0.17] }, // prancha debaixo do braço
    { osso: "chest", geo: bola(), cor: "#1F2227", pos: F(-0.33, 0.05, 0), esc: [0.012, 0.5, 0.03] }, // listra
  );
  if (def.chapeu && !semChapeu) p.push( // chapéu do tipo de boneco sai quando ele usa um acessório na cabeça
    { osso: "head", geo: cilindro(0.34, 0.34, 0.02, 18), cor: def.chapeu, pos: [0, 0.36, -0.02] },
    { osso: "head", geo: cilindro(0.19, 0.21, 0.12, 18), cor: def.chapeu, pos: [0, 0.42, -0.02] },
  );
  // cabeça e rosto: orelhas, olhos com brilho, sobrancelhas, nariz e boca
  const sobrancelha = def.estiloCabelo === "careca" ? escurecer(pele, 0.45) : escurecer(cab, 0.1);
  const olhos = def.olhos ?? "redondos", iris = def.corOlhos ?? "#2B1D16", sob = def.sobrancelha ?? "normal";
  const sb = sob === "finas" ? { y: 0.272, e: [0.042, 0.0065, 0.012] as V3, r: 0.12 } : sob === "grossas" ? { y: 0.274, e: [0.047, 0.017, 0.017] as V3, r: 0.1 } : sob === "arqueadas" ? { y: 0.279, e: [0.044, 0.011, 0.014] as V3, r: 0.32 } : { y: 0.272, e: [0.043, 0.011, 0.014] as V3, r: 0.12 };
  p.push({ osso: "head", geo: esfera(R, 22, 16), cor: pele, pos: [0, 0.2, 0], esc: [1, 1.04, 0.97] });
  for (const s of [1, -1]) {
    p.push({ osso: "head", geo: bola(8, 6), cor: peleSombra, pos: [s * 0.223, 0.2, 0.0], esc: [0.034, 0.058, 0.044] }); // orelha
    if (olhos === "felizes") p.push({ osso: "head", geo: anel(0.028, 0.007, Math.PI), cor: "#2B1D16", pos: [s * 0.076, 0.2, 0.222], rot: [-0.15, 0, 0] }); // olhos fechados sorrindo
    else if (olhos === "amendoados") p.push(
      { osso: "head", geo: bola(10, 8), cor: "#FAFAF7", pos: [s * 0.078, 0.212, 0.2], esc: [0.047, 0.032, 0.022], rot: [0, 0, s * 0.16] },
      { osso: "head", geo: esfera(0.02, 8, 6), cor: iris, pos: [s * 0.078, 0.211, 0.213] },
      { osso: "head", geo: esfera(0.006, 5, 4), cor: "#FFFFFF", pos: [s * 0.071, 0.217, 0.231] },
    );
    else if (olhos === "grandes") p.push(
      { osso: "head", geo: bola(10, 8), cor: "#FAFAF7", pos: [s * 0.078, 0.216, 0.199], esc: [0.049, 0.056, 0.024] },
      { osso: "head", geo: esfera(0.027, 8, 6), cor: iris, pos: [s * 0.078, 0.212, 0.212] },
      { osso: "head", geo: esfera(0.009, 5, 4), cor: "#FFFFFF", pos: [s * 0.069, 0.224, 0.238] },
      { osso: "head", geo: esfera(0.005, 5, 4), cor: "#FFFFFF", pos: [s * 0.086, 0.203, 0.236] },
    );
    else p.push(
      { osso: "head", geo: bola(10, 8), cor: "#FAFAF7", pos: [s * 0.076, 0.214, 0.201], esc: [0.04, 0.046, 0.022] }, // olho
      { osso: "head", geo: esfera(0.022, 8, 6), cor: iris, pos: [s * 0.076, 0.211, 0.214] }, // íris
      { osso: "head", geo: esfera(0.007, 5, 4), cor: "#FFFFFF", pos: [s * 0.069, 0.221, 0.233] }, // brilho
    );
    if (olhos === "sonolentos") p.push({ osso: "head", geo: bola(10, 6), cor: escurecer(pele, 0.04), pos: [s * 0.076, 0.236, 0.206], esc: [0.045, 0.026, 0.032] }); // pálpebra
    p.push({ osso: "head", geo: bola(6, 4), cor: sobrancelha, pos: [s * 0.078, sb.y, 0.207], esc: sb.e, rot: [0, 0, s * sb.r] }); // sobrancelha
  }
  p.push({ osso: "head", geo: bola(8, 6), cor: peleSombra, pos: [0, 0.168, 0.224], esc: [0.026, 0.034, 0.028] }, ...boca(def, 0.214)); // nariz e boca
  const barba = def.barba ?? "nenhuma";
  if (barba === "rala" || barba === "cheia") p.push({ osso: "head", geo: bola(14, 10), cor: barba === "rala" ? misturar(pele, cab, 0.55) : cab, pos: [0, barba === "rala" ? 0.075 : 0.07, 0.048], esc: barba === "rala" ? [0.198, 0.103, 0.18] : [0.203, 0.11, 0.186] });
  if (barba === "cavanhaque") p.push({ osso: "head", geo: bola(10, 8), cor: cab, pos: [0, 0.078, 0.19], esc: [0.05, 0.042, 0.035] });
  if (barba === "cheia" || barba === "bigode" || barba === "cavanhaque") p.push({ osso: "head", geo: bola(10, 6), cor: cab, pos: [0, 0.143, 0.224], esc: [0.058, 0.016, 0.02] }); // bigode
  if (barba === "rala" || barba === "cheia") p.push(...boca(def, 0.236)); // boca por cima da barba
  // sardas, pinta e bochecha rosada (20/11/2026)
  const marcas = def.marcas ?? "nenhuma";
  if (marcas === "sardas") { const c = misturar(pele, "#7A3E1E", 0.42); for (const s of [1, -1]) for (const [x, y] of [[0.055, 0.175], [0.085, 0.168], [0.105, 0.18], [0.07, 0.155], [0.095, 0.15]]) p.push({ osso: "head", geo: esfera(0.0055, 5, 4), cor: c, pos: [s * x, y, zRosto(x, y) + 0.001] }); }
  if (marcas === "pinta") p.push({ osso: "head", geo: esfera(0.0085, 6, 5), cor: "#3B2418", pos: [0.062, 0.135, zRosto(0.062, 0.135) + 0.002] });
  if (marcas === "rosadas") for (const s of [1, -1]) p.push({ osso: "head", geo: bola(8, 6), cor: misturar(pele, "#F06A7A", 0.4), pos: [s * 0.115, 0.165, zRosto(0.115, 0.165) - 0.004], esc: [0.038, 0.024, 0.012], rot: [0, s * 0.55, 0] });
  // óculos de grau quadrado e gatinho: armação opaca na mesma malha (o redondo continua sendo a malha transparente de antes)
  const om = def.oculosModelo ?? "redondo";
  if (def.oculos && !semOculos && om !== "redondo") {
    const aro = om === "gatinho" ? "#5A2E1E" : "#1F2227", w = 0.088, h = om === "gatinho" ? 0.054 : 0.06, cy = 0.214, z = 0.24;
    for (const s of [1, -1]) {
      const cx = s * 0.076;
      p.push(
        { osso: "head", geo: caixa(w + 0.01, 0.01, 0.01), cor: aro, pos: [cx, cy + h / 2, z], rot: [0, 0, om === "gatinho" ? s * 0.12 : 0] },
        { osso: "head", geo: caixa(w + 0.01, 0.009, 0.01), cor: aro, pos: [cx, cy - h / 2, z] },
        { osso: "head", geo: caixa(0.01, h, 0.01), cor: aro, pos: [cx + (s * w) / 2, cy, z - 0.004] },
        { osso: "head", geo: caixa(0.01, h, 0.01), cor: aro, pos: [cx - (s * w) / 2, cy, z] },
        { osso: "head", geo: caixa(0.012, 0.012, 0.26), cor: aro, pos: [s * 0.185, 0.222, 0.115], rot: [0, -s * 0.48, 0] }, // haste
      );
      if (om === "gatinho") p.push({ osso: "head", geo: caixa(0.03, 0.014, 0.01), cor: aro, pos: [cx + s * 0.05, cy + h / 2 + 0.008, z - 0.004], rot: [0, 0, s * 0.55] });
    }
    p.push({ osso: "head", geo: caixa(0.066, 0.009, 0.009), cor: aro, pos: [0, 0.222, 0.242] }); // ponte
  }
  cabelo(p, def.estiloCabelo, cab, pele);
  if (headset) p.push(
    { osso: "head", geo: caixa(0.06, 0.08, 0.06), cor: preto, pos: [0.24, 0.17, 0.02] },
    { osso: "head", geo: caixa(0.06, 0.08, 0.06), cor: preto, pos: [-0.24, 0.17, 0.02] },
    { osso: "head", geo: arco(), cor: preto, pos: [0, 0.2, 0.02], esc: [1.06, 1.06, 1.06] },
    { osso: "head", geo: caixa(0.015, 0.015, 0.14), cor: preto, pos: [0.15, 0.1, 0.11], rot: [0, 0.9, 0] },
  );
  return p;
}

// Geometria do boneco (pose de descanso) com cor e osso de cada vértice. Uma por aparência, compartilhada.
// 20/11/2026: com o editor a pessoa troca cor e peça à vontade, então o guarda-volumes conta quem usa cada geometria e
// joga fora as que ninguém usa quando passa de LIMITE_CACHE (as criadas há menos de 5 s ficam, para não sumir no meio
// da montagem de um boneco).
type Guardada = { geo: THREE.BufferGeometry; usos: number; em: number };
const bonecoCache = new Map<string, Guardada>();
const LIMITE_CACHE = 48;
const agora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
export function chaveBoneco(def: BonecoDef, camisa: string, cracha: string, headset: boolean, semChapeu = false, semOculos = false) {
  return ["v3", def.id, def.pele, def.cabelo, def.calca, def.estiloCabelo, def.traje ?? "", def.tenis ?? "", def.calcado ?? "", def.barba ?? "", def.prancha ?? "", def.chapeu ?? "", camisa, cracha, headset, semChapeu,
    def.biotipo ?? "", def.olhos ?? "", def.corOlhos ?? "", def.sobrancelha ?? "", def.boca ?? "", def.marcas ?? "", def.oculos && (def.oculosModelo ?? "redondo") !== "redondo" ? `${def.oculosModelo}${semOculos}` : "", def.baixo ?? "", def.sapato ?? ""].join("|");
}
export function montarGeometria(lista: Peca[]) {
  const repouso = {} as Record<Osso, THREE.Matrix4>;
  for (const nome of OSSOS) { const [pai, p] = OSSO_PAI[nome]; const local = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]); repouso[nome] = pai ? new THREE.Matrix4().multiplyMatrices(repouso[pai], local) : local; }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cor = new THREE.Color();
  const partes = lista.map((pc) => {
    // com índice (16/11/2026): cada vértice é deformado uma vez só; sem índice a malha tinha 3 vezes mais vértices
    const geo = pc.geo.clone();
    if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, i) => i));
    for (const nome of Object.keys(geo.attributes)) if (nome !== "position" && nome !== "normal") geo.deleteAttribute(nome);
    e.set(...(pc.rot ?? [0, 0, 0])); q.setFromEuler(e);
    m.compose(new THREE.Vector3(...(pc.pos ?? [0, 0, 0])), q, new THREE.Vector3(...(pc.esc ?? [1, 1, 1])));
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(repouso[pc.osso], m));
    const n = geo.attributes.position.count, i0 = OSSOS.indexOf(pc.osso);
    const cores = new Float32Array(n * 3), indices = new Uint16Array(n * 4), pesos = new Float32Array(n * 4);
    cor.set(pc.cor);
    for (let i = 0; i < n; i++) { cores[i * 3] = cor.r; cores[i * 3 + 1] = cor.g; cores[i * 3 + 2] = cor.b; indices[i * 4] = i0; pesos[i * 4] = 1; }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(pesos, 4));
    return geo;
  });
  const geo = mergeGeometries(partes, false)!;
  partes.forEach((x) => x.dispose());
  geo.computeBoundingSphere();
  return geo;
}
export function geometriaBoneco(def: BonecoDef, camisa: string, cracha: string, headset: boolean, semChapeu = false, semOculos = false) {
  const k = chaveBoneco(def, camisa, cracha, headset, semChapeu, semOculos);
  const pronta = bonecoCache.get(k); if (pronta) { pronta.em = agora(); return { k, geo: pronta.geo }; }
  const geo = montarGeometria(pecas(def, camisa, cracha, headset, semChapeu, semOculos));
  bonecoCache.set(k, { geo, usos: 0, em: agora() });
  return { k, geo };
}
export function reterGeometria(k: string) { const x = bonecoCache.get(k); if (x) x.usos++; }
export function soltarGeometria(k: string) {
  const x = bonecoCache.get(k); if (x) x.usos = Math.max(0, x.usos - 1);
  if (bonecoCache.size <= LIMITE_CACHE) return;
  const t = agora();
  for (const [kk, v] of bonecoCache) { if (bonecoCache.size <= LIMITE_CACHE) break; if (v.usos === 0 && t - v.em > 5000) { v.geo.dispose(); bonecoCache.delete(kk); } }
}
export const geometriasGuardadas = () => bonecoCache.size; // testes (?medir=1)
