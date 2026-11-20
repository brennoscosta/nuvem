"use client";
// Pontos disponíveis (18/11/2026, pedido do dono: "as casas velhas, melhore o visual, transforme em pontos que podem ser
// transformados" e "terrenos organizados"). Cada lote livre ganha:
//  - divisa clara: mureta baixa com portão na frente das casas e meio-fio nos lados e no fundo (entre dois lotes fica
//    uma faixa de grama à mostra); nos terrenos vazios, meio-fio em volta e uma entrada calçada na frente;
//  - casa bem acabada: caminho de pedrisco com pisantes do portão até a porta, canteiros floridos atrás da mureta,
//    caixa de correio, o número do lote numa plaquinha no pilar, luminárias nos pilares e luz na varanda à noite;
//  - terreno vazio demarcado: estacas baixas nos cantos de onde cabe o prédio e um marco com o número e uma luz baixa;
//  - a placa "Ponto disponível · Lote N" com o ícone de prédios: grafite e discreta de dia, acesa à noite.
// O que não se mexe entra no <Estatico> dos lotes (Lotes.tsx). A placa e o número usam um atlas (uma textura para todos
// os lotes, um material só). O brilho da noite é material emissivo e pontos de luz somados, sem luz de verdade.
// Coordenadas "do lote": origem no centro do lote, frente (a rua) para +z, como em frenteDoLote (data/mundo.ts).
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, mat, plano } from "./geo";
import { leve } from "./qualidade";
import { ceu, texturaLuz } from "./CicloDia";
import { sorteio, type AreaGramado, type Flor, type Tufo } from "./Gramado";
import type { ItemInstancia } from "./Modelos";
import { LOTES, frenteDoLote, arvoreDoTerrenoFica, type LoteInfo, type ModeloCasa } from "../data/mundo";

// Altura real (m) e para onde o modelo olha (rotação que leva a frente do GLB para +z)
// 20/11/2026: as casas são desenhadas em código (scene/KitPredio.tsx › CasasDesenhadas); a casinha antiga e o sobrado
// moderno (fora do mapa hoje) usam o desenho da térrea e do colonial, com as mesmas medidas
export const CASA: Record<ModeloCasa, { altura: number; frente: number }> = {
  casaVelha: { altura: 5.0, frente: -Math.PI / 2 },
  casaTerrea: { altura: 5.0, frente: -Math.PI / 2 },
  casaSobrado: { altura: 7.8, frente: -Math.PI / 2 },
  casaColonial: { altura: 7.8, frente: -Math.PI / 2 },
  casaModerna: { altura: 4.6, frente: -Math.PI / 2 },
};
// Porta de cada modelo, em frações da altura (medido nos GLB em 18/11/2026, olhando da rua): x = deslocamento da porta
// para a direita de quem olha; frente = o ponto mais à frente (degrau, cerca ou jardim do próprio modelo);
// parede = a parede da porta; luz = altura da luz da varanda.
// (20/11/2026: medidas das casas desenhadas em código; o colonial ganhou os degraus da porta)
const PORTA: Record<ModeloCasa, { x: number; frente: number; parede: number; luz: number }> = {
  casaVelha: { x: 0.225, frente: 0.89, parede: 0.5, luz: 0.46 },
  casaTerrea: { x: 0.225, frente: 0.89, parede: 0.5, luz: 0.46 },
  casaSobrado: { x: 0, frente: 0.606, parede: 0.53, luz: 0.36 },
  casaColonial: { x: 0, frente: 0.606, parede: 0.53, luz: 0.36 },
  casaModerna: { x: 0, frente: 1.05, parede: 0.62, luz: 0.5 },
};
export const CASA_RECUO = 1.2; // a casa fica 1,2 m para o fundo do lote

export interface Quintal { l: LoteInfo; casa: { modelo: ModeloCasa; escala: number } | null; arvore: boolean }

// do lote para o mundo: o lote do sul (k 2 e 3) não gira; o do norte gira meia volta
const sinal = (k: number) => (k >= 2 ? 1 : -1);
export const noLote = (l: { centro: [number, number]; k: number }, lx: number, lz: number): [number, number] => [l.centro[0] + sinal(l.k) * lx, l.centro[1] + sinal(l.k) * lz];
// lado da esquina do quarteirão (x do lote): é para lá que vão a placa e a árvore da calçada
export const ladoFora = (k: number) => (k === 1 || k === 2 ? -1 : 1);

const MURETA_Z = 9.8, MURETA_H = 0.45, VAO = 0.85; // vão do portão: 1,7 m
const BORDA = 9.6; // meio-fio dos lados e do fundo (entre dois lotes sobra uma faixa de grama de uns 0,7 m)
const GRAMA = 9.5; // até onde vai a grama aparada
const ESTACAS = { x: 6, z0: -6.6, z1: 5.2 }; // onde cabe o prédio no terreno vazio
// a árvore do terreno vazio fica no canto do fundo, do lado da esquina (antes ficava no meio, onde vai o prédio)
export const ARVORE_TERRENO = (k: number): [number, number] => [ladoFora(k) * 7.4, -7.4];
export { arvoreDoTerrenoFica }; // data/mundo.ts (20/11/2026)
const CANTEIRO = { z0: 8.84, z1: 9.69 };

// medidas de cada lote (portão, porta, placa)
function medidas(q: Quintal) {
  const fora = ladoFora(q.l.k);
  if (q.casa) {
    const h = CASA[q.casa.modelo].altura * q.casa.escala, P = PORTA[q.casa.modelo];
    const portao = THREE.MathUtils.clamp(P.x * h, -5.5, 5.5);
    return { fora, portao, placaX: THREE.MathUtils.clamp(portao + fora * 3.4, -7.4, 7.4), frente: -CASA_RECUO + P.frente * h, parede: -CASA_RECUO + P.parede * h, luzY: P.luz * h };
  }
  return { fora, portao: 0, placaX: fora * 3.9, frente: 0, parede: 0, luzY: 0 };
}

// ---------- atlas: placa "Ponto disponível · Lote N" e plaquinha do número ----------
// 1024 de largura (512 no modo leve, mesmo desenho): placas de 340 × 170 em 3 colunas e plaquinhas de 128 × 128 embaixo.
// 19/11/2026: com os 12 lotes novos dos quarteirões das sedes (24 lotes), a altura passou a acompanhar a lista: 1024 até
// 12 lotes, 2048 depois disso (as placas continuam do mesmo tamanho e nitidez)
const A = 1024, PW = 340, PH = 170, NW = 128;
const NY = Math.max(704, Math.ceil(LOTES.length / 3) * PH); // onde começam as plaquinhas do número
const AH = 2 ** Math.ceil(Math.log2(NY + Math.ceil(LOTES.length / 8) * NW)); // altura do atlas (potência de 2)
const celPlaca = (i: number): [number, number, number, number] => [(i % 3) * PW, Math.floor(i / 3) * PH, PW, PH];
const celNumero = (i: number): [number, number, number, number] => [(i % 8) * NW, NY + Math.floor(i / 8) * NW, NW, NW];
// mesmo desenho do ícone "predios" de ui/Icone.tsx (grade de 24, traço de 1,8 e o tom)
const ICONE_PREDIOS = { tom: "M10 21V4.6l9 4V21z", traco: "M2.5 21h19M5 21V10l5-2.6M10 21V4.6l9 4V21M13.2 11h2.6M13.2 14.4h2.6M13.2 17.8h2.6M6.8 13.6h1.2M6.8 17h1.2" };
type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
function retangulo(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}
function desenharPlaca(g: Ctx, [x0, y0]: [number, number, number, number], numero: number) {
  const x = x0 + 4, y = y0 + 4, w = PW - 8, h = PH - 8;
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, "#243041"); gr.addColorStop(1, "#151C26");
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
  g.fillStyle = "#3B82F6"; g.fillRect(x, y, 10, h); // faixa azul (acende à noite)
  g.fillStyle = "rgba(59,130,246,0.22)"; g.beginPath(); g.arc(x + 58, y + 64, 34, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(x + 58 - 30, y + 64 - 30); g.scale(60 / 24, 60 / 24);
  g.fillStyle = "#93C5FD"; g.globalAlpha = 0.25; g.fill(new Path2D(ICONE_PREDIOS.tom)); g.globalAlpha = 1;
  g.strokeStyle = "#BFDBFE"; g.lineWidth = 1.8; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(new Path2D(ICONE_PREDIOS.traco));
  g.restore();
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#93C5FD"; g.font = "800 19px Inter, Arial, sans-serif"; g.letterSpacing = "2px"; g.fillText("PONTO DISPONÍVEL", x + 106, y + 50, w - 118); g.letterSpacing = "0px";
  g.fillStyle = "#FFFFFF"; g.font = "900 52px Inter, Arial, sans-serif"; g.fillText(`Lote ${numero}`, x + 104, y + 106, w - 118);
  g.fillStyle = "#B6C3D6"; g.font = "600 17px Inter, Arial, sans-serif"; g.fillText("pode virar a sua empresa", x + 106, y + 140, w - 118);
}
function desenharNumero(g: Ctx, [x0, y0]: [number, number, number, number], numero: number) {
  const x = x0 + 4, y = y0 + 4, s = NW - 8;
  g.fillStyle = "#1B2330"; retangulo(g, x, y, s, s, 14); g.fill();
  g.strokeStyle = "#3B82F6"; g.lineWidth = 4; retangulo(g, x + 7, y + 7, s - 14, s - 14, 9); g.stroke();
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillStyle = "#93C5FD"; g.font = "800 15px Inter, Arial, sans-serif"; g.letterSpacing = "2px"; g.fillText("LOTE", x + s / 2 + 1, y + 34); g.letterSpacing = "0px";
  g.fillStyle = "#FFFFFF"; g.font = "900 56px Inter, Arial, sans-serif"; g.fillText(String(numero), x + s / 2, y + 96, s - 20);
}
let texAtlas: THREE.CanvasTexture | null = null;
function atlasPontos() {
  if (texAtlas || typeof document === "undefined") return texAtlas;
  const S = leve() ? 512 : A, c = document.createElement("canvas"); c.width = S; c.height = (S * AH) / A;
  const g = c.getContext("2d")! as Ctx; g.scale(S / A, S / A);
  LOTES.forEach((l, i) => { desenharPlaca(g, celPlaca(i), l.numero); desenharNumero(g, celNumero(i), l.numero); });
  texAtlas = new THREE.CanvasTexture(c); texAtlas.colorSpace = THREE.SRGBColorSpace; texAtlas.anisotropy = leve() ? 2 : 8;
  return texAtlas;
}
const GEO_ATLAS = new Map<string, THREE.BufferGeometry>();
function planoAtlas(w: number, h: number, [x0, y0, cw, ch]: [number, number, number, number]) {
  const k = `${w},${h},${x0},${y0}`; let g = GEO_ATLAS.get(k); if (g) return g;
  g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv as THREE.BufferAttribute, m = 4; // margem: o mipmap não pega a vizinha
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + m + uv.getX(i) * (cw - 2 * m)) / A, 1 - (y0 + m + (1 - uv.getY(i)) * (ch - 2 * m)) / AH);
  GEO_ATLAS.set(k, g); return g;
}
const indiceDo = (l: LoteInfo) => Math.max(0, LOTES.indexOf(l));

// materiais que acendem à noite (emissão mínima de dia: o Estatico guarda o material em vez de virar cor de vértice).
// Ficam guardados aqui e LuzesQuintais muda a emissão a cada quadro.
type MatEmissivo = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const NOITE: { ponto?: MatEmissivo; lampada?: MatEmissivo; varanda?: THREE.PointsMaterial; lampiao?: THREE.PointsMaterial; poca?: THREE.MeshBasicMaterial } = {};
function materialPonto() {
  if (NOITE.ponto) return NOITE.ponto;
  const map = atlasPontos() ?? undefined;
  const comum = { map, emissiveMap: map, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.06 };
  return (NOITE.ponto = leve() ? new THREE.MeshLambertMaterial(comum) : new THREE.MeshStandardMaterial({ ...comum, roughness: 0.55 }));
}
function materialLampada() {
  if (NOITE.lampada) return NOITE.lampada;
  const comum = { color: new THREE.Color("#F3EBDD"), emissive: new THREE.Color("#FFC46A"), emissiveIntensity: 0.02 };
  return (NOITE.lampada = leve() ? new THREE.MeshLambertMaterial(comum) : new THREE.MeshStandardMaterial({ ...comum, roughness: 0.4 }));
}

// ---------- peças ----------
const FERRO = () => mat("#2B2F36", { metal: 0.35, rough: 0.5 });
function PlacaPonto({ x, z, l }: { x: number; z: number; l: LoteInfo }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.64, 0.64].map((px) => <mesh key={px} geometry={caixa(0.06, 1.6, 0.06)} material={FERRO()} position={[px, 0.8, -0.03]} castShadow />)}
      <mesh geometry={caixa(1.58, 0.82, 0.05)} material={mat("#1E2530", { rough: 0.6 })} position={[0, 1.2, 0]} castShadow />
      <mesh geometry={planoAtlas(1.5, 0.75, celPlaca(indiceDo(l)))} material={materialPonto()} position={[0, 1.2, 0.027]} />
    </group>
  );
}
function NumeroLote({ position, l }: { position: [number, number, number]; l: LoteInfo }) {
  return <mesh geometry={planoAtlas(0.26, 0.26, celNumero(indiceDo(l)))} material={materialPonto()} position={position} />;
}
function MeioFio({ x0, x1, z0, z1 }: { x0: number; x1: number; z0: number; z1: number }) {
  const w = Math.max(0.14, x1 - x0), d = Math.max(0.14, z1 - z0);
  return <mesh geometry={caixa(w, 0.1, d)} material={mat("#CDC8BE", { rough: 0.9 })} position={[(x0 + x1) / 2, 0.05, (z0 + z1) / 2]} receiveShadow />;
}
function Canteiro({ a, b, z0 = CANTEIRO.z0, z1 = CANTEIRO.z1, borda }: { a: number; b: number; z0?: number; z1?: number; borda: THREE.Material }) {
  return (
    <group>
      <mesh geometry={plano(b - a, z1 - z0)} material={mat("#5A4434", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[(a + b) / 2, 0.012, (z0 + z1) / 2]} receiveShadow />
      <mesh geometry={caixa(b - a + 0.08, 0.09, 0.08)} material={borda} position={[(a + b) / 2, 0.045, z0 - 0.04]} />
    </group>
  );
}
// mureta das casas: cores de reboco claras, uma por lote (repetem sem ficar lado a lado)
const MUROS = [{ p: "#EFE8DA", t: "#C9C0AE" }, { p: "#E9EEE6", t: "#BFC6BA" }, { p: "#F2E3D2", t: "#CDB79F" }, { p: "#E8E6EE", t: "#C2BFCB" }];

function QuintalCasa({ q, placa }: { q: Quintal; placa: boolean }) {
  const { fora, portao, placaX, frente } = medidas(q);
  const cor = MUROS[q.l.numero % MUROS.length], parede = mat(cor.p, { rough: 0.92 }), topo = mat(cor.t, { rough: 0.8 });
  const pil = VAO + 0.17; // centro dos pilares
  const segs = ([[-9.95, portao - pil - 0.17], [portao + pil + 0.17, 9.95]] as [number, number][]).filter(([a, b]) => b - a > 0.2);
  const canteiros = ([[-BORDA + 0.08, portao - pil - 0.3], [portao + pil + 0.3, BORDA - 0.08]] as [number, number][]).filter(([a, b]) => b - a > 1.1);
  const pisos: number[] = []; for (let z = MURETA_Z - 0.62; z > frente + 0.32; z -= 0.6) pisos.push(z);
  const caminho = MURETA_Z - frente;
  return (
    <group position={[q.l.centro[0], 0, q.l.centro[1]]} rotation={[0, frenteDoLote(q.l.k), 0]}>
      {/* mureta com capa */}
      {segs.map(([a, b]) => (
        <group key={a}>
          <mesh geometry={caixa(b - a, MURETA_H, 0.2)} material={parede} position={[(a + b) / 2, MURETA_H / 2, MURETA_Z]} castShadow receiveShadow />
          <mesh geometry={caixa(b - a, 0.06, 0.28)} material={topo} position={[(a + b) / 2, MURETA_H + 0.03, MURETA_Z]} />
        </group>
      ))}
      {/* pilares do portão com luminária (acende à noite) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[portao + s * pil, 0, MURETA_Z]}>
          <mesh geometry={caixa(0.34, 0.8, 0.34)} material={parede} position={[0, 0.4, 0]} castShadow />
          <mesh geometry={caixa(0.42, 0.06, 0.42)} material={topo} position={[0, 0.83, 0]} />
          <mesh geometry={caixa(0.15, 0.16, 0.15)} material={materialLampada()} position={[0, 0.94, 0]} />
          <mesh geometry={caixa(0.2, 0.035, 0.2)} material={FERRO()} position={[0, 1.035, 0]} />
        </group>
      ))}
      {/* caixa de correio no pilar do lado de fora; o número do lote no outro pilar */}
      <mesh geometry={caixa(0.27, 0.21, 0.07)} material={mat("#30475E", { rough: 0.5, metal: 0.3 })} position={[portao + fora * pil, 0.56, MURETA_Z + 0.205]} />
      <mesh geometry={caixa(0.17, 0.02, 0.012)} material={mat("#10151B")} position={[portao + fora * pil, 0.6, MURETA_Z + 0.242]} />
      <NumeroLote l={q.l} position={[portao - fora * pil, 0.55, MURETA_Z + 0.172]} />
      {/* soleira do portão, caminho de pedrisco e pisantes até a porta */}
      <mesh geometry={caixa(2 * VAO, 0.04, 0.5)} material={mat("#CFC8BA", { rough: 0.9 })} position={[portao, 0.02, MURETA_Z]} receiveShadow />
      <mesh geometry={plano(1.3, caminho)} material={mat("#D9D0BF", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[portao, 0.006, frente + caminho / 2]} receiveShadow />
      {pisos.map((z) => <mesh key={z} geometry={caixa(1.0, 0.05, 0.42)} material={mat("#B7B0A4", { rough: 0.85 })} position={[portao, 0.025, z]} receiveShadow />)}
      {/* canteiros atrás da mureta (as flores e as azaleias são instanciadas) */}
      {canteiros.map(([a, b]) => <Canteiro key={a} a={a} b={b} borda={topo} />)}
      {/* divisa: meio-fio nos lados e no fundo */}
      <MeioFio x0={-BORDA - 0.07} x1={-BORDA + 0.07} z0={-BORDA} z1={MURETA_Z - 0.1} />
      <MeioFio x0={BORDA - 0.07} x1={BORDA + 0.07} z0={-BORDA} z1={MURETA_Z - 0.1} />
      <MeioFio x0={-BORDA - 0.07} x1={BORDA + 0.07} z0={-BORDA - 0.07} z1={-BORDA + 0.07} />
      {placa && <PlacaPonto x={placaX} z={9.22} l={q.l} />}
    </group>
  );
}

function QuintalTerreno({ q, placa }: { q: Quintal; placa: boolean }) {
  const { fora, placaX } = medidas(q);
  const borda = mat("#C9C0AE", { rough: 0.8 }), madeira = mat("#A9824F", { rough: 0.9 }), laranja = mat("#F97316", { rough: 0.6 });
  const marcoX = -fora * 2.15, E = ESTACAS;
  const cantos: [number, number][] = [[-E.x, E.z0], [E.x, E.z0], [E.x, E.z1], [-E.x, E.z1]];
  return (
    <group position={[q.l.centro[0], 0, q.l.centro[1]]} rotation={[0, frenteDoLote(q.l.k), 0]}>
      {/* meio-fio em volta, com a entrada aberta na frente */}
      <MeioFio x0={-BORDA - 0.07} x1={-1.75} z0={BORDA - 0.07} z1={BORDA + 0.07} />
      <MeioFio x0={1.75} x1={BORDA + 0.07} z0={BORDA - 0.07} z1={BORDA + 0.07} />
      <MeioFio x0={-BORDA - 0.07} x1={-BORDA + 0.07} z0={-BORDA} z1={BORDA} />
      <MeioFio x0={BORDA - 0.07} x1={BORDA + 0.07} z0={-BORDA} z1={BORDA} />
      <MeioFio x0={-BORDA - 0.07} x1={BORDA + 0.07} z0={-BORDA - 0.07} z1={-BORDA + 0.07} />
      {/* entrada calçada: base e seis placas de concreto */}
      <mesh geometry={caixa(3.4, 0.03, 1.75)} material={mat("#C4BDB0", { rough: 0.95 })} position={[0, 0.015, 9.1]} receiveShadow />
      {[-1.12, 0, 1.12].flatMap((x) => [8.7, 9.5].map((z) => <mesh key={`${x},${z}`} geometry={caixa(1.06, 0.045, 0.74)} material={mat("#DCD6CA", { rough: 0.9 })} position={[x, 0.022, z]} receiveShadow />))}
      {/* marco de concreto com o número e uma luz baixa; canteiro atrás */}
      <group position={[marcoX, 0, 9.35]}>
        <mesh geometry={caixa(0.3, 0.72, 0.3)} material={mat("#BDB8AE", { rough: 0.9 })} position={[0, 0.36, 0]} castShadow />
        <mesh geometry={caixa(0.36, 0.05, 0.36)} material={mat("#A39D92", { rough: 0.85 })} position={[0, 0.745, 0]} />
        <mesh geometry={caixa(0.14, 0.1, 0.14)} material={materialLampada()} position={[0, 0.82, 0]} />
        <mesh geometry={caixa(0.18, 0.03, 0.18)} material={FERRO()} position={[0, 0.885, 0]} />
        <NumeroLote l={q.l} position={[0, 0.45, 0.152]} />
      </group>
      <Canteiro a={Math.min(-fora * 2.55, -fora * 4.9)} b={Math.max(-fora * 2.55, -fora * 4.9)} z0={8.86} z1={9.52} borda={borda} />
      {/* onde cabe o prédio: só as estacas dos cantos, com a ponta laranja (a linha branca esticada lembrava campo de futebol) */}
      {cantos.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh geometry={caixa(0.05, 0.4, 0.05)} material={madeira} position={[0, 0.2, 0]} castShadow />
          <mesh geometry={caixa(0.07, 0.07, 0.07)} material={laranja} position={[0, 0.43, 0]} />
        </group>
      ))}
      {placa && <PlacaPonto x={placaX} z={9.05} l={q.l} />}
    </group>
  );
}

// Peças fixas de todos os quintais (vão dentro do <Estatico> dos lotes)
export function QuintaisEstaticos({ quintais, comPlaca }: { quintais: Quintal[]; comPlaca: Set<string> }) {
  return <group>{quintais.map((q) => (q.casa ? <QuintalCasa key={q.l.chave} q={q} placa={comPlaca.has(q.l.chave)} /> : <QuintalTerreno key={q.l.chave} q={q} placa={comPlaca.has(q.l.chave)} />))}</group>;
}

// ---------- o que é instanciado: grama aparada, tufos, flores, azaleias e as luzes da noite ----------
export interface Detalhes { areas: AreaGramado[]; tufos: Tufo[]; flores: Flor[]; azaleias: ItemInstancia[]; varandas: [number, number, number][]; lampioes: [number, number, number][]; pocas: [number, number, number][] }
const CORES_CANTEIRO = [["#FFFFFF", "#FF8FB8"], ["#FFD84A", "#B48CFF"], ["#FF6B5A", "#FFD84A"], ["#FF8FB8", "#C9A6FF"], ["#FFFFFF", "#FFB347"]];
const CORES_MATO = ["#FFFFFF", "#FFE066", "#F4D9FF"];
export function detalhesDosQuintais(quintais: Quintal[]): Detalhes {
  const poucos = leve();
  const d: Detalhes = { areas: [], tufos: [], flores: [], azaleias: [], varandas: [], lampioes: [], pocas: [] };
  for (const q of quintais) {
    const l = q.l, r = sorteio(l.numero * 7919 + 13), m = medidas(q);
    const P = (lx: number, lz: number) => noLote(l, lx, lz);
    const T = (lx: number, lz: number, s: number) => { const [x, z] = P(lx, lz); d.tufos.push({ x, z, s }); };
    const F = (lx: number, lz: number, s: number, cor: string) => { const [x, z] = P(lx, lz); d.flores.push({ x, z, s, cor }); };
    d.areas.push({ x0: l.centro[0] - GRAMA, x1: l.centro[0] + GRAMA, z0: l.centro[1] - GRAMA, z1: l.centro[1] + GRAMA });
    // árvores do quintal (as mesmas posições de Mundo.tsx): tufos em volta do tronco. Desde 20/11/2026 cada casa tem só a
    // árvore do fundo e metade dos terrenos vazios tem a sua (arvoreDoTerrenoFica)
    const arvores: [number, number][] = q.casa ? [[-7 * sinal(l.k), -7]] : q.arvore && arvoreDoTerrenoFica(l) ? [ARVORE_TERRENO(l.k)] : [];
    if (!poucos) {
      // capim junto do meio-fio (por dentro) e na faixa de grama entre os lotes
      for (let z = -9.2; z < 8.4; z += 0.5) for (const s of [-1, 1]) { if (r() < 0.4) T(s * (BORDA - 0.2 - r() * 0.08), z + (r() - 0.5) * 0.2, 0.5 + r() * 0.35); if (r() < 0.15) T(s * (BORDA + 0.16), z + (r() - 0.5) * 0.4, 0.45 + r() * 0.3); }
      for (let x = -9.2; x < 9.2; x += 0.5) { if (r() < 0.4) T(x + (r() - 0.5) * 0.2, -BORDA + 0.2 + r() * 0.08, 0.5 + r() * 0.35); if (r() < 0.15) T(x + (r() - 0.5) * 0.4, -BORDA - 0.16, 0.45 + r() * 0.3); }
      for (const [ax, az] of arvores) for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, rr = 0.45 + r() * 0.6; T(ax + Math.cos(a) * rr, az + Math.sin(a) * rr, 0.7 + r() * 0.5); }
    }
    if (q.casa) {
      const pil = VAO + 0.17, [ca, cb] = CORES_CANTEIRO[l.numero % CORES_CANTEIRO.length];
      const canteiros = ([[-BORDA + 0.08, m.portao - pil - 0.3], [m.portao + pil + 0.3, BORDA - 0.08]] as [number, number][]).filter(([a, b]) => b - a > 1.1);
      for (const [a, b] of canteiros) {
        const passo = poucos ? 0.5 : 0.34; let n = 0;
        for (let x = a + 0.22; x < b - 0.15; x += passo, n++) {
          F(x + (r() - 0.5) * 0.08, 9.42 + (r() - 0.5) * 0.08, 0.9 + r() * 0.3, n % 2 ? ca : cb);
          if (!poucos) { F(x + passo / 2 + (r() - 0.5) * 0.08, 9.08 + (r() - 0.5) * 0.08, 0.85 + r() * 0.3, n % 2 ? cb : ca); T(x + passo / 2, 9.4, 0.7); T(x, 9.06, 0.75); }
        }
      }
      // azaleias nas pontas dos canteiros, junto dos cantos da mureta
      for (const s of [-1, 1]) { const [x, z] = P(s * 8.95, 9.2); d.azaleias.push({ pos: [x, 0.02, z], rot: l.numero + s, altura: 1.1 }); }
      // luz da varanda (na porta), luminárias dos pilares e as manchas de luz no chão
      const [vx, vz] = P(m.portao, m.parede + 0.35); d.varandas.push([vx, m.luzY, vz]);
      for (const s of [-1, 1]) { const [x, z] = P(m.portao + s * pil, MURETA_Z); d.lampioes.push([x, 0.95, z]); }
      const [px, pz] = P(m.portao, m.frente + 0.9); d.pocas.push([px, pz, 1.7]);
      const [gx, gz] = P(m.portao, MURETA_Z); d.pocas.push([gx, gz, 1.5]);
    } else {
      // terreno vazio: canteiro ao lado do marco, flores do mato e moitas de capim fora da área do prédio
      const a = Math.min(-m.fora * 2.55, -m.fora * 4.9), b = Math.max(-m.fora * 2.55, -m.fora * 4.9), [ca, cb] = CORES_CANTEIRO[(l.numero + 2) % CORES_CANTEIRO.length];
      let n = 0; for (let x = a + 0.22; x < b - 0.15; x += poucos ? 0.5 : 0.34, n++) { F(x, 9.2 + (r() - 0.5) * 0.15, 0.95, n % 2 ? ca : cb); if (!poucos) T(x + 0.17, 9.3, 0.7); }
      // flores do mato só junto do meio-fio (nada solto no meio do terreno)
      if (!poucos) for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1, z = -8.6 + r() * 16.4; F(s * (BORDA - 0.35), z, 0.7 + r() * 0.25, CORES_MATO[i % CORES_MATO.length]); T(s * (BORDA - 0.3), z + 0.25, 0.5); }
      const [lx, lz] = P(-m.fora * 2.15, 9.35); d.lampioes.push([lx, 0.83, lz]);
      const [ex, ez] = P(0, 9.3); d.pocas.push([ex, ez, 1.6]);
    }
  }
  return d;
}

// ---------- noite: pontos de luz somados e manchas no chão (só aparecem quando escurece) ----------
let texPoca: THREE.CanvasTexture | null = null;
function texturaPoca() {
  if (texPoca || typeof document === "undefined") return texPoca;
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,214,150,0.9)"); gr.addColorStop(0.5, "rgba(255,196,120,0.35)"); gr.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); texPoca = new THREE.CanvasTexture(c); texPoca.colorSpace = THREE.SRGBColorSpace; return texPoca;
}
function geoPontos(lista: [number, number, number][]) {
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(lista.flat(), 3)); return g;
}
function geoPocas(lista: [number, number, number][]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const [x, z, r] of lista) { const b = pos.length / 3; pos.push(x - r, 0.06, z + r, x + r, 0.06, z + r, x + r, 0.06, z - r, x - r, 0.06, z - r); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
const somado = { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;
function materiaisNoite() {
  if (!NOITE.varanda || !NOITE.lampiao || !NOITE.poca) {
    const luz = texturaLuz() ?? undefined;
    NOITE.varanda = new THREE.PointsMaterial({ ...somado, color: "#FFD9A0", size: 2.4, sizeAttenuation: true, map: luz });
    NOITE.lampiao = new THREE.PointsMaterial({ ...somado, color: "#FFE2B0", size: 1.0, sizeAttenuation: true, map: luz });
    NOITE.poca = new THREE.MeshBasicMaterial({ ...somado, color: "#FFFFFF", map: texturaPoca() ?? undefined });
  }
  return { varanda: NOITE.varanda, lampiao: NOITE.lampiao, poca: NOITE.poca };
}
export function LuzesQuintais({ varandas, lampioes, pocas }: { varandas: [number, number, number][]; lampioes: [number, number, number][]; pocas: [number, number, number][] }) {
  const g = useRef<THREE.Group>(null);
  const geos = useMemo(() => ({ varanda: geoPontos(varandas), lampiao: geoPontos(lampioes), poca: geoPocas(pocas) }), [varandas, lampioes, pocas]);
  const m = materiaisNoite();
  useFrame(() => {
    const n = ceu.noite, x = NOITE;
    // placa e plaquinhas: discretas de dia, acesas à noite; luminárias dos pilares e do marco
    if (x.ponto) x.ponto.emissiveIntensity = 0.06 + n * 0.85;
    if (x.lampada) x.lampada.emissiveIntensity = 0.02 + n * 2.6;
    if (x.varanda) x.varanda.opacity = n * 0.95;
    if (x.lampiao) x.lampiao.opacity = n;
    if (x.poca) x.poca.opacity = n * 0.6;
    if (g.current) g.current.visible = n > 0.04;
  });
  return (
    <group ref={g} visible={false}>
      {varandas.length > 0 && <points geometry={geos.varanda} material={m.varanda} frustumCulled={false} renderOrder={3} />}
      {lampioes.length > 0 && <points geometry={geos.lampiao} material={m.lampiao} frustumCulled={false} renderOrder={3} />}
      {pocas.length > 0 && <mesh geometry={geos.poca} material={m.poca} renderOrder={2} />}
    </group>
  );
}
