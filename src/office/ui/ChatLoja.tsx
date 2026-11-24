"use client";
// A loja vista por quem chega (11/11/2026): resumo (nicho, sobre, contatos, nota) e a conversa com a atendente de IA,
// que responde só sobre a empresa e anota o contato para o dono. Usado no cartão do lote no mapa e na página /loja/N.
// 17/11/2026: quando a atendente faz um pedido, o cartão do pedido (ui/CartaoPedido.tsx) aparece logo abaixo da resposta.
// WE-14 (21/11/2026): conversa também sem conta (cookie de visitante sem conta, src/server/visitanteAnonimo.ts), com o
// botão do WhatsApp da loja no topo; o convite para entrar fica numa linha pequena embaixo, sem barrar a conversa.
// A página da loja (/loja/N, e o endereço por nome que vier depois) usa este mesmo componente.
import { useEffect, useRef, useState } from "react";
import { avisarClique, type TipoClique } from "./LinkRastreado";
import { Icone } from "./Icone";
import { EstrelaMedia } from "./NotaEstrelas";
import { CartaoPedido, type Pedido } from "./CartaoPedido";
import { usePassaporte, type Atendimento } from "../passaporteStore";

export type LojaInfo = {
  numero: number; chave: string; nome: string; cor: string; nicho: string; logo: string | null; donoId: string; sobre: string;
  contatos: { whatsapp?: string; instagram?: string; site?: string; email?: string };
  atendente: { nome: string; cargo: string; camisa: string; saudacao: string } | null;
  equipe: { nome: string; cargo: string; papel: string; foto: string | null }[];
  avaliacao: { media: number | null; n: number };
};
type Msg = { id: string; papel: string; conteudo: string; em: string; pedido?: Pedido | null };

export function useLoja(numero: number | null) {
  // guardado com o número da loja: trocar de loja mostra "abrindo" sem limpar o estado no efeito
  const [estado, setEstado] = useState<{ numero: number; loja: LojaInfo | null; erro: string | null } | null>(null);
  useEffect(() => {
    if (numero === null) return; // 0 seria uma sede (número próprio)
    let vivo = true;
    fetch(`/api/workend/loja/${numero}`, { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!vivo) return; setEstado(r.ok ? { numero, loja: j as LojaInfo, erro: null } : { numero, loja: null, erro: (j as { erro?: string }).erro ?? "Loja fechada." }); }).catch(() => vivo && setEstado({ numero, loja: null, erro: "Sem conexão." }));
    return () => { vivo = false; };
  }, [numero]);
  const meu = estado && estado.numero === numero ? estado : null;
  return { loja: meu?.loja ?? null, erro: meu?.erro ?? null };
}

export const linkZap = (n: string) => `https://wa.me/${n.length <= 11 ? `55${n}` : n}`;
export function Contatos({ c, claro = false, numero }: { c: LojaInfo["contatos"]; claro?: boolean; numero?: number }) {
  const itens = [
    c.whatsapp && { href: linkZap(c.whatsapp), t: "WhatsApp", tipo: "whatsapp" },
    c.instagram && { href: `https://instagram.com/${c.instagram}`, t: `@${c.instagram}`, tipo: "instagram" },
    c.site && { href: c.site, t: c.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), tipo: "site" },
    c.email && { href: `mailto:${c.email}`, t: c.email, tipo: "email" },
  ].filter(Boolean) as { href: string; t: string; tipo: TipoClique }[];
  if (!itens.length) return null;
  return <div className="flex flex-wrap gap-1.5">{itens.map((i) => <a key={i.href} href={i.href} target="_blank" rel="noreferrer nofollow" onClick={() => { if (numero) avisarClique(numero, i.tipo); }} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${claro ? "bg-white/15 text-white" : "bg-[#EEF3FF] text-[#1D4ED8]"} hover:underline`}>{i.t}</a>)}</div>;
}

export function Estrelas({ media, n }: { media: number | null; n: number }) {
  if (!n || media == null) return <span className="text-[12px] text-[#5B6472]">Sem avaliações ainda</span>;
  return <span className="text-[12px] font-semibold text-[#7A5A00]"><EstrelaMedia />{media.toFixed(1).replace(".", ",")} <span className="font-normal text-[#5B6472]">({n} {n === 1 ? "avaliação" : "avaliações"})</span></span>;
}

// pessoa (20/11/2026, recepção que encaminha): a conversa é com o responsável de um setor (ui/Recepcao.tsx › NoSetor), não
// com a atendente; a saudação dele já vem gravada na conversa, com o que o visitante disse na recepção
export type PessoaSetor = { membroId: string; nome: string; cargo: string; camisa: string };
export function ChatLoja({ loja, logado, linkEntrar, alto = 320, pessoa = null }: { loja: LojaInfo; logado: boolean; linkEntrar: string; alto?: number; pessoa?: PessoaSetor | null }) {
  const chave = pessoa ? `${loja.numero}:${pessoa.membroId}` : String(loja.numero);
  const [conv, setConv] = useState<{ chave: string; msgs: Msg[] } | null>(null);
  const msgs = conv?.chave === chave ? conv.msgs : null;
  const setMsgs = (f: (m: Msg[] | null) => Msg[]) => setConv((c) => ({ chave, msgs: f(c?.chave === chave ? c.msgs : null) }));
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const at = pessoa ? { nome: pessoa.nome, cargo: pessoa.cargo, camisa: pessoa.camisa, saudacao: "" } : loja.atendente;
  const membroId = pessoa?.membroId ?? null;
  useEffect(() => {
    let vivo = true; const numero = loja.numero, k = chave;
    fetch(`/api/workend/loja/${numero}/conversa${membroId ? `?membro=${encodeURIComponent(membroId)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).then((j) => vivo && setConv({ chave: k, msgs: Array.isArray(j) ? j : [] })).catch(() => vivo && setConv({ chave: k, msgs: [] }));
    return () => { vivo = false; };
  }, [loja.numero, logado, chave, membroId]);
  useEffect(() => { const el = fim.current?.parentElement; if (el) el.scrollTop = el.scrollHeight; }, [msgs, enviando]);
  if (!at) return null;
  const enviar = async () => {
    const t = texto.trim(); if (!t || enviando) return;
    setEnviando(true); setErro(null); setTexto("");
    setMsgs((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, papel: "user", conteudo: t, em: new Date().toISOString() }]);
    try {
      const r = await fetch(`/api/workend/loja/${loja.numero}/conversa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: t, ...(membroId ? { membroId } : {}) }) });
      const j = await r.json();
      if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "Não deu para enviar.");
      setMsgs((m) => [...(m ?? []), j as Msg]);
      if ((j as { passaporte?: Atendimento }).passaporte) usePassaporte.getState().aoAtendimento((j as { passaporte: Atendimento }).passaporte, loja.numero, loja.atendente?.nome ?? null);
    } catch (e) { setErro((e as Error).message); }
    setEnviando(false);
  };
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: at.camisa }}>{at.nome.slice(0, 1)}</span>
        <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-bold text-[#1D2128]">{at.nome}</div><div className="flex items-center gap-1 text-[12px] text-[#15803D]"><span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#16A34A]" /><span className="truncate">{at.cargo} · responde na hora</span></div></div>
        {loja.contatos.whatsapp && <a href={linkZap(loja.contatos.whatsapp)} target="_blank" rel="noreferrer nofollow" onClick={() => avisarClique(loja.numero, "whatsapp")} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E8F8EE] px-2.5 py-1 text-[12px] font-bold text-[#15803D] hover:bg-[#d5f3e0]"><Icone nome="telefone" tamanho={13} />WhatsApp</a>}
      </div>
      {/* com pedido na conversa (página da loja), a área cresce para o cartão caber inteiro */}
      <div className="space-y-2 overflow-y-auto p-3" style={{ maxHeight: alto >= 300 && msgs?.some((m) => m.pedido) ? Math.max(alto, 500) : alto, minHeight: Math.min(alto, 160) }}>
        {at.saudacao && <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-[#F1F3F6] px-3 py-2 text-[13px] text-[#1D2128]">{at.saudacao}</div>}
        {pessoa && msgs === null && <div className="text-[12px] text-[#5B6472]">Abrindo a conversa…</div>}
        {msgs?.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${m.papel === "user" ? "ml-auto rounded-br-md bg-[#1D4ED8] text-white" : "rounded-tl-md bg-[#F1F3F6] text-[#1D2128]"}`}>{m.conteudo}</div>
            {m.papel === "assistant" && m.pedido && <CartaoPedido inicial={m.pedido} compacto={alto < 300} />}
          </div>
        ))}
        {enviando && <div className="text-[12px] text-[#5B6472]">{at.nome} está digitando…</div>}
        <div ref={fim} />
      </div>
      {erro && <div className="px-3 pb-1 text-[12px] font-semibold text-[#E2575B]">{erro}</div>}
      <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex gap-1.5 border-t border-black/5 p-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 800))} placeholder={`Escreva para ${at.nome}…`} aria-label={`Mensagem para ${at.nome}`} className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-base text-[#1D2128] outline-none focus:border-[#1D4ED8] sm:text-sm" />
        <button type="submit" disabled={!texto.trim() || enviando} className="rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enviar</button>
      </form>
      {/* sem conta: conversa normal; o convite fica aqui, pequeno (passaporte e carimbo precisam de conta) */}
      {!logado && <p className="border-t border-black/5 px-3 py-1.5 text-[11.5px] leading-snug text-[#5B6472]">Conversando sem conta. <a href={linkEntrar} className="font-semibold text-[#1D4ED8] hover:underline">Entre ou crie a sua conta grátis</a> para ganhar carimbos no passaporte, cupons e missões.</p>}
    </div>
  );
}
