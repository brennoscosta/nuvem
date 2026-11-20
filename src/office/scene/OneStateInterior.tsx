"use client";
// Sede da Social RP (antes OneState) por dentro. 16/11/2026, pedido do dono: "por que os bonecos das salas só ficam
// parados e são todos iguais? Não faz sentido" e "que a empresa tenha suas áreas como assistentes, gerentes, CEO, setor
// financeiro". Na vista por dentro a torre some e aparece a planta no térreo, aberta como casa de bonecas:
//  - um corredor no meio (leste-oeste) com as salas dos departamentos dos dois lados (a equipe gravada no lote da sede,
//    scripts/sede-socialrp.mjs), a recepção na porta da rua, o hall com o café e a sala de reunião;
//  - cada agente com aparência própria (pele, cabelo, roupa, calça e tênis tirados do id): chefes de blazer, a equipe de
//    camisa na cor do departamento;
//  - rotina viva: trabalham sentados um tempo, levantam, vão à mesa de um colega (chefe ou equipe) conversar com balão,
//    vão à reunião ou ao café e voltam. Para o dono, as conversas internas de verdade (delegação de tarefas, endpoint
//    /api/workend/equipe/atividade) também viram caminhada + balão com o texto real.
// 19/11/2026 (pedido do dono: cada sede num lote só): a planta compacta de 19,2 x 14,4 m (data/plantaSede.ts), com salas
// de 3,2 x 6,4 m e mesas compactas; todo mundo da equipe tem lugar (5 por sala). Desenhada em coordenadas do lote: quem
// leva para o lote da sede, girado para a rua da frente, é o grupo da torre (scene/OneStateHQ.tsx › SedeHQ).
// Tudo que se mexe é atualizado direto nos objetos (useFrame + refs); o React só redesenha quando um balão aparece.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { caixa, cilindro, mat, plano } from "./geo";
import { Estatico } from "./Estatico";
import { Mesa, Balcao, Sofa, Planta, Cafe, Tapete, Estante, LuminariaChao, Bebedouro, QuadroArte, PainelLogo, Ficus, Floreira, MesaAlta, Lousa, LuzDasLuminarias } from "./Moveis";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle, type Pose } from "./Boneco";
import { leve } from "./qualidade";
import { useMundo } from "../mundoStore";
import { abrirChatEquipe } from "../ui/ChatEquipe";
import { usePersonagem } from "../personagemStore";
import { aparenciaAgente, hash } from "../data/aparenciaAgente";
import type { Sede } from "../data/sedes";
import type { Escritorio, Membro } from "../data/escritorio";
import { W, D, X0, Z0, X1, Z1, CORREDOR, ZC, POR_FILEIRA, LARG, cx, zDentro, montarSalas, paredesDaSede, lugaresDaSala, catracasDaSede, BALCAO_SEDE, MOVEIS_SEDE, CAFE_SEDE, Z_RECEPCAO, type Sala, type LugarSede } from "../data/plantaSede";
import { Catracas } from "./Catraca";

// ---------- planta (salas em src/office/data/plantaSede.ts) ----------
const ALT = 1.15;
const ZM = (Z0 + Z1) / 2; // meio da planta em z (x = 0)
const ZN = ZC - CORREDOR / 2, ZS = ZC + CORREDOR / 2; // paredes do corredor

const clarear = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };

type Lugar = LugarSede; // lugares de trabalho: data/plantaSede.ts › lugaresDaSala (o andar por dentro usa os mesmos)

// frases da rotina (genéricas: os visitantes não veem nada da empresa); o dono vê as conversas de verdade
const FRASES_CHEFE = ["Como está essa entrega?", "Preciso disso até o fim do dia.", "Bom trabalho, vamos fechar.", "Me manda o resumo depois.", "Prioridade agora é essa."];
const FRASES_EQUIPE = ["Terminei a minha parte.", "Pode revisar pra mim?", "Tenho uma ideia pra isso.", "Já te mando os números.", "Fechado, sigo nisso."];

// ---------- paredes e móveis (juntados num objeto só) ----------
function Fixos({ salas, lugares, sede }: { salas: Sala[]; lugares: Record<string, Lugar[]>; sede: Sede }) {
  const parede = mat("#F4F1EB", { rough: 0.9 }), friso = mat(sede.cor, { rough: 0.35, metal: 0.7 });
  // paredes: data/plantaSede.ts › paredesDaSede (as mesmas que barram o personagem por dentro, data/plantaInterna.ts)
  const pedacos = paredesDaSede(salas);
  const rec = salas.find((s) => s.tipo === "recepcao");
  const reuniao = salas.find((s) => s.tipo === "reuniao");
  const M = MOVEIS_SEDE, cadeira = mat("#1F2937", { rough: 0.7 });
  return (
    <group>
      <mesh geometry={caixa(W + 0.8, 0.1, D + 0.8)} material={mat("#D8D4CC", { rough: 0.95 })} position={[0, 0.05, ZM]} receiveShadow />
      {/* corredor: piso de granito com friso na cor da marca */}
      <mesh geometry={plano(W - 0.1, CORREDOR - 0.1)} material={mat("#B9B3A8", { rough: 0.6 })} position={[0, 0.11, ZC]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {[-0.4, 0.4].map((dz) => <mesh key={dz} geometry={plano(W - 0.4, 0.05)} material={friso} position={[0, 0.115, ZC + dz]} rotation={[-Math.PI / 2, 0, 0]} />)}
      {salas.map((s) => <mesh key={s.id} geometry={plano(s.x1 - s.x0 - 0.1, s.z1 - s.z0 - 0.1)} material={mat(clarear(s.cor, s.tipo === "depto" ? 0.74 : 0.62), { rough: 0.9 })} position={[cx(s), 0.11, (s.z0 + s.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />)}
      {pedacos.map((p, i) => <mesh key={i} geometry={caixa(+p.w.toFixed(3), ALT, +p.d.toFixed(3))} material={parede} position={[p.x, ALT / 2, p.z]} castShadow receiveShadow />)}
      {pedacos.map((p, i) => <mesh key={`t${i}`} geometry={caixa(+p.w.toFixed(3), 0.05, +(p.d + 0.02).toFixed(3))} material={friso} position={[p.x, ALT + 0.025, p.z]} />)}
      {/* mesas compactas de cada departamento (a do chefe é maior) */}
      {salas.filter((s) => s.tipo === "depto").flatMap((s) => (lugares[s.id] ?? []).map((l, k) => <Mesa key={`${s.id}${k}`} def={{ id: `${s.id}${k}`, sala: s.id, pos: l.mesa, rot: 0, tipo: l.chefe ? "gerente" : "comum" }} cor={s.cor} compacta />))}
      {/* recepção: balcão de frente para a porta da rua, sofá encostado na parede leste e um vaso */}
      {rec && <group><Balcao position={[BALCAO_SEDE.x, 0, BALCAO_SEDE.z]} /><Sofa position={[M.sofa.x, 0, M.sofa.z]} rotation={-Math.PI / 2} cor={sede.cor} largura={1.8} /><Planta position={[M.vaso.x, 0, M.vaso.z]} /></group>}
      {/* sala de reunião: mesa, 4 cadeiras e a TV na parede da recepção */}
      {reuniao && (
        <group>
          <mesh geometry={caixa(1.0, 0.08, 1.7)} material={mat("#3A3F47", { rough: 0.5 })} position={[M.reuniao.x, 0.74, M.reuniao.z]} castShadow />
          <mesh geometry={cilindro(0.1, 0.16, 0.72, 10)} material={mat("#2A2D33")} position={[M.reuniao.x, 0.36, M.reuniao.z]} />
          {[-0.4, 0.4].flatMap((dz) => [-1, 1].map((s) => <mesh key={`${dz}${s}`} geometry={caixa(0.46, 0.48, 0.46)} material={cadeira} position={[M.reuniao.x + s * 0.75, 0.24, M.reuniao.z + dz]} castShadow />))}
          <mesh geometry={caixa(1.5, 0.85, 0.06)} material={mat("#0B0F15", { emissive: "#1D4ED8", ei: 0.35 })} position={[cx(reuniao), 1.55, Z_RECEPCAO - 0.1]} />
        </group>
      )}
      {/* hall: café no balcão da parede leste, bebedouro e mesa alta */}
      <Cafe position={[M.cafe.x, 0, M.cafe.z]} rotation={-Math.PI / 2} />
      <Bebedouro position={[M.bebedouro.x, 0, M.bebedouro.z]} rotation={-Math.PI / 2} />
      <MesaAlta position={[M.mesaAlta.x, 0, M.mesaAlta.z]} lugares={[[0, 0.45]]} />
      {/* vasos nas pontas do corredor */}
      <Planta position={[X0 + 0.4, 0, ZC]} />
      <Planta position={[X1 - 0.4, 0, ZC]} />
      <DecorSede salas={salas} sede={sede} />
    </group>
  );
}

// ---------- decoração da sede (17/11/2026, pedido do dono: "essa empresa precisa ficar mais bonita, precisa de mais decoração
// e móveis"; 19/11/2026: refeita para as salas compactas) ----------
// Livre de propósito: a porta de cada sala (cx, largura 1,1), o corredorzinho do meio das mesas (x = cx ± 0,3), o
// corredor (z = ZC) e, na recepção, o caminho da porta da rua até o balcão e dele até o hall. Nas salas do sul (perto da
// câmera, que olha da frente) só coisas baixas na parede da frente; as altas ficam no fundo das salas do norte e na
// parede do corredor, ao lado da porta.
const escurecer = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0"); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };
function DecorSede({ salas, sede }: { salas: Sala[]; sede: Sede }) {
  const deptos = salas.filter((s) => s.tipo === "depto");
  const rec = salas.find((s) => s.tipo === "recepcao"), reuniao = salas.find((s) => s.tipo === "reuniao");
  // trechos de parede do corredor entre as portas: no norte, entre duas salas; no sul, entre as portas das salas, da
  // reunião e do hall
  const trechosN = Array.from({ length: POR_FILEIRA - 1 }, (_, i) => X0 + (i + 1) * LARG);
  const trechosS = [X0 + LARG, X0 + 2 * LARG, 0, X1 - 2 * LARG, X1 - LARG];
  return (
    <group>
      {deptos.map((s, i) => {
        const x = cx(s), diretoria = s.id === "diretoria", v = i % 3;
        // tapete sob as mesas, na cor do departamento (diretoria: grafite com borda na cor da marca)
        const tapete = s.norte ? { z: s.z0 + 2.95, d: 4.9 } : { z: s.z0 + 3.65, d: 4.9 };
        return (
          <group key={s.id}>
            <Tapete position={[x, tapete.z]} largura={2.95} profundidade={tapete.d} cor={diretoria ? "#3B3F47" : clarear(s.cor, 0.42)} borda={diretoria ? sede.cor : escurecer(s.cor, 0.12)} />
            {s.norte ? (
              // salas do norte: o fundo fica longe da câmera, cabem coisas altas encostadas na parede, atrás do chefe
              diretoria ? (
                <>
                  <Estante position={[x - 1.0, 0, s.z0 + 0.2]} largura={0.9} altura={1.8} />
                  <Estante position={[x + 1.0, 0, s.z0 + 0.2]} largura={0.9} altura={1.8} />
                </>
              ) : v === 0 ? (
                <>
                  <Estante position={[x - 1.0, 0, s.z0 + 0.2]} largura={0.9} />
                  <Ficus position={[s.x1 - 0.42, 0, s.z0 + 0.45]} escala={0.7} />
                </>
              ) : v === 1 ? (
                <>
                  <Lousa position={[x - 1.0, 0, s.z0 + 0.4]} largura={0.9} />
                  <Ficus position={[s.x1 - 0.42, 0, s.z0 + 0.45]} escala={0.7} />
                </>
              ) : (
                <>
                  <QuadroArte position={[x - 1.0, 0.72, s.z0 + 0.08]} largura={0.85} paleta={i} />
                  <LuminariaChao position={[s.x1 - 0.42, 0, s.z0 + 0.45]} />
                </>
              )
            ) : (
              // salas do sul: a parede da frente é o lado da câmera (só a floreira baixa); a estante fica na parede do
              // corredor, ao lado da porta
              <>
                <Estante position={[x - 1.0, 0, s.z0 + 0.2]} largura={0.85} altura={1.5} />
                <Ficus position={[x + 1.1, 0, s.z0 + 0.42]} escala={0.65} />
                <Floreira position={[x, 0, s.z1 - 0.25]} comprimento={2.5} flores={v !== 1} />
              </>
            )}
          </group>
        );
      })}

      {/* recepção: tapete de boas-vindas na porta, a logo atrás da recepcionista e a plaquinha na frente do balcão */}
      {rec && (
        <group>
          <Tapete position={[0, Z1 - 0.9]} largura={2.4} profundidade={1.2} cor="#2B2F36" borda={sede.cor} />
          <PainelLogo position={[MOVEIS_SEDE.painel.x, 0, MOVEIS_SEDE.painel.z]} largura={1.1} altura={1.2} cor={sede.cor} fundo={sede.escura} logo={sede.icone} />
          <PainelLogo position={[BALCAO_SEDE.x - 0.85, 0.32, BALCAO_SEDE.z + 0.37]} largura={0.62} altura={0.55} cor={sede.cor} fundo={sede.escura} logo={sede.icone} pe={false} />
        </group>
      )}

      {/* corredor: quadros nos trechos de parede entre as portas (nos dois lados) */}
      {trechosN.map((xm, i) => <QuadroArte key={`n${xm}`} position={[xm, 0.68, ZN + 0.08]} largura={0.9} altura={0.55} paleta={i + 2} />)}
      {trechosS.map((xm, i) => <QuadroArte key={`s${xm}`} position={[xm, 0.68, ZS - 0.08]} rotation={Math.PI} largura={0.9} altura={0.55} paleta={i} />)}

      {/* sala de reunião: tapete sob a mesa e um ficus no canto */}
      {reuniao && (
        <group>
          <Tapete position={[MOVEIS_SEDE.reuniao.x, MOVEIS_SEDE.reuniao.z]} largura={2.6} profundidade={2.3} cor="#1E293B" borda="#94A3B8" />
          <Ficus position={[reuniao.x0 + 0.4, 0, reuniao.z1 - 0.4]} escala={0.7} />
        </group>
      )}
    </group>
  );
}

// Placa com o nome da sala. 19/11/2026 (salas compactas de 3,2 m): nomes compridos mostram só a primeira palavra
// ("Comunidade e Moderação" → "Comunidade"; o nome inteiro fica no cartão da sede) e as placas de salas vizinhas ficam em
// alturas diferentes da sala (uma no fundo, a outra perto da porta), para não encostarem uma na outra
const nomeCurto = (s: Sala) => (s.tipo === "reuniao" ? "Reunião" : s.nome.length > 13 ? s.nome.split(/\s+/)[0] : s.nome);
function NomeSala({ s }: { s: Sala }) {
  // norte: pares no fundo, ímpares perto da porta; sul: as das pontas perto da porta, as do meio na frente
  const pertoDaPorta = s.tipo === "depto" && (s.norte ? s.i % 2 === 1 : s.i === 0 || s.i === POR_FILEIRA - 1);
  const z = s.tipo === "hall" || s.tipo === "reuniao" ? (s.z0 + s.z1) / 2 : s.norte ? (pertoDaPorta ? s.z1 - 1.0 : s.z0 + 1.1) : pertoDaPorta ? s.z0 + 1.0 : s.z1 - 1.1;
  return (
    <Html position={[cx(s), 2.2, z]} center zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
      <div title={s.nome} className="select-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow" style={{ background: "rgba(14,16,19,.84)", boxShadow: `inset 0 0 0 1.5px ${s.cor}` }}>{nomeCurto(s)}</div>
    </Html>
  );
}

// ---------- um agente com rotina ----------
type Ponto = [number, number];
// troca interna de verdade (rota /api/workend/equipe/atividade): quem fala vai até "para" com o texto
type Aviso = { para: string; texto: string; tipo?: "pedido" | "resposta" };
type Plano = { pts: Ponto[]; i: number; ate: number; pose: Pose; olhar?: number; fala?: string; fim?: "sentar" | "parado" };
interface Contexto { sede: Sede; salas: Sala[]; hall: Sala | undefined; salaDe: Record<string, Sala>; lugarDe: Record<string, Lugar>; ordem: Membro[]; porId: Record<string, Membro>; lugares: Record<string, Lugar[]>; posNaSala: Record<string, number> }
// do corredor até dentro da sala: o primeiro ponto fica no corredor, na frente da porta. A recepção não tem porta para o
// corredor: entra pelo hall, que é aberto para ela
function pelaPorta(s: Sala, hall: Sala | undefined): Ponto[] {
  if (s.tipo === "recepcao" && hall) return [[cx(hall), ZC], [cx(hall), (hall.z0 + hall.z1) / 2], [cx(hall), s.z0 + 0.6]];
  if (s.tipo === "hall") return [[cx(s), ZC], [cx(s), (s.z0 + s.z1) / 2]];
  return [[cx(s), ZC], [cx(s), zDentro(s)]];
}
// caminho de um ponto numa sala até outro ponto noutra sala: sai pela porta, anda pelo corredor e entra pela outra porta.
// Nas salas dos departamentos anda pelo corredorzinho do meio das mesas (x = cx) até a fila da cadeira
function caminho(de: Ponto, salaA: Sala | undefined, para: Ponto, salaB: Sala | undefined, hall: Sala | undefined): Ponto[] {
  const pts: Ponto[] = [de];
  if (salaA && salaA === salaB && salaA.tipo === "depto") { pts.push([cx(salaA), de[1]], [cx(salaA), para[1]], para); return pts; }
  if (salaA) { if (salaA.tipo === "depto") pts.push([cx(salaA), de[1]]); pts.push(...pelaPorta(salaA, hall).reverse()); }
  if (salaB) { pts.push(...pelaPorta(salaB, hall)); if (salaB.tipo === "depto") pts.push([cx(salaB), para[1]]); } else pts.push([para[0], ZC]);
  pts.push(para);
  return pts;
}
// onde fica quem vem conversar com alguém sentado: no corredorzinho do meio, ao lado da cadeira; com o chefe, na faixa
// livre junto da mesa dele (na frente dela no norte; atrás da cadeira no sul, onde a mesa encosta na parede da frente)
function pertoDe(l: Lugar, s: Sala | undefined): Ponto {
  const x = s ? cx(s) : l.pos[0];
  if (!l.chefe || !s || s.tipo !== "depto") return [x, l.pos[2]];
  return s.norte ? [x, l.mesa[2] + 0.63] : [x, l.pos[2] - 0.47];
}

function Agente({ m, ctx, avisos, dono }: { m: Membro; ctx: Contexto; avisos: React.RefObject<Map<string, Aviso>>; dono: boolean }) {
  const corpo = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const { def, camisa } = useMemo(() => aparenciaAgente(m), [m]);
  const lugar = ctx.lugarDe[m.id];
  const sala = ctx.salaDe[m.id];
  const sentar: Plano = useMemo(() => ({ pts: lugar ? [[lugar.pos[0], lugar.pos[2]]] : [[0, ZC]], i: 0, ate: 0, pose: m.nivel === "ceo" ? "think" : "type", fim: "sentar" }), [lugar, m.nivel]);
  const plano = useRef<Plano>(sentar);
  const [fala, setFala] = useState<string | null>(null);
  const [real, setReal] = useState<string | null>(null); // conversa interna de verdade: nome de quem recebeu o pedido
  const fase = useMemo(() => (hash(m.id) % 97) / 10, [m.id]);
  useAnimacao(h, () => plano.current.pose, fase, HIPS.procedural.base);
  const [hover, setHover] = useState(false);
  // a recepcionista fala com quem chega na recepção (17/11/2026, ui/Recepcao.tsx)
  // 20/11/2026: com membroId, quem fala é a pessoa do setor para onde a recepção mandou o visitante
  const falaRec = usePersonagem((s) => { const f = s.falaRecepcao; return f && f.chave === ctx.sede.chave && (f.membroId ? f.membroId === m.id : m.papel === "atendente") ? f.texto : null; });
  // atendendo um visitante encaminhado pela recepção: volta para a mesa e não sai passeando enquanto ele estiver ali
  const atendendo = usePersonagem((s) => s.predio?.chave === ctx.sede.chave && s.predio.liberado?.membroId === m.id);
  const atendendoRef = useRef(atendendo);
  useEffect(() => { atendendoRef.current = atendendo; }, [atendendo]);

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
      const l = ctx.lugarDe[colega.id]; salaB = ctx.salaDe[colega.id]; destino = pertoDe(l, salaB);
      texto = pedido?.texto ?? (m.nivel === "ceo" || m.nivel === "gerente" || m.nivel === "diretor" ? FRASES_CHEFE : FRASES_EQUIPE)[Math.floor(Math.random() * 5)];
      fica = pedido ? 9 : 6 + Math.random() * 4;
    } else if (sorte < 0.85) {
      const r = ctx.salas.find((s) => s.tipo === "reuniao"); salaB = r;
      destino = r ? [MOVEIS_SEDE.reuniao.x + (Math.random() < 0.5 ? -0.75 : 0.75), MOVEIS_SEDE.reuniao.z + (Math.random() < 0.5 ? -0.4 : 0.4)] : [0, ZC];
      fica = 14 + Math.random() * 10; texto = undefined;
    } else { destino = [CAFE_SEDE.x, CAFE_SEDE.z + (Math.random() - 0.5) * 1.2]; salaB = ctx.hall; fica = 6; texto = undefined; }
    const ida = caminho(aqui, sala, destino, salaB, ctx.hall);
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
    if (atendendoRef.current) { if (p.fim === "parado" && p.pose !== "walk") p.ate = 0; if (p.fim === "sentar") proxima.current = Math.max(proxima.current, t + 20); }
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
      plano.current = { pts: caminho(aqui, salaAqui, dest, sala, ctx.hall), i: 1, ate: 0, pose: "walk", fim: "sentar" };
      return;
    }
    // a recepcionista não sai do balcão (atende quem entra pela porta, ui/Recepcao.tsx)
    if (p.fim === "sentar" && t > proxima.current) { if (m.papel === "atendente") { proxima.current = t + 3600; return; } if (leve() && Math.random() < 0.5) { proxima.current = t + 25; return; } novoPasseio(t); }
  });

  const inicio = sentar.pts[0];
  // dono: abre a conversa com esta pessoa no mapa (ChatEquipe); visitante: o cartão da sede
  // estando dentro deste prédio (17/11/2026), clicar numa pessoa também leva o personagem até ela (data/plantaInterna.ts)
  const dentroDaqui = () => { const p = usePersonagem.getState().predio; return !!p && p.chave === ctx.sede.chave && (p.fase === "recepcao" || p.fase === "dentro"); };
  const clicar = (px: number, pz: number) => {
    if (dono) { void abrirChatEquipe(ctx.sede.chave, m.id); if (dentroDaqui()) usePersonagem.getState().irPara(px, pz); }
    else if (dentroDaqui()) usePersonagem.getState().irPara(px, pz);
    else useMundo.getState().selecionarLote(ctx.sede.chave);
  };
  return (
    <group ref={corpo} position={[inicio[0], 0, inicio[1]]}>
      <BonecoProcedural ref={h} def={def} camisa={camisa} headset={m.papel === "atendente"} cracha={m.nivel === "ceo" ? "#D4A017" : "#1D4ED8"} />
      <mesh position={[0, 0.7, 0]} onClick={(e) => { e.stopPropagation(); clicar(e.point.x, e.point.z); }}
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
      if (s.tipo === "recepcao") { for (const m of membros) { salaDe[m.id] = s; lugarDe[m.id] = { pos: [BALCAO_SEDE.x, 0, BALCAO_SEDE.z - 0.7], mesa: [BALCAO_SEDE.x, 0, BALCAO_SEDE.z], chefe: false }; } continue; }
      if (s.tipo !== "depto") continue;
      const ls = lugaresDaSala(s, membros.length); lugares[s.id] = ls;
      membros.forEach((m, k) => { if (ls[k]) { salaDe[m.id] = s; lugarDe[m.id] = ls[k]; posNaSala[m.id] = k; } });
    }
    const ordem = e.equipe.filter((m) => lugarDe[m.id]);
    return { sede, salas, hall: salas.find((s) => s.tipo === "hall"), salaDe, lugarDe, ordem, porId: Object.fromEntries(ordem.map((m) => [m.id, m])), lugares, posNaSala };
  }, [e, sede]);
  const catracas = useMemo(() => (ctx ? catracasDaSede(ctx.salas) : []), [ctx]);
  if (!e || !ctx) return null;
  // gráficos leves: duas pessoas por sala (o chefe e mais uma), também andando, só que com menos frequência
  const mostrar = poucos ? ctx.ordem.filter((m) => (ctx.posNaSala[m.id] ?? 0) < 2) : ctx.ordem;
  // desenhada em coordenadas do lote: quem leva para o lote de cada sede, girado para a rua, é a torre (SedeHQ), que
  // monta este interior dentro do grupo dela
  return (
    <group>
      <Estatico><Fixos salas={ctx.salas} lugares={ctx.lugares} sede={sede} /></Estatico>
      <Catracas chave={sede.chave} lista={catracas} dentro={-1} />
      <LuzDasLuminarias />
      {ctx.salas.map((s) => <NomeSala key={s.id} s={s} />)}
      {mostrar.map((m) => <Agente key={m.id} m={m} ctx={ctx} avisos={avisos} dono={dono} />)}
    </group>
  );
}
