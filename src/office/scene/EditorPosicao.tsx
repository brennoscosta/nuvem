"use client";
// Modo "Editar posição" na cena (21/11/2026, estilo RollerCoaster Tycoon e SimCity; o estado é office/edicaoStore.ts):
//  - a câmera vai para cima do terreno, olhando pela frente do prédio;
//  - grade de 0,5 m no chão do terreno, com a beira marcada; o contorno do prédio no chão e a seta da porta;
//  - o caminho da porta até a calçada (verde) quando a posição vale;
//  - o prédio vira fantasma: verde se vale, vermelho se não vale (useFantasma, nas cenas de cada prédio);
//  - arrastar o prédio com o mouse ou um dedo (começando em cima dele; fora dele a câmera continua andando), encaixando
//    na grade; R e Shift+R giram; as setas ajustam 0,5 m na direção da tela; Enter confirma; Esc cancela.
// Nada disto existe fora da edição (a grade e o fantasma não pesam no mapa).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useEdicao } from "../edicaoStore";
import { ponteCamera } from "./fotoPredio";
import type { PosePredio, Ponto } from "../data/posicaoPredio";

const VERDE = "#22C55E", VERMELHO = "#EF4444";
const MAT_FANTASMA = { ok: new THREE.MeshStandardMaterial({ color: VERDE, emissive: VERDE, emissiveIntensity: 0.35, transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.6 }),
  ruim: new THREE.MeshStandardMaterial({ color: VERMELHO, emissive: VERMELHO, emissiveIntensity: 0.4, transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.6 }) };
type Guardado = { mat: THREE.Material | THREE.Material[]; sombra: boolean };

// O grupo do prédio em edição segue a pose do rascunho a cada quadro (sem desenhar de novo); fora da edição volta para a
// pose de sempre (base). mapa: da pose do rascunho para [x, z, rot] do grupo (no lote, o grupo é relativo ao centro do lote).
// estrutura (lote em quartos, 21/11/2026): qual parte do lote este grupo desenha ("predio" ou o id do quiosque); fora do lote
// em quartos fica null, e a edição do terreno vale para o prédio de sempre
export const editandoEsta = (chave: string, estrutura: string | null) => { const s = useEdicao.getState(); return s.chave === chave && (s.estrutura ?? null) === estrutura; };
export function usePoseAoVivo(ref: React.RefObject<THREE.Object3D | null>, chave: string, base: [number, number, number], mapa: (p: PosePredio) => [number, number, number], estrutura: string | null = null) {
  const ultimo = useRef<string>("");
  useFrame(() => {
    const g = ref.current; if (!g) return;
    const s = useEdicao.getState(), v = editandoEsta(chave, estrutura) && s.pose ? mapa(s.pose) : base;
    const k = v.join(","); if (k === ultimo.current) return; ultimo.current = k;
    g.position.x = v[0]; g.position.z = v[1]; g.rotation.y = v[2];
  });
}
// O prédio em edição vira fantasma (todas as malhas com um material verde ou vermelho translúcido, sem sombra); ao sair da
// edição o material de cada malha volta. Confere a cada 10 quadros (pega o que o prédio montar depois).
export function useFantasma(ref: React.RefObject<THREE.Object3D | null>, chave: string, estrutura: string | null = null) {
  const n = useRef(0), aplicado = useRef(false), ultimo = useRef("");
  useFrame(() => {
    const g = ref.current; if (!g) return;
    const s = useEdicao.getState(), ativo = editandoEsta(chave, estrutura), estado = `${ativo}|${!!s.conf?.ok}`;
    // na hora em que entra, sai ou troca de cor; e a cada 10 quadros, para pegar o que o prédio montar depois
    if (estado === ultimo.current && (n.current++ % 10) !== 0) return;
    ultimo.current = estado;
    if (!ativo && !aplicado.current) return;
    const mat = s.conf?.ok ? MAT_FANTASMA.ok : MAT_FANTASMA.ruim;
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const u = m.userData as { __fantasma?: Guardado };
      if (ativo) { if (!u.__fantasma) u.__fantasma = { mat: m.material, sombra: m.castShadow }; m.material = mat; m.castShadow = false; }
      else if (u.__fantasma) { m.material = u.__fantasma.mat; m.castShadow = u.__fantasma.sombra; delete u.__fantasma; }
    });
    aplicado.current = ativo;
  });
}

// direção na tela (cima, baixo, esquerda, direita) virada para o eixo do mundo mais perto, pela câmera de agora
export function direcaoNaTela(d: "cima" | "baixo" | "esq" | "dir"): Ponto {
  const p = ponteCamera(); if (!p) return d === "cima" ? [0, -1] : d === "baixo" ? [0, 1] : d === "esq" ? [-1, 0] : [1, 0];
  const f = new THREE.Vector3().subVectors(p.controles.target, p.camera.position); f.y = 0; f.normalize();
  const fx = Math.abs(f.x) > Math.abs(f.z) ? Math.sign(f.x) : 0, fz = fx ? 0 : Math.sign(f.z) || -1; // frente da tela no chão
  const rx = -fz, rz = fx; // direita da tela
  return d === "cima" ? [fx, fz] : d === "baixo" ? [-fx, -fz] : d === "dir" ? [rx, rz] : [-rx, -rz];
}
export const moverNaTela = (d: "cima" | "baixo" | "esq" | "dir") => { const [x, z] = direcaoNaTela(d); useEdicao.getState().mover(x * 0.5, z * 0.5); };

export function EditorPosicao3D() {
  const chave = useEdicao((s) => s.chave);
  if (!chave) return null;
  return <Editor key={chave} />;
}

function Editor() {
  const pose = useEdicao((s) => s.pose), conf = useEdicao((s) => s.conf);
  const { gl, camera } = useThree();
  const tr = pose?.terreno;
  // ---- câmera em cima do terreno, pela frente do prédio (desliza em 0,9 s) ----
  const voo = useRef<{ t0: number; dePos: THREE.Vector3; deAlvo: THREE.Vector3; pos: THREE.Vector3; alvo: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const p = ponteCamera(), s = useEdicao.getState().pose; if (!p || !s) return;
    p.pararModos();
    const r = s.terreno.ret, w = r.x1 - r.x0, d = r.z1 - r.z0, alvo = new THREE.Vector3((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    const retrato = gl.domElement.clientWidth < gl.domElement.clientHeight;
    const dist = Math.max(w, d) * (retrato ? 2.6 : 1.75) + 6, phi = 0.62; // ~35° do alto
    const f = s.frente, th = Math.atan2(f[0], f[1]); // a câmera fica do lado da porta
    // celular em pé: a gaveta do painel cobre a metade de baixo; o alvo vem para o lado da câmera e o terreno sobe na tela
    if (retrato) alvo.add(new THREE.Vector3(Math.sin(th), 0, Math.cos(th)).multiplyScalar(dist * 0.26));
    const pos = new THREE.Vector3().setFromSphericalCoords(dist, phi, th).add(alvo);
    voo.current = { t0: performance.now(), dePos: camera.position.clone(), deAlvo: p.controles.target.clone(), pos, alvo };
  }, [camera, gl]);
  useFrame(() => {
    const v = voo.current, p = ponteCamera(); if (!v || !p) return;
    const k = Math.min(1, (performance.now() - v.t0) / 900), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(v.dePos, v.pos, e); p.controles.target.lerpVectors(v.deAlvo, v.alvo, e); p.controles.update();
    if (k >= 1) voo.current = null;
  });
  // ---- teclas (antes da câmera: capture no window e para a propagação) ----
  useEffect(() => {
    const desce = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const s = useEdicao.getState(), k = ev.key.toLowerCase();
      const usar = () => { ev.preventDefault(); ev.stopImmediatePropagation(); };
      if (k === "r") { usar(); if (!ev.repeat) s.girar(ev.shiftKey ? 1 : -1); }
      else if (k === "escape") { usar(); s.cancelar(); }
      else if (k === "enter") { usar(); void s.confirmar(); }
      else if (k === "arrowup") { usar(); moverNaTela("cima"); } else if (k === "arrowdown") { usar(); moverNaTela("baixo"); }
      else if (k === "arrowleft") { usar(); moverNaTela("esq"); } else if (k === "arrowright") { usar(); moverNaTela("dir"); }
    };
    window.addEventListener("keydown", desce, true);
    return () => window.removeEventListener("keydown", desce, true);
  }, []);
  // ---- arrastar o prédio (eventos do próprio canvas, antes dos controles do mapa) ----
  useEffect(() => {
    const el = gl.domElement, ray = new THREE.Raycaster(), chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
    const noChao = (ev: PointerEvent) => { const r = el.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera); return ray.ray.intersectPlane(chao, pt) ? [pt.x, pt.z] as Ponto : null; };
    let ativo: { id: number; ofs: Ponto; base: Ponto } | null = null, dedos = 0;
    const solta = (ev: PointerEvent) => {
      dedos = Math.max(0, dedos - 1);
      if (!ativo || ev.pointerId !== ativo.id) return;
      ativo = null; useEdicao.getState().setArrastando(false);
      const p = ponteCamera() as unknown as { controles: { enabled: boolean } } | null; if (p) p.controles.enabled = true;
      try { el.releasePointerCapture(ev.pointerId); } catch { /* já solto */ }
    };
    const desce = (ev: PointerEvent) => {
      dedos++;
      if (ev.button !== 0 && ev.pointerType === "mouse") return;
      if (dedos > 1) { if (ativo) { useEdicao.getState().colocar(ativo.base); solta(ev); } return; } // dois dedos: é a câmera
      const s = useEdicao.getState(); if (!s.pose) return;
      const q = noChao(ev); if (!q) return;
      const c = s.pose.caixa, m = 0.8;
      if (q[0] < c.x0 - m || q[0] > c.x1 + m || q[1] < c.z0 - m || q[1] > c.z1 + m) return; // fora do prédio: a câmera anda
      ev.preventDefault(); ev.stopImmediatePropagation();
      ativo = { id: ev.pointerId, ofs: [q[0] - s.pose.centro[0], q[1] - s.pose.centro[1]], base: [...s.desloc] };
      s.setArrastando(true);
      const p = ponteCamera() as unknown as { controles: { enabled: boolean } } | null; if (p) p.controles.enabled = false;
      try { el.setPointerCapture(ev.pointerId); } catch { /* sem captura */ }
    };
    const anda = (ev: PointerEvent) => {
      if (!ativo || ev.pointerId !== ativo.id) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const s = useEdicao.getState(), q = noChao(ev); if (!q || !s.pose) return;
      const c = s.pose.terreno.centro;
      s.colocar([q[0] - ativo.ofs[0] - c[0], q[1] - ativo.ofs[1] - c[1]]);
    };
    // o clique que termina um arrasto não vira "andar até lá" nem abre o cartão de outro lote
    const clique = (ev: MouseEvent) => { if (useEdicao.getState().arrastando) { ev.stopImmediatePropagation(); ev.preventDefault(); } };
    el.addEventListener("pointerdown", desce, true); window.addEventListener("pointermove", anda, true);
    window.addEventListener("pointerup", solta, true); window.addEventListener("pointercancel", solta, true); el.addEventListener("click", clique, true);
    return () => {
      el.removeEventListener("pointerdown", desce, true); window.removeEventListener("pointermove", anda, true);
      window.removeEventListener("pointerup", solta, true); window.removeEventListener("pointercancel", solta, true); el.removeEventListener("click", clique, true);
      const p = ponteCamera() as unknown as { controles: { enabled: boolean } } | null; if (p) p.controles.enabled = true;
      useEdicao.getState().setArrastando(false);
    };
  }, [gl, camera]);
  if (!pose || !tr) return null;
  return (
    <group>
      <Grade ret={tr.ret} />
      <Contorno ret={tr.ret} cor="#FFFFFF" y={0.1} espessura={0.16} />
      {/* lote em quartos (21/11/2026): a divisão em quatro quartos e o lugar onde a estrutura encaixa (amarelo) */}
      {pose.estrutura && tr.limite && (
        <>
          <Contorno ret={{ x0: (tr.ret.x0 + tr.ret.x1) / 2 - 0.04, x1: (tr.ret.x0 + tr.ret.x1) / 2 + 0.04, z0: tr.ret.z0, z1: tr.ret.z1 }} cor="#FFFFFF" y={0.1} espessura={0.1} />
          <Contorno ret={{ x0: tr.ret.x0, x1: tr.ret.x1, z0: (tr.ret.z0 + tr.ret.z1) / 2 - 0.04, z1: (tr.ret.z0 + tr.ret.z1) / 2 + 0.04 }} cor="#FFFFFF" y={0.1} espessura={0.1} />
          <Contorno ret={tr.limite} cor="#FACC15" y={0.11} espessura={0.14} />
        </>
      )}
      <Contorno ret={pose.caixa} cor={conf?.ok ? VERDE : VERMELHO} y={0.12} espessura={0.12} preenche />
      <SetaPorta pose={pose} ok={!!conf?.ok} />
      {conf?.ok && conf.trilha.length > 1 && <Caminho pts={[...conf.trilha, ...(conf.fora ? [conf.fora] : [])]} />}
    </group>
  );
}

// grade de 0,5 m (a cada 2 m, mais forte): uma malha de linhas só
function Grade({ ret }: { ret: { x0: number; x1: number; z0: number; z1: number } }) {
  const geo = useMemo(() => {
    const pos: number[] = [], cor: number[] = [], y = 0.085;
    const fraca = new THREE.Color("#FFFFFF").multiplyScalar(0.55), forte = new THREE.Color("#FFFFFF");
    const linha = (ax: number, az: number, bx: number, bz: number, c: THREE.Color) => { pos.push(ax, y, az, bx, y, bz); cor.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    for (let x = ret.x0; x <= ret.x1 + 1e-6; x += 0.5) linha(x, ret.z0, x, ret.z1, Math.abs(((x - ret.x0) / 2) % 1) < 1e-6 ? forte : fraca);
    for (let z = ret.z0; z <= ret.z1 + 1e-6; z += 0.5) linha(ret.x0, z, ret.x1, z, Math.abs(((z - ret.z0) / 2) % 1) < 1e-6 ? forte : fraca);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
    return g;
  }, [ret.x0, ret.x1, ret.z0, ret.z1]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <lineSegments geometry={geo} renderOrder={5}><lineBasicMaterial vertexColors transparent opacity={0.55} depthWrite={false} /></lineSegments>;
}
// retângulo no chão (4 tiras numa malha só), com o miolo translúcido se pedido
function Contorno({ ret, cor, y, espessura, preenche = false }: { ret: { x0: number; x1: number; z0: number; z1: number }; cor: string; y: number; espessura: number; preenche?: boolean }) {
  const geo = useMemo(() => {
    const w = ret.x1 - ret.x0, d = ret.z1 - ret.z0, cx = (ret.x0 + ret.x1) / 2, cz = (ret.z0 + ret.z1) / 2, e = espessura;
    const partes = [[cx, ret.z0, w + e, e], [cx, ret.z1, w + e, e], [ret.x0, cz, e, d + e], [ret.x1, cz, e, d + e]].map(([x, z, a, b]) => new THREE.PlaneGeometry(a, b).rotateX(-Math.PI / 2).translate(x, y, z));
    const g = mergeSimples(partes); partes.forEach((p) => p.dispose()); return g;
  }, [ret.x0, ret.x1, ret.z0, ret.z1, y, espessura]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group renderOrder={6}>
      <mesh geometry={geo}><meshBasicMaterial color={cor} toneMapped={false} depthWrite={false} transparent opacity={0.95} /></mesh>
      {preenche && <mesh position={[(ret.x0 + ret.x1) / 2, y - 0.005, (ret.z0 + ret.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[ret.x1 - ret.x0, ret.z1 - ret.z0]} /><meshBasicMaterial color={cor} transparent opacity={0.16} depthWrite={false} toneMapped={false} /></mesh>}
    </group>
  );
}
function mergeSimples(gs: THREE.BufferGeometry[]) {
  const pos: number[] = []; for (const g of gs) { const ng = g.index ? g.toNonIndexed() : g; const a = ng.attributes.position.array; for (let i = 0; i < a.length; i++) pos.push(a[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); return g;
}
// seta no chão, na frente da porta (ou do balcão), apontando para fora
function SetaPorta({ pose, ok }: { pose: PosePredio; ok: boolean }) {
  const ang = Math.atan2(pose.frente[0], pose.frente[1]);
  const geo = useMemo(() => { const s = new THREE.Shape(); s.moveTo(-0.7, 0); s.lineTo(0.7, 0); s.lineTo(0, 1.3); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); return g; }, []);
  return <mesh geometry={geo} position={[pose.porta[0], 0.14, pose.porta[1]]} rotation={[0, ang, 0]} renderOrder={7}><meshBasicMaterial color={ok ? VERDE : VERMELHO} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} transparent opacity={0.95} /></mesh>;
}
// o caminho da porta até a calçada (tracejado de pontinhos)
function Caminho({ pts }: { pts: Ponto[] }) {
  const pontos = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) { const [a, b] = [pts[i - 1], pts[i]], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(d / 0.7)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
    out.push(pts[pts.length - 1]); return out;
  }, [pts]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current; if (!m) return; const o = new THREE.Object3D();
    pontos.forEach(([x, z], i) => { o.position.set(x, 0.13, z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.count = pontos.length; m.instanceMatrix.needsUpdate = true;
  }, [pontos]);
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, pontos.length)]} renderOrder={7}><circleGeometry args={[0.16, 10]} /><meshBasicMaterial color={VERDE} toneMapped={false} depthWrite={false} transparent opacity={0.95} /></instancedMesh>;
}
