"use client";
// Boneco com esqueleto. Duas versões com os MESMOS ossos e as MESMAS animações:
//  - BonecoProcedural: desenhado em código (leve, cor da camisa e logo por material)
//  - BonecoGLB: modelo gerado no Higgsfield + esqueleto do scripts/bonecos/rig.mjs
import * as THREE from "three";
import { useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import type { Boneco as BonecoDef } from "../data/bonecos";

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
// segmentos proporcionais ao tamanho da peça: cabeça redonda, olhos e mãos bem mais simples (~2,5 mil triângulos por boneco)
const capsula = (r: number, len: number) => g(`c${r}-${len}`, () => new THREE.CapsuleGeometry(r, len, 3, r > 0.1 ? 12 : 8).translate(0, -len / 2, 0));
const esfera = (r: number) => g(`s${r}`, () => (r >= 0.2 ? new THREE.SphereGeometry(r, 16, 12) : r >= 0.06 ? new THREE.SphereGeometry(r, 10, 7) : new THREE.SphereGeometry(r, 7, 5)));
const caixa = (x: number, y: number, z: number) => g(`b${x}-${y}-${z}`, () => new THREE.BoxGeometry(x, y, z));
const arco = () => g("arco", () => new THREE.TorusGeometry(0.235, 0.012, 6, 20, Math.PI));

type Peca = { osso: Osso; geo: THREE.BufferGeometry; cor: string; pos?: [number, number, number]; rot?: [number, number, number]; esc?: [number, number, number] };
function pecas(def: BonecoDef, camisa: string, cracha: string, headset: boolean): Peca[] {
  const { pele, cabelo: cab, calca } = def; const tenis = "#F4F4F4", preto = "#2A2D33";
  const p: Peca[] = [{ osso: "hips", geo: caixa(0.3, 0.14, 0.22), cor: calca, pos: [0, 0.02, 0] }];
  for (const lado of ["L", "R"] as const) {
    p.push(
      { osso: `upperLeg${lado}`, geo: capsula(S.pernaR, S.coxaL), cor: calca },
      { osso: `lowerLeg${lado}`, geo: capsula(S.pernaR * 0.92, S.canelaL), cor: calca },
      { osso: `foot${lado}`, geo: caixa(0.14, 0.09, 0.22), cor: tenis, pos: [0, 0, 0.02] },
      { osso: `upperArm${lado}`, geo: capsula(S.bracoR, S.bracoL * 0.55), cor: camisa, pos: [0, 0.01, 0] },
      { osso: `upperArm${lado}`, geo: capsula(S.bracoR * 0.85, S.bracoL), cor: pele },
      { osso: `lowerArm${lado}`, geo: capsula(S.bracoR * 0.8, S.antebracoL), cor: pele },
      { osso: `hand${lado}`, geo: esfera(0.06), cor: pele },
    );
  }
  p.push(
    { osso: "chest", geo: capsula(0.17, 0.2), cor: camisa, pos: [0, 0.2, 0], esc: [1, 1, 0.78] }, // tronco (camisa)
    { osso: "chest", geo: caixa(0.05, 0.065, 0.006), cor: cracha, pos: [-0.09, 0.07, 0.135] }, // crachá
    { osso: "chest", geo: caixa(0.14, 0.03, 0.12), cor: camisa, pos: [0, 0.2, 0.02] }, // gola
    { osso: "head", geo: esfera(S.cabecaR), cor: pele, pos: [0, 0.2, 0] },
    { osso: "head", geo: esfera(0.028), cor: preto, pos: [-0.08, 0.2, 0.2] },
    { osso: "head", geo: esfera(0.028), cor: preto, pos: [0.08, 0.2, 0.2] },
    { osso: "head", geo: caixa(0.07, 0.012, 0.01), cor: "#B0533F", pos: [0, 0.12, 0.215] }, // sorriso
  );
  if (def.estiloCabelo !== "careca") p.push({ osso: "head", geo: esfera(S.cabecaR + 0.025), cor: cab, pos: [0, 0.235, -0.03], esc: [1, 0.75, 1] });
  if (def.estiloCabelo === "coque") p.push({ osso: "head", geo: esfera(0.09), cor: cab, pos: [0, 0.46, -0.08] });
  if (def.estiloCabelo === "longo") p.push({ osso: "head", geo: caixa(0.4, 0.3, 0.16), cor: cab, pos: [0, 0.08, -0.14] });
  if (headset) p.push(
    { osso: "head", geo: caixa(0.06, 0.08, 0.06), cor: preto, pos: [0.23, 0.17, 0.02] },
    { osso: "head", geo: caixa(0.06, 0.08, 0.06), cor: preto, pos: [-0.23, 0.17, 0.02] },
    { osso: "head", geo: arco(), cor: preto, pos: [0, 0.2, 0.02] },
    { osso: "head", geo: caixa(0.015, 0.015, 0.14), cor: preto, pos: [0.14, 0.1, 0.1], rot: [0, 0.9, 0] },
  );
  return p;
}

// Geometria do boneco (pose de descanso) com cor e osso de cada vértice. Uma por aparência, compartilhada.
const bonecoCache = new Map<string, THREE.BufferGeometry>();
function geometriaBoneco(def: BonecoDef, camisa: string, cracha: string, headset: boolean) {
  const k = `${def.id}|${def.pele}|${def.cabelo}|${def.calca}|${def.estiloCabelo}|${camisa}|${cracha}|${headset}`;
  const pronta = bonecoCache.get(k); if (pronta) return pronta;
  const repouso = {} as Record<Osso, THREE.Matrix4>;
  for (const nome of OSSOS) { const [pai, p] = OSSO_PAI[nome]; const local = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]); repouso[nome] = pai ? new THREE.Matrix4().multiplyMatrices(repouso[pai], local) : local; }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cor = new THREE.Color();
  const partes = pecas(def, camisa, cracha, headset).map((pc) => {
    const geo = pc.geo.index ? pc.geo.toNonIndexed() : pc.geo.clone();
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

function montarBoneco(geo: THREE.BufferGeometry, logo: THREE.Material, oculos: boolean) {
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
  const marca = new THREE.Mesh(caixa(0.17, 0.042, 0.001), logo); marca.position.set(0, 0.09, 0.137); ossos.chest!.add(marca);
  if (oculos) { const o = new THREE.Mesh(caixa(0.25, 0.06, 0.02), materialOculos()); o.position.set(0, 0.2, 0.215); ossos.head!.add(o); }
  return { raiz, ossos };
}

interface Props { def: BonecoDef; camisa: string; headset?: boolean; cracha: string }

// Boneco desenhado em código. Altura ~1.1 m. 2 draw calls (corpo + logo), 3 com óculos.
export const BonecoProcedural = forwardRef<BonecoHandle, Props>(function BonecoProcedural({ def, camisa, headset, cracha }, ref) {
  const textura = useLoader(THREE.TextureLoader, "/brand/nuvem-branco.png");
  const logo = useMemo(() => materialLogo(textura), [textura]);
  const b = useMemo(() => montarBoneco(geometriaBoneco(def, camisa, cracha, !!headset), logo, !!def.oculos), [def, camisa, cracha, headset, logo]);
  useImperativeHandle(ref, () => ({ ossos: b.ossos, raiz: b.raiz }), [b]);
  return <primitive object={b.raiz} />;
});

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
