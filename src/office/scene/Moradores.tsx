"use client";
// Moradores da cidade no mapa (19/11/2026): gente fixa com nome, casa e rotina (data/moradores.ts). Cada quadro só lê
// a posição que a rotina dá para a hora da cidade (sem alocação); quem está em casa, na cozinha ou no escritório some da
// rua. Clicar no boneco ou no nome abre a ficha com a conversa (ui/Morador.tsx). Quando o visitante logado passa perto
// de um morador que o conhece, ele solta um balão curto de cumprimento pelo nome (da memória, sem IA).
// No modo leve (celular) só aparecem os moradores marcados para o celular.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BonecoProcedural, HIPS, useAnimacao, type BonecoHandle } from "./Boneco";
import { SombraContato } from "./SombraContato";
import { bonecoDe } from "../data/bonecos";
import { leve } from "./qualidade";
import { MORADOR_POR_ID, moradoresDoAparelho, estadoMorador, novoEstado, cumprimentoDePassagem, type Morador, type EstadoMorador } from "../data/moradores";
import { useMoradores, MORADORES_NA_RUA, segundosCidade } from "../moradorStore";
import { minhaPos, usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";

const DIST_NOME = 95; // m da câmera: mais longe que isso, o nome some (menos trabalho para o navegador)
const PERTO = 6.5; // m: o morador cumprimenta quem passa a essa distância
const INTERVALO_CUMPRIMENTO = 4 * 60_000; // o mesmo morador não cumprimenta a mesma pessoa de novo antes disso

function Etiqueta({ m, onClick }: { m: Morador; onClick: () => void }) {
  const fala = useMoradores((s) => s.falas[m.id]?.texto ?? null);
  return (
    <Html position={[0, 1.55, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex w-max select-none flex-col items-center">
        {fala && <div className="mb-1 max-w-[180px] rounded-2xl bg-white px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-[#1D2128] shadow-lg">{fala}</div>}
        <button type="button" aria-label={`Morador ${m.nome}`} onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full bg-[#FFF7E6]/95 px-2 py-[3px] text-[10px] font-bold leading-none text-[#5C3B00] shadow-md">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />{m.nome}
        </button>
        <div className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-[#FFF7E6]/95" />
      </div>
    </Html>
  );
}

function MoradorBoneco({ m, est }: { m: Morador; est: EstadoMorador }) {
  const g = useRef<THREE.Group>(null), h = useRef<BonecoHandle>(null);
  const camera = useThree((s) => s.camera);
  const fase = useMemo(() => (m.id.charCodeAt(0) % 7) / 2, [m.id]);
  const naRua = useRef({ x: 0, z: 0, estado: "andando" as "andando" | "atravessando" });
  useEffect(() => { const n = naRua.current; MORADORES_NA_RUA.push(n); return () => { const i = MORADORES_NA_RUA.indexOf(n); if (i >= 0) MORADORES_NA_RUA.splice(i, 1); }; }, []);
  const [nome, setNome] = useState(false);
  const acc = useRef(1);
  useAnimacao(h, () => (est.andando ? "walk" : "idle"), fase, HIPS.procedural.base);
  useFrame((_, dt) => {
    const o = g.current; if (!o) return; dt = Math.min(dt, 0.25);
    estadoMorador(m, segundosCidade(), est);
    o.visible = est.visivel;
    o.position.set(est.x, 0, est.z);
    let d = est.rot - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 8);
    const n = naRua.current; n.x = est.x; n.z = est.z; n.estado = est.visivel && est.travessia ? "atravessando" : "andando";
    // o nome só aparece de perto (conferido duas vezes por segundo, não a cada quadro)
    acc.current += dt;
    if (acc.current > 0.5) { acc.current = 0; const mostra = est.visivel && camera.position.distanceTo(o.position) < DIST_NOME; if (mostra !== nome) setNome(mostra); }
  });
  const abrir = () => useMoradores.getState().abrir(m.id);
  const def = useMemo(() => bonecoDe(m.boneco), [m.boneco]);
  return (
    <group ref={g}>{/* posição só via ref: a rotina manda */}
      <BonecoProcedural ref={h} def={def} camisa={m.roupa} cracha={m.roupa} acessorios={m.acessorios} />
      <SombraContato r={0.36} />
      {/* área de clique (invisível) em volta do boneco; em casa ele não está na rua, então o clique passa para o chão */}
      <mesh position={[0, 0.6, 0]} onClick={(e) => { if (!est.visivel) return; e.stopPropagation(); abrir(); }} onPointerOver={() => { if (est.visivel) document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.45, 0.45, 1.3, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {nome && <Etiqueta m={m} onClick={abrir} />}
    </group>
  );
}

export function Moradores() {
  const lista = useMemo(() => moradoresDoAparelho(leve()), []);
  const estados = useMemo(() => Object.fromEntries(lista.map((m) => [m.id, novoEstado()])), [lista]);
  const usuario = useMundo((s) => s.usuario);
  const { camera, gl } = useThree();
  // o que cada morador lembra de quem está logado (para o cumprimento de passagem)
  useEffect(() => { if (usuario) void useMoradores.getState().carregarRelacoes(); else useMoradores.setState({ relacoes: null }); }, [usuario]);
  const ultimo = useRef<Record<string, number>>({});
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt; if (acc.current < 1) return; acc.current = 0;
    const st = useMoradores.getState(); const rel = st.relacoes; if (!rel) return;
    const p = usePersonagem.getState(); if (!p.ativo || p.predio) return;
    const agora = Date.now(), seg = segundosCidade();
    for (const m of lista) {
      const e = estados[m.id], r = rel[m.id]; if (!r || !e.visivel || st.aberto === m.id) continue;
      if (Math.hypot(minhaPos.x - e.x, minhaPos.z - e.z) > PERTO) continue;
      if (agora - (ultimo.current[m.id] ?? 0) < INTERVALO_CUMPRIMENTO) continue;
      ultimo.current[m.id] = agora;
      st.falar(m.id, cumprimentoDePassagem(m, r, seg));
    }
  });
  // testes e prévias (?medir=1): posição viva, rotina em qualquer hora e onde cada um está na tela
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("medir")) return;
    const v = new THREE.Vector3();
    (window as unknown as { __moradores: unknown }).__moradores = {
      ids: lista.map((m) => m.id), estados, seg: segundosCidade,
      estado: (id: string, hora: number) => { const m = MORADOR_POR_ID[id]; return m ? { ...estadoMorador(m, hora * 3600, novoEstado()) } : null; },
      tela: (id: string) => { const e = estados[id]; if (!e) return null; v.set(e.x, 1.0, e.z).project(camera); const r = gl.domElement.getBoundingClientRect(); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height, v.z]; },
      abrir: (id: string) => useMoradores.getState().abrir(id), store: useMoradores,
      olhar: (id: string) => { const e = estados[id]; if (e) useMundo.setState({ alvoCamera: [e.x, 0.5, e.z] }); },
    };
  }, [lista, estados, camera, gl]);
  return <group>{lista.map((m) => <MoradorBoneco key={m.id} m={m} est={estados[m.id]} />)}</group>;
}
