"use client";
// Personagens dos visitantes no mapa: o meu (ando clicando no chão; mando a posição a cada 3 s) e os outros online
// (chegam na batida; deslizam até a posição nova). Todo personagem tem um balãozinho com o nome; clicar num outro
// abre a ficha com as opções (conversa, chat ao vivo, negócios, redes sociais).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle } from "./Boneco";
import { SombraContato } from "./SombraContato";
import { TODOS_BONECOS, BONECOS } from "../data/bonecos";
import { MUNDO, passeioNaCalcada, pontoNaCalcada } from "../data/mundo";
import { usePersonagem, minhaPos, type Outro } from "../personagemStore";
import { modoMundo } from "../mundoStore";

const VEL = 2.2; // m/s (um pouco mais rápido que os pedestres)
const VEL_PASSEIO = 1.0; // quando passeia sozinho, anda no ritmo dos outros pedestres
const PAUSA_PASSEIO = 9; // s parado antes de sair passeando pela calçada
const def = (id: string) => TODOS_BONECOS[id] ?? BONECOS[1];

function Nome({ nome, cor, eu = false, online = true, onClick }: { nome: string; cor: string; eu?: boolean; online?: boolean; onClick?: () => void }) {
  return (
    <Html position={[0, 1.5, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex w-max select-none flex-col items-center" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <div className={`pointer-events-auto flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold leading-none shadow-md ${onClick ? "cursor-pointer" : ""} ${eu ? "bg-[#1D4ED8] text-white" : "bg-white/95 text-[#1D2128]"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[#16A34A]" : "bg-[#9AA3AD]"}`} />{nome}{eu && <span className="text-[8px] font-black uppercase text-white/70">você</span>}
        </div>
        <div className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent ${eu ? "border-t-[#1D4ED8]" : "border-t-white/95"}`} />
      </div>
    </Html>
  );
}

// Meu boneco: anda até o destino clicado com arranque e freada suaves; a posição viva fica em `minhaPos` (sem
// re-render por quadro); a câmera não segue (o mapa é livre), mas o botão com meu nome na barra centraliza em mim.
function Meu() {
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const destino = usePersonagem((s) => s.destino);
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const vel = useRef(0); // velocidade atual (m/s), acelera e freia
  const paradoDesde = useRef(0); // 0 = marca na primeira frame; passeia sozinho depois de um tempo parado
  const fase = useMemo(() => 1.3, []);
  useAnimacao(h, () => (vel.current > 0.15 ? "walk" : "idle"), fase, HIPS.procedural.base);
  // posição inicial: a salva no servidor (encostada na calçada, nunca no meio da rua)
  useEffect(() => { if (g.current && meu) { const [x, z] = pontoNaCalcada(meu.x, meu.z); g.current.position.set(x, 0, z); g.current.rotation.y = meu.rot; usePersonagem.getState().setPosicao(x, z, meu.rot); } }, [meu?.usuarioId, ativo]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const o = g.current; if (!o) return; dt = Math.min(dt, 0.1);
    const st = usePersonagem.getState();
    if (!destino) {
      vel.current = Math.max(0, vel.current - 8 * dt);
      if (!paradoDesde.current) paradoDesde.current = performance.now();
      // como um pedestre comum: depois de um tempo parado, dá uma volta pela calçada (um clique no chão interrompe)
      if (performance.now() - paradoDesde.current > PAUSA_PASSEIO * 1000 && st.painel !== "chat") { paradoDesde.current = performance.now(); usePersonagem.setState({ destino: passeioNaCalcada(o.position.x, o.position.z), passeio: true }); st.avisarMovimento(); }
      minhaPos.vel = 0; return;
    }
    const dx = destino[0] - o.position.x, dz = destino[1] - o.position.z; const dist = Math.hypot(dx, dz);
    const velMax = st.passeio ? VEL_PASSEIO : VEL;
    // freia nos últimos 60 cm, acelera no resto
    const alvo = dist < 0.6 ? Math.max(0.5, velMax * (dist / 0.6)) : velMax;
    vel.current = vel.current < alvo ? Math.min(alvo, vel.current + 6 * dt) : Math.max(alvo, vel.current - 8 * dt);
    if (dist < 0.06) {
      o.position.set(destino[0], 0, destino[1]); vel.current = 0; minhaPos.vel = 0;
      paradoDesde.current = performance.now() - (st.passeio ? PAUSA_PASSEIO * 400 : 0);
      usePersonagem.setState({ destino: null, passeio: false }); st.setPosicao(o.position.x, o.position.z, o.rotation.y); st.avisarMovimento();
      return;
    }
    const p = Math.min(dist, vel.current * dt); o.position.x += (dx / dist) * p; o.position.z += (dz / dist) * p;
    const r = Math.atan2(dx, dz); let d = r - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 12);
    minhaPos.x = o.position.x; minhaPos.z = o.position.z; minhaPos.rot = o.rotation.y; minhaPos.vel = vel.current;
  });
  if (!meu || !ativo) return null;
  const b = def(meu.boneco);
  return (
    <group ref={g}>{/* posição só via ref: passar position= aqui faria o boneco pular de volta a cada re-render */}
      <BonecoProcedural ref={h} def={b} camisa={meu.roupa} cracha="#FFD166" />
      <SombraContato r={0.36} />
      <Nome nome={meu.nome} cor={meu.roupa} eu />
    </group>
  );
}

// Outro personagem online: anda sozinho rumo ao destino que veio na batida, na velocidade dele (não fica parado
// esperando a próxima atualização); se a posição do servidor divergir muito, corrige suavemente.
function OutroBoneco({ o }: { o: Outro }) {
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const srv = useRef({ x: o.x, z: o.z, rot: o.rot, destino: o.destino ?? null, vel: o.vel ?? 0 });
  const vel = useRef(0);
  const fase = useMemo(() => (o.usuarioId.charCodeAt(o.usuarioId.length - 1) % 10) / 3, [o.usuarioId]);
  useEffect(() => { const g0 = g.current; if (g0) { g0.position.set(o.x, 0, o.z); g0.rotation.y = o.rot; } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    srv.current = { x: o.x, z: o.z, rot: o.rot, destino: o.destino ?? null, vel: o.vel ?? 0 };
    // divergiu demais (teleporte, aba que ficou parada): pula pra posição do servidor
    const g0 = g.current; if (g0 && Math.hypot(o.x - g0.position.x, o.z - g0.position.z) > 6) { g0.position.set(o.x, 0, o.z); g0.rotation.y = o.rot; }
  }, [o.x, o.z, o.rot, o.destino, o.vel]);
  useAnimacao(h, () => (vel.current > 0.15 ? "walk" : "idle"), fase, HIPS.procedural.base);
  useFrame((_, dt) => {
    const g0 = g.current; if (!g0) return; dt = Math.min(dt, 0.1);
    const s = srv.current;
    // alvo: o destino dele (se está andando) ou a posição que o servidor conhece
    const alvoX = s.destino ? s.destino[0] : s.x, alvoZ = s.destino ? s.destino[1] : s.z;
    const dx = alvoX - g0.position.x, dz = alvoZ - g0.position.z; const dist = Math.hypot(dx, dz);
    const velMax = s.destino ? Math.max(0.6, s.vel || VEL) : Math.min(VEL, Math.max(0.8, dist / 1.5)); // sem destino: só corrige a diferença
    const alvoV = dist < 0.05 ? 0 : dist < 0.6 ? Math.max(0.4, velMax * (dist / 0.6)) : velMax;
    vel.current = vel.current < alvoV ? Math.min(alvoV, vel.current + 6 * dt) : Math.max(alvoV, vel.current - 8 * dt);
    if (dist > 0.05) {
      const p = Math.min(dist, vel.current * dt); g0.position.x += (dx / dist) * p; g0.position.z += (dz / dist) * p;
      const r = Math.atan2(dx, dz); let d = r - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 12);
    } else { vel.current = 0; let d = s.rot - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 6); }
  });
  const selecionar = () => usePersonagem.getState().selecionarOutro(o);
  // posição viva dos outros (só pra testes/prévias)
  useEffect(() => { const w = window as unknown as { __outros?: () => number[] }; w.__outros = () => (g.current ? [g.current.position.x, g.current.position.z] : []); }, []);
  return (
    <group ref={g}>{/* posição só via ref (ver Meu) */}
      <BonecoProcedural ref={h} def={def(o.boneco)} camisa={o.roupa} cracha="#B8C0CC" />
      <SombraContato r={0.36} />
      {/* área de clique (invisível) em volta do boneco */}
      <mesh position={[0, 0.6, 0]} onClick={(e) => { e.stopPropagation(); selecionar(); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.45, 0.45, 1.3, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Nome nome={o.nome} cor={o.roupa} online={o.online} onClick={selecionar} />
    </group>
  );
}

// Chão clicável: no modo mundo, com personagem ativo, clicar no chão manda o boneco andar até lá
function ChaoClicavel() {
  const ativo = usePersonagem((s) => s.ativo);
  if (!ativo || !modoMundo()) return null;
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); usePersonagem.getState().irPara(e.point.x, e.point.z); }}>
      <planeGeometry args={[MUNDO.x * 2, MUNDO.z * 2]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function Personagens() {
  const outros = usePersonagem((s) => s.outros);
  const carregar = usePersonagem((s) => s.carregar);
  const batida = usePersonagem((s) => s.batida);
  const atualizarChat = usePersonagem((s) => s.atualizarChat);
  // carrega o meu e começa as batidas (presença a cada 3 s; chat aberto a cada 2,5 s)
  useEffect(() => {
    if (!modoMundo()) return;
    let vivo = true;
    void carregar().then(() => { void batida(); if (new URLSearchParams(window.location.search).get("personagem") === "1") usePersonagem.getState().abrir("montar"); });
    const t1 = setInterval(() => { if (vivo && document.visibilityState === "visible") void batida(); }, 3000);
    const t2 = setInterval(() => { if (vivo && usePersonagem.getState().painel === "chat") void atualizarChat(); }, 2500);
    return () => { vivo = false; clearInterval(t1); clearInterval(t2); };
  }, [carregar, batida, atualizarChat]);
  return (
    <group>
      <ChaoClicavel />
      <Meu />
      {outros.map((o) => <OutroBoneco key={o.usuarioId} o={o} />)}
    </group>
  );
}
