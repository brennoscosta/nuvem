"use client";
// Minha equipe (11/11/2026): o dono conversa com cada pessoa da equipe de IA do lote, aprova ou corrige as respostas
// (a correção vira regra), pede o relatório da semana ao CEO, lê as conversas dos visitantes da loja e escreve o
// "Sobre a empresa" que a equipe e a página pública usam. Dados: /api/workend/equipe* (src/server/equipeCliente.ts).
// Aba Vagas (12/11/2026): o dono abre vagas e lê as candidaturas (src/server/cidade.ts).
// 16/11/2026 (pedido do dono: "ainda não estou conseguindo usar meus agentes, conversar com eles e dar tarefas" e "preciso
// que eles se comuniquem entre si"): equipe por departamento com busca (chefe primeiro, nível e cargo), quem responde a
// quem, os pedidos internos dentro da conversa ("Helena pediu a Ricardo: …" e a resposta), a aba Conversas internas e um
// passo a passo de como dar uma tarefa. A delegação roda em src/server/delegacao.ts; os tipos e o texto da IA são os mesmos
// do painel do mapa (src/office/ui/equipeComum.tsx).
// 17/11/2026 (pedido do dono: "essa área precisa ser totalmente atualizada e melhorada"): topo novo com a caixa de nova
// tarefa e o organograma vivo (_topo.tsx), a faixa "Agora na empresa", abas com contador, rostos de verdade (_rosto.tsx)
// no lugar das bolinhas com a inicial e "Como funciona" num modal. Estilos em equipe.css (prefixo .eq-).
import { ehSede, sedeDe } from "@/office/data/sedes";
import { Icone } from "@/office/ui/Icone";
import {
  NIVEL_COR, NIVEL_ROTULO, agruparPorDepartamento, agruparPorTarefa, andamento, apiEquipe, brl, linhaDoTempo, quando, sugestoesTarefa, TextoIA,
  type ContatosEquipe, type ConversaEquipe, type GrupoTarefa, type MembroEquipe, type MsgEquipe, type PainelEquipe, type RegraEquipe, type RespostaEnvio, type TrocaInterna,
} from "@/office/ui/equipeComum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VagasDono } from "./_vagas-dono";
import { Rosto, RostoSede } from "./_rosto";
import { TopoEquipe, FaixaEquipe, ComoFunciona } from "./_topo";
import { Conectores, EnviarPara } from "./_conectores";
import { CartaoImagemEquipe } from "@/office/ui/ImagemEquipe";

type Regra = RegraEquipe;
type Membro = MembroEquipe;
type Contatos = ContatosEquipe;
type Painel = PainelEquipe;
type Msg = MsgEquipe;
type Visitante = { visitanteId: string; nome: string | null; n: number; ultimaEm: string; ultimaFala: string | null };
type FalaVisita = { id: string; papel: string; conteudo: string; quem: string; criadoEm: string };

const api = apiEquipe;
const Texto = ({ t }: { t: string }) => <TextoIA t={t} className="text-[15px]" />;

function Avatar({ m, tamanho = 44 }: { m: Membro; tamanho?: number }) { return <Rosto m={m} tamanho={tamanho} anel={null} />; }
const SeloNivel = ({ m }: { m: Pick<Membro, "nivel"> }) => <span className="rounded-full px-2 py-[1px] align-middle text-[10.5px] font-semibold text-white" style={{ background: NIVEL_COR[m.nivel] }}>{NIVEL_ROTULO[m.nivel]}</span>;

type AbaEquipe = "conversas" | "internas" | "visitantes" | "vagas" | "sobre" | "conectores";
export function EquipePainel({ chaveInicial, membroInicial, abaInicial, empresas = [] }: { chaveInicial: string | null; membroInicial: string | null; abaInicial?: AbaEquipe; empresas?: { chave: string; nome: string; socio: boolean }[] }) {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaEquipe>(abaInicial ?? "conversas");
  const [sel, setSel] = useState<string | null>(membroInicial);
  const lote = p?.lote.chave ?? chaveInicial;
  const q = lote ? `lote=${encodeURIComponent(lote)}` : "";

  // recarregar = pedir uma versão nova; a busca roda no efeito e só grava o estado quando a resposta chega
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(async () => { setVersao((v) => v + 1); }, []);
  useEffect(() => {
    let vivo = true;
    api<Painel>(`/api/workend/equipe?${q}`)
      .then((d) => { if (!vivo) return; setP(d); setErro(null); setSel((s) => (s && d.equipe.some((m) => m.membroId === s) ? s : (d.equipe.find((m) => m.nivel === "ceo") ?? d.equipe[0])?.membroId ?? null)); })
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, versao]);
  const abrirPessoa = useCallback((id: string) => { setSel(id); setAba("conversas"); document.getElementById("eq-trabalho")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  const [como, setComo] = useState(false);
  const fecharComo = useCallback(() => setComo(false), []);
  const [envios, setEnvios] = useState(0);
  // conversas internas para o topo e a faixa "Agora na empresa": a cada 15 s, a cada 4 s enquanto há pedido aberto
  const [internas, setInternas] = useState<TrocaInterna[] | null>(null);
  const [versaoInt, setVersaoInt] = useState(0);
  useEffect(() => {
    if (!q) return;
    let vivo = true;
    api<{ internas: TrocaInterna[] }>(`/api/workend/equipe/internas?${q}`).then((r) => { if (vivo) setInternas(r.internas); }).catch(() => { if (vivo) setInternas((x) => x ?? []); });
    return () => { vivo = false; };
  }, [q, versaoInt]);
  const abertas = !!internas?.some((t) => t.status === "pedido");
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") setVersaoInt((v) => v + 1); }, abertas || envios ? 4000 : 15000); return () => clearInterval(t); }, [abertas, envios]);
  const enviado = useCallback((id: string) => { setEnvios((n) => n + 1); setVersao((v) => v + 1); setVersaoInt((v) => v + 1); setSel(id); setAba("conversas"); setTimeout(() => document.getElementById("eq-trabalho")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }, []);

  if (erro && !p) return <div className="faixa mt-6"><div className="rounded-2xl bg-[var(--cinza)] p-7"><h2 className="text-[1.4rem]">Minha equipe</h2><p className="mt-2 text-[var(--tinta-2)]">{erro}</p><Link prefetch={false} href="/mundo" className="btn btn-azul mt-5">Ir para o mapa</Link></div></div>;
  if (!p) return <div className="faixa mt-6 text-[var(--tinta-2)]">Carregando a sua equipe…</div>;
  const membro = p.equipe.find((m) => m.membroId === sel) ?? p.equipe[0];
  const sede = ehSede(p.lote.chave);
  const abas: [AbaEquipe, string, Parameters<typeof Icone>[0]["nome"], number | null, boolean][] = [
    ["conversas", "Conversar e dar tarefas", "conversar", null, false],
    ["internas", "Conversas internas", "equipe", internas?.length ?? null, abertas],
    ["visitantes", "Visitantes", "pessoa", p.visitantes.total, false],
    ["vagas", "Vagas", "maleta", null, false],
    ["sobre", "Sobre a empresa", "editar", null, false],
    ["conectores", "Conectores", "plugue", null, false],
  ];

  return (
    <RostoSede.Provider value={sede}>
    <div className="faixa mt-2">
      <TopoEquipe p={p} internas={internas} abrir={abrirPessoa} enviado={enviado} comoFunciona={() => setComo(true)} empresas={empresas} />
      <FaixaEquipe p={p} internas={internas} abrir={abrirPessoa} irPara={(a) => { setAba(a); document.getElementById("eq-trabalho")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />

      <div id="eq-trabalho" className="scroll-mt-24" />
      <div className="mt-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[14px]">
        {p.lote.numero != null && <Link href={`/loja/${p.lote.numero}`} className="eq-link">{sede ? "Página da sede" : "Ver minha loja"}</Link>}
        {/* a sede tem a equipe montada por departamento e não passa pelo editor */}
        {!sede && <Link prefetch={false} href={`/mundo?lote=${encodeURIComponent(p.lote.chave)}`} className="eq-link">Montar escritório</Link>}
        {sede && <Link prefetch={false} href={`/mundo?sede=${sedeDe(p.lote.chave)?.id ?? "1"}`} className="eq-link">Ver a sede no mapa</Link>}
      </div>
      <nav className="eq-abas" role="tablist" aria-label="Seções da equipe">
        {abas.map(([k, t, ic, n, vivo]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className="eq-aba">
            <Icone nome={ic} tamanho={17} />{t}{n !== null && n > 0 && <span className={`eq-aba-num ${vivo ? "eq-aba-num-vivo" : ""}`}>{n}</span>}
          </button>
        ))}
      </nav>

      {!p.sobre && aba !== "sobre" && aba !== "conectores" && (
        <div className="eq-aviso">
          <span className="eq-aviso-icone"><Icone nome="editar" tamanho={17} /></span>
          <span className="min-w-0 flex-1"><b>Conte para a equipe o que a {p.lote.empresaNome} faz.</b> Sem o “Sobre a empresa”, a atendente não sabe preços, horários nem serviços.</span>
          <button type="button" onClick={() => setAba("sobre")} className="btn btn-tinta !py-2 text-sm">Escrever agora</button>
        </div>
      )}

      {aba === "conversas" && membro && <Conversas key={`${membro.membroId}-${envios}`} p={p} membro={membro} q={q} selecionar={setSel} recarregar={carregar} />}
      {aba === "internas" && <Internas p={p} q={q} abrir={abrirPessoa} />}
      {aba === "visitantes" && <Visitantes q={q} />}
      {aba === "vagas" && <VagasDono empresa={p.lote.empresaNome} numero={p.lote.numero} />}
      {aba === "sobre" && <Sobre p={p} lote={p.lote.chave} salvo={carregar} />}
      {aba === "conectores" && <Conectores p={p} />}
      {como && <ComoFunciona p={p} fechar={fecharComo} abrir={abrirPessoa} />}
    </div>
    </RostoSede.Provider>
  );
}

function ListaEquipe({ p, membro, selecionar }: { p: Painel; membro: Membro; selecionar: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [fechados, setFechados] = useState<string[]>([]);
  const grupos = useMemo(() => agruparPorDepartamento(p, busca), [p, busca]);
  const alternar = (id: string) => setFechados((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  return (
    <aside className="flex max-h-[360px] flex-col overflow-hidden rounded-2xl border border-[var(--linha)] bg-[var(--surface)] lg:max-h-[760px]" aria-label="Pessoas da equipe">
      <label className="m-2.5 flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 text-[var(--tinta-2)] focus-within:border-[var(--azul)]">
        <Icone nome="encontrar" tamanho={17} />
        <input value={busca} onChange={(e) => setBusca(e.target.value.slice(0, 40))} placeholder="Buscar pessoa, cargo ou área" className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--tinta)] outline-none" />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {grupos.length === 0 && <p className="px-2 py-4 text-sm text-[var(--tinta-2)]">Ninguém com esse nome, cargo ou área.</p>}
        {grupos.map(({ dep, pessoas }) => {
          const fechado = !busca && fechados.includes(dep.id);
          return (
            <section key={dep.id} className="mb-1">
              <button type="button" onClick={() => alternar(dep.id)} aria-expanded={!fechado} className="eq-dep">
                <i style={{ background: dep.cor }} />
                <span>{dep.nome}</span>
                <em>{pessoas.length}</em>
                <Icone nome="baixo" tamanho={14} className={`text-[var(--muted)] transition ${fechado ? "-rotate-90" : ""}`} />
              </button>
              {!fechado && pessoas.map((m) => {
                const lider = m.temEquipe || m.nivel === "ceo";
                return (
                  <button key={m.membroId} type="button" data-membro={m.membroId} onClick={() => selecionar(m.membroId)}
                    aria-current={m.membroId === membro.membroId} className={`eq-pessoa ${lider ? "" : "pl-4"}`}>
                    <Rosto m={m} tamanho={lider ? 40 : 34} anel={lider ? m.setorCor : null} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1.5 truncate font-semibold">{m.nome}{lider && <SeloNivel m={m} />}</span>
                      <span className="block truncate text-[12.5px] text-[var(--tinta-2)]">{m.cargo}</span>
                      {m.ultima && <span className="block truncate text-[12px] text-[var(--tinta-2)] opacity-80">{m.ultima.deQuem === "voce" ? "Você: " : ""}{m.ultima.texto}</span>}
                    </span>
                    {m.ultima && <span className="self-start text-[11px] text-[var(--tinta-2)]">{quando(m.ultima.em)}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}
        {!ehSede(p.lote.chave) && <Link prefetch={false} href={`/mundo?lote=${encodeURIComponent(p.lote.chave)}`} className="mt-2 block rounded-2xl border-2 border-dashed border-[var(--linha)] p-3 text-center text-sm font-semibold text-[var(--azul)]">+ Contratar especialista no mapa</Link>}
      </div>
    </aside>
  );
}

function Conversas({ p, membro, q, selecionar, recarregar }: { p: Painel; membro: Membro; q: string; selecionar: (id: string) => void; recarregar: () => Promise<void> }) {
  // a conversa fica guardada com o id da pessoa: trocar de pessoa mostra "carregando" sem limpar o estado no efeito
  const [conv, setConvBruto] = useState<{ de: string; c: ConversaEquipe } | null>(null);
  const c = conv?.de === membro.membroId ? conv.c : null;
  const setC = (f: (c: ConversaEquipe | null) => ConversaEquipe | null) => setConvBruto((x) => { const n = f(x?.de === membro.membroId ? x.c : null); return n ? { de: membro.membroId, c: n } : null; });
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState<"msg" | "relatorio" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [todosSubs, setTodosSubs] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const chave = p.lote.chave;
  const trabalhando = !!c?.trabalhando;

  useEffect(() => {
    let vivo = true; const de = membro.membroId;
    api<ConversaEquipe>(`/api/workend/equipe/chat?${q}&membro=${encodeURIComponent(de)}`).then((r) => { if (vivo) { setConvBruto({ de, c: r }); setErro(null); } }).catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, membro.membroId, versao]);
  // enquanto a equipe trabalha, a conversa atualiza a cada 3 s; no fim, o painel (gasto, última mensagem) também
  useEffect(() => {
    if (!trabalhando) return;
    const t = setInterval(() => setVersao((v) => v + 1), 3000);
    return () => { clearInterval(t); void recarregar(); };
  }, [trabalhando, recarregar]);
  const itens = useMemo(() => linhaDoTempo(c, membro.membroId), [c, membro.membroId]);
  const progresso = useMemo(() => andamento(c, membro.membroId), [c, membro.membroId]);
  useEffect(() => { const el = lista.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, [itens.length, enviando]);

  const chefe = membro.chefeId ? p.equipe.find((m) => m.membroId === membro.chefeId) : null;
  const subs = p.equipe.filter((m) => m.chefeId === membro.membroId);
  const enviar = async (t = texto) => {
    const pedido = t.trim(); if (!pedido || enviando) return;
    setEnviando("msg"); setErro(null); setTexto("");
    const agora = new Date().toISOString(), tmp = `tmp-${agora}`;
    setC((x) => ({ mensagens: [...(x?.mensagens ?? []), { id: tmp, papel: "user", autor: "dono", deNome: null, conteudo: pedido, avaliacao: null, correcao: null, em: agora }], internas: x?.internas ?? [], trabalhando: x?.trabalhando ?? false }));
    try {
      const r = await api<RespostaEnvio>(`/api/workend/equipe/chat`, { method: "POST", body: JSON.stringify({ lote: chave, membro: membro.membroId, texto: pedido }) });
      setC((x) => ({ mensagens: [...(x?.mensagens ?? []), r.mensagem], internas: x?.internas ?? [], trabalhando: r.delegados.length > 0 || !!x?.trabalhando }));
      setVersao((v) => v + 1);
      void recarregar();
    } catch (e) { setErro((e as Error).message); setTexto(pedido); setC((x) => x && { ...x, mensagens: x.mensagens.filter((m) => m.id !== tmp) }); }
    setEnviando(null);
  };
  const relatorio = async () => {
    setEnviando("relatorio"); setErro(null);
    try {
      const r = await api<{ membroId: string; mensagem: Msg }>(`/api/workend/equipe/relatorio`, { method: "POST", body: JSON.stringify({ lote: chave }) });
      if (r.membroId !== membro.membroId) selecionar(r.membroId); else setVersao((v) => v + 1);
      void recarregar();
    } catch (e) { setErro((e as Error).message); }
    setEnviando(null);
  };

  return (
    <section className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <ListaEquipe p={p} membro={membro} selecionar={(id) => { setErro(null); selecionar(id); }} />

      <div className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-[var(--linha)] bg-[var(--surface)] lg:h-[760px]">
        <header className="eq-conversa-cab flex flex-wrap items-start gap-3 border-b border-[var(--linha)] p-4 pt-5" style={{ "--setor": membro.setorCor } as React.CSSProperties}>
          <Rosto m={membro} tamanho={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><b className="text-lg">{membro.nome}</b><SeloNivel m={membro} /></div>
            <div className="text-[14px] text-[var(--tinta-2)]">{membro.cargo} · <b style={{ color: membro.setorCor }}>{membro.setor}</b></div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
              {chefe && <button type="button" onClick={() => selecionar(chefe.membroId)} className="rounded-full bg-[var(--cinza)] px-2.5 py-1 text-[var(--tinta-2)] hover:text-[var(--tinta)]">Responde a <b className="text-[var(--tinta)]">{chefe.nome}</b> · {chefe.cargo}</button>}
              {subs.length > 0 && <span className="text-[var(--tinta-2)]">Comanda:</span>}
              {(todosSubs ? subs : subs.slice(0, 6)).map((s) => <button key={s.membroId} type="button" onClick={() => selecionar(s.membroId)} className="rounded-full bg-[#EEF3FF] px-2.5 py-1 font-semibold text-[var(--azul)] hover:bg-[#dfe8ff]">{s.nome}</button>)}
              {subs.length > 6 && <button type="button" onClick={() => setTodosSubs((v) => !v)} className="rounded-full px-2 py-1 font-semibold text-[var(--tinta-2)] hover:text-[var(--tinta)]">{todosSubs ? "mostrar menos" : `+${subs.length - 6}`}</button>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--tinta-2)]">{membro.treino || (membro.atendeVisitantes ? "Atende quem chega na loja pelo mapa." : "Ainda sem treino: diga o que essa pessoa faz em Montar escritório.")}</p>
          </div>
          {membro.nivel === "ceo" && <button type="button" onClick={relatorio} disabled={!!enviando || p.gasto.esgotado} className="btn btn-tinta !py-2.5 text-sm">{enviando === "relatorio" ? "Escrevendo o relatório…" : "Pedir relatório da semana"}</button>}
        </header>

        {(membro.especialista || membro.regras.length > 0) && (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--linha)] bg-[var(--cinza)] px-4 py-2.5 text-[12px]">
            {membro.especialista?.habilidades.map((h) => <span key={h} className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-medium text-[var(--azul)]">{h}</span>)}
            {membro.regras.length > 0 && <Regras membro={membro} lote={chave} mudou={recarregar} />}
          </div>
        )}

        <div ref={lista} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {c === null && !erro && <p className="text-sm text-[var(--tinta-2)]">Carregando a conversa…</p>}
          {c && itens.length === 0 && (
            <div className="mx-auto max-w-[48ch] py-8 text-center">
              <div className="mx-auto w-max"><Rosto m={membro} tamanho={88} /></div>
              <p className="mt-3 font-semibold">{membro.saudacao || `Oi! Sou ${membro.nome}. Em que posso ajudar a ${p.lote.empresaNome}?`}</p>
              <p className="mt-1 text-sm text-[var(--tinta-2)]">{subs.length ? `Peça uma tarefa como pediria a um funcionário. ${membro.nome} divide o trabalho com a própria equipe (${subs.length} ${subs.length === 1 ? "pessoa" : "pessoas"}) e entrega tudo junto aqui.` : "Peça uma tarefa como pediria a um funcionário. A resposta vem com o material pronto."}</p>
            </div>
          )}
          {itens.map((it) => it.tipo === "msg" ? <Bolha key={it.msg.id} m={it.msg} membro={membro} lote={chave} mudou={recarregar} atualizar={() => setVersao((v) => v + 1)} /> : <GrupoInternas key={it.grupo.chave} g={it.grupo} p={p} abrir={selecionar} />)}
          {(enviando || trabalhando) && (
            <div className="flex items-center gap-2.5 rounded-xl bg-[var(--cinza)] px-3.5 py-2.5 text-sm text-[var(--tinta-2)]">
              <Avatar m={membro} tamanho={28} /><span className="equipe-digitando"><i /><i /><i /></span>
              {enviando === "relatorio" ? `${membro.nome} está escrevendo o relatório…` : enviando ? `${membro.nome} está lendo e organizando o pedido…` : c?.gerandoImagem ? "A imagem está sendo criada. Costuma levar até um minuto e chega aqui na conversa." : progresso ? `A equipe está trabalhando: ${progresso.prontos} de ${progresso.total} ${progresso.total === 1 ? "pedido pronto" : "pedidos prontos"}. A entrega final chega aqui.` : `${membro.nome} está juntando as respostas da equipe…`}
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--linha)] p-3">
          {erro && <p className="mb-2 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
          {(c?.mensagens.length ?? 0) < 2 && !p.gasto.esgotado && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {sugestoesTarefa(membro, p.lote.empresaNome).map((s) => <button key={s} type="button" onClick={() => { setTexto(s); caixa.current?.focus(); }} className="rounded-full border border-[var(--linha)] px-3 py-1 text-[13px] hover:border-[var(--azul)] hover:text-[var(--azul)]">{s}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex items-end gap-2">
            <textarea ref={caixa} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              rows={2} placeholder={p.gasto.esgotado ? `Os ${brl(p.gasto.teto)} de IA deste mês acabaram.` : !p.ia ? "A IA está desligada no servidor agora." : `Dê uma tarefa para ${membro.nome}…`} disabled={p.gasto.esgotado || !p.ia}
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--azul)]" />
            <button type="submit" disabled={!texto.trim() || !!enviando || p.gasto.esgotado} className="btn btn-azul !py-3.5">Enviar</button>
          </form>
          <p className="mt-1.5 text-[12px] text-[var(--tinta-2)]">{subs.length ? `${membro.nome} pode pedir partes da tarefa a ${subs.map((s) => s.nome).slice(0, 3).join(", ")}${subs.length > 3 ? " e outros" : ""}. Enter envia, Shift+Enter quebra a linha.` : "Enter envia, Shift+Enter quebra a linha."}</p>
        </footer>
      </div>
    </section>
  );
}

const STATUS_INTERNA: Record<TrocaInterna["status"], { t: string; cor: string; fundo: string }> = {
  pedido: { t: "trabalhando", cor: "#8A6A12", fundo: "#FFF3CC" },
  respondido: { t: "respondeu", cor: "#166534", fundo: "#E3F6EA" },
  erro: { t: "não respondeu", cor: "#9B1C1C", fundo: "#FDECEC" },
};
// "Helena pediu a Ricardo: …", o andamento e a resposta (aberta com um clique)
function CartaoInterna({ t, p, abrir }: { t: TrocaInterna; p: Painel; abrir: (id: string) => void }) {
  const de = p.equipe.find((m) => m.membroId === t.de), para = p.equipe.find((m) => m.membroId === t.para);
  const st = STATUS_INTERNA[t.status] ?? STATUS_INTERNA.pedido;
  return (
    <div className="equipe-entra rounded-2xl border border-[var(--linha)] bg-white p-3.5 text-[14px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center">{de && <Avatar m={de} tamanho={28} />}<Icone nome="seta" tamanho={15} className="mx-1 text-[var(--tinta-2)]" />{para && <Avatar m={para} tamanho={28} />}</span>
        <span className="min-w-0 flex-1">
          <button type="button" onClick={() => abrir(t.de)} className="font-semibold hover:underline">{t.deNome}</button> pediu a{" "}
          <button type="button" onClick={() => abrir(t.para)} className="font-semibold hover:underline">{t.paraNome}</button>
          <span className="text-[13px] text-[var(--tinta-2)]"> · {t.paraCargo}</span>
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ color: st.cor, background: st.fundo }}>{st.t}</span>
        <span className="text-[11.5px] text-[var(--tinta-2)]">{quando(t.em)}</span>
      </div>
      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[var(--tinta-2)]">{t.pedido}</p>
      {t.resposta && t.status === "respondido" && (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#0F766E]">Ver a resposta de {t.paraNome}</summary>
          <div className="mt-1.5 rounded-xl bg-[var(--cinza)] p-3"><TextoIA t={t.resposta} className="text-[14px]" /></div>
        </details>
      )}
    </div>
  );
}

// os pedidos internos de uma tarefa dentro da conversa: a cadeia em ordem, com o 2º nível recuado
function GrupoInternas({ g, p, abrir }: { g: GrupoTarefa; p: Painel; abrir: (id: string) => void }) {
  return (
    <details open className="equipe-entra rounded-2xl border border-[var(--linha)] bg-[var(--cinza)] p-3">
      <summary className="cursor-pointer select-none text-[13.5px] font-semibold">Pedidos internos desta tarefa · {g.prontos} de {g.total} {g.total === 1 ? "respondido" : "respondidos"}{g.prontos < g.total ? " · a equipe está trabalhando" : ""}</summary>
      <div className="mt-2.5 space-y-2.5">{g.itens.map(({ t, nivel }) => <div key={t.id} className={nivel === 2 ? "ml-5 border-l-2 border-[var(--line-strong)] pl-3 sm:ml-8" : ""}><CartaoInterna t={t} p={p} abrir={abrir} /></div>)}</div>
    </details>
  );
}

// todas as conversas internas da empresa, com filtro por andamento e busca; atualiza sozinho enquanto há pedido aberto
function Internas({ p, q, abrir }: { p: Painel; q: string; abrir: (id: string) => void }) {
  const [lista, setLista] = useState<TrocaInterna[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [filtro, setFiltro] = useState<"todas" | "pedido" | "respondido">("todas");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    let vivo = true;
    api<{ internas: TrocaInterna[] }>(`/api/workend/equipe/internas?${q}`).then((r) => { if (vivo) { setLista(r.internas); setErro(null); } }).catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, versao]);
  const aberto = !!lista?.some((t) => t.status === "pedido");
  useEffect(() => { if (!aberto) return; const t = setInterval(() => setVersao((v) => v + 1), 4000); return () => clearInterval(t); }, [aberto]);
  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (lista ?? []).filter((t) => (filtro === "todas" || t.status === filtro) && (!b || `${t.deNome} ${t.paraNome} ${t.paraCargo} ${t.pedido}`.toLowerCase().includes(b)));
  }, [lista, filtro, busca]);
  const ceo = p.equipe.find((m) => m.nivel === "ceo");
  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto max-w-[70ch] text-[14px] text-[var(--tinta-2)]">Quando você dá uma tarefa a quem comanda uma área, essa pessoa pede partes do trabalho a quem responde a ela. Aqui fica tudo o que a equipe pediu e respondeu entre si.</p>
        <div className="flex gap-1 rounded-xl bg-[var(--surface-dim)] p-1 text-[13px] font-semibold">
          {([["todas", "Todas"], ["pedido", "Em andamento"], ["respondido", "Respondidas"]] as const).map(([k, t]) => <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-lg px-2.5 py-1.5 ${filtro === k ? "bg-[var(--surface)] shadow" : "text-[var(--tinta-2)]"}`}>{t}</button>)}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value.slice(0, 40))} placeholder="Buscar" className="w-40 rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--azul)]" />
      </div>
      {erro && <p className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
      {!lista && !erro && <p className="mt-4 text-[var(--tinta-2)]">Carregando…</p>}
      {lista?.length === 0 && (
        <div className="mt-4 rounded-2xl bg-[var(--cinza)] p-7">
          <b>A equipe ainda não conversou entre si.</b>
          <p className="mt-1 text-[var(--tinta-2)]">Dê uma tarefa ao CEO ou a quem comanda uma área: os pedidos que essa pessoa fizer à equipe aparecem aqui, com as respostas.</p>
          {ceo && <button type="button" onClick={() => abrir(ceo.membroId)} className="btn btn-azul mt-4">Dar uma tarefa para {ceo.nome}</button>}
        </div>
      )}
      {lista && lista.length > 0 && visiveis.length === 0 && <p className="mt-4 text-[var(--tinta-2)]">Nada com esse filtro.</p>}
      <div className="mt-4 space-y-5">
        {agruparPorTarefa(visiveis).map((g) => (
          <article key={g.chave} className="rounded-2xl bg-[var(--cinza)] p-4">
            <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] font-bold text-[var(--azul)]">Tarefa que você deu a {g.quem.nome}</span>
              <span className="text-[12.5px] text-[var(--tinta-2)]">{quando(g.em)} · {g.prontos} de {g.total} {g.total === 1 ? "pedido respondido" : "pedidos respondidos"}</span>
              <button type="button" onClick={() => abrir(g.quem.id)} className="ml-auto text-[13px] font-semibold text-[var(--azul)] hover:underline">Ver a entrega na conversa</button>
              {g.tarefa && <p className="w-full text-[15px] font-semibold text-[var(--tinta)]">“{g.tarefa}”</p>}
            </header>
            <div className="space-y-2.5">
              {g.itens.map(({ t, nivel }) => <div key={t.id} className={nivel === 2 ? "ml-5 border-l-2 border-[var(--line-strong)] pl-3 sm:ml-10" : ""}><CartaoInterna t={t} p={p} abrir={abrir} /></div>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// resposta da equipe com aprovar / corrigir (a correção vira regra permanente daquela pessoa). Os pedidos internos do chefe
// e as respostas da equipe juntadas também aparecem, cada um com o seu formato.
function Bolha({ m, membro, lote, mudou, atualizar }: { m: Msg; membro: Membro; lote: string; mudou: () => Promise<void>; atualizar: () => void }) {
  const [av, setAv] = useState(m.avaliacao);
  const [corrigindo, setCorrigindo] = useState(false);
  const [correcao, setCorrecao] = useState("");
  const [regra, setRegra] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (m.autor === "dono") return <div className="equipe-entra ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[var(--azul)] px-4 py-2.5 text-[15px] text-white"><p className="whitespace-pre-wrap">{m.conteudo}</p></div>;
  if (m.autor === "chefe") return (
    <div className="equipe-entra max-w-[88%] rounded-2xl border border-[#F2D58A] bg-[#FFF8E6] px-4 py-3 text-[#4A3A10]">
      <div className="mb-1 text-[12.5px] font-bold text-[#8A6A12]">Pedido interno de {m.deNome ?? "um chefe"}</div>
      <TextoIA t={m.conteudo.replace(/^Pedido de [^\n]*:\n\n/, "")} className="text-[14.5px]" />
    </div>
  );
  if (m.autor === "equipe") return (
    <details className="equipe-entra max-w-[88%] rounded-2xl border border-[var(--linha)] bg-white px-4 py-2.5">
      <summary className="cursor-pointer select-none text-[13px] font-semibold text-[#0F766E]">A equipe respondeu e {membro.nome} juntou tudo · ver as respostas de cada um</summary>
      <TextoIA t={m.conteudo.replace(/^Respostas da sua equipe:\n\n/, "")} className="mt-2 text-[14px] text-[var(--tinta-2)]" />
    </details>
  );
  const treinar = async (avaliacao: 1 | -1, texto?: string) => {
    if (m.id.startsWith("tmp")) return;
    setOcupado(true);
    try {
      const r = await api<{ regra: Regra | null }>(`/api/workend/equipe/treino`, { method: "POST", body: JSON.stringify({ lote, membro: membro.membroId, mensagemId: m.id, avaliacao, correcao: texto }) });
      setAv(avaliacao); setCorrigindo(false); if (r.regra) { setRegra(r.regra.texto); void mudou(); }
    } catch { /* mantém como estava */ }
    setOcupado(false);
  };
  return (
    <div className="equipe-entra flex max-w-[92%] gap-2.5">
      <Avatar m={membro} tamanho={32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-[var(--linha)] bg-white px-4 py-3"><Texto t={m.conteudo} /></div>
        {m.imagem && <CartaoImagemEquipe c={m.imagem} lote={lote} atualizar={() => { atualizar(); void mudou(); }} />}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          <button type="button" disabled={ocupado} onClick={() => treinar(1)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${av === 1 ? "bg-[#E3F6EA] text-[#166534]" : "text-[var(--tinta-2)] hover:bg-[var(--cinza)]"}`}>{av === 1 && <Icone nome="check" tamanho={13} />}{av === 1 ? "Aprovado" : "Aprovar"}</button>
          <button type="button" disabled={ocupado} onClick={() => setCorrigindo((v) => !v)} className={`rounded-full px-2.5 py-1 font-semibold ${av === -1 ? "bg-[#FDECEC] text-[#9B1C1C]" : "text-[var(--tinta-2)] hover:bg-[var(--cinza)]"}`}>{av === -1 ? "Corrigido" : "Corrigir"}</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.conteudo); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="rounded-full px-2.5 py-1 font-semibold text-[var(--tinta-2)] hover:bg-[var(--cinza)]">{copiado ? "Copiado!" : "Copiar"}</button>
          <EnviarPara m={m} membro={membro} lote={lote} />
          <span className="text-[var(--tinta-2)]">{quando(m.em)}</span>
        </div>
        {corrigindo && (
          <form onSubmit={(e) => { e.preventDefault(); if (correcao.trim().length >= 4) void treinar(-1, correcao); }} className="mt-2 flex gap-2">
            <input value={correcao} onChange={(e) => setCorrecao(e.target.value.slice(0, 600))} autoFocus placeholder="O que estava errado? Ex.: nosso horário é das 7h às 19h" className="min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--azul)]" />
            <button type="submit" disabled={ocupado || correcao.trim().length < 4} className="btn btn-tinta !py-2 text-sm">{ocupado ? "Ensinando…" : "Ensinar"}</button>
          </form>
        )}
        {(regra || m.correcao) && <p className="mt-1.5 rounded-lg bg-[#EEF3FF] px-3 py-1.5 text-[12px] text-[var(--azul)]">{regra ? <>Aprendeu: <b>{regra}</b></> : <>Correção: {m.correcao}</>}</p>}
      </div>
    </div>
  );
}

function Regras({ membro, lote, mudou }: { membro: Membro; lote: string; mudou: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const remover = async (id: string) => { await api(`/api/workend/equipe/treino`, { method: "POST", body: JSON.stringify({ lote, membro: membro.membroId, removerRegra: id }) }).catch(() => {}); void mudou(); };
  return (
    <span className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className="rounded-full bg-[var(--tinta)] px-2.5 py-1 font-semibold text-white">Já aprendeu {membro.regras.length} {membro.regras.length === 1 ? "regra" : "regras"}</button>
      {aberto && (
        <span className="absolute left-0 top-8 z-20 block w-[300px] rounded-xl border border-[var(--linha)] bg-[var(--surface)] p-3 shadow-xl">
          {membro.regras.map((r) => <span key={r.id} className="flex items-start gap-2 py-1 text-[13px]"><span className="flex-1">{r.texto}</span><button type="button" onClick={() => remover(r.id)} className="text-[#E2575B]" title="Esquecer esta regra" aria-label="Esquecer esta regra"><Icone nome="fechar" tamanho={14} /></button></span>)}
        </span>
      )}
    </span>
  );
}

// também na página grátis (WE-13b, app/_pagina-gratis.tsx)
export function Visitantes({ q }: { q: string }) {
  const [lista, setLista] = useState<Visitante[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [falasDe, setFalasDe] = useState<{ de: string; falas: FalaVisita[] } | null>(null);
  const falas = aberto && falasDe?.de === aberto ? falasDe.falas : null;
  useEffect(() => { api<Visitante[]>(`/api/workend/equipe/visitantes?${q}`).then(setLista).catch(() => setLista([])); }, [q]);
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    api<FalaVisita[]>(`/api/workend/equipe/visitantes?${q}&visitante=${encodeURIComponent(aberto)}`).then((f) => vivo && setFalasDe({ de: aberto, falas: f })).catch(() => vivo && setFalasDe({ de: aberto, falas: [] }));
    return () => { vivo = false; };
  }, [aberto, q]);
  if (!lista) return <p className="mt-6 text-[var(--tinta-2)]">Carregando…</p>;
  if (!lista.length) return <div className="mt-5 rounded-2xl bg-[var(--cinza)] p-7"><b>Ninguém conversou com a loja ainda.</b><p className="mt-1 text-[var(--tinta-2)]">Quando alguém clicar na sua atendente no mapa ou abrir a página da loja, a conversa aparece aqui, com o contato que a pessoa deixar.</p></div>;
  return (
    <section className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ul className="space-y-2">
        {lista.map((v) => (
          <li key={v.visitanteId}><button type="button" onClick={() => setAberto(v.visitanteId)} className={`w-full rounded-2xl border p-3 text-left transition ${aberto === v.visitanteId ? "border-[var(--azul)] bg-[var(--surface)] shadow-md" : "border-transparent bg-[var(--cinza)] hover:border-[var(--linha)]"}`}>
            <span className="flex min-w-0 items-baseline justify-between gap-2"><b className="truncate">{v.nome ?? "Visitante"}</b><span className="text-[11px] text-[var(--tinta-2)]">{quando(v.ultimaEm)}</span></span>
            <span className="block truncate text-[13px] text-[var(--tinta-2)]">{v.ultimaFala ?? "—"}</span>
          </button></li>
        ))}
      </ul>
      <div className="min-h-[360px] rounded-2xl border border-[var(--linha)] bg-[var(--surface)] p-4">
        {!aberto && <p className="text-[var(--tinta-2)]">Escolha uma conversa para ler.</p>}
        {aberto && !falas && <p className="text-[var(--tinta-2)]">Carregando…</p>}
        <div className="space-y-3">
          {falas?.map((f) => (
            <div key={f.id} className={f.papel === "user" ? "max-w-[80%]" : "ml-auto max-w-[85%]"}>
              <span className="text-[11px] font-semibold text-[var(--tinta-2)]">{f.papel === "user" ? "Visitante" : f.quem} · {quando(f.criadoEm)}</span>
              <div className={`mt-0.5 rounded-2xl px-4 py-2.5 ${f.papel === "user" ? "bg-[var(--cinza)]" : "bg-[#EEF3FF]"}`}><Texto t={f.conteudo} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sobre({ p, lote, salvo }: { p: Painel; lote: string; salvo: () => Promise<void> }) {
  const [sobre, setSobre] = useState(p.sobre);
  const [c, setC] = useState<Contatos>(p.contatos ?? {});
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | string>("");
  const [base, setBase] = useState({ sobre: p.sobre, contatos: JSON.stringify(p.contatos ?? {}) });
  const mudou = useMemo(() => sobre !== base.sobre || JSON.stringify(c) !== base.contatos, [sobre, c, base]);
  const salvar = async () => {
    setEstado("salvando");
    try { const r = await api<{ contatos: Contatos | null }>(`/api/workend/equipe`, { method: "PUT", body: JSON.stringify({ lote, sobre, contatos: c }) }); if (r.contatos) setC(r.contatos); setBase({ sobre, contatos: JSON.stringify(r.contatos ?? c) }); setEstado("salvo"); void salvo(); }
    catch (e) { setEstado((e as Error).message); }
  };
  const campo = (k: keyof Contatos, rotulo: string, ph: string) => <label className="campo">{rotulo}<input value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={ph} /></label>;
  return (
    <section className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="pg-cartao p-6">
        <h2 className="text-[1.4rem]">Sobre a {p.lote.empresaNome}</h2>
        <p className="mt-1 text-sm text-[var(--tinta-2)]">Toda a equipe lê este texto antes de responder, e a atendente usa só ele para falar com os visitantes. Ele também aparece na página pública da loja.</p>
        <label className="campo mt-4">O que a empresa faz, para quem, preços, horários, onde atende e como contratar
          <textarea rows={12} value={sobre} onChange={(e) => setSobre(e.target.value.slice(0, 3000))} placeholder={"Ex.: Padaria artesanal no centro de Lagarto (SE).\nPães de fermentação natural a partir de R$ 12; bolos sob encomenda com 2 dias de antecedência.\nAberta de segunda a sábado, das 6h às 19h. Entregamos no centro por R$ 5.\nPedidos pelo WhatsApp."} />
        </label>
        <p className="mt-1 text-right text-[12px] text-[var(--tinta-2)]">{sobre.length} de 3000</p>
      </div>
      <div className="pg-cartao p-6">
        <h2 className="text-[1.2rem]">Contatos públicos</h2>
        <p className="mt-1 text-sm text-[var(--tinta-2)]">Aparecem na página da loja e na busca. Deixe em branco o que não quiser mostrar.</p>
        <div className="mt-4 space-y-3">
          {campo("whatsapp", "WhatsApp (com DDD)", "79 99999-0000")}
          {campo("instagram", "Instagram", "@suaempresa")}
          {campo("site", "Site", "suaempresa.com.br")}
          {campo("email", "E-mail", "contato@suaempresa.com.br")}
        </div>
        <button type="button" onClick={salvar} disabled={!mudou || estado === "salvando"} className="btn btn-azul mt-5 w-full">{estado === "salvando" ? "Salvando…" : "Salvar"}</button>
        {estado === "salvo" && !mudou && <p className="mt-2 text-center text-sm text-[#166534]">Salvo. A equipe já usa o texto novo.</p>}
        {estado && !["salvando", "salvo"].includes(estado) && <p className="mt-2 text-center text-sm text-[#9B1C1C]">{estado}</p>}
      </div>
    </section>
  );
}
