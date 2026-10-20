"use client";
// Um agente na cena: recebe eventos, anda pelo escritório, senta, trabalha, comemora...
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { BonecoGLB, BonecoProcedural, HIPS, useAnimacao, type BonecoHandle, type Pose } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { AREAS, NIVEL } from "../data/org";
import { MESA, PONTOS, caminho, mesaDoChefe, pontoCadeira, type V3 } from "../data/layout";
import { useEscritorio, removerAgente, type Agente as AgenteDef } from "../store";
import type { Evento } from "../data/eventos";
import { caixa, mat } from "./geo";

const FONTE = "/fonts/inter-600.woff";
// Velocidade de caminhada (m/s). ?turbo=N acelera a cena (útil pra testes em máquina lenta).
const TURBO = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("turbo") || 1) : 1;
const VEL = 1.7 * TURBO;

// registro: a Cena entrega os eventos pro agente certo
export const handlers = new Map<string, (ev: Evento) => void>();

type Acao = { tipo: "andar"; para: V3; rotFinal?: number; pose?: Pose } | { tipo: "pose"; pose: Pose; rot?: number } | { tipo: "esperar"; s: number } | { tipo: "fn"; fn: () => void };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const assentoReuniao = (i: number): V3 => { const a = (i / 6) * Math.PI * 2; return [PONTOS.mesaReuniao[0] + Math.cos(a) * 2.0, 0, PONTOS.mesaReuniao[2] + Math.sin(a) * 2.0]; };
const lugarPausa = (): { p: V3; pose: Pose; rot: number } => {
  const r = Math.random();
  if (r < 0.4) { const i = Math.floor(rnd(0, 4)); const a = (i / 4) * Math.PI * 2; return { p: [PONTOS.copaBalcao[0] + Math.cos(a) * 0.9, 0, PONTOS.copaBalcao[2] + Math.sin(a) * 0.9], pose: "idle", rot: a + Math.PI / 2 }; }
  if (r < 0.7) return { p: [PONTOS.loungeSofa[0] + rnd(-0.7, 0.7), 0, PONTOS.loungeSofa[2] + 0.9], pose: "sit", rot: Math.PI };
  if (r < 0.85) return { p: [PONTOS.loungeSinuca[0] - 0.4, 0, PONTOS.loungeSinuca[2] + 1.2], pose: "idle", rot: Math.PI };
  return { p: [PONTOS.loungeFliperama[0], 0, PONTOS.loungeFliperama[2] - 0.9], pose: "type", rot: 0 };
};

export function Agente({ def }: { def: AgenteDef }) {
  const grupo = useRef<THREE.Group>(null);
  const boneco = useRef<BonecoHandle>(null);
  const fila = useRef<Acao[]>([]);
  const atual = useRef<Acao | null>(null);
  const pose = useRef<Pose>("idle");
  const rotAlvo = useRef(0);
  const espera = useRef(0);
  const caixaRef = useRef(false);
  const [carregando, setCarregando] = useState(false);
  const [marca, setMarca] = useState<"!" | "..." | "zzz" | null>(null);
  const fase = useMemo(() => Math.random() * 10, []);
  const bdef = BONECO[def.boneco] ?? BONECO.classico;
  const usaGLB = !!bdef.arquivo;
  const hips = usaGLB ? HIPS.glb : HIPS.procedural;
  const cadeira = useMemo(() => pontoCadeira(MESA[def.mesaId]), [def.mesaId]);
  const setStatus = useEscritorio((s) => s.setStatus);
  const selecionar = useEscritorio((s) => s.selecionar);
  const selecionado = useEscritorio((s) => s.selecionado === def.id);

  const irParaMesa = (depois: Pose = "sit"): Acao[] => [{ tipo: "andar", para: cadeira.pos, rotFinal: cadeira.rot, pose: depois }];

  // ---- reação a eventos ----
  useEffect(() => {
    const h = (ev: Evento) => {
      const f = fila.current;
      const limpar = () => { fila.current.length = 0; atual.current = null; setMarca(null); };
      switch (ev.tipo) {
        case "contratado": {
          if (grupo.current) grupo.current.position.set(...PONTOS.elevador);
          limpar();
          const chefe = mesaDoChefe(def.area, def.nivel);
          f.push({ tipo: "esperar", s: 0.6 }, { tipo: "andar", para: PONTOS.recepcaoEspera });
          if (chefe) f.push({ tipo: "andar", para: chefe, pose: "idle" }, { tipo: "esperar", s: 1.5 });
          f.push(...irParaMesa("sit"), { tipo: "fn", fn: () => setStatus(def.id, "disponivel", "Pronto pra começar") });
          break;
        }
        case "tarefa_recebida": limpar(); f.push(...irParaMesa("type"), { tipo: "fn", fn: () => setStatus(def.id, "trabalhando", ev.texto) }); break;
        case "trabalhando": limpar(); f.push(...irParaMesa("type"), { tipo: "fn", fn: () => setStatus(def.id, "trabalhando", ev.texto) }); break;
        case "planejando": limpar(); f.push(...irParaMesa("think"), { tipo: "fn", fn: () => { setMarca("..."); setStatus(def.id, "planejando", ev.texto); } }); break;
        case "revisao_pedida": {
          limpar(); const chefe = mesaDoChefe(def.area, def.nivel);
          f.push({ tipo: "andar", para: chefe ?? cadeira.pos, pose: "idle" }, { tipo: "fn", fn: () => setStatus(def.id, "em_revisao", ev.texto) });
          break;
        }
        case "aprovado": limpar(); f.push({ tipo: "pose", pose: "celebrate" }, { tipo: "fn", fn: () => setStatus(def.id, "comemorando", ev.texto ?? "Aprovado!") }); break;
        case "devolvido": limpar(); f.push(...irParaMesa("type"), { tipo: "fn", fn: () => setStatus(def.id, "trabalhando", ev.texto) }); break;
        case "bloqueado": limpar(); f.push(...irParaMesa("blocked"), { tipo: "fn", fn: () => { setMarca("!"); setStatus(def.id, "bloqueado", ev.texto); } }); break;
        case "aprovacao_do_dono": {
          limpar(); f.push(...irParaMesa("blocked"), { tipo: "fn", fn: () => { setMarca("!"); setStatus(def.id, "bloqueado", ev.texto); const st = useEscritorio.getState(); st.setSirene(true); setTimeout(() => st.setSirene(false), 7000); } });
          break;
        }
        case "reuniao": {
          limpar(); const i = Math.floor(Math.random() * 6); const p = assentoReuniao(i);
          f.push({ tipo: "andar", para: p, rotFinal: Math.atan2(PONTOS.mesaReuniao[0] - p[0], PONTOS.mesaReuniao[2] - p[2]), pose: "sit" }, { tipo: "fn", fn: () => setStatus(def.id, "reuniao", ev.texto) });
          break;
        }
        case "pausa": { limpar(); const l = lugarPausa(); f.push({ tipo: "andar", para: l.p, rotFinal: l.rot, pose: l.pose }, { tipo: "fn", fn: () => setStatus(def.id, "pausa", ev.texto) }); break; }
        case "voltou": limpar(); f.push(...irParaMesa("sit"), { tipo: "fn", fn: () => setStatus(def.id, "disponivel", ev.texto) }); break;
        case "promovido": limpar(); f.push({ tipo: "pose", pose: "celebrate" }, { tipo: "esperar", s: 2 }, { tipo: "fn", fn: () => setStatus(def.id, "disponivel", ev.texto) }); break;
        case "expediente_encerrado": limpar(); f.push({ tipo: "andar", para: PONTOS.elevador, pose: "idle" }, { tipo: "fn", fn: () => removerAgente(def.id) }); break;
        case "demitido": limpar(); caixaRef.current = true; setCarregando(true); f.push({ tipo: "pose", pose: "carry" }, { tipo: "esperar", s: 1.2 }, { tipo: "andar", para: PONTOS.elevador, pose: "carry" }, { tipo: "fn", fn: () => removerAgente(def.id) }); break;
      }
    };
    handlers.set(def.id, h);
    return () => { handlers.delete(def.id); };
  }, [def.id, def.area, def.nivel, cadeira, setStatus]);

  // mudou de mesa (promoção): vai pra nova cadeira
  useEffect(() => { if (grupo.current && atual.current === null && fila.current.length === 0) fila.current.push(...irParaMesa("sit")); }, [def.mesaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- loop de movimento ----
  const rota = useRef<V3[]>([]);
  useFrame((_, dt) => {
    const g = grupo.current; if (!g) return;
    dt = Math.min(dt, 0.25) * (TURBO > 1 ? TURBO : 1);
    if (!atual.current) {
      const prox = fila.current.shift(); if (!prox) return;
      atual.current = prox;
      if (prox.tipo === "andar") { rota.current = caminho([g.position.x, 0, g.position.z], prox.para).slice(1); pose.current = caixaRef.current ? "carry" : "walk"; }
      if (prox.tipo === "esperar") espera.current = prox.s;
      if (prox.tipo === "pose") { pose.current = prox.pose; if (prox.rot !== undefined) rotAlvo.current = prox.rot; atual.current = null; }
      if (prox.tipo === "fn") { prox.fn(); atual.current = null; }
    }
    const a = atual.current; if (!a) return;
    if (a.tipo === "esperar") { espera.current -= dt; if (espera.current <= 0) atual.current = null; }
    if (a.tipo === "andar") {
      const alvo = rota.current[0];
      if (!alvo) { atual.current = null; pose.current = a.pose ?? "idle"; if (a.rotFinal !== undefined) rotAlvo.current = a.rotFinal; return; }
      const dx = alvo[0] - g.position.x, dz = alvo[2] - g.position.z; const dist = Math.hypot(dx, dz);
      const passo = 1.7 * dt * (pose.current === "carry" ? 0.75 : 1);
      if (dist <= passo) { g.position.x = alvo[0]; g.position.z = alvo[2]; rota.current.shift(); }
      else { g.position.x += (dx / dist) * passo; g.position.z += (dz / dist) * passo; rotAlvo.current = Math.atan2(dx, dz); }
    }
    // rotação suave
    let d = rotAlvo.current - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 10);
  });
  useAnimacao(boneco, () => pose.current, fase, hips.base, hips.escala);

  const corArea = AREAS[def.area].cor;
  const nivel = NIVEL[def.nivel];
  const fala = def.fala && def.status !== "chegando" ? def.fala : undefined;

  return (
    <group ref={grupo} position={PONTOS.elevador} onClick={(e) => { e.stopPropagation(); selecionar(def.id); }}>
      {usaGLB ? <BonecoGLB ref={boneco} arquivo={bdef.arquivo!} /> : <BonecoProcedural ref={boneco} def={bdef} camisa={corArea} headset={def.area === "suporte" || def.area === "vendas"} cracha={nivel.cor} />}
      {/* caixa de papelão (demissão) */}
      {carregando && <mesh geometry={caixa(0.36, 0.26, 0.3)} material={mat("#C9A063")} position={[0, 0.72, 0.3]} />}
      {/* anel de seleção */}
      {selecionado && <mesh geometry={new THREE.RingGeometry(0.32, 0.4, 32)} material={mat(corArea, { emissive: corArea, ei: 0.8 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />}
      {/* crachá flutuante: nome + nível */}
      <Billboard position={[0, 1.55, 0]}>
        <mesh geometry={caixa(Math.max(0.9, def.nome.length * 0.09 + 0.3), 0.3, 0.01)} material={mat("#111418", { opacity: 0.82 })} />
        <mesh geometry={caixa(0.06, 0.3, 0.012)} material={mat(nivel.cor)} position={[-Math.max(0.9, def.nome.length * 0.09 + 0.3) / 2 + 0.03, 0, 0]} />
        <Text font={FONTE} fontSize={0.13} color="#FFFFFF" anchorX="center" anchorY="middle" position={[0.03, 0.045, 0.01]}>{def.nome}</Text>
        <Text font={FONTE} fontSize={0.085} color="#C9CFD8" anchorX="center" anchorY="middle" position={[0.03, -0.085, 0.01]}>{nivel.nome.toUpperCase()}</Text>
        {marca && (
          <group position={[0, 0.34, 0]}>
            <mesh geometry={caixa(0.3, 0.3, 0.01)} material={mat(marca === "!" ? "#E53935" : "#FFFFFF")} />
            <Text font={FONTE} fontSize={0.2} color={marca === "!" ? "#FFFFFF" : "#333"} anchorX="center" anchorY="middle" position={[0, 0, 0.01]}>{marca}</Text>
          </group>
        )}
        {fala && !marca && (
          <group position={[0, 0.36, 0]}>
            <mesh geometry={caixa(Math.min(3.2, fala.length * 0.075 + 0.3), 0.26, 0.01)} material={mat("#FFFFFF", { opacity: 0.95 })} />
            <Text font={FONTE} fontSize={0.11} color="#2B2F36" anchorX="center" anchorY="middle" position={[0, 0, 0.01]} maxWidth={3}>{fala.length > 40 ? fala.slice(0, 38) + "…" : fala}</Text>
          </group>
        )}
      </Billboard>
    </group>
  );
}
