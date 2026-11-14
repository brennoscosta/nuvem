"use client";
// Desenha a vista do mini-mapa (12/11/2026, v63). Quando o painel abre, quando a cidade muda (loja, vaga, promoção),
// quando o dia vira noite e, fora isso, a cada 15 s (30 s no modo leve) — o mapa não precisa de cada carro andando: a
// câmera e o meu personagem andam por cima, na interface. O desenho sai ANTES do quadro normal,
// com a câmera fixa do mapa (src/office/miniMapa.ts), num cantinho do próprio canvas, e é copiado na hora
// para o canvas do painel. O quadro normal vem logo depois e cobre o cantinho: ninguém vê.
// Por que no próprio canvas e não num "render target": desenhar num render target muda a saída de cor (sem tom e linear)
// e o three.js compilaria uma segunda versão de cada material. Aqui os materiais são os mesmos do quadro normal.
// Nada fica mexido: viewport, recorte, fundo, neblina e o que foi escondido voltam ao que eram.
import { etapaAtual } from "./etapas";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { cameraDoMapa, miniMapa } from "../miniMapa";
import { leve } from "./qualidade";
import { useEscritorio } from "../store";
import { ceu } from "./CicloDia";

const V2 = new THREE.Vector2(), VP = new THREE.Vector4(), SC = new THREE.Vector4(), COR = new THREE.Color();
const FUNDO_MAPA = new THREE.Color("#1B222B");
// o que não entra no mapa: céu e estrelas (renderOrder < 0) e a chuva com os respingos (renderOrder ≥ 4)
const fora = (o: THREE.Object3D) => o.renderOrder < 0 || o.renderOrder >= 4;
// ?medir=1: quanto custa cada desenho do mapa (window.__miniMapa) e o desenho de um quadro normal, para comparar
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
const medida = { vezes: 0, ultimoMs: 0, somaMs: 0, chamadas: 0 };
if (MEDIR && typeof window !== "undefined") (window as unknown as { __miniMapa?: typeof medida }).__miniMapa = medida;

function desenhar(gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, destino: HTMLCanvasElement) {
  const ctx = destino.getContext("2d"); if (!ctx) return false;
  const buf = gl.getDrawingBufferSize(V2), pr = gl.getPixelRatio();
  const prop = destino.width / destino.height;
  // o tamanho do desenho cabe no canvas da tela (no celular a tela pode ser menor que a imagem)
  const w = Math.floor(Math.min(destino.width, buf.x, buf.y * prop)), h = Math.floor(w / prop);
  if (w < 96 || h < 96) return false;
  const escondidos: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.visible && o !== scene && fora(o)) { o.visible = false; escondidos.push(o); } });
  const fog = scene.fog as THREE.Fog | null, fogPerto = fog?.near ?? 0, fogLonge = fog?.far ?? 0;
  const bg = scene.background instanceof THREE.Color ? COR.copy(scene.background) : null;
  gl.getViewport(VP); gl.getScissor(SC); const recorte = gl.getScissorTest(), alvo = gl.getRenderTarget();
  try {
    if (fog) { fog.near = 1e5; fog.far = 2e5; } // a neblina só troca de valor: nada recompila
    if (scene.background instanceof THREE.Color) scene.background.copy(FUNDO_MAPA);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, w / pr, h / pr); gl.setScissor(0, 0, w / pr, h / pr); gl.setScissorTest(true);
    gl.render(scene, cam);
    // o desenho do WebGL vale até o próximo quadro: copia já (canto de baixo à esquerda do canvas)
    ctx.drawImage(gl.domElement, 0, buf.y - h, w, h, 0, 0, destino.width, destino.height);
    return true;
  } finally {
    gl.setRenderTarget(alvo); gl.setViewport(VP); gl.setScissor(SC); gl.setScissorTest(recorte);
    if (fog) { fog.near = fogPerto; fog.far = fogLonge; }
    if (bg && scene.background instanceof THREE.Color) scene.background.copy(bg);
    for (const o of escondidos) o.visible = true;
  }
}

export function MiniMapaRender() {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene);
  const cam = useMemo(() => cameraDoMapa(), []);
  const k = useRef({ prox: 0, pedido: -1, noite: -1, inicio: 0, ultimo: 0, carregando: true, desenhou: false, preparo: 0 as 0 | 1 | 2 });
  // a cidade terminou de chegar (modelos 3D): desenha de novo, senão o 1º desenho fica sem os prédios
  const carregando = useProgress((s) => s.active);
  useEffect(() => { k.current.carregando = carregando; if (!carregando) miniMapa.pedir(); }, [carregando]);
  // prioridade negativa: roda ANTES do desenho normal do quadro (que cobre o cantinho usado aqui)
  // relógio do navegador em segundos: o da cena conta em milissegundos no modo leve (quadros a mão, frameloop "never")
  useFrame(() => {
    const t = performance.now() / 1000, x = k.current;
    const pedido = miniMapa.pedido();
    if (!x.inicio) { x.inicio = t; x.prox = t + 3; }
    if (t - x.inicio < 3) return; // nos primeiros segundos ainda não tem cidade para desenhar
    // o 1º desenho espera os modelos chegarem (desenhar no meio do carregamento só atrasa a cidade), no máximo 20 s
    if (!x.desenhou && x.carregando && t - x.inicio < 20) return;
    // v67: nada antes da cidade inteira chegar (etapa 2) nem com o painel fechado (no celular ele começa fechado):
    // o preparo compila os materiais da cena toda e, sem placa de vídeo boa, atrasava o 1º quadro da cidade
    if (etapaAtual() < 2 || !miniMapa.visivel()) { x.prox = Math.max(x.prox, t + 1); return; }
    // antes do 1º desenho, prepara (em paralelo, sem travar a tela) os materiais das partes que a câmera ainda não viu
    if (x.preparo === 0) { x.preparo = 1; gl.compileAsync(scene, cam).catch(() => {}).finally(() => { x.preparo = 2; }); return; }
    if (x.preparo === 1) return;
    // pedido novo (painel abriu, cidade mudou, terminou de carregar) espera um intervalo mínimo entre um desenho e outro:
    // o "terminou de carregar" acende e apaga a cada logo e foto que chega
    if (t - x.ultimo < (leve() ? 6 : 2.5)) return;
    const virouNoite = x.noite >= 0 && Math.abs(ceu.noite - x.noite) > 0.2;
    if (t < x.prox && pedido === x.pedido && !virouNoite) return;
    const destino = miniMapa.canvas();
    // painel fechado, aba escondida ou vista "por dentro" (os prédios abrem): espera e confere de novo daqui a 1 s
    if (!destino || !miniMapa.visivel() || document.visibilityState !== "visible" || useEscritorio.getState().vista !== "fora") { x.prox = t + 1; return; }
    x.pedido = pedido; x.noite = ceu.noite; x.ultimo = t; x.desenhou = true; x.prox = t + (leve() ? 30 : 15);
    const t0 = MEDIR ? performance.now() : 0;
    if (desenhar(gl, scene, cam, destino)) {
      miniMapa.desenhado();
      if (MEDIR) { const ms = performance.now() - t0; medida.vezes++; medida.ultimoMs = ms; medida.somaMs += ms; medida.chamadas = gl.info.render.calls; }
    }
  }, -1);
  return null;
}
