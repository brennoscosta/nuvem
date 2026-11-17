"use client";
// Boneco com esqueleto. Duas versões com os MESMOS ossos e as MESMAS animações:
//  - BonecoProcedural: desenhado em código (leve, cor da camisa e logo por material)
//  - BonecoGLB: modelo gerado no Higgsfield + esqueleto do scripts/bonecos/rig.mjs
import * as THREE from "three";
import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import type { Boneco as BonecoDef } from "../data/bonecos";
import { ACESSORIO_POR_ID, limparEquipados } from "../data/acessorios";

export type Pose = "idle" | "walk" | "sit" | "type" | "celebrate" | "think" | "blocked" | "carry";

const OSSOS = ["hips", "spine", "chest", "head", "upperArmL", "lowerArmL", "handL", "upperArmR", "lowerArmR", "handR", "upperLegL", "lowerLegL", "footL", "upperLegR", "lowerLegR", "footR"] as const;
type Osso = (typeof OSSOS)[number];
export type Ossos = Partial<Record<Osso, THREE.Object3D>>;

export interface BonecoHandle { ossos: Ossos; raiz: THREE.Group | null }

const D = Math.PI / 180;
const tmpE = new THREE.Euler();

// Pose alvo (graus) por osso. Oscilações usam t (segundos).
function alvo(pose: Pose, t: number, fase: number): Partial<Record<Osso, [number, number, number]>> & { hipsY?: number } {
  const s = (f: number, a: number, o = 0) => Math.sin(t * f + fase + o) * a;
  switch (pose) {
    case "walk": {
      const w = 9;
      return {
        hipsY: Math.abs(Math.sin(t * w + fase)) * 0.03,
        upperLegL: [s(w, 32), 0, 0], lowerLegL: [Math.max(0, -s(w, 45, 0.6)) + 5, 0, 0],
        upperLegR: [-s(w, 32), 0, 0], lowerLegR: [Math.max(0, s(w, 45, 0.6)) + 5, 0, 0],
        upperArmL: [-s(w, 24), 0, -8], upperArmR: [s(w, 24), 0, 8], lowerArmL: [-12, 0, 0], lowerArmR: [-12, 0, 0],
        spine: [4, s(w / 2, 3), 0], head: [-3, s(w / 2, 3), 0],
      };
    }
    case "sit":
    case "type": {
      const dig = pose === "type";
      return {
        hipsY: -0.07,
        upperLegL: [-88, 0, 4], lowerLegL: [88, 0, 0], upperLegR: [-88, 0, -4], lowerLegR: [88, 0, 0],
        upperArmL: [-58, 0, -10], lowerArmL: [-38 + (dig ? s(14, 5) : 0), 0, 0], handL: [dig ? s(18, 12) : 0, 0, 0],
        upperArmR: [-58, 0, 10], lowerArmR: [-38 + (dig ? s(14, 5, 1.5) : 0), 0, 0], handR: [dig ? s(18, 12, 2) : 0, 0, 0],
        spine: [6, 0, 0], head: [10 + (dig ? s(1.2, 3) : 0), dig ? s(0.9, 6) : 0, 0],
      };
    }
    case "celebrate": {
      const j = Math.abs(Math.sin(t * 7 + fase));
      return {
        hipsY: j * 0.09,
        upperArmL: [s(7, 10), 0, 125 + s(7, 12)], upperArmR: [s(7, 10), 0, -125 - s(7, 12)], lowerArmL: [0, 0, 20], lowerArmR: [0, 0, -20],
        upperLegL: [-j * 10, 0, 0], upperLegR: [-j * 10, 0, 0], lowerLegL: [j * 18, 0, 0], lowerLegR: [j * 18, 0, 0],
        head: [-12, s(3, 8), 0], spine: [-4, 0, 0],
      };
    }
    case "think":
      return { upperArmR: [-72, -25, 20], lowerArmR: [-118, 0, 0], handR: [0, 0, -30], upperArmL: [0, 0, 8], head: [8 + s(1.3, 3), 14, 10], spine: [3, 0, 0] };
    case "blocked":
      return { upperArmL: [-30, 0, -40], upperArmR: [-30, 0, 40], lowerArmL: [-40, 0, -20], lowerArmR: [-40, 0, 20], head: [-6, s(5, 14), 0], spine: [2, 0, 0] };
    case "carry":
      return { upperArmL: [-70, 0, -8], upperArmR: [-70, 0, 8], lowerArmL: [-45, 0, 0], lowerArmR: [-45, 0, 0], spine: [-4, 0, 0], head: [6, 0, 0] };
    default: // idle
      return {
        hipsY: s(2.1, 0.008),
        upperArmL: [s(1.7, 2), 0, -8 + s(2.1, 1.5)], upperArmR: [s(1.7, 2, 1), 0, 8 - s(2.1, 1.5)],
        lowerArmL: [-6, 0, 0], lowerArmR: [-6, 0, 0],
        spine: [s(2.1, 1.2), 0, 0], chest: [0, 0, 0], head: [s(1.1, 2), s(0.7, 10), 0],
        upperLegL: [0, 0, 2], upperLegR: [0, 0, -2], lowerLegL: [0, 0, 0], lowerLegR: [0, 0, 0],
      };
  }
}

// Aplica a pose com suavização. hipsBaseY = altura de descanso do quadril.
export function animar(ossos: Ossos, pose: Pose, t: number, dt: number, fase: number, hipsBaseY: number, escalaHips = 1) {
  const a = alvo(pose, t, fase);
  const k = 1 - Math.exp(-dt * 9);
  for (const nome of OSSOS) {
    const o = ossos[nome]; if (!o) continue;
    const r = a[nome] ?? [0, 0, 0];
    tmpE.set(r[0] * D, r[1] * D, r[2] * D);
    o.rotation.x += (tmpE.x - o.rotation.x) * k;
    o.rotation.y += (tmpE.y - o.rotation.y) * k;
    o.rotation.z += (tmpE.z - o.rotation.z) * k;
  }
  const h = ossos.hips;
  if (h) h.position.y += (hipsBaseY + (a.hipsY ?? 0) * escalaHips - h.position.y) * k;
}

// ---------- boneco desenhado em código, numa malha só ----------
// Cada peça (coxa, braço, cabeça, cabelo...) fica presa a um osso. Em vez de ~25 malhas por boneco (25 draw calls),
// as peças viram UMA malha com esqueleto (SkinnedMesh), com a cor de cada peça gravada nos vértices. A geometria é
// compartilhada entre bonecos iguais; cada boneco tem só os próprios ossos. O logo do peito (textura) e os óculos
// (transparentes) ficam como malhas pequenas presas aos ossos.
const S = { ombro: 0.2, bracoR: 0.055, bracoL: 0.17, antebracoL: 0.16, pernaR: 0.075, coxaL: 0.22, canelaL: 0.2, cabecaR: 0.23 };

// osso pai e posição relativa a ele (pose de descanso). A ordem de OSSOS já tem o pai antes do filho.
const OSSO_PAI: Record<Osso, [Osso | null, [number, number, number]]> = {
  hips: [null, [0, 0.5, 0]],
  spine: ["hips", [0, 0.08, 0]], chest: ["spine", [0, 0.1, 0]], head: ["chest", [0, 0.3, 0]],
  upperArmL: ["chest", [S.ombro, 0.16, 0]], lowerArmL: ["upperArmL", [0, -S.bracoL, 0]], handL: ["lowerArmL", [0, -S.antebracoL - 0.01, 0]],
  upperArmR: ["chest", [-S.ombro, 0.16, 0]], lowerArmR: ["upperArmR", [0, -S.bracoL, 0]], handR: ["lowerArmR", [0, -S.antebracoL - 0.01, 0]],
  upperLegL: ["hips", [0.09, -0.02, 0]], lowerLegL: ["upperLegL", [0, -S.coxaL, 0]], footL: ["lowerLegL", [0, -S.canelaL - 0.02, 0.03]],
  upperLegR: ["hips", [-0.09, -0.02, 0]], lowerLegR: ["upperLegR", [0, -S.coxaL, 0]], footR: ["lowerLegR", [0, -S.canelaL - 0.02, 0.03]],
};

const geoCache = new Map<string, THREE.BufferGeometry>();
function g<T extends THREE.BufferGeometry>(k: string, criar: () => T) { let x = geoCache.get(k); if (!x) { x = criar(); geoCache.set(k, x); } return x; }
// Remodelado em 16/11/2026 ("tá tudo quadrado"): formas arredondadas, rosto, cabelos e tênis de verdade. No modo leve os
// segmentos caem ~30%. Fica em torno de 4 a 5 mil triângulos por boneco (2,5 mil no leve), numa malha só.
const seg = (n: number) => Math.max(5, Math.round(n * (leve() ? 0.7 : 1)));
const capsula = (r: number, len: number, radial = 10) => g(`c${r}-${len}-${radial}`, () => new THREE.CapsuleGeometry(r, len, seg(3), seg(radial)).translate(0, -len / 2, 0));
const esfera = (r: number, w = 12, h = 8) => g(`s${r}-${w}-${h}`, () => new THREE.SphereGeometry(r, seg(w), seg(h)));
const bola = (w = 12, h = 8) => esfera(1, w, h); // elipsoide: esfera de raio 1 escalada pela peça
const caixa = (x: number, y: number, z: number) => g(`b${x}-${y}-${z}`, () => new THREE.BoxGeometry(x, y, z));
const cilindro = (rt: number, rb: number, h: number, segs: number) => g(`y${rt}-${rb}-${h}-${segs}`, () => new THREE.CylinderGeometry(rt, rb, h, seg(segs)));
const arco = () => g("arco", () => new THREE.TorusGeometry(0.235, 0.012, 6, 20, Math.PI));
const anel = (r: number, t: number, arc = Math.PI * 2) => g(`n${r}-${t}-${arc}`, () => new THREE.TorusGeometry(r, t, seg(arc < 4 ? 5 : 6), seg(arc < 4 ? 10 : 18), arc));
// tronco torneado (cintura, peito, ombros e a base do pescoço), em volta do eixo y; achatado na frente/costas pela peça
const tronco = () => g("tronco", () => new THREE.LatheGeometry([[0.001, -0.2], [0.14, -0.19], [0.152, -0.06], [0.172, 0.08], [0.174, 0.2], [0.158, 0.29], [0.11, 0.345], [0.07, 0.37], [0.001, 0.372]].map(([r, y]) => new THREE.Vector2(r, y)), seg(18)));
// saia do vestido: do quadril (justo) até o meio da coxa (rodada)
const saia = () => g("saia", () => new THREE.LatheGeometry([[0.001, -0.29], [0.27, -0.29], [0.26, -0.26], [0.2, -0.05], [0.165, 0.08], [0.001, 0.085]].map(([r, y]) => new THREE.Vector2(r, y)), seg(18)));
// calota de cabelo: o topo de uma esfera (abertura theta), inclinada para trás para cobrir a nuca e deixar a testa
const calota = (theta: number, inclina: number) => g(`cal${theta}-${inclina}`, () => new THREE.SphereGeometry(1, seg(20), seg(10), 0, Math.PI * 2, 0, theta).rotateX(inclina));
const blackPower = () => g("black", () => new THREE.IcosahedronGeometry(1, leve() ? 1 : 2));

const misturar = (a: string, b: string, k: number) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`; };
const escurecer = (hex: string, k: number) => misturar(hex, "#000000", k);
type Peca = { osso: Osso; geo: THREE.BufferGeometry; cor: string; pos?: [number, number, number]; rot?: [number, number, number]; esc?: [number, number, number] };
const R = S.cabecaR;

// cabelo de cada estilo (cor do cabelo), preso ao osso da cabeça; o centro da cabeça fica em y = 0,2
function cabelo(p: Peca[], estilo: string, cab: string, pele: string) {
  const H = (geo: THREE.BufferGeometry, pos: [number, number, number], esc: [number, number, number], rot?: [number, number, number], cor = cab) => p.push({ osso: "head", geo, cor, pos, esc, rot });
  const nuca = () => H(bola(), [0, 0.15, -0.115], [0.19, 0.13, 0.12]);
  const k = R * 1.06;
  const kk: [number, number, number] = [k, k * 1.04, k * 0.98]; // mesma forma oval da cabeça
  switch (estilo) {
    case "careca": return;
    case "curto": H(calota(Math.PI * 0.46, -0.5), [0, 0.205, 0], kk); H(bola(12, 8), [0.035, 0.34, 0.16], [0.13, 0.045, 0.065], [0.15, 0, -0.28]); nuca(); return;
    case "topete": H(calota(Math.PI * 0.43, -0.55), [0, 0.205, 0], kk); H(bola(), [0, 0.405, 0.1], [0.13, 0.07, 0.125], [0.55, 0, 0]); H(bola(10, 8), [0, 0.39, 0.19], [0.1, 0.05, 0.06], [0.9, 0, 0]); nuca(); return;
    case "moicano":
      H(calota(Math.PI * 0.44, -0.45), [0, 0.2, 0], [R * 1.035, R * 1.075, R * 1.005], undefined, misturar(pele, cab, 0.45)); // lados raspados
      for (const [y, z, a] of [[0.43, 0.13, 0.7], [0.46, 0.02, 0.1], [0.43, -0.1, -0.5], [0.36, -0.19, -1]] as [number, number, number][]) H(bola(10, 8), [0, y, z], [0.042, 0.075, 0.085], [a, 0, 0]); // crista
      return;
    case "cacheado":
      H(blackPower(), [0, 0.33, -0.08], [0.3, 0.27, 0.27]);
      for (const [x, y, z] of [[0.17, 0.26, 0.12], [-0.17, 0.26, 0.12], [0.09, 0.33, 0.16], [-0.09, 0.33, 0.16], [0, 0.35, 0.17], [0.21, 0.16, 0.03], [-0.21, 0.16, 0.03]] as [number, number, number][]) H(blackPower(), [x, y, z], [0.06, 0.06, 0.06]);
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
  }
}

function pecas(def: BonecoDef, camisa: string, cracha: string, headset: boolean, semChapeu = false): Peca[] {
  const { pele, cabelo: cab, calca } = def; const preto = "#2A2D33";
  const traje = def.traje ?? "camisa";
  const praia = traje === "semCamisa" || traje === "biquini" || traje === "saida"; // perna de fora, chinelo, sem crachá
  const vestido = traje === "vestido";
  const mangaLonga = traje === "blazer" || traje === "moletom" || traje === "jaqueta";
  const semManga = traje === "regata" || traje === "semCamisa" || traje === "biquini";
  const corTronco = traje === "semCamisa" || traje === "biquini" ? pele : camisa;
  const peleSombra = escurecer(pele, 0.08);
  const p: Peca[] = [];
  // quadril e pernas
  p.push({ osso: "hips", geo: bola(), cor: vestido ? camisa : calca, pos: [0, 0.03, 0], esc: [0.16, 0.085, 0.1] });
  if (!praia && !vestido) p.push({ osso: "hips", geo: anel(0.148, 0.012), cor: preto, pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0], esc: [1, 0.74, 1] }); // cinto
  for (const lado of ["L", "R"] as const) {
    const sx = lado === "L" ? 1 : -1;
    const pernaDeFora = praia || vestido;
    p.push(
      { osso: `upperLeg${lado}`, geo: capsula(S.pernaR, S.coxaL), cor: pernaDeFora ? pele : calca },
      { osso: `lowerLeg${lado}`, geo: capsula(S.pernaR * 0.88, S.canelaL), cor: pernaDeFora ? pele : calca },
    );
    if (praia && traje !== "saida") p.push({ osso: `upperLeg${lado}`, geo: capsula(S.pernaR * 1.12, S.coxaL * 0.45), cor: calca }); // bermuda/biquíni
    // pés: chinelo na praia; tênis modelado (cabedal, sola, listra e cadarço) no resto
    if (praia) p.push(
      { osso: `foot${lado}`, geo: bola(), cor: pele, pos: [0, -0.005, 0.04], esc: [0.05, 0.032, 0.105] },
      { osso: `foot${lado}`, geo: bola(12, 6), cor: "#3B2A22", pos: [0, -0.033, 0.035], esc: [0.062, 0.012, 0.12] },
    );
    else {
      const cab2 = def.calcado ?? "#F4F4F4";
      const sola = def.tenis ? "#1F2227" : misturar(cab2, "#FFFFFF", 0.6);
      p.push(
        { osso: `foot${lado}`, geo: bola(12, 8), cor: cab2, pos: [0, 0.008, 0.035], esc: [0.064, 0.05, 0.12] },
        { osso: `foot${lado}`, geo: bola(12, 5), cor: sola, pos: [0, -0.024, 0.036], esc: [0.07, 0.019, 0.127] },
        { osso: `foot${lado}`, geo: caixa(0.044, 0.008, 0.012), cor: "#FFFFFF", pos: [0, 0.056, 0.058] },
        { osso: `foot${lado}`, geo: caixa(0.04, 0.008, 0.012), cor: "#FFFFFF", pos: [0, 0.05, 0.088] },
      );
      if (def.tenis) p.push({ osso: `foot${lado}`, geo: bola(12, 5), cor: def.tenis, pos: [0, 0.012, 0.028], esc: [0.067, 0.011, 0.088] });
    }
    // braços: ombro arredondado, manga (curta ou comprida) e a mão com polegar
    const corManga = semManga ? pele : camisa;
    p.push({ osso: `upperArm${lado}`, geo: esfera(semManga ? 0.052 : 0.058, 10, 8), cor: semManga ? pele : camisa });
    if (mangaLonga) p.push(
      { osso: `upperArm${lado}`, geo: capsula(0.058, S.bracoL), cor: camisa },
      { osso: `lowerArm${lado}`, geo: capsula(0.052, S.antebracoL), cor: camisa },
      { osso: `lowerArm${lado}`, geo: anel(0.046, 0.012), cor: escurecer(camisa, traje === "moletom" ? 0.15 : 0.25), pos: [0, -S.antebracoL + 0.005, 0], rot: [Math.PI / 2, 0, 0] }, // punho
    );
    else p.push(
      { osso: `upperArm${lado}`, geo: capsula(S.bracoR * 0.86, S.bracoL, 10), cor: pele },
      { osso: `lowerArm${lado}`, geo: capsula(S.bracoR * 0.8, S.antebracoL, 10), cor: pele },
    );
    if (!semManga && !mangaLonga) p.push({ osso: `upperArm${lado}`, geo: cilindro(0.058, 0.055, S.bracoL * 0.5, 14), cor: corManga, pos: [0, -S.bracoL * 0.25, 0] }); // manga curta com barra
    p.push(
      { osso: `hand${lado}`, geo: bola(10, 8), cor: pele, pos: [0, -0.035, 0], esc: [0.045, 0.058, 0.033] },
      { osso: `hand${lado}`, geo: esfera(0.018, 6, 5), cor: pele, pos: [-sx * 0.01, -0.025, 0.03] }, // polegar
    );
  }
  // tronco (camiseta, blazer, jaqueta, moletom, regata, vestido ou pele) e pescoço
  p.push({ osso: "chest", geo: tronco(), cor: corTronco, pos: [0, 0, 0], esc: [1, 1, 0.76] });
  p.push({ osso: "head", geo: cilindro(0.066, 0.07, 0.12, 10), cor: peleSombra, pos: [0, 0.0, -0.005] });
  if (traje === "camisa") p.push(
    { osso: "chest", geo: caixa(0.045, 0.06, 0.006), cor: cracha, pos: [-0.088, -0.01, 0.104], rot: [0, -0.62, 0] }, // crachá
    { osso: "chest", geo: anel(0.078, 0.016), cor: escurecer(camisa, 0.12), pos: [0, 0.335, 0.005], rot: [Math.PI / 2 - 0.25, 0, 0], esc: [1, 0.85, 1] }, // gola
  );
  if (traje === "blazer") {
    const lapela = escurecer(camisa, 0.28);
    p.push(
      { osso: "chest", geo: caixa(0.1, 0.25, 0.012), cor: "#F4F4F0", pos: [0, 0.2, 0.128] }, // camiseta por baixo
      { osso: "chest", geo: caixa(0.05, 0.22, 0.014), cor: lapela, pos: [0.065, 0.22, 0.126], rot: [0, 0.25, 0.32] },
      { osso: "chest", geo: caixa(0.05, 0.22, 0.014), cor: lapela, pos: [-0.065, 0.22, 0.126], rot: [0, -0.25, -0.32] },
      { osso: "chest", geo: esfera(0.013, 8, 6), cor: "#1F2227", pos: [0.055, 0.07, 0.13] },
      { osso: "hips", geo: bola(), cor: camisa, pos: [0, 0.06, 0], esc: [0.17, 0.06, 0.118] }, // barra do blazer
    );
  }
  if (traje === "jaqueta") p.push(
    { osso: "chest", geo: caixa(0.012, 0.42, 0.01), cor: "#C9CDD3", pos: [0, 0.1, 0.133] }, // zíper
    { osso: "chest", geo: anel(0.085, 0.024), cor: escurecer(camisa, 0.15), pos: [0, 0.33, 0], rot: [Math.PI / 2 - 0.15, 0, 0], esc: [1, 0.85, 1] }, // gola alta
    { osso: "hips", geo: anel(0.15, 0.02), cor: escurecer(camisa, 0.2), pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], esc: [1, 0.78, 1] }, // barra
  );
  if (traje === "moletom") p.push(
    { osso: "chest", geo: bola(), cor: escurecer(camisa, 0.1), pos: [0, 0.31, -0.1], esc: [0.15, 0.09, 0.085], rot: [-0.4, 0, 0] }, // capuz caído nas costas
    { osso: "chest", geo: caixa(0.17, 0.09, 0.012), cor: escurecer(camisa, 0.12), pos: [0, -0.06, 0.122] }, // bolso canguru
    { osso: "chest", geo: caixa(0.008, 0.09, 0.008), cor: "#F4F4F0", pos: [0.03, 0.25, 0.128] }, // cordões
    { osso: "chest", geo: caixa(0.008, 0.09, 0.008), cor: "#F4F4F0", pos: [-0.03, 0.25, 0.128] },
    { osso: "hips", geo: anel(0.15, 0.022), cor: escurecer(camisa, 0.15), pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], esc: [1, 0.78, 1] },
  );
  if (vestido) p.push({ osso: "hips", geo: saia(), cor: camisa, pos: [0, 0, 0], esc: [1, 1, 0.82] });
  if (traje === "biquini") p.push({ osso: "chest", geo: bola(), cor: camisa, pos: [0, 0.2, 0.04], esc: [0.17, 0.06, 0.12] }); // top
  if (traje === "saida") p.push({ osso: "hips", geo: cilindro(0.17, 0.3, 0.3, 14), cor: camisa, pos: [0, -0.1, 0] }); // saída de praia (saia)
  if (def.prancha) p.push(
    { osso: "chest", geo: bola(), cor: def.prancha, pos: [-0.3, 0.05, 0], esc: [0.05, 0.62, 0.17] }, // prancha debaixo do braço
    { osso: "chest", geo: bola(), cor: "#1F2227", pos: [-0.33, 0.05, 0], esc: [0.012, 0.5, 0.03] }, // listra
  );
  if (def.chapeu && !semChapeu) p.push( // chapéu do tipo de boneco sai quando ele usa um acessório na cabeça
    { osso: "head", geo: cilindro(0.34, 0.34, 0.02, 18), cor: def.chapeu, pos: [0, 0.36, -0.02] },
    { osso: "head", geo: cilindro(0.19, 0.21, 0.12, 18), cor: def.chapeu, pos: [0, 0.42, -0.02] },
  );
  // cabeça e rosto: orelhas, olhos com brilho, sobrancelhas, nariz e boca
  const sobrancelha = def.estiloCabelo === "careca" ? escurecer(pele, 0.45) : escurecer(cab, 0.1);
  p.push({ osso: "head", geo: esfera(R, 22, 16), cor: pele, pos: [0, 0.2, 0], esc: [1, 1.04, 0.97] });
  for (const s of [1, -1]) p.push(
    { osso: "head", geo: bola(8, 6), cor: peleSombra, pos: [s * 0.223, 0.2, 0.0], esc: [0.034, 0.058, 0.044] }, // orelha
    { osso: "head", geo: bola(10, 8), cor: "#FAFAF7", pos: [s * 0.076, 0.214, 0.201], esc: [0.04, 0.046, 0.022] }, // olho
    { osso: "head", geo: esfera(0.022, 8, 6), cor: "#2B1D16", pos: [s * 0.076, 0.211, 0.214] }, // íris
    { osso: "head", geo: esfera(0.007, 5, 4), cor: "#FFFFFF", pos: [s * 0.069, 0.221, 0.233] }, // brilho
    { osso: "head", geo: bola(6, 4), cor: sobrancelha, pos: [s * 0.078, 0.272, 0.207], esc: [0.043, 0.011, 0.014], rot: [0, 0, s * 0.12] }, // sobrancelha
  );
  p.push(
    { osso: "head", geo: bola(8, 6), cor: peleSombra, pos: [0, 0.168, 0.224], esc: [0.026, 0.034, 0.028] }, // nariz
    { osso: "head", geo: anel(0.034, 0.008, Math.PI), cor: "#9E3B30", pos: [0, 0.122, 0.214], rot: [-0.25, 0, Math.PI] }, // boca (sorriso)
  );
  const barba = def.barba ?? "nenhuma";
  if (barba === "rala" || barba === "cheia") p.push({ osso: "head", geo: bola(14, 10), cor: barba === "rala" ? misturar(pele, cab, 0.55) : cab, pos: [0, barba === "rala" ? 0.075 : 0.07, 0.048], esc: barba === "rala" ? [0.198, 0.103, 0.18] : [0.203, 0.11, 0.186] });
  if (barba === "cheia" || barba === "bigode") p.push({ osso: "head", geo: bola(10, 6), cor: cab, pos: [0, 0.143, 0.224], esc: [0.058, 0.016, 0.02] }); // bigode
  if (barba === "rala" || barba === "cheia") p.push({ osso: "head", geo: anel(0.034, 0.008, Math.PI), cor: "#9E3B30", pos: [0, 0.122, 0.236], rot: [-0.25, 0, Math.PI] }); // boca por cima da barba
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
const bonecoCache = new Map<string, THREE.BufferGeometry>();
function geometriaBoneco(def: BonecoDef, camisa: string, cracha: string, headset: boolean, semChapeu = false) {
  const k = `v2|${def.id}|${def.pele}|${def.cabelo}|${def.calca}|${def.estiloCabelo}|${def.traje ?? ""}|${def.tenis ?? ""}|${def.calcado ?? ""}|${def.barba ?? ""}|${def.prancha ?? ""}|${def.chapeu ?? ""}|${camisa}|${cracha}|${headset}|${semChapeu}`;
  const pronta = bonecoCache.get(k); if (pronta) return pronta;
  const repouso = {} as Record<Osso, THREE.Matrix4>;
  for (const nome of OSSOS) { const [pai, p] = OSSO_PAI[nome]; const local = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]); repouso[nome] = pai ? new THREE.Matrix4().multiplyMatrices(repouso[pai], local) : local; }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cor = new THREE.Color();
  const partes = pecas(def, camisa, cracha, headset, semChapeu).map((pc) => {
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
  bonecoCache.set(k, geo);
  return geo;
}

let matCorpo: THREE.Material | null = null;
const materialCorpo = () => (matCorpo ??= leve() ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }));
let matOculos: THREE.Material | null = null;
const materialOculos = () => (matOculos ??= new THREE.MeshStandardMaterial({ color: "#222", transparent: true, opacity: 0.55, depthWrite: false }));
const matsLogo = new Map<string, THREE.Material>();
function materialLogo(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  let m = matsLogo.get(t.uuid);
  if (!m) { m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false }); matsLogo.set(t.uuid, m); }
  return m;
}

// lentes redondas + ponte numa geometria só (continua 1 malha transparente)
const geoOculos = () => g("oculos2", () => mergeGeometries([
  new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20).rotateX(Math.PI / 2).translate(0.078, 0, 0),
  new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20).rotateX(Math.PI / 2).translate(-0.078, 0, 0),
  new THREE.BoxGeometry(0.04, 0.01, 0.01).translate(0, 0.01, 0),
].map((x) => x.toNonIndexed()), false)!);

function montarBoneco(geo: THREE.BufferGeometry, logo: THREE.Material, oculos: boolean, comLogo = true) {
  const raiz = new THREE.Group();
  const ossos: Ossos = {};
  const lista: THREE.Bone[] = [];
  for (const nome of OSSOS) {
    const [pai, p] = OSSO_PAI[nome];
    const b = new THREE.Bone(); b.name = nome; b.position.set(p[0], p[1], p[2]);
    (pai ? ossos[pai]! : raiz).add(b);
    ossos[nome] = b; lista.push(b);
  }
  const corpo = new THREE.SkinnedMesh(geo, materialCorpo());
  corpo.frustumCulled = false; // o boneco anda pela cena; a esfera da pose de descanso não acompanha a animação
  raiz.add(corpo);
  raiz.updateMatrixWorld(true);
  corpo.bind(new THREE.Skeleton(lista));
  if (comLogo) { const marca = new THREE.Mesh(caixa(0.17, 0.042, 0.001), logo); marca.position.set(0, 0.09, 0.137); ossos.chest!.add(marca); }
  if (oculos) { const o = new THREE.Mesh(geoOculos(), materialOculos()); o.position.set(0, 0.214, 0.238); ossos.head!.add(o); }
  return { raiz, ossos };
}

interface Props { def: BonecoDef; camisa: string; headset?: boolean; cracha: string; acessorios?: string[] }

// Boneco desenhado em código. Altura ~1.1 m. 2 draw calls (corpo + logo), 3 com óculos; cada acessório soma poucas malhas.
export const BonecoProcedural = forwardRef<BonecoHandle, Props>(function BonecoProcedural({ def, camisa, headset, cracha, acessorios }, ref) {
  const textura = useLoader(THREE.TextureLoader, "/brand/nuvem-branco.png");
  const logo = useMemo(() => materialLogo(textura), [textura]);
  const chaveAcc = limparEquipados(acessorios ?? []).join(",");
  const { semChapeu, semOculos } = useMemo(() => lugaresUsados(chaveAcc), [chaveAcc]);
  const b = useMemo(() => montarBoneco(geometriaBoneco(def, camisa, cracha, !!headset, semChapeu), logo, !!def.oculos && !semOculos, (def.traje ?? "camisa") === "camisa"), [def, camisa, cracha, headset, logo, semChapeu, semOculos]);
  useImperativeHandle(ref, () => ({ ossos: b.ossos, raiz: b.raiz }), [b]);
  // roupas e acessórios comprados (12/11/2026): presos aos ossos depois de montar o boneco; as asinhas batem devagar
  const asas = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    const feitos = vestirAcessorios(b.ossos, chaveAcc ? chaveAcc.split(",") : [], !!headset);
    asas.current = feitos.flatMap((o) => o.children.filter((c) => c.userData.asa));
    return () => { feitos.forEach((o) => o.removeFromParent()); asas.current = []; };
  }, [b, chaveAcc, headset]);
  useFrame(({ clock }) => { if (asas.current.length) baterAsas(asas.current, clock.elapsedTime); });
  return <primitive object={b.raiz} />;
});

// ---------- roupas e acessórios (12/11/2026) ----------
// Cada item é um grupo de malhas simples preso ao osso da cabeça ou do peito, então acompanha a animação. Geometria e
// material são compartilhados entre bonecos. Coordenadas do osso: frente do rosto em +z, costas em -z.
type OssoAcc = "head" | "chest";
type Acabamento = "fosco" | "metal" | "vidro" | "lente";
const matsAcc = new Map<string, THREE.Material>();
function matAcc(cor: string, a: Acabamento = "fosco") {
  const k = `${cor}|${a}|${leve() ? 1 : 0}`;
  let m = matsAcc.get(k);
  if (!m) {
    const lente = a === "lente";
    m = leve()
      ? new THREE.MeshLambertMaterial({ color: cor, side: THREE.DoubleSide, transparent: lente, opacity: lente ? 0.35 : 1, depthWrite: !lente })
      : new THREE.MeshStandardMaterial({ color: cor, side: THREE.DoubleSide, roughness: a === "metal" ? 0.28 : a === "fosco" ? 0.78 : 0.12, metalness: a === "metal" ? 0.85 : a === "vidro" ? 0.35 : 0, transparent: lente, opacity: lente ? 0.35 : 1, depthWrite: !lente });
    matsAcc.set(k, m);
  }
  return m;
}
const meiaEsfera = (r: number) => g(`h${r}`, () => new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2));
const toroAcc = (r: number, t: number, a = Math.PI * 2) => g(`t${r}-${t}-${a}`, () => new THREE.TorusGeometry(r, t, 8, 28, a));
const tuboAberto = (rt: number, rb: number, h: number) => g(`o${rt}-${rb}-${h}`, () => new THREE.CylinderGeometry(rt, rb, h, 20, 1, true));
const conePonta = (r: number, h: number) => g(`k${r}-${h}`, () => new THREE.ConeGeometry(r, h, 8));
const gema = (r: number) => g(`g${r}`, () => new THREE.OctahedronGeometry(r, 0));

function peca(grupo: THREE.Object3D, geo: THREE.BufferGeometry, cor: string, pos: [number, number, number], o: { a?: Acabamento; rot?: [number, number, number]; esc?: [number, number, number] } = {}) {
  const m = new THREE.Mesh(geo, matAcc(cor, o.a));
  m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot); if (o.esc) m.scale.set(...o.esc);
  grupo.add(m); return m;
}
// hastes dos óculos: da lente até a orelha, por fora do cabelo
function hastes(grupo: THREE.Object3D, cor: string, a: Acabamento) {
  for (const s of [1, -1]) peca(grupo, caixa(0.012, 0.012, 0.26), cor, [s * 0.185, 0.215, 0.115], { a, rot: [0, -s * 0.48, 0] });
}

function montarAcessorio(id: string): { osso: OssoAcc; obj: THREE.Group } | null {
  const it = ACESSORIO_POR_ID[id]; if (!it) return null;
  const c = it.cor, G = new THREE.Group(); G.name = `acessorio:${id}`;
  switch (id) {
    case "bone-workend":
      peca(G, meiaEsfera(0.262), c, [0, 0.255, -0.005], { esc: [1, 0.78, 1.03] });
      peca(G, cilindro(0.17, 0.17, 0.018, 20), c, [0, 0.27, 0.2], { rot: [0.12, 0, 0], esc: [1, 1, 0.75] }); // aba
      peca(G, caixa(0.11, 0.05, 0.012), "#FFFFFF", [0, 0.36, 0.236], { rot: [-0.54, 0, 0] }); // etiqueta da marca
      peca(G, esfera(0.022), "#FFFFFF", [0, 0.458, -0.005]);
      return { osso: "head", obj: G };
    case "chapeu-palha":
      peca(G, cilindro(0.4, 0.4, 0.018, 28), c, [0, 0.37, -0.01]);
      peca(G, cilindro(0.19, 0.22, 0.15, 20), c, [0, 0.45, -0.01]);
      peca(G, cilindro(0.223, 0.223, 0.045, 20), "#9B3B2A", [0, 0.4, -0.01]); // fita
      return { osso: "head", obj: G };
    case "cartola":
      peca(G, cilindro(0.31, 0.31, 0.02, 28), c, [0, 0.385, -0.01]);
      peca(G, cilindro(0.19, 0.2, 0.36, 22), c, [0, 0.57, -0.01]);
      peca(G, cilindro(0.204, 0.204, 0.06, 22), "#B91C1C", [0, 0.42, -0.01]);
      return { osso: "head", obj: G };
    case "coroa": {
      peca(G, tuboAberto(0.2, 0.19, 0.09), c, [0, 0.405, -0.01], { a: "metal" });
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; peca(G, conePonta(0.038, 0.1), c, [Math.sin(ang) * 0.197, 0.495, Math.cos(ang) * 0.197 - 0.01], { a: "metal" }); }
      [[0, "#D62828"], [1.05, "#2563EB"], [-1.05, "#16A34A"]].forEach(([ang, cor]) => peca(G, gema(0.026), cor as string, [Math.sin(ang as number) * 0.205, 0.405, Math.cos(ang as number) * 0.205 - 0.01], { a: "vidro" }));
      return { osso: "head", obj: G };
    }
    case "fone":
      for (const s of [1, -1]) {
        peca(G, cilindro(0.075, 0.075, 0.055, 18), c, [s * 0.27, 0.2, -0.01], { rot: [0, 0, Math.PI / 2] });
        peca(G, cilindro(0.062, 0.062, 0.02, 16), "#2A2D33", [s * 0.245, 0.2, -0.01], { rot: [0, 0, Math.PI / 2] });
      }
      peca(G, toroAcc(0.27, 0.02, Math.PI), "#2A2D33", [0, 0.2, -0.01]); // arco por cima da cabeça
      return { osso: "head", obj: G };
    case "oculos-sol":
      for (const s of [1, -1]) peca(G, caixa(0.1, 0.056, 0.014), c, [s * 0.072, 0.205, 0.236], { a: "vidro" });
      peca(G, caixa(0.045, 0.012, 0.012), c, [0, 0.22, 0.238], { a: "vidro" });
      hastes(G, c, "vidro");
      return { osso: "head", obj: G };
    case "oculos-redondo":
      for (const s of [1, -1]) {
        peca(G, toroAcc(0.045, 0.007), c, [s * 0.072, 0.205, 0.236], { a: "metal" });
        peca(G, cilindro(0.042, 0.042, 0.004, 16), "#DCEBF5", [s * 0.072, 0.205, 0.234], { a: "lente", rot: [Math.PI / 2, 0, 0] });
      }
      peca(G, caixa(0.052, 0.008, 0.008), c, [0, 0.215, 0.24], { a: "metal" });
      hastes(G, c, "metal");
      return { osso: "head", obj: G };
    case "mochila":
      peca(G, caixa(0.27, 0.27, 0.12), c, [0, 0.085, -0.185]);
      peca(G, cilindro(0.06, 0.06, 0.27, 14), c, [0, 0.22, -0.185], { rot: [0, 0, Math.PI / 2] }); // topo arredondado
      peca(G, caixa(0.19, 0.11, 0.04), "#0F7A36", [0, 0.02, -0.26]); // bolso
      peca(G, caixa(0.2, 0.012, 0.012), "#E9EDF1", [0, 0.076, -0.281]); // zíper
      for (const s of [1, -1]) {
        peca(G, caixa(0.03, 0.27, 0.016), "#1F2630", [s * 0.135, 0.15, 0.092]); // alça na frente
        peca(G, caixa(0.03, 0.016, 0.28), "#1F2630", [s * 0.135, 0.312, -0.045]); // alça no ombro
      }
      return { osso: "chest", obj: G };
    case "asas":
      for (const s of [1, -1]) {
        const asa = new THREE.Group(); asa.position.set(s * 0.05, 0.2, -0.14); asa.userData.asa = s;
        peca(asa, esfera(1), c, [s * 0.17, 0.06, -0.02], { rot: [0, 0, s * 0.45], esc: [0.2, 0.09, 0.022] });
        peca(asa, esfera(1), "#EAF2FF", [s * 0.14, -0.03, -0.03], { rot: [0, 0, s * 0.15], esc: [0.15, 0.06, 0.02] });
        peca(asa, esfera(1), "#DCE8FA", [s * 0.1, -0.1, -0.035], { rot: [0, 0, -s * 0.2], esc: [0.1, 0.045, 0.018] });
        G.add(asa);
      }
      return { osso: "chest", obj: G };
    case "cachecol":
      peca(G, toroAcc(0.145, 0.045), c, [0, 0.31, 0], { rot: [Math.PI / 2, 0, 0], esc: [1, 0.82, 1] });
      peca(G, caixa(0.075, 0.2, 0.03), c, [0.07, 0.19, 0.135], { rot: [0.15, 0, -0.08] }); // ponta caída
      peca(G, caixa(0.077, 0.025, 0.032), "#F4F1EA", [0.078, 0.105, 0.148], { rot: [0.15, 0, -0.08] }); // listra
      return { osso: "chest", obj: G };
    case "colar":
      peca(G, toroAcc(0.13, 0.01), c, [0, 0.29, 0.02], { a: "metal", rot: [Math.PI / 2 + 0.45, 0, 0], esc: [1.2, 1, 1] });
      peca(G, gema(0.032), c, [0, 0.215, 0.152], { a: "metal" }); // pingente
      peca(G, esfera(0.014), "#D62828", [0, 0.215, 0.178], { a: "vidro" });
      return { osso: "chest", obj: G };
  }
  return null;
}

// o que sai do boneco quando há acessório no lugar: o chapéu do tipo (cabeça) e os óculos do tipo (rosto)
function lugaresUsados(chave: string) {
  const lugares = new Set(chave ? chave.split(",").map((i) => ACESSORIO_POR_ID[i]?.lugar) : []);
  return { semChapeu: lugares.has("cabeca"), semOculos: lugares.has("rosto") };
}
function vestirAcessorios(ossos: Ossos, ids: string[], headset: boolean) {
  const feitos: THREE.Object3D[] = [];
  for (const id of limparEquipados(ids)) {
    if (id === "fone" && headset) continue; // a atendente já usa o headset dela
    const r = montarAcessorio(id); const osso = r ? ossos[r.osso] : null;
    if (!r || !osso) continue;
    osso.add(r.obj); feitos.push(r.obj);
  }
  return feitos;
}
function baterAsas(asas: THREE.Object3D[], t: number) {
  for (const a of asas) { const s = a.userData.asa as number; a.rotation.y = s * (0.35 + Math.sin(t * 2.6) * 0.22); a.rotation.z = s * Math.sin(t * 2.6 + 0.6) * 0.06; }
}

// Boneco do Higgsfield (GLB com esqueleto). Mesmos ossos.
export const BonecoGLB = forwardRef<BonecoHandle, { arquivo: string }>(function BonecoGLB({ arquivo }, ref) {
  const gltf = useGLTF(arquivo);
  const raiz = useRef<THREE.Group>(null);
  const cena = useMemo(() => cloneSkeleton(gltf.scene) as THREE.Group, [gltf.scene]);
  const ossos = useMemo(() => {
    const o: Ossos = {};
    for (const n of OSSOS) { const b = cena.getObjectByName(n); if (b) o[n] = b; }
    cena.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; (m as THREE.Mesh).frustumCulled = false; } });
    return o;
  }, [cena]);
  useImperativeHandle(ref, () => ({ ossos, raiz: raiz.current }), [ossos]);
  return <group ref={raiz} scale={1.1}><primitive object={cena} /></group>;
});

// Hook que anima um boneco a partir de uma pose
export function useAnimacao(handle: React.RefObject<BonecoHandle | null>, pose: () => Pose, fase: number, hipsBaseY = 0.5, escalaHips = 1) {
  useFrame((st, dt) => {
    const h = handle.current; if (!h) return;
    animar(h.ossos, pose(), st.clock.elapsedTime, Math.min(dt, 0.05), fase, hipsBaseY, escalaHips);
  });
}
// Altura de descanso do quadril de cada tipo de boneco
export const HIPS = { procedural: { base: 0.5, escala: 1 }, glb: { base: 0.34, escala: 0.75 } };
