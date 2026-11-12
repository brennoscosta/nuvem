"use client";
// Câmera do mapa (11/11/2026): girar de 90 em 90 graus, aproximar e afastar, ver de cima, ver da rua, voltar ao início,
// seguir o meu personagem, passeio automático (gira devagar em volta do ponto), teclado (WASD/setas, Q/E, +/−) e duplo
// clique para ir até um ponto. Tudo com animação suave em cima dos controles de mapa que já existiam.
// A lógica fica em funções fora do componente, sobre um contexto guardado num ref (os controles e a câmera são objetos
// do three.js que mudam a cada quadro).
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useCamera, type ComandoCamera } from "../cameraStore";
import { minhaPos, usePersonagem } from "../personagemStore";

const MIN_RAIO = 6, MAX_RAIO = 119;
const POLAR_PADRAO = 0.95, POLAR_CIMA = 0.36, POLAR_RUA = 1.27;
export interface Controles {
  target: THREE.Vector3; maxPolarAngle: number; autoRotate: boolean; autoRotateSpeed: number;
  update(): void; addEventListener(tipo: string, f: () => void): void; removeEventListener(tipo: string, f: () => void): void;
}
type Anim = { t0: number; dur: number; de: THREE.Spherical; ate: THREE.Spherical; alvoDe?: THREE.Vector3; alvoAte?: THREE.Vector3 };
interface Ctx { camera: THREE.Camera; c: Controles; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 }; anim: Anim | null; teclas: Set<string>; interagindo: boolean }
const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const segundos = () => performance.now() / 1000;
const esferaDe = (x: Ctx) => new THREE.Spherical().setFromVector3(x.camera.position.clone().sub(x.c.target));

function animar(x: Ctx, mudar: (s: THREE.Spherical) => void, dur = 0.7, alvoAte?: THREE.Vector3) {
  const de = esferaDe(x); const ate = de.clone(); mudar(ate);
  ate.radius = THREE.MathUtils.clamp(ate.radius, MIN_RAIO, MAX_RAIO); ate.phi = THREE.MathUtils.clamp(ate.phi, 0.3, 1.4);
  x.anim = { t0: segundos(), dur, de, ate, alvoDe: alvoAte ? x.c.target.clone() : undefined, alvoAte };
}

function executar(x: Ctx, tipo: ComandoCamera) {
  const st = useCamera.getState(); const c = x.c;
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
  }
}

// mexer com o mouse interrompe o passeio; arrastar para longe do personagem para de seguir
function aoComecar(x: Ctx) {
  x.interagindo = true; x.anim = null;
  const st = useCamera.getState(); if (st.passeio) { st.set({ passeio: false }); x.c.autoRotate = false; }
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
  const unicos: Record<string, ComandoCamera> = { t: "cima", v: "rua", f: "seguir", p: "passeio", h: "inicio" };
  if (unicos[k]) { if (!e.repeat) st.pedir(unicos[k]); return; }
  if (!TECLAS_MOVE.includes(k)) return;
  x.teclas.add(k); if (k.startsWith("arrow")) e.preventDefault();
  if (st.passeio) { st.set({ passeio: false }); x.c.autoRotate = false; }
}

function irPara(x: Ctx, e: MouseEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect(); const ray = new THREE.Raycaster(); const p = new THREE.Vector3();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), x.camera);
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
  useCamera.getState().set({ seguir: false });
  animar(x, (s) => { s.radius = Math.min(s.radius, 40); }, 0.8, p.setY(0.5));
}

const frenteV = new THREE.Vector3(), ladoV = new THREE.Vector3(), mov = new THREE.Vector3();
// para onde a câmera olha (alvo no chão e direção), lido pelo mini-mapa a cada quadro (12/11/2026)
export const cameraInfo = { x: 0, z: 0, ang: 0, pronto: false };
function quadro(x: Ctx, dt: number) {
  const { c, camera } = x; const t = c.target; let mudou = false;
  // animação em andamento
  const a = x.anim;
  if (a) {
    const k = Math.min(1, (segundos() - a.t0) / a.dur), e = suave(k);
    if (a.alvoDe && a.alvoAte) t.lerpVectors(a.alvoDe, a.alvoAte, e);
    camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(a.de.radius, a.ate.radius, e), THREE.MathUtils.lerp(a.de.phi, a.ate.phi, e), THREE.MathUtils.lerp(a.de.theta, a.ate.theta, e))).add(t);
    mudou = true; if (k >= 1) x.anim = null;
  }
  // seguir o personagem: o alvo acompanha e a câmera vai junto, mantendo o ângulo
  const st = useCamera.getState();
  if (st.seguir && !x.interagindo && !a) {
    mov.set(minhaPos.x - t.x, 0, minhaPos.z - t.z).multiplyScalar(Math.min(1, dt * 4));
    if (mov.lengthSq() > 1e-6) { t.add(mov); camera.position.add(mov); mudou = true; }
  }
  // teclado: anda na direção para onde a câmera olha
  const ks = x.teclas;
  if (ks.size) {
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
  cameraInfo.x = t.x; cameraInfo.z = t.z; cameraInfo.ang = Math.atan2(t.x - camera.position.x, t.z - camera.position.z); cameraInfo.pronto = true;
}

export function CameraMundo({ controles, inicio }: { controles: React.RefObject<Controles | null>; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 } }) {
  const { camera, gl } = useThree();
  const ctx = useRef<Ctx | null>(null);
  const pedido = useCamera((s) => s.pedido);
  const pegar = () => { const c = controles.current; if (!c) return null; if (!ctx.current) ctx.current = { camera, c, inicio, anim: null, teclas: new Set(), interagindo: false }; return ctx.current; };

  useEffect(() => { const x = pegar(); if (pedido && x) executar(x, pedido.tipo); }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const x = pegar(); if (!x) return;
    const ini = () => aoComecar(x), fim = () => aoTerminar(x);
    const desce = (e: KeyboardEvent) => teclaDesce(x, e), sobe = (e: KeyboardEvent) => x.teclas.delete(e.key.toLowerCase()), sai = () => x.teclas.clear();
    const dbl = (e: MouseEvent) => irPara(x, e, gl.domElement);
    x.c.addEventListener("start", ini); x.c.addEventListener("end", fim);
    window.addEventListener("keydown", desce); window.addEventListener("keyup", sobe); window.addEventListener("blur", sai);
    gl.domElement.addEventListener("dblclick", dbl);
    return () => {
      x.c.removeEventListener("start", ini); x.c.removeEventListener("end", fim);
      window.removeEventListener("keydown", desce); window.removeEventListener("keyup", sobe); window.removeEventListener("blur", sai);
      gl.domElement.removeEventListener("dblclick", dbl);
    };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => { const x = pegar(); if (x) quadro(x, Math.min(dt, 0.1)); });
  return null;
}
