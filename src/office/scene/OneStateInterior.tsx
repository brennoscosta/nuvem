"use client";
// Sede da Social RP (antes OneState) por dentro. 16/11/2026, pedido do dono: "por que os bonecos das salas só ficam
// parados e são todos iguais? Não faz sentido" e "que a empresa tenha suas áreas como assistentes, gerentes, CEO, setor
// financeiro". Na vista por dentro a torre some e aparece a planta no térreo, aberta como casa de bonecas:
//  - um corredor no meio (leste-oeste) com 6 salas de cada lado: os departamentos da equipe gravada no lote da sede
//    (scripts/sede-socialrp.mjs), a recepção na entrada sul e a sala de reunião; café no corredor;
//  - cada agente com aparência própria (pele, cabelo, roupa, calça e tênis tirados do id): chefes de blazer, a equipe de
//    camisa na cor do departamento;
//  - rotina viva: trabalham sentados um tempo, levantam, vão à mesa de um colega (chefe ou equipe) conversar com balão,
//    vão à reunião ou ao café e voltam. Para o dono, as conversas internas de verdade (delegação de tarefas, endpoint
//    /api/workend/equipe/atividade) também viram caminhada + balão com o texto real.
// Tudo que se mexe é atualizado direto nos objetos (useFrame + refs); o React só redesenha quando um balão aparece.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Mesa, Balcao, Sofa, Planta, Cafe, Tapete, Estante, Poltrona, LuminariaChao, MesaLateral, Bebedouro, QuadroArte, PainelLogo, Ficus, Floreira, MesaAlta, Gaveteiro, Lousa, LuzDasLuminarias } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { leve } from "./qualidade";
import { useMundo } from "../mundoStore";
import { abrirChatEquipe } from "../ui/ChatEquipe";
import { usePersonagem } from "../personagemStore";
import { aparenciaAgente, hash } from "../data/aparenciaAgente";
import { OS_X, OS_Z } from "../data/onestate";
import type { Sede } from "../data/sedes";
import type { Escritorio, Membro } from "../data/escritorio";
import { W, D, X0, Z0, X1, Z1, CORREDOR, ZC, POR_FILEIRA, LARG, cx, montarSalas, type Sala } from "../data/plantaSede";

// ---------- planta (salas em src/office/data/plantaSede.ts) ----------
const ALT = 1.15, ESP = 0.12, PORTA = 1.5;
const zDentro = (s: Sala) => (s.norte ? s.z1 - 1.1 : s.z0 + 1.1);

const clarear = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };

// lugares de trabalho: todos olham para o sul (de frente para a câmera); o chefe na mesa maior, mais ao fundo
type Lugar = { pos: [number, number, number]; mesa: [number, number, number]; chefe: boolean };
function lugaresDaSala(s: Sala, n: number): Lugar[] {
  const out: Lugar[] = [];
  const fundoZ = s.norte ? s.z0 + 2.3 : s.z1 - 9.6; // fila do chefe (longe do corredor na fileira norte)
  const linhas = s.norte ? [fundoZ, fundoZ + 3.6, fundoZ + 7.0] : [s.z0 + 3.4, s.z0 + 6.8, s.z0 + 10.2];
  const vagas: { x: number; z: number; chefe: boolean }[] = [{ x: cx(s), z: linhas[0], chefe: true }];
  for (const z of linhas.slice(1)) for (const dx of [-1.25, 1.25]) vagas.push({ x: cx(s) + dx, z, chefe: false });
  for (let k = 0; k < Math.min(n, vagas.length); k++) {
    const v = vagas[k];
    out.push({ mesa: [v.x, 0, v.z], pos: [v.x, 0, v.z - 0.62], chefe: v.chefe });
  }
  return out;
}

// frases da rotina (genéricas: os visitantes não veem nada da empresa); o dono vê as conversas de verdade
const FRASES_CHEFE = ["Como está essa entrega?", "Preciso disso até o fim do dia.", "Bom trabalho, vamos fechar.", "Me manda o resumo depois.", "Prioridade agora é essa."];
const FRASES_EQUIPE = ["Terminei a minha parte.", "Pode revisar pra mim?", "Tenho uma ideia pra isso.", "Já te mando os números.", "Fechado, sigo nisso."];

// ---------- paredes e móveis (juntados num objeto só) ----------
function Fixos({ salas, lugares, sede }: { salas: Sala[]; lugares: Record<string, Lugar[]>; sede: Sede }) {
  const parede = mat("#F4F1EB", { rough: 0.9 }), friso = mat(sede.cor, { rough: 0.35, metal: 0.7 });
  const pedacos: { x: number; z: number; w: number; d: number }[] = [];
  const muroX = (x0: number, x1: number, z: number, vaos: [number, number][] = []) => { let a = x0; for (const [c, l] of [...vaos].sort((p, q) => p[0] - q[0])) { if (c - l / 2 > a) pedacos.push({ x: (a + c - l / 2) / 2, z, w: c - l / 2 - a, d: ESP }); a = c + l / 2; } if (x1 > a) pedacos.push({ x: (a + x1) / 2, z, w: x1 - a, d: ESP }); };
  const muroZ = (z0: number, z1: number, x: number) => pedacos.push({ x, z: (z0 + z1) / 2, w: ESP, d: z1 - z0 });
  // fundo norte fechado; frente sul com a entrada da recepção; laterais
  muroX(X0, X1, Z0);
  const rec = salas.find((s) => s.tipo === "recepcao");
  muroX(X0, X1, Z1, rec ? [[cx(rec), 3]] : []);
  muroZ(Z0, Z1, X0); muroZ(Z0, Z1, X1);
  // as duas paredes do corredor, com uma porta para cada sala
  for (const norte of [true, false]) muroX(X0, X1, norte ? ZC - CORREDOR / 2 : ZC + CORREDOR / 2, salas.filter((s) => s.norte === norte).map((s) => [cx(s), PORTA]));
  // divisórias entre as salas
  for (let i = 1; i < POR_FILEIRA; i++) { const x = X0 + i * LARG; muroZ(Z0, ZC - CORREDOR / 2, x); muroZ(ZC + CORREDOR / 2, Z1, x); }
  const reuniao = salas.find((s) => s.tipo === "reuniao");
  return (
    <group>
      <mesh geometry={caixa(W + 0.8, 0.1, D + 0.8)} material={mat("#D8D4CC", { rough: 0.95 })} position={[OS_X, 0.05, OS_Z]} receiveShadow />
      {/* corredor: piso de granito com friso dourado */}
      <mesh geometry={plano(W - 0.1, CORREDOR - 0.1)} material={mat("#B9B3A8", { rough: 0.6 })} position={[OS_X, 0.11, ZC]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {[-0.55, 0.55].map((dz) => <mesh key={dz} geometry={plano(W - 0.4, 0.06)} material={friso} position={[OS_X, 0.115, ZC + dz]} rotation={[-Math.PI / 2, 0, 0]} />)}
      {salas.map((s) => <mesh key={s.id} geometry={plano(LARG - 0.1, s.z1 - s.z0 - 0.1)} material={mat(clarear(s.cor, s.tipo === "depto" ? 0.74 : 0.62), { rough: 0.9 })} position={[cx(s), 0.11, (s.z0 + s.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />)}
      {pedacos.map((p, i) => <mesh key={i} geometry={caixa(+p.w.toFixed(3), ALT, +p.d.toFixed(3))} material={parede} position={[p.x, ALT / 2, p.z]} castShadow receiveShadow />)}
      {pedacos.map((p, i) => <mesh key={`t${i}`} geometry={caixa(+p.w.toFixed(3), 0.05, +(p.d + 0.02).toFixed(3))} material={friso} position={[p.x, ALT + 0.025, p.z]} />)}
      {/* mesas de cada departamento (a do chefe é maior) e uma planta em cada sala */}
      {salas.filter((s) => s.tipo === "depto").flatMap((s) => (lugares[s.id] ?? []).map((l, k) => <Mesa key={`${s.id}${k}`} def={{ id: `${s.id}${k}`, sala: s.id, pos: l.mesa, rot: 0, tipo: l.chefe ? "gerente" : "comum" }} cor={s.cor} />))}
      {/* recepção: balcão de frente para a entrada, sofá e planta */}
      {rec && <group><Balcao position={[cx(rec), 0, rec.z1 - 4.2]} /><Sofa position={[rec.x0 + 0.8, 0, rec.z1 - 2]} rotation={Math.PI / 2} cor={sede.cor} largura={2} /><Planta position={[rec.x1 - 0.6, 0, rec.z1 - 0.7]} /></group>}
      {/* sala de reunião: mesa comprida, cadeiras e a TV na parede do fundo */}
      {reuniao && (
        <group>
          <mesh geometry={caixa(2.2, 0.08, 6.2)} material={mat("#3A3F47", { rough: 0.5 })} position={[cx(reuniao), 0.74, (reuniao.z0 + reuniao.z1) / 2 + 0.6]} castShadow />
          <mesh geometry={cilindro(0.12, 0.18, 0.72, 10)} material={mat("#2A2D33")} position={[cx(reuniao), 0.36, (reuniao.z0 + reuniao.z1) / 2 + 0.6]} />
          {[-2.2, -0.8, 0.6, 2.0].flatMap((dz) => [-1, 1].map((s) => <mesh key={`${dz}${s}`} geometry={caixa(0.5, 0.48, 0.5)} material={mat("#1F2937", { rough: 0.7 })} position={[cx(reuniao) + s * 1.5, 0.24, (reuniao.z0 + reuniao.z1) / 2 + 0.6 + dz]} castShadow />))}
          <mesh geometry={caixa(2.4, 1.3, 0.08)} material={mat("#0B0F15", { emissive: "#1D4ED8", ei: 0.35 })} position={[cx(reuniao), 1.6, reuniao.z1 - 0.12]} />
        </group>
      )}
      {/* café no corredor (ponta oeste) */}
      <Cafe position={[X0 + 1.2, 0, ZC]} rotation={Math.PI / 2} />
      <Planta position={[X1 - 0.6, 0, ZC]} />
      <DecorSede salas={salas} sede={sede} />
    </group>
  );
}

// ---------- decoração da sede (17/11/2026, pedido do dono: "essa empresa precisa ficar mais bonita, precisa de mais decoração
// e móveis") ----------
// Livre de propósito: a porta de cada sala (cx, largura 1,5), o caminho dos agentes (porta → [cx, zDentro] → mesas), o
// corredor no meio (z = ZC) e, na recepção, a faixa x = cx ± 0,9 da porta da rua até o balcão (onde o visitante espera)
// e o caminho da recepcionista para o corredor. Nas salas do sul (perto da câmera) só coisas baixas no fundo.
const escurecer = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };
function DecorSede({ salas, sede }: { salas: Sala[]; sede: Sede }) {
  const deptos = salas.filter((s) => s.tipo === "depto");
  const rec = salas.find((s) => s.tipo === "recepcao"), reuniao = salas.find((s) => s.tipo === "reuniao");
  // vãos do corredor entre as portas (as portas ficam no meio de cada coluna)
  const trechos = Array.from({ length: POR_FILEIRA - 1 }, (_, i) => X0 + (i + 1) * LARG);
  return (
    <group>
      {deptos.map((s, i) => {
        const x = cx(s), fundo = s.norte ? s.z0 : s.z1, dir = s.norte ? 1 : -1; // dir: do fundo para o corredor
        const zb = (d: number) => fundo + dir * d;
        const diretoria = s.id === "diretoria";
        // tapete sob as mesas, na cor do departamento (diretoria: grafite com borda dourada)
        const tapete = s.norte ? { z: s.z0 + 5.7, d: 9.2 } : { z: s.z1 - 6.6, d: 8.6 };
        const v = i % 3;
        return (
          <group key={s.id}>
            <Tapete position={[x, tapete.z]} largura={4.7} profundidade={tapete.d} cor={diretoria ? "#3B3F47" : clarear(s.cor, 0.42)} borda={diretoria ? sede.cor : escurecer(s.cor, 0.12)} />
            {s.norte ? (
              // salas do norte: o fundo fica longe da câmera, cabem coisas altas encostadas na parede
              diretoria ? (
                <>
                  <Estante position={[x - 1.5, 0, zb(0.2)]} largura={1.55} altura={1.8} />
                  <Estante position={[x + 1.5, 0, zb(0.2)]} largura={1.55} altura={1.8} />
                  {/* cantinho executivo perto da porta: duas poltronas e a mesa lateral */}
                  <Poltrona position={[s.x0 + 0.6, 0, s.z0 + 10.8]} rotation={Math.PI / 2} cor="#6B4A2F" />
                  <Poltrona position={[x - 1.0, 0, s.z0 + 10.8]} rotation={-Math.PI / 2} cor="#6B4A2F" />
                  <MesaLateral position={[x - 1.66, 0, s.z0 + 10.8]} />
                  <Ficus position={[s.x1 - 0.5, 0, s.z0 + 11.6]} escala={0.9} />
                </>
              ) : v === 0 ? (
                <>
                  <Estante position={[x - 1.25, 0, zb(0.2)]} largura={1.2} />
                  <Ficus position={[s.x0 + 0.48, 0, zb(0.55)]} escala={0.85} />
                  <LuminariaChao position={[x + 0.95, 0, zb(0.55)]} />
                  <Gaveteiro position={[x + 1.9, 0, zb(0.28)]} largura={1.0} />
                </>
              ) : v === 1 ? (
                <>
                  <Lousa position={[x - 1.5, 0, zb(0.45)]} largura={1.2} />
                  <Estante position={[x + 1.3, 0, zb(0.2)]} largura={1.15} />
                  <Ficus position={[s.x1 - 0.48, 0, zb(0.55)]} escala={0.85} />
                </>
              ) : (
                <>
                  <QuadroArte position={[x - 1.45, 0.72, zb(0.08)]} paleta={i} />
                  <LuminariaChao position={[s.x0 + 0.5, 0, zb(0.55)]} />
                  <Ficus position={[s.x1 - 0.48, 0, zb(0.55)]} escala={0.85} />
                  <MesaLateral position={[x + 1.2, 0, zb(0.5)]} />
                </>
              )
            ) : (
              // salas do sul: o fundo é o lado da câmera (só coisas baixas); as altas vão na parede do corredor, fora da porta
              <>
                <Estante position={[x - 1.55, 0, s.z0 + 0.2]} largura={1.25} />
                <Ficus position={[s.x1 - 0.5, 0, s.z0 + 0.6]} escala={0.85} />
                <Floreira position={[x - 0.6, 0, s.z1 - 0.3]} comprimento={2.6} />
                {v === 1 ? <Lousa position={[s.x0 + 0.42, 0, s.z1 - 1.8]} rotation={Math.PI / 2} largura={1.1} /> : <LuminariaChao position={[s.x0 + 0.45, 0, s.z1 - 0.55]} />}
                <MesaLateral position={[s.x1 - 0.45, 0, s.z1 - 0.55]} abajur={v !== 1} />
              </>
            )}
          </group>
        );
      })}

      {/* recepção: tapete de boas-vindas, sala de espera dos dois lados do caminho, a logo atrás do balcão */}
      {rec && (
        <group>
          <Tapete position={[cx(rec), rec.z1 - 2.05]} largura={LARG - 0.5} profundidade={3.1} cor="#2B2F36" borda={sede.cor} />
          <MesaLateral position={[rec.x0 + 0.6, 0, rec.z1 - 3.55]} />
          <Poltrona position={[cx(rec) + 1.75, 0, rec.z1 - 2.6]} rotation={-Math.PI / 2} cor="#1F2937" />
          <Poltrona position={[cx(rec) + 1.75, 0, rec.z1 - 1.5]} rotation={-Math.PI / 2} cor="#1F2937" />
          <LuminariaChao position={[rec.x1 - 0.4, 0, rec.z1 - 3.4]} />
          <PainelLogo position={[cx(rec) - 1.65, 0, rec.z1 - 6.3]} largura={2.0} altura={1.75} cor={sede.cor} fundo={sede.escura} logo={sede.icone} />
          <Ficus position={[cx(rec) + 1.6, 0, rec.z1 - 6.3]} />
          {/* placa com a logo na frente do balcão, virada para quem entra */}
          <PainelLogo position={[cx(rec) - 0.85, 0.32, rec.z1 - 3.83]} largura={0.62} altura={0.55} cor={sede.cor} fundo={sede.escura} logo={sede.icone} pe={false} />
          <Ficus position={[rec.x0 + 0.5, 0, rec.z0 + 0.6]} escala={0.8} />
        </group>
      )}

      {/* corredor: quadros na parede norte (a que a câmera vê) e floreiras na do sul, sempre entre as portas */}
      {trechos.map((xm, i) => (
        <group key={xm}>
          <QuadroArte position={[xm, 0.68, ZC - CORREDOR / 2 + 0.08]} largura={1.1} altura={0.6} paleta={i + 2} />
          <Floreira position={[xm, 0, ZC + CORREDOR / 2 - 0.26]} comprimento={2.4} flores={i % 2 === 0} />
        </group>
      ))}

      {/* café: bebedouro, mesa alta com banquetas (os agentes param em [X0 + 2,2; ZC ± 0,5]) */}
      <Bebedouro position={[X0 + 0.4, 0, ZC - 1.05]} rotation={Math.PI / 2} />
      <MesaAlta position={[X0 + 2.1, 0, ZC + 1.05]} lugares={[[-0.55, 0.15]]} />

      {/* sala de reunião: tapete sob a mesa, plantas nos cantos do lado do corredor e uma lousa */}
      {reuniao && (
        <group>
          <Tapete position={[cx(reuniao), (reuniao.z0 + reuniao.z1) / 2 + 0.5]} largura={4.3} profundidade={7.9} cor="#1E293B" borda="#94A3B8" />
          <Ficus position={[reuniao.x0 + 0.5, 0, reuniao.z0 + 0.6]} escala={0.85} />
          <Ficus position={[reuniao.x1 - 0.5, 0, reuniao.z0 + 0.6]} escala={0.85} />
          <Lousa position={[reuniao.x0 + 0.42, 0, (reuniao.z0 + reuniao.z1) / 2 - 3.6]} rotation={Math.PI / 2} largura={1.1} />
        </group>
      )}
    </group>
  );
}

function NomeSala({ s }: { s: Sala }) {
  return (
    <Html position={[cx(s), 2.2, s.norte ? s.z0 + 1.1 : s.z1 - 1.1]} center zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
      <div className="select-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow" style={{ background: "rgba(14,16,19,.84)", boxShadow: `inset 0 0 0 1.5px ${s.cor}` }}>{s.nome}</div>
    </Html>
  );
}

// ---------- um agente com rotina ----------
type Ponto = [number, number];
// troca interna de verdade (rota /api/workend/equipe/atividade): quem fala vai até "para" com o texto
type Aviso = { para: string; texto: string; tipo?: "pedido" | "resposta" };
type Plano = { pts: Ponto[]; i: number; ate: number; pose: Pose; olhar?: number; fala?: string; fim?: "sentar" | "parado" };
interface Contexto { sede: Sede; salas: Sala[]; salaDe: Record<string, Sala>; lugarDe: Record<string, Lugar>; ordem: Membro[]; porId: Record<string, Membro>; lugares: Record<string, Lugar[]>; posNaSala: Record<string, number> }
// caminho de um ponto numa sala até outro ponto noutra sala: sai pela porta, anda pelo corredor e entra pela outra porta
function caminho(de: Ponto, salaA: Sala | undefined, para: Ponto, salaB: Sala | undefined): Ponto[] {
  const pts: Ponto[] = [de];
  if (salaA) { pts.push([cx(salaA), zDentro(salaA)]); pts.push([cx(salaA), ZC]); }
  if (salaB) { pts.push([cx(salaB), ZC]); pts.push([cx(salaB), zDentro(salaB)]); } else pts.push([para[0], ZC]);
  pts.push(para);
  return pts;
}

function Agente({ m, ctx, avisos, dono }: { m: Membro; ctx: Contexto; avisos: React.RefObject<Map<string, Aviso>>; dono: boolean }) {
  const corpo = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const { def, camisa } = useMemo(() => aparenciaAgente(m), [m]);
  const lugar = ctx.lugarDe[m.id];
  const sala = ctx.salaDe[m.id];
  const sentar: Plano = useMemo(() => ({ pts: lugar ? [[lugar.pos[0], lugar.pos[2]]] : [[OS_X, ZC]], i: 0, ate: 0, pose: m.nivel === "ceo" ? "think" : "type", fim: "sentar" }), [lugar, m.nivel]);
  const plano = useRef<Plano>(sentar);
  const [fala, setFala] = useState<string | null>(null);
  const [real, setReal] = useState<string | null>(null); // conversa interna de verdade: nome de quem recebeu o pedido
  const fase = useMemo(() => (hash(m.id) % 97) / 10, [m.id]);
  useAnimacao(h, () => plano.current.pose, fase, HIPS.procedural.base);
  const [hover, setHover] = useState(false);
  // a recepcionista fala com quem chega na recepção (17/11/2026, ui/Recepcao.tsx)
  const falaRec = usePersonagem((s) => (m.papel === "atendente" && s.falaRecepcao?.chave === ctx.sede.chave ? s.falaRecepcao.texto : null));

  // escolhe o próximo passeio: colega (chefe ou alguém da equipe), reunião ou café; volta para a mesa depois
  const novoPasseio = (agora: number, pedido?: Aviso) => {
    const aqui = corpo.current ? ([corpo.current.position.x, corpo.current.position.z] as Ponto) : sentar.pts[0];
    let destino: Ponto, salaB: Sala | undefined, texto: string | undefined, fica: number;
    const colega = pedido ? ctx.porId[pedido.para] : (() => {
      const opc = ctx.ordem.filter((o) => o.id !== m.id && (o.chefeId === m.id || o.id === m.chefeId || ctx.salaDe[o.id] === sala));
      return opc.length ? opc[Math.floor(Math.random() * opc.length)] : null;
    })();
    const sorte = Math.random();
    if (colega && ctx.lugarDe[colega.id] && (pedido || sorte < 0.6)) {
      const l = ctx.lugarDe[colega.id]; destino = [l.pos[0] + 0.75, l.pos[2] + 0.55]; salaB = ctx.salaDe[colega.id];
      texto = pedido?.texto ?? (m.nivel === "ceo" || m.nivel === "gerente" || m.nivel === "diretor" ? FRASES_CHEFE : FRASES_EQUIPE)[Math.floor(Math.random() * 5)];
      fica = pedido ? 9 : 6 + Math.random() * 4;
    } else if (sorte < 0.85) {
      const r = ctx.salas.find((s) => s.tipo === "reuniao"); salaB = r;
      destino = r ? [cx(r) + (Math.random() < 0.5 ? -1.5 : 1.5), (r.z0 + r.z1) / 2 + 0.6 + (Math.random() * 4 - 2)] : [OS_X, ZC];
      fica = 14 + Math.random() * 10; texto = undefined;
    } else { destino = [X0 + 2.2, ZC + (Math.random() - 0.5)]; salaB = undefined; fica = 6; texto = undefined; }
    const ida = caminho(aqui, sala, destino, salaB);
    plano.current = { pts: ida, i: 1, ate: agora, pose: "walk", fala: texto, fim: "parado", olhar: fica };
    // pedido de verdade: o balão já aparece na saída (com para quem é), sem esperar a caminhada
    if (pedido && colega) { setFala(pedido.texto); setReal(`${pedido.tipo === "resposta" ? "resposta para" : "pedido para"} ${colega.nome}`); }
  };

  useEffect(() => { plano.current = sentar; }, [sentar]);
  const proxima = useRef(0);
  useFrame((estado, dt) => {
    const g = corpo.current; if (!g) return;
    const t = estado.clock.elapsedTime, p = plano.current;
    if (!proxima.current) proxima.current = t + 8 + (hash(m.id) % 30);
    // pedido de verdade (dono): este agente vai até quem recebeu a tarefa
    const real = avisos.current?.get(m.id);
    if (real && p.fim === "sentar") { avisos.current?.delete(m.id); novoPasseio(t, real); return; }
    if (p.pose === "walk") {
      const alvo = p.pts[p.i];
      const dx = alvo[0] - g.position.x, dz = alvo[1] - g.position.z, d = Math.hypot(dx, dz), passo = 1.35 * Math.min(dt, 0.1);
      if (d > 0.05) { g.position.x += (dx / d) * Math.min(passo, d); g.position.z += (dz / d) * Math.min(passo, d); g.rotation.y = Math.atan2(dx, dz); return; }
      if (p.i < p.pts.length - 1) { p.i++; return; }
      // chegou
      if (p.fim === "sentar") { p.pose = m.nivel === "ceo" ? "think" : "type"; g.rotation.y = 0; proxima.current = t + 18 + Math.random() * 30; setFala(null); setReal(null); return; }
      p.pose = "idle"; p.ate = t + (p.olhar ?? 6); if (p.fala) setFala(p.fala);
      return;
    }
    if (p.fim === "parado" && t > p.ate) {
      // volta para a mesa
      setFala(null); setReal(null);
      const aqui: Ponto = [g.position.x, g.position.z];
      const dest = sentar.pts[0];
      const salaAqui = ctx.salas.find((s) => aqui[0] >= s.x0 && aqui[0] <= s.x1 && aqui[1] >= s.z0 && aqui[1] <= s.z1);
      plano.current = { pts: caminho(aqui, salaAqui, dest, sala), i: 1, ate: 0, pose: "walk", fim: "sentar" };
      return;
    }
    // a recepcionista não sai do balcão (atende quem entra pela porta, ui/Recepcao.tsx)
    if (p.fim === "sentar" && t > proxima.current) { if (m.papel === "atendente") { proxima.current = t + 3600; return; } if (leve() && Math.random() < 0.5) { proxima.current = t + 25; return; } novoPasseio(t); }
  });

  const inicio = sentar.pts[0];
  // dono: abre a conversa com esta pessoa no mapa (ChatEquipe); visitante: o cartão da sede
  const clicar = () => { if (dono) void abrirChatEquipe(ctx.sede.chave, m.id); else useMundo.getState().selecionarLote(ctx.sede.chave); };
  return (
    <group ref={corpo} position={[inicio[0], 0, inicio[1]]}>
      <BonecoProcedural ref={h} def={def} camisa={camisa} headset={m.papel === "atendente"} cracha={m.nivel === "ceo" ? "#D4A017" : "#1D4ED8"} />
      <mesh position={[0, 0.7, 0]} onClick={(e) => { e.stopPropagation(); clicar(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.4, 0.4, 1.5, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(fala || hover || falaRec) && (
        <Html position={[0, 1.75, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max max-w-[220px] select-none rounded-2xl bg-white/95 px-2.5 py-1.5 text-[12px] leading-snug text-[#1D2128] shadow-md">
            <b>{m.nome}</b><span className="ml-1 text-[#5B6472]">{hover && !fala ? m.cargo : ""}</span>
            {fala && <span className="block font-medium">{fala}</span>}
            {!fala && falaRec && <span className="block font-medium">{falaRec}</span>}
            {dono && fala && real && <span className="mt-0.5 block text-[10.5px] text-[#5B6472]">conversa interna · {real}</span>}
            {dono && hover && <span className="mt-0.5 block text-[10.5px] font-semibold text-[#1D4ED8]">Toque para conversar</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

// conversas internas de verdade (só o dono): a cada 15 s pergunta as últimas trocas e faz quem pediu ir até quem recebeu
function useAtividade(dono: boolean, avisos: React.RefObject<Map<string, Aviso>>, chave: string) {
  useEffect(() => {
    if (!dono) return;
    let vivo = true; let ultimo = "";
    const ler = async () => {
      try {
        const r = await fetch(`/api/workend/equipe/atividade?chave=${encodeURIComponent(chave)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        // formato da rota: { trocas: [{ de, para, texto, em, tipo: "pedido" | "resposta" }] }
        const lista: ({ de: string; em: string } & Aviso)[] = Array.isArray(j) ? j : j.trocas ?? j.atividade ?? j.itens ?? [];
        const novos = lista.filter((x) => x.em > ultimo).sort((a, b) => (a.em < b.em ? -1 : 1));
        if (ultimo) for (const x of novos.slice(-6)) avisos.current?.set(x.de, { para: x.para, texto: x.texto, tipo: x.tipo });
        if (lista.length) ultimo = lista.reduce((a, x) => (x.em > a ? x.em : a), ultimo);
      } catch { /* sem rede: tenta de novo */ }
    };
    void ler(); const id = setInterval(() => { if (vivo && document.visibilityState === "visible") void ler(); }, 15000);
    return () => { vivo = false; clearInterval(id); };
  }, [dono, avisos, chave]);
}

export function InteriorSede({ sede }: { sede: Sede }) {
  const e: Escritorio | null = useMundo((s) => s.terrenos[sede.chave]?.escritorio ?? null);
  // dono ou sócio (17/11/2026: as sedes podem ser divididas, terreno.socios)
  const dono = useMundo((s) => s.meus.includes(sede.chave));
  const poucos = useMemo(() => leve(), []);
  const avisos = useRef(new Map<string, Aviso>());
  useAtividade(dono, avisos, sede.chave);
  const ctx = useMemo<Contexto | null>(() => {
    if (!e) return null;
    const salas = montarSalas(e.setores);
    const porSala: Record<string, Membro[]> = {};
    for (const m of e.equipe) { const s = m.setorId ?? (m.papel === "ceo" ? "diretoria" : "recepcao"); (porSala[s] ??= []).push(m); }
    const salaDe: Record<string, Sala> = {}, lugarDe: Record<string, Lugar> = {}, lugares: Record<string, Lugar[]> = {}, posNaSala: Record<string, number> = {};
    for (const s of salas) {
      const membros = (porSala[s.id] ?? []).sort((a, b) => Number(b.nivel === "ceo" || b.nivel === "gerente") - Number(a.nivel === "ceo" || a.nivel === "gerente"));
      if (s.tipo === "recepcao") { for (const m of membros) { salaDe[m.id] = s; lugarDe[m.id] = { pos: [cx(s), 0, s.z1 - 4.9], mesa: [cx(s), 0, s.z1 - 4.2], chefe: false }; } continue; }
      if (s.tipo !== "depto") continue;
      const ls = lugaresDaSala(s, membros.length); lugares[s.id] = ls;
      membros.forEach((m, k) => { if (ls[k]) { salaDe[m.id] = s; lugarDe[m.id] = ls[k]; posNaSala[m.id] = k; } });
    }
    const ordem = e.equipe.filter((m) => lugarDe[m.id]);
    return { sede, salas, salaDe, lugarDe, ordem, porId: Object.fromEntries(ordem.map((m) => [m.id, m])), lugares, posNaSala };
  }, [e, sede]);
  if (!e || !ctx) return null;
  // gráficos leves: duas pessoas por sala (o chefe e mais uma), também andando, só que com menos frequência
  const mostrar = poucos ? ctx.ordem.filter((m) => (ctx.posNaSala[m.id] ?? 0) < 2) : ctx.ordem;
  // desenhada em volta do centro da Social RP: quem desloca para o quarteirão de cada sede é a torre (SedeHQ), que
  // monta este interior dentro do grupo dela
  return (
    <group>
      <Estatico><Fixos salas={ctx.salas} lugares={ctx.lugares} sede={sede} /></Estatico>
      <LuzDasLuminarias />
      {ctx.salas.map((s) => <NomeSala key={s.id} s={s} />)}
      {mostrar.map((m) => <Agente key={m.id} m={m} ctx={ctx} avisos={avisos} dono={dono} />)}
    </group>
  );
}
