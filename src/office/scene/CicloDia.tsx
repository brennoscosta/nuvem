"use client";
// Dia e noite do mapa (12/11/2026, ideia escolhida pelo dono). A cidade segue o horário de Brasília: dia, entardecer
// (17h30–19h30), noite (estrelas, lua, postes acesos) e amanhecer (5h–6h30). O botão da barra troca entre automático,
// sempre dia e sempre noite; ?hora=21 fixa uma hora (prévias e testes).
// `ceu` é lido a cada quadro por quem acende à noite (postes, faróis dos carros, horizonte).
// Céu e clima (12/11/2026, "vida e clima"): cúpula com degradê (azul de dia, laranja e lilás no pôr do sol, azul-marinho
// à noite, cinza na chuva) e brilho do sol baixo no horizonte; o céu das fotos do horizonte troca de cor junto (só os
// pixels de céu, o resto da arte fica); neblina pela hora (manhã cedo) e pelo clima de verdade (src/office/clima.ts);
// halo nos postes e, com o chão molhado, o reflexo das luzes esticado no asfalto na direção de quem olha.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useHora } from "../cameraStore";
import { clima, iniciarClima, passoClima } from "../clima";
import { leve } from "./qualidade";
import type { ItemInstancia } from "./Modelos";

export const ceu = { noite: 0, crep: 0, nublado: 0 };
const HORA_FIXA = (() => { if (typeof window === "undefined") return null; const h = new URLSearchParams(window.location.search).get("hora"); return h != null && h !== "" && Number.isFinite(Number(h)) ? Number(h) : null; })();

function horaBrasilia() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 12), m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
}
// a hora muda devagar: lê o relógio uma vez por segundo, não a cada quadro
const relogioHora = { h: 12, ate: 0 };
function horaAgora(t: number) { if (t >= relogioHora.ate) { relogioHora.h = horaBrasilia(); relogioHora.ate = t + 1; } return relogioHora.h; }
// 0 = dia pleno, 1 = noite plena, com rampas no entardecer e no amanhecer
export function noiteDaHora(h: number) {
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 17.5) return (h - 17.5) / 2;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}

// paletas: dia, crepúsculo (pico no meio da rampa) e noite
const C = {
  hemiCeu: [new THREE.Color("#FFFFFF"), new THREE.Color("#FFD7B0"), new THREE.Color("#6F82BE")],
  hemiChao: [new THREE.Color("#CDD3DB"), new THREE.Color("#B48C7A"), new THREE.Color("#1A2030")],
  sol: [new THREE.Color("#FFF6E8"), new THREE.Color("#FF9F5A"), new THREE.Color("#A9BCFF")],
  horizonte: [new THREE.Color("#FFFFFF"), new THREE.Color("#F4B48C"), new THREE.Color("#28324A")],
  ceuBaixo: [new THREE.Color("#CFE3F5"), new THREE.Color("#FFB16C"), new THREE.Color("#18284A")],
  ceuAlto: [new THREE.Color("#5E9BD8"), new THREE.Color("#3D4B8E"), new THREE.Color("#050B18")],
  nuvem: [new THREE.Color("#FFFFFF"), new THREE.Color("#FFA486"), new THREE.Color("#2A3552")],
};
// céu fechado (chuva ou muitas nuvens): dia e noite
const FECHADO = { baixo: [new THREE.Color("#A9B2BC"), new THREE.Color("#141A22")], alto: [new THREE.Color("#88929E"), new THREE.Color("#0A0D12")], nuvem: [new THREE.Color("#C2C8CF"), new THREE.Color("#1E242C")], horizonte: [new THREE.Color("#B9C0C8"), new THREE.Color("#1D2430")] };
const NEVOA = [new THREE.Color("#D5DBE0"), new THREE.Color("#2B3445")];
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
function mistura(lista: THREE.Color[], n: number, crep: number, alvo: THREE.Color, forcaCrep = 0.75) {
  alvo.copy(lista[0]).lerp(lista[2], n); // dia → noite
  return alvo.lerp(lista[1], crep * forcaCrep); // puxa para o laranja no meio do caminho
}
const doisTons = (par: THREE.Color[], n: number, alvo: THREE.Color) => alvo.copy(par[0]).lerp(par[1], n);

// uniformes do céu: a cúpula e os painéis do horizonte leem os mesmos valores
const SOL_DIR = new THREE.Vector3(12, 2.4, 10).normalize(); // brilho do sol baixo, do lado de onde vem a luz da cena
const U = {
  uCeuBaixo: { value: new THREE.Color("#CFE3F5") }, uCeuAlto: { value: new THREE.Color("#5E9BD8") }, uNuvemCor: { value: new THREE.Color("#FFFFFF") },
  uTroca: { value: 0 }, uSolDir: { value: SOL_DIR }, uSolCor: { value: new THREE.Color("#FF8A4C") }, uSolForca: { value: 0 },
  // os painéis não usam a neblina da cena (fog: false): ela entra aqui, para o horizonte sumir junto
  uNevoa: { value: 0 }, uNevoaCor: { value: new THREE.Color("#D5DBE0") },
};

// painéis do horizonte (fotos de dia): escurecem à noite e o céu da foto troca de cor com a hora e o clima
const horizonte = new Set<THREE.MeshBasicMaterial>();
export function registrarHorizonte(m: THREE.MeshBasicMaterial) {
  horizonte.add(m);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uCeuBaixo: U.uCeuBaixo, uCeuAlto: U.uCeuAlto, uNuvemCor: U.uNuvemCor, uTroca: U.uTroca, uNevoa: U.uNevoa, uNevoaCor: U.uNevoaCor });
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform vec3 uCeuBaixo; uniform vec3 uCeuAlto; uniform vec3 uNuvemCor; uniform float uTroca; uniform float uNevoa; uniform vec3 uNevoaCor;\nvoid main() {")
      .replace("#include <map_fragment>", `#include <map_fragment>
#ifdef USE_MAP
  {
    // só o céu da foto: azul bem mais forte que o vermelho e o verde, na parte de cima; nuvens = brancos lá em cima
    vec3 tx = sampledDiffuseColor.rgb;
    float alto = smoothstep(0.36, 0.6, vMapUv.y);
    float azul = clamp((tx.b - max(tx.r, tx.g)) * 2.4, 0.0, 1.0) * alto;
    float nuvem = smoothstep(0.62, 0.9, min(min(tx.r, tx.g), tx.b)) * alto;
    vec3 ceuFoto = mix(uCeuBaixo, uCeuAlto, smoothstep(0.42, 1.0, vMapUv.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, ceuFoto, azul * uTroca);
    diffuseColor.rgb = mix(diffuseColor.rgb, uNuvemCor * (0.8 + 0.2 * tx.r), nuvem * uTroca * 0.9);
  }
#endif
  diffuseColor.rgb = mix(diffuseColor.rgb, uNevoaCor, uNevoa);`);
  };
  m.needsUpdate = true;
}

interface Luzes { hemi: React.RefObject<THREE.HemisphereLight | null>; sol: React.RefObject<THREE.DirectionalLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }

function atualizar(scene: THREE.Scene, l: Luzes, dt: number, t: number) {
  const modo = useHora.getState().modo;
  const hora = HORA_FIXA != null ? HORA_FIXA : modo === "auto" ? horaAgora(t) : null; // "sempre dia/noite": sem hora (nada de neblina da manhã)
  const alvo = hora != null ? noiteDaHora(hora) : modo === "noite" ? 1 : 0;
  ceu.noite += (alvo - ceu.noite) * Math.min(1, dt * 1.5); // troca suave quando o modo muda
  passoClima(dt, hora);
  const n = ceu.noite; const crep = Math.max(0, 1 - Math.abs(2 * n - 1)); ceu.crep = crep;
  // céu fechado: chuva ou muitas nuvens deixam tudo mais cinza e apagam o sol
  const fechado = Math.min(1, Math.max(clima.chuva * 1.1, (clima.nuvens - 0.55) * 1.6, 0)); ceu.nublado = fechado;
  const neb = clima.neblina;
  // cores do céu
  mistura(C.ceuBaixo, n, crep, U.uCeuBaixo.value, 0.9).lerp(doisTons(FECHADO.baixo, n, tmp), fechado * 0.85);
  mistura(C.ceuAlto, n, crep, U.uCeuAlto.value, 0.8).lerp(doisTons(FECHADO.alto, n, tmp), fechado * 0.85);
  mistura(C.nuvem, n, crep, U.uNuvemCor.value, 0.9).lerp(doisTons(FECHADO.nuvem, n, tmp), fechado * 0.8);
  U.uTroca.value = Math.max(crep * 0.95, n, fechado * 0.85);
  U.uSolForca.value = crep * (1 - fechado) * 1.3;
  // fundo e neblina: o horizonte some na cor do céu baixo; na neblina, num branco acinzentado
  const corNevoa = tmp2.copy(U.uCeuBaixo.value).lerp(doisTons(NEVOA, n, tmp), Math.min(1, neb * 1.3));
  U.uNevoaCor.value.copy(corNevoa); U.uNevoa.value = Math.min(0.97, neb * 1.6);
  if (scene.background instanceof THREE.Color) scene.background.copy(U.uCeuBaixo.value);
  const fog = scene.fog as THREE.Fog | null;
  if (fog) {
    fog.color.copy(corNevoa);
    // neblina: o alcance cai depressa (0,55 da manhã ≈ 115 m; 0,9 ≈ 55 m) e começa bem perto da câmera
    const far = 360 * Math.pow(45 / 360, neb) * (1 - clima.chuva * 0.3);
    fog.far = far; fog.near = THREE.MathUtils.lerp(140 * (1 - clima.chuva * 0.25), far * 0.06, Math.min(1, neb * 2.2));
  }
  const h = l.hemi.current, s = l.sol.current, p = l.preench.current;
  if (h) { mistura(C.hemiCeu, n, crep, h.color); mistura(C.hemiChao, n, crep, h.groundColor); h.intensity = THREE.MathUtils.lerp(0.9, 0.42, n) * (1 - fechado * 0.12); }
  if (s) { mistura(C.sol, n, crep, s.color); s.intensity = THREE.MathUtils.lerp(2.2, 0.5, n) * (1 - crep * 0.25) * (1 - fechado * 0.55) * (1 - neb * 0.3); }
  if (p) p.intensity = THREE.MathUtils.lerp(0.5, 0.15, n) * (1 + fechado * 0.3);
  mistura(C.horizonte, n, crep, tmp).lerp(doisTons(FECHADO.horizonte, n, tmp2), fechado * 0.7);
  for (const m of horizonte) m.color.copy(tmp);
}

export function CicloDia({ luzes }: { luzes: Luzes }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => { iniciarClima(); }, []);
  useFrame(({ clock }, dt) => atualizar(scene, luzes, Math.min(dt, 0.1), clock.elapsedTime));
  return <><Cupula /><Estrelas /><Lua /></>;
}

// ---------- cúpula do céu ----------
// Esfera grande que acompanha a câmera, desenhada antes de tudo (sem profundidade): degradê do horizonte ao alto e o
// brilho do sol baixo no entardecer e no amanhecer. Acima dos painéis do horizonte é o que se vê do céu.
const MAT_CUPULA = new THREE.ShaderMaterial({
  uniforms: { uCeuBaixo: U.uCeuBaixo, uCeuAlto: U.uCeuAlto, uSolDir: U.uSolDir, uSolCor: U.uSolCor, uSolForca: U.uSolForca },
  vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform vec3 uCeuBaixo; uniform vec3 uCeuAlto; uniform vec3 uSolDir; uniform vec3 uSolCor; uniform float uSolForca; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = mix(uCeuBaixo, uCeuAlto, smoothstep(-0.02, 0.55, d.y));
  float s = max(0.0, dot(d, uSolDir));
  c += uSolCor * (pow(s, 48.0) * 1.6 + pow(s, 6.0) * 0.35) * uSolForca;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
});
function Cupula() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => { ref.current?.position.copy(camera.position); });
  return <mesh ref={ref} material={MAT_CUPULA} renderOrder={-10} frustumCulled={false}><sphereGeometry args={[300, 32, 16]} /></mesh>;
}

// ---------- céu da noite ----------
const MAT_ESTRELAS = new THREE.PointsMaterial({ color: "#FFFFFF", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
function Estrelas() {
  const geo = useMemo(() => {
    const n = 900, pos = new Float32Array(n * 3); let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85), R = 280; pos.set([Math.cos(th) * Math.sin(ph) * R, Math.cos(ph) * R + 20, Math.sin(th) * Math.sin(ph) * R], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  // nuvens e chuva escondem as estrelas
  useFrame(({ camera }) => { MAT_ESTRELAS.opacity = (Math.max(0, ceu.noite - 0.35) / 0.65) * 0.9 * (1 - ceu.nublado) * (1 - clima.neblina * 0.7); ref.current?.position.set(camera.position.x, 0, camera.position.z); });
  return <points ref={ref} geometry={geo} material={MAT_ESTRELAS} frustumCulled={false} renderOrder={-1} />;
}
const MAT_LUA = new THREE.MeshBasicMaterial({ color: "#F4F1E6", transparent: true, opacity: 0, fog: false, depthWrite: false });
function Lua() {
  useFrame(() => { MAT_LUA.opacity = (Math.max(0, ceu.noite - 0.4) / 0.6) * (1 - ceu.nublado * 0.85); });
  return <mesh position={[-160, 150, -200]} material={MAT_LUA}><circleGeometry args={[9, 32]} /></mesh>;
}

// ---------- luz dos postes à noite ----------
// Mancha de luz no chão (textura radial somada), a lâmpada acesa no alto de cada poste, o halo em volta da lâmpada
// (mais forte com neblina e chuva) e, com o chão molhado, o reflexo esticado no asfalto.
let TEX_LUZ: THREE.CanvasTexture | null = null;
export function texturaLuz() {
  if (TEX_LUZ || typeof document === "undefined") return TEX_LUZ;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,226,170,1)"); gr.addColorStop(0.45, "rgba(255,200,120,.45)"); gr.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); TEX_LUZ = new THREE.CanvasTexture(c); TEX_LUZ.colorSpace = THREE.SRGBColorSpace; return TEX_LUZ;
}
// halo: miolo pequeno e forte e uma auréola larga e fraca
let TEX_HALO: THREE.CanvasTexture | null = null;
export function texturaHalo() {
  if (TEX_HALO || typeof document === "undefined") return TEX_HALO;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,246,220,1)"); gr.addColorStop(0.08, "rgba(255,232,180,.9)"); gr.addColorStop(0.25, "rgba(255,210,140,.32)"); gr.addColorStop(0.6, "rgba(255,190,120,.08)"); gr.addColorStop(1, "rgba(255,190,120,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); TEX_HALO = new THREE.CanvasTexture(c); TEX_HALO.colorSpace = THREE.SRGBColorSpace; return TEX_HALO;
}
// reflexo no molhado: faixa comprida, forte perto do poste e sumindo na direção de quem olha, com tremido de água
let TEX_REFLEXO: THREE.CanvasTexture | null = null;
export function texturaReflexo() {
  if (TEX_REFLEXO || typeof document === "undefined") return TEX_REFLEXO;
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d")!;
  for (let y = 0; y < 256; y++) {
    const v = y / 255, forca = Math.pow(1 - v, 1.6) * (0.75 + 0.25 * Math.sin(y * 0.55) * Math.sin(y * 0.13));
    const gr = g.createLinearGradient(0, 0, 64, 0); const a = Math.max(0, forca);
    gr.addColorStop(0, "rgba(255,220,160,0)"); gr.addColorStop(0.5, `rgba(255,226,170,${a.toFixed(3)})`); gr.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = gr; g.fillRect(0, y, 64, 1);
  }
  TEX_REFLEXO = new THREE.CanvasTexture(c); TEX_REFLEXO.colorSpace = THREE.SRGBColorSpace; return TEX_REFLEXO;
}
const MAT_CHAO_LUZ = new THREE.MeshBasicMaterial({ color: "#FFE2AA", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const MAT_LAMPADA = new THREE.MeshStandardMaterial({ color: "#4A4E55", emissive: "#FFD58A", emissiveIntensity: 0, roughness: 0.5 });
const MAT_HALO = new THREE.PointsMaterial({ color: "#FFDDA8", size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
const MAT_REFLEXO = new THREE.MeshBasicMaterial({ color: "#FFE0A8", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
const COMP_REFLEXO = 11; // m
export function LuzesPostes({ itens }: { itens: ItemInstancia[] }) {
  const chao = useRef<THREE.InstancedMesh>(null), lamp = useRef<THREE.InstancedMesh>(null), reflexo = useRef<THREE.InstancedMesh>(null);
  const simples = leve();
  useEffect(() => {
    const t = texturaLuz(); if (t) { MAT_CHAO_LUZ.map = t; MAT_CHAO_LUZ.needsUpdate = true; }
    const th = texturaHalo(); if (th) { MAT_HALO.map = th; MAT_HALO.needsUpdate = true; }
    const tr = texturaReflexo(); if (tr) { MAT_REFLEXO.map = tr; MAT_REFLEXO.needsUpdate = true; }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), um = new THREE.Vector3(1, 1, 1);
    itens.forEach((it, i) => {
      chao.current?.setMatrixAt(i, m.compose(new THREE.Vector3(it.pos[0], 0.03, it.pos[2]), q, um));
      lamp.current?.setMatrixAt(i, new THREE.Matrix4().makeTranslation(it.pos[0], (it.altura ?? 5) - 0.15, it.pos[2]));
    });
    if (chao.current) { chao.current.instanceMatrix.needsUpdate = true; chao.current.computeBoundingSphere(); }
    if (lamp.current) { lamp.current.instanceMatrix.needsUpdate = true; lamp.current.computeBoundingSphere(); }
  }, [itens]);
  const geoHalo = useMemo(() => {
    const pos = new Float32Array(itens.length * 3);
    itens.forEach((it, i) => pos.set([it.pos[0], (it.altura ?? 5) - 0.12, it.pos[2]], i * 3));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, [itens]);
  // reflexos no chão molhado: cada faixa sai do pé do poste e aponta para a câmera (refeito a cada 3 quadros)
  const quadro = useRef(0);
  const aux = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), deita: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), y: new THREE.Vector3(0, 1, 0), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);
  useFrame(({ camera }) => {
    const n = ceu.noite;
    MAT_CHAO_LUZ.opacity = n * 0.55 * (1 + clima.molhado * 0.35);
    MAT_LAMPADA.emissiveIntensity = n * 3;
    MAT_HALO.opacity = n * (0.5 + clima.neblina * 0.4 + clima.chuva * 0.25);
    MAT_HALO.size = 3.2 * (1 + clima.neblina * 0.9 + clima.chuva * 0.35);
    const forca = n * clima.molhado * (simples ? 0.5 : 0.85);
    MAT_REFLEXO.opacity = forca;
    const r = reflexo.current; if (!r) return;
    r.visible = forca > 0.01;
    if (!r.visible || (quadro.current++ % 3) !== 0) return;
    itens.forEach((it, i) => {
      const dx = camera.position.x - it.pos[0], dz = camera.position.z - it.pos[2], d = Math.hypot(dx, dz) || 1;
      // plano deitado no chão (a ponta forte, +y local, vai para o pé do poste) e comprido na direção da câmera
      aux.q.setFromAxisAngle(aux.y, Math.atan2(dx, dz)).multiply(aux.deita);
      aux.p.set(it.pos[0] + (dx / d) * COMP_REFLEXO * 0.5, 0.035, it.pos[2] + (dz / d) * COMP_REFLEXO * 0.5);
      r.setMatrixAt(i, aux.m.compose(aux.p, aux.q, aux.s));
    });
    r.instanceMatrix.needsUpdate = true; r.computeBoundingSphere();
  });
  const geoChao = useMemo(() => new THREE.PlaneGeometry(9, 9), []), geoLamp = useMemo(() => new THREE.SphereGeometry(0.22, 10, 8), []);
  // a textura do reflexo vai do forte (v=1, no poste) ao fraco (v=0): o lado +y do plano fica no pé do poste
  const geoReflexo = useMemo(() => new THREE.PlaneGeometry(1.1, COMP_REFLEXO), []);
  return (
    <>
      <instancedMesh ref={chao} args={[geoChao, MAT_CHAO_LUZ, itens.length]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={lamp} args={[geoLamp, MAT_LAMPADA, itens.length]} frustumCulled={false} />
      <points geometry={geoHalo} material={MAT_HALO} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={reflexo} args={[geoReflexo, MAT_REFLEXO, itens.length]} frustumCulled={false} renderOrder={2} visible={false} />
    </>
  );
}
