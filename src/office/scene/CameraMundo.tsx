"use client";
// Câmera do mapa (11/11/2026): girar de 90 em 90 graus, aproximar e afastar, ver de cima, ver da rua, voltar ao início,
// seguir o meu personagem, girar devagar em volta do ponto, teclado (WASD/setas, Q/E, +/−) e duplo clique para ir até
// um ponto. Tudo com animação suave em cima dos controles de mapa que já existiam.
// 18/11/2026: o personagem atrás de um prédio não some mais (desvio da câmera, mais abaixo).
// 12/11/2026: voo de drone pela cidade (?drone=1 liga; &semui=1 esconde a interface para gravar vídeo; qualquer toque
// ou tecla devolve o controle) e andar pela rua (câmera atrás do meu personagem; W A S D ou o joystick da tela andam,
// arrastar gira a vista; não entra nos quarteirões, só a praça é aberta).
// A lógica fica em funções fora do componente, sobre um contexto guardado num ref (os controles e a câmera são objetos
// do three.js que mudam a cada quadro).
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useCamera, joystick, comandoAndar, RAIO_MAXIMO, cameraInfo, type ComandoCamera } from "../cameraStore";
import { minhaPos, usePersonagem, acessoNoPredio } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { useEscritorio } from "../store";
import { LOTE_POR_CHAVE, PASSO, MEIO_Q, MUNDO, N } from "../data/mundo";
import { PRACA_CHAVE } from "../data/praca";
import { caminhar, livre } from "../data/caminhos";
import { plantaPorChave, caminharDentro, livreDentro, dentroDoPredio, paraMundo, zonaNoMundo, podeEntrarEm } from "../data/plantaInterna";
import { caixasDaCidade, primeiraBatida, type Caixa } from "../data/obstaculos";
import { registrarPonte, tirarFotoPredio } from "./fotoPredio";

// 20/11/2026: o máximo subiu 30% (cameraStore › RAIO_MAXIMO)
const MIN_RAIO = 6, MAX_RAIO = RAIO_MAXIMO;
const POLAR_PADRAO = 0.95, POLAR_CIMA = 0.36, POLAR_RUA = 1.27;
export interface Controles {
  target: THREE.Vector3; maxPolarAngle: number; autoRotate: boolean; autoRotateSpeed: number;
  update(): void; addEventListener(tipo: string, f: () => void): void; removeEventListener(tipo: string, f: () => void): void;
}
// o resto dos controles do drei (MapControls), mexido só no modo andar
interface ControlesExtra { dampingFactor: number; minDistance: number; maxDistance: number; minPolarAngle: number; enablePan: boolean; mouseButtons: Record<string, number | null>; touches: Record<string, number | null> }
type Anim = { t0: number; dur: number; de: THREE.Spherical; ate: THREE.Spherical; alvoDe?: THREE.Vector3; alvoAte?: THREE.Vector3 };
interface Rota { pos: THREE.CatmullRomCurve3; alvo: THREE.CatmullRomCurve3; comprimento: number; u: number }
interface Ctx {
  camera: THREE.Camera; c: Controles; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 }; anim: Anim | null; teclas: Set<string>; interagindo: boolean;
  rota: Rota | null; antesAndar: Partial<ControlesExtra> & { maxPolarAngle?: number } | null; andando: boolean;
  desvio: Desvio; seg: Segue;
}
const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const segundos = () => performance.now() / 1000;
const esferaDe = (x: Ctx) => new THREE.Spherical().setFromVector3(x.camera.position.clone().sub(x.c.target));
const extra = (c: Controles) => c as unknown as ControlesExtra;

function animar(x: Ctx, mudar: (s: THREE.Spherical) => void, dur = 0.7, alvoAte?: THREE.Vector3) {
  const de = esferaDe(x); const ate = de.clone(); mudar(ate);
  ate.theta = de.theta + angulo(ate.theta - de.theta); // pelo lado mais curto (antes podia dar quase uma volta inteira)
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
// livre() e caminhar() moram em data/caminhos.ts (o toque no chão usa o mesmo mapa do que é livre, com caminho)
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
  x.andando = false; x.seg.pronto = false; comandoAndar.ativo = true;
}
function sairAndar(x: Ctx) {
  const c = x.c, e = extra(c), a = x.antesAndar;
  useCamera.getState().set({ andar: false });
  if (a) { e.minDistance = a.minDistance ?? 4; e.maxDistance = a.maxDistance ?? MAX_RAIO; e.minPolarAngle = a.minPolarAngle ?? 0.35; c.maxPolarAngle = a.maxPolarAngle ?? 1.25; e.enablePan = a.enablePan ?? true; if (a.mouseButtons) e.mouseButtons = a.mouseButtons; if (a.touches) e.touches = a.touches; }
  x.antesAndar = null; joystick.x = 0; joystick.y = 0;
  comandoAndar.ativo = false; comandoAndar.x = 0; comandoAndar.z = 0;
  // andando: freia até um ponto logo à frente (pelo caminho de sempre), sem parar de uma vez
  const p = usePersonagem.getState();
  if (minhaPos.vel > 0.3 && !p.destino && p.ativo) {
    const pd = p.predio, pl = pd && (pd.fase === "recepcao" || pd.fase === "dentro") ? plantaPorChave(pd.chave, useMundo.getState().terrenos) : null;
    const d = (minhaPos.vel * minhaPos.vel) / (2 * (p.veiculo ? 4.2 : 8)) + 0.1, dx = Math.sin(minhaPos.rot) * d, dz = Math.cos(minhaPos.rot) * d;
    usePersonagem.setState({ destino: pl && pd ? caminharDentro(pl, minhaPos.x, minhaPos.z, dx, dz, acessoNoPredio(pd)) : caminhar(minhaPos.x, minhaPos.z, dx, dz), rota: [], passeio: false });
  }
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
      { const de = esferaDe(x), ate = new THREE.Spherical().setFromVector3(x.inicio.pos.clone().sub(x.inicio.alvo)); ate.theta = de.theta + angulo(ate.theta - de.theta); x.anim = { t0: segundos(), dur: 1.1, de, ate, alvoDe: c.target.clone(), alvoAte: x.inicio.alvo.clone() }; }
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

const frenteV = new THREE.Vector3(), ladoV = new THREE.Vector3(), mov = new THREE.Vector3(), offV = new THREE.Vector3();
const esfA = new THREE.Spherical();
// para onde a câmera olha (alvo no chão e direção), lido pelo mini-mapa a cada quadro (12/11/2026); mora no cameraStore
// desde 20/11/2026 (a névoa do CicloDia também lê, sem importar este arquivo)
export { cameraInfo };
function quadroDrone(x: Ctx, dt: number) {
  const r = x.rota; if (!r) return;
  r.u = (r.u + (6.5 * dt) / r.comprimento) % 1; // 6,5 m/s pela rota
  r.pos.getPointAt(r.u, x.camera.position); r.alvo.getPointAt(r.u, x.c.target);
  x.camera.position.y = Math.max(8, x.camera.position.y); // nunca encosta nos telhados
  x.c.update();
}

// ---------- acompanhar o boneco (21/11/2026, pedido do dono: "a câmera não fica boa, a movimentação é bugada") ----------
// O alvo da câmera vai GRUDADO no boneco (ele mesmo anda com arranque e freada suaves e anda antes da câmera no mesmo
// quadro: scene/Personagens.tsx), mais uma mira à frente que cresce com a velocidade de verdade dele, suavizada. Antes o
// alvo corria atrás do boneco com um filtro que dependia da taxa de quadros (com o tempo de cada quadro variando, o boneco
// tremia na tela e ficava mais ou menos para trás), e a mira da bicicleta (v93) usava a direção do corpo e a velocidade
// pedida, que mudam de uma vez ao subir, ao descer e ao frear: o alvo dava trancos. Tudo aqui usa 1 − e^(−k·dt), o mesmo
// movimento em 16 ou em 100 ms por quadro.
interface Segue { px: number; pz: number; vx: number; vz: number; lx: number; lz: number; pronto: boolean; livreDesde: number; giro: number }
const novoSegue = (): Segue => ({ px: 0, pz: 0, vx: 0, vz: 0, lx: 0, lz: 0, pronto: false, livreDesde: 0, giro: 0 });
const ALVO = new THREE.Vector3();
// mira = quantos segundos à frente (pela velocidade); y = altura do alvo
function alvoDoBoneco(x: Ctx, dt: number, mira: number, y: number): THREE.Vector3 {
  const s = x.seg;
  if (!s.pronto || Math.hypot(minhaPos.x - s.px, minhaPos.z - s.pz) > 4) { s.px = minhaPos.x; s.pz = minhaPos.z; s.vx = s.vz = s.lx = s.lz = 0; s.pronto = true; }
  if (dt > 0) {
    const kv = 1 - Math.exp(-dt * 10), km = 1 - Math.exp(-dt * 2.5);
    s.vx += ((minhaPos.x - s.px) / dt - s.vx) * kv; s.vz += ((minhaPos.z - s.pz) / dt - s.vz) * kv;
    s.px = minhaPos.x; s.pz = minhaPos.z;
    s.lx += (s.vx * mira - s.lx) * km; s.lz += (s.vz * mira - s.lz) * km;
  }
  return ALVO.set(minhaPos.x + s.lx, y, minhaPos.z + s.lz);
}
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// Andar pela rua: o teclado e o joystick viram uma direção no chão (para onde a câmera olha) que o boneco segue direto
// (cameraStore › comandoAndar). A câmera fica atrás e um pouco acima, no ângulo que a pessoa escolheu (arrastar, a roda,
// a pinça e Q/E mexem nele). Andando para a frente (ou por um caminho tocado no chão), ela volta devagar para trás do
// boneco; de lado ou de costas para a câmera, não (senão ele andaria em círculos). Depois de girar a vista, espera 1,2 s.
function quadroAndar(x: Ctx, dt: number, alvo: THREE.Vector3, animando: boolean) {
  const { camera } = x; const t = x.c.target; const ks = x.teclas;
  const p = usePersonagem.getState();
  if (!p.ativo) { sairAndar(x); return; }
  let fx = joystick.x, fy = -joystick.y;
  if (ks.has("w") || ks.has("arrowup")) fy += 1;
  if (ks.has("s") || ks.has("arrowdown")) fy -= 1;
  if (ks.has("d") || ks.has("arrowright")) fx += 1;
  if (ks.has("a") || ks.has("arrowleft")) fx -= 1;
  const forca = Math.min(1, Math.hypot(fx, fy));
  frenteV.set(t.x - camera.position.x, 0, t.z - camera.position.z).normalize(); ladoV.set(-frenteV.z, 0, frenteV.x);
  mov.set(0, 0, 0).addScaledVector(frenteV, fy).addScaledVector(ladoV, fx);
  if (mov.lengthSq() > 1e-8) mov.setLength(forca);
  // dentro de um prédio (17/11/2026) o boneco anda pela planta interna (scene/Personagens.tsx › andarDireto); entrando ou
  // saindo pela porta, espera chegar
  const pd = p.predio;
  const dentro = !!pd && (pd.fase === "recepcao" || pd.fase === "dentro"), preso = !!pd && (pd.fase === "entrando" || pd.fase === "saindo");
  const quer = forca > 0.12 && !preso;
  // começou a andar (ou um toque no chão tinha posto um caminho): o teclado assume
  if (quer && (!x.andando || p.destino)) usePersonagem.setState(dentro && pd ? { destino: null, rota: [], passeio: false, predio: { ...pd, fase: "dentro" } } : { destino: null, rota: [], passeio: false, predio: null, acaoNoPonto: null });
  x.andando = quer;
  comandoAndar.ativo = true; comandoAndar.x = quer ? mov.x : 0; comandoAndar.z = quer ? mov.z : 0;
  if (animando) return; // a animação de entrada cuida da câmera
  esfA.setFromVector3(offV.copy(camera.position).sub(t));
  const agora = segundos(), s = x.seg;
  const giro = (ks.has("q") ? 1 : 0) - (ks.has("e") ? 1 : 0);
  if (giro || x.interagindo) s.livreDesde = agora + 1.2;
  // velocidade de giro pedida: Q/E (1,6 rad/s) ou a volta para trás do boneco (proporcional ao ângulo que falta)
  let alvoGiro = giro * 1.6;
  const sp = Math.hypot(s.vx, s.vz);
  if (!giro && agora > s.livreDesde && sp > 0.6) {
    // só andando para a frente (ou por um caminho tocado no chão); soltou as teclas: a câmera fica onde está
    const w = quer ? Math.max(0, Math.min(1, fy / forca)) : p.destino ? 1 : 0;
    if (w > 0) alvoGiro = Math.max(-2.4, Math.min(2.4, angulo(Math.atan2(-s.vx, -s.vz) - esfA.theta) * 2.2 * w * Math.min(1, sp / 2)));
  }
  // a própria velocidade de giro muda suave (~0,15 s): trocar o joystick de frente para o lado, soltar Q/E ou parar não
  // dão tranco na câmera (a 7 m, um giro que parava de uma vez jogava a câmera 40 cm fora do caminho num quadro)
  s.giro = x.interagindo ? 0 : s.giro + (alvoGiro - s.giro) * (1 - Math.exp(-dt / 0.15));
  esfA.theta += s.giro * dt;
  t.copy(alvo); camera.position.setFromSpherical(esfA).add(t); camera.lookAt(t);
}
function quadro(x: Ctx, dt: number) {
  const { c, camera } = x; const t = c.target; let mudou = false;
  const st = useCamera.getState();
  if (st.drone && x.rota && !x.interagindo) { quadroDrone(x, dt); atualizarInfo(x); return; }
  // o alvo no boneco, uma vez por quadro (andar: no peito, mirando um pouco à frente; seguir: no chão, mirando à frente só
  // de bicicleta, como na v93)
  const bici = !!usePersonagem.getState().veiculo;
  const alvo = st.andar ? alvoDoBoneco(x, dt, 0.25, 1.3) : st.seguir ? alvoDoBoneco(x, dt, bici ? 0.3 : 0.05, 0.6) : null;
  if (!alvo) x.seg.pronto = false;
  if (!st.andar && comandoAndar.ativo) { comandoAndar.ativo = false; comandoAndar.x = 0; comandoAndar.z = 0; }
  // animação em andamento; seguindo o boneco, ela termina no boneco de agora (e não onde ele estava quando ela começou:
  // antes, ao fim da animação, o alvo pulava até o boneco)
  const a = x.anim;
  if (a) {
    if (alvo && a.alvoAte) a.alvoAte.copy(alvo);
    const k = Math.min(1, (segundos() - a.t0) / a.dur), e = suave(k);
    if (a.alvoDe && a.alvoAte) t.lerpVectors(a.alvoDe, a.alvoAte, e);
    camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(a.de.radius, a.ate.radius, e), THREE.MathUtils.lerp(a.de.phi, a.ate.phi, e), THREE.MathUtils.lerp(a.de.theta, a.ate.theta, e))).add(t);
    mudou = true; if (k >= 1) x.anim = null;
  }
  if (st.andar && alvo) { quadroAndar(x, dt, alvo, !!a); if (a) c.update(); atualizarInfo(x); return; }
  // seguir o personagem: o alvo vai junto com ele (e a câmera com o alvo), mantendo o ângulo e a distância escolhidos
  if (st.seguir && !x.interagindo && !a && alvo) {
    mov.set(alvo.x - t.x, 0, alvo.z - t.z);
    if (mov.lengthSq() > 1e-10) { t.add(mov); camera.position.add(mov); camera.lookAt(t); }
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

// ---------- o personagem atrás de um prédio (18/11/2026) ----------
// Pedido do dono: "a câmera de seguir o personagem fica bugada quando se aproxima de um prédio, fica escondendo o boneco".
// Seguindo o personagem (botão Seguir ou andar pela rua), a cada quadro sai um raio do peito do boneco até a câmera, testado
// contra as caixas dos prédios (data/obstaculos.ts: umas 50 caixas, nada de raio contra as malhas da cena). Se bater, a
// câmera procura a posição livre mais parecida com a que a pessoa escolheu: sobe (olha mais de cima) e/ou chega mais perto.
// Seguindo de longe ela prefere subir; andando pela rua (câmera baixa, logo atrás) prefere chegar perto. Vai depressa para
// a posição livre e volta devagar quando o caminho abre, sem pular. O desvio é só no desenho: a posição escolhida fica
// guardada e volta no começo do quadro seguinte, antes de os controles do mapa lerem a câmera (girar, aproximar e afastar
// continuam como antes). Por dentro dos prédios (vista "dentro", entrando, na recepção ou saindo) nada muda.
interface Desvio { sobe: number; razao: number; vs: number; vr: number; aplicado: boolean; desejada: THREE.Vector3; aplicada: THREE.Vector3 }
const novoDesvio = (): Desvio => ({ sobe: 0, razao: 1, vs: 0, vr: 0, aplicado: false, desejada: new THREE.Vector3(), aplicada: new THREE.Vector3() });
// amortecimento crítico (21/11/2026): chega ao alvo em ~tempo segundos com a velocidade começando e terminando em zero
// (sem tranco), igual em qualquer taxa de quadros. Antes o desvio ia para o alvo com e^(−10·dt): a câmera saía de uma vez,
// a até 10 m em 0,12 s seguindo de longe, e ia e voltava quando duas soluções parecidas se alternavam
function amortecer(atual: number, alvo: number, d: Desvio, chave: "vs" | "vr", tempo: number, dt: number) {
  if (dt <= 0) return atual;
  const w = 2 / tempo, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dif = atual - alvo, tmp = (d[chave] + w * dif) * dt;
  d[chave] = (d[chave] - w * tmp) * e;
  let s = alvo + (dif + tmp) * e;
  if (alvo - atual > 0 === s > alvo) { s = alvo; d[chave] = 0; } // não passa do alvo
  return s;
}
const PEITO = 0.95; // altura do peito do boneco (m): o raio sai daqui
const FOLGA_CAIXA = 0.3; // o raio passa a pelo menos 30 cm da parede
const PHI_MIN = 0.12; // a câmera sobe no máximo até quase em cima do boneco
let caixasCache: { de: unknown; caixas: Caixa[] } = { de: null, caixas: [] };
function caixasAgora() {
  const t = useMundo.getState().terrenos;
  if (caixasCache.de !== t) caixasCache = { de: t, caixas: caixasDaCidade(t) };
  return caixasCache.caixas;
}
const esfera = new THREE.Spherical(), ponto = new THREE.Vector3();
// para cada subida (0; 0,08; 0,16… rad) a distância livre do raio; fica a de menor custo (subir + chegar perto), com um
// empurrãozinho para ficar perto do desvio atual (sem tremer entre duas posições parecidas)
function melhorDesvio(x: Ctx, andar: boolean, ax = 0, az = 0): { sobe: number; razao: number } {
  const t = x.c.target, d = x.desvio;
  esfera.setFromVector3(ponto.copy(x.camera.position).sub(t));
  const caixas = caixasAgora(), bx = minhaPos.x + ax, bz = minhaPos.z + az;
  const rMin = andar ? 1.7 : 5, pesoSobe = andar ? 1.1 : 0.45, pesoPerto = andar ? 1 : 2.2;
  let melhor = { sobe: 0, razao: 1 }, custo = Infinity, ultimo = { sobe: 0, razao: 1 };
  for (let k = 0; k <= 14; k++) {
    const sobe = k * 0.08, phi = esfera.phi - sobe;
    if (phi < PHI_MIN && k > 0) break;
    ponto.setFromSphericalCoords(esfera.radius, phi, esfera.theta).add(t); ponto.x += ax; ponto.z += az;
    const dist = Math.hypot(ponto.x - bx, ponto.y - PEITO, ponto.z - bz);
    const f = primeiraBatida(caixas, bx, PEITO, bz, ponto.x, ponto.y, ponto.z, FOLGA_CAIXA);
    if (f >= 1 && k === 0) return melhor; // caminho livre: sem desvio
    const r = f >= 1 ? esfera.radius : Math.min(esfera.radius, f * dist - 0.4);
    ultimo = { sobe, razao: Math.max(rMin, r) / esfera.radius };
    if (r < rMin) continue;
    const razao = r / esfera.radius;
    const c = pesoSobe * sobe + pesoPerto * (1 - razao) + 0.3 * (Math.abs(sobe - d.sobe) + Math.abs(razao - d.razao));
    if (c < custo) { custo = c; melhor = { sobe, razao }; }
    if (f >= 1) break; // subir mais só custaria mais
  }
  return custo < Infinity ? melhor : ultimo; // nada livre: o mais alto e o mais perto que dá
}
function desviar(x: Ctx, dt: number) {
  const st = useCamera.getState(), p = usePersonagem.getState(), d = x.desvio;
  const fase = p.predio?.fase;
  const seguindo = (st.seguir || st.andar) && !st.drone && p.ativo && useEscritorio.getState().vista === "fora" && (!fase || fase === "indo");
  const agora = seguindo ? melhorDesvio(x, st.andar) : { sobe: 0, razao: 1 };
  let alvo = agora;
  // 21/11/2026: também onde o boneco vai estar daqui a 0,4 e 0,9 s (a câmera anda junto com ele): começa a desviar antes de
  // o prédio entrar na frente, com calma
  const sg = x.seg;
  if (seguindo && sg.pronto && Math.hypot(sg.vx, sg.vz) > 0.5) for (const h of [0.4, 0.9]) { const f = melhorDesvio(x, st.andar, sg.vx * h, sg.vz * h); alvo = { sobe: Math.max(alvo.sobe, f.sobe), razao: Math.min(alvo.razao, f.razao) }; }
  // escondido agora: vai depressa (~0,25 s); só previsto: com calma (~0,7 s); voltando: devagar (~1,4 s)
  const urgente = agora.sobe > d.sobe + 0.06 || agora.razao < d.razao - 0.06;
  const tIr = urgente ? 0.12 : 0.35, tVoltar = 0.7;
  d.sobe = Math.max(0, amortecer(d.sobe, alvo.sobe, d, "vs", alvo.sobe > d.sobe ? tIr : tVoltar, dt));
  d.razao = Math.min(1, amortecer(d.razao, alvo.razao, d, "vr", alvo.razao < d.razao ? tIr : tVoltar, dt));
  if (d.sobe < 0.002 && d.razao > 0.998 && Math.abs(d.vs) < 0.01 && Math.abs(d.vr) < 0.01) { d.sobe = 0; d.razao = 1; d.vs = 0; d.vr = 0; return; }
  const { camera } = x, t = x.c.target;
  d.desejada.copy(camera.position);
  esfera.setFromVector3(ponto.copy(camera.position).sub(t));
  esfera.phi = Math.max(PHI_MIN, esfera.phi - d.sobe); esfera.radius *= d.razao;
  camera.position.setFromSpherical(esfera).add(t); camera.lookAt(t);
  d.aplicada.copy(camera.position); d.aplicado = true;
}
// começo do quadro: devolve a posição escolhida pela pessoa. Se alguém mexeu na câmera entre um quadro e outro (foto do
// prédio, roteiro de teste, troca de vista), vale a posição nova e o desvio recomeça do zero.
function desfazerDesvio(x: Ctx) {
  const d = x.desvio; if (!d.aplicado) return;
  d.aplicado = false;
  if (x.camera.position.distanceToSquared(d.aplicada) < 1e-8) x.camera.position.copy(d.desejada);
  else { d.sobe = 0; d.razao = 1; d.vs = 0; d.vr = 0; }
}

export function CameraMundo({ controles, inicio }: { controles: React.RefObject<Controles | null>; inicio: { pos: THREE.Vector3; alvo: THREE.Vector3 } }) {
  const { camera, gl, scene } = useThree();
  const ctx = useRef<Ctx | null>(null);
  const pedido = useCamera((s) => s.pedido);
  const drone = useCamera((s) => s.drone);
  const pegar = () => {
    const c = controles.current; if (!c) return null;
    if (!ctx.current) ctx.current = { camera, c, inicio, anim: null, teclas: new Set(), interagindo: false, rota: null, antesAndar: null, andando: false, desvio: novoDesvio(), seg: novoSegue() };
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
    // 21/11/2026: arrastar e a roda fazem os controles do mapa se mexerem na hora do evento (entre um quadro e outro), em
    // cima da posição DESVIADA da câmera; no quadro seguinte o desvio achava que "alguém mexeu na câmera" e o encurtamento
    // ficava para sempre (a câmera grudava a 2 m do boneco depois de girar a vista perto de um prédio). Antes de os
    // controles verem o evento, a câmera volta para a posição escolhida pela pessoa; o desvio é refeito no próximo quadro.
    const antesDosControles = () => desfazerDesvio(x);
    const EVENTOS_CONTROLE = ["pointerdown", "pointermove", "pointerup", "wheel"] as const;
    for (const ev of EVENTOS_CONTROLE) window.addEventListener(ev, antesDosControles, { capture: true, passive: true });
    window.addEventListener("keydown", desce); window.addEventListener("keyup", sobe); window.addEventListener("blur", sai);
    gl.domElement.addEventListener("dblclick", dbl); gl.domElement.addEventListener("pointerdown", toque); gl.domElement.addEventListener("wheel", toque, { passive: true });
    // foto do meu prédio (ui/FotoPredio) usa a mesma câmera e o mesmo desenho
    registrarPonte({ gl, scene, camera: camera as THREE.PerspectiveCamera, controles: x.c, pararModos: () => { if (useCamera.getState().drone) pararDrone(x); if (useCamera.getState().andar) sairAndar(x); useCamera.getState().set({ seguir: false, passeio: false }); x.c.autoRotate = false; x.anim = null; } });
    if (MEDIR) Object.assign(window, { __minhaPos: minhaPos, __fotoPredio: tirarFotoPredio, __camInfo: cameraInfo, __livre: livre, __personagem: usePersonagem, __planta: { porChave: (k: string) => plantaPorChave(k, useMundo.getState().terrenos), livreDentro, dentroDoPredio, paraMundo, zonaNoMundo, podeEntrarEm }, __camera: useCamera, __desvio: x.desvio, __joystick: joystick, __comandoAndar: comandoAndar, __obstaculos: { caixas: caixasAgora, primeiraBatida } });
    // ?drone=1 liga o voo quando a cidade já abriu
    const q = new URLSearchParams(window.location.search);
    const tDrone = q.get("drone") === "1" ? setTimeout(() => { if (!useCamera.getState().drone) useCamera.getState().pedir("drone"); }, 2500) : null;
    return () => {
      x.c.removeEventListener("start", ini); x.c.removeEventListener("end", fim);
      for (const ev of EVENTOS_CONTROLE) window.removeEventListener(ev, antesDosControles, { capture: true });
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
  // antes dos controles do mapa (prioridade -1): a câmera volta para a posição escolhida pela pessoa
  useFrame(() => { const x = pegar(); if (x) desfazerDesvio(x); }, -2);
  useFrame((_, dt) => { const x = pegar(); if (x) { const d = Math.min(dt, 0.1); quadro(x, d); desviar(x, d); extra(x.c).dampingFactor = 1 - Math.pow(1 - 0.08, Math.max(d, 1 / 240) * 60); } });
  return null;
}
