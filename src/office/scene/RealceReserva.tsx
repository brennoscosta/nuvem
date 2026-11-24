"use client";
// Checkout mais curto (WE-07, 21/11/2026): ao abrir o formulário de reserva (ui/Lote.tsx › PainelEmpresa), a câmera vai até
// o lote ou o quiosque e o mapa realça o terreno com a cor escolhida no formulário, com a etiqueta "Lote N". Antes não dava
// para ver qual terreno era o seu. Só vale no formulário de reserva (lote livre, ou reservado e ainda não pago).
//  - o voo é o do modo "Editar posição" (scene/EditorPosicao.tsx): pela ponte da câmera (scene/fotoPredio.ts), 0,9 s com a
//    mesma curva, por cima do terreno e com o terreno fora do painel (gaveta embaixo no celular, painel à direita no
//    computador). Ele espera a câmera parar antes de sair: o cartão do lote acabou de mandá-la deslizar até ele
//    (scene/Cena3D.tsx › FocoCamera) e os dois movimentos não podem brigar;
//  - o realce é o do vizinho ao expandir o terreno (scene/RealceExpansao.tsx): contorno que pulsa, chão tingido e etiqueta.
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { caixa } from "./geo";
import { LOTE, LOTE_POR_CHAVE, LIMITE_CAMERA, frenteDoLote } from "../data/mundo";
import { QUIOSQUE_POR_CHAVE, pegadaQuiosque, rotuloQuiosque } from "../data/quiosques";
import { useMundo } from "../mundoStore";
import { RAIO_MAXIMO } from "../cameraStore";
import { ponteCamera } from "./fotoPredio";

const PAINEL = 352 + 12; // largura do painel no computador mais a margem (ui/estilo.ts › LARGO e FLUTUANTE)
const TAM_QUIOSQUE = 8; // o balcão, os banquinhos e a calçada em volta
// um realce por vez (só existe um formulário aberto): os materiais ficam fora do componente, como no RealceExpansao
const MAT_BORDA = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.95 });
const MAT_CHAO = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false });

// o terreno do formulário de reserva aberto (null fora dele ou depois de pago)
const terrenoDaReserva = (s: ReturnType<typeof useMundo.getState>) => {
  const ch = s.painelEmpresa ? s.loteSelecionado : null;
  if (!ch || s.terrenos[ch]?.status === "ativo") return null;
  return LOTE_POR_CHAVE[ch] || QUIOSQUE_POR_CHAVE[ch] ? ch : null;
};

export function RealceReserva() {
  const chave = useMundo(terrenoDaReserva);
  const cor = useMundo((s) => s.rascunho?.cor ?? "#1D4ED8");
  if (!chave) return null;
  return <><VooAteTerreno key={chave} chave={chave} /><Moldura chave={chave} cor={cor} /></>;
}

interface Voo { dePos: THREE.Vector3; deAlvo: THREE.Vector3; pos: THREE.Vector3; alvo: THREE.Vector3 }
// Enquadramento: de que lado olhar, a que distância e para onde puxar o alvo para o terreno inteiro caber na parte da tela
// que o painel deixa livre (em cima da gaveta no celular, à esquerda do painel no computador). A conta é feita com uma cópia
// da câmera: o deslocamento do alvo sai por bisseção e a distância cresce até os quatro cantos caberem.
function calcularVoo(chave: string, camera: THREE.PerspectiveCamera, alvoAgora: THREE.Vector3, el: HTMLElement): Voo | null {
  const l = LOTE_POR_CHAVE[chave], q = QUIOSQUE_POR_CHAVE[chave];
  const centro = q ? q.pos : l?.centro; if (!centro) return null;
  const tam = q ? TAM_QUIOSQUE : LOTE;
  const W = el.clientWidth, H = el.clientHeight, gaveta = W < 640; // sm do Tailwind: abaixo dele o painel é a gaveta de baixo
  // o tamanho final do painel (offset* não sente a animação de entrada); sem ele, o tamanho máximo (ui/estilo.ts)
  const pn = document.querySelector<HTMLElement>('[data-guia="formulario-reserva"]');
  const faixa = gaveta
    ? { x0: 8, x1: W - 8, y0: H * 0.1, y1: H - 8 - (pn?.offsetHeight ?? H * 0.6) - 8 }
    : { x0: 8, x1: W - 12 - (pn?.offsetWidth ?? PAINEL - 12) - 8, y0: H * 0.1, y1: H - 8 };
  const meio = [(faixa.x0 + faixa.x1) / 2, (faixa.y0 + faixa.y1) / 2];
  const phi = 0.8;
  const C = new THREE.Vector3(centro[0], 0, centro[1]);
  const cam = camera.clone(), alvo = new THREE.Vector3(), v = new THREE.Vector3();
  // o alvo nunca sai do limite da câmera (scene/Cena3D.tsx › FocoCamera o puxaria de volta e o terreno sairia do lugar)
  const limitar = (a: THREE.Vector3) => { a.x = THREE.MathUtils.clamp(a.x, LIMITE_CAMERA.xMin, LIMITE_CAMERA.xMax); a.z = THREE.MathUtils.clamp(a.z, LIMITE_CAMERA.zMin, LIMITE_CAMERA.zMax); return a; };
  const m = tam / 2, cantos = [[-m, -m], [m, -m], [-m, m], [m, m]].map(([dx, dz]) => new THREE.Vector3(C.x + dx, 0, C.z + dz));
  const eixo = gaveta ? 1 : 0;
  // um lado de olhar (th): o deslocamento do alvo e a distância para o terreno caber na faixa livre
  const enquadrar = (th: number) => {
    // gaveta: o alvo vem para o lado da câmera (o terreno sobe na tela); painel à direita: o alvo vai para a direita da tela
    const u = gaveta ? new THREE.Vector3(Math.sin(th), 0, Math.cos(th)) : new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
    const projetar = (dist: number, d: number, pt: THREE.Vector3) => {
      limitar(alvo.copy(C).addScaledVector(u, d));
      cam.position.setFromSphericalCoords(dist, phi, th).add(alvo); cam.lookAt(alvo); cam.updateMatrixWorld();
      v.copy(pt).project(cam); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
    };
    // quanto mais o alvo anda, mais o terreno sobe (gaveta) ou vai para a esquerda (painel à direita)
    const deslocar = (dist: number) => { let a = -dist * 0.5, b = dist * 0.9; for (let i = 0; i < 32; i++) { const md = (a + b) / 2; if (projetar(dist, md, C)[eixo] > meio[eixo]) a = md; else b = md; } return (a + b) / 2; };
    // a distância do editor de posição, ou mais, até os quatro cantos caberem
    let dist = Math.min(RAIO_MAXIMO - 1, tam * (W < H ? 2.6 : 1.75) + 6), d = 0, cabe = false;
    for (let i = 0; i < 10; i++) {
      d = deslocar(dist);
      cabe = cantos.every((pt) => { const [x, y] = projetar(dist, d, pt); return x >= faixa.x0 && x <= faixa.x1 && y >= faixa.y0 && y <= faixa.y1; });
      if (cabe || dist >= RAIO_MAXIMO - 1) break;
      dist = Math.min(RAIO_MAXIMO - 1, dist * 1.15);
    }
    return { th, dist, cabe, alvo: limitar(C.clone().addScaledVector(u, d)) };
  };
  // lado da câmera: o de agora, a não ser que ela esteja a mais de 100° da frente (a rua do lote, o balcão do quiosque).
  // Na beira da cidade o terreno pode não caber por esse lado (o limite segura o alvo): tenta a frente e os outros lados
  const de = new THREE.Spherical().setFromVector3(camera.position.clone().sub(alvoAgora));
  const frente = q ? q.rot : frenteDoLote(l.k);
  const dif = Math.atan2(Math.sin(frente - de.theta), Math.cos(frente - de.theta));
  const th0 = Math.abs(dif) > (100 * Math.PI) / 180 ? frente : de.theta;
  let e = enquadrar(th0);
  for (const th of [frente, th0 + Math.PI / 2, th0 - Math.PI / 2, th0 + Math.PI]) { if (e.cabe) break; const outro = enquadrar(th); if (outro.cabe) e = outro; }
  return { dePos: camera.position.clone(), deAlvo: alvoAgora.clone(), pos: new THREE.Vector3().setFromSphericalCoords(e.dist, phi, e.th).add(e.alvo), alvo: e.alvo };
}

function VooAteTerreno({ chave }: { chave: string }) {
  const { gl } = useThree();
  const est = useRef<{ fase: "espera" | "voo"; t0: number; quietos: number; ultimo: [THREE.Vector3, THREE.Vector3] | null; voo: Voo | null } | null>(null);
  useEffect(() => { est.current = { fase: "espera", t0: performance.now(), quietos: 0, ultimo: null, voo: null }; return () => { est.current = null; }; }, []);
  useFrame(() => {
    const e = est.current, p = ponteCamera(); if (!e || !p) return;
    const camera = p.camera, alvoAgora = p.controles.target;
    if (e.fase === "espera") {
      // parada = dois quadros seguidos sem mexer; no máximo 2,5 s de espera
      const parado = !!e.ultimo && e.ultimo[0].distanceTo(camera.position) < 0.02 && e.ultimo[1].distanceTo(alvoAgora) < 0.02;
      e.quietos = parado ? e.quietos + 1 : 0; e.ultimo = [camera.position.clone(), alvoAgora.clone()];
      if (e.quietos < 2 && performance.now() - e.t0 < 2500) return;
      p.pararModos();
      e.voo = calcularVoo(chave, camera, alvoAgora, gl.domElement);
      if (!e.voo) { est.current = null; return; }
      e.fase = "voo"; e.t0 = performance.now();
    }
    const v = e.voo; if (!v) return;
    const k = Math.min(1, (performance.now() - e.t0) / 900), s = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(v.dePos, v.pos, s); alvoAgora.lerpVectors(v.deAlvo, v.alvo, s); p.controles.update();
    if (k >= 1) est.current = null;
  });
  return null;
}

// contorno que pulsa e chão tingido na cor da marca, com a etiqueta do terreno
function Moldura({ chave, cor }: { chave: string; cor: string }) {
  useEffect(() => { MAT_BORDA.color.set(cor); MAT_BORDA.emissive.set(cor); MAT_CHAO.color.set(cor); }, [cor]);
  useFrame(({ clock }) => { const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2); MAT_BORDA.emissiveIntensity = 0.45 + p * 0.9; MAT_CHAO.opacity = 0.1 + p * 0.14; });
  const l = LOTE_POR_CHAVE[chave], q = QUIOSQUE_POR_CHAVE[chave];
  const m = LOTE / 2 - 0.5;
  const r = q ? pegadaQuiosque() : { x0: -m, x1: m, z0: -m, z1: m };
  const pos = q ? q.pos : l.centro, rot = q ? q.rot : 0, esp = q ? 0.25 : 0.4;
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const tiras = [[cx, r.z0, w + esp, esp], [cx, r.z1, w + esp, esp], [r.x0, cz, esp, d + esp], [r.x1, cz, esp, d + esp]];
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, rot, 0]}>
      {tiras.map(([x, z, a, b], i) => <mesh key={i} geometry={caixa(a, 0.14, b)} material={MAT_BORDA} position={[x, 0.1, z]} />)}
      <mesh geometry={caixa(w, 0.02, d)} material={MAT_CHAO} position={[cx, 0.07, cz]} />
      <Html position={[cx, q ? 4.4 : 6.5, cz]} center zIndexRange={[8, 0]}>
        <div data-realce-reserva={chave} className="pointer-events-none flex w-max select-none items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#1D2128]" style={{ boxShadow: `0 0 0 2px ${cor}, 0 10px 24px rgba(15,23,42,.28)` }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />{q ? `${rotuloQuiosque(q)} · aqui fica o seu balcão` : `Lote ${l.numero} · aqui fica a sua empresa`}
        </div>
      </Html>
    </group>
  );
}
