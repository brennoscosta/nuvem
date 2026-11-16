"use client";
// Sede do OneState por dentro (16/11/2026, pedido do dono: "não estou conseguindo ver minha empresa do OneState por
// dentro"). Na vista por dentro (o mesmo botão que abre todas as lojas) a torre some e aparece a planta no térreo, aberta
// como casa de bonecas: grade 5 × 5 com a recepção na entrada (sul), a sala do CEO e uma sala para cada área do site,
// cada uma com o piso na cor da área, 3 mesas e os agentes da equipe da sede digitando (o escritório gravado no lote
// da sede, src/office/data/onestate.ts › CHAVE_SEDE). Passar o mouse num agente mostra nome e cargo; clicar abre o
// cartão da sede. No modo leve só um agente por sala anima (os outros lugares ficam com a mesa).
import { useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { caixa, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Mesa, Balcao, Sofa, Planta } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { BONECO } from "../data/bonecos";
import { leve } from "./qualidade";
import { useMundo } from "../mundoStore";
import { AREAS_ONESTATE, CHAVE_SEDE, OS_X, OS_Z } from "../data/onestate";
import type { Escritorio, Membro } from "../data/escritorio";

// planta: 34 × 30 m no meio da praça, 5 colunas × 5 linhas; z cresce para o sul (a entrada)
const W = 34, D = 30, COLS = 5, LINS = 5, CW = W / COLS, CD = D / LINS;
const X0 = OS_X - W / 2, Z0 = OS_Z - D / 2;
const ALT = 1.15, ESP = 0.12, PORTA = 1.5;
const RECEPCAO = { c: 2, r: 4 }, CEO = { c: 4, r: 4 };
type Sala = { id: string; nome: string; cor: string; c: number; r: number; tipo: "area" | "recepcao" | "ceo" };
const centro = (s: { c: number; r: number }): [number, number] => [X0 + (s.c + 0.5) * CW, Z0 + (s.r + 0.5) * CD];
const clarear = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };

// as salas: recepção e CEO fixas; as áreas, na ordem do menu do site, ocupando as outras células de cima para baixo
const SALAS: Sala[] = (() => {
  const lista: Sala[] = [{ id: "recepcao", nome: "Recepção", cor: "#E9C46A", ...RECEPCAO, tipo: "recepcao" }, { id: "ceo", nome: "Sala do CEO", cor: "#9CA3AF", ...CEO, tipo: "ceo" }];
  let i = 0;
  for (let r = 0; r < LINS; r++) for (let c = 0; c < COLS; c++) {
    if ((c === RECEPCAO.c && r === RECEPCAO.r) || (c === CEO.c && r === CEO.r)) continue;
    const a = AREAS_ONESTATE[i++]; if (a) lista.push({ id: a.id, nome: a.nome, cor: a.cor, c, r, tipo: "area" });
  }
  return lista;
})();
// 3 mesas por sala de área, encostadas no fundo (norte); quem senta olha para a entrada (sul), de frente para a câmera
const mesasDa = (s: Sala) => { const [cx, cz] = centro(s); return [-2.1, 0, 2.1].map((dx) => [cx + dx, 0, cz - 0.4] as [number, number, number]); };
const cadeira = (m: [number, number, number]): [number, number, number] => [m[0], 0, m[2] - 0.62];

// paredes baixas: grade com uma porta no meio de cada trecho e a entrada larga na recepção
function Paredes() {
  const m = mat("#F4F1EB", { rough: 0.9 }), topo = mat("#D4A63A", { rough: 0.35, metal: 0.7 });
  const pedacos: { x: number; z: number; w: number; d: number }[] = [];
  const trechoX = (x0: number, x1: number, z: number, vao: number) => { const meio = (x0 + x1) / 2, a = meio - vao / 2, b = meio + vao / 2; if (vao <= 0) pedacos.push({ x: meio, z, w: x1 - x0, d: ESP }); else { pedacos.push({ x: (x0 + a) / 2, z, w: a - x0, d: ESP }); pedacos.push({ x: (b + x1) / 2, z, w: x1 - b, d: ESP }); } };
  const trechoZ = (z0: number, z1: number, x: number, vao: number) => { const meio = (z0 + z1) / 2, a = meio - vao / 2, b = meio + vao / 2; if (vao <= 0) pedacos.push({ x, z: meio, w: ESP, d: z1 - z0 }); else { pedacos.push({ x, z: (z0 + a) / 2, w: ESP, d: a - z0 }); pedacos.push({ x, z: (b + z1) / 2, w: ESP, d: z1 - b }); } };
  for (let c = 0; c < COLS; c++) {
    const x0 = X0 + c * CW, x1 = x0 + CW;
    trechoX(x0, x1, Z0, 0); // fundo (norte), fechado
    trechoX(x0, x1, Z0 + D, c === RECEPCAO.c ? 3 : 0); // frente (sul): a entrada só na recepção
    for (let r = 1; r < LINS; r++) trechoX(x0, x1, Z0 + r * CD, PORTA);
  }
  for (let r = 0; r < LINS; r++) {
    const z0 = Z0 + r * CD, z1 = z0 + CD;
    trechoZ(z0, z1, X0, 0); trechoZ(z0, z1, X0 + W, 0);
    for (let c = 1; c < COLS; c++) trechoZ(z0, z1, X0 + c * CW, PORTA);
  }
  return (
    <group>
      {pedacos.map((p, i) => <mesh key={i} geometry={caixa(+p.w.toFixed(3), ALT, +p.d.toFixed(3))} material={m} position={[p.x, ALT / 2, p.z]} castShadow receiveShadow />)}
      {pedacos.map((p, i) => <mesh key={`t${i}`} geometry={caixa(+p.w.toFixed(3), 0.05, +(p.d + 0.02).toFixed(3))} material={topo} position={[p.x, ALT + 0.025, p.z]} />)}
    </group>
  );
}

function Fixos() {
  return (
    <group>
      <mesh geometry={caixa(W + 0.8, 0.1, D + 0.8)} material={mat("#D8D4CC", { rough: 0.95 })} position={[OS_X, 0.05, OS_Z]} receiveShadow />
      {SALAS.map((s) => { const [cx, cz] = centro(s); return <mesh key={s.id} geometry={plano(CW - 0.1, CD - 0.1)} material={mat(clarear(s.cor, s.tipo === "area" ? 0.72 : 0.6), { rough: 0.9 })} position={[cx, 0.11, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />; })}
      <Paredes />
      {SALAS.filter((s) => s.tipo === "area").flatMap((s) => mesasDa(s).map((pos, k) => <Mesa key={`${s.id}${k}`} def={{ id: `${s.id}${k}`, sala: s.id, pos, rot: 0, tipo: "comum" }} cor={s.cor} />))}
      {SALAS.filter((s) => s.tipo === "area").map((s) => { const [cx, cz] = centro(s); return <Planta key={`p${s.id}`} position={[cx + CW / 2 - 0.6, 0, cz + CD / 2 - 0.6]} pequena />; })}
      {(() => { const [cx, cz] = centro(RECEPCAO); return <group><Balcao position={[cx, 0, cz - 0.6]} /><Sofa position={[cx - CW / 2 + 0.9, 0, cz + 0.8]} rotation={Math.PI / 2} cor="#D4A63A" largura={2} /><Planta position={[cx + CW / 2 - 0.6, 0, cz + CD / 2 - 0.7]} /></group>; })()}
      {(() => { const [cx, cz] = centro(CEO); return <group><Mesa def={{ id: "ceo", sala: "ceo", pos: [cx, 0, cz - 0.3], rot: 0, tipo: "ceo" }} cor="#1F2630" /><Sofa position={[cx, 0, cz + CD / 2 - 0.8]} rotation={Math.PI} cor="#3A3F47" largura={2.2} /><Planta position={[cx + CW / 2 - 0.6, 0, cz - CD / 2 + 0.6]} /></group>; })()}
    </group>
  );
}

function NomeSala({ s }: { s: Sala }) {
  const [cx, cz] = centro(s);
  return (
    <Html position={[cx, 2.1, cz + CD / 2 - 0.9]} center zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
      <div className="select-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow" style={{ background: "rgba(14,16,19,.82)", boxShadow: `inset 0 0 0 1.5px ${s.cor}` }}>{s.nome}</div>
    </Html>
  );
}

function Agente({ m, pos, rot, emPe }: { m: Membro; pos: [number, number, number]; rot: number; emPe?: boolean }) {
  const h = useRef<BonecoHandle>(null);
  const fase = useMemo(() => (m.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97) / 10, [m.id]);
  const pose: Pose = emPe ? "idle" : m.papel === "ceo" ? "think" : "type";
  useAnimacao(h, () => pose, fase, HIPS.procedural.base);
  const [hover, setHover] = useState(false);
  const def = BONECO[m.boneco] ?? BONECO.classico;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <BonecoProcedural ref={h} def={def} camisa={m.camisa} headset={m.papel === "atendente"} cracha={m.papel === "ceo" ? "#D4A017" : "#1D4ED8"} />
      <mesh position={[0, 0.7, 0]} onClick={(e) => { e.stopPropagation(); useMundo.getState().selecionarLote(CHAVE_SEDE); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.4, 0.4, 1.5, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hover && (
        <Html position={[0, 1.7, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max select-none rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-[#1D2128] shadow-md">{m.nome}<span className="ml-1.5 font-semibold text-[#5B6472]">{m.cargo}</span></div>
        </Html>
      )}
    </group>
  );
}

// onde cada pessoa da equipe fica: recepcionista atrás do balcão, CEO na mesa dele, especialistas nas mesas da sala da área
function lugaresDa(e: Escritorio | null | undefined, poucos: boolean) {
  const out: { m: Membro; pos: [number, number, number]; rot: number; emPe?: boolean }[] = [];
  if (!e) return out;
  const porSala: Record<string, number> = {};
  for (const m of e.equipe) {
    if (m.papel === "atendente") { const [cx, cz] = centro(RECEPCAO); out.push({ m, pos: [cx, 0, cz - 1.4], rot: 0, emPe: true }); continue; }
    if (m.papel === "ceo") { const [cx, cz] = centro(CEO); out.push({ m, pos: cadeira([cx, 0, cz - 0.3]), rot: 0 }); continue; }
    const s = SALAS.find((x) => x.id === m.setorId); if (!s) continue;
    const k = porSala[s.id] ?? 0; porSala[s.id] = k + 1;
    if (k > 2 || (poucos && k > 0)) continue;
    out.push({ m, pos: cadeira(mesasDa(s)[k]), rot: 0 });
  }
  return out;
}

export function InteriorSede() {
  const e = useMundo((s) => s.terrenos[CHAVE_SEDE]?.escritorio ?? null);
  const poucos = useMemo(() => leve(), []);
  const lugares = useMemo(() => lugaresDa(e, poucos), [e, poucos]);
  return (
    <group>
      <Estatico><Fixos /></Estatico>
      {SALAS.map((s) => <NomeSala key={s.id} s={s} />)}
      {lugares.map((l) => <Agente key={l.m.id} {...l} />)}
    </group>
  );
}
