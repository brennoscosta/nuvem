"use client";
// A cena 3D (o Canvas): escritório da Nuvem e, no WorkEnd, a cidade. Carregada à parte por scene/Cena, que escolhe
// entre ela e o mapa simples em 2D (aparelho sem WebGL ou fraco demais).
// 12/11/2026: a qualidade se ajusta durante o uso (mede os quadros por segundo; se travar, tira a resolução extra, depois
// as sombras, depois limita a 30 quadros; nunca sobe sozinha) e um aviso mostra quanto da cidade já carregou.
import { Icone } from "../ui/Icone";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRodaNoCanvas } from "./roda";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { MapControls, PerformanceMonitor, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Predio } from "./Predio";
import { Mundo } from "./Mundo";
import { MUNDO, LIMITE_CAMERA } from "../data/mundo";
import { Fachada } from "./Fachada";
import { CameraMundo } from "./CameraMundo";
import { CicloDia } from "./CicloDia";
import { Acabamento, TOM_PROPRIO } from "./Acabamento";
import { MiniMapaRender } from "./MiniMapaRender";
import { precarregarCidade } from "./Modelos";
import { Agente, handlers } from "./Agente";
import { qualidade, qualidadeManual, lembrarLeveAuto, escolherQualidade, escolherMapa, cairPara2D } from "./qualidade";
import { useEscritorio } from "../store";
import { useMundo, modoMundo } from "../mundoStore";
import { MESA } from "../data/layout";
import type { Evento } from "../data/eventos";
import { useCartaoAberto } from "../ui/cartaoAberto";
import { RAIO_MAXIMO } from "../cameraStore";
import { edicaoAtiva } from "../edicaoStore";

// Entrega os eventos da fila pros agentes
function Despachante() {
  const consumir = useEscritorio((s) => s.consumirEventos);
  const pendentes = useRef<{ ev: Evento; ate: number }[]>([]);
  useFrame(() => {
    const agora = performance.now();
    const lista = [...pendentes.current.map((p) => p.ev), ...consumir()];
    pendentes.current = [];
    for (const ev of lista) {
      const h = handlers.get(ev.agenteId);
      if (h) h(ev);
      else if (useEscritorio.getState().agentes[ev.agenteId]) pendentes.current.push({ ev, ate: agora + 5000 }); // agente ainda montando
    }
    pendentes.current = pendentes.current.filter((p) => p.ate > agora);
  });
  return null;
}

// Enquadramentos (prédio de 18 x 18 m): por dentro, de cima e um pouco de lado; por fora, mais baixo e afastado
const CAM_DENTRO = { pos: new THREE.Vector3(8, 23, 28), alvo: new THREE.Vector3(0, 0, 0.5) };
const CAM_FORA = { pos: new THREE.Vector3(12, 15, 32), alvo: new THREE.Vector3(0, 2, 1) };
// No mundo do WorkEnd a entrada é uma vista aérea do bairro (a Nuvem é só uma das lojas)
const CAM_MUNDO = { pos: new THREE.Vector3(34, 42, 74), alvo: new THREE.Vector3(2, 0, 12) };
// ?cam=x,y,z,tx,ty,tz posiciona a câmera (usado nas prévias)
const CAM = (() => { if (typeof window === "undefined") return null; const v = new URLSearchParams(window.location.search).get("cam"); if (!v) return null; const n = v.split(",").map(Number); return n.length === 6 ? n : null; })();
// Celular em pé: a tela é estreita, então abre o ângulo e afasta um pouco pra o prédio inteiro caber na largura
const RETRATO = typeof window !== "undefined" && window.innerWidth < window.innerHeight;
const FOV = RETRATO ? Math.min(52, (32 / (window.innerWidth / window.innerHeight)) * 0.7) : 32;
if (RETRATO) { CAM_DENTRO.pos.multiplyScalar(1.2); CAM_FORA.pos.multiplyScalar(1.15); CAM_MUNDO.pos.multiplyScalar(1.2); }
const CAM_PADRAO = typeof window !== "undefined" && modoMundo() ? CAM_MUNDO : CAM_DENTRO;
const CAM_INICIAL = CAM ? { pos: [CAM[0], CAM[1], CAM[2]] as [number, number, number], alvo: [CAM[3], CAM[4], CAM[5]] as [number, number, number] } : { pos: CAM_PADRAO.pos.toArray() as [number, number, number], alvo: CAM_PADRAO.alvo.toArray() as [number, number, number] };
// até onde o centro da tela pode ir ao arrastar (não deixa a câmera escapar do mundo e ver a borda dos painéis)
// 12/11/2026: ao norte vai até o Parque da Cidade (LIMITE_CAMERA em data/mundo.ts); no escritório da Nuvem, o de sempre
const LIMITE = typeof window !== "undefined" && modoMundo() ? LIMITE_CAMERA : { xMin: -(MUNDO.x - 22), xMax: MUNDO.x - 22, zMin: -(MUNDO.z - 22), zMax: MUNDO.z - 22 };

// v67: assim que o 3D carrega, a cidade pede todos os modelos dela juntos (antes saíam em fila, um após o outro)
if (typeof window !== "undefined" && modoMundo()) precarregarCidade();

const DESLOCA = new THREE.Vector3();
const ESFERA = new THREE.Spherical();
const RAIO_SEDE = 36; // distância máxima da câmera ao abrir uma sede (a volta em arco de FocoCamera)
// Quando o usuário seleciona um agente, a câmera desliza até a mesa dele; trocar de vista reenquadra
function FocoCamera({ controles }: { controles: React.RefObject<any> }) {
  const selecionado = useEscritorio((s) => s.selecionado);
  const alvo = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const a = selecionado ? useEscritorio.getState().agentes[selecionado] : null;
    if (!a) { alvo.current = null; return; }
    const m = MESA[a.mesaId]; alvo.current = new THREE.Vector3(m.pos[0], m.pos[1] + 0.5, m.pos[2]);
  }, [selecionado]);
  const vista = useEscritorio((s) => s.vista);
  const posAlvo = useRef<THREE.Vector3 | null>(null);
  const volta = useRef<{ t0: number; de: THREE.Spherical; ate: number; raio: number; alvoDe: THREE.Vector3; alvoAte: THREE.Vector3 } | null>(null);
  const primeira = useRef(true);
  // lote clicado no mapa: a câmera desliza (arrasta) até ele, mantendo a altura e o ângulo
  const alvoLote = useMundo((s) => s.alvoCamera);
  const { camera } = useThree();
  useEffect(() => {
    if (!alvoLote) return;
    const c = controles.current; if (!c) return;
    const t = c.target as THREE.Vector3;
    const novo = new THREE.Vector3(...alvoLote);
    const d = novo.clone().sub(t);
    alvo.current = novo; posAlvo.current = camera.position.clone().add(d);
    // sede virada para outro lado (19/11/2026, cada sede num lote, de frente para a rua dela): se a câmera estiver olhando
    // pelas costas do prédio (mais de 100° de diferença), ela dá a volta em arco (sem atravessar a torre) e olha de frente,
    // na mesma altura; de longe, chega mais perto (a sede e a planta por dentro ficaram menores)
    const giro = useMundo.getState().giroCamera;
    if (giro != null) {
      const de = new THREE.Spherical().setFromVector3(camera.position.clone().sub(t));
      const dif = Math.atan2(Math.sin(giro - de.theta), Math.cos(giro - de.theta)), virar = Math.abs(dif) > (100 * Math.PI) / 180;
      const raio = Math.min(de.radius, RAIO_SEDE);
      if (de.radius > 0.5 && (virar || raio < de.radius - 0.5)) {
        volta.current = { t0: performance.now(), de, ate: de.theta + (virar ? dif : 0), raio, alvoDe: t.clone(), alvoAte: novo };
        alvo.current = null; posAlvo.current = null;
      }
    }
    useMundo.getState().limparAlvo();
  }, [alvoLote, camera, controles]);
  useEffect(() => {
    if (primeira.current || CAM) { primeira.current = false; return; } // não mexe na câmera inicial nem nas prévias (?cam)
    // só reenquadra se o usuário estiver olhando a Nuvem; longe dela (num lote, na lanchonete) a câmera fica onde está
    const t = controles.current?.target as THREE.Vector3 | undefined;
    if (t && (Math.abs(t.x) > 24 || Math.abs(t.z) > 24)) return;
    const c = vista === "fora" ? (modoMundo() ? CAM_MUNDO : CAM_FORA) : CAM_DENTRO;
    alvo.current = c.alvo.clone(); posAlvo.current = c.pos.clone();
  }, [vista, controles]);
  useFrame(({ camera }, dt) => {
    const c = controles.current; if (!c) return;
    // a volta em arco até a frente de uma sede (1 s): o alvo desliza e a câmera gira em volta dele
    const v = volta.current;
    if (v) {
      const k = Math.min(1, (performance.now() - v.t0) / 1000), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      (c.target as THREE.Vector3).lerpVectors(v.alvoDe, v.alvoAte, e);
      ESFERA.set(v.de.radius + (v.raio - v.de.radius) * e, v.de.phi, v.de.theta + (v.ate - v.de.theta) * e);
      camera.position.setFromSpherical(ESFERA).add(c.target as THREE.Vector3);
      c.update();
      if (k >= 1) volta.current = null;
      return;
    }
    if (posAlvo.current) { camera.position.lerp(posAlvo.current, Math.min(1, dt * 3)); if (camera.position.distanceTo(posAlvo.current) < 0.1) posAlvo.current = null; }
    if (alvo.current) { c.target.lerp(alvo.current, Math.min(1, dt * 3)); if (c.target.distanceTo(alvo.current) < 0.05) alvo.current = null; }
    // trava o arrasto dentro do terreno (move câmera e alvo juntos)
    const t = c.target as THREE.Vector3;
    // no modo "Editar posição" (frente editor, 21/11/2026) a câmera fica em cima do terreno, mesmo na beira da orla
    const solta = edicaoAtiva();
    const dx = solta ? 0 : THREE.MathUtils.clamp(t.x, LIMITE.xMin, LIMITE.xMax) - t.x, dz = solta ? 0 : THREE.MathUtils.clamp(t.z, LIMITE.zMin, LIMITE.zMax) - t.z;
    if (dx || dz) { const d = DESLOCA.set(dx, 0, dz); t.add(d); camera.position.add(d); }
    if (posAlvo.current || alvo.current || dx || dz) c.update();
  });
  return null;
}

// Sombras "assadas": o mapa de sombras é recalculado só de vez em quando (quem anda não projeta sombra; usa a
// mancha de contato). Economiza um passe inteiro de desenho por quadro. O mundo é grande, então a área com sombra
// acompanha o ponto que o usuário está olhando: quando ele arrasta pra longe, a luz muda de lugar e refaz.
// 18/11/2026 (acabamento): a área também acompanha o zoom (de perto ±20 m, bem nítida; de longe até ±85 m, cobrindo o que
// aparece na tela, com o texel do mapa do tamanho de um pixel no chão), anda um pouco para o fundo da tela (a parte de cima
// mostra mais chão), fica presa à grade de texels (a borda não "anda" entre um refazer e outro) e some aos poucos na borda
// (Acabamento). A luz fica longe (180 m): as torres altas das sedes não são mais cortadas pelo plano de perto da câmera de
// sombra. O viés acompanha o tamanho do texel (sem "acne" no chão e sem sombra descolada do pé dos prédios).
const MAPA_SOMBRA = 2048;
const S = { centro: new THREE.Vector3(), frente: new THREE.Vector3(), dir: new THREE.Vector3(), dirFeita: new THREE.Vector3(), dx: new THREE.Vector3(), dy: new THREE.Vector3(), centroFeito: new THREE.Vector3(1e9, 0, 0), meiaFeita: 0 };
const CIMA = new THREE.Vector3(0, 1, 0);
// fora do componente: a luz e a câmera são objetos do three.js, não estado do React. Diz se a área de sombra mudou.
function encaixarSombra(l: THREE.DirectionalLight, camera: THREE.Camera, alvo: THREE.Vector3, forcar: boolean) {
  // 20/11/2026: com a câmera até 155 m, a área vai até ±100 m (texel de ~10 cm, do tamanho de um pixel no chão lá de cima)
  const meia = THREE.MathUtils.clamp(camera.position.distanceTo(alvo) * 0.62, 20, 100);
  S.frente.set(alvo.x - camera.position.x, 0, alvo.z - camera.position.z);
  const fl = S.frente.length(); if (fl > 1e-3) S.frente.multiplyScalar((meia * 0.3) / fl);
  S.centro.set(alvo.x, 0, alvo.z).add(S.frente);
  // direção do sol (o CicloDia ajusta pela hora): a posição da luz menos o alvo
  S.dir.copy(l.position).sub(l.target.position).normalize();
  const mudou = Math.abs(meia - S.meiaFeita) > S.meiaFeita * 0.18 || S.centro.distanceTo(S.centroFeito) > Math.max(6, meia * 0.2) || S.dir.angleTo(S.dirFeita) > 0.012;
  if (!mudou && !forcar) return false;
  S.meiaFeita = meia; S.centroFeito.copy(S.centro); S.dirFeita.copy(S.dir);
  const texel = (2 * meia) / MAPA_SOMBRA;
  // prende o centro à grade de texels no plano da luz
  S.dx.crossVectors(CIMA, S.dir).normalize(); S.dy.crossVectors(S.dir, S.dx);
  const u = Math.round(S.centro.dot(S.dx) / texel) * texel, v = Math.round(S.centro.dot(S.dy) / texel) * texel, w = S.centro.dot(S.dir);
  S.centro.copy(S.dx).multiplyScalar(u).addScaledVector(S.dy, v).addScaledVector(S.dir, w);
  const c = l.shadow.camera;
  c.left = -meia; c.right = meia; c.top = meia; c.bottom = -meia; c.near = 1; c.far = 420; c.updateProjectionMatrix();
  l.position.copy(S.centro).addScaledVector(S.dir, 180); l.target.position.copy(S.centro); l.target.updateMatrixWorld();
  l.shadow.normalBias = texel * 1.6; l.shadow.bias = -0.00004;
  return true;
}
function SombrasFixas({ luz, controles }: { luz: React.RefObject<THREE.DirectionalLight | null>; controles: React.RefObject<any> }) {
  const vista = useEscritorio((s) => s.vista);
  const prox = useRef(0);
  const vistaFeita = useRef<string | null>(null);
  // modelos e fontes chegam aos poucos: refaz a sombra a cada 1 s nos primeiros 12 s, depois a cada 5 s e quando a vista muda
  useFrame(({ gl, clock, camera }) => {
    gl.shadowMap.autoUpdate = false;
    const t = clock.elapsedTime;
    // qualidade baixada durante o uso: a sombra só é refeita quando a câmera anda ou a vista muda (sem o refazer periódico)
    let refaz = (!sombraEconomica && t >= prox.current) || vistaFeita.current !== vista;
    const l = luz.current, alvo = controles.current?.target as THREE.Vector3 | undefined;
    if (l && alvo && encaixarSombra(l, camera, alvo, refaz)) refaz = true;
    if (refaz) { gl.shadowMap.needsUpdate = true; prox.current = t + (t < 12 ? 1 : 5); vistaFeita.current = vista; }
  });
  return null;
}

// Modo leve: no máximo 30 quadros por segundo (a cena anda e a navegação continua lisa, gastando metade)
function Limite30() {
  useEffect(() => {
    let id = 0, ultimo = 0;
    // advance() com frameloop "never" usa o número como clock.elapsedTime: tem de ser em SEGUNDOS (12/11/2026). Em milissegundos
    // a água, os pássaros e tudo que usa clock.elapsedTime andavam 1000× mais rápido no modo leve, e o trânsito 3× (dt preso em 0,1).
    const loop = (t: number) => { id = requestAnimationFrame(loop); if (t - ultimo < 1000 / 30 - 3) return; ultimo = t; advance(t / 1000); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

// ?medir=1: expõe o renderer em window.__cena pra medir draw calls nas prévias (scripts/medir.mjs)
function Medidor() {
  const gl = useThree((s) => s.gl), cena = useThree((s) => s.scene);
  useEffect(() => { const w = window as unknown as { __cena?: unknown; __cenaObjetos?: unknown }; w.__cena = gl; w.__cenaObjetos = cena; }, [gl, cena]);
  return null;
}
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");

// ---------- qualidade durante o uso ----------
// ?simularfps=12 finge que o aparelho está rodando a 12 quadros por segundo (para testar a queda)
const SIMULAR_FPS = (() => { if (typeof window === "undefined") return null; const v = Number(new URLSearchParams(window.location.search).get("simularfps")); return v > 0 ? v : null; })();
// Plano B (WE-20, 22/11/2026): já nos gráficos leves e com a cidade carregada, 5 s abaixo de 20 quadros por segundo levam ao
// mapa simples (scene/qualidade › cairPara2D). Com ?mapa=3d (a pessoa pediu o 3D de novo) a lentidão só avisa, como antes.
// O navegador de robô dos testes desenha sem placa de vídeo, a menos de 1 quadro por segundo: só cai com ?queda2d=1.
const QUEDA_POR_LENTIDAO = (() => {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return q.get("mapa") !== "3d" && (navigator.webdriver !== true || q.get("queda2d") === "1");
})();
// nível: 0 = completo; 1 = resolução 1x e sombra sem refazer periódico; 2 = também no máximo 30 quadros por segundo (igual aos gráficos leves)
function QualidadeViva({ nivel, maximo, aoBaixar, aoTravar, aoCair }: { nivel: number; maximo: number; aoBaixar: (n: number) => void; aoTravar: () => void; aoCair: () => void }) {
  const k = useRef({ quadros: 0, desde: 0, inicio: 0, ruins: 0, avisou: false, lentas: 0, lentoDesde: 0 });
  // quando o último modelo chegou: a cidade só conta como carregada 3 s depois (os materiais novos ainda compilam)
  const carga = useRef(0);
  const carregando = useProgress((s) => s.active);
  useEffect(() => { carga.current = carregando ? Infinity : performance.now(); }, [carregando]);
  useFrame(() => {
    const agora = performance.now(), x = k.current;
    if (!x.inicio) { x.inicio = agora; x.desde = agora; }
    x.quadros++;
    if (agora - x.desde < 1000) return;
    const fps = SIMULAR_FPS ?? (x.quadros * 1000) / (agora - x.desde);
    const comeco = x.desde; // início desta medida
    x.quadros = 0; x.desde = agora;
    // os primeiros 10 s são de carregamento (modelos chegando travam de verdade) e aba escondida não conta
    if (agora - x.inicio < 10000 || document.visibilityState !== "visible") { x.ruins = 0; x.lentas = 0; return; }
    // plano B: pelo menos 2 medidas seguidas abaixo de 20, somando 5 s (um tropeço só, de um quadro longo, não derruba)
    if (QUEDA_POR_LENTIDAO && nivel >= 2 && fps < 20 && comeco - carga.current >= 3000) {
      if (!x.lentas++) x.lentoDesde = comeco;
      if (x.lentas >= 2 && agora - x.lentoDesde >= 5000) { x.lentas = 0; aoCair(); return; }
    } else x.lentas = 0;
    if (fps < (nivel >= 2 ? 18 : 24)) x.ruins++; else x.ruins = 0;
    if (x.ruins < 5) return; // 5 segundos seguidos ruins
    x.ruins = 0; x.inicio = agora - 7000; // espera 3 s antes de julgar o nível novo
    if (nivel < maximo) aoBaixar(nivel + 1);
    else if (!x.avisou) { x.avisou = true; aoTravar(); }
  });
  return null;
}
// 1º degrau da queda (12/11/2026, na integração): resolução 1x e sombra sem o refazer periódico. NÃO desliga a sombra nem
// recompila os materiais com a cena aberta: as árvores de rua (cor por instância) e as fachadas (sombreador próprio)
// sumiam depois da recompilação. Sem sombra mesmo, só na próxima visita (fica marcado como leve). Fora do componente:
// o renderer é objeto do three.js, não estado do React.
let sombraEconomica = false;
function desligarSombras(gl: THREE.WebGLRenderer) {
  if (sombraEconomica) return;
  sombraEconomica = true;
  if (gl.getPixelRatio() > 1) gl.setPixelRatio(1);
}
// Plano B (WE-20): o aparelho perdeu o contexto do WebGL (faltou memória de vídeo e a cena fica preta). Se ele não voltar em
// 2 s com a aba à vista, a cidade vai para o mapa simples (ou, para quem chegou por link de loja, para a página da loja).
// Com a aba escondida a conta espera: o celular costuma soltar o contexto em segundo plano e devolver quando a pessoa volta.
function VigiaContexto() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const tela = gl.domElement;
    let t = 0, perdido = false;
    const contar = () => { window.clearTimeout(t); if (perdido && document.visibilityState === "visible") t = window.setTimeout(() => { if (perdido) cairPara2D("contexto", useMundo.getState().terrenos); }, 2000); };
    const perdeu = () => { perdido = true; contar(); };
    const voltou = () => { perdido = false; window.clearTimeout(t); };
    tela.addEventListener("webglcontextlost", perdeu);
    tela.addEventListener("webglcontextrestored", voltou);
    document.addEventListener("visibilitychange", contar);
    return () => { window.clearTimeout(t); tela.removeEventListener("webglcontextlost", perdeu); tela.removeEventListener("webglcontextrestored", voltou); document.removeEventListener("visibilitychange", contar); };
  }, [gl]);
  return null;
}
function AplicarNivel({ nivel }: { nivel: number; luz?: React.RefObject<THREE.DirectionalLight | null> }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => { if (nivel >= 1) desligarSombras(gl); }, [nivel, gl]);
  return null;
}
// quanto da cidade já chegou (modelos 3D): some quando termina
function Progresso() {
  const { active, progress, total } = useProgress();
  const [visto, setVisto] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setVisto(true), 600); return () => clearTimeout(t); } }, [active]);
  if (!active || !visto || total < 3) return null;
  return (
    <div className="hud-ilha pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 !rounded-2xl px-4 py-2 text-[12.5px] font-semibold" role="status">
      Montando a cidade… {Math.round(progress)}%
      <span className="mt-1 block h-1 w-36 overflow-hidden rounded-full bg-white/20"><span className="block h-1 rounded-full bg-[#5B9DFF] transition-[width] duration-300" style={{ width: `${Math.max(6, progress)}%` }} /></span>
    </div>
  );
}
function AvisoQualidade({ tipo, aoFechar }: { tipo: "baixou" | "travou"; aoFechar: () => void }) {
  useEffect(() => { if (tipo !== "baixou") return; const t = setTimeout(aoFechar, 9000); return () => clearTimeout(t); }, [tipo, aoFechar]);
  // com cartão ou editor aberto o aviso espera: no celular ele cobria o topo deles (17/11/2026)
  const cartao = useCartaoAberto();
  if (cartao) return null;
  return (
    <div className="hud-ilha pointer-events-auto absolute left-1/2 top-40 z-20 w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 p-3.5 text-[12.5px] sm:bottom-24 sm:top-auto" role="status">
      {tipo === "baixou" ? (
        <div className="flex items-center gap-3">
          <span className="flex-1">Deixei os gráficos mais leves para o mapa andar liso neste aparelho.</span>
          <button onClick={() => escolherQualidade("alta")} className="hud-btn !h-8 shrink-0 bg-white/15 !text-[12px]"><Icone nome="brilho" tamanho={15} />Voltar aos completos</button>
          <button onClick={aoFechar} aria-label="Fechar" className="hud-btn hud-btn-icone !h-8 !w-8 shrink-0"><Icone nome="fechar" tamanho={15} /></button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 font-bold"><Icone nome="raio" tamanho={16} className="text-[#FACC15]" />O mapa 3D está pesado neste aparelho</div>
          <div className="mt-0.5 text-white/75">O mapa simples mostra as mesmas lojas, em 2D, e abre na hora.</div>
          {/* 21/11/2026: no celular estreito os dois botões não cabem lado a lado: quebram em duas linhas, cada um na largura toda */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => escolherMapa("2d")} className="hud-btn hud-azul !h-9 flex-1 justify-center"><Icone nome="camadas" tamanho={16} />Usar o mapa simples</button>
            <button onClick={aoFechar} className="hud-btn !h-9 flex-1 justify-center bg-white/10">Continuar no 3D</button>
          </div>
        </>
      )}
    </div>
  );
}

function Luzes({ sombras, luz, hemi, preench }: { sombras: boolean; luz: React.RefObject<THREE.DirectionalLight | null>; hemi: React.RefObject<THREE.HemisphereLight | null>; preench: React.RefObject<THREE.DirectionalLight | null> }) {
  return (
    <>
      <hemisphereLight ref={hemi} args={["#FFFFFF", "#CDD3DB", 0.9]} />
      <directionalLight
        ref={luz}
        position={[12, 22, 10]} intensity={2.2} color="#FFF6E8" castShadow={sombras}
        // modo completo (12/11/2026): sombra em 2048 cobrindo ±32 m (antes 1024 em ±26 m): mais nítida e mais longe.
        // 18/11/2026: área, viés e distância da luz passam a ser ajustados pelo SombrasFixas conforme o zoom; raio 2,5 texels
        shadow-mapSize={sombras ? [MAPA_SOMBRA, MAPA_SOMBRA] : [1024, 1024]} shadow-bias={-0.00004} shadow-normalBias={0.05} shadow-radius={sombras ? 2.5 : 4}
        shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-near={1} shadow-camera-far={420}
      />
      <directionalLight ref={preench} position={[-14, 10, -8]} intensity={0.5} color="#DCE8FF" />
    </>
  );
}

export function Cena3D() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const controles = useRef<any>(null);
  const luz = useRef<THREE.DirectionalLight | null>(null);
  const hemi = useRef<THREE.HemisphereLight | null>(null);
  const preench = useRef<THREE.DirectionalLight | null>(null);
  const leveInicial = qualidade() === "leve";
  // a queda automática respeita quem escolheu "Gráficos completos" no botão
  const [nivel, setNivel] = useState(leveInicial ? 2 : 0);
  const maximo = qualidadeManual() === "alta" ? 0 : 2;
  const [aviso, setAviso] = useState<"baixou" | "travou" | null>(null);
  const leve = leveInicial || nivel >= 2;
  // alta: resolução até 1,5x, baixa pra 1x se o computador não der conta (PerformanceMonitor); leve: sempre 1x
  const maxDpr = leve || nivel >= 1 ? 1 : Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [dprMonitor, setDpr] = useState(maxDpr);
  const dpr = Math.min(dprMonitor, maxDpr);
  const fecharAviso = useCallback(() => setAviso(null), []);
  const baixar = (n: number) => { setNivel(n); setAviso("baixou"); if (n >= 2) lembrarLeveAuto(); };
  useRodaNoCanvas(); // zoom com a roda em qualquer lugar da tela (barra, botões, crachás, balões)
  const cam = CAM_INICIAL;
  return (
    <>
    <Canvas
      dpr={dpr}
      frameloop={leve ? "never" : "always"}
      shadows={leveInicial ? false : { enabled: true, type: THREE.PCFShadowMap }}
      // 20/11/2026: longe 420 → 560 m (a câmera vai 30% mais longe; a névoa do CicloDia some com tudo antes disso)
      camera={{ position: cam.pos, fov: FOV, near: 0.5, far: 560 }}
      // curva de tom própria no mapa da cidade (Acabamento; a exposição o CicloDia ajusta pela hora)
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: TOM_PROPRIO && modoMundo() ? THREE.CustomToneMapping : THREE.ACESFilmicToneMapping }}
      onPointerMissed={() => { useEscritorio.getState().selecionar(null); if (!useMundo.getState().painelEmpresa) useMundo.getState().selecionarLote(null); }}>
      <color attach="background" args={["#CFE3F5"]} />
      <fog attach="fog" args={["#CFE3F5", 140, 360]} />
      {modoMundo() && <QualidadeViva nivel={nivel} maximo={maximo} aoBaixar={baixar} aoTravar={() => setAviso("travou")} aoCair={() => cairPara2D("lento", useMundo.getState().terrenos)} />}
      {modoMundo() && <VigiaContexto />}
      <AplicarNivel nivel={nivel} luz={luz} />
      {leve ? <Limite30 /> : (
        <>
          {/* no 1º degrau da queda a sombra continua acompanhando a câmera (só perde o refazer periódico); antes ela parava onde estava */}
          <SombrasFixas luz={luz} controles={controles} />
          {/* só reage a queda sustentada (abaixo de 35 fps): os tropeços do carregamento não contam */}
          <PerformanceMonitor bounds={() => [35, 55]} flipflops={4} onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} onFallback={() => setDpr(1)} />
        </>
      )}
      <Luzes sombras={!leveInicial} luz={luz} hemi={hemi} preench={preench} />
      {modoMundo() && <CicloDia luzes={{ hemi, sol: luz, preench }} />}
      {modoMundo() && !leveInicial && <Acabamento hemi={hemi} preench={preench} />}
      {/* v67: cada parte com o próprio limite de carregamento. O letreiro em texto 3D da Nuvem (<Text> do drei) suspende até
          gerar as letras; no mesmo limite, ele segurava a cidade inteira (o mundo só aparecia ~30 s depois num celular) */}
      <Suspense fallback={null}><Mundo /></Suspense>
      <Suspense fallback={null}><Predio /></Suspense>
      <Suspense fallback={null}><Fachada /></Suspense>
      <Suspense fallback={null}>{ordem.map((id) => agentes[id] && <Agente key={id} def={agentes[id]} />)}</Suspense>
      <Despachante />
      {MEDIR && <Medidor />}
      <MapControls ref={controles} target={cam.alvo} minDistance={4} maxDistance={RAIO_MAXIMO} minPolarAngle={0.35} maxPolarAngle={1.25} dampingFactor={0.08} enableDamping />
      <FocoCamera controles={controles} />
      {modoMundo() && <CameraMundo controles={controles} inicio={CAM_MUNDO} />}
      {modoMundo() && <MiniMapaRender />}
    </Canvas>
    {modoMundo() && <Progresso />}
    {aviso && <AvisoQualidade tipo={aviso} aoFechar={fecharAviso} />}
    </>
  );
}
