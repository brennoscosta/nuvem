"use client";
// Foto do meu prédio (12/11/2026): enquadra o prédio do lote de frente, um pouco de lado e de cima, desenha a cena em
// 1920 × 1080 (sem a interface; os balões são da página, não do desenho 3D) e baixa um PNG pronto para postar.
// A cena registra aqui o desenhador e a câmera (scene/CameraMundo); a interface chama tirarFotoPredio (ui/FotoPredio).
import * as THREE from "three";
import { useMundo } from "../mundoStore";
import { useHora, type ModoHora } from "../cameraStore";
import { LOTE_POR_CHAVE, frenteDoLote } from "../data/mundo";
import { LAYOUT, alturaPredio } from "../data/escritorio";
import { ehKit } from "../data/predios";
import { ceu } from "./CicloDia";

interface Ponte { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controles: { target: THREE.Vector3; update(): void }; pararModos: () => void }
let ponte: Ponte | null = null;
// ?medir=1: a ponte também fica em window.__ponte (scripts de conferência movem a câmera sem recarregar a página)
const MEDIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir");
export function registrarPonte(p: Ponte | null) { ponte = p; if (MEDIR) (window as unknown as { __ponte?: Ponte | null }).__ponte = p; }
export type HoraFoto = "agora" | "dia" | "noite";
export const LARGURA_FOTO = 1920, ALTURA_FOTO = 1080;
const DUPLO_ALTURA = 1.2; // o prédio do lote duplo é 20% mais alto (scene/EscritorioCliente)

const quadro = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nomeArquivo = (t: string) => `workend-${t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meu-predio"}.png`;

// enquadramento: centro do prédio (no lote duplo, o meio dos dois terrenos), a frente dele e a altura
export function enquadramento(chave: string) {
  const terrenos = useMundo.getState().terrenos;
  let t = terrenos[chave]; if (t?.anexoDe) t = terrenos[t.anexoDe] ?? t;
  const l = t ? LOTE_POR_CHAVE[t.chave] : LOTE_POR_CHAVE[chave]; if (!l) return null;
  const anexo = t ? Object.values(terrenos).find((x) => x.anexoDe === t.chave && x.status === "ativo") : null;
  const la = anexo ? LOTE_POR_CHAVE[anexo.chave] : null;
  const cx = la ? (l.centro[0] + la.centro[0]) / 2 : l.centro[0], cz = l.centro[1];
  const giro = t?.escritorio?.decor?.giro ?? 0, giroEf = la ? giro - (giro % 2) : giro;
  const rot = frenteDoLote(l.k) + Math.PI + giroEf * (Math.PI / 2);
  const e = t?.escritorio;
  const altura = e && ehKit(e.layout) ? alturaPredio(e, !!la) : (e ? LAYOUT[e.layout]?.altura ?? 9 : 7) * (la ? DUPLO_ALTURA : 1);
  // a frente local do prédio é -z: girada por rot, vira (-sen rot, -cos rot) no mapa; a foto vem de três quartos (28°)
  const a = rot + 0.49, dist = Math.max(27, altura * 2.5) * (la ? 1.4 : 1);
  const alvo = new THREE.Vector3(cx, altura * 0.42, cz);
  const pos = new THREE.Vector3(cx - Math.sin(a) * dist, altura * 0.75 + 5, cz - Math.cos(a) * dist);
  return { alvo, pos, nome: t?.empresaNome ?? `Lote ${l.numero}` };
}

export async function tirarFotoPredio(chave: string, hora: HoraFoto = "agora"): Promise<{ ok: true; arquivo: string } | { ok: false; erro: string }> {
  const p = ponte; if (!p) return { ok: false, erro: "O mapa 3D ainda não abriu. Espere a cidade aparecer e tente de novo." };
  const q = enquadramento(chave); if (!q) return { ok: false, erro: "Lote não encontrado." };
  const { gl, scene, camera, controles } = p;
  // guarda tudo para devolver do jeito que estava
  const antes = { pos: camera.position.clone(), alvo: controles.target.clone(), fov: camera.fov, aspect: camera.aspect, hora: useHora.getState().modo, sel: useMundo.getState().loteSelecionado, dpr: gl.getPixelRatio(), tam: gl.getSize(new THREE.Vector2()) };
  const aviso = document.createElement("div");
  aviso.textContent = "📸 Preparando a foto do prédio…";
  Object.assign(aviso.style, { position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", zIndex: "2147483000", background: "rgba(17,20,24,.92)", color: "#fff", font: "600 13px Inter, system-ui, sans-serif", padding: "8px 14px", borderRadius: "999px", pointerEvents: "none" });
  document.body.appendChild(aviso);
  try {
    p.pararModos();
    // sem a moldura de lote selecionado no chão
    useMundo.setState({ loteSelecionado: null, loteHover: null });
    camera.position.copy(q.pos); controles.target.copy(q.alvo); camera.fov = 32; camera.updateProjectionMatrix(); controles.update();
    if (hora !== "agora") {
      useHora.setState({ modo: hora as ModoHora });
      const alvo = hora === "dia" ? 0 : 1;
      for (let i = 0; i < 80 && Math.abs(ceu.noite - alvo) > 0.02; i++) await espera(60); // o céu muda devagar
    }
    // dá tempo de os quarteirões perto aparecerem e de a sombra ser refeita no lugar novo
    gl.shadowMap.needsUpdate = true;
    for (let i = 0; i < 4; i++) await quadro();
    await espera(400);
    camera.position.copy(q.pos); controles.target.copy(q.alvo); controles.update();
    // desenha em 1920 × 1080 no próprio canvas e copia na hora (o desenho do WebGL some no quadro seguinte)
    gl.setPixelRatio(1); gl.setSize(LARGURA_FOTO, ALTURA_FOTO, false);
    camera.aspect = LARGURA_FOTO / ALTURA_FOTO; camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
    gl.render(scene, camera);
    const blob = await new Promise<Blob | null>((r) => gl.domElement.toBlob(r, "image/png"));
    if (!blob) return { ok: false, erro: "O navegador não conseguiu gerar a imagem." };
    const arquivo = nomeArquivo(q.nome);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = arquivo; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { ok: true, arquivo };
  } catch (e) {
    return { ok: false, erro: (e as Error).message || "Não deu para tirar a foto agora." };
  } finally {
    gl.setPixelRatio(antes.dpr); gl.setSize(antes.tam.x, antes.tam.y, false);
    camera.fov = antes.fov; camera.aspect = antes.aspect; camera.updateProjectionMatrix();
    camera.position.copy(antes.pos); controles.target.copy(antes.alvo); controles.update();
    if (hora !== "agora") useHora.setState({ modo: antes.hora });
    useMundo.setState({ loteSelecionado: antes.sel });
    aviso.remove();
  }
}
