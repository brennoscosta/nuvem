"use client";
// Conversa com a equipe direto do mapa (16/11/2026, pedido do dono: "ainda não estou conseguindo usar meus agentes,
// conversar com eles e dar tarefas" e "preciso que eles se comuniquem entre si"). O dono clica numa pessoa do próprio
// escritório (ou qualquer parte do mapa chama abrirChatEquipe) e o painel abre com:
//  - a equipe por departamento (chefe primeiro, nível e cargo) e uma busca;
//  - a conversa com a pessoa escolhida, onde ele dá tarefas; quem tem equipe divide o trabalho e o painel mostra
//    "Helena pediu a Ricardo: …" e a resposta de cada um, até a entrega final;
//  - a aba "Conversas internas", com tudo o que a equipe pediu e respondeu entre si.
// Antes de abrir, a rota /api/workend/equipe garante a empresa e os agentes do lote (garantirEmpresaDoLote): o dono não
// precisa ter aberto a página Minha equipe antes. Servidor: src/server/equipeCliente.ts e src/server/delegacao.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { useMundo } from "../mundoStore";
import { useSede } from "../sedeStore";
import { FLUTUANTE } from "./estilo";
import { Icone } from "./Icone";
import { EnviarPara } from "./EnviarPara";
import {
  NIVEL_COR, NIVEL_ROTULO, agruparPorDepartamento, agruparPorTarefa, andamento, apiEquipe, brl, linhaDoTempo, quando, resumoNiveis, sugestoesTarefa, TextoIA,
  type ConversaEquipe, type GrupoTarefa, type MembroEquipe, type PainelEquipe, type RespostaEnvio, type TrocaInterna,
} from "./equipeComum";

type Aba = "conversar" | "internas";
interface EstadoChatEquipe {
  aberto: boolean; chave: string | null; membro: string | null; aba: Aba;
  vistaCelular: "lista" | "conversa"; // no celular cabe uma coluna só
  painel: PainelEquipe | null; erro: string | null; carregando: boolean;
}
export const useChatEquipe = create<EstadoChatEquipe>(() => ({ aberto: false, chave: null, membro: null, aba: "conversar", vistaCelular: "lista", painel: null, erro: null, carregando: false }));

const urlPainel = (chave: string) => `/api/workend/equipe?lote=${encodeURIComponent(chave)}`;

// Abre o painel da equipe do lote `chave` (opcionalmente já na conversa com `membroId`, o id do Membro no escritório).
// Busca o painel antes (a rota cria a empresa e os agentes se faltarem). Devolve false se não deu (sem conta, lote de outra
// pessoa, sem conexão); o erro fica visível no próprio painel.
export async function abrirChatEquipe(chave: string, membroId?: string): Promise<boolean> {
  const atual = useChatEquipe.getState();
  const mesmo = atual.chave === chave;
  useMundo.setState({ loteSelecionado: null, painelEmpresa: false, painelEscritorio: false, outdoorSelecionado: null });
  useSede.setState({ aberto: false });
  useChatEquipe.setState({
    aberto: true, chave, membro: membroId ?? (mesmo ? atual.membro : null), aba: "conversar", vistaCelular: membroId ? "conversa" : "lista",
    painel: mesmo ? atual.painel : null, erro: null, carregando: true,
  });
  try {
    const p = await apiEquipe<PainelEquipe>(urlPainel(chave));
    if (useChatEquipe.getState().chave !== chave) return false;
    const pedido = useChatEquipe.getState().membro;
    const membro = pedido && p.equipe.some((m) => m.membroId === pedido) ? pedido : (p.equipe.find((m) => m.nivel === "ceo") ?? p.equipe[0])?.membroId ?? null;
    useChatEquipe.setState({ painel: p, membro, carregando: false });
    return true;
  } catch (e) {
    if (useChatEquipe.getState().chave === chave) useChatEquipe.setState({ erro: (e as Error).message, carregando: false });
    return false;
  }
}
export function fecharChatEquipe() { useChatEquipe.setState({ aberto: false }); }
// recarrega só os números (gasto do mês, última mensagem de cada um) sem fechar nada
async function atualizarPainel() {
  const { chave } = useChatEquipe.getState(); if (!chave) return;
  try { const p = await apiEquipe<PainelEquipe>(urlPainel(chave)); if (useChatEquipe.getState().chave === chave) useChatEquipe.setState({ painel: p }); } catch { /* mantém o que tinha */ }
}
const escolher = (membro: string) => useChatEquipe.setState({ membro, aba: "conversar", vistaCelular: "conversa" });

function Avatar({ m, tamanho = 34 }: { m: Pick<MembroEquipe, "nome" | "camisa" | "foto" | "nivel">; tamanho?: number }) {
  if (m.foto) return <img src={m.foto} alt="" width={tamanho} height={tamanho} className="shrink-0 rounded-full object-cover shadow-[0_0_0_2px_#fff]" style={{ width: tamanho, height: tamanho }} />;
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[0_0_0_2px_#fff]" style={{ width: tamanho, height: tamanho, background: m.camisa, fontSize: tamanho * 0.42 }}>
      {m.nome.slice(0, 1).toUpperCase()}
      {(m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente") && tamanho >= 30 && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: NIVEL_COR[m.nivel] }} />}
    </span>
  );
}
// três pontinhos de "trabalhando" (as classes equipe-digitando do site não valem no mapa)
const Digitando = () => <span className="inline-flex gap-[3px]" aria-hidden="true">{[0, 150, 300].map((d) => <i key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1D4ED8] motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />)}</span>;
const SeloNivel = ({ m }: { m: Pick<MembroEquipe, "nivel"> }) => <span className="rounded-full px-1.5 py-[1px] text-[12px] font-bold text-white" style={{ background: NIVEL_COR[m.nivel] }}>{NIVEL_ROTULO[m.nivel]}</span>;

export function ChatEquipe() {
  const { aberto, painel: p, erro, carregando, aba, chave, membro: sel, vistaCelular } = useChatEquipe();
  // outro cartão do mapa abriu (um lote, a sede): o painel da equipe sai da frente
  useEffect(() => {
    const a = useMundo.subscribe((s, ant) => { if ((s.loteSelecionado && s.loteSelecionado !== ant.loteSelecionado) || (s.painelEscritorio && !ant.painelEscritorio)) fecharChatEquipe(); });
    const b = useSede.subscribe((s, ant) => { if (s.aberto && !ant.aberto) fecharChatEquipe(); });
    return () => { a(); b(); };
  }, []);
  // link direto: /mundo?equipe=<chave do lote>&membro=<id da pessoa> abre a conversa (avisos, cartões, testes)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("equipe"); if (c) void abrirChatEquipe(c, q.get("membro") ?? undefined);
  }, []);
  if (!aberto || !chave) return null;
  const membro = p?.equipe.find((m) => m.membroId === sel) ?? null;
  const pct = p ? Math.min(100, (p.gasto.mes / p.gasto.teto) * 100) : 0;

  return (
    <div className={`${FLUTUANTE} painel-entra flex h-[72vh] flex-col overflow-hidden sm:h-[min(46rem,calc(100vh-7rem))] sm:w-[46rem]`} role="dialog" aria-label="Conversar com a equipe">
      <header className="flex items-center gap-2.5 border-b border-black/5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: p?.lote.cor ?? "#1D2128" }}><Icone nome="equipe" tamanho={19} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-extrabold">{p ? `Equipe da ${p.lote.empresaNome}` : "Sua equipe"}</div>
          <div className="truncate text-[11.5px] text-[#5B6472]">{p ? `${p.equipe.length} pessoas em ${p.departamentos.length} áreas · ${resumoNiveis(p.equipe)}` : carregando ? "Preparando a equipe…" : ""}</div>
        </div>
        {p && (
          <div className="hidden w-44 shrink-0 whitespace-nowrap sm:block" title="IA usada neste mês">
            <div className="flex justify-between text-[10.5px] font-semibold text-[#5B6472]"><span>IA do mês</span><span>{brl(p.gasto.mes)} de {brl(p.gasto.teto)}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: p.gasto.esgotado ? "#E2575B" : p.gasto.aviso ? "#E8A317" : "#1D4ED8" }} /></div>
          </div>
        )}
        <a href={`/app/equipe?lote=${encodeURIComponent(chave)}${sel ? `&membro=${encodeURIComponent(sel)}` : ""}`} className="hidden shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#1D4ED8] hover:bg-[#EEF3FF] sm:block" title="Abrir a página Minha equipe">
          <Icone nome="expandir" tamanho={15} className="mr-1 inline align-[-3px]" />Tela cheia
        </a>
        <button type="button" onClick={fecharChatEquipe} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={18} /></button>
      </header>

      <nav className="flex gap-1 border-b border-black/5 bg-[#F6F7F9] px-2 py-1.5 text-[13px] font-semibold" aria-label="Seções">
        {([["conversar", "Conversar e dar tarefas", "conversar"], ["internas", "Conversas internas", "equipe"]] as const).map(([k, t, ic]) => (
          <button key={k} type="button" onClick={() => useChatEquipe.setState({ aba: k })} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${aba === k ? "bg-white text-[#1D2128] shadow-sm" : "text-[#5B6472] hover:text-[#1D2128]"}`}>
            <Icone nome={ic} tamanho={15} />{t}
          </button>
        ))}
      </nav>

      {erro && !p && (
        <div className="m-4 rounded-xl bg-[#FDECEC] p-4 text-sm text-[#9B1C1C]">
          <b className="block">Não deu para abrir a equipe.</b>{erro}
          <button type="button" onClick={() => void abrirChatEquipe(chave, sel ?? undefined)} className="mt-3 block rounded-lg bg-[#9B1C1C] px-3 py-1.5 text-[12.5px] font-bold text-white">Tentar de novo</button>
        </div>
      )}
      {!p && !erro && <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#5B6472]"><Digitando />Preparando a equipe…</div>}

      {p && aba === "conversar" && (
        <div className="flex min-h-0 flex-1">
          <ListaPessoas p={p} sel={sel} oculta={vistaCelular === "conversa"} />
          <div className={`min-w-0 flex-1 flex-col ${vistaCelular === "lista" ? "hidden sm:flex" : "flex"}`}>
            {membro ? <Conversa key={`${chave}|${membro.membroId}`} p={p} chave={chave} membro={membro} /> : <p className="m-auto text-sm text-[#5B6472]">Escolha uma pessoa da equipe.</p>}
          </div>
        </div>
      )}
      {p && aba === "internas" && <FeedInternas chave={chave} p={p} />}
    </div>
  );
}

function ListaPessoas({ p, sel, oculta }: { p: PainelEquipe; sel: string | null; oculta: boolean }) {
  const [busca, setBusca] = useState("");
  const grupos = useMemo(() => agruparPorDepartamento(p, busca), [p, busca]);
  return (
    <aside className={`min-h-0 w-full shrink-0 flex-col border-r border-black/5 sm:flex sm:w-[15.5rem] ${oculta ? "hidden" : "flex"}`} aria-label="Pessoas da equipe">
      <label className="m-2 flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-[#5B6472] focus-within:border-[#1D4ED8]">
        <Icone nome="encontrar" tamanho={15} />
        <input value={busca} onChange={(e) => setBusca(e.target.value.slice(0, 40))} placeholder="Buscar pessoa, cargo ou área" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1D2128] outline-none" />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {grupos.length === 0 && <p className="px-2 py-4 text-[12.5px] text-[#5B6472]">Ninguém com esse nome ou cargo.</p>}
        {grupos.map(({ dep, pessoas }) => (
          <section key={dep.id} className="mb-1.5">
            <h3 className="sticky top-0 z-[1] flex items-center gap-1.5 bg-white/95 px-1.5 py-1 text-[12px] font-bold text-[#5B6472] backdrop-blur">
              <span className="h-2 w-2 rounded-full" style={{ background: dep.cor }} />{dep.nome}<span className="font-semibold text-[#9AA1AC]">{pessoas.length}</span>
            </h3>
            {pessoas.map((m) => {
              const chefeDaArea = m.temEquipe || m.nivel === "ceo";
              return (
                <button key={m.membroId} type="button" data-membro={m.membroId} onClick={() => escolher(m.membroId)}
                  className={`flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition ${m.membroId === sel ? "bg-[#EEF3FF]" : "hover:bg-black/[.035]"} ${chefeDaArea ? "" : "pl-4"}`}>
                  <Avatar m={m} tamanho={chefeDaArea ? 32 : 28} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center gap-1 truncate text-[13px] font-bold">{m.nome}{chefeDaArea && <SeloNivel m={m} />}</span>
                    <span className="block truncate text-[11px] text-[#5B6472]">{m.cargo}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}

function Conversa({ p, chave, membro }: { p: PainelEquipe; chave: string; membro: MembroEquipe }) {
  const [conv, setConv] = useState<ConversaEquipe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [versao, setVersao] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const q = `lote=${encodeURIComponent(chave)}&membro=${encodeURIComponent(membro.membroId)}`;
  const trabalhando = !!conv?.trabalhando;

  // histórico (de novo a cada versão) e, enquanto a equipe trabalha, a cada 3 s
  useEffect(() => {
    let vivo = true;
    apiEquipe<ConversaEquipe>(`/api/workend/equipe/chat?${q}`).then((c) => { if (vivo) { setConv(c); setErro(null); } }).catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, versao]);
  useEffect(() => {
    if (!trabalhando) return;
    const t = setInterval(() => setVersao((v) => v + 1), 3000);
    return () => { clearInterval(t); void atualizarPainel(); };
  }, [trabalhando]);
  const itens = useMemo(() => linhaDoTempo(conv, membro.membroId), [conv, membro.membroId]);
  const progresso = useMemo(() => andamento(conv, membro.membroId), [conv, membro.membroId]);
  useEffect(() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; }, [itens.length, enviando]);

  const chefe = membro.chefeId ? p.equipe.find((m) => m.membroId === membro.chefeId) : null;
  const subs = p.equipe.filter((m) => m.chefeId === membro.membroId);
  const enviar = async (t = texto) => {
    const pedido = t.trim(); if (!pedido || enviando) return;
    setEnviando(true); setErro(null); setTexto("");
    const agora = new Date().toISOString();
    setConv((c) => ({ mensagens: [...(c?.mensagens ?? []), { id: `tmp-${agora}`, papel: "user", autor: "dono", deNome: null, conteudo: pedido, avaliacao: null, correcao: null, em: agora }], internas: c?.internas ?? [], trabalhando: c?.trabalhando ?? false }));
    try {
      const r = await apiEquipe<RespostaEnvio>(`/api/workend/equipe/chat`, { method: "POST", body: JSON.stringify({ lote: chave, membro: membro.membroId, texto: pedido }) });
      setConv((c) => ({ mensagens: [...(c?.mensagens ?? []), r.mensagem], internas: c?.internas ?? [], trabalhando: r.delegados.length > 0 || !!c?.trabalhando }));
      setVersao((v) => v + 1);
      void atualizarPainel();
    } catch (e) {
      setErro((e as Error).message); setTexto(pedido);
      setConv((c) => c && { ...c, mensagens: c.mensagens.filter((m) => m.id !== `tmp-${agora}`) });
    }
    setEnviando(false);
  };

  return (
    <>
      <div className="flex items-start gap-2.5 border-b border-black/5 px-3 py-2.5">
        <button type="button" onClick={() => useChatEquipe.setState({ vistaCelular: "lista" })} className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#5B6472] hover:bg-black/5 sm:hidden" aria-label="Voltar para a equipe"><Icone nome="seta" tamanho={17} className="rotate-180" /></button>
        <Avatar m={membro} tamanho={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-1.5"><b className="text-[15px]">{membro.nome}</b><SeloNivel m={membro} /></div>
          <div className="truncate text-[12px] text-[#5B6472]">{membro.cargo} · <span style={{ color: membro.setorCor }} className="font-semibold">{membro.setor}</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-[#5B6472]">
            {chefe && <button type="button" onClick={() => escolher(chefe.membroId)} className="rounded-full bg-black/[.04] px-2 py-0.5 hover:bg-black/[.08]">Responde a <b className="text-[#1D2128]">{chefe.nome}</b></button>}
            {subs.length > 0 && <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[#1D4ED8]">Comanda {subs.length} {subs.length === 1 ? "pessoa" : "pessoas"}: {subs.slice(0, 4).map((s) => s.nome).join(", ")}{subs.length > 4 ? "…" : ""}</span>}
          </div>
        </div>
      </div>

      <div ref={lista} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#FAFBFC] p-3" aria-live="polite">
        {!conv && !erro && <p className="text-[13px] text-[#5B6472]">Carregando a conversa…</p>}
        {conv && itens.length === 0 && (
          <div className="mx-auto max-w-[40ch] py-5 text-center">
            <div className="mx-auto w-max"><Avatar m={membro} tamanho={56} /></div>
            <p className="mt-2 text-[14px] font-semibold">{membro.saudacao || `Oi! Sou ${membro.nome}. O que a ${p.lote.empresaNome} precisa?`}</p>
            <p className="mt-1 text-[12.5px] text-[#5B6472]">{subs.length ? `Dê uma tarefa como daria a um funcionário. ${membro.nome} divide o trabalho com a equipe (${subs.length} ${subs.length === 1 ? "pessoa" : "pessoas"}) e entrega tudo junto aqui.` : "Dê uma tarefa como daria a um funcionário: a resposta vem com o material pronto."}</p>
          </div>
        )}
        {itens.map((it) => it.tipo === "msg" ? <Bolha key={it.msg.id} m={it.msg} membro={membro} lote={chave} /> : (
          <details key={it.grupo.chave} open className="painel-entra rounded-2xl border border-black/[.07] bg-[#EEF1F5] p-2">
            <summary className="cursor-pointer select-none px-1 text-[12px] font-bold text-[#3A414C]">Pedidos internos desta tarefa · {it.grupo.prontos} de {it.grupo.total} {it.grupo.total === 1 ? "respondido" : "respondidos"}</summary>
            <ListaGrupo g={it.grupo} p={p} />
          </details>
        ))}
        {(enviando || trabalhando) && (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12.5px] text-[#5B6472] shadow-sm">
            <Digitando />
            {enviando ? `${membro.nome} está lendo e organizando o pedido…` : progresso ? `A equipe está trabalhando: ${progresso.prontos} de ${progresso.total} ${progresso.total === 1 ? "pedido pronto" : "pedidos prontos"}. A entrega final chega aqui.` : `${membro.nome} está juntando as respostas da equipe…`}
          </div>
        )}
      </div>

      <footer className="border-t border-black/5 p-2.5">
        {erro && <p className="mb-2 rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[12.5px] text-[#9B1C1C]">{erro}</p>}
        {conv && conv.mensagens.length < 2 && !p.gasto.esgotado && (
          <div className="sem-barra mb-2 flex gap-1.5 overflow-x-auto">
            {sugestoesTarefa(membro, p.lote.empresaNome).map((s) => <button key={s} type="button" onClick={() => { setTexto(s); caixa.current?.focus(); }} className="shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[12px] hover:border-[#1D4ED8] hover:text-[#1D4ED8]">{s}</button>)}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex items-end gap-1.5">
          <textarea ref={caixa} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
            rows={2} disabled={p.gasto.esgotado || !p.ia}
            placeholder={p.gasto.esgotado ? "A IA deste mês acabou: a equipe volta no dia 1º." : !p.ia ? "A IA está desligada no servidor agora." : `Dê uma tarefa para ${membro.nome}…`}
            className="min-h-[46px] min-w-0 flex-1 resize-none rounded-xl border border-black/15 bg-white px-3 py-2 text-[14px] text-[#1D2128] outline-none focus:border-[#1D4ED8] disabled:bg-black/[.03]" />
          <button type="submit" disabled={!texto.trim() || enviando || p.gasto.esgotado} className="flex h-[46px] items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 text-[14px] font-bold text-white disabled:opacity-50">Enviar<Icone nome="seta" tamanho={15} /></button>
        </form>
        <p className="mt-1.5 text-[11px] text-[#7A828E]">{subs.length ? "Tarefas grandes: peça a quem comanda a área. Você acompanha cada pedido interno aqui e em Conversas internas." : "Enter envia · Shift+Enter quebra a linha"}</p>
      </footer>
    </>
  );
}

function Bolha({ m, membro, lote }: { m: ConversaEquipe["mensagens"][number]; membro: MembroEquipe; lote: string }) {
  const [copiado, setCopiado] = useState(false);
  if (m.autor === "dono") return <div className="painel-entra ml-auto max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#1D4ED8] px-3.5 py-2 text-[13.5px] text-white">{m.conteudo}</div>;
  if (m.autor === "chefe") return (
    <div className="painel-entra max-w-[90%] rounded-2xl border border-[#F2D58A] bg-[#FFF8E6] px-3.5 py-2 text-[13px] text-[#4A3A10]">
      <div className="mb-0.5 flex items-center gap-1 text-[12px] font-bold text-[#8A6A12]"><Icone nome="negociar" tamanho={13} />Pedido interno de {m.deNome ?? "um chefe"}</div>
      <TextoIA t={m.conteudo.replace(/^Pedido de [^\n]*:\n\n/, "")} />
    </div>
  );
  if (m.autor === "equipe") return (
    <details className="painel-entra max-w-[90%] rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-[13px]">
      <summary className="cursor-pointer select-none text-[12px] font-bold text-[#0F766E]"><Icone nome="equipe" tamanho={14} className="mr-1 inline align-[-2px]" />A equipe respondeu: {membro.nome} juntou tudo (abrir as respostas)</summary>
      <TextoIA t={m.conteudo.replace(/^Respostas da sua equipe:\n\n/, "")} className="mt-2 text-[12.5px] text-[#3A414C]" />
    </details>
  );
  return (
    <div className="painel-entra flex max-w-[94%] gap-2">
      <Avatar m={membro} tamanho={26} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13.5px] text-[#1D2128] shadow-sm"><TextoIA t={m.conteudo} /></div>
        <div className="mt-0.5 flex items-center gap-2 pl-1 text-[11px] text-[#7A828E]">
          <span>{quando(m.em)}</span>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.conteudo); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="font-semibold hover:text-[#1D4ED8]">{copiado ? "Copiado" : "Copiar"}</button>
          {/* conectores (17/11/2026): mandar a entrega para outro sistema, como na página Minha equipe */}
          <EnviarPara m={m} membro={membro} lote={lote} />
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<TrocaInterna["status"], { t: string; cor: string; fundo: string }> = {
  pedido: { t: "trabalhando", cor: "#8A6A12", fundo: "#FFF3CC" },
  respondido: { t: "respondeu", cor: "#166534", fundo: "#E3F6EA" },
  erro: { t: "não respondeu", cor: "#9B1C1C", fundo: "#FDECEC" },
};
// "Helena pediu a Ricardo: …" com o andamento e a resposta
function Delegacao({ t, p }: { t: TrocaInterna; p: PainelEquipe }) {
  const de = p.equipe.find((m) => m.membroId === t.de), para = p.equipe.find((m) => m.membroId === t.para);
  const st = STATUS[t.status] ?? STATUS.pedido;
  return (
    <div className={`painel-entra rounded-2xl border border-black/[.07] bg-white px-3 py-2 text-[12.5px] shadow-sm`}>
      <div className="flex items-center gap-1.5">
        {de && <Avatar m={de} tamanho={22} />}
        <Icone nome="seta" tamanho={13} className="text-[#9AA1AC]" />
        {para && <Avatar m={para} tamanho={22} />}
        <span className="min-w-0 flex-1 truncate">
          <button type="button" onClick={() => escolher(t.de)} className="font-bold hover:underline">{t.deNome}</button> pediu a{" "}
          <button type="button" onClick={() => escolher(t.para)} className="font-bold hover:underline">{t.paraNome}</button>
          <span className="text-[#7A828E]"> · {t.paraCargo}</span>
        </span>
        <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[10.5px] font-bold" style={{ color: st.cor, background: st.fundo }}>{st.t}</span>
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[#3A414C]">{t.pedido}</p>
      {t.resposta && t.status === "respondido" && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none text-[11.5px] font-bold text-[#0F766E]">Ver a resposta de {t.paraNome}</summary>
          <TextoIA t={t.resposta} className="mt-1 rounded-xl bg-[#F6F7F9] p-2.5 text-[12.5px] text-[#1D2128]" />
        </details>
      )}
      <div className="mt-1 text-[10.5px] text-[#9AA1AC]">{quando(t.em)}</div>
    </div>
  );
}

// a cadeia de pedidos de uma tarefa: quem pediu primeiro e, recuado, o que essa pessoa pediu à equipe dela
function ListaGrupo({ g, p }: { g: GrupoTarefa; p: PainelEquipe }) {
  return <div className="mt-1.5 space-y-1.5">{g.itens.map(({ t, nivel }) => <div key={t.id} className={nivel === 2 ? "ml-4 border-l-2 border-black/10 pl-2" : ""}><Delegacao t={t} p={p} /></div>)}</div>;
}

// todas as conversas internas da empresa, da mais nova para a mais antiga (enquanto houver pedido aberto, atualiza a cada 4 s)
function FeedInternas({ chave, p }: { chave: string; p: PainelEquipe }) {
  const [lista, setLista] = useState<TrocaInterna[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    apiEquipe<{ internas: TrocaInterna[] }>(`/api/workend/equipe/internas?lote=${encodeURIComponent(chave)}`).then((r) => { if (vivo) { setLista(r.internas); setErro(null); } }).catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [chave, versao]);
  const aberto = !!lista?.some((t) => t.status === "pedido");
  useEffect(() => { if (!aberto) return; const t = setInterval(() => setVersao((v) => v + 1), 4000); return () => clearInterval(t); }, [aberto]);
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#FAFBFC] p-3">
      <p className="text-[12.5px] text-[#5B6472]">Quando você dá uma tarefa a quem tem equipe, essa pessoa pede partes do trabalho a quem responde a ela. Aqui fica tudo o que a equipe pediu e respondeu entre si.</p>
      {erro && <p className="rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[12.5px] text-[#9B1C1C]">{erro}</p>}
      {!lista && !erro && <p className="text-[13px] text-[#5B6472]">Carregando…</p>}
      {lista?.length === 0 && (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <b className="text-[14px]">A equipe ainda não conversou entre si.</b>
          <p className="mt-1 text-[12.5px] text-[#5B6472]">Dê uma tarefa ao CEO ou a um gerente na aba Conversar: os pedidos que ele fizer à equipe aparecem aqui.</p>
          <button type="button" onClick={() => { const ceo = p.equipe.find((m) => m.nivel === "ceo"); if (ceo) escolher(ceo.membroId); }} className="mt-3 rounded-xl bg-[#1D4ED8] px-3 py-1.5 text-[13px] font-bold text-white">Falar com o CEO</button>
        </div>
      )}
      {lista && agruparPorTarefa(lista).map((g) => (
        <section key={g.chave} className="rounded-2xl bg-[#EEF1F5] p-2.5">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 px-1">
            <span className="text-[12px] font-bold text-[#1D4ED8]">Tarefa que você deu a {g.quem.nome}</span>
            <span className="text-[11px] text-[#7A828E]">{quando(g.em)} · {g.prontos} de {g.total} {g.total === 1 ? "respondido" : "respondidos"}</span>
            <button type="button" onClick={() => escolher(g.quem.id)} className="ml-auto text-[11.5px] font-semibold text-[#1D4ED8] hover:underline">Ver a entrega</button>
            {g.tarefa && <p className="line-clamp-2 w-full text-[12.5px] font-semibold text-[#1D2128]">“{g.tarefa}”</p>}
          </div>
          <ListaGrupo g={g} p={p} />
        </section>
      ))}
    </div>
  );
}
