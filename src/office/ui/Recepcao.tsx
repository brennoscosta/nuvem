"use client";
// Recepção dos prédios (17/11/2026, pedido do dono: "preciso que possa entrar, e que apareça uma porta ou se direcione para
// a recepção onde será atendido. Por ser o dono eles irão reconhecer, mas se for um visitante precisará ser recepcionado e
// aguardar até ser atendido"):
//  - perto de uma porta aparece "Entrar em …" (e o mesmo botão nos cartões da loja e da sede);
//  - a caminho e entrando: um aviso pequeno com "Cancelar";
//  - no balcão: o DONO é reconhecido na hora (atalhos para a equipe); o VISITANTE espera a vez (fila com quem já está no
//    balcão) e depois é atendido pela atendente de IA da empresa (a mesma conversa do cartão da loja, ui/ChatLoja.tsx);
//  - "Sair do prédio" leva de volta à calçada.
// O caminho e as fases ficam no personagemStore (entrarNoPredio / sairDoPredio) e em scene/Personagens.tsx.
import { useEffect, useMemo, useState } from "react";
import { usePersonagem, minhaPos } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { entradasDaCidade, type Entrada } from "../data/entradas";
import { abrirChatEquipe, useChatEquipe } from "./ChatEquipe";
import { ChatLoja, useLoja } from "./ChatLoja";
import { Icone } from "./Icone";
import { sedeDoParametro } from "../data/sedes";

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

export function Recepcao() {
  useEntrarPeloLink();
  const predio = usePersonagem((s) => s.predio);
  const chatAberto = useChatEquipe((s) => s.aberto);
  if (!predio) return <PertoDaPorta />;
  if (predio.fase !== "recepcao" || chatAberto) {
    const t = predio.fase === "indo" ? `A caminho de ${predio.nome}…` : predio.fase === "entrando" ? `Entrando em ${predio.nome}…` : predio.fase === "saindo" ? `Saindo de ${predio.nome}…` : predio.fase === "dentro" ? `Dentro de ${predio.nome}` : `Na recepção de ${predio.nome}`;
    return (
      <>
        <AvisoPredio />
        <div className={`${CAIXA} flex justify-center`}>
          <div className="hud-ilha inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-semibold text-white shadow-xl">
            <span className="min-w-0 truncate">{t}</span>
            {/* andando por dentro (data/plantaInterna.ts): toque no chão para ir a outro lugar; voltar ao balcão ou sair */}
            {predio.fase === "dentro" && <button type="button" onClick={() => usePersonagem.getState().voltarRecepcao()} className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/20">Ir à recepção</button>}
            {predio.fase !== "saindo" && <button type="button" onClick={() => usePersonagem.getState().sairDoPredio()} className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/20">{predio.fase === "indo" ? "Cancelar" : "Sair do prédio"}</button>}
          </div>
        </div>
      </>
    );
  }
  return <><AvisoPredio /><Balcao key={predio.visita} /></>;
}

// aviso curto por cima ("Área só da equipe", "Não dá para chegar aí por dentro"), some sozinho
function AvisoPredio() {
  const aviso = usePersonagem((s) => s.avisoPredio);
  const [visto, setVisto] = useState(0);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setVisto(aviso.n), 2600);
    return () => clearTimeout(t);
  }, [aviso]);
  if (!aviso || visto === aviso.n) return null;
  return (
    <div className="pointer-events-none absolute inset-x-2 top-24 z-30 flex justify-center" role="status">
      <span className="hud-ilha inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl"><Icone nome="chave" tamanho={15} />{aviso.texto}</span>
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
  // visitante: espera a vez; quando chega, a atendente cumprimenta e a conversa abre
  const [atendido, setAtendido] = useState(dono);
  useEffect(() => {
    if (dono) return;
    const t = setTimeout(() => {
      setAtendido(true);
      usePersonagem.setState({ falaRecepcao: { chave: predio.chave, texto: atendente?.treino?.saudacao || `Olá! Sou ${nomeAt}, da recepção de ${predio.nome}. Em que posso ajudar?` } });
    }, predio.esperaMs);
    return () => clearTimeout(t);
  }, [dono, predio.esperaMs, predio.chave, predio.nome, atendente?.treino?.saudacao, nomeAt]);
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
        ) : (
          <AtendimentoVisitante numero={predio.numero ?? 0} logado={!!usuario} />
        )}
      </div>
    </div>
  );
}

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
