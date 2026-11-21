"use client";
// Ficha e conversa com um morador da cidade (19/11/2026). Mesmo visual das fichas e do chat da loja: cabeçalho com o
// retrato, o que ele está fazendo agora (pela rotina da hora da cidade), o jeito de tratar (desconfiado, conhecido,
// simpático, amigo) e a conversa. Botões de escolha (Cumprimentar, Perguntar da cidade, Pedir indicação…) e um campo de
// texto livre: com IA o morador responde livre; sem IA, pelo roteiro (src/server/moradores.ts), sempre com memória.
// Conversar exige estar logado (igual à loja); sem login ele só cumprimenta e convida a entrar na conta.
import { useEffect, useRef, useState } from "react";
import { useMoradores, segundosCidade } from "../moradorStore";
import { useMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";
import { useSede } from "../sedeStore";
import { MORADOR_POR_ID, ACOES_MORADOR, NOME_TOM, estadoMorador, novoEstado, type Morador as DadosMorador, type Tom, type RelacaoCurta } from "../data/moradores";
import { FLUTUANTE, LARGO } from "./estilo";
import { Icone } from "./Icone";
import { MiniAvatar } from "./MiniAvatar";
import { PedidoDoMorador } from "./PedidoMorador";

type Indicacao = { numero: number; chave: string; nome: string; nichoNome: string; sobre: string };
type Msg = { id: string; autor: "visitante" | "morador"; texto: string; em: string; indicacao: Indicacao | null };
type Relacao = RelacaoCurta & { tom: Tom; recusa: boolean };
type Ficha = { id: string; logado: boolean; abertura: string; relacao: Relacao | null; historico: Msg[] };

const COR_TOM: Record<Tom, string> = { desconfiado: "bg-[#FDECEC] text-[#B42318]", neutro: "bg-[#F1F3F6] text-[#3A414C]", simpatico: "bg-[#EEF3FF] text-[#1D4ED8]", amigo: "bg-[#E3F6EA] text-[#166534]" };
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const emLista = (l: string[]) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`);
const fazendoAgora = (m: DadosMorador) => estadoMorador(m, segundosCidade(), novoEstado()).fazendo;

export function FichaMorador() {
  const id = useMoradores((s) => s.aberto);
  if (!id || !MORADOR_POR_ID[id]) return null;
  return <Conversa key={id} m={MORADOR_POR_ID[id]} />;
}

function Conversa({ m }: { m: DadosMorador }) {
  const fechar = useMoradores((s) => s.fechar);
  const usuarioId = useMundo((s) => s.usuario?.id ?? null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [fazendo, setFazendo] = useState(() => fazendoAgora(m));
  const nova = useRef(true); // a primeira mensagem depois de abrir a ficha começa uma conversa nova
  const fim = useRef<HTMLDivElement>(null);
  const seq = useRef(0); // id provisório da mensagem enquanto o servidor responde
  useEffect(() => { const t = setInterval(() => setFazendo(fazendoAgora(m)), 2000); return () => clearInterval(t); }, [m]);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/workend/moradores/${m.id}?seg=${Math.floor(segundosCidade())}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (vivo && j && typeof j.abertura === "string") setFicha(j as Ficha); }).catch(() => {});
    return () => { vivo = false; };
  }, [m.id, usuarioId]);
  // outro painel abriu por cima (cartão de lote, ficha de personagem): esta fecha
  const loteAberto = useMundo((s) => !!s.loteSelecionado || !!s.outdoorSelecionado || s.painelEmpresa || s.painelEscritorio);
  const sedeAberta = useSede((s) => s.aberto);
  const painelAberto = usePersonagem((s) => s.painel !== null);
  useEffect(() => { if (loteAberto || painelAberto || sedeAberta) fechar(); }, [loteAberto, painelAberto, sedeAberta, fechar]);
  useEffect(() => { const el = fim.current?.parentElement; if (el) el.scrollTop = el.scrollHeight; }, [msgs, enviando, ficha]);

  const rel = ficha?.relacao ?? null;
  const logado = ficha ? ficha.logado : !!usuarioId;
  const enviar = async (c: { acao?: string; texto?: string }) => {
    if (enviando) return;
    const fala = c.acao ? ACOES_MORADOR.find((a) => a.id === c.acao)?.fala ?? "" : (c.texto ?? "").trim();
    if (!fala) return;
    const tmp = `tmp-${++seq.current}`;
    setEnviando(true); setErro(null); if (!c.acao) setTexto("");
    setMsgs((x) => [...x, { id: tmp, autor: "visitante", texto: fala, em: "", indicacao: null }]);
    try {
      const r = await fetch(`/api/workend/moradores/${m.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...c, nova: nova.current, seg: Math.floor(segundosCidade()) }) });
      const j = await r.json();
      if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "Não deu para enviar.");
      nova.current = false;
      const d = j as { mensagens: Msg[]; relacao: Relacao };
      setMsgs((x) => [...x.filter((y) => y.id !== tmp), ...d.mensagens]);
      setFicha((f) => (f ? { ...f, relacao: d.relacao } : f));
      useMoradores.getState().guardarRelacao({ id: m.id, chamar: d.relacao.chamar, afinidade: d.relacao.afinidade, plano: d.relacao.plano, conversas: d.relacao.conversas });
    } catch (e) {
      setMsgs((x) => x.filter((y) => y.id !== tmp)); if (!c.acao) setTexto(fala);
      setErro((e as Error).message);
    }
    setEnviando(false);
  };
  const acoes = rel?.recusa ? ACOES_MORADOR.filter((a) => a.id === "desculpa") : ACOES_MORADOR.filter((a) => a.id !== "desculpa" || (rel && rel.afinidade < 0));

  return (
    <div role="dialog" aria-label={`Conversa com ${m.nome}`} className={`${FLUTUANTE} ${LARGO} painel-entra flex flex-col overflow-hidden`}>
      <div className="flex items-start gap-3 border-b border-black/5 p-3">
        <MiniAvatar boneco={m.boneco} roupa={m.roupa} tamanho={44} acessorios={m.acessorios} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold">{m.nome}</span>
            {rel && <span data-tom={rel.tom} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${COR_TOM[rel.tom]}`}>{NOME_TOM[rel.tom]}</span>}
          </div>
          <div className="text-[12px] text-[#5B6472]">{cap(m.profissao)} · {m.idade} anos</div>
          <div className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#7A5A00]"><Icone nome="relogio" tamanho={12} /><span>Agora: {fazendo}</span></div>
        </div>
        <button onClick={fechar} className="rounded-full p-1 text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button>
      </div>
      <button onClick={() => setSobre((v) => !v)} aria-expanded={sobre} className="flex items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold text-[#3A414C] hover:bg-black/[.03]">
        <span>Quem é {m.nome}</span><Icone nome={sobre ? "recolher" : "expandir"} tamanho={12} />
      </button>
      {sobre && (
        <p className="px-3 pb-2 text-[12px] leading-snug text-[#3A414C]">
          {cap(m.personalidade)}. {cap(m.jeito)}. Gosta de {emLista(m.gostos)}. Mora {m.bairro.startsWith("perto") ? m.bairro : `no bairro ${m.bairro}`}.
          {rel && rel.conversas > 0 ? ` Vocês já conversaram ${rel.conversas} ${rel.conversas === 1 ? "vez" : "vezes"}.` : ""}
        </p>
      )}
      <div className="min-h-[150px] flex-1 space-y-2 overflow-y-auto border-t border-black/5 p-3" style={{ maxHeight: "min(42dvh, 360px)" }} aria-live="polite">
        {ficha && ficha.historico.length > 0 && (
          <>
            <div className="text-center text-[10px] font-bold uppercase tracking-wide text-[#9AA3AD]">Última conversa</div>
            {ficha.historico.map((h) => <Bolha key={h.id} msg={h} antiga />)}
            <div className="text-center text-[10px] font-bold uppercase tracking-wide text-[#9AA3AD]">Agora</div>
          </>
        )}
        {ficha ? <Bolha msg={{ id: "abertura", autor: "morador", texto: ficha.abertura, em: "", indicacao: null }} abertura /> : <div className="text-[12px] text-[#5B6472]">{m.nome} está olhando para você…</div>}
        {ficha?.logado && <PedidoDoMorador m={m} />}
        {msgs.map((x) => <Bolha key={x.id} msg={x} />)}
        {enviando && <div className="text-[12px] text-[#5B6472]">{m.curto} está respondendo…</div>}
        <div ref={fim} />
      </div>
      {erro && <div className="px-3 pb-1 text-[12px] font-semibold text-[#E2575B]">{erro}</div>}
      {logado ? (
        <div className="border-t border-black/5">
          {rel?.recusa && <div className="px-3 pt-2 text-[11px] font-semibold text-[#B42318]">{m.nome} não quer conversar agora. Um pedido de desculpas pode ajudar.</div>}
          <div className="flex gap-1.5 overflow-x-auto px-2 pb-1 pt-2 [scrollbar-width:none] sm:flex-wrap">
            {acoes.map((a) => (
              <button key={a.id} type="button" disabled={enviando} onClick={() => void enviar({ acao: a.id })} className="shrink-0 rounded-full bg-[#EEF3FF] px-2.5 py-1.5 text-[12px] font-semibold text-[#1D4ED8] disabled:opacity-50">{a.rotulo}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void enviar({ texto }); }} className="flex gap-1.5 p-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 400))} placeholder={`Escreva para ${m.curto}…`} aria-label={`Mensagem para ${m.nome}`} className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-base text-[#1D2128] outline-none focus:border-[#1D4ED8] sm:text-sm" />
            <button type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar" className="grid place-items-center rounded-xl bg-[#1D4ED8] px-3 py-2 text-white disabled:opacity-50"><Icone nome="enviar" tamanho={16} /></button>
          </form>
        </div>
      ) : (
        <a href={`/entrar?destino=${encodeURIComponent("/mundo")}`} className="m-2 block rounded-xl bg-[#1D4ED8] px-3 py-2 text-center text-sm font-bold text-white">Entrar para conversar (é grátis)</a>
      )}
    </div>
  );
}

function Bolha({ msg, antiga = false, abertura = false }: { msg: Msg; antiga?: boolean; abertura?: boolean }) {
  const minha = msg.autor === "visitante";
  return (
    <div className={`space-y-1.5 ${antiga ? "opacity-60" : ""}`}>
      <div data-fala={abertura ? "abertura" : msg.autor} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${minha ? "ml-auto rounded-br-md bg-[#1D4ED8] text-white" : "rounded-tl-md bg-[#F1F3F6] text-[#1D2128]"}`}>{msg.texto}</div>
      {msg.indicacao && !antiga && <CartaoIndicacao ind={msg.indicacao} />}
    </div>
  );
}

function CartaoIndicacao({ ind }: { ind: Indicacao }) {
  const ver = () => { useMoradores.getState().fechar(); useMundo.getState().selecionarLote(ind.chave); };
  return (
    <div className="max-w-[88%] rounded-2xl border border-black/10 bg-white p-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#1D2128]"><Icone nome="predios" tamanho={14} />{ind.nome}</div>
      <div className="text-[11px] text-[#5B6472]">{ind.nichoNome}{ind.numero > 0 ? ` · loja ${ind.numero}` : ""}</div>
      {ind.sobre && <p className="mt-1 text-[12px] leading-snug text-[#3A414C]">{ind.sobre}</p>}
      <button type="button" onClick={ver} className="mt-1.5 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-[12px] font-bold text-white">Ver no mapa</button>
    </div>
  );
}
