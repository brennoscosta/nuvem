"use client";
// Obra e inauguração (12/11/2026, lote visual). Enquanto o lote está reservado, a cidade mostra uma obra: estrutura de
// concreto subindo, andaime com tela de proteção, guindaste com o braço girando devagar, cones e sacos de cimento.
// Quando o 1º mês é pago, o prédio sobe numa animação curta e fica 24 h com arco de balões, faixa "Inauguração" e fogos.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Cone } from "./PecasArea";
import { leve } from "./qualidade";

// lotes que esta sessão viu em obra: quando um deles vira prédio, ele sobe com animação (marcado num efeito, nunca no render)
export const LOTES_EM_OBRA_VISTOS = new Set<string>();
export const INAUGURAR_TESTE = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("inaugurar");

// treliça amarela (textura com transparência: parece estrutura de verdade de qualquer lado)
let TEX_TRELICA: THREE.CanvasTexture | null = null;
function trelica() {
  if (TEX_TRELICA || typeof document === "undefined") return TEX_TRELICA;
  const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d")!;
  g.strokeStyle = "#F2B705"; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
  g.lineWidth = 4; g.beginPath(); g.moveTo(3, 3); g.lineTo(61, 61); g.moveTo(61, 3); g.lineTo(3, 61); g.stroke();
  TEX_TRELICA = new THREE.CanvasTexture(c); TEX_TRELICA.colorSpace = THREE.SRGBColorSpace; TEX_TRELICA.wrapS = TEX_TRELICA.wrapT = THREE.RepeatWrapping;
  return TEX_TRELICA;
}
const matTrelica = new Map<string, THREE.MeshStandardMaterial>();
function materialTrelica(rx: number, ry: number) {
  const k = `${rx},${ry}`; let m = matTrelica.get(k);
  if (!m) { const t = trelica()?.clone() ?? null; if (t) { t.repeat.set(rx, ry); t.needsUpdate = true; } m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2, color: "#FFFFFF" }); matTrelica.set(k, m); }
  return m;
}

let GEO_MONTE: THREE.ConeGeometry | null = null;
const monte = () => (GEO_MONTE ??= new THREE.ConeGeometry(1.2, 0.9, 14));
// Obra no lote reservado. frente: sentido da rua em z (+1 ou -1); semente: varia o giro do guindaste por lote
export function Obra({ frente, semente }: { frente: 1 | -1; semente: number }) {
  const braco = useRef<THREE.Group>(null), gancho = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.07 + semente;
    if (braco.current) braco.current.rotation.y = Math.sin(t) * 1.3 + semente;
    if (gancho.current) gancho.current.position.x = 6.5 + Math.sin(t * 1.7) * 3;
  });
  const concreto = mat("#B9B6B0", { rough: 0.95 }), ferro = mat("#3A3226", { rough: 0.8 });
  const zf = frente * 5.5; // lado da rua
  const zg = -frente * 6.2; // guindaste nos fundos
  const altMastro = 17;
  const cols: [number, number][] = [];
  for (const x of [-5.5, 0, 5.5]) for (const z of [-4.5, 0, 4.5]) cols.push([x, z]);
  return (
    <group>
      {/* terra batida e areia */}
      <mesh geometry={plano(17.6, 17.6)} material={mat("#B79A73", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow />
      <Estatico key={`obra${frente}`}>
        {/* estrutura: laje do térreo, pilares, laje do 1º andar pela metade e ferros saindo */}
        <mesh geometry={caixa(12.4, 0.3, 10.4)} material={concreto} position={[0, 0.15, 0]} receiveShadow />
        {cols.map(([x, z], i) => <mesh key={`p${i}`} geometry={caixa(0.45, 3.2, 0.45)} material={concreto} position={[x, 1.75, z]} castShadow />)}
        <mesh geometry={caixa(12.4, 0.28, 6.4)} material={concreto} position={[0, 3.45, -frente * 2]} castShadow receiveShadow />
        {cols.filter(([, z]) => z * -frente >= 0).map(([x, z], i) => <mesh key={`q${i}`} geometry={caixa(0.45, 2.4, 0.45)} material={concreto} position={[x, 4.8, z]} castShadow />)}
        {cols.filter(([, z]) => z * -frente < 0).map(([x, z], i) => [-0.12, 0.12].map((d) => <mesh key={`f${i}${d}`} geometry={cilindro(0.025, 0.025, 1.2, 4)} material={ferro} position={[x + d, 3.95, z + d]} />))}
        {/* andaime na frente da obra */}
        {[-6.3, -3.1, 0, 3.1, 6.3].map((x) => <mesh key={`a${x}`} geometry={cilindro(0.04, 0.04, 6.4, 6)} material={mat("#8A9099", { metal: 0.6, rough: 0.4 })} position={[x, 3.2, zf + frente * 0.2]} />)}
        {[1.6, 3.3, 5.0].map((y) => <mesh key={`b${y}`} geometry={caixa(12.8, 0.05, 0.05)} material={mat("#8A9099", { metal: 0.6, rough: 0.4 })} position={[0, y, zf + frente * 0.2]} />)}
        {[1.62, 3.32].map((y) => <mesh key={`t${y}`} geometry={caixa(12.6, 0.06, 0.6)} material={mat("#A97C4F", { rough: 0.9 })} position={[0, y + 0.04, zf - frente * 0.15]} />)}
        {/* sacos de cimento e areia */}
        {[[0, 0], [0.62, 0], [0.31, 0.3]].map(([a, h], i) => <mesh key={`s${i}`} geometry={caixa(0.58, 0.22, 0.4)} material={mat("#D9CFB8", { rough: 0.95 })} position={[-4.2 + a, 0.12 + h * 0.7, zf + frente * 1.6]} castShadow />)}
        <mesh geometry={monte()} material={mat("#D8B97A", { rough: 1 })} position={[4.6, 0.45, zf + frente * 1.7]} castShadow />
        {/* base e mastro do guindaste */}
        <mesh geometry={caixa(2.6, 0.6, 2.6)} material={concreto} position={[5.6, 0.3, zg]} />
      </Estatico>
      {/* tela verde de proteção no andaime (semitransparente) */}
      {!leve() && <mesh geometry={plano(12.8, 5.2)} position={[0, 3.0, zf + frente * 0.32]} rotation={[0, frente > 0 ? 0 : Math.PI, 0]}><meshStandardMaterial color="#2F9E44" transparent opacity={0.28} side={THREE.DoubleSide} roughness={0.9} depthWrite={false} /></mesh>}
      <mesh geometry={caixa(1.0, altMastro, 1.0)} material={materialTrelica(1, altMastro)} position={[5.6, 0.6 + altMastro / 2, zg]} castShadow />
      <group ref={braco} position={[5.6, 0.6 + altMastro, zg]}>
        <mesh geometry={caixa(1.3, 1.1, 1.3)} material={mat("#F2B705", { rough: 0.5 })} position={[0, 0.5, 0]} />
        <mesh geometry={plano(0.9, 0.5)} material={mat("#1E2A36", { rough: 0.2, metal: 0.3 })} position={[0.66, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} />
        {/* lança e contralança */}
        <mesh geometry={caixa(15, 0.8, 0.8)} material={materialTrelica(19, 1)} position={[7.3, 1.45, 0]} castShadow />
        <mesh geometry={caixa(5, 0.7, 0.7)} material={materialTrelica(7, 1)} position={[-2.9, 1.45, 0]} />
        <mesh geometry={caixa(1.6, 1.2, 1.2)} material={concreto} position={[-4.6, 0.9, 0]} castShadow />
        <mesh geometry={cilindro(0.08, 0.3, 3.0, 6)} material={mat("#F2B705", { rough: 0.5 })} position={[0, 3.0, 0]} />
        <group ref={gancho} position={[6.5, 1.0, 0]}>
          <mesh geometry={cilindro(0.015, 0.015, 7, 4)} material={mat("#222")} position={[0, -3.5, 0]} />
          <mesh geometry={caixa(2.2, 0.35, 0.6)} material={mat("#7A5A3A", { rough: 0.9 })} position={[0, -7.2, 0]} castShadow />
        </group>
      </group>
      {/* cones na calçada do lote */}
      {[-6.4, -2.2, 2.2, 6.4].map((x) => <Cone key={x} x={x} z={frente * 8.3} />)}
    </group>
  );
}

// ---------- inauguração ----------
let TEX_FAIXA: THREE.CanvasTexture | null = null;
function faixaInauguracao() {
  if (TEX_FAIXA || typeof document === "undefined") return TEX_FAIXA;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 180; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, "#B91C1C"); gr.addColorStop(1, "#7F1D1D");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 180);
  g.fillStyle = "#F5C542"; g.fillRect(0, 10, 1024, 8); g.fillRect(0, 162, 1024, 8);
  g.fillStyle = "#FFF6D6"; g.font = "900 92px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("INAUGURAÇÃO", 512, 94);
  g.fillStyle = "#F5C542"; for (const x of [70, 954]) { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 18 : 42, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, 92 + Math.sin(a) * r); } g.fill(); }
  TEX_FAIXA = new THREE.CanvasTexture(c); TEX_FAIXA.colorSpace = THREE.SRGBColorSpace; TEX_FAIXA.anisotropy = 4;
  return TEX_FAIXA;
}
// Arco de balões na entrada + faixa em cima. zf: fachada (frente para -z); sx: largura do lote duplo
export function Inauguracao({ cor, zf, sx, topo }: { cor: string; zf: number; sx: number; topo: number }) {
  const tex = useMemo(() => faixaInauguracao(), []);
  const baloes = useMemo(() => {
    const out: { p: [number, number, number]; c: string; r: number }[] = [];
    const cores = [cor, "#FFFFFF", "#F5C542", "#E11D48"];
    const n = 30, larg = 2.6 * sx, alt = 3.6;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; out.push({ p: [-Math.cos(a) * larg, Math.sin(a) * alt, 0], c: cores[i % 4], r: 0.24 + ((i * 5) % 3) * 0.03 }); }
    return out;
  }, [cor, sx]);
  const pano = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (pano.current) pano.current.rotation.x = Math.sin(clock.elapsedTime * 1.6) * 0.04; });
  const largFaixa = 4.6 * sx;
  return (
    <group position={[0, 0, zf - 1.5]}>
      {baloes.map((b, i) => <mesh key={i} geometry={esfera(b.r, 12)} material={mat(b.c, { rough: 0.22 })} position={b.p} castShadow />)}
      <group ref={pano} position={[0, 4.35, 0]}>
        {tex && <mesh geometry={plano(largFaixa, largFaixa * 180 / 1024)} rotation={[0, Math.PI, 0]} position={[0, 0, -0.01]}><meshBasicMaterial map={tex} toneMapped={false} /></mesh>}
        {tex && <mesh geometry={plano(largFaixa, largFaixa * 180 / 1024)} position={[0, 0, 0.01]}><meshBasicMaterial map={tex} toneMapped={false} /></mesh>}
      </group>
      <Fogos cor={cor} topo={topo} />
    </group>
  );
}

// Fogos de artifício: rajadas de tempos em tempos sobre o prédio (pontos com brilho somado; mais bonitos à noite)
const N_POR_RAJADA = 70;
function Fogos({ cor, topo }: { cor: string; topo: number }) {
  const rajadas = leve() ? 1 : 3;
  const n = rajadas * N_POR_RAJADA;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [n]);
  // estado de cada partícula (fora do React: muda a cada quadro)
  const estado = useRef<{ vel: Float32Array; vida: Float32Array; base: Float32Array; proxima: number[] } | null>(null);
  const cores = useMemo(() => [new THREE.Color(cor), new THREE.Color("#F5C542"), new THREE.Color("#FFFFFF"), new THREE.Color("#FF4D6D")], [cor]);
  const pontos = useRef<THREE.Points>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const g = pontos.current?.geometry; if (!g) return;
    if (!estado.current) estado.current = { vel: new Float32Array(n * 3), vida: new Float32Array(n), base: new Float32Array(n * 3), proxima: Array.from({ length: rajadas }, (_, r) => t + 0.6 + r * 1.7) };
    const e = estado.current;
    const pos = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute;
    for (let r = 0; r < rajadas; r++) {
      if (t >= e.proxima[r]) {
        e.proxima[r] = t + 3.5 + Math.random() * 4;
        const cx = (Math.random() - 0.5) * 10, cy = topo + 6 + Math.random() * 6, cz = (Math.random() - 0.5) * 6 + 4;
        const c = cores[Math.floor(Math.random() * cores.length)];
        for (let k = 0; k < N_POR_RAJADA; k++) {
          const i = r * N_POR_RAJADA + k;
          const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = 5 + Math.random() * 2.5;
          pos.setXYZ(i, cx, cy, cz); e.vel[i * 3] = s * Math.cos(a) * v; e.vel[i * 3 + 1] = u * v; e.vel[i * 3 + 2] = s * Math.sin(a) * v;
          e.vida[i] = 1; e.base[i * 3] = c.r; e.base[i * 3 + 1] = c.g; e.base[i * 3 + 2] = c.b;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (e.vida[i] <= 0) { col.setXYZ(i, 0, 0, 0); continue; }
      e.vida[i] -= dt / 1.7; e.vel[i * 3 + 1] -= 4.2 * dt;
      e.vel[i * 3] *= 0.985; e.vel[i * 3 + 2] *= 0.985;
      pos.setXYZ(i, pos.getX(i) + e.vel[i * 3] * dt, pos.getY(i) + e.vel[i * 3 + 1] * dt, pos.getZ(i) + e.vel[i * 3 + 2] * dt);
      const l = Math.max(0, e.vida[i]) ** 1.5 * 1.6;
      col.setXYZ(i, e.base[i * 3] * l, e.base[i * 3 + 1] * l, e.base[i * 3 + 2] * l);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  });
  return (
    <points ref={pontos} geometry={geo} frustumCulled={false} position={[0, 0, 1.5]}>
      <pointsMaterial size={0.38} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} sizeAttenuation />
    </points>
  );
}

// subida do prédio (inauguração): escala em y de 0 a 1 em ~2 s, com um passo a mais no fim
export function easeSubida(t: number) { const c = 1.6; const x = Math.min(1, Math.max(0, t)); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
