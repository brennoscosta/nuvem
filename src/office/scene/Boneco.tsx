"use client";
// Boneco com esqueleto. Duas versões com os MESMOS ossos e as MESMAS animações:
//  - BonecoProcedural: desenhado em código (leve, cor da camisa e logo por material)
//  - BonecoGLB: modelo gerado no Higgsfield + esqueleto do scripts/bonecos/rig.mjs
import * as THREE from "three";
import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leve } from "./qualidade";
import { escalaDoBoneco, type Boneco as BonecoDef } from "../data/bonecos";
import { ACESSORIO_POR_ID, limparEquipados } from "../data/acessorios";
import { OSSOS, OSSO_PAI, S, g, caixa, cilindro, esfera, corpoDe, pontoNoPeito, geometriaBoneco, reterGeometria, soltarGeometria, type Osso } from "./bonecoPecas";

export type Pose = "idle" | "walk" | "sit" | "type" | "celebrate" | "think" | "blocked" | "carry" | "pedal";

export type Ossos = Partial<Record<Osso, THREE.Object3D>>;

export interface BonecoHandle { ossos: Ossos; raiz: THREE.Group | null }

const D = Math.PI / 180;
const tmpE = new THREE.Euler();

// de bicicleta (19/11/2026): sentado no selim, tronco para a frente e as mãos no guidão. Não muda com o tempo (um objeto
// só, nada criado por quadro). As pernas daqui são só o ponto de partida: scene/Bicicleta.tsx põe os pés nos pedais a
// cada quadro (o giro dos pedais vem do quanto andou)
const POSE_PEDAL: Partial<Record<Osso, [number, number, number]>> & { hipsY?: number } = {
  hipsY: 0.035,
  spine: [18, 0, 0], chest: [12, 0, 0], head: [-24, 0, 0],
  upperArmL: [-56, 0, 2], lowerArmL: [-37, 0, 0], handL: [-12, 0, 0],
  upperArmR: [-56, 0, -2], lowerArmR: [-37, 0, 0], handR: [-12, 0, 0],
  upperLegL: [-60, 0, 0], lowerLegL: [70, 0, 0], upperLegR: [-60, 0, 0], lowerLegR: [70, 0, 0],
};
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
    case "pedal": return POSE_PEDAL;
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
// As peças e a geometria compartilhada moram em scene/bonecoPecas.ts (20/11/2026). O logo do peito (textura), os óculos
// redondos (transparentes) e a logo do uniforme ficam como malhas pequenas presas aos ossos.
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
// logo da empresa no uniforme (20/11/2026): a imagem pública do lote (/api/terrenos/<chave>/logo), carregada uma vez por
// empresa e compartilhada por todos os bonecos com o uniforme dela. Sem logo (404), o uniforme fica só com a cor.
const logosUniforme = new Map<string, Promise<THREE.Material | null>>();
function materialUniforme(chave: string) {
  let pr = logosUniforme.get(chave);
  if (!pr) {
    pr = new Promise((ok) => { new THREE.TextureLoader().load(`/api/terrenos/${encodeURIComponent(chave)}/logo`, (t) => ok(materialLogo(t)), undefined, () => ok(null)); });
    logosUniforme.set(chave, pr);
  }
  return pr;
}
const placaUniforme = () => g("placaUniforme", () => new THREE.PlaneGeometry(0.075, 0.075));
// onde a logo do uniforme vai: no peito esquerdo; nas roupas abertas (blazer, terno, jaqueta de couro), fora da lapela
const ABERTAS = new Set(["blazer", "terno", "ternoGrife", "jaquetaCouro"]);
function lugarDaLogo(traje: string, lg: number) {
  const x = (ABERTAS.has(traje) ? 0.1 : 0.075) * lg, y = 0.17, pt = pontoNoPeito(y, x, lg);
  return { pos: [x, y, pt.z + 0.004] as [number, number, number], giro: pt.giro };
}

// lentes redondas + ponte numa geometria só (continua 1 malha transparente)
const geoOculos = () => g("oculos2", () => mergeGeometries([
  new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20).rotateX(Math.PI / 2).translate(0.078, 0, 0),
  new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20).rotateX(Math.PI / 2).translate(-0.078, 0, 0),
  new THREE.BoxGeometry(0.04, 0.01, 0.01).translate(0, 0.01, 0),
].map((x) => x.toNonIndexed()), false)!);

function montarBoneco(geo: THREE.BufferGeometry, logo: THREE.Material, oculos: boolean, comLogo = true, escala = 1, lg = 1) {
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
  if (comLogo) { const marca = new THREE.Mesh(caixa(0.17, 0.042, 0.001), logo); marca.position.set(0, 0.09, 0.137 * lg); ossos.chest!.add(marca); }
  if (oculos) { const o = new THREE.Mesh(geoOculos(), materialOculos()); o.position.set(0, 0.214, 0.238); ossos.head!.add(o); }
  if (escala !== 1) raiz.scale.setScalar(escala); // altura (20/11/2026): o boneco inteiro, com os mesmos ossos e animações
  return { raiz, ossos };
}

interface Props { def: BonecoDef; camisa: string; headset?: boolean; cracha: string; acessorios?: string[] }

// testes e fotos (?medir=1, 20/11/2026): onde cada boneco desenhado em código cai na tela (o código do visual de cada um e
// o ponto do peito em pixels), para conferir o enquadramento sem olhar a foto. Fora do ?medir=1 não guarda nada.
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
const naTela = new Map<THREE.Object3D, { id: string; camera: THREE.Camera; el: HTMLElement }>();
function registrarMedida(raiz: THREE.Object3D, id: string, camera: THREE.Camera, el: HTMLElement) {
  naTela.set(raiz, { id, camera, el });
  const v = new THREE.Vector3();
  (window as unknown as { __bonecos: unknown }).__bonecos = {
    total: () => naTela.size,
    tela: () => [...naTela].map(([r, m]) => { r.getWorldPosition(v); v.y += 0.7; v.project(m.camera); const q = m.el.getBoundingClientRect(); return { id: m.id, x: q.left + ((v.x + 1) / 2) * q.width, y: q.top + ((1 - v.y) / 2) * q.height, z: v.z, camera: m.camera.position.toArray(), grande: q.width > 600 }; }),
  };
  return () => { naTela.delete(raiz); };
}

// Boneco desenhado em código. Altura ~1.1 m (baixa 0,93×, alta 1,07×). 2 draw calls (corpo + logo), 3 com óculos; cada
// acessório soma poucas malhas.
export const BonecoProcedural = forwardRef<BonecoHandle, Props>(function BonecoProcedural({ def, camisa, headset, cracha, acessorios }, ref) {
  const textura = useLoader(THREE.TextureLoader, "/brand/nuvem-branco.png");
  const logo = useMemo(() => materialLogo(textura), [textura]);
  const chaveAcc = limparEquipados(acessorios ?? []).join(",");
  const { semChapeu, semOculos } = useMemo(() => lugaresUsados(chaveAcc), [chaveAcc]);
  const { lg, lb } = corpoDe(def);
  const traje = def.traje ?? "camisa";
  const lentesRedondas = !!def.oculos && !semOculos && (def.oculosModelo ?? "redondo") === "redondo";
  const { k, geo } = useMemo(() => geometriaBoneco(def, camisa, cracha, !!headset, semChapeu, semOculos), [def, camisa, cracha, headset, semChapeu, semOculos]);
  useEffect(() => { reterGeometria(k); return () => soltarGeometria(k); }, [k]);
  const b = useMemo(() => montarBoneco(geo, logo, lentesRedondas, traje === "camisa" && !def.uniforme, escalaDoBoneco(def), lg), [geo, logo, lentesRedondas, traje, def, lg]);
  useImperativeHandle(ref, () => ({ ossos: b.ossos, raiz: b.raiz }), [b]);
  const camera = useThree((s) => s.camera), el = useThree((s) => s.gl.domElement);
  useEffect(() => (MEDIR ? registrarMedida(b.raiz, def.id, camera, el) : undefined), [b, def.id, camera, el]);
  // roupas e acessórios comprados (12/11/2026): presos aos ossos depois de montar o boneco; as asinhas batem devagar
  const asas = useRef<THREE.Object3D[]>([]);
  useEffect(() => {
    const feitos = vestirAcessorios(b.ossos, chaveAcc ? chaveAcc.split(",") : [], !!headset, lg, lb);
    asas.current = feitos.flatMap((o) => o.children.filter((c) => c.userData.asa));
    return () => { feitos.forEach((o) => o.removeFromParent()); asas.current = []; };
  }, [b, chaveAcc, headset, lg, lb]);
  // uniforme da empresa (20/11/2026): a logo do lote no peito
  const uniforme = def.uniforme ?? "";
  useEffect(() => {
    if (!uniforme) return;
    let vivo = true; let placa: THREE.Mesh | null = null;
    void materialUniforme(uniforme).then((m) => {
      const peito = b.ossos.chest; if (!vivo || !m || !peito) return;
      const l = lugarDaLogo(traje, lg);
      placa = new THREE.Mesh(placaUniforme(), m); placa.name = "logo-uniforme"; placa.position.set(...l.pos); placa.rotation.y = l.giro; peito.add(placa);
    });
    return () => { vivo = false; placa?.removeFromParent(); };
  }, [b, uniforme, traje, lg]);
  useFrame(({ clock }) => { if (asas.current.length) baterAsas(asas.current, clock.elapsedTime); });
  return <primitive object={b.raiz} />;
});

// ---------- roupas e acessórios (12/11/2026; novos em 20/11/2026) ----------
// Cada item é um grupo de malhas simples preso a um osso (cabeça, peito ou antebraço), então acompanha a animação.
// Geometria e material são compartilhados entre bonecos. Coordenadas do osso: frente do rosto em +z, costas em -z.
type OssoAcc = "head" | "chest" | "lowerArmL" | "lowerArmR";
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
    // ---- novos (20/11/2026) ----
    case "chapeu-panama":
      peca(G, cilindro(0.36, 0.36, 0.016, 28), c, [0, 0.37, -0.01]);
      peca(G, cilindro(0.195, 0.215, 0.14, 20), c, [0, 0.445, -0.01]);
      peca(G, cilindro(0.218, 0.218, 0.036, 20), "#2A2D33", [0, 0.395, -0.01]); // fita
      G.rotation.x = -0.06;
      return { osso: "head", obj: G };
    case "boina":
      peca(G, toroAcc(0.215, 0.02), c, [0, 0.375, -0.01], { rot: [Math.PI / 2, 0, 0] }); // borda
      peca(G, esfera(1), c, [0.035, 0.41, -0.02], { rot: [0, 0, -0.16], esc: [0.275, 0.085, 0.27] });
      peca(G, esfera(0.018), c, [0.045, 0.495, -0.02]);
      return { osso: "head", obj: G };
    case "oculos-aviador":
      for (const s of [1, -1]) {
        peca(G, esfera(1), "#3D3A2A", [s * 0.074, 0.203, 0.236], { a: "vidro", esc: [0.05, 0.043, 0.008], rot: [0, 0, -s * 0.12] });
        peca(G, toroAcc(0.047, 0.005), c, [s * 0.074, 0.203, 0.238], { a: "metal", esc: [1.06, 0.92, 1], rot: [0, 0, -s * 0.12] });
      }
      peca(G, caixa(0.05, 0.006, 0.006), c, [0, 0.235, 0.242], { a: "metal" });
      peca(G, caixa(0.03, 0.005, 0.005), c, [0, 0.214, 0.244], { a: "metal" });
      hastes(G, c, "metal");
      return { osso: "head", obj: G };
    case "gravata-borboleta":
      for (const s of [1, -1]) peca(G, esfera(1), c, [s * 0.034, 0.318, 0.108], { rot: [0, 0, s * 0.25], esc: [0.038, 0.026, 0.014] });
      peca(G, esfera(0.016), c, [0, 0.318, 0.114]);
      return { osso: "chest", obj: G };
    case "bolsa-couro": {
      const alca = "#3B2618";
      peca(G, caixa(0.026, 0.5, 0.012), alca, [-0.015, 0.13, 0.136], { rot: [0, 0, -0.6] }); // alça: do ombro esquerdo ao quadril direito
      peca(G, caixa(0.026, 0.5, 0.012), alca, [-0.015, 0.13, -0.136], { rot: [0, 0, -0.6] });
      peca(G, caixa(0.026, 0.012, 0.27), alca, [0.135, 0.335, 0]); // por cima do ombro
      peca(G, caixa(0.16, 0.12, 0.05), c, [-0.16, -0.14, 0.085], { rot: [0, -0.5, 0] });
      peca(G, caixa(0.162, 0.05, 0.054), "#5E3720", [-0.16, -0.098, 0.086], { rot: [0, -0.5, 0] }); // tampa
      peca(G, caixa(0.022, 0.016, 0.008), "#D4A63A", [-0.147, -0.11, 0.113], { a: "metal", rot: [0, -0.5, 0] });
      return { osso: "chest", obj: G };
    }
    // ---- exclusivos do passaporte e do Natal (20/11/2026, frente "visitante") ----
    case "cordao-passaporte":
      peca(G, toroAcc(0.14, 0.008), "#C9A24A", [0, 0.29, 0.02], { rot: [Math.PI / 2 + 0.5, 0, 0], esc: [1.15, 1, 1] }); // cordão dourado
      peca(G, caixa(0.085, 0.115, 0.016), c, [0, 0.165, 0.158], { rot: [-0.12, 0, 0] }); // o passaporte (capa azul)
      peca(G, cilindro(0.019, 0.019, 0.005, 14), "#D7B25A", [0, 0.175, 0.168], { a: "metal", rot: [Math.PI / 2 - 0.12, 0, 0] }); // brasão
      peca(G, caixa(0.05, 0.006, 0.005), "#D7B25A", [0, 0.135, 0.164], { a: "metal", rot: [-0.12, 0, 0] });
      return { osso: "chest", obj: G };
    case "chapeu-explorador":
      peca(G, cilindro(0.34, 0.34, 0.018, 28), c, [0, 0.368, -0.01]); // aba
      peca(G, cilindro(0.185, 0.215, 0.15, 20), c, [0, 0.448, -0.01]);
      peca(G, meiaEsfera(0.186), c, [0, 0.52, -0.01], { esc: [1, 0.35, 1] }); // copa arredondada
      peca(G, cilindro(0.218, 0.218, 0.04, 20), "#5B3A1E", [0, 0.398, -0.01]); // fita de couro
      peca(G, cilindro(0.022, 0.022, 0.006, 12), "#D7B25A", [0, 0.398, 0.208], { a: "metal", rot: [Math.PI / 2, 0, 0] }); // bússola na fita
      G.rotation.x = -0.05;
      return { osso: "head", obj: G };
    case "mochila-expedicao":
      peca(G, caixa(0.29, 0.32, 0.14), c, [0, 0.1, -0.19]);
      peca(G, caixa(0.2, 0.12, 0.045), "#3A5230", [0, 0.02, -0.275]); // bolso
      peca(G, cilindro(0.065, 0.065, 0.34, 14), "#B5532D", [0, 0.31, -0.2], { rot: [0, 0, Math.PI / 2] }); // saco de dormir enrolado
      for (const s of [1, -1]) {
        peca(G, toroAcc(0.068, 0.008), "#2A2D33", [s * 0.1, 0.31, -0.2], { rot: [0, Math.PI / 2, 0] }); // tiras do saco
        peca(G, caixa(0.03, 0.27, 0.016), "#1F2630", [s * 0.135, 0.15, 0.092]); // alça na frente
        peca(G, caixa(0.03, 0.016, 0.28), "#1F2630", [s * 0.135, 0.312, -0.045]); // alça no ombro
      }
      peca(G, cilindro(0.03, 0.03, 0.008, 12), "#D7B25A", [0.08, 0.12, -0.262], { a: "metal", rot: [Math.PI / 2, 0, 0] }); // emblema
      return { osso: "chest", obj: G };
    case "gorro-natal": {
      const ponta = new THREE.Group(); ponta.position.set(0, 0.41, -0.01); ponta.rotation.set(-0.55, 0, 0.18);
      peca(ponta, conePonta(0.205, 0.36), c, [0, 0.17, 0]);
      peca(ponta, esfera(0.055), "#F4F1EA", [0, 0.35, 0]); // pompom
      G.add(ponta);
      peca(G, toroAcc(0.215, 0.045), "#F4F1EA", [0, 0.395, -0.01], { rot: [Math.PI / 2, 0, 0] }); // barra branca
      return { osso: "head", obj: G };
    }
    case "relogio":
    case "relogio-ouro": {
      const ouro = id === "relogio-ouro", y = -S.antebracoL + 0.035;
      peca(G, toroAcc(0.054, 0.011), c, [0, y, 0], { a: ouro ? "metal" : "fosco", rot: [Math.PI / 2, 0, 0] });
      peca(G, cilindro(0.028, 0.028, 0.012, 16), ouro ? "#D4A63A" : "#C9CDD3", [0.062, y, 0], { a: "metal", rot: [0, 0, Math.PI / 2] });
      peca(G, cilindro(0.022, 0.022, 0.004, 16), ouro ? "#F6E7B0" : "#F4F4F0", [0.069, y, 0], { rot: [0, 0, Math.PI / 2] });
      return { osso: "lowerArmL", obj: G };
    }
    case "pulseira":
      peca(G, toroAcc(0.052, 0.01), c, [0, -S.antebracoL + 0.03, 0], { rot: [Math.PI / 2, 0, 0] });
      peca(G, toroAcc(0.05, 0.006), "#D4A63A", [0, -S.antebracoL + 0.05, 0], { a: "metal", rot: [Math.PI / 2, 0, 0] });
      return { osso: "lowerArmR", obj: G };
    case "brinco-argola":
      for (const s of [1, -1]) peca(G, toroAcc(0.02, 0.0045), c, [s * 0.238, 0.122, 0.012], { a: "metal", rot: [0, Math.PI / 2, 0] });
      return { osso: "head", obj: G };
    case "brinco-ponto":
      for (const s of [1, -1]) peca(G, esfera(0.012), c, [s * 0.252, 0.152, 0.014], { a: "vidro" });
      return { osso: "head", obj: G };
  }
  return null;
}

// o que sai do boneco quando há acessório no lugar: o chapéu do tipo (cabeça) e os óculos do tipo (rosto)
function lugaresUsados(chave: string) {
  const lugares = new Set(chave ? chave.split(",").map((i) => ACESSORIO_POR_ID[i]?.lugar) : []);
  return { semChapeu: lugares.has("cabeca"), semOculos: lugares.has("rosto") };
}
// lg/lb: largura do corpo e grossura dos braços (biotipo): o que vai no peito e no pulso acompanha
function vestirAcessorios(ossos: Ossos, ids: string[], headset: boolean, lg = 1, lb = 1) {
  const feitos: THREE.Object3D[] = [];
  for (const id of limparEquipados(ids)) {
    if (id === "fone" && headset) continue; // a atendente já usa o headset dela
    const r = montarAcessorio(id); const osso = r ? ossos[r.osso] : null;
    if (!r || !osso) continue;
    if (r.osso === "chest" && lg !== 1) r.obj.scale.set(lg, 1, lg);
    if ((r.osso === "lowerArmL" || r.osso === "lowerArmR") && lb !== 1) r.obj.scale.set(lb, 1, lb);
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
// ritmo (21/11/2026, opcional): o relógio da animação anda ritmo() vezes mais rápido; o personagem passa a mesma velocidade
// em que anda, para os pés não patinarem no chão (scene/Personagens.tsx)
export function useAnimacao(handle: React.RefObject<BonecoHandle | null>, pose: () => Pose, fase: number, hipsBaseY = 0.5, escalaHips = 1, ritmo?: () => number) {
  const relogio = useRef(0);
  useFrame((st, dt) => {
    const h = handle.current; if (!h) return;
    if (ritmo) relogio.current += Math.min(dt, 0.1) * ritmo();
    animar(h.ossos, pose(), ritmo ? relogio.current : st.clock.elapsedTime, Math.min(dt, 0.05), fase, hipsBaseY, escalaHips);
  });
}
// Altura de descanso do quadril de cada tipo de boneco
export const HIPS = { procedural: { base: 0.5, escala: 1 }, glb: { base: 0.34, escala: 0.75 } };
