"use client";
// Parque da Cidade (12/11/2026): do outro lado do rio, pelas três pontes. Lago com chafariz (água que sobe e cai, colorida
// à noite), pedalinhos de cisne, caminho em volta do lago, coreto, quiosque de água de coco, bancos, canteiros, ipês e postes
// clássicos. O chão (com o buraco do lago) sempre aparece; o resto só quando a câmera está perto.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, esfera, mat } from "./geo";
import { leve } from "./qualidade";
import { ceu } from "./CicloDia";
import { Estatico } from "./Estatico";
import { ComFallback, ModeloInstanciado, type ItemInstancia } from "./Modelos";
import { ArvoresInstanciadas, ArvoresMistas, MISTURA_PARQUE } from "./Arvores";
import { MAT_AGUA, MAT_BRILHO_LAGO, texturaBrilhoLago, animarAgua, PostesClassicos, X_OESTE, X_LESTE } from "./Rio";
import { HalosPostes } from "./Bairros";
import { NORTE } from "../data/mundo";

export const LAGO = { x: 0, z: -128, rx: 22, rz: 11 };
const Z_INI = NORTE.rio.z1, Z_FIM = NORTE.fim; // chão do parque: da margem norte do rio até o fim do mundo
const PEDRA = "#E3DCCB";

function elipse(rx: number, rz: number, seg = 72) { const s = new THREE.Shape(); s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0); return s.getPoints(seg); }
// anel elíptico (caminho em volta do lago, borda de pedra)
function anelEliptico(rx0: number, rz0: number, rx1: number, rz1: number) {
  const s = new THREE.Shape(elipse(rx1, rz1)); s.holes.push(new THREE.Path(elipse(rx0, rz0).reverse()));
  const g = new THREE.ShapeGeometry(s, 1); g.rotateX(-Math.PI / 2); return g;
}

// ---------- chão (sempre visível: sem ele, apareceria o fundo do céu atrás do rio) ----------
export function ParqueChao() {
  const geo = useMemo(() => {
    const w = X_LESTE - X_OESTE, cx = (X_LESTE + X_OESTE) / 2, cz = (Z_INI + Z_FIM) / 2, h = Z_INI - Z_FIM;
    const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
    // buraco do lago (em coordenadas do retângulo: x = x - cx, y = -(z - cz) por causa da rotação)
    const furo = new THREE.Path(elipse(LAGO.rx + 0.35, LAGO.rz + 0.35).map((p) => new THREE.Vector2(p.x + (LAGO.x - cx), p.y - (LAGO.z - cz))).reverse());
    s.holes.push(furo);
    const g = new THREE.ShapeGeometry(s, 1); g.rotateX(-Math.PI / 2); g.translate(cx, -0.05, cz); return g;
  }, []);
  return <Estatico><mesh geometry={geo} material={mat("#82C26C", { rough: 1 })} receiveShadow /></Estatico>;
}

// ---------- caminhos, canteiros, coreto, quiosque, portal (fixos) ----------
function caminho(x0: number, z0: number, x1: number, z1: number, larg: number) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  return { pos: [(x0 + x1) / 2, 0.01, (z0 + z1) / 2] as [number, number, number], rot: Math.atan2(dx, dz), len, larg };
}
const BEIRA = { rx: LAGO.rx + 4.6, rz: LAGO.rz + 4.6 }; // borda de fora do caminho do lago
function pontoNaBeira(ang: number, extra = 0) { return [LAGO.x + (BEIRA.rx + extra) * Math.cos(ang), LAGO.z + (BEIRA.rz + extra) * Math.sin(ang)] as const; }
const CORETO = { x: -47, z: -131 }, QUIOSQUE = { x: 46, z: -137 };
function caminhos() {
  const lista = [
    caminho(0, Z_INI - 0.5, 0, LAGO.z + BEIRA.rz - 1, 4.2), // da ponte grande até o lago
    caminho(-52, Z_INI - 0.5, ...pontoNaBeira(Math.PI * 0.78, -1.5), 3), // ponte oeste
    caminho(52, Z_INI - 0.5, ...pontoNaBeira(Math.PI * 0.22, -1.5), 3), // ponte leste
    caminho(LAGO.x - BEIRA.rx + 1, LAGO.z, CORETO.x + 4.5, CORETO.z, 3), // até o coreto
    caminho(LAGO.x + BEIRA.rx - 1, LAGO.z, QUIOSQUE.x - 3, QUIOSQUE.z, 3), // até o quiosque
  ];
  return lista;
}
let TEX_PORTAL: THREE.CanvasTexture | null = null;
function texturaPortal() {
  if (TEX_PORTAL || typeof document === "undefined") return TEX_PORTAL;
  const W = 1024, H = 160, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  g.fillStyle = "#1F6B45"; g.fillRect(0, 0, W, H); g.fillStyle = "#F2C230"; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8);
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 84px Inter, Arial, sans-serif"; g.fillText("PARQUE DA CIDADE", W / 2, H / 2 + 4, W - 60);
  TEX_PORTAL = new THREE.CanvasTexture(c); TEX_PORTAL.colorSpace = THREE.SRGBColorSpace; TEX_PORTAL.anisotropy = 8; return TEX_PORTAL;
}
let TEX_COCO: THREE.CanvasTexture | null = null;
function texturaCoco() {
  if (TEX_COCO || typeof document === "undefined") return TEX_COCO;
  const W = 512, H = 128, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
  g.fillStyle = "#2E7D32"; g.fillRect(0, 0, W, H); g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "900 56px Inter, Arial, sans-serif"; g.fillText("ÁGUA DE COCO", W / 2, H / 2 + 3, W - 30);
  TEX_COCO = new THREE.CanvasTexture(c); TEX_COCO.colorSpace = THREE.SRGBColorSpace; return TEX_COCO;
}
function Portal() {
  const tex = useMemo(() => texturaPortal(), []);
  const m = useMemo(() => (tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : null), [tex]);
  const pilar = mat("#EDE6D8", { rough: 0.9 }), z = Z_INI - 2.6;
  return (
    <group position={[0, 0, z]}>
      {[-3.6, 3.6].map((x) => <group key={x}><mesh geometry={caixa(0.8, 4.9, 0.8)} material={pilar} position={[x, 2.45, 0]} castShadow /><mesh geometry={caixa(1.3, 0.5, 1.3)} material={mat("#7A6A52")} position={[x, 0.25, 0]} /></group>)}
      <mesh geometry={caixa(8.4, 1.1, 0.5)} material={mat("#1F6B45")} position={[0, 5.2, 0]} castShadow />
      {m && <mesh geometry={GEO_PORTAL} material={m} position={[0, 5.2, 0.26]} />}
      {m && <mesh geometry={GEO_PORTAL} material={m} position={[0, 5.2, -0.26]} rotation={[0, Math.PI, 0]} />}
    </group>
  );
}
const GEO_PORTAL = new THREE.PlaneGeometry(8.2, 0.98);
function Coreto() {
  const branco = mat("#F7F4EC", { rough: 0.8 }), telhado = mat("#B5452F", { rough: 0.8 }), base = mat("#D8CFBF", { rough: 0.9 });
  const cols = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8);
  return (
    <group position={[CORETO.x, 0, CORETO.z]}>
      <mesh geometry={cilindro(4.3, 4.5, 0.9, 8)} material={base} position={[0, 0.45, 0]} castShadow receiveShadow />
      <mesh geometry={caixa(2.6, 0.45, 1.4)} material={base} position={[4.5, 0.22, 0]} />
      {cols.map((a) => <mesh key={a} geometry={cilindro(0.13, 0.15, 3.1, 8)} material={branco} position={[Math.cos(a) * 3.7, 2.45, Math.sin(a) * 3.7]} castShadow />)}
      {/* guarda-corpo entre as colunas (menos na entrada, virada para o lago) */}
      {cols.slice(0, 7).map((a, i) => { const b = cols[(i + 1) % 8], m = (a + b) / 2; return <mesh key={i} geometry={caixa(2.75, 0.08, 0.08)} material={branco} position={[Math.cos(m) * 3.55, 1.85, Math.sin(m) * 3.55]} rotation={[0, -m + Math.PI / 2, 0]} />; })}
      <mesh geometry={new THREE.ConeGeometry(5, 2.3, 8)} material={telhado} position={[0, 5.15, 0]} rotation={[0, Math.PI / 8, 0]} castShadow />
      <mesh geometry={esfera(0.28, 10)} material={mat("#F2C230", { metal: 0.6, rough: 0.3 })} position={[0, 6.45, 0]} />
    </group>
  );
}
function Quiosque() {
  const tex = useMemo(() => texturaCoco(), []);
  const m = useMemo(() => (tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : null), [tex]);
  const madeira = mat("#9A6B42", { rough: 0.9 }), palha = mat("#C9A75B", { rough: 1 });
  return (
    <group position={[QUIOSQUE.x, 0, QUIOSQUE.z]}>
      <mesh geometry={cilindro(1.9, 1.9, 1.1, 14)} material={madeira} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={cilindro(0.12, 0.12, 3.4, 8)} material={madeira} position={[0, 2.2, 0]} />
      <mesh geometry={new THREE.ConeGeometry(3.1, 1.7, 12)} material={palha} position={[0, 3.6, 0]} castShadow />
      {m && <mesh geometry={GEO_COCO} material={m} position={[-1.95, 0.75, 0]} rotation={[0, -Math.PI / 2, 0]} />}
      {/* dois guarda-sóis com mesinha */}
      {[[-5, 2.5, "#E2575B"], [-5, -2.8, "#F2C230"]].map(([x, z, c]) => (
        <group key={String(c)} position={[x as number, 0, z as number]}>
          <mesh geometry={cilindro(0.05, 0.05, 2.3, 6)} material={mat("#EDEDED")} position={[0, 1.15, 0]} />
          <mesh geometry={new THREE.ConeGeometry(1.5, 0.6, 10)} material={mat(c as string)} position={[0, 2.45, 0]} castShadow />
          <mesh geometry={cilindro(0.55, 0.55, 0.06, 12)} material={mat("#F4F4F2")} position={[0, 0.75, 0]} />
          <mesh geometry={cilindro(0.06, 0.06, 0.75, 6)} material={mat("#D0D0D0")} position={[0, 0.37, 0]} />
        </group>
      ))}
    </group>
  );
}
const GEO_COCO = new THREE.PlaneGeometry(2.4, 0.6);
// canteiros redondos em volta do lago; as plantas são desenhadas à parte (v63: azaleias floridas e arbustos de folha)
function posCanteiros() { return [0.62, 1.12, 1.95, 2.6, 3.6, 4.35, 5.1, 5.75].map((a) => { const [x, z] = pontoNaBeira(a * 1, 3.6); return { x, z }; }); }
function PlantasDosCanteiros() {
  const { flores, folhas } = useMemo(() => {
    const flores: ItemInstancia[] = [], folhas: ItemInstancia[] = [];
    posCanteiros().forEach((c, i) => [0, 1, 2, 3, 4, 5].forEach((k) => (k % 2 ? flores : folhas).push({ pos: [c.x + Math.cos(k + i) * 1.05, 0.36, c.z + Math.sin(k + i) * 1.05], rot: k * 1.3 + i, altura: k % 2 ? 0.95 : 0.85 })));
    return { flores, folhas };
  }, []);
  return <group><ArvoresInstanciadas especie="azaleia" itens={flores} /><ArvoresInstanciadas especie="arbusto" itens={folhas} /></group>;
}
function ParqueFixo() {
  const lista = useMemo(() => caminhos(), []);
  const anel = useMemo(() => anelEliptico(LAGO.rx + 1.4, LAGO.rz + 1.4, BEIRA.rx, BEIRA.rz), []);
  const borda = useMemo(() => anelEliptico(LAGO.rx, LAGO.rz, LAGO.rx + 0.7, LAGO.rz + 0.7), []);
  const pedra = mat(PEDRA, { rough: 0.95 });
  const canteiros = useMemo(() => posCanteiros(), []);
  return (
    <group>
      {lista.map((c, i) => <mesh key={i} geometry={new THREE.PlaneGeometry(c.larg, c.len)} material={pedra} rotation={[-Math.PI / 2, 0, c.rot]} position={c.pos} receiveShadow />)}
      <mesh geometry={anel} material={pedra} position={[LAGO.x, 0.015, LAGO.z]} receiveShadow />
      {/* borda de pedra do lago e a parede até a água */}
      <mesh geometry={borda} material={mat("#CFC6B4", { rough: 0.9 })} position={[LAGO.x, 0.06, LAGO.z]} />
      <mesh geometry={new THREE.CylinderGeometry(1, 1, 0.5, 72, 1, true)} material={mat("#B9AF9C", { rough: 0.95 })} position={[LAGO.x, -0.2, LAGO.z]} scale={[LAGO.rx + 0.05, 1, LAGO.rz + 0.05]} />
      {canteiros.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          <mesh geometry={cilindro(2.0, 2.1, 0.3, 20)} material={mat("#D8D3CA")} position={[0, 0.15, 0]} />
          <mesh geometry={cilindro(1.8, 1.8, 0.1, 20)} material={mat("#5C4634", { rough: 1 })} position={[0, 0.32, 0]} />
          {/* as plantas do canteiro (azaleias e arbustos) balançam com o vento: ficam fora do Estatico (PlantasDosCanteiros) */}
        </group>
      ))}
      <Portal />
      <Coreto />
      <Quiosque />
    </group>
  );
}

// ---------- água do lago e chafariz ----------
const MAT_JATO = new THREE.PointsMaterial({ color: "#E8F6FF", size: 0.42, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false });
const MAT_COLUNA_AGUA = new THREE.MeshBasicMaterial({ color: "#DFF3FF", transparent: true, opacity: 0.45, depthWrite: false });
const MAT_LUZ_CHAFARIZ = new THREE.MeshBasicMaterial({ color: "#5FE3FF", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const corJato = new THREE.Color();
// gota redonda e suave (sem textura, os pontos saem quadrados)
let TEX_GOTA: THREE.CanvasTexture | null = null;
function texturaGota() {
  if (TEX_GOTA || typeof document === "undefined") return TEX_GOTA;
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX_GOTA = new THREE.CanvasTexture(c); return TEX_GOTA;
}
// recalcula as gotas do chafariz (parábolas); fica fora do componente
interface Gota { tipo: number; ang: number; fase: number; v: number }
function moverGotas(geo: THREE.BufferGeometry, gotas: Gota[], t: number) {
    const a = geo.attributes.position as THREE.BufferAttribute, G = 9.8;
    for (let i = 0; i < gotas.length; i++) {
      const d = gotas[i]; let x = 0, y = 0, z = 0;
      if (d.tipo === 0) { // jato do meio, para cima
        const T = 1.05, s = ((t / T + d.fase) % 1) * T, abre = 0.35 * d.v;
        x = Math.cos(d.ang) * abre * s; z = Math.sin(d.ang) * abre * s; y = 3.15 + 5.4 * d.v * s - 0.5 * G * s * s;
      } else if (d.tipo === 1) { // da taça para fora, caindo na bacia
        const T = 0.75, s = ((t / T + d.fase) % 1) * T, r = 1.1 + 1.9 * s;
        x = Math.cos(d.ang) * r; z = Math.sin(d.ang) * r; y = 2.75 + 1.1 * s - 0.5 * G * s * s;
      } else { // da borda da bacia para dentro, em arco
        const T = 0.9, s = ((t / T + d.fase) % 1) * T, r = 3.0 - 2.3 * (s / T);
        x = Math.cos(d.ang) * r; z = Math.sin(d.ang) * r; y = 0.6 + 3.6 * s - 0.5 * G * s * s;
      }
      a.setXYZ(i, LAGO.x + x, Math.max(0.45, y), LAGO.z + z);
    }
    a.needsUpdate = true;
}
function Lago() {
  const N = leve() ? 140 : 340;
  const agua = useMemo(() => { const g = new THREE.CircleGeometry(1, 72); g.rotateX(-Math.PI / 2); return g; }, []);
  const brilho = useMemo(() => { const g = new THREE.CircleGeometry(1, 48); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.6); g.rotateX(-Math.PI / 2); return g; }, []);
  // cada gota: tipo de jato, ângulo e fase (fixos); a posição é recalculada a cada quadro (parábola)
  const gotas = useMemo(() => Array.from({ length: N }, (_, i) => ({ tipo: i % 3, ang: ((i * 137.5) % 360) * (Math.PI / 180), fase: (i * 0.618) % 1, v: 0.85 + ((i * 7) % 10) / 40 })), [N]);
  const geoJato = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return g; }, [N]);
  const pts = useRef<THREE.Points>(null);
  useEffect(() => {
    const t = texturaBrilhoLago(); if (t && !MAT_BRILHO_LAGO.map) { MAT_BRILHO_LAGO.map = t; MAT_BRILHO_LAGO.needsUpdate = true; }
    const g = texturaGota(); if (g && !MAT_JATO.map) { MAT_JATO.map = g; MAT_JATO.needsUpdate = true; }
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; animarAgua(t);
    if (pts.current) moverGotas(pts.current.geometry, gotas, t);
    // à noite o chafariz acende e troca de cor devagar
    corJato.setHSL((t * 0.04) % 1, 0.85, 0.62);
    MAT_JATO.color.setRGB(0.91, 0.96, 1).lerp(corJato, ceu.noite * 0.75);
    MAT_LUZ_CHAFARIZ.color.copy(corJato); MAT_LUZ_CHAFARIZ.opacity = ceu.noite * 0.55;
    MAT_COLUNA_AGUA.color.setRGB(0.87, 0.95, 1).lerp(corJato, ceu.noite * 0.75);
  });
  const pedra = mat("#E9E3D6", { rough: 0.85 });
  return (
    <group>
      <mesh geometry={agua} material={MAT_AGUA} position={[LAGO.x, -0.16, LAGO.z]} scale={[LAGO.rx, 1, LAGO.rz]} receiveShadow />
      <mesh geometry={brilho} material={MAT_BRILHO_LAGO} position={[LAGO.x, -0.14, LAGO.z]} scale={[LAGO.rx, 1, LAGO.rz]} renderOrder={2} />
      {/* chafariz: bacia, coluna, taça */}
      <group position={[LAGO.x, 0, LAGO.z]}>
        <mesh geometry={cilindro(3.3, 3.5, 0.75, 32)} material={pedra} position={[0, 0.2, 0]} castShadow />
        <mesh geometry={new THREE.CircleGeometry(3.0, 32)} material={MAT_AGUA} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={new THREE.CircleGeometry(3.4, 32)} material={MAT_LUZ_CHAFARIZ} position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} />
        <mesh geometry={cilindro(0.32, 0.45, 2.2, 16)} material={pedra} position={[0, 1.6, 0]} castShadow />
        <mesh geometry={cilindro(1.15, 0.45, 0.4, 24)} material={pedra} position={[0, 2.75, 0]} castShadow />
        <mesh geometry={cilindro(0.16, 0.22, 0.5, 10)} material={pedra} position={[0, 3.05, 0]} />
        {/* coluna d'água do jato do meio */}
        <mesh geometry={cilindro(0.08, 0.2, 1.5, 10)} material={MAT_COLUNA_AGUA} position={[0, 4.05, 0]} />
      </group>
      <points ref={pts} geometry={geoJato} material={MAT_JATO} frustumCulled={false} />
    </group>
  );
}

// ---------- pedalinhos de cisne ----------
function Cisne({ fase, cor }: { fase: number; cor: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const o = g.current; if (!o) return; const t = clock.elapsedTime * 0.05 + fase;
    const rx = LAGO.rx - 7, rz = LAGO.rz - 4;
    o.position.set(LAGO.x + Math.cos(t) * rx, -0.08 + Math.sin(clock.elapsedTime * 1.6 + fase) * 0.03, LAGO.z + Math.sin(t) * rz);
    o.rotation.y = Math.atan2(-Math.sin(t) * rx, Math.cos(t) * rz); // de frente para onde vai
  });
  const branco = mat("#FBFBF8", { rough: 0.6 });
  return (
    <group ref={g}>
      <mesh geometry={caixa(1.5, 0.35, 2.1)} material={mat(cor, { rough: 0.6 })} position={[0, 0.15, 0]} />
      <mesh geometry={esfera(1, 14)} material={branco} position={[0, 0.55, -0.15]} scale={[0.78, 0.5, 1.15]} castShadow />
      <mesh geometry={cilindro(0.13, 0.17, 1.3, 8)} material={branco} position={[0, 1.15, 0.85]} rotation={[0.35, 0, 0]} />
      <mesh geometry={esfera(0.26, 10)} material={branco} position={[0, 1.78, 1.12]} />
      <mesh geometry={new THREE.ConeGeometry(0.1, 0.32, 8)} material={mat("#F28C38")} position={[0, 1.74, 1.42]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

// ---------- árvores, ipês floridos, bancos e postes ----------
function itensParque() {
  const arvores: ItemInstancia[] = [], ipes: { x: number; z: number; cor: string }[] = [], bancos: ItemInstancia[] = [], postes: ItemInstancia[] = [];
  let n = 0; const poucos = leve();
  const longeDe = (x: number, z: number) => Math.hypot((x - LAGO.x) / (BEIRA.rx + 3), (z - LAGO.z) / (BEIRA.rz + 3)) > 1 && Math.hypot(x - CORETO.x, z - CORETO.z) > 7.5 && Math.hypot(x - QUIOSQUE.x, z - QUIOSQUE.z) > 8 && !NORTE.pontes.some((p) => Math.abs(x - p) < 6 && z > Z_INI - 12);
  const add = (x: number, z: number, h = 5.5) => { if (longeDe(x, z)) arvores.push({ pos: [x, 0, z], rot: (n++ * 1.9) % 6.28, altura: h + (n % 3) * 0.6 }); };
  for (let x = X_OESTE + 6; x <= X_LESTE - 4; x += poucos ? 16 : 10) { add(x, Z_INI - 3.2, 5); add(x + 4, Z_FIM + 3, 6.5); }
  for (let z = Z_INI - 10; z >= Z_FIM + 8; z -= poucos ? 16 : 10) { add(X_OESTE + 5, z, 6); add(X_LESTE - 3, z, 6); }
  for (const [cx, cz] of [[-38, -113], [36, -113], [-62, -142], [62, -146], [0, -149], [-22, -148], [24, -149], [-66, -118], [70, -122]]) for (const [dx, dz] of [[0, 0], [3.8, 1.5], [-2.5, 3.2]]) add(cx + dx, cz + dz, 6);
  // ipês floridos (amarelos e rosa) nas pontas do caminho do lago
  for (const [x, z, cor] of [[-30, -120, "#F2C230"], [30, -120, "#E86AA6"], [-30, -137, "#E86AA6"], [30, -137, "#F2C230"], [-14, -144.5, "#F2C230"], [14, -144.5, "#E86AA6"], [-56, -126, "#F2C230"], [58, -129, "#E86AA6"]] as const) ipes.push({ x, z, cor });
  // bancos virados para o lago, na beira de fora do caminho (menos onde chegam os caminhos)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2; if ([Math.PI * 0.5, Math.PI * 0.22, Math.PI * 0.78, 0, Math.PI].some((p) => Math.abs(Math.atan2(Math.sin(a - p), Math.cos(a - p))) < 0.22)) continue;
    const [x, z] = pontoNaBeira(a, 0.9); bancos.push({ pos: [x, 0, z], rot: Math.atan2(LAGO.x - x, LAGO.z - z), altura: 0.95 });
  }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; const [x, z] = pontoNaBeira(a, 0.5); postes.push({ pos: [x, 0, z], rot: 0, altura: 4.2 }); }
  for (const z of [Z_INI - 6, Z_INI - 9.5]) for (const x of [-2.6, 2.6]) postes.push({ pos: [x, 0, z], rot: 0, altura: 4.2 });
  postes.push({ pos: [CORETO.x + 5.6, 0, CORETO.z + 2.2], rot: 0, altura: 4.2 }, { pos: [QUIOSQUE.x - 4, 0, QUIOSQUE.z - 4], rot: 0, altura: 4.2 });
  return { arvores, ipes, bancos, postes };
}
// ipês floridos (v63): a mesma árvore em código das ruas, com tapete de flores caídas no chão
function Ipes({ lista }: { lista: { x: number; z: number; cor: string }[] }) {
  const grupos = useMemo(() => {
    const amarelos: ItemInstancia[] = [], rosas: ItemInstancia[] = [];
    lista.forEach((p, i) => (p.cor === "#F2C230" ? amarelos : rosas).push({ pos: [p.x, 0, p.z], rot: i * 1.7, altura: 6.4 + (i % 3) * 0.5 }));
    return { amarelos, rosas };
  }, [lista]);
  return (
    <group>
      <ArvoresInstanciadas especie="ipeAmarelo" itens={grupos.amarelos} />
      <ArvoresInstanciadas especie="ipeRosa" itens={grupos.rosas} />
    </group>
  );
}

export function Parque() {
  const { arvores, ipes, bancos, postes } = useMemo(() => itensParque(), []);
  const halos = useMemo(() => postes.map((p) => ({ ...p, altura: (p.altura ?? 4.2) + 0.3 })), [postes]);
  return (
    <group>
      <Estatico><ParqueFixo /></Estatico>
      <PlantasDosCanteiros />
      <Lago />
      <Cisne fase={0} cor="#F2C230" />
      <Cisne fase={Math.PI} cor="#5FB4E8" />
      <ArvoresMistas itens={arvores} mistura={MISTURA_PARQUE} />
      <ComFallback fallback={null}><ModeloInstanciado nome="banco" itens={bancos} /></ComFallback>
      <Ipes lista={ipes} />
      <PostesClassicos itens={postes} />
      <HalosPostes postes={halos} />
    </group>
  );
}
