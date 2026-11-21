"use client";
// Passaporte da cidade (20/11/2026, frente "visitante"; pedido do dono: "temos que pensar em formas que seja prazerosa
// para a pessoa que vai consumir os serviços do workend"). Parece um passaporte de verdade, folheado página a página:
//  - capa de couro azul com o brasão dourado;
//  - página de identificação: retrato do personagem, número, emissão, insígnias e a linha de máquina embaixo;
//  - páginas de carimbos: cada lugar onde a pessoa foi atendida na recepção carimba do seu jeito, meio torto, como no
//    balcão de verdade (ui/Carimbo.tsx);
//  - lugares que ainda faltam carimbar, com "Ir até lá" (leva movimento às lojas);
//  - vistos especiais (os marcos), com a peça exclusiva que cada um dá;
//  - recados dos moradores (pedidos de hoje e as assinaturas de quem você ajudou) e, no Natal, a caça aos presentes.
// No computador abre em duas páginas lado a lado; no celular, uma por vez. Setas do teclado folheiam; Esc fecha.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePassaporte, usarItem, type Passaporte, type CarimboTela, type MarcoTela } from "../passaporteStore";
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { useMoradores, segundosCidade } from "../moradorStore";
import { entradasDaCidade } from "../data/entradas";
import { MORADOR_POR_ID, estadoMorador } from "../data/moradores";
import { linhaMaquina, estiloDoCarimbo, NATAL_META } from "../data/passaporte";

import { Carimbo, dataCarimbo, ESTILO_CARIMBO } from "./Carimbo";
import { MiniAvatar } from "./MiniAvatar";
import { Icone, ICONE_ACESSORIO } from "./Icone";
import { brl } from "./equipeComum";
import { dicaDoPresente } from "./CacaNatal";

const TINTA = "#1E2A44", PAPEL = "#F5F0E4";
const POR_PAGINA = 4;
// onde cada carimbo cai na página (centro, em %): duas colunas, meio desencontradas, como quem carimba no balcão
const LUGAR_NA_PAGINA: [number, number][] = [[29, 27], [71, 33], [31, 71], [70, 75]];


// fundo de segurança das páginas (ondas finas, como as de papel-moeda)
function Guilhoche({ cor = "#2F6F7E", opacidade = 0.13 }: { cor?: string; opacidade?: number }) {
  const ondas = useMemo(() => Array.from({ length: 9 }, (_, k) => {
    let d = ""; for (let x = 0; x <= 200; x += 4) { const y = 20 + k * 20 + Math.sin(x / 13 + k * 0.7) * 6 + Math.sin(x / 31 + k) * 4; d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`; }
    return d;
  }), []);
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: opacidade }}>
      {ondas.map((d, i) => <path key={i} d={d} fill="none" stroke={cor} strokeWidth="0.45" />)}
      <circle cx="100" cy="100" r="62" fill="none" stroke={cor} strokeWidth="0.35" strokeDasharray="1.2 1.6" />
      <circle cx="100" cy="100" r="48" fill="none" stroke={cor} strokeWidth="0.3" />
    </svg>
  );
}

function Pagina({ numero, titulo, children, guia }: { numero: number; titulo?: string; children: ReactNode; guia?: string }) {
  return (
    <section data-guia={guia} data-pagina={numero} className="relative flex h-full min-h-0 flex-col overflow-hidden px-4 pb-3 pt-3" style={{ background: PAPEL, color: TINTA }}>
      <Guilhoche />
      <div className="relative flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-[#1E2A44]/55">
        <span>{titulo ?? "Cidade WorkEnd"}</span><span>{numero}</span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Capa({ abrir }: { abrir: () => void }) {
  return (
    <div data-guia="passaporte-capa" className="relative mx-auto flex aspect-[88/125] w-[min(330px,82vw)] flex-col items-center justify-between overflow-hidden rounded-[14px] px-6 py-8 text-center shadow-2xl"
      style={{ background: "radial-gradient(120% 90% at 30% 20%, #23365C 0%, #16243F 55%, #0F1A30 100%)", color: "#D7B25A", boxShadow: "inset 0 0 0 2px rgba(215,178,90,.25), inset 10px 0 18px rgba(0,0,0,.35), 0 24px 60px rgba(0,0,0,.45)" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.34em]">Cidade WorkEnd</div>
      <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="60" r="54" strokeWidth="2" /><circle cx="60" cy="60" r="47" strokeWidth="0.9" strokeDasharray="2 3" />
        <path d="M30 78V58h10v20M44 78V46h12v32M60 78V36h12v42M76 78V54h12v24" strokeWidth="2" />
        <path d="M24 78h72" strokeWidth="2.2" />
        <path d="M60 17l3 8 8 .2-6.4 5 2.3 7.8L60 33.5 53.1 38l2.3-7.8-6.4-5 8-.2z" strokeWidth="1.4" fill="currentColor" fillOpacity=".25" />
        <path d="M40 92c6 4 13 6 20 6s14-2 20-6" strokeWidth="1.4" />
      </svg>
      <div>
        <div className="font-serif text-[26px] font-bold uppercase tracking-[0.16em]">Passaporte</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.28em] opacity-80">da cidade</div>
      </div>
      <button type="button" onClick={abrir} data-guia="passaporte-abrir" className="rounded-full px-5 py-2 text-[13px] font-bold uppercase tracking-[0.14em] ring-1 ring-[#D7B25A]/60 transition hover:bg-[#D7B25A] hover:text-[#16243F]">Abrir</button>
    </div>
  );
}

function Identidade({ d }: { d: Passaporte }) {
  const emitido = dataCarimbo(d.emitido);
  const [l1, l2] = linhaMaquina(d.nome, d.numero, d.emitido.slice(0, 10));
  const campo = (rotulo: string, valor: ReactNode) => <div className="min-w-0"><div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#1E2A44]/55">{rotulo}</div><div className="truncate text-[13px] font-semibold">{valor}</div></div>;
  return (
    <Pagina numero={1} titulo="Identificação" guia="passaporte-identidade">
      <div className="flex h-full flex-col">
        <div className="mt-3 flex gap-3">
          <div className="shrink-0 rounded-md bg-white/70 p-1 ring-1 ring-[#1E2A44]/15">
            {d.boneco ? <MiniAvatar boneco={d.boneco} roupa={d.roupa ?? "#1D4ED8"} acessorios={d.acessorios} tamanho={84} /> : <div className="grid h-[84px] w-[84px] place-items-center text-[#1E2A44]/40"><Icone nome="pessoa" tamanho={40} /></div>}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-1.5">
            <div className="col-span-2">{campo("Nome", d.nome || "Visitante")}</div>
            {campo("Número", <span className="font-mono tracking-wider">{d.numero}</span>)}
            {campo("Emitido em", emitido)}
            {campo("Carimbos", <b data-teste="total-carimbos">{d.total}</b>)}
            {campo("Próximo visto", d.proximo ? `${d.proximo.insignia} · falta${d.proximo.falta > 1 ? "m" : ""} ${d.proximo.falta}` : "Todos!")}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#1E2A44]/55">Insígnias</div>
          {d.insignias.length ? (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {d.insignias.map((i) => <li key={i.id} title={i.frase} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: i.cor }}><Icone nome="estrela" tamanho={12} traco={2.2} />{i.nome}</li>)}
            </ul>
          ) : <p className="mt-0.5 text-[12px] text-[#1E2A44]/65">A primeira chega com 3 carimbos.</p>}
        </div>
        <div className="mt-auto rounded bg-white/55 px-1.5 py-1 font-mono text-[9.5px] leading-[1.35] tracking-[0.06em] text-[#1E2A44]/80" aria-hidden="true">
          <div className="truncate">{l1}</div><div className="truncate">{l2}</div>
        </div>
      </div>
    </Pagina>
  );
}

function PaginaCarimbos({ numero, lista, d, primeira }: { numero: number; lista: CarimboTela[]; d: Passaporte; primeira: boolean }) {
  return (
    <Pagina numero={numero} titulo="Vistos e carimbos" guia={primeira ? "passaporte-carimbos" : undefined}>
      {lista.length === 0 ? (
        <div className="grid h-full place-items-center px-3 text-center">
          <div>
            <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true" className="mx-auto opacity-25"><circle cx="60" cy="60" r="50" fill="none" stroke={TINTA} strokeWidth="2.5" strokeDasharray="5 5" /></svg>
            <p className="mt-2 text-[13px] font-semibold">{d.total ? "Esta página espera o seu próximo carimbo." : "Ainda sem carimbos."}</p>
            <p className="mt-1 text-[12px] text-[#1E2A44]/70">Entre numa loja ou sede, fale com a recepção e o carimbo cai aqui.</p>
          </div>
        </div>
      ) : (
        <div className="relative h-full">
          {lista.map((c, i) => {
            const e = estiloDoCarimbo(c.chave), [cx, cy] = LUGAR_NA_PAGINA[i % POR_PAGINA];
            return (
              <div key={c.chave} className="absolute w-[46%]" style={{ left: `calc(${cx}% + ${e.dx}px)`, top: `calc(${cy}% + ${e.dy}px)`, transform: "translate(-50%, -50%)", mixBlendMode: "multiply" }}>
                <Carimbo chave={c.chave} nome={c.nome} cor={c.cor} em={c.em} logo={c.logo} tamanho={200} className="h-auto w-full" />
              </div>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}

function PaginaFaltam({ numero, d }: { numero: number; d: Passaporte }) {
  const terrenos = useMundo((s) => s.terrenos);
  const meus = useMundo((s) => s.meus);
  const fechar = usePassaporte((s) => s.fechar);
  const feitos = new Set(d.carimbos.map((c) => c.chave));
  // um carimbo por empresa: no lote em quartos (várias entradas da mesma chave) a lista mostra a empresa uma vez só
  const faltam = entradasDaCidade(terrenos).filter((e, i, todas) => todas.findIndex((x) => x.chave === e.chave) === i && !feitos.has(e.chave) && !meus.includes(e.chave) && terrenos[e.chave]?.escritorio?.equipe.some((m) => m.papel === "atendente"));
  const ir = (chave: string) => {
    const e = entradasDaCidade(useMundo.getState().terrenos).find((x) => x.chave === chave); if (!e) return;
    fechar(); usePersonagem.getState().entrarNoPredio(e);
  };
  return (
    <Pagina numero={numero} titulo="Lugares para carimbar" guia="passaporte-faltam">
      {faltam.length ? (
        <>
          <p className="mt-2 text-[12px] text-[#1E2A44]/75">Cada recepção carimba uma vez. {d.proximo ? `Mais ${d.proximo.falta} e você ganha o visto ${d.proximo.insignia}.` : ""}</p>
          <ol className="mt-2 space-y-1.5">
            {faltam.slice(0, 7).map((e) => {
              const t = terrenos[e.chave];
              return (
                <li key={e.chave} className="flex items-center gap-2 border-b border-dashed border-[#1E2A44]/20 pb-1.5">
                  <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: t?.cor ?? "#1D4ED8" }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{e.nome}</span>
                  {usePersonagem.getState().ativo && <button type="button" data-ir-carimbo={e.chave} onClick={() => ir(e.chave)} className="shrink-0 rounded-full bg-[#1E2A44] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#2B3B5E]">Ir até lá</button>}
                </li>
              );
            })}
          </ol>
        </>
      ) : <p className="mt-6 text-center text-[13px] font-semibold">Você já carimbou todos os lugares abertos. A cidade cresce toda semana: volte para ver as lojas novas.</p>}
    </Pagina>
  );
}

function Visto({ m, total }: { m: MarcoTela; total: number }) {
  const [usando, setUsando] = useState<"" | "indo" | "ok" | string>("");
  const icone = ICONE_ACESSORIO[m.item] ?? "estrela";
  const falta = Math.max(0, m.n - total);
  const usar = async () => { setUsando("indo"); const e = await usarItem(m.item); setUsando(e ?? "ok"); };
  return (
    <li data-marco={m.id} data-ganho={m.ganho ? "1" : "0"} className="relative overflow-hidden rounded-lg px-3 py-2.5" style={{ background: `linear-gradient(135deg, ${m.cor}22, ${m.cor}0d 60%, #ffffff66)`, boxShadow: `inset 0 0 0 1.5px ${m.cor}55` }}>
      <Guilhoche cor={m.cor} opacidade={0.22} />
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/80" style={{ color: m.cor, boxShadow: `0 0 0 2px ${m.cor}` }}><Icone nome={icone} tamanho={26} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: m.cor }}>Visto · {m.n} carimbos</div>
          <div className="font-serif text-[15px] font-bold leading-tight">{m.insignia}</div>
          <div className="text-[12px] leading-snug text-[#1E2A44]/75">{m.itemNome}, só para quem tem este visto{m.bonus ? ` · e ${brl(m.bonus)} em créditos de bônus` : ""}</div>
        </div>
      </div>
      {m.ganho ? (
        <div className="relative mt-1.5 flex items-center justify-between gap-2">
          <span className="rotate-[-4deg] rounded border-2 px-1.5 text-[11px] font-black uppercase tracking-[0.2em]" style={{ borderColor: m.cor, color: m.cor }}>Concedido</span>
          <button type="button" onClick={() => void usar()} disabled={usando === "indo"} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60" style={{ background: m.cor }}>{usando === "ok" ? "Usando" : usando === "indo" ? "…" : `Usar ${m.itemNome.toLowerCase()}`}</button>
        </div>
      ) : (
        <div className="relative mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1E2A44]/10"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (total / m.n) * 100)}%`, background: m.cor }} /></div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#1E2A44]/65">Falta{falta > 1 ? "m" : ""} {falta} carimbo{falta > 1 ? "s" : ""}</div>
        </div>
      )}
      {usando && usando !== "indo" && usando !== "ok" && <p className="relative mt-1 text-[11px] font-semibold text-[#B42318]">{usando}</p>}
    </li>
  );
}

function PaginaVistos({ numero, d }: { numero: number; d: Passaporte }) {
  return (
    <Pagina numero={numero} titulo="Vistos especiais" guia="passaporte-marcos">
      <ul className="mt-2 space-y-2">{d.marcos.map((m) => <Visto key={m.id} m={m} total={d.total} />)}</ul>
      <p className="mt-2 text-[11px] text-[#1E2A44]/60">Estas peças não estão à venda: só se ganham com o passaporte.</p>
    </Pagina>
  );
}

function PaginaRecados({ numero, d }: { numero: number; d: Passaporte }) {
  const fechar = usePassaporte((s) => s.fechar);
  const [, setTique] = useState(0);
  useEffect(() => { const t = setInterval(() => setTique((x) => x + 1), 4000); return () => clearInterval(t); }, []);
  const irAte = (id: string) => {
    const m = MORADOR_POR_ID[id]; if (!m) return;
    const e = estadoMorador(m, segundosCidade());
    fechar(); usePersonagem.getState().irPara(e.x, e.z); useMoradores.getState().abrir(id);
  };
  const ativos = d.pedidos.filter((p) => p.estado !== "recusado");
  return (
    <Pagina numero={numero} titulo="Recados dos moradores" guia="passaporte-recados">
      <ul className="mt-2 space-y-2">
        {ativos.map((p) => {
          const m = MORADOR_POR_ID[p.moradorId]; const e = m ? estadoMorador(m, segundosCidade()) : null;
          const texto = p.estado === "disponivel" ? `${p.morador} tem um pedido para você hoje.` : p.estado === "aceito" ? `Combinado: passar na ${p.loja?.nome ?? "loja"} e falar com a recepção.` : `Pedido cumprido na ${p.loja?.nome ?? "loja"}.`;
          return (
            <li key={p.moradorId} data-pedido={p.moradorId} data-estado={p.estado} className="relative rotate-[-0.6deg] rounded-sm bg-[#FFF8D9] px-3 py-2 shadow-[0_2px_6px_rgba(30,42,68,.15)] odd:rotate-[0.8deg]">
              <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#C8102E] shadow" />
              <p className="font-serif text-[13.5px] italic leading-snug">{texto}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#1E2A44]/65">
                <span className="min-w-0 truncate">{e?.visivel ? `Agora: ${e.fazendo}` : "Agora em casa"}</span>
                {p.estado === "disponivel" && e?.visivel && usePersonagem.getState().ativo && <button type="button" onClick={() => irAte(p.moradorId)} className="shrink-0 rounded-full bg-[#1E2A44] px-2.5 py-1 font-bold text-white">Ir até {m?.curto ?? "lá"}</button>}
                {p.estado === "aceito" && p.loja?.chave && <button type="button" onClick={() => { const en = entradasDaCidade(useMundo.getState().terrenos).find((x) => x.chave === p.loja!.chave); if (en) { fechar(); usePersonagem.getState().entrarNoPredio(en); } }} className="shrink-0 rounded-full bg-[#1E2A44] px-2.5 py-1 font-bold text-white">Ir à loja</button>}
              </div>
            </li>
          );
        })}
        {!ativos.length && <li className="text-[12px] text-[#1E2A44]/65">Sem recados hoje. Amanhã os moradores têm pedidos novos.</li>}
      </ul>
      {d.assinaturas.length > 0 && (
        <div className="mt-3">
          <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#1E2A44]/55">Quem você ajudou</div>
          <ul className="mt-1 space-y-0.5">{d.assinaturas.slice(0, 5).map((a, i) => <li key={i} className="font-serif text-[13px] italic"><span className="font-bold not-italic">{a.morador}</span> · {a.loja} · {dataCarimbo(a.em).slice(0, 6).toLowerCase()}</li>)}</ul>
        </div>
      )}
    </Pagina>
  );
}

function PaginaNatal({ numero, d }: { numero: number; d: Passaporte }) {
  const terrenos = useMundo((s) => s.terrenos);
  const n = d.natal; const meta = n.meta || NATAL_META;
  // varal com os presentes pendurados: os achados coloridos, os que faltam só o contorno
  const pontos = Array.from({ length: meta }, (_, i) => { const t = i / (meta - 1); return { x: 6 + t * 88, y: 12 + Math.sin(t * Math.PI) * 10 }; });
  return (
    <Pagina numero={numero} titulo="Natal na cidade" guia="passaporte-natal">
      <svg viewBox="0 0 100 40" className="mt-2 w-full" role="img" aria-label={`${n.achados} de ${meta} presentes achados`}>
        <path d={`M2 8 Q50 ${36} 98 8`} fill="none" stroke="#8A6A3B" strokeWidth="0.6" />
        {pontos.map((p, i) => { const ok = i < n.achados; const c = ["#C8102E", "#1F7A3A", "#D4A63A"][i % 3]; return (
          <g key={i} transform={`translate(${p.x} ${p.y + 3})`}>
            <path d="M0 -3v2.5" stroke="#8A6A3B" strokeWidth="0.4" />
            <rect x="-2.6" y="-0.6" width="5.2" height="4.6" rx="0.6" fill={ok ? c : "none"} stroke={ok ? c : "#1E2A44"} strokeOpacity={ok ? 1 : 0.35} strokeWidth="0.5" />
            <path d="M0 -0.6v4.6M-2.6 1.4h5.2" stroke={ok ? "#F5E7B8" : "#1E2A44"} strokeOpacity={ok ? 1 : 0.25} strokeWidth="0.5" />
          </g>); })}
      </svg>
      <p className="text-center text-[13px] font-bold" data-teste="natal-achados">{n.achados} de {meta} presentes</p>
      <p className="mt-1 text-center text-[12px] text-[#1E2A44]/70">{n.ganhou ? "Você ganhou o Gorro de Natal! Use no editor do personagem." : `Ache ${meta} e ganhe o Gorro de Natal, que não está à venda. Todo dia aparecem ${n.porDia} presentes novos.`}</p>
      <div className="mt-2 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#1E2A44]/55">Dicas de hoje</div>
      <ul className="mt-1 space-y-0.5 text-[12.5px]">
        {n.hoje.map((p) => <li key={p.idx} className={p.achado ? "text-[#1E2A44]/45 line-through" : ""}>Um presente {dicaDoPresente(p.x, p.z, terrenos)}</li>)}
      </ul>
    </Pagina>
  );
}

function useLargo() {
  const [largo, setLargo] = useState(false);
  useEffect(() => { const q = window.matchMedia("(min-width: 760px)"); const f = () => setLargo(q.matches); f(); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
  return largo;
}

export function JanelaPassaporte() {
  const aberto = usePassaporte((s) => s.aberto);
  if (!aberto) return null;
  return <Livreto />;
}

function Livreto() {
  const d = usePassaporte((s) => s.dados);
  const fechar = usePassaporte((s) => s.fechar);
  const [capa, setCapa] = useState(true);
  const [pg, setPg] = useState(0);
  const largo = useLargo();
  const paginas = useMemo(() => {
    if (!d) return [] as ReactNode[];
    const l: ReactNode[] = [<Identidade key="id" d={d} />];
    const grupos = Math.max(1, Math.ceil(d.carimbos.length / POR_PAGINA) + (d.carimbos.length % POR_PAGINA === 0 && d.carimbos.length ? 1 : 0));
    for (let g = 0; g < grupos; g++) l.push(<PaginaCarimbos key={`c${g}`} numero={l.length + 1} lista={d.carimbos.slice(g * POR_PAGINA, g * POR_PAGINA + POR_PAGINA)} d={d} primeira={g === 0} />);
    l.push(<PaginaFaltam key="f" numero={l.length + 1} d={d} />);
    l.push(<PaginaVistos key="v" numero={l.length + 1} d={d} />);
    l.push(<PaginaRecados key="r" numero={l.length + 1} d={d} />);
    if (d.natal?.ativo) l.push(<PaginaNatal key="n" numero={l.length + 1} d={d} />);
    return l;
  }, [d]);
  const passo = largo ? 2 : 1;
  const ultimo = Math.max(0, paginas.length - passo);
  const atual = Math.min(pg, ultimo);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (capa) return;
      if (e.key === "ArrowRight") setPg((p) => Math.min(ultimo, p + passo));
      if (e.key === "ArrowLeft") setPg((p) => Math.max(0, p - passo));
    };
    window.addEventListener("keydown", tecla); return () => window.removeEventListener("keydown", tecla);
  }, [capa, ultimo, passo, fechar]);
  const visiveis = paginas.slice(atual, atual + passo);
  const irPara = (guia: string) => { const i = paginas.findIndex((p) => (p as { key?: string }).key === guia); if (i >= 0) { setCapa(false); setPg(largo ? i - (i % 2) : i); } };
  return (
    <div role="dialog" aria-modal="true" aria-label="Passaporte da cidade" data-guia="passaporte" className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[#0B1220]/70 p-4 backdrop-blur-[2px]" onPointerDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <style>{ESTILO_CARIMBO}</style>
      <button type="button" onClick={fechar} aria-label="Fechar o passaporte" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"><Icone nome="fechar" tamanho={18} /></button>
      {!d ? <p className="text-sm font-semibold text-white/80">Abrindo o passaporte…</p> : capa ? (
        <div className="flex flex-col items-center gap-3">
          <Capa abrir={() => setCapa(false)} />
          {!d.ativo && <p className="max-w-[300px] text-center text-[13px] text-white/80">Crie o seu personagem grátis para ganhar carimbos nas recepções da cidade.</p>}
        </div>
      ) : (
        <div className="flex w-full max-w-[760px] flex-col items-center gap-2">
          <div className={`grid w-full overflow-hidden rounded-[12px] shadow-2xl ${largo ? "grid-cols-2" : "grid-cols-1"}`} style={{ height: largo ? "min(520px, calc(100dvh - 8rem))" : "min(560px, calc(100dvh - 9rem))", boxShadow: "0 24px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(30,42,68,.12)" }}>
            {visiveis.map((p, i) => <div key={i} className={`relative min-h-0 ${largo && i === 0 ? "shadow-[inset_-14px_0_18px_-14px_rgba(30,42,68,.35)]" : largo ? "shadow-[inset_14px_0_18px_-14px_rgba(30,42,68,.35)]" : ""}`}>{p}</div>)}
          </div>
          <nav className="flex w-full items-center justify-between gap-2 text-white" aria-label="Folhear o passaporte">
            <button type="button" onClick={() => (atual === 0 ? setCapa(true) : setPg(Math.max(0, atual - passo)))} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/20"><Icone nome="seta" tamanho={15} className="rotate-180" />{atual === 0 ? "Capa" : "Voltar"}</button>
            <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
              {[["c0", "Carimbos"], ["v", "Vistos"], ["r", "Recados"], ...(d.natal?.ativo ? [["n", "Natal"]] : [])].map(([k, n]) => <button key={k} type="button" onClick={() => irPara(k)} className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white/80 hover:bg-white/10">{n}</button>)}
            </div>
            <button type="button" onClick={() => setPg(Math.min(ultimo, atual + passo))} disabled={atual >= ultimo} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/20 disabled:opacity-40">Folhear<Icone nome="seta" tamanho={15} /></button>
          </nav>
        </div>
      )}
    </div>
  );
}

// botão da barra de cima (ui/BotoesPersonagem.tsx), com o selo dos carimbos novos
export function BotaoPassaporte() {
  const novos = usePassaporte((s) => s.novos);
  const abrir = usePassaporte((s) => s.abrir);
  return (
    <button type="button" onClick={abrir} data-guia="botao-passaporte" aria-label={novos ? `Passaporte: ${novos} novidades` : "Passaporte da cidade"} title="Passaporte da cidade" className="hud-btn">
      <Icone nome="passaporte" tamanho={18} /><span className="hud-rotulo">Passaporte</span>{novos > 0 && <span className="hud-selo">{novos}</span>}
    </button>
  );
}
