"use client";
// Câmera do mapa (11/11/2026): girar de 90 em 90 graus, aproximar e afastar, ver de cima, ver da rua, voltar ao início,
// seguir o meu personagem, girar devagar em volta do ponto, teclado (WASD/setas, Q/E, +/−) e duplo clique para ir até
// um ponto. Tudo com animação suave em cima dos controles de mapa que já existiam.
// 12/11/2026: voo de drone pela cidade (?drone=1 liga; &semui=1 esconde a interface para gravar vídeo; qualquer toque
// ou tecla devolve o controle) e andar pela rua (câmera atrás do meu personagem; W A S D ou o joystick da tela andam,
// arrastar gira a vista; não entra nos quarteirões, só a praça é aberta).
// A lógica fica em funções fora do componente, sobre um contexto guardado num ref (os controles e a câmera são objetos
// do three.js que mudam a cada quadro).
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useCamera, joystick, type ComandoCamera } from "../cameraStore";
import { minhaPos, usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { LOTE_POR_CHAVE, PASSO, MEIO_Q, MUNDO, N } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { registrarPonte, tirarFotoPredio } from "./fotoPredio";

const MIN_RAIO = 6, MAX_RAIO = 119;
const POLAR_PADRAO = 0.95, POLAR_CIMA = 0.36, POLAR_RUA = 1.27;
export interface Controles {
  target: THREE.Vector3; maxPolarAngle: number; autoRotate: boolean; autoRotateSpeed: number;
  update(): void; addEventListener(tipo: string, f: () => void): void; removeEventListener(tipo: string, f: () => void): void;
}
// o resto dos controles do drei (MapControls), mexido só no modo andar
interface ControlesExtra { minDistance: number; maxDistance: number; minPolarAngle: number; enablePan: boolean; mouseButtons: Record<string, number | null>; touches: Record<string, number | null> }
type Anim = { t0: number; dur: number; de: THREE.Spherical; ate: THREE.Spherical; alvoDe?: THREE.Vector3; alvoAte?: THREE.Vector3 };
interface Rota { pos: THREE.CatmullRomCurve3; alvo: THREE.CatmullRomCurve3; comprimento: number; u: number }
interface Ctx {
  camera: THREE.Camera; c: Controles; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 }; anim: Anim | null; teclas: Set<string>; interagindo: boolean;
  rota: Rota | null; antesAndar: Partial<ControlesExtra> & { maxPolarAngle?: number } | null; andando: boolean; ultimoPasso: number; ultimaBatida: number;
}
const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const segundos = () => performance.now() / 1000;
const esferaDe = (x: Ctx) => new THREE.Spherical().setFromVector3(x.camera.position.clone().sub(x.c.target));
const extra = (c: Controles) => c as unknown as ControlesExtra;

function animar(x: Ctx, mudar: (s: THREE.Spherical) => void, dur = 0.7, alvoAte?: THREE.Vector3) {
  const de = esferaDe(x); const ate = de.clone(); mudar(ate);
  const andar = useCamera.getState().andar;
  ate.radius = THREE.MathUtils.clamp(ate.radius, andar ? 3 : MIN_RAIO, MAX_RAIO); ate.phi = THREE.MathUtils.clamp(ate.phi, 0.3, andar ? 1.45 : 1.4);
  x.anim = { t0: segundos(), dur, de, ate, alvoDe: alvoAte ? x.c.target.clone() : undefined, alvoAte };
}

// ---------- voo de drone ----------
// passa pela Nuvem, pelas lojas abertas, pela praça, pela lanchonete e pelas bordas, num laço fechado e suave
function montarRota(): Rota {
  const pontos: { x: number; z: number; raio: number; alt: number }[] = [];
  const ativos = Object.values(useMundo.getState().terrenos).filter((t) => t.status === "ativo" && !t.anexoDe).map((t) => LOTE_POR_CHAVE[t.chave]?.centro).filter(Boolean) as [number, number][];
  for (const [x, z] of ativos.slice(0, 10)) pontos.push({ x, z, raio: 30, alt: 15 });
  const praca = LOTE_POR_CHAVE[PRACA_CHAVE]?.centro; if (praca) pontos.push({ x: praca[0], z: praca[1], raio: 32, alt: 16 });
  pontos.push({ x: PASSO, z: 0, raio: 36, alt: 18 }); // lanchonete
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pontos.push({ x: sx * PASSO * 0.95, z: sz * PASSO * 0.95, raio: 46, alt: 32 }); // bordas, mais alto
  // em volta do centro, na ordem do ângulo; a Nuvem abre o voo
  pontos.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  pontos.unshift({ x: 0, z: 0, raio: 48, alt: 30 });
  const pos: THREE.Vector3[] = [], alvo: THREE.Vector3[] = [];
  for (const p of pontos) {
    // a câmera fica do lado de fora do ponto (olhando para o centro da cidade), girada um pouco para dar movimento
    const ang = (p.x || p.z ? Math.atan2(p.z, p.x) : Math.PI / 4) + 0.6;
    pos.push(new THREE.Vector3(p.x + Math.cos(ang) * p.raio, p.alt, p.z + Math.sin(ang) * p.raio));
    alvo.push(new THREE.Vector3(p.x, 2, p.z));
  }
  const cp = new THREE.CatmullRomCurve3(pos, true, "centripetal"), ca = new THREE.CatmullRomCurve3(alvo, true, "centripetal");
  return { pos: cp, alvo: ca, comprimento: cp.getLength(), u: 0 };
}
const ESCONDIDOS = new Map<HTMLElement, string>();
// modo gravação (&semui=1): esconde tudo o que está em volta da cena 3D (barra, cartões, mini-mapa…), menos os balões
function esconderInterface(canvas: HTMLElement, sim: boolean) {
  if (!sim) { for (const [el, v] of ESCONDIDOS) el.style.visibility = v; ESCONDIDOS.clear(); return; }
  let el: HTMLElement | null = canvas.parentElement; // a camada dos balões (drei Html) mora aqui dentro: fica visível
  while (el && el !== document.body) {
    const pai: HTMLElement | null = el.parentElement;
    if (pai) for (const irmao of Array.from(pai.children) as HTMLElement[]) if (irmao !== el && !ESCONDIDOS.has(irmao)) { ESCONDIDOS.set(irmao, irmao.style.visibility); irmao.style.visibility = "hidden"; }
    el = pai;
  }
}
const SEM_UI = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("semui") === "1";
// ?medir=1: os roteiros de teste leem a posição do meu boneco e tiram a foto do prédio sem a interface
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");

// ---------- andar pela rua ----------
// calçadas, ruas e a grama das bordas são livres; dentro dos quarteirões só a praça é aberta
const PRACA = LOTE_POR_CHAVE[PRACA_CHAVE]?.centro ?? null;
function livre(x: number, z: number) {
  if (Math.abs(x) > MUNDO.x - 2 || Math.abs(z) > MUNDO.z - 2) return false;
  const i = Math.round(x / PASSO), j = Math.round(z / PASSO);
  if (Math.abs(i) > N || Math.abs(j) > N) return true;
  const B = MEIO_Q + 0.35;
  if (Math.abs(x - i * PASSO) >= B || Math.abs(z - j * PASSO) >= B) return true;
  return !!PRACA && Math.abs(x - PRACA[0]) < 10.4 && Math.abs(z - PRACA[1]) < 10.4;
}
// anda o que der: se bater num quarteirão, escorrega ao longo da calçada
function caminhar(x: number, z: number, dx: number, dz: number): [number, number] {
  if (livre(x + dx, z + dz)) return [x + dx, z + dz];
  if (livre(x + dx, z)) return [x + dx, z];
  if (livre(x, z + dz)) return [x, z + dz];
  return [x, z];
}
function entrarAndar(x: Ctx) {
  const st = useCamera.getState(), c = x.c, e = extra(c);
  x.antesAndar = { minDistance: e.minDistance, maxDistance: e.maxDistance, minPolarAngle: e.minPolarAngle, maxPolarAngle: c.maxPolarAngle, enablePan: e.enablePan, mouseButtons: { ...e.mouseButtons }, touches: { ...e.touches } };
  st.set({ andar: true, drone: false, seguir: false, passeio: false, cima: false, rua: false }); c.autoRotate = false;
  e.minDistance = 3; e.maxDistance = 14; e.minPolarAngle = 0.85; c.maxPolarAngle = 1.45; e.enablePan = false;
  // arrastar com um dedo ou com o botão esquerdo gira a vista (no mapa normal ele arrasta)
  e.mouseButtons = { ...e.mouseButtons, LEFT: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }; e.touches = { ...e.touches, ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  // atrás do boneco, olhando para onde ele olha
  const r = minhaPos.rot;
  animar(x, (s) => { s.radius = 7; s.phi = 1.22; s.theta = Math.atan2(-Math.sin(r), -Math.cos(r)); }, 1.1, new THREE.Vector3(minhaPos.x, 1.3, minhaPos.z));
  x.andando = false; x.ultimoPasso = performance.now();
}
function sairAndar(x: Ctx) {
  const c = x.c, e = extra(c), a = x.antesAndar;
  useCamera.getState().set({ andar: false });
  if (a) { e.minDistance = a.minDistance ?? 4; e.maxDistance = a.maxDistance ?? MAX_RAIO; e.minPolarAngle = a.minPolarAngle ?? 0.35; c.maxPolarAngle = a.maxPolarAngle ?? 1.25; e.enablePan = a.enablePan ?? true; if (a.mouseButtons) e.mouseButtons = a.mouseButtons; if (a.touches) e.touches = a.touches; }
  x.antesAndar = null; joystick.x = 0; joystick.y = 0;
  if (x.andando) usePersonagem.setState({ destino: null });
  x.andando = false;
  animar(x, (s) => { s.radius = 40; s.phi = POLAR_PADRAO; }, 1.0, new THREE.Vector3(x.c.target.x, 0.5, x.c.target.z));
}

function executar(x: Ctx, tipo: ComandoCamera) {
  const st = useCamera.getState(); const c = x.c;
  if (tipo !== "andar" && tipo !== "girarEsq" && tipo !== "girarDir" && tipo !== "aproximar" && tipo !== "afastar" && st.andar) sairAndar(x);
  if (tipo !== "drone" && st.drone) pararDrone(x);
  switch (tipo) {
    case "girarEsq": animar(x, (s) => { s.theta += Math.PI / 2; }); break;
    case "girarDir": animar(x, (s) => { s.theta -= Math.PI / 2; }); break;
    case "aproximar": animar(x, (s) => { s.radius *= 0.62; }, 0.5); break;
    case "afastar": animar(x, (s) => { s.radius *= 1.6; }, 0.5); break;
    case "cima": { const cima = !st.cima; st.set({ cima, rua: false }); c.maxPolarAngle = 1.25; animar(x, (s) => { s.phi = cima ? POLAR_CIMA : POLAR_PADRAO; if (cima) s.radius = Math.max(s.radius, 70); }, 0.9); break; }
    case "rua": { const rua = !st.rua; st.set({ rua, cima: false }); c.maxPolarAngle = rua ? 1.4 : 1.25; animar(x, (s) => { s.phi = rua ? POLAR_RUA : POLAR_PADRAO; s.radius = rua ? 30 : Math.max(s.radius, 45); }, 1.0); break; } // 30 m: fora do prédio, na altura de quem passa
    case "inicio": {
      st.set({ cima: false, rua: false, seguir: false, passeio: false }); c.maxPolarAngle = 1.25; c.autoRotate = false;
      x.anim = { t0: segundos(), dur: 1.1, de: esferaDe(x), ate: new THREE.Spherical().setFromVector3(x.inicio.pos.clone().sub(x.inicio.alvo)), alvoDe: c.target.clone(), alvoAte: x.inicio.alvo.clone() };
      break;
    }
    case "seguir": {
      const seguir = !st.seguir && usePersonagem.getState().ativo; st.set({ seguir, passeio: false }); c.autoRotate = false;
      if (seguir) animar(x, (s) => { s.radius = Math.min(s.radius, 30); s.phi = Math.min(s.phi, 1.05); }, 0.9, new THREE.Vector3(minhaPos.x, 0.6, minhaPos.z));
      break;
    }
    case "passeio": { const passeio = !st.passeio; st.set({ passeio, seguir: false }); c.autoRotate = passeio; c.autoRotateSpeed = 0.55; break; }
    case "drone": {
      if (st.drone) { pararDrone(x); break; }
      st.set({ drone: true, seguir: false, passeio: false, cima: false, rua: false }); c.autoRotate = false; c.maxPolarAngle = 1.25;
      x.rota = montarRota(); x.anim = null;
      // começa do ponto da rota mais perto de onde a câmera está (sem pulo)
      let melhor = 0, dmin = Infinity; for (let i = 0; i < 60; i++) { const d = x.rota.pos.getPointAt(i / 60).distanceTo(x.camera.position); if (d < dmin) { dmin = d; melhor = i / 60; } }
      x.rota.u = melhor;
      break;
    }
    case "andar": {
      if (st.andar) { sairAndar(x); break; }
      // sem personagem: o convite para criar abre no lugar
      if (!usePersonagem.getState().ativo) { usePersonagem.getState().abrir("montar"); break; }
      entrarAndar(x);
      break;
    }
  }
}
function pararDrone(x: Ctx) { useCamera.getState().set({ drone: false }); x.rota = null; }

// mexer com o mouse interrompe o giro e o drone; arrastar para longe do personagem para de seguir
function aoComecar(x: Ctx) {
  x.interagindo = true; x.anim = null;
  const st = useCamera.getState(); if (st.passeio) { st.set({ passeio: false }); x.c.autoRotate = false; }
  if (st.drone) pararDrone(x);
}
function aoTerminar(x: Ctx) {
  x.interagindo = false;
  const st = useCamera.getState();
  if (st.seguir && Math.hypot(x.c.target.x - minhaPos.x, x.c.target.z - minhaPos.z) > 5) st.set({ seguir: false });
}

const TECLAS_MOVE = ["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "+", "=", "-", "_"];
function teclaDesce(x: Ctx, e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if ((t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(); const st = useCamera.getState();
  // qualquer tecla devolve o controle durante o voo de drone (a do próprio drone desliga)
  if (st.drone && k !== "o") { pararDrone(x); if (!TECLAS_MOVE.includes(k)) return; }
  const unicos: Record<string, ComandoCamera> = { t: "cima", v: "rua", f: "seguir", p: "passeio", h: "inicio", o: "drone", c: "andar" };
  if (unicos[k]) { if (!e.repeat) st.pedir(unicos[k]); return; }
  if (k === "escape" && st.andar) { st.pedir("andar"); return; }
  if (!TECLAS_MOVE.includes(k)) return;
  x.teclas.add(k); if (k.startsWith("arrow")) e.preventDefault();
  if (st.passeio) { st.set({ passeio: false }); x.c.autoRotate = false; }
}

function irPara(x: Ctx, e: MouseEvent, el: HTMLElement) {
  if (useCamera.getState().andar) return; // andando pela rua, o duplo clique não teletransporta a câmera
  const r = el.getBoundingClientRect(); const ray = new THREE.Raycaster(); const p = new THREE.Vector3();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), x.camera);
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
  useCamera.getState().set({ seguir: false });
  animar(x, (s) => { s.radius = Math.min(s.radius, 40); }, 0.8, p.setY(0.5));
}

const frenteV = new THREE.Vector3(), ladoV = new THREE.Vector3(), mov = new THREE.Vector3();
// para onde a câmera olha (alvo no chão e direção), lido pelo mini-mapa a cada quadro (12/11/2026)
export const cameraInfo = { x: 0, z: 0, ang: 0, pronto: false };
function quadroDrone(x: Ctx, dt: number) {
  const r = x.rota; if (!r) return;
  r.u = (r.u + (6.5 * dt) / r.comprimento) % 1; // 6,5 m/s pela rota
  r.pos.getPointAt(r.u, x.camera.position); r.alvo.getPointAt(r.u, x.c.target);
  x.camera.position.y = Math.max(8, x.camera.position.y); // nunca encosta nos telhados
  x.c.update();
}
function quadroAndar(x: Ctx, dt: number) {
  const { c, camera } = x; const t = c.target; const ks = x.teclas;
  if (!usePersonagem.getState().ativo) { sairAndar(x); return; }
  let fx = joystick.x, fy = -joystick.y;
  if (ks.has("w") || ks.has("arrowup")) fy += 1;
  if (ks.has("s") || ks.has("arrowdown")) fy -= 1;
  if (ks.has("d") || ks.has("arrowright")) fx += 1;
  if (ks.has("a") || ks.has("arrowleft")) fx -= 1;
  frenteV.set(t.x - camera.position.x, 0, t.z - camera.position.z).normalize(); ladoV.set(-frenteV.z, 0, frenteV.x);
  mov.set(0, 0, 0).addScaledVector(frenteV, fy).addScaledVector(ladoV, fx);
  const agora = performance.now();
  if (mov.lengthSq() > 0.02) {
    // o boneco anda até um ponto 2,6 m à frente, renovado várias vezes por segundo (a cena dele faz o arranque e a freada)
    mov.normalize().multiplyScalar(2.6);
    if (agora - x.ultimoPasso > 160 || !x.andando) {
      const destino = caminhar(minhaPos.x, minhaPos.z, mov.x, mov.z);
      usePersonagem.setState({ destino, passeio: false }); x.ultimoPasso = agora; x.andando = true;
      if (agora - x.ultimaBatida > 1500) { usePersonagem.getState().avisarMovimento(); x.ultimaBatida = agora; }
    }
  } else if (x.andando) {
    // soltou: freia logo à frente
    const destino = caminhar(minhaPos.x, minhaPos.z, Math.sin(minhaPos.rot) * 0.3, Math.cos(minhaPos.rot) * 0.3);
    usePersonagem.setState({ destino, passeio: false }); x.andando = false; x.ultimoPasso = agora; usePersonagem.getState().avisarMovimento();
  } else if (agora - x.ultimoPasso > 7000) {
    // parado: um "cheguei" no próprio lugar não deixa o boneco sair passeando sozinho pela calçada
    usePersonagem.setState({ destino: [minhaPos.x, minhaPos.z], passeio: false }); x.ultimoPasso = agora;
  }
  // a câmera acompanha o boneco (o alvo é a altura do peito dele) e mantém o ângulo que a pessoa escolheu
  mov.set(minhaPos.x - t.x, 1.3 - t.y, minhaPos.z - t.z).multiplyScalar(Math.min(1, dt * 6));
  t.add(mov); camera.position.add(mov);
  const giro = (ks.has("q") ? 1 : 0) - (ks.has("e") ? 1 : 0);
  if (giro) { const s = esferaDe(x); s.theta += giro * 1.6 * dt; camera.position.setFromSpherical(s).add(t); }
  c.update();
}
function quadro(x: Ctx, dt: number) {
  const { c, camera } = x; const t = c.target; let mudou = false;
  const st = useCamera.getState();
  if (st.drone && x.rota && !x.interagindo) { quadroDrone(x, dt); atualizarInfo(x); return; }
  // animação em andamento
  const a = x.anim;
  if (a) {
    const k = Math.min(1, (segundos() - a.t0) / a.dur), e = suave(k);
    if (a.alvoDe && a.alvoAte) t.lerpVectors(a.alvoDe, a.alvoAte, e);
    camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(a.de.radius, a.ate.radius, e), THREE.MathUtils.lerp(a.de.phi, a.ate.phi, e), THREE.MathUtils.lerp(a.de.theta, a.ate.theta, e))).add(t);
    mudou = true; if (k >= 1) x.anim = null;
  }
  if (st.andar && !a) { quadroAndar(x, dt); atualizarInfo(x); return; }
  // seguir o personagem: o alvo acompanha e a câmera vai junto, mantendo o ângulo
  if (st.seguir && !x.interagindo && !a) {
    mov.set(minhaPos.x - t.x, 0, minhaPos.z - t.z).multiplyScalar(Math.min(1, dt * 4));
    if (mov.lengthSq() > 1e-6) { t.add(mov); camera.position.add(mov); mudou = true; }
  }
  // teclado: anda na direção para onde a câmera olha
  const ks = x.teclas;
  if (ks.size && !st.andar) {
    const raio = camera.position.distanceTo(t);
    frenteV.set(t.x - camera.position.x, 0, t.z - camera.position.z).normalize(); ladoV.set(-frenteV.z, 0, frenteV.x);
    mov.set(0, 0, 0);
    if (ks.has("w") || ks.has("arrowup")) mov.add(frenteV);
    if (ks.has("s") || ks.has("arrowdown")) mov.sub(frenteV);
    if (ks.has("d") || ks.has("arrowright")) mov.add(ladoV);
    if (ks.has("a") || ks.has("arrowleft")) mov.sub(ladoV);
    if (mov.lengthSq()) { mov.normalize().multiplyScalar(Math.max(8, raio * 0.6) * dt); t.add(mov); camera.position.add(mov); if (st.seguir) st.set({ seguir: false }); }
    const giro = (ks.has("q") ? 1 : 0) - (ks.has("e") ? 1 : 0);
    const zoom = (ks.has("+") || ks.has("=") ? -1 : 0) + (ks.has("-") || ks.has("_") ? 1 : 0);
    if (giro || zoom) {
      const s = esferaDe(x); s.theta += giro * 1.6 * dt; s.radius = THREE.MathUtils.clamp(s.radius * Math.exp(zoom * 1.4 * dt), MIN_RAIO, MAX_RAIO);
      camera.position.setFromSpherical(s).add(t);
    }
    mudou = true;
  }
  if (mudou) c.update();
  atualizarInfo(x);
}
function atualizarInfo(x: Ctx) {
  const t = x.c.target, p = x.camera.position;
  cameraInfo.x = t.x; cameraInfo.z = t.z; cameraInfo.ang = Math.atan2(t.x - p.x, t.z - p.z); cameraInfo.pronto = true;
}

export function CameraMundo({ controles, inicio }: { controles: React.RefObject<Controles | null>; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 } }) {
  const { camera, gl, scene } = useThree();
  const ctx = useRef<Ctx | null>(null);
  const pedido = useCamera((s) => s.pedido);
  const drone = useCamera((s) => s.drone);
  const pegar = () => {
    const c = controles.current; if (!c) return null;
    if (!ctx.current) ctx.current = { camera, c, inicio, anim: null, teclas: new Set(), interagindo: false, rota: null, antesAndar: null, andando: false, ultimoPasso: 0, ultimaBatida: 0 };
    return ctx.current;
  };

  useEffect(() => { const x = pegar(); if (pedido && x) executar(x, pedido.tipo); }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const x = pegar(); if (!x) return;
    const ini = () => aoComecar(x), fim = () => aoTerminar(x);
    const desce = (e: KeyboardEvent) => teclaDesce(x, e), sobe = (e: KeyboardEvent) => x.teclas.delete(e.key.toLowerCase()), sai = () => x.teclas.clear();
    const dbl = (e: MouseEvent) => irPara(x, e, gl.domElement);
    // durante o drone, tocar na tela ou girar a roda devolve o controle
    const toque = () => { if (useCamera.getState().drone) pararDrone(x); };
    x.c.addEventListener("start", ini); x.c.addEventListener("end", fim);
    window.addEventListener("keydown", desce); window.addEventListener("keyup", sobe); window.addEventListener("blur", sai);
    gl.domElement.addEventListener("dblclick", dbl); gl.domElement.addEventListener("pointerdown", toque); gl.domElement.addEventListener("wheel", toque, { passive: true });
    // foto do meu prédio (ui/FotoPredio) usa a mesma câmera e o mesmo desenho
    registrarPonte({ gl, scene, camera: camera as THREE.PerspectiveCamera, controles: x.c, pararModos: () => { if (useCamera.getState().drone) pararDrone(x); if (useCamera.getState().andar) sairAndar(x); useCamera.getState().set({ seguir: false, passeio: false }); x.c.autoRotate = false; x.anim = null; } });
    if (MEDIR) Object.assign(window, { __minhaPos: minhaPos, __fotoPredio: tirarFotoPredio, __camInfo: cameraInfo, __livre: livre });
    // ?drone=1 liga o voo quando a cidade já abriu
    const q = new URLSearchParams(window.location.search);
    const tDrone = q.get("drone") === "1" ? setTimeout(() => { if (!useCamera.getState().drone) useCamera.getState().pedir("drone"); }, 2500) : null;
    return () => {
      x.c.removeEventListener("start", ini); x.c.removeEventListener("end", fim);
      window.removeEventListener("keydown", desce); window.removeEventListener("keyup", sobe); window.removeEventListener("blur", sai);
      gl.domElement.removeEventListener("dblclick", dbl); gl.domElement.removeEventListener("pointerdown", toque); gl.domElement.removeEventListener("wheel", toque);
      registrarPonte(null); if (tDrone) clearTimeout(tDrone);
    };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps
  // modo gravação: com &semui=1, a interface some enquanto o drone voa e volta quando a pessoa retoma o controle
  useEffect(() => {
    if (!SEM_UI) return;
    if (!drone) { esconderInterface(gl.domElement, false); return; }
    esconderInterface(gl.domElement, true);
    const t = setInterval(() => esconderInterface(gl.domElement, true), 700); // cartões e avisos que aparecem depois
    return () => clearInterval(t);
  }, [drone, gl]);
  useFrame((_, dt) => { const x = pegar(); if (x) quadro(x, Math.min(dt, 0.1)); });
  return null;
}
