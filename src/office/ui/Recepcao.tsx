"use client";
// Recepção dos prédios (17/11/2026, pedido do dono: "preciso que possa entrar, e que apareça uma porta ou se direcione para
// a recepção onde será atendido. Por ser o dono eles irão reconhecer, mas se for um visitante precisará ser recepcionado e
// aguardar até ser atendido"):
//  - perto de uma porta aparece "Entrar em …" (e o mesmo botão nos cartões da loja e da sede);
//  - a caminho e entrando: um aviso pequeno com "Cancelar";
//  - no balcão: o DONO é reconhecido na hora (atalhos para a equipe); o VISITANTE espera a vez (fila com quem já está no
//    balcão) e depois é atendido pela atendente de IA da empresa;
//  - "Sair do prédio" leva de volta à calçada.
// 20/11/2026 (pedido do dono: "quero que quando a pessoa entre em uma das empresas e seja visitante tenha acesso apenas à
// recepcionista, e daí ela vai ser direcionada para outro setor após decidir o que quer falar"): a recepcionista pergunta
// "Em que posso ajudar?" com os assuntos dos setores que a empresa tem (data/recepcao.ts) e um campo de texto. Escolhido o
// assunto, ela diz para onde vai, a catraca libera só o caminho (personagemStore › encaminhar) e, na sala, a conversa
// passa para o responsável do setor (NoSetor), com o que foi dito na recepção. Empresa sem setor: atende ali mesmo.
// O caminho e as fases ficam no personagemStore (entrarNoPredio / sairDoPredio) e em scene/Personagens.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePersonagem, minhaPos, type PredioAtual } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { entradasDaCidade, type Entrada } from "../data/entradas";
import { abrirChatEquipe, useChatEquipe } from "./ChatEquipe";
import { ChatLoja, useLoja } from "./ChatLoja";
import { Icone, type NomeIcone } from "./Icone";
import { sedeDoParametro, sedeDe } from "../data/sedes";
import { destinosDaRecepcao, type Destino, type Assunto } from "../data/recepcao";

function useEntradas() {
  const terrenos = useMundo((s) => s.terrenos);
  return useMemo(() => entradasDaCidade(terrenos), [terrenos]);
}

// botão "Entrar no prédio" (cartão da loja e da sede)
export function BotaoEntrar({ chave, escuro = false, className = "" }: { chave: string; escuro?: boolean; className?: string }) {
  const ativo = usePersonagem((s) => s.ativo);
  const dentroDe = usePersonagem((s) => (s.predio && s.predio.fase !== "indo" ? s.predio.chave : null));
  const entrada = useEntradas().find((e) => e.chave === chave) ?? null;
  if (!entrada || dentroDe === chave) return null;
  const estilo = escuro ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15" : "bg-[#EEF3FF] text-[#1D4ED8] hover:bg-[#dfe8ff]";
  if (!ativo) return <button type="button" onClick={() => usePersonagem.getState().abrir("montar")} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${estilo} ${className}`}><Icone nome="pessoa" tamanho={16} />Crie seu personagem para entrar</button>;
  return (
    <button type="button" onClick={() => usePersonagem.getState().entrarNoPredio(entrada)} disabled={!!dentroDe} title={dentroDe ? "Saia do prédio em que você está primeiro" : undefined}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${estilo} ${className}`}>
      <Icone nome="casa" tamanho={16} />Entrar no prédio
    </button>
  );
}

const CAIXA = "pointer-events-auto absolute inset-x-2 bottom-24 z-30 mx-auto max-w-[460px]";

// perto de uma porta (na calçada): "Entrar em …"
function PertoDaPorta() {
  const entradas = useEntradas();
  const ativo = usePersonagem((s) => s.ativo);
  const [perto, setPerto] = useState<Entrada | null>(null);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => {
      let melhor: Entrada | null = null, dm = 3.2;
      for (const e of entradas) { const d = Math.hypot(minhaPos.x - e.fora[0], minhaPos.z - e.fora[1]); if (d < dm) { dm = d; melhor = e; } }
      setPerto((x) => (x?.chave === melhor?.chave ? x : melhor));
    }, 400);
    return () => clearInterval(t);
  }, [ativo, entradas]);
  if (!ativo || !perto) return null;
  return (
    <div className={`${CAIXA} flex justify-center`}>
      <button type="button" onClick={() => usePersonagem.getState().entrarNoPredio(perto)} className="hud-ilha inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-xl">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#16A34A]"><Icone nome="casa" tamanho={15} /></span>Entrar em {perto.nome}
      </button>
    </div>
  );
}

// link "Entrar no prédio" das páginas públicas (/mundo?lote=…&entrar=1 ou ?sede=…&entrar=1, 17/11/2026): quando o mapa e o
// personagem carregam, entra sozinho naquele prédio; sem personagem, abre a criação dele
function useEntrarPeloLink() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("entrar") !== "1") return;
    let n = 0;
    const t = setInterval(() => {
      const m = useMundo.getState(), st = usePersonagem.getState();
      if (++n > 120) { clearInterval(t); return; } // 1 minuto esperando o mapa
      if (!m.carregado || !st.carregado) return;
      clearInterval(t);
      const chave = q.get("lote") ?? sedeDoParametro(q.get("sede"))?.chave ?? null;
      const e = chave ? entradasDaCidade(m.terrenos).find((x) => x.chave === chave) : null;
      if (!e) return;
      if (!st.ativo) { st.abrir("montar"); return; }
      st.entrarNoPredio(e);
    }, 500);
    return () => clearInterval(t);
  }, []);
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;
function textoDaFase(p: PredioAtual, andando: boolean) {
  const l = p.liberado;
  if (p.fase === "indo") return `A caminho de ${p.nome}…`;
  if (p.fase === "entrando") return p.atendido ? "Voltando à recepção…" : `Entrando em ${p.nome}…`;
  if (p.fase === "saindo") return `Saindo de ${p.nome}…`;
  if (p.fase === "dentro" && l) return andando ? `Indo até ${primeiroNome(l.nome)}, em ${l.setorNome}…` : `Em ${l.setorNome}`;
  if (p.fase === "dentro") return `Dentro de ${p.nome}`;
  return `Na recepção de ${p.nome}`;
}

export function Recepcao() {
  useEntrarPeloLink();
  const predio = usePersonagem((s) => s.predio);
  const andando = usePersonagem((s) => !!s.destino);
  const chatAberto = useChatEquipe((s) => s.aberto);
  if (!predio) return <PertoDaPorta />;
  const lib = predio.liberado ?? null;
  // chegou no setor para onde a recepção mandou: a conversa passa para quem atende ali
  if (predio.fase === "dentro" && lib?.chegou && !chatAberto) return <><AvisoPredio /><NoSetor key={`${predio.visita}-${lib.membroId}`} /></>;
  if (predio.fase !== "recepcao" || chatAberto) {
    const st = usePersonagem.getState;
    return (
      <>
        <AvisoPredio />
        <div className={`${CAIXA} flex justify-center`}>
          <div className="hud-ilha inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-semibold text-white shadow-xl">
            <span className="min-w-0 truncate">{textoDaFase(predio, andando)}</span>
            {/* encaminhado e parado fora da frente de quem atende: volta até a pessoa */}
            {predio.fase === "dentro" && lib && !andando && <button type="button" onClick={() => st().encaminhar(lib)} className="shrink-0 whitespace-nowrap rounded-full bg-[#16A34A] px-3 py-1.5 text-[13px] hover:brightness-110">Falar com {primeiroNome(lib.nome)}</button>}
            {/* andando por dentro (data/plantaInterna.ts): toque no chão para ir a outro lugar; voltar ao balcão ou sair */}
            {predio.fase === "dentro" && <button type="button" onClick={() => st().voltarRecepcao()} className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/20">{lib ? "Recepção" : "Ir à recepção"}</button>}
            {predio.fase !== "saindo" && <button type="button" onClick={() => st().sairDoPredio()} className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/20">{predio.fase === "indo" ? "Cancelar" : lib ? "Sair" : "Sair do prédio"}</button>}
          </div>
        </div>
      </>
    );
  }
  return <><AvisoPredio /><Balcao key={predio.visita} /></>;
}

// aviso curto por cima ("Área só da equipe", "Para passar da catraca…"), some sozinho
function AvisoPredio() {
  const aviso = usePersonagem((s) => s.avisoPredio);
  const [visto, setVisto] = useState(0);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setVisto(aviso.n), 3400);
    return () => clearTimeout(t);
  }, [aviso]);
  if (!aviso || visto === aviso.n) return null;
  return (
    <div className="pointer-events-none absolute inset-x-2 top-24 z-30 flex justify-center" role="status">
      <span className="hud-ilha inline-flex max-w-full items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-xl"><span className="shrink-0"><Icone nome="catraca" tamanho={16} /></span>{aviso.texto}</span>
    </div>
  );
}

// no balcão da recepção
function Balcao() {
  const predio = usePersonagem((s) => s.predio)!;
  const meuNome = usePersonagem((s) => s.meu?.nome ?? "");
  const dono = useMundo((s) => s.meus.includes(predio.chave)); // dono ou sócio
  const usuario = useMundo((s) => s.usuario);
  const terreno = useMundo((s) => s.terrenos[predio.chave]);
  const atendente = terreno?.escritorio?.equipe.find((m) => m.papel === "atendente") ?? null;
  const nomeAt = atendente?.nome ?? "A recepção";
  const equipe = terreno?.escritorio?.equipe.length ?? 0;
  const destinos = useMemo(() => destinosDaRecepcao(terreno?.escritorio, !!sedeDe(predio.chave)), [terreno?.escritorio, predio.chave]);
  const saudacao = (() => { const s = atendente?.treino?.saudacao || `Olá! Sou ${nomeAt}, da recepção de ${predio.nome}. Em que posso ajudar?`; return s.includes("?") ? s : `${s} Em que posso ajudar?`; })();
  // visitante: espera a vez; quando chega, a atendente cumprimenta e a conversa abre (quem volta de um setor não espera)
  const [atendido, setAtendido] = useState(dono || !!predio.atendido);
  useEffect(() => {
    if (dono || predio.atendido) return;
    const t = setTimeout(() => {
      setAtendido(true);
      usePersonagem.setState({ falaRecepcao: { chave: predio.chave, texto: saudacao } });
    }, predio.esperaMs);
    return () => clearTimeout(t);
  }, [dono, predio.atendido, predio.esperaMs, predio.chave, saudacao]);
  const sair = () => usePersonagem.getState().sairDoPredio();
  return (
    <div className={CAIXA} role="dialog" aria-label={`Recepção de ${predio.nome}`}>
      <div className="painel-entra overflow-hidden rounded-2xl bg-[#0E1013]/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-bold" style={{ background: atendente?.camisa ?? "#16A34A" }}>{nomeAt.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-white/55">Recepção de {predio.nome}</div>
            <div className="truncate text-[15px] font-bold">{nomeAt}{atendente?.cargo ? <span className="ml-1.5 text-[12px] font-medium text-white/55">{atendente.cargo}</span> : null}</div>
          </div>
          <button type="button" onClick={sair} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/20">Sair do prédio</button>
        </div>
        {dono ? (
          <div className="px-4 pb-4">
            <p className="rounded-2xl rounded-tl-md bg-white/[.07] px-3.5 py-2.5 text-[14px] leading-snug">Bem-vindo de volta{meuNome ? `, ${meuNome}` : ""}! A equipe te reconheceu{equipe ? ` e as ${equipe} pessoas já sabem que você chegou` : ""}. O que vamos fazer hoje?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void abrirChatEquipe(predio.chave)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E9C46A] px-3 py-2.5 text-[13.5px] font-bold text-[#1A1306] hover:brightness-105"><Icone nome="conversar" tamanho={16} />Falar com a equipe</button>
              <a href="/app/equipe" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-[13.5px] font-semibold hover:bg-white/15"><Icone nome="equipe" tamanho={16} />Minha equipe</a>
            </div>
          </div>
        ) : !atendido ? (
          <div className="px-4 pb-4">
            <p className="rounded-2xl rounded-tl-md bg-white/[.07] px-3.5 py-2.5 text-[14px] leading-snug">
              {predio.fila ? `${nomeAt} está terminando um atendimento. Você é o ${predio.fila + 1}º da fila; aguarde a sua vez.` : `Olá! Seja bem-vindo à recepção de ${predio.nome}. ${nomeAt} já vem te atender, aguarde um instante.`}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden><i className="recepcao-espera block h-full rounded-full bg-[#16A34A]" style={{ animationDuration: `${predio.esperaMs}ms` }} /></div>
            <p className="mt-1.5 text-[12px] text-white/50">Aguardando atendimento…</p>
          </div>
        ) : destinos.length ? (
          <Triagem predio={predio} nomeAt={nomeAt} saudacao={predio.atendido ? "Que bom te ver de novo! Posso ajudar em mais alguma coisa?" : saudacao} destinos={destinos} logado={!!usuario} />
        ) : (
          <AtendimentoVisitante numero={predio.numero ?? 0} logado={!!usuario} />
        )}
      </div>
    </div>
  );
}

// empresa sem setor para encaminhar: a recepcionista atende ali mesmo, como antes
function AtendimentoVisitante({ numero, logado }: { numero: number; logado: boolean }) {
  const { loja, erro } = useLoja(numero);
  if (erro) return <p className="px-4 pb-4 text-[13px] text-white/70">{erro}</p>;
  if (!loja) return <p className="px-4 pb-4 text-[13px] text-white/60">Chamando a atendente…</p>;
  return (
    <div className="bg-white px-3 pb-3 pt-2 text-[#1D2128]">
      <ChatLoja loja={loja} logado={logado} linkEntrar={`/entrar?destino=${encodeURIComponent("/mundo")}`} alto={220} />
    </div>
  );
}

const ICONE_ASSUNTO: Record<Assunto, NomeIcone> = { vendas: "sacola", suporte: "ajuda", financeiro: "recibo", parcerias: "negociar", trabalhe: "candidato", responsavel: "pessoa", setor: "equipe" };
type Fala = { de: "recepcao" | "eu"; texto: string };

// "Em que posso ajudar?": os assuntos (os setores que a empresa tem) e o campo de texto. A recepcionista responde, diz
// para onde vai e, um instante depois, a catraca abre e o personagem é levado até lá
function Triagem({ predio, nomeAt, saudacao, destinos, logado }: { predio: PredioAtual; nomeAt: string; saudacao: string; destinos: Destino[]; logado: boolean }) {
  const [falas, setFalas] = useState<Fala[]>([{ de: "recepcao", texto: saudacao }]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [semDestino, setSemDestino] = useState(0);
  const [indo, setIndo] = useState<Destino | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; }, [falas, enviando]);
  const outros = destinos.filter((d) => d.assunto === "setor");
  const mostrarOutros = todos || outros.length <= 2;
  const visiveis = destinos.filter((d) => d.assunto !== "setor" || mostrarOutros);
  const pedir = async (corpo: { destino?: string; texto?: string; insistiu?: boolean }, disse: string) => {
    if (enviando || indo) return;
    setEnviando(true); setErro(null);
    setFalas((f) => [...f, { de: "eu", texto: disse }]);
    try {
      const r = await fetch(`/api/workend/loja/${predio.numero ?? 0}/recepcao`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; fala?: string; destino?: Destino | null };
      if (!r.ok || !j.fala) throw new Error(j.erro ?? "Não deu para falar com a recepção agora.");
      setFalas((f) => [...f, { de: "recepcao", texto: j.fala! }]);
      usePersonagem.setState({ falaRecepcao: { chave: predio.chave, texto: j.fala } });
      const d = j.destino ?? null;
      if (d) {
        setIndo(d);
        // um instante para ler a resposta; se ele saiu do balcão nesse meio tempo, não leva
        timer.current = setTimeout(() => {
          const p = usePersonagem.getState().predio; if (!p || p.chave !== predio.chave || p.fase !== "recepcao") return;
          const falhou = usePersonagem.getState().encaminhar(d);
          if (falhou) { setIndo(null); setErro(falhou); }
        }, 1600);
      } else setSemDestino((n) => n + 1);
    } catch (e) { setErro((e as Error).message); }
    setEnviando(false);
  };
  const enviarTexto = () => { const t = texto.trim(); if (!t) return; setTexto(""); void pedir({ texto: t, insistiu: semDestino > 0 }, t); };
  return (
    <div className="px-4 pb-4">
      <div ref={lista} className="max-h-[30vh] space-y-2 overflow-y-auto pr-0.5" aria-live="polite">
        {falas.map((f, i) => (
          <p key={i} className={f.de === "recepcao" ? "max-w-[92%] rounded-2xl rounded-tl-md bg-white/[.07] px-3.5 py-2.5 text-[14px] leading-snug" : "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#1D4ED8] px-3.5 py-2 text-[14px] leading-snug"}>{f.texto}</p>
        ))}
        {enviando && <p className="text-[12px] text-white/50">{nomeAt} está vendo para onde te levar…</p>}
      </div>
      {indo ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#16A34A]/15 px-3 py-2.5 text-[13px] font-semibold text-[#86EFAC] ring-1 ring-[#16A34A]/35">
          <Icone nome="catraca" tamanho={17} /><span className="min-w-0">Catraca liberada até {indo.setorNome}. Seguindo para lá…</span>
        </div>
      ) : !logado ? (
        <a href={`/entrar?destino=${encodeURIComponent("/mundo")}`} className="mt-3 block rounded-xl bg-[#E9C46A] px-3 py-2.5 text-center text-sm font-bold text-[#1A1306]">Entrar para ser atendido (é grátis)</a>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Assuntos">
            {visiveis.map((d) => (
              <button key={d.id} type="button" disabled={enviando} onClick={() => void pedir({ destino: d.id }, d.rotulo)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/10 transition hover:bg-white/[.17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E9C46A] disabled:opacity-50">
                <Icone nome={ICONE_ASSUNTO[d.assunto]} tamanho={15} />{d.rotulo}
              </button>
            ))}
            {!mostrarOutros && <button type="button" onClick={() => setTodos(true)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/75 ring-1 ring-white/20 hover:bg-white/10">Outros setores ({outros.length})<Icone nome="baixo" tamanho={14} /></button>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); enviarTexto(); }} className="mt-2.5 flex gap-1.5">
            <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 800))} placeholder="Ou escreva o que você procura…" aria-label="O que você procura"
              className="min-w-0 flex-1 rounded-xl bg-white/[.08] px-3 py-2 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-[#E9C46A] sm:text-sm" />
            <button type="submit" disabled={!texto.trim() || enviando} className="rounded-xl bg-[#E9C46A] px-3 py-2 text-sm font-bold text-[#1A1306] disabled:opacity-50">Enviar</button>
          </form>
        </>
      )}
      {erro && <p className="mt-2 text-[12.5px] font-semibold text-[#FCA5A5]">{erro}</p>}
    </div>
  );
}

// no setor: a conversa com quem atende ali (o responsável da área), com a saudação que já traz o pedido da recepção
function NoSetor() {
  const predio = usePersonagem((s) => s.predio)!;
  const lib = predio.liberado!;
  const usuario = useMundo((s) => s.usuario);
  const { loja, erro } = useLoja(predio.numero ?? 0);
  const st = usePersonagem.getState;
  return (
    <div className={CAIXA} role="dialog" aria-label={`${lib.setorNome} de ${predio.nome}`}>
      <div className="painel-entra overflow-hidden rounded-2xl bg-[#0E1013]/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-bold" style={{ background: lib.camisa }}>{lib.nome.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-white/55">{lib.setorNome} · {predio.nome}</div>
            <div className="truncate text-[15px] font-bold">{lib.nome}<span className="ml-1.5 text-[12px] font-medium text-white/55">{lib.cargo}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          <button type="button" onClick={() => st().voltarRecepcao()} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/20"><Icone nome="girarEsq" tamanho={14} />Voltar à recepção</button>
          <button type="button" onClick={() => st().sairDoPredio()} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/20"><Icone nome="sair" tamanho={14} />Sair do prédio</button>
        </div>
        {erro ? <p className="px-4 pb-4 text-[13px] text-white/70">{erro}</p> : !loja ? <p className="px-4 pb-4 text-[13px] text-white/60">Abrindo a conversa…</p> : (
          <div className="bg-white px-3 pb-3 pt-2 text-[#1D2128]">
            <ChatLoja loja={loja} logado={!!usuario} linkEntrar={`/entrar?destino=${encodeURIComponent("/mundo")}`} alto={200} pessoa={{ membroId: lib.membroId, nome: lib.nome, cargo: lib.cargo, camisa: lib.camisa }} />
          </div>
        )}
      </div>
    </div>
  );
}
