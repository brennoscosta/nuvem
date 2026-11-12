"use client";
// Andares a mais e cobertura (12/11/2026, lote visual). O térreo do modelo continua sendo a cara da loja; os andares a mais
// sobem como um bloco recuado (de meio para trás do prédio), com o mesmo revestimento da fachada e janelas que acendem à
// noite. Em cima vai a cobertura: laje, terraço com mesas, jardim, letreiro no teto ou painel solar.
// Coordenadas locais do prédio: frente para -z, centro do lote em (0, 0).
import * as THREE from "three";
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { materialFachada } from "./PredioMaterial";
import { leve } from "./qualidade";
import { LAYOUT, DIM_LAYOUT, andarAltura, type CoberturaId, type LayoutId, type MaterialFachada } from "../data/escritorio";

const FONTE = "/fonts/inter-700.woff";
// revestimento "original" do bloco: o que combina com cada modelo
// altura (fração do modelo) onde começa o telhado: o bloco começa um pouco abaixo dela, escondido pelo telhado
const TETO: Record<LayoutId, number> = { vidro: 0.92, moderno: 0.88, sobrado: 0.88, loja: 0.6, galpao: 0.62, container: 0.9 };
const ORIGINAL_TORRE: Record<LayoutId, { material: MaterialFachada | "container"; cor: string }> = {
  vidro: { material: "vidro", cor: "#FFFFFF" }, moderno: { material: "pintura", cor: "#F1EFEA" }, sobrado: { material: "pintura", cor: "#E9E4DA" },
  loja: { material: "pintura", cor: "#F0D9B5" }, galpao: { material: "tijolinho", cor: "#FFFFFF" }, container: { material: "container", cor: "#3B4A5A" },
};
const CORES_CONTEINER = ["#C2410C", "#0F766E", "#1E3A8A", "#B45309", "#374151"];

// Textura de um módulo de fachada (1 vão × 1 andar): parede clara e janela escura (o shader troca a parede pelo revestimento)
let TEX_MODULO: THREE.CanvasTexture | null = null;
function texturaModulo() {
  if (TEX_MODULO || typeof document === "undefined") return TEX_MODULO;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d")!;
  g.fillStyle = "#ECEBE8"; g.fillRect(0, 0, n, n);
  const x0 = n * 0.17, x1 = n * 0.83, y0 = n * 0.2, y1 = n * 0.8;
  // moldura e peitoril (ficam claros: viram revestimento)
  const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "#2E3E50"); gr.addColorStop(0.55, "#3F566E"); gr.addColorStop(1, "#26323F");
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = "rgba(255,255,255,.10)"; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0 + (x1 - x0) * 0.35, y0); g.lineTo(x0 + (x1 - x0) * 0.55, y0); g.lineTo(x0 + (x1 - x0) * 0.2, y1); g.fill();
  g.fillStyle = "#1A222C"; g.fillRect(n / 2 - 2, y0, 4, y1 - y0); g.fillRect(x0, (y0 + y1) / 2 - 2, x1 - x0, 4);
  g.fillStyle = "#D9D6D0"; g.fillRect(x0 - 6, y1, x1 - x0 + 12, 8);
  TEX_MODULO = new THREE.CanvasTexture(c); TEX_MODULO.colorSpace = THREE.SRGBColorSpace; TEX_MODULO.wrapS = TEX_MODULO.wrapT = THREE.RepeatWrapping; TEX_MODULO.anisotropy = 4;
  return TEX_MODULO;
}

// Plano vertical com UV em metros (1 = um vão de 2,4 m na horizontal, um andar na vertical, contado a partir de yBase)
function planoMetrico(larg: number, y0: number, y1: number, yBase: number, andar: number) {
  const g = new THREE.PlaneGeometry(larg, y1 - y0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (u * larg) / 2.4, (y0 + v * (y1 - y0) - yBase) / andar); }
  uv.needsUpdate = true;
  return g;
}

export interface Bloco { largura: number; prof: number; cz: number; y0: number; yBase: number; yTopo: number; extra: number; andar: number }
// medidas do bloco recuado (ou da plataforma da cobertura quando não há andar a mais)
export function medidasBloco(layout: LayoutId, extra: number, cobertura: CoberturaId, duplo: boolean): Bloco | null {
  if (extra <= 0 && cobertura === "nenhuma") return null;
  const D = DIM_LAYOUT[layout], L = LAYOUT[layout], sx = duplo ? 1.6 : 1, sy = duplo ? 1.2 : 1;
  const andar = andarAltura(layout);
  const yBase = 0.16 + L.altura * sy; // onde começam os andares a mais
  const yTopo = yBase + (extra > 0 ? extra * andar : 0.9);
  const y0 = 0.16 + L.altura * sy * (TETO[layout] - 0.05);
  return { largura: D.largura * sx * 0.74, prof: D.prof * 0.52, cz: D.prof * 0.2, y0, yBase, yTopo, extra, andar };
}

export function Torre({ layout, extra, cobertura, material, corFachada, duplo, nome, cor, logo }: { layout: LayoutId; extra: number; cobertura: CoberturaId; material: MaterialFachada; corFachada: string; duplo: boolean; nome: string; cor: string; logo: string | null }) {
  const b = useMemo(() => medidasBloco(layout, extra, cobertura, duplo), [layout, extra, cobertura, duplo]);
  const orig = ORIGINAL_TORRE[layout];
  const matEf = material === "original" ? orig.material : material;
  const corEf = material === "original" ? orig.cor : corFachada;
  const ehConteiner = layout === "container" && material === "original";
  // um material por bloco (o shader troca o revestimento e acende as janelas)
  const matParede = useMemo(() => {
    const tex = texturaModulo();
    const base = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    return materialFachada(base, { material: matEf, cor: corEf, modo: 2 });
  }, [matEf, corEf]);
  const geos = useMemo(() => {
    if (!b) return null;
    const { largura: w, prof: d, y0, yTopo, yBase, andar } = b;
    return { frente: planoMetrico(w, y0, yTopo, yBase, andar), lado: planoMetrico(d, y0, yTopo, yBase, andar) };
  }, [b]);
  if (!b || !geos) return null;
  const { largura: w, prof: d, cz, yTopo, yBase, andar } = b;
  const yMeio = (b.y0 + yTopo) / 2;
  const laje = mat(matEf === "vidro" ? "#2B3138" : "#DEDAD3", { rough: 0.8 });
  return (
    <group>
      {ehConteiner ? (
        // contêineres empilhados, um por andar, girando um pouco a cor e o recuo
        Array.from({ length: Math.max(1, extra) }, (_, i) => <Conteiner key={i} w={w} d={d} y={yBase + i * andar} h={andar - 0.08} cz={cz + (i % 2 ? 0.35 : -0.35)} cor={CORES_CONTEINER[i % CORES_CONTEINER.length]} />)
      ) : (
        <>
          <mesh geometry={geos.frente} material={matParede} position={[0, yMeio, cz - d / 2]} rotation={[0, Math.PI, 0]} castShadow />
          <mesh geometry={geos.frente} material={matParede} position={[0, yMeio, cz + d / 2]} castShadow />
          <mesh geometry={geos.lado} material={matParede} position={[-w / 2, yMeio, cz]} rotation={[0, -Math.PI / 2, 0]} castShadow />
          <mesh geometry={geos.lado} material={matParede} position={[w / 2, yMeio, cz]} rotation={[0, Math.PI / 2, 0]} castShadow />
          {/* lajes aparentes em cada andar e a laje do topo */}
          {Array.from({ length: b.extra }, (_, i) => <mesh key={i} geometry={caixa(w + 0.24, 0.16, d + 0.24)} material={laje} position={[0, yBase + i * andar + 0.02, cz]} castShadow />)}
        </>
      )}
      <mesh geometry={caixa(w + 0.3, 0.22, d + 0.3)} material={laje} position={[0, yTopo + 0.11, cz]} castShadow receiveShadow />
      <Cobertura tipo={cobertura} w={w} d={d} y={yTopo + 0.22} cz={cz} nome={nome} cor={cor} logo={logo} />
    </group>
  );
}

// textura de chapa ondulada (contêiner)
const TEX_CHAPA = new Map<string, THREE.CanvasTexture>();
function texturaChapa(cor: string) {
  let t = TEX_CHAPA.get(cor); if (t || typeof document === "undefined") return t ?? null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
  for (let x = 0; x < 256; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, cor); gr.addColorStop(0.5, "#ffffff22"); gr.addColorStop(1, cor); g.fillStyle = cor; g.fillRect(x, 0, 8, 64); g.fillStyle = gr; g.fillRect(x, 0, 8, 64); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); TEX_CHAPA.set(cor, t); return t;
}
function Conteiner({ w, d, y, h, cz, cor }: { w: number; d: number; y: number; h: number; cz: number; cor: string }) {
  const tex = useMemo(() => texturaChapa(cor), [cor]);
  return (
    <group position={[0, y + h / 2, cz]}>
      <mesh geometry={caixa(w, h, d)} castShadow receiveShadow><meshStandardMaterial map={tex} color="#ffffff" roughness={0.6} metalness={0.25} /></mesh>
      {/* frente de vidro com caixilho escuro */}
      <mesh geometry={plano(w * 0.62, h * 0.7)} material={mat("#24323F", { rough: 0.15, metal: 0.4, emissive: "#FFC27A", ei: 0 })} position={[0, -0.05, -d / 2 - 0.02]} rotation={[0, Math.PI, 0]} />
      {[-1, 1].map((s) => <mesh key={s} geometry={caixa(0.12, h + 0.04, 0.12)} material={mat("#2B2F36")} position={[s * (w / 2 - 0.06), 0, -d / 2]} />)}
    </group>
  );
}

// ---------- coberturas ----------
let CONE_GS: THREE.ConeGeometry | null = null;
const coneGuardaSol = () => (CONE_GS ??= new THREE.ConeGeometry(1.05, 0.42, 12));
export function Cobertura({ tipo, w, d, y, cz, nome, cor, logo }: { tipo: CoberturaId; w: number; d: number; y: number; cz: number; nome: string; cor: string; logo: string | null }) {
  const arb = useMemo(() => arbustos(w, d), [w, d]);
  if (tipo === "nenhuma") return <Platibanda w={w} d={d} y={y} cz={cz} />;
  if (tipo === "terraco") return (
    <group position={[0, y, cz]}>
      <mesh geometry={plano(w - 0.2, d - 0.2)} material={mat("#B98A5A", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow />
      {/* guarda-corpo de vidro */}
      {[[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2]].map(([x, z, l, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          <mesh geometry={plano(l, 1.0)} position={[0, 0.55, 0]}><meshStandardMaterial color="#BFE3F2" transparent opacity={0.35} roughness={0.1} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={caixa(l, 0.06, 0.08)} material={mat("#3A3F47", { metal: 0.5, rough: 0.4 })} position={[0, 1.06, 0]} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * Math.min(w / 4, 2.6), 0, -d * 0.12]}>
          <mesh geometry={cilindro(0.45, 0.45, 0.05, 16)} material={mat("#F4F1EA", { rough: 0.6 })} position={[0, 0.76, 0]} castShadow />
          <mesh geometry={cilindro(0.035, 0.035, 2.2, 6)} material={mat("#2B2F36")} position={[0, 1.1, 0]} />
          <mesh geometry={coneGuardaSol()} material={mat(cor, { rough: 0.7 })} position={[0, 2.3, 0]} castShadow />
          {[-0.75, 0.75].map((cx) => <mesh key={cx} geometry={cilindro(0.2, 0.2, 0.45, 10)} material={mat("#A0703C", { rough: 0.9 })} position={[cx, 0.23, 0]} />)}
        </group>
      ))}
      {[[-w / 2 + 0.5, d / 2 - 0.5], [w / 2 - 0.5, d / 2 - 0.5]].map(([x, z], i) => <Vaso key={i} x={x} z={z} />)}
    </group>
  );
  if (tipo === "jardim") return (
    <group position={[0, y, cz]}>
      <mesh geometry={plano(w - 0.2, d - 0.2)} material={mat("#6FAE57", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow />
      <Platibanda w={w} d={d} y={0} cz={0} />
      {arb.map(([x, z, r, c], i) => <mesh key={i} geometry={esfera(r, 10)} material={mat(c, { rough: 1 })} position={[x, r * 0.75, z]} castShadow />)}
      <mesh geometry={plano(0.9, d - 1.4)} material={mat("#D8CDBB", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} />
    </group>
  );
  if (tipo === "solar") return (
    <group position={[0, y, cz]}>
      <Platibanda w={w} d={d} y={0} cz={0} />
      {Array.from({ length: Math.max(1, Math.floor((d - 1) / 1.6)) }, (_, i) => (
        <group key={i} position={[0, 0.55, -d / 2 + 1.1 + i * 1.6]} rotation={[-0.45, 0, 0]}>
          <mesh geometry={caixa(w - 1.2, 0.06, 1.15)} material={mat("#1B2F5A", { rough: 0.25, metal: 0.6 })} castShadow />
          <mesh geometry={plano(w - 1.3, 1.05)} material={painelSolar()} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  );
  // letreiro no teto: letras grandes sobre uma treliça, acesas à noite
  return (
    <group position={[0, y, cz - d / 2 + 0.6]}>
      <Platibanda w={w} d={d} y={0} cz={d / 2 - 0.6} />
      {[-w / 2 + 0.6, 0, w / 2 - 0.6].map((x) => <mesh key={x} geometry={caixa(0.12, 2.4, 0.12)} material={mat("#3A3F47", { metal: 0.5, rough: 0.5 })} position={[x, 1.2, 0.3]} />)}
      <mesh geometry={caixa(w - 0.6, 0.1, 0.1)} material={mat("#3A3F47", { metal: 0.5, rough: 0.5 })} position={[0, 0.7, 0.3]} />
      <mesh geometry={caixa(w - 0.6, 0.1, 0.1)} material={mat("#3A3F47", { metal: 0.5, rough: 0.5 })} position={[0, 2.3, 0.3]} />
      <Text font={FONTE} fontSize={Math.min(1.7, (w - 1) / Math.max(4, nome.trim().slice(0, 20).length * 0.62))} anchorX="center" anchorY="middle" position={[logo ? 0.6 : 0, 1.5, 0.18]} rotation={[0, Math.PI, 0]} maxWidth={w - 0.8}>
        {(nome.trim() || "Sua empresa").slice(0, 20).toUpperCase()}
        <meshStandardMaterial color="#FFFFFF" emissive={cor} emissiveIntensity={leve() ? 0.9 : 1.4} roughness={0.4} />
      </Text>
    </group>
  );
}
function arbustos(w: number, d: number): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  const cores = ["#3E8E41", "#4E9B47", "#2F7A3A", "#5BA84E"];
  let k = 7;
  for (let x = -w / 2 + 0.9; x < w / 2 - 0.6; x += 1.5) for (const z of [-d / 2 + 0.8, d / 2 - 0.8]) { k = (k * 31 + 11) % 97; out.push([x, z, 0.45 + (k % 5) * 0.08, cores[k % 4]]); }
  out.push([-w / 4, 0, 0.9, "#2F7A3A"], [w / 4, 0.4, 0.75, "#3E8E41"]);
  return out;
}
function Vaso({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cilindro(0.32, 0.25, 0.55, 12)} material={mat("#C0663E", { rough: 0.85 })} position={[0, 0.28, 0]} />
      <mesh geometry={esfera(0.45, 10)} material={mat("#4E9B47", { rough: 1 })} position={[0, 0.85, 0]} />
    </group>
  );
}
function Platibanda({ w, d, y, cz }: { w: number; d: number; y: number; cz: number }) {
  const m = mat("#D3CEC5", { rough: 0.9 });
  return (
    <group position={[0, y, cz]}>
      <mesh geometry={caixa(w, 0.5, 0.18)} material={m} position={[0, 0.25, -d / 2]} />
      <mesh geometry={caixa(w, 0.5, 0.18)} material={m} position={[0, 0.25, d / 2]} />
      <mesh geometry={caixa(0.18, 0.5, d)} material={m} position={[-w / 2, 0.25, 0]} />
      <mesh geometry={caixa(0.18, 0.5, d)} material={m} position={[w / 2, 0.25, 0]} />
    </group>
  );
}
let MAT_SOLAR: THREE.MeshStandardMaterial | null = null;
function painelSolar() {
  if (MAT_SOLAR || typeof document === "undefined") return MAT_SOLAR ?? mat("#1B2F5A");
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d")!;
  g.fillStyle = "#1C3366"; g.fillRect(0, 0, 256, 128); g.strokeStyle = "#9FB4DA"; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y2 = 0; y2 <= 128; y2 += 32) { g.beginPath(); g.moveTo(0, y2); g.lineTo(256, y2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  MAT_SOLAR = new THREE.MeshStandardMaterial({ map: t, roughness: 0.22, metalness: 0.5 });
  return MAT_SOLAR;
}
