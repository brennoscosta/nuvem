"use client";
// Pedido do morador (20/11/2026, frente "visitante"): na ficha de conversa (ui/Morador.tsx), o morador que tem um pedido
// hoje entrega um bilhete ("a padaria abriu fornada nova, passa lá"), sempre para uma loja de verdade e aberta. Aceito, o
// bilhete fica com "Ir à loja"; cumprido (atendido na recepção dela), o morador agradece na próxima conversa e assina o
// passaporte. Até 2 por dia por pessoa. Sem IA: os textos são roteiro (data/passaporte.ts).
import { useEffect, useState } from "react";
import { usePersonagem } from "../personagemStore";
import { useMundo } from "../mundoStore";
import { useMoradores } from "../moradorStore";
import { usePassaporte } from "../passaporteStore";
import { entradasDaCidade } from "../data/entradas";
import type { Morador } from "../data/moradores";
import { Icone } from "./Icone";

type Loja = { nome: string; numero: number | null; chave: string };
type Estado = { estado: "oferta" | "aceito" | "feito" | "agradecido" | "recusado" | "obrigado" | "nada" | "sem-personagem" | "sem-conta"; texto?: string; loja?: Loja | string };

export function PedidoDoMorador({ m }: { m: Morador }) {
  const usuarioId = useMundo((s) => s.usuario?.id ?? null);
  const [e, setE] = useState<Estado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!usuarioId) return;
    let vivo = true;
    fetch(`/api/workend/passaporte/pedido?morador=${encodeURIComponent(m.id)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (vivo) setE(j as Estado); if ((j as Estado).estado === "obrigado") void usePassaporte.getState().carregar(); }).catch(() => {});
    return () => { vivo = false; };
  }, [m.id, usuarioId]);
  if (!e || !e.texto) return null;
  const loja = typeof e.loja === "object" ? e.loja : null;
  const responder = async (aceitar: boolean) => {
    setOcupado(true); setErro(null);
    try {
      const r = await fetch("/api/workend/passaporte/pedido", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ morador: m.id, aceitar }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
      setE((x) => (x ? { ...x, estado: j.estado } : x));
      void usePassaporte.getState().carregar();
    } catch (er) { setErro((er as Error).message); }
    setOcupado(false);
  };
  const irALoja = () => {
    if (!loja) return;
    const en = entradasDaCidade(useMundo.getState().terrenos).find((x) => x.chave === loja.chave);
    useMoradores.getState().fechar();
    if (en && usePersonagem.getState().ativo) usePersonagem.getState().entrarNoPredio(en); else useMundo.getState().selecionarLote(loja.chave);
  };
  if (e.estado === "obrigado") return (
    <div data-guia="pedido-morador" data-estado="obrigado" className="space-y-1.5">
      <div data-fala="obrigado" className="max-w-[88%] rounded-2xl rounded-tl-md bg-[#F1F3F6] px-3 py-2 text-[13px] text-[#1D2128]">{e.texto}</div>
      <div className="inline-flex items-center gap-1 rounded-full bg-[#E3F6EA] px-2 py-0.5 text-[11px] font-bold text-[#166534]"><Icone nome="passaporte" tamanho={12} />{m.curto} assinou o seu passaporte</div>
    </div>
  );
  if (e.estado === "recusado" || e.estado === "agradecido") return null;
  return (
    <div data-guia="pedido-morador" data-estado={e.estado} className="relative max-w-[92%] rotate-[-0.8deg] rounded-sm bg-[#FFF8D9] px-3 pb-2.5 pt-3 shadow-[0_2px_8px_rgba(30,42,68,.16)]">
      <span aria-hidden="true" className="absolute -top-1.5 left-6 h-3 w-3 rounded-full bg-[#C8102E] shadow" />
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5A00]">{e.estado === "oferta" ? `Um pedido de ${m.curto}` : e.estado === "feito" ? "Pedido cumprido" : "Pedido aceito"}</div>
      <p className="mt-0.5 font-serif text-[14px] italic leading-snug text-[#1E2A44]">{e.texto}</p>
      {e.estado === "oferta" ? (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={ocupado} onClick={() => void responder(true)} data-teste="aceitar-pedido" className="rounded-lg bg-[#1E2A44] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Aceitar pedido</button>
          <button type="button" disabled={ocupado} onClick={() => void responder(false)} className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#5B6472]">Agora não</button>
        </div>
      ) : e.estado === "aceito" ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-[#5B6472]">Fale com a recepção da {loja?.nome ?? "loja"}.</span>
          <button type="button" onClick={irALoja} className="shrink-0 rounded-lg bg-[#1E2A44] px-3 py-1.5 text-[12px] font-bold text-white">Ir à loja</button>
        </div>
      ) : null}
      {erro && <p className="mt-1 text-[12px] font-semibold text-[#B42318]">{erro}</p>}
    </div>
  );
}
