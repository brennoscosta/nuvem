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
import { usePersonagem, type Outro } from "../personagemStore";
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

// Meu boneco: anda até o destino clicado; a câmera não segue (o mapa é livre), mas o botão "ir até mim" centraliza
function Meu() {
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const destino = usePersonagem((s) => s.destino);
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const andando = useRef(false);
  const paradoDesde = useRef(0); // 0 = marca na primeira frame; desde quando está sem destino (passeia sozinho depois de um tempo)
  const fase = useMemo(() => 1.3, []);
  useAnimacao(h, () => (andando.current ? "walk" : "idle"), fase, HIPS.procedural.base);
  // posição inicial: a salva no servidor (encostada na calçada, nunca no meio da rua)
  useEffect(() => { if (g.current && meu) { const [x, z] = pontoNaCalcada(meu.x, meu.z); g.current.position.set(x, 0, z); g.current.rotation.y = meu.rot; usePersonagem.getState().setPosicao(x, z, meu.rot); } }, [meu?.usuarioId]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const o = g.current; if (!o) return; dt = Math.min(dt, 0.1);
    if (!destino) {
      andando.current = false; if (!paradoDesde.current) paradoDesde.current = performance.now();
      // como um pedestre comum: depois de um tempo parado, dá uma volta pela calçada (um clique no chão interrompe)
      if (performance.now() - paradoDesde.current > PAUSA_PASSEIO * 1000 && usePersonagem.getState().painel !== "chat") { paradoDesde.current = performance.now(); usePersonagem.setState({ destino: passeioNaCalcada(o.position.x, o.position.z), passeio: true }); }
      return;
    }
    const dx = destino[0] - o.position.x, dz = destino[1] - o.position.z; const dist = Math.hypot(dx, dz);
    if (dist < 0.08) { andando.current = false; paradoDesde.current = performance.now() - (usePersonagem.getState().passeio ? PAUSA_PASSEIO * 400 : 0); usePersonagem.setState({ destino: null, passeio: false }); usePersonagem.getState().setPosicao(o.position.x, o.position.z, o.rotation.y); return; }
    andando.current = true;
    const p = Math.min(dist, (usePersonagem.getState().passeio ? VEL_PASSEIO : VEL) * dt); o.position.x += (dx / dist) * p; o.position.z += (dz / dist) * p;
    const r = Math.atan2(dx, dz); let d = r - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 10);
    usePersonagem.getState().setPosicao(o.position.x, o.position.z, o.rotation.y);
  });
  if (!meu || !ativo) return null;
  const b = def(meu.boneco);
  return (
    <group ref={g} position={[meu.x, 0, meu.z]}>
      <BonecoProcedural ref={h} def={b} camisa={meu.roupa} cracha="#FFD166" />
      <SombraContato r={0.36} />
      <Nome nome={meu.nome} cor={meu.roupa} eu />
    </group>
  );
}

// Outro personagem online: desliza até a posição que veio do servidor
function OutroBoneco({ o }: { o: Outro }) {
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const alvo = useRef(new THREE.Vector3(o.x, 0, o.z));
  const rotAlvo = useRef(o.rot);
  const andando = useRef(false);
  const fase = useMemo(() => (o.usuarioId.charCodeAt(o.usuarioId.length - 1) % 10) / 3, [o.usuarioId]);
  useEffect(() => { alvo.current.set(o.x, 0, o.z); rotAlvo.current = o.rot; }, [o.x, o.z, o.rot]);
  useAnimacao(h, () => (andando.current ? "walk" : "idle"), fase, HIPS.procedural.base);
  useFrame((_, dt) => {
    const g0 = g.current; if (!g0) return; dt = Math.min(dt, 0.1);
    const dx = alvo.current.x - g0.position.x, dz = alvo.current.z - g0.position.z; const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const p = Math.min(dist, Math.max(VEL, dist / 2.5) * dt); g0.position.x += (dx / dist) * p; g0.position.z += (dz / dist) * p; andando.current = true;
      const r = Math.atan2(dx, dz); let d = r - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 10);
    } else { andando.current = false; let d = rotAlvo.current - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 6); }
  });
  const selecionar = () => usePersonagem.getState().selecionarOutro(o);
  return (
    <group ref={g} position={[o.x, 0, o.z]} rotation={[0, o.rot, 0]}>
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
