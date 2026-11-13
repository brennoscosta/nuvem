// Mini-mapa 3D (12/11/2026, v63): a cidade de verdade vista de cima, um pouco inclinada (norte para cima, vê o telhado e
// a fachada sul de cada prédio). A cena desenha essa vista de tempos em tempos (scene/MiniMapaRender) direto num canvas
// do painel (ui/MiniMapa); por cima, a interface põe nomes, lojas e a câmera com a MESMA projeção definida aqui.
import * as THREE from "three";
import { useSyncExternalStore } from "react";

// enquadramento fixo: de x = -94 a 94 e do Parque da Cidade (z ≈ -144) até a praia (z ≈ 96); 50° mostra o telhado e
// a fachada sul dos prédios sem esconder as ruas
const ELEVACAO = (50 * Math.PI) / 180; // ângulo da câmera com o chão
export const MAPA = { cx: 0, cz: -24, metadeL: 94, metadeA: 98, sen: Math.sin(ELEVACAO), cos: Math.cos(ELEVACAO) };
export const PROPORCAO = MAPA.metadeL / MAPA.metadeA; // largura / altura da imagem

// ponto do mundo → posição na imagem (0..1, de cima para baixo)
export function projetar(x: number, y: number, z: number) {
  const sx = x - MAPA.cx, sy = y * MAPA.cos - (z - MAPA.cz) * MAPA.sen;
  return { u: (sx / MAPA.metadeL + 1) / 2, v: (1 - sy / MAPA.metadeA) / 2 };
}
// posição na imagem → ponto no chão (na altura y, ex.: 4 m para cair no meio dos prédios)
export function noChao(u: number, v: number, y = 0) {
  const sx = (u * 2 - 1) * MAPA.metadeL, sy = (1 - v * 2) * MAPA.metadeA;
  return { x: MAPA.cx + sx, z: MAPA.cz - (sy - y * MAPA.cos) / MAPA.sen };
}
export function cameraDoMapa() {
  const c = new THREE.OrthographicCamera(-MAPA.metadeL, MAPA.metadeL, MAPA.metadeA, -MAPA.metadeA, 1, 2000);
  const alvo = new THREE.Vector3(MAPA.cx, 0, MAPA.cz);
  c.position.set(MAPA.cx, MAPA.sen * 800, MAPA.cz + MAPA.cos * 800);
  c.up.set(0, 1, 0); c.lookAt(alvo); c.updateMatrixWorld(true); c.updateProjectionMatrix();
  return c;
}

// ---------- ponte entre a cena e o painel ----------
// o painel registra o canvas onde a imagem é desenhada e diz se está à vista; a cena desenha e avisa (versão).
const estado = { canvas: null as HTMLCanvasElement | null, visivel: false, versao: 0, pedido: 0 };
const ouvintes = new Set<() => void>();
const avisar = () => { for (const f of ouvintes) f(); };
export const miniMapa = {
  registrar(c: HTMLCanvasElement | null) { estado.canvas = c; },
  canvas: () => estado.canvas,
  setVisivel(v: boolean) { if (estado.visivel !== v) { estado.visivel = v; if (v) estado.pedido++; } },
  visivel: () => estado.visivel,
  // pede um desenho já (abriu o painel, a cidade mudou)
  pedir() { estado.pedido++; },
  pedido: () => estado.pedido,
  desenhado() { estado.versao++; avisar(); },
};
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const useVersaoMiniMapa = () => useSyncExternalStore(assinar, () => estado.versao, () => 0);
