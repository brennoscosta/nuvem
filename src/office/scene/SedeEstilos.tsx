"use client";
// Estilos das sedes (17/11/2026, pedido do dono: "quero prédios diferentes, visuais; estão todos iguais. Estilo diferente,
// com vidros bonitos, outro com outros detalhes"). A planta térrea (16 x 13 m desde 19/11/2026, quando cada sede passou a
// ocupar um lote só; data/onestate.ts › SEDE) e a entrada da frente (+z local) são as mesmas em todas; muda a casca:
//  - classica (Social RP): a torre original, vidro escuro e frisos dourados (desenhada em scene/OneStateHQ.tsx);
//  - tech (AppZone, "Distrito Tech"): vidro azul espelhado com montantes finos de alumínio, aletas na cor da
//    marca que acendem à noite (no lado de dentro do quarteirão sobem em degraus, como as barras de sinal do celular), terraço com jardim,
//    pérgola e caixa de vidro no topo, e marquise de vidro na entrada;
//  - festa (bday.fm): vidro lilás com quinas arredondadas, sacada branca em cada andar com floreiras e fita de luz rosa,
//    varal de lâmpadas no terraço e letreiro de lâmpadas na entrada, como marquise de teatro;
//  - estudio (NUVCAM): estúdio de TV de vidro preto com frisos vermelhos, andares de cima em degraus, telão de LED na
//    fachada sul (logo e selo AO VIVO, com letreiro corrido), mastro de antena listrado e parabólicas.
// O que não se mexe vai para o <Estatico> (poucas malhas); o que acende à noite usa material próprio com brilho, sem luz de
// verdade, e um laço só por quadro ajusta esse brilho (brilhoEstilos, chamado pela SedeHQ).
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { caixa, cilindro, circulo, esfera, mat, plano } from "./geo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { SEDE } from "../data/onestate";
import { LOTE } from "../data/mundo";
import { alturaSede, andaresComAreas, degrausEstudio, salasNaFace, type Sede, type EstiloSede } from "../data/sedes";

type V3 = [number, number, number];
const PI = Math.PI;
const S = SEDE.z + SEDE.d / 2, N = SEDE.z - SEDE.d / 2, O = SEDE.x - SEDE.w / 2, L = SEDE.x + SEDE.w / 2, AND = SEDE.andar; // faces e pé-direito
// 18/11/2026 ("os prédios podem ser menores ainda"): as peças foram desenhadas para a torre de 22 x 16 m com andares de
// 4 m. SX e SZ levam as posições escritas à mão para a planta de agora; K leva as alturas da entrada (pórtico, marquise,
// letreiro, cobertura) para o pé-direito de agora
export const SX = SEDE.w / 22, SZ = SEDE.d / 16, K = AND / 4;
// entradas de cada estilo (a logo da entrada, em logosDe, usa as mesmas alturas)
export const PORTICO = { vao: 4.8 * K, placa: 4.8 * K + 1.55 }; // clássica: vão livre e centro do painel preto da logo
const MARQUISE = 4.3 * K; // tech: laje de vidro (o painel da logo fica 1,22 m acima)
const LETREIRO = 3.3 * K; // festa: base do letreiro de lâmpadas (2,6 m de altura)
const COBERTURA = 4.4 * K; // estudio: cobertura preta (painel da logo 1,025 m acima e a luz AO VIVO 2,185 m acima)
export const comAlfa = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

// ---------- pintura das fachadas: cores do vidro, caixilhos e o jeito da placa com o nome da área ----------
export interface Paleta {
  vidro: [string, string]; saguao: string; montante: string; montantes: number; largMontante: number;
  placa: "classica" | "app" | "pilula" | "estudio"; texto: string | null; faixa: string; laje: string;
  // onde a placa com o nome começa, em fração da altura do andar (0 = no alto). No bday.fm a sacada de cada andar sai
  // 1,4 m para fora e, vista de cima, cobria o alto do andar de baixo, com a placa junto: lá ela desce para o meio da sala
  placaY?: number;
}
export const PALETAS: Record<EstiloSede, Paleta> = {
  classica: { vidro: ["#0A0F17", "#111925"], saguao: "#FFD78A", montante: "#171B21", montantes: 3, largMontante: 4, placa: "classica", texto: null, faixa: "#14181E", laje: "#262B32" },
  // AppZone: vidro azul-petróleo por trás da pele espelhada, caixilho de alumínio a cada 1,83 m (o mesmo dos montantes 3D)
  tech: { vidro: ["#0D2033", "#15304A"], saguao: "#CFE8FF", montante: "#B8C7D3", montantes: 4, largMontante: 3, placa: "app", texto: "#F4F8FB", faixa: "#0F1C2A", laje: "#C9D3DC" },
  // bday.fm: vidro lilás e a placa branca arredondada, como etiqueta de presente
  festa: { vidro: ["#341C55", "#4A2660"], saguao: "#FFC4E6", montante: "#4A3266", montantes: 2, largMontante: 4, placa: "pilula", texto: null, faixa: "#2A1546", laje: "#F4F1F8", placaY: 0.3 },
  // NUVCAM: vidro preto e a placa de estúdio com a tarja vermelha
  estudio: { vidro: ["#060609", "#0D0D12"], saguao: "#FFB4B4", montante: "#1C1C22", montantes: 3, largMontante: 4, placa: "estudio", texto: "#F5F5F7", faixa: "#0A0A0D", laje: "#151519" },
};

// ---------- andares: retângulo de cada um (o NUVCAM tem recuos em cima) e o raio das quinas (bday.fm) ----------
export interface Piso { f: number; x0: number; x1: number; z0: number; z1: number; canto: number }
const CANTO_FESTA = 2.6; // 3 m na planta de 22 x 16
// NUVCAM: os andares de cima recuam 2 m dos lados e 3 m na frente a cada degrau (dois degraus a partir de 7 andares, um
// abaixo disso: data/sedes.ts › degrausEstudio; 18/11/2026: 4 andares)
const recuoEstudio = (f: number, n: number) => { const D = degrausEstudio(n); return Math.min(D, Math.max(0, f - (n - D) + 1)); };
// telão de LED: entre o último andar com nome de área e o topo do bloco cheio (8 m de altura no prédio de 7 andares; um
// andar inteiro, 3,4 m, no de 4 andares)
export function telaoDe(sede: Sede) { const F = sede.andares - degrausEstudio(sede.andares), y0 = (andaresComAreas(sede) + 1) * AND; return { y0, s: Math.max(0.75 * AND, F * AND - y0) / 8 }; }
export function pisosDe(sede: Sede): Piso[] {
  return Array.from({ length: sede.andares }, (_, f) => {
    if (sede.estilo === "estudio") { const k = recuoEstudio(f, sede.andares); return { f, x0: O + 2 * k, x1: L - 2 * k, z0: N, z1: S - 3 * k, canto: 0 }; }
    return { f, x0: O, x1: L, z0: N, z1: S, canto: sede.estilo === "festa" ? CANTO_FESTA : 0 };
  });
}

// ---------- logos: no alto (frente e lado da rua) e na entrada ----------
// chao = altura onde os postes da placa nascem (ficam 0,8 m enterrados na coroa, como na torre original)
export interface LogoAlto { x: number; z: number; rotY: number; w: number; chao: number; verso: boolean; postes: number[] }
export interface LogosEstilo { alto: LogoAlto[]; portico: { pos: V3; w: number } }
// 18/11/2026: com as torres mais baixas, as logos do alto ficaram 20% menores; depois, com a planta menor, acompanham
// também a largura da torre (SX)
// 19/11/2026: a logo do lado vai para o lado da rua da esquina (sede.lado); as posições de logosBase são do lado oeste e,
// no leste, espelham em volta do meio da torre
export function logosDe(sede: Sede): LogosEstilo {
  const l = logosBase(sede), k = 0.8 * SX, espelha = sede.lado === "leste";
  return { ...l, alto: l.alto.map((a, i) => ({ ...a, w: a.w * k, postes: a.postes.map((p) => p * k), ...(i === 1 && espelha ? { x: 2 * SEDE.x - a.x, rotY: -a.rotY } : {}) })) };
}
function logosBase(sede: Sede): LogosEstilo {
  const H = alturaSede(sede);
  switch (sede.estilo) {
    case "tech": return {
      alto: [{ x: SEDE.x, z: S - 0.9, rotY: 0, w: 14, chao: H - 0.3, verso: true, postes: [-5, 0, 5] },
        { x: O + 0.9, z: SEDE.z - 1, rotY: -PI / 2, w: 10, chao: H - 0.3, verso: false, postes: [-3.6, 3.6] }],
      portico: { pos: [SEDE.x, MARQUISE + 1.22, S + 4.93], w: 6 },
    };
    case "festa": return {
      alto: [{ x: SEDE.x, z: S - 1.2, rotY: 0, w: 13, chao: H - 0.2, verso: true, postes: [-4.5, 0, 4.5] },
        { x: O + 1.2, z: SEDE.z, rotY: -PI / 2, w: 8.5, chao: H - 0.2, verso: false, postes: [-3, 3] }],
      portico: { pos: [SEDE.x, LETREIRO + 1.3, S + 4.62], w: 6 },
    };
    case "estudio": {
      const D = degrausEstudio(sede.andares), zt = S - 3 * D, xt = O + 2 * D; // o último degrau
      return {
        alto: [{ x: SEDE.x, z: zt - 0.9, rotY: 0, w: 11, chao: H - 0.2, verso: true, postes: [-4, 0, 4] },
          { x: xt + 0.9, z: (N + zt) / 2, rotY: -PI / 2, w: 7, chao: H - 0.2, verso: false, postes: [-2.6, 2.6] }],
        portico: { pos: [SEDE.x, COBERTURA + 1.025, S + 4.08], w: 5.4 },
      };
    }
    default: return {
      alto: [{ x: SEDE.x, z: S - 0.9, rotY: 0, w: 15, chao: H, verso: true, postes: [-5.5, 0, 5.5] },
        { x: O + 0.9, z: SEDE.z - 1, rotY: -PI / 2, w: 11, chao: H, verso: false, postes: [-4, 4] }],
      portico: { pos: [SEDE.x, PORTICO.placa, S + 2.56], w: 7 },
    };
  }
}

// ---------- materiais que acendem à noite (no módulo: a cena só lê; o brilho muda num lugar só) ----------
// fixo: dia → noite; piscaA/piscaB: lâmpadas que se alternam à noite (letreiro e varal); aviso: luz de balizamento do mastro
type Modo = "fixo" | "piscaA" | "piscaB" | "aviso";
interface Luz { m: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial; dia: number; noite: number; modo: Modo }
const LUZES = new Map<string, Luz>();
function luz(chave: string, brilho: string, o: { base?: string; dia: number; noite: number; modo?: Modo; rough?: number; metal?: number; mapa?: () => THREE.Texture }) {
  let l = LUZES.get(chave);
  if (!l) {
    // o brilho nunca começa em zero: o Estatico trataria a peça como "sem brilho" e assaria a cor (sem acender à noite)
    const dia = Math.max(0.02, o.dia), mapa = o.mapa?.();
    // com textura (quinas do bday.fm): a própria pintura acende, como as fachadas
    const comum = mapa ? { map: mapa, emissiveMap: mapa, color: "#FFFFFF", emissive: "#FFFFFF", emissiveIntensity: dia } : { color: o.base ?? brilho, emissive: brilho, emissiveIntensity: dia };
    const m = leve() ? new THREE.MeshLambertMaterial(comum) : new THREE.MeshStandardMaterial({ ...comum, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0 });
    l = { m, dia, noite: o.noite, modo: o.modo ?? "fixo" }; LUZES.set(chave, l);
  }
  return l.m;
}
// pele de vidro espelhado (AppZone): transparente; de dia mostra o céu refletido, à noite quase some e as salas acesas
// aparecem. O reflexo é pintado (céu claro em cima, mais fundo embaixo e um brilho na diagonal): visto de cima, o reflexo
// de verdade do mapa de ambiente pegaria o chão e o vidro ficaria escuro
function pintarReflexo() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 64;
  const g = c.getContext("2d")!;
  const ceu = g.createLinearGradient(0, 0, 0, 64); ceu.addColorStop(0, "#F2FAFF"); ceu.addColorStop(0.55, "#B9DDF6"); ceu.addColorStop(1, "#7DB4DD");
  g.fillStyle = ceu; g.fillRect(0, 0, 128, 64);
  const brilho = g.createLinearGradient(0, 0, 128, 64); brilho.addColorStop(0.3, "rgba(255,255,255,0)"); brilho.addColorStop(0.45, "rgba(255,255,255,.55)"); brilho.addColorStop(0.55, "rgba(255,255,255,0)");
  g.fillStyle = brilho; g.fillRect(0, 0, 128, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const PELES = new Map<string, { m: THREE.Material; dia: number; noite: number }>();
function pele(chave: string, dia: number, noite: number) {
  let p = PELES.get(chave);
  if (!p) {
    const comum = { map: pintarReflexo(), transparent: true, opacity: dia, depthWrite: false };
    const m = leve() ? new THREE.MeshLambertMaterial(comum) : new THREE.MeshStandardMaterial({ ...comum, roughness: 0.1, metalness: 0.15 });
    p = { m, dia, noite }; PELES.set(chave, p);
  }
  return p.m;
}
// louça das parabólicas: as duas faces (o prato é uma calota de esfera virada)
const DUPLOS = new Map<string, THREE.Material>();
function duplo(cor: string) {
  let m = DUPLOS.get(cor);
  if (!m) { m = leve() ? new THREE.MeshLambertMaterial({ color: cor, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: cor, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }); DUPLOS.set(cor, m); }
  return m;
}
export function brilhoEstilos(noite: number, t: number) {
  const vez = Math.floor(t / 0.55) % 2 === 0;
  for (const l of LUZES.values()) {
    let k = l.dia + (l.noite - l.dia) * noite;
    if (l.modo === "piscaA" || l.modo === "piscaB") { const acesa = vez === (l.modo === "piscaA"); k = l.dia + ((acesa ? l.noite : l.noite * 0.25) - l.dia) * noite; }
    else if (l.modo === "aviso") k = t % 1.6 < 0.35 ? l.noite : l.dia;
    l.m.emissiveIntensity = Math.max(0.02, k);
  }
  for (const p of PELES.values()) p.m.opacity = p.dia + (p.noite - p.dia) * noite;
}

// ---------- geometrias próprias ----------
const GEOS = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(k: string, criar: () => T): T { let g = GEOS.get(k) as T | undefined; if (!g) { g = criar(); GEOS.set(k, g); } return g; }
// quarto de cilindro aberto (guarda-corpo nas quinas arredondadas): q = 0 sudeste, 1 nordeste, 2 noroeste, 3 sudoeste
const arco = (r: number, h: number, q: number) => geo(`arco${r},${h},${q}`, () => new THREE.CylinderGeometry(r, r, h, 10, 1, true, (q * PI) / 2, PI / 2));
// quarto de cilindro fechado (quinas do Arredondado): só a parte que aparece; os outros 3/4 ficavam escondidos dentro das
// caixas (17/11/2026: a bday.fm passava de 22 mil triângulos). Mesmas quinas do arco: 0 sudeste, 1 nordeste, 2 noroeste, 3 sudoeste.
const quarto = (r: number, h: number, q: number, seg: number) => geo(`quarto${r},${h},${q},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg, 1, false, (q * PI) / 2, PI / 2));
// bolinha de poucas faces (lâmpadas: 20 triângulos; plantas: 80) no lugar da esfera de 128
const bola = (r: number, detalhe: 0 | 1) => geo(`bola${r},${detalhe}`, () => new THREE.IcosahedronGeometry(r, detalhe));
// prato da parabólica: calota de esfera
const prato = (r: number) => geo(`prato${r}`, () => new THREE.SphereGeometry(r, 18, 5, 0, PI * 2, 0, 0.72));
// barra entre dois pontos (cilindro de altura 1 esticado: uma geometria só para todas)
const CIMA = new THREE.Vector3(0, 1, 0);
function Barra({ a, b, r, m }: { a: V3; b: V3; r: number; m: THREE.Material }) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(CIMA, d.normalize());
  return <mesh geometry={cilindro(r, r, 1, 5)} material={m} position={va.add(vb).multiplyScalar(0.5).toArray()} quaternion={q} scale={[1, len, 1]} />;
}
// prisma de cantos arredondados (duas caixas em cruz e um cilindro em cada quina)
function Arredondado({ x0, x1, z0, z1, r, y, h, m, sombra = false, seg = 20 }: { x0: number; x1: number; z0: number; z1: number; r: number; y: number; h: number; m: THREE.Material; sombra?: boolean; seg?: number }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  return (
    <group>
      <mesh geometry={caixa(w - 2 * r, h, d)} material={m} position={[cx, y, cz]} castShadow={sombra} />
      <mesh geometry={caixa(w, h, d - 2 * r)} material={m} position={[cx, y, cz]} castShadow={sombra} />
      {[[x0 + r, z0 + r, 2], [x1 - r, z0 + r, 1], [x0 + r, z1 - r, 3], [x1 - r, z1 - r, 0]].map(([x, z, q]) => <mesh key={q} geometry={quarto(r, h, q, Math.max(3, Math.round(seg / 4)))} material={m} position={[x, y, z]} castShadow={sombra} />)}
    </group>
  );
}
// guarda-corpo de vidro com corrimão em volta de um retângulo arredondado
function Guarda({ x0, x1, z0, z1, r, y0, h, vidro, corrimao }: { x0: number; x1: number; z0: number; z1: number; r: number; y0: number; h: number; vidro: THREE.Material; corrimao: THREE.Material }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0 - 2 * r, d = z1 - z0 - 2 * r, yc = y0 + h / 2, yt = y0 + h;
  const quinas: [number, number, number][] = [[cx + w / 2, cz + d / 2, 0], [cx + w / 2, cz - d / 2, 1], [cx - w / 2, cz - d / 2, 2], [cx - w / 2, cz + d / 2, 3]];
  return (
    <group>
      {[z0, z1].map((z) => <group key={`z${z}`}><mesh geometry={caixa(w, h, 0.04)} material={vidro} position={[cx, yc, z]} /><mesh geometry={caixa(w, 0.07, 0.1)} material={corrimao} position={[cx, yt, z]} /></group>)}
      {[x0, x1].map((x) => <group key={`x${x}`}><mesh geometry={caixa(0.04, h, d)} material={vidro} position={[x, yc, cz]} /><mesh geometry={caixa(0.1, 0.07, d)} material={corrimao} position={[x, yt, cz]} /></group>)}
      {r > 0 && quinas.map(([x, z, q]) => <group key={`q${q}`}><mesh geometry={arco(r, h, q)} material={vidro} position={[x, yc, z]} /><mesh geometry={arco(r, 0.08, q)} material={corrimao} position={[x, yt, z]} /></group>)}
    </group>
  );
}

// ---------- o lote da sede (19/11/2026, pedido do dono: cada sede num lote de 20 x 20 m) ----------
// No lugar da praça de 40 x 40 m com totem e canteiros: gramado, o pátio de entrada da fachada até a calçada (na largura
// das marquises, com a faixa do caminho até a porta) e um canteiro em cada ponta, fora das colunas das marquises. Nas
// cores de cada estilo. Parte "sempre": o chão e o jardim da frente, à mostra também na vista por dentro (o interior
// cobre o resto do lote); parte "fora": os arbustos dos lados e do fundo, que ficariam dentro das salas.
const JARDIM: Record<EstiloSede, { piso: string; canteiro: string; verde: string; flor: string; redondos?: boolean }> = {
  classica: { piso: "#6B7079", canteiro: "#1E2228", verde: "#3E7D4A", flor: "#4C9A5A" },
  tech: { piso: "#AEB8C2", canteiro: "#D5DCE3", verde: "#3E8B4F", flor: "#5BAA5E" },
  festa: { piso: "#E6DDEF", canteiro: "#F7F4FB", verde: "#4C9A5A", flor: "#F472B6", redondos: true }, // vasos redondos com flores
  estudio: { piso: "#2B2C31", canteiro: "#121216", verde: "#3E7D4A", flor: "#4C9A5A" },
};
// friso do caminho: dourado na clássica; nas outras, a fita na cor da marca que acende à noite (a mesma da casca)
function frisoDe(sede: Sede) {
  if (sede.estilo === "classica") return mat(sede.cor, { rough: 0.3, metal: 0.85, emissive: sede.cor, ei: 0.25 });
  if (sede.estilo === "festa") return luz(`${sede.id}:friso`, "#FF5FB8", { dia: 0.3, noite: 1.4 });
  return luz(`${sede.id}:friso`, sede.cor, sede.estilo === "tech" ? { dia: 0.25, noite: 1 } : { dia: 0.35, noite: 2 });
}
const PATIO = { x: 6.2, z0: S, z1: LOTE / 2 - 0.1 }; // pátio da frente: largura das marquises (12 m) e até a divisa
export function JardimSede({ sede, parte = "sempre" }: { sede: Sede; parte?: "sempre" | "fora" }) {
  const J = JARDIM[sede.estilo];
  const canteiro = mat(J.canteiro, { rough: 0.6 }), verde = mat(J.verde), flor = mat(J.flor), mTerra = mat("#5A4632");
  if (parte === "fora") return (
    // arbustos baixos nas faixas de grama dos lados e do fundo da torre
    <group>
      {[-1, 1].flatMap((s) => [-6, -1.5, 3].map((z) => <mesh key={`${s}:${z}`} geometry={bola(0.55, 1)} material={verde} position={[s * (LOTE / 2 - 0.85), 0.45, z]} castShadow />))}
      {[-1, 1].map((s) => <mesh key={`f${s}`} geometry={bola(0.7, 1)} material={flor} position={[s * (LOTE / 2 - 1.1), 0.55, -LOTE / 2 + 0.9]} castShadow />)}
    </group>
  );
  const zc = (PATIO.z0 + PATIO.z1) / 2, comp = PATIO.z1 - PATIO.z0, cz = (PATIO.z0 + 0.4 + PATIO.z1) / 2, cd = PATIO.z1 - PATIO.z0 - 0.6, xc = (PATIO.x + LOTE / 2) / 2 + 0.05;
  return (
    <group>
      {/* gramado do lote todo e o pátio de entrada com a faixa do caminho até a porta */}
      <mesh geometry={caixa(LOTE - 0.2, 0.06, LOTE - 0.2)} material={mat("#6FAA5C", { rough: 1 })} position={[0, 0.03, 0]} receiveShadow />
      <mesh geometry={caixa(2 * PATIO.x, 0.08, comp)} material={mat(J.piso, { rough: 0.85 })} position={[0, 0.045, zc]} receiveShadow />
      {[-1.6, 1.6].map((x) => <mesh key={x} geometry={caixa(0.16, 0.1, comp)} material={frisoDe(sede)} position={[x, 0.055, zc]} />)}
      {/* um canteiro em cada ponta da frente */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * xc, 0, cz]}>
          {J.redondos
            ? [-1, 0, 1].map((k) => (
              <group key={k} position={[0, 0, k * 1.4]}>
                <mesh geometry={cilindro(0.62, 0.7, 0.55, 14)} material={canteiro} position={[0, 0.28, 0]} castShadow />
                <mesh geometry={cilindro(0.56, 0.56, 0.06, 14)} material={mTerra} position={[0, 0.56, 0]} />
                <mesh geometry={bola(0.4, 1)} material={verde} position={[0, 0.82, 0]} />
                {[0, 1, 2].map((j) => <mesh key={j} geometry={bola(0.16, 0)} material={flor} position={[Math.cos(j * 2.1) * 0.36, 1.0, Math.sin(j * 2.1) * 0.36]} />)}
              </group>))
            : <>
              <mesh geometry={caixa(LOTE / 2 - PATIO.x - 0.5, 0.5, cd)} material={canteiro} position={[0, 0.25, 0]} castShadow />
              <mesh geometry={caixa(LOTE / 2 - PATIO.x - 0.8, 0.08, cd - 0.3)} material={mTerra} position={[0, 0.51, 0]} />
              {[-1.4, 0, 1.4].map((z, k) => <mesh key={z} geometry={esfera(0.5, 10)} material={k === 1 ? flor : verde} position={[0, 0.85, z]} />)}
            </>}
        </group>
      ))}
    </group>
  );
}

// ================= AppZone: "Distrito Tech" =================
function Tech({ sede }: { sede: Sede }) {
  const H = alturaSede(sede), n = sede.andares, cor = sede.cor;
  const mNucleo = mat("#0B1622", { rough: 0.6 }), mPrata = mat("#C9D3DC", { rough: 0.32, metal: 0.75 });
  const mAleta = luz(`${sede.id}:aleta`, cor, { dia: 0.2, noite: 0.95, rough: 0.35, metal: 0.25 });
  const mPele = pele(`${sede.id}:pele`, 0.66, 0.08);
  const mVidro = mat("#CFE8FF", { rough: 0.08, metal: 0.3, opacity: 0.35 });
  const mCaixaVidro = luz(`${sede.id}:caixa`, "#8FD3FF", { base: "#9BC9E8", dia: 0.12, noite: 0.9, rough: 0.08, metal: 0.6 });
  const mDeck = mat("#9A7552", { rough: 0.8 }), mVaso = mat("#D5DCE3", { rough: 0.7 }), mTronco = mat("#6B4A32"), mCopa = mat("#3E8B4F"), mCopa2 = mat("#5BAA5E");
  // faixa espelhada só na altura da janela de cada andar: a placa com o nome da área (topo do andar) fica à mostra
  const yJ0 = 0.2, hJ = AND * 0.73 - 0.26;
  const xs = Array.from({ length: 13 }, (_, i) => O + (i * SEDE.w) / 12), zs = Array.from({ length: 9 }, (_, i) => N + (i * SEDE.d) / 8);
  const meio = Array.from({ length: n - 1 }, (_, i) => i + 1);
  return (
    <group>
      <JardimSede sede={sede} parte="fora" />
      {/* núcleo e bordas finas de alumínio em cada piso */}
      <mesh geometry={caixa(SEDE.w - 0.1, H, SEDE.d - 0.1)} material={mNucleo} position={[SEDE.x, H / 2, SEDE.z]} castShadow receiveShadow />
      {meio.map((f) => <mesh key={`l${f}`} geometry={caixa(SEDE.w + 0.24, 0.14, SEDE.d + 0.24)} material={mPrata} position={[SEDE.x, f * AND, SEDE.z]} />)}
      {/* montantes finos: frente e fundo a cada 1,83 m, lados a cada 2 m (batem com o caixilho pintado) */}
      {xs.map((x, i) => [S + 0.09, N - 0.09].map((z) => <mesh key={`mx${i}:${z}`} geometry={caixa(0.07, H, 0.1)} material={mPrata} position={[x, H / 2, z]} />))}
      {zs.map((z, i) => [O - 0.09, L + 0.09].map((x) => <mesh key={`mz${i}:${x}`} geometry={caixa(0.1, H, 0.07)} material={mPrata} position={[x, H / 2, z]} />))}
      {/* pele de vidro espelhado */}
      {meio.map((f) => { const y = f * AND + yJ0 + hJ / 2; return (
        <group key={`p${f}`}>
          <mesh geometry={plano(SEDE.w, hJ)} material={mPele} position={[SEDE.x, y, S + 0.05]} />
          <mesh geometry={plano(SEDE.w, hJ)} material={mPele} position={[SEDE.x, y, N - 0.05]} rotation={[0, PI, 0]} />
          <mesh geometry={plano(SEDE.d, hJ)} material={mPele} position={[O - 0.05, y, SEDE.z]} rotation={[0, -PI / 2, 0]} />
          <mesh geometry={plano(SEDE.d, hJ)} material={mPele} position={[L + 0.05, y, SEDE.z]} rotation={[0, PI / 2, 0]} />
        </group>); })}
      {/* aletas na cor da marca: no lado da rua (o das áreas, sede.lado) no ritmo das salas, nas divisas entre elas, sem
          cobrir os nomes; no outro lado sobem em degraus, como barras de sinal */}
      {Array.from({ length: salasNaFace(sede)[sede.lado] + 1 }, (_, m) => S - (m * SEDE.d) / salasNaFace(sede)[sede.lado]).map((z) => <mesh key={`ao${z}`} geometry={caixa(0.85, H - AND + 0.8, 0.2)} material={mAleta} position={[sede.lado === "oeste" ? O - 0.43 : L + 0.43, (AND + H + 0.8) / 2, z]} castShadow />)}
      {[0, 1, 2, 3, 4].map((k) => { const topo = H + 1.2 + k * 1.7; return <mesh key={`al${k}`} geometry={caixa(0.85, topo - AND, 0.2)} material={mAleta} position={[sede.lado === "oeste" ? L + 0.43 : O - 0.43, (AND + topo) / 2, S - k * (SEDE.d / 4)]} castShadow />; })}
      {/* coroa: laje fina, deck, guarda-corpo de vidro com a fita acesa */}
      <mesh geometry={caixa(SEDE.w + 0.3, 0.5, SEDE.d + 0.3)} material={mPrata} position={[SEDE.x, H + 0.25, SEDE.z]} castShadow />
      <mesh geometry={caixa(SEDE.w - 1.2, 0.1, SEDE.d - 1.2)} material={mDeck} position={[SEDE.x, H + 0.55, SEDE.z]} />
      <Guarda x0={O - 0.05} x1={L + 0.05} z0={N - 0.05} z1={S + 0.05} r={0} y0={H + 0.5} h={1.1} vidro={mVidro} corrimao={mAleta} />
      {/* terraço: jardim no noroeste, caixa de vidro no meio e pérgola no nordeste */}
      <mesh geometry={caixa(9.4 * SX, 0.6, 1.4)} material={mVaso} position={[SEDE.x - 5.2 * SX, H + 0.85, N + 1.6 * SZ]} castShadow />
      {[0, 1, 2, 3].map((k) => { const x = SEDE.x + (-8.6 + k * 2.3) * SX; return (
        <group key={`a${k}`}>
          <mesh geometry={cilindro(0.1, 0.14, 1.5, 6)} material={mTronco} position={[x, H + 1.9, N + 1.6 * SZ]} />
          <mesh geometry={esfera(k % 2 ? 0.85 : 1.05, 10)} material={k % 2 ? mCopa2 : mCopa} position={[x, H + 2.9, N + 1.6 * SZ]} castShadow />
        </group>); })}
      <mesh geometry={caixa(5, 2.8, 3.4)} material={mCaixaVidro} position={[SEDE.x - 1.5 * SX, H + 2, SEDE.z - 1.2 * SZ]} castShadow />
      <mesh geometry={caixa(5.3, 0.16, 3.7)} material={mPrata} position={[SEDE.x - 1.5 * SX, H + 3.45, SEDE.z - 1.2 * SZ]} />
      {[[2.6, 1.6], [9, 1.6], [2.6, 6.6], [9, 6.6]].map(([dx, dz], i) => <mesh key={`pp${i}`} geometry={cilindro(0.09, 0.09, 2.5, 8)} material={mPrata} position={[SEDE.x + dx * SX, H + 1.8, N + dz * SZ]} />)}
      {[2.6, 9].map((dx) => <mesh key={`pv${dx}`} geometry={caixa(0.2, 0.2, 5.4 * SZ)} material={mPrata} position={[SEDE.x + dx * SX, H + 3.1, N + 4.1 * SZ]} />)}
      {[0, 1, 2, 3, 4, 5].map((k) => <mesh key={`pr${k}`} geometry={caixa(7.2 * SX, 0.12, 0.18)} material={mAleta} position={[SEDE.x + 5.8 * SX, H + 3.26, N + (1.6 + k) * SZ]} />)}
      {/* marquise de vidro na entrada, presa por tirantes, com o painel da logo em cima */}
      <mesh geometry={caixa(12, 0.14, 5)} material={mVidro} position={[SEDE.x, MARQUISE, S + 2.5]} />
      <mesh geometry={caixa(12.1, 0.2, 0.12)} material={mPrata} position={[SEDE.x, MARQUISE, S + 5]} />
      {[-6.05, 6.05].map((dx) => <mesh key={`mf${dx}`} geometry={caixa(0.12, 0.2, 5)} material={mPrata} position={[SEDE.x + dx, MARQUISE, S + 2.5]} />)}
      <mesh geometry={caixa(11.8, 0.06, 0.08)} material={mAleta} position={[SEDE.x, MARQUISE - 0.13, S + 4.95]} />
      {[-5.6, 5.6].map((dx) => <mesh key={`mc${dx}`} geometry={cilindro(0.1, 0.1, MARQUISE, 10)} material={mPrata} position={[SEDE.x + dx, MARQUISE / 2, S + 4.6]} />)}
      {[-4, 4].map((dx) => <Barra key={`mt${dx}`} a={[SEDE.x + dx, 8.4 * K, S + 0.1]} b={[SEDE.x + dx, MARQUISE + 0.1, S + 4.85]} r={0.035} m={mPrata} />)}
      <mesh geometry={caixa(6.6, 2.3, 0.12)} material={mNucleo} position={[SEDE.x, MARQUISE + 1.22, S + 4.85]} castShadow />
    </group>
  );
}

// ================= bday.fm: presentes e lives =================
// vidro curvo das quinas: um pedaço de sala (vidro lilás, luz rosada, luminária, caixilho e a sacada) repetido em volta e
// andar por andar
function pintarQuina(andares: number) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 192;
  const g = c.getContext("2d")!;
  const vidro = g.createLinearGradient(0, 0, 0, 192); vidro.addColorStop(0, "#3B2160"); vidro.addColorStop(1, "#52306E");
  g.fillStyle = vidro; g.fillRect(0, 0, 64, 192);
  const luzSala = g.createLinearGradient(0, 30, 0, 192); luzSala.addColorStop(0, "rgba(255,170,230,.12)"); luzSala.addColorStop(1, "rgba(255,170,230,.45)");
  g.fillStyle = luzSala; g.fillRect(3, 30, 58, 150);
  g.fillStyle = "rgba(255,246,218,.85)"; g.fillRect(8, 34, 48, 3);
  g.fillStyle = "#2A1546"; g.fillRect(0, 0, 64, 24);
  g.fillStyle = "#5E4380"; g.fillRect(0, 0, 3, 192);
  g.fillStyle = "#F4F1F8"; g.fillRect(0, 184, 64, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, andares); t.anisotropy = 4;
  return t;
}
function Festa({ sede }: { sede: Sede }) {
  const H = alturaSede(sede), n = sede.andares, r = CANTO_FESTA, R = r + 1.4, lv = leve();
  const mNucleo = mat("#1A0F2A", { rough: 0.6 }), mBranco = mat("#F7F4FB", { rough: 0.5 });
  const mCanto = luz(`${sede.id}:canto`, "#FFFFFF", { dia: 0.16, noite: 1.06, rough: 0.2, metal: 0.35, mapa: () => pintarQuina(n) });
  const mRosa = luz(`${sede.id}:rosa`, "#FF5FB8", { dia: 0.35, noite: 1.9 });
  const mVidro = mat("#F1E6FF", { rough: 0.1, metal: 0.2, opacity: 0.3 });
  const mFolha = mat("#4C9A5A"), mFolha2 = mat("#6BBF6A"), mFlor = mat("#F472B6"), mFlor2 = mat("#C084FC");
  const mLampA = luz(`${sede.id}:lampA`, "#FFB3DE", { base: "#FFE4F3", dia: 0.35, noite: 2.4, modo: "piscaA" });
  const mLampB = luz(`${sede.id}:lampB`, "#FFE08A", { base: "#FFF6D6", dia: 0.35, noite: 2.4, modo: "piscaB" });
  const mForro = luz(`${sede.id}:forro`, "#FFE7B0", { dia: 0.35, noite: 1.4 });
  const cantos: [number, number][] = [[O + r, N + r], [L - r, N + r], [O + r, S - r], [L - r, S - r]];
  const sacadas = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const passo = lv ? 2 : 1;
  const plantas = (x0: number, x1: number, z0: number, z1: number, y: number, qtd: number) => Array.from({ length: Math.ceil(qtd / passo) }, (_, j) => {
    const k = j * passo, t = qtd > 1 ? k / (qtd - 1) : 0.5, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const m = k % 3 === 1 ? (k % 2 ? mFlor : mFlor2) : k % 2 ? mFolha2 : mFolha;
    return <mesh key={`${x0}:${z0}:${k}`} geometry={bola(0.36, 0)} material={m} position={[x, y, z]} />;
  });
  // varal de lâmpadas do terraço: do mastro do meio até postes na beirada (só para trás e para os lados: a frente é da logo)
  const topoMastro: V3 = [SEDE.x, H + 7, SEDE.z - 2 * SZ];
  // (a ponta do lado da rua fica recuada: a logo do lado está na beirada; no leste, as pontas espelham)
  const pontas: [number, number][] = ([[-9.2, 5.5], [-7.6, -0.5], [-8.6, -6.3], [0, -7.2], [8.6, -6.3], [10.2, -1], [9.2, 5.5]] as [number, number][]).map(([x, z]) => [sede.lado === "leste" ? -x : x, z]);
  return (
    <group>
      <JardimSede sede={sede} parte="fora" />
      {/* núcleo arredondado e as quinas de vidro lilás (acendem à noite) */}
      <Arredondado x0={O + 0.05} x1={L - 0.05} z0={N + 0.05} z1={S - 0.05} r={r - 0.05} y={H / 2} h={H} m={mNucleo} sombra />
      {cantos.map(([x, z], i) => <mesh key={`q${i}`} geometry={cilindro(r + 0.03, r + 0.03, H, 28)} material={mCanto} position={[x, H / 2, z]} />)}
      {/* sacadas brancas com a fita de luz rosa por baixo, guarda-corpo de vidro e floreiras na frente e nos lados */}
      {sacadas.map((f) => { const y = f * AND; return (
        <group key={`s${f}`}>
          <Arredondado x0={O - 1.4} x1={L + 1.4} z0={N - 1.4} z1={S + 1.4} r={R} y={y} h={0.32} m={mBranco} sombra />
          <Arredondado x0={O - 1.46} x1={L + 1.46} z0={N - 1.46} z1={S + 1.46} r={R + 0.06} y={y - 0.21} h={0.1} m={mRosa} />
          {!lv && <Guarda x0={O - 1.32} x1={L + 1.32} z0={N - 1.32} z1={S + 1.32} r={R - 0.08} y0={y + 0.16} h={1} vidro={mVidro} corrimao={mBranco} />}
          <mesh geometry={caixa(15 * SX, 0.42, 0.5)} material={mBranco} position={[SEDE.x, y + 0.37, S + 1]} />
          {plantas(SEDE.x - 7 * SX, SEDE.x + 7 * SX, S + 1, S + 1, y + 0.78, 9)}
          {[O - 1, L + 1].map((x) => <mesh key={`fl${x}`} geometry={caixa(0.5, 0.42, 9 * SZ)} material={mBranco} position={[x, y + 0.37, SEDE.z]} />)}
          {plantas(O - 1, O - 1, SEDE.z - 4.2 * SZ, SEDE.z + 4.2 * SZ, y + 0.78, 6)}
          {plantas(L + 1, L + 1, SEDE.z - 4.2 * SZ, SEDE.z + 4.2 * SZ, y + 0.78, 6)}
        </group>); })}
      {/* coroa: laje do terraço com a fita rosa e o guarda-corpo */}
      <Arredondado x0={O - 0.6} x1={L + 0.6} z0={N - 0.6} z1={S + 0.6} r={r + 0.6} y={H + 0.3} h={0.6} m={mBranco} sombra />
      <Arredondado x0={O - 0.66} x1={L + 0.66} z0={N - 0.66} z1={S + 0.66} r={r + 0.66} y={H + 0.06} h={0.12} m={mRosa} />
      <Guarda x0={O - 0.5} x1={L + 0.5} z0={N - 0.5} z1={S + 0.5} r={r + 0.5} y0={H + 0.6} h={1} vidro={mVidro} corrimao={mRosa} />
      {/* varal de lâmpadas */}
      <mesh geometry={cilindro(0.12, 0.16, 6.4, 10)} material={mBranco} position={[SEDE.x, H + 0.6 + 3.2, SEDE.z - 2 * SZ]} castShadow />
      <mesh geometry={esfera(0.38, 14)} material={mRosa} position={[SEDE.x, H + 7.2, SEDE.z - 2 * SZ]} />
      {pontas.map(([dx, dz], i) => {
        const fim: V3 = [SEDE.x + dx * SX, H + 0.6 + 2.35, SEDE.z + dz * SZ];
        const ponto = (t: number): V3 => [topoMastro[0] + (fim[0] - topoMastro[0]) * t, topoMastro[1] + (fim[1] - topoMastro[1]) * t - 1.1 * 4 * t * (1 - t), topoMastro[2] + (fim[2] - topoMastro[2]) * t];
        return (
          <group key={`v${i}`}>
            <mesh geometry={cilindro(0.06, 0.08, 2.4, 6)} material={mBranco} position={[fim[0], H + 0.6 + 1.2, fim[2]]} />
            {[0, 1, 2, 3].map((k) => <Barra key={k} a={ponto(k / 4)} b={ponto((k + 1) / 4)} r={0.025} m={mNucleo} />)}
            {Array.from({ length: lv ? 4 : 8 }, (_, k) => { const t = (k + 0.6) / (lv ? 4 : 8), p = ponto(t); return <mesh key={`b${k}`} geometry={bola(0.12, 0)} material={(k + i) % 2 ? mLampA : mLampB} position={[p[0], p[1] - 0.14, p[2]]} />; })}
          </group>
        );
      })}
      {/* entrada: letreiro de lâmpadas, como marquise de teatro (a logo fica na frente dele) */}
      <mesh geometry={caixa(12, 2.6, 4.6)} material={mat("#2A1050", { rough: 0.5 })} position={[SEDE.x, LETREIRO + 1.3, S + 2.3]} castShadow />
      <mesh geometry={plano(11.6, 4.3)} material={mForro} position={[SEDE.x, LETREIRO - 0.01, S + 2.4]} rotation={[PI / 2, 0, 0]} />
      {[LETREIRO + 2.62, LETREIRO - 0.02].map((y) => <mesh key={`r${y}`} geometry={caixa(12.08, 0.12, 0.12)} material={mRosa} position={[SEDE.x, y, S + 4.62]} />)}
      {[LETREIRO + 2.32, LETREIRO + 0.28].map((y) => (
        <group key={`lf${y}`}>
          {Array.from({ length: lv ? 12 : 24 }, (_, k) => { const q = lv ? 12 : 24; return <mesh key={k} geometry={bola(0.085, 0)} material={k % 2 ? mLampA : mLampB} position={[SEDE.x - 5.75 + (11.5 * k) / (q - 1), y, S + 4.66]} />; })}
          {[-6.04, 6.04].map((dx) => Array.from({ length: lv ? 5 : 9 }, (_, k) => { const q = lv ? 5 : 9; return <mesh key={`${dx}:${k}`} geometry={bola(0.085, 0)} material={k % 2 ? mLampB : mLampA} position={[SEDE.x + dx, y, S + 0.4 + (4 * k) / (q - 1)]} />; }))}
        </group>
      ))}
    </group>
  );
}

// ================= NUVCAM: estúdio de vídeo ao vivo =================
function Estudio({ sede }: { sede: Sede }) {
  const H = alturaSede(sede), cor = sede.cor;
  const mPreto = mat("#08080B", { rough: 0.55 }), mLaje = mat("#141418", { rough: 0.5, metal: 0.3 });
  const mFriso = luz(`${sede.id}:friso`, cor, { dia: 0.35, noite: 2 });
  const mFume = mat("#1A1A20", { rough: 0.1, metal: 0.4, opacity: 0.45 });
  const mBranco = mat("#F3F4F6", { rough: 0.5 }), mVerm = mat("#DC2626", { rough: 0.5 }), mPe = mat("#3A3F47", { rough: 0.5, metal: 0.5 });
  const mAviso = luz(`${sede.id}:aviso`, "#FF2B2B", { dia: 0.3, noite: 3, modo: "aviso" });
  const mPrato = duplo("#E5E7EB");
  // degraus: 5 andares cheios, depois recuo de 2 m nos lados e 3 m na frente, duas vezes
  const D = degrausEstudio(sede.andares), F = sede.andares - D, tl = telaoDe(sede);
  const degraus = Array.from({ length: D + 1 }, (_, k) => ({ x0: O + 2 * k, x1: L - 2 * k, z0: N, z1: S - 3 * k, y0: k === 0 ? 0 : (F - 1 + k) * AND, y1: (F + k) * AND }));
  const laje = (d: (typeof degraus)[number], y: number, h: number, k: string) => {
    const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2, w = d.x1 - d.x0, p = d.z1 - d.z0;
    return (
      <group key={k}>
        <mesh geometry={caixa(w + 0.4, h, p + 0.4)} material={mLaje} position={[cx, y, cz]} castShadow />
        <mesh geometry={caixa(w + 0.44, 0.07, 0.05)} material={mFriso} position={[cx, y, d.z1 + 0.22]} />
        <mesh geometry={caixa(w + 0.44, 0.07, 0.05)} material={mFriso} position={[cx, y, d.z0 - 0.22]} />
        <mesh geometry={caixa(0.05, 0.07, p + 0.44)} material={mFriso} position={[d.x0 - 0.22, y, cz]} />
        <mesh geometry={caixa(0.05, 0.07, p + 0.44)} material={mFriso} position={[d.x1 + 0.22, y, cz]} />
      </group>
    );
  };
  // guarda-corpo dos terraços: vidro fumê e o corrimão vermelho aceso (frente e lados de cada degrau)
  const terraco = (d: (typeof degraus)[number], y: number, k: string) => {
    const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2, w = d.x1 - d.x0, p = d.z1 - d.z0;
    return (
      <group key={k}>
        <mesh geometry={caixa(w, 0.9, 0.04)} material={mFume} position={[cx, y + 0.45, d.z1 + 0.1]} />
        <mesh geometry={caixa(w + 0.1, 0.08, 0.08)} material={mFriso} position={[cx, y + 0.92, d.z1 + 0.1]} />
        {[d.x0 - 0.1, d.x1 + 0.1].map((x) => <group key={x}><mesh geometry={caixa(0.04, 0.9, p)} material={mFume} position={[x, y + 0.45, cz]} /><mesh geometry={caixa(0.08, 0.08, p)} material={mFriso} position={[x, y + 0.92, cz]} /></group>)}
      </group>
    );
  };
  const mastro: V3 = [L - 5.2, H + 0.6, N + 2];
  return (
    <group>
      <JardimSede sede={sede} parte="fora" />
      {/* núcleos dos três degraus */}
      {degraus.map((d, k) => <mesh key={`n${k}`} geometry={caixa(d.x1 - d.x0 - 0.1, d.y1 - d.y0, d.z1 - d.z0 - 0.1)} material={mPreto} position={[(d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, (d.z0 + d.z1) / 2]} castShadow receiveShadow />)}
      {/* lajes pretas com friso vermelho aceso */}
      {Array.from({ length: F - 1 }, (_, i) => i + 1).map((f) => laje(degraus[0], f * AND, 0.3, `l${f}`))}
      {degraus.slice(0, D).map((d, k) => laje(d, (F + k) * AND + (k ? 0.2 : 0.25), k ? 0.4 : 0.5, `t${k + 1}`))}
      {laje(degraus[D], H + 0.3, 0.6, "tt")}
      {degraus.slice(0, D).map((d, k) => terraco(d, (F + k) * AND + (k ? 0.4 : 0.5), `g${k + 1}`))}
      {/* pilares de canto com neon vermelho */}
      {[[O, S], [L, S], [O, N], [L, N]].map(([x, z], i) => <mesh key={`p${i}`} geometry={caixa(0.7, F * AND + 0.3, 0.7)} material={mPreto} position={[x, (F * AND + 0.3) / 2, z]} castShadow />)}
      {[O, L].map((x) => <mesh key={`ns${x}`} geometry={caixa(0.12, F * AND - 0.6, 0.05)} material={mFriso} position={[x, F * AND / 2, S + 0.37]} />)}
      {[S, N].map((z) => <mesh key={`no${z}`} geometry={caixa(0.05, F * AND - 0.6, 0.12)} material={mFriso} position={[O - 0.37, F * AND / 2, z]} />)}
      {[S, N].map((z) => <mesh key={`nl${z}`} geometry={caixa(0.05, F * AND - 0.6, 0.12)} material={mFriso} position={[L + 0.37, F * AND / 2, z]} />)}
      {/* moldura do telão de LED (a tela, o letreiro corrido e o selo ficam em TelaoEstudio) */}
      <mesh geometry={caixa(18.8 * tl.s, 8 * tl.s, 0.5)} material={mPreto} position={[SEDE.x, tl.y0 + 4 * tl.s, S + 0.3]} castShadow />
      {[7.96, 0.04].map((dy) => <mesh key={`mt${dy}`} geometry={caixa(18.9 * tl.s, 0.08, 0.06)} material={mFriso} position={[SEDE.x, tl.y0 + dy * tl.s, S + 0.57]} />)}
      {[-9.42, 9.42].map((dx) => <mesh key={`ml${dx}`} geometry={caixa(0.08, 8 * tl.s, 0.06)} material={mFriso} position={[SEDE.x + dx * tl.s, tl.y0 + 4 * tl.s, S + 0.57]} />)}
      {/* mastro de antena listrado com a luz de balizamento */}
      <mesh geometry={caixa(1.4, 0.6, 1.4)} material={mLaje} position={[mastro[0], mastro[1] + 0.3, mastro[2]]} />
      {[0, 1, 2, 3, 4, 5].map((k) => { const rb = 0.42 - k * 0.05; return <mesh key={`m${k}`} geometry={cilindro(rb - 0.05, rb, 2.2, 10)} material={k % 2 ? mVerm : mBranco} position={[mastro[0], mastro[1] + 0.6 + k * 2.2 + 1.1, mastro[2]]} castShadow />; })}
      {[9.6, 11.2].map((dy) => <group key={`d${dy}`}><mesh geometry={caixa(2.4, 0.08, 0.08)} material={mPe} position={[mastro[0], mastro[1] + dy, mastro[2]]} /><mesh geometry={caixa(0.08, 0.08, 2.4)} material={mPe} position={[mastro[0], mastro[1] + dy, mastro[2]]} /></group>)}
      <mesh geometry={esfera(0.24, 10)} material={mAviso} position={[mastro[0], mastro[1] + 14.1, mastro[2]]} />
      {/* parabólicas nos terraços e no topo */}
      <Parabolica pos={[O + 2.2, F * AND + 0.5, S - 1.6]} r={1.6} yaw={-PI / 4} tilt={0.8} prato={mPrato} pe={mPe} />
      <Parabolica pos={[L - 3.6, D > 1 ? (F + 1) * AND + 0.4 : H + 0.6, S - 4.6]} r={1.9} yaw={PI / 5} tilt={0.75} prato={mPrato} pe={mPe} />
      <Parabolica pos={[SEDE.x - 1.5, H + 0.6, N + 3.2]} r={2.4} yaw={0.15} tilt={0.7} prato={mPrato} pe={mPe} />
      {/* entrada de estúdio: cobertura preta com friso aceso, painel da logo e a luz "AO VIVO" em cima */}
      <mesh geometry={caixa(10, 0.45, 4.2)} material={mPreto} position={[SEDE.x, COBERTURA, S + 2.1]} castShadow />
      <mesh geometry={caixa(10.05, 0.08, 0.08)} material={mFriso} position={[SEDE.x, COBERTURA - 0.24, S + 4.2]} />
      {[-4.6, 4.6].map((dx) => <mesh key={`c${dx}`} geometry={caixa(0.3, COBERTURA, 0.3)} material={mPreto} position={[SEDE.x + dx, COBERTURA / 2, S + 3.8]} castShadow />)}
      <mesh geometry={caixa(5.8, 1.6, 0.12)} material={mPreto} position={[SEDE.x, COBERTURA + 1.025, S + 4]} />
      <mesh geometry={caixa(2.6, 0.62, 0.3)} material={mVerm} position={[SEDE.x, COBERTURA + 2.185, S + 4]} />
    </group>
  );
}
function Parabolica({ pos, r, yaw, tilt, prato: mPrato, pe }: { pos: V3; r: number; yaw: number; tilt: number; prato: THREE.Material; pe: THREE.Material }) {
  // calota virada: o fundo do prato fica na origem e a boca para cima; depois inclina (tilt) e gira (yaw)
  return (
    <group position={pos}>
      <mesh geometry={cilindro(0.08, 0.12, 1.3, 8)} material={pe} position={[0, 0.65, 0]} />
      <group position={[0, 1.3, 0]} rotation={[tilt, yaw, 0, "YXZ"]}>
        <mesh geometry={prato(r)} material={mPrato} position={[0, r, 0]} rotation={[PI, 0, 0]} />
        <mesh geometry={cilindro(0.03, 0.03, r * 0.5, 5)} material={pe} position={[0, r * 0.25, 0]} />
        <mesh geometry={caixa(0.18, 0.24, 0.18)} material={pe} position={[0, r * 0.5, 0]} />
      </group>
    </group>
  );
}

// casca de cada estilo (a clássica fica em OneStateHQ.tsx)
export function CascaEstilo({ sede }: { sede: Sede }) {
  if (sede.estilo === "tech") return <Tech sede={sede} />;
  if (sede.estilo === "festa") return <Festa sede={sede} />;
  if (sede.estilo === "estudio") return <Estudio sede={sede} />;
  return null;
}

// ---------- telão de LED do NUVCAM (textura desenhada com a logo; letreiro corrido; selo AO VIVO que pisca) ----------
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
const TW = 1024, TH = 342; // tela de 18 x 6 m
const PONTO: [number, number] = [56, 51]; // o ponto branco do selo AO VIVO na tela (px)
function textura(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function pintarTela(img: HTMLImageElement, sede: Sede) {
  const c = document.createElement("canvas"); c.width = TW; c.height = TH;
  const g = c.getContext("2d")!;
  const fundo = g.createLinearGradient(0, 0, TW, TH); fundo.addColorStop(0, "#1C070A"); fundo.addColorStop(1, "#050507");
  g.fillStyle = fundo; g.fillRect(0, 0, TW, TH);
  const halo = g.createRadialGradient(TW * 0.5, TH * 0.56, 20, TW * 0.5, TH * 0.56, TW * 0.5); halo.addColorStop(0, comAlfa(sede.cor, 0.4)); halo.addColorStop(1, comAlfa(sede.cor, 0));
  g.fillStyle = halo; g.fillRect(0, 0, TW, TH);
  const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1, lw = TW * 0.66, lh = (lw * ih) / iw;
  g.drawImage(img, (TW - lw) / 2, TH * 0.56 - lh / 2, lw, lh);
  // selo AO VIVO
  g.fillStyle = sede.cor; rr(g, 28, 24, 200, 54, 27); g.fill();
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(PONTO[0], PONTO[1], 10, 0, PI * 2); g.fill();
  g.font = `800 30px "Arial Black", Inter, Arial, sans-serif`; g.textBaseline = "middle"; g.fillText("AO VIVO", 76, 52);
  g.fillStyle = "rgba(255,255,255,.72)"; g.font = `700 26px Inter, Arial, sans-serif`; g.textAlign = "right"; g.fillText(sede.dominio, TW - 30, TH - 32);
  // grade de LED
  g.fillStyle = "rgba(0,0,0,.3)"; for (let x = 0; x < TW; x += 4) g.fillRect(x, 0, 1, TH); for (let y = 0; y < TH; y += 4) g.fillRect(0, y, TW, 1);
  return textura(c);
}
function pintarCorrido(sede: Sede) {
  // 1 m de faixa = 100 px; a frase inteira cabe numa volta da textura (repete sem emenda)
  const fonte = `800 46px "Arial Black", Inter, Arial, sans-serif`, H = 100;
  const frase = ["AO VIVO", ...sede.areas.slice(0, 5).map((a) => a.nome.toUpperCase())].join("    •    ") + "    •    ";
  const c = document.createElement("canvas"), g = c.getContext("2d")!;
  g.font = fonte; c.width = Math.min(4000, Math.ceil(g.measureText(frase).width)); c.height = H;
  const fundo = g.createLinearGradient(0, 0, 0, H); fundo.addColorStop(0, "#C81E1E"); fundo.addColorStop(1, "#8F1414");
  g.fillStyle = fundo; g.fillRect(0, 0, c.width, H);
  g.font = fonte; g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.fillText(frase, 0, H / 2 + 2);
  g.fillStyle = "rgba(0,0,0,.25)"; for (let x = 0; x < c.width; x += 4) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 4) g.fillRect(0, y, c.width, 1);
  const t = textura(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 1800 / c.width;
  return t;
}
function pintarSelo(sede: Sede) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 56;
  const g = c.getContext("2d")!;
  g.fillStyle = sede.cor; g.fillRect(0, 0, 256, 56);
  g.fillStyle = "#FFFFFF"; g.font = `800 34px "Arial Black", Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("AO VIVO", 128, 30);
  return textura(c);
}
interface Telas { mTela: THREE.MeshBasicMaterial; mCorrido: THREE.MeshBasicMaterial; mSelo: THREE.MeshBasicMaterial; mPonto: THREE.MeshBasicMaterial; corrido: THREE.Texture }
const TELAS = new Map<string, Telas>();
function telasDe(sede: Sede, img: HTMLImageElement): Telas {
  let t = TELAS.get(sede.id);
  if (!t) {
    const corrido = pintarCorrido(sede);
    t = {
      mTela: new THREE.MeshBasicMaterial({ map: pintarTela(img, sede), toneMapped: false }),
      mCorrido: new THREE.MeshBasicMaterial({ map: corrido, toneMapped: false }),
      mSelo: new THREE.MeshBasicMaterial({ map: pintarSelo(sede), toneMapped: false }),
      mPonto: new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false }),
      corrido,
    };
    TELAS.set(sede.id, t);
  }
  return t;
}
const BRANCO = new THREE.Color("#FFFFFF"), APAGADO = new THREE.Color("#7F1D1D");
function animarTelao(t: Telas, s: number, dt: number) {
  const n = ceu.noite;
  t.corrido.offset.x = (t.corrido.offset.x + dt * 0.05) % 1; // o letreiro corre devagar
  // à noite o telão respira devagar (fica um pouco mais forte e mais fraco)
  const k = 0.95 - 0.14 * n * (0.5 + 0.5 * Math.sin(s * 0.9));
  t.mTela.color.setScalar(k); t.mCorrido.color.setScalar(k);
  t.mPonto.color.copy(Math.sin(s * 3) > -0.2 ? BRANCO : APAGADO); // o ponto do AO VIVO pisca
  t.mSelo.color.setScalar(n > 0.3 && Math.sin(s * 1.4) < -0.4 ? 0.45 : 1); // a luz da entrada pisca devagar à noite
}
export function TelaoEstudio({ sede }: { sede: Sede }) {
  const logo = useLoader(THREE.TextureLoader, sede.logo);
  const t = telasDe(sede, logo.image as unknown as HTMLImageElement), tl = telaoDe(sede);
  useFrame(({ clock }, dt) => animarTelao(t, clock.elapsedTime, dt));
  return (
    <group>
      <group position={[SEDE.x, tl.y0, S]} scale={[tl.s, tl.s, 1]}>
        <mesh geometry={plano(18, 6)} material={t.mTela} position={[0, 4.75, 0.56]} />
        <mesh geometry={plano(18, 1)} material={t.mCorrido} position={[0, 1.05, 0.56]} />
        <mesh geometry={circulo(0.18, 16)} material={t.mPonto} position={[-9 + (18 * PONTO[0]) / TW, 4.75 + 3 - (6 * PONTO[1]) / TH, 0.57]} />
      </group>
      <mesh geometry={plano(2.4, 0.52)} material={t.mSelo} position={[SEDE.x, COBERTURA + 2.185, S + 4.16]} />
    </group>
  );
}
