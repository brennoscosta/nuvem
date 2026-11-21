"use client";
// Depois de ser atendido na recepção (20/11/2026, frente "visitante"): o carimbo bate no passaporte, o marco mostra a
// peça exclusiva que chegou (com "Usar agora"), o pedido do morador aparece como cumprido e a recepcionista oferece o
// cupom do passaporte da loja, se o dono escolheu um ("Pegar cupom" gera o código pessoal, como os outros cupons).
// Os dados vêm da resposta da recepção (rotas loja/[numero]/recepcao e /conversa › passaporte). Fica até fechar.
import { useState } from "react";
import { usePassaporte, usarItem } from "../passaporteStore";
import { Carimbo, ESTILO_CARIMBO } from "./Carimbo";
import { Icone } from "./Icone";


const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AvisoPassaporte() {
  const aviso = usePassaporte((s) => s.aviso);
  if (!aviso) return null;
  return <Aviso key={aviso.n} />;
}

function Aviso() {
  const a = usePassaporte((s) => s.aviso)!;
  const fechar = usePassaporte((s) => s.fecharAviso);
  const abrirPassaporte = usePassaporte((s) => s.abrir);
  const [cupom, setCupom] = useState<{ codigo: string } | null>(a.cupom?.meu ? { codigo: a.cupom.meu } : null);
  const [pegando, setPegando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usado, setUsado] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const c = a.carimbo;
  const pegar = async () => {
    setPegando(true); setErro(null);
    try {
      const r = await fetch("/api/workend/passaporte/cupom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loja: a.numero }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
      setCupom({ codigo: j.codigo });
    } catch (e) { setErro((e as Error).message); }
    setPegando(false);
  };
  const usar = async (item: string) => { setUsado((u) => ({ ...u, [item]: "…" })); const e = await usarItem(item); setUsado((u) => ({ ...u, [item]: e ?? "ok" })); };
  const copiar = async () => { if (!cupom) return; try { await navigator.clipboard.writeText(cupom.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem área de transferência */ } };
  const quem = a.atendente ? a.atendente.split(" ")[0] : "A recepcionista";
  return (
    <div role="status" aria-live="polite" data-guia="aviso-passaporte" className="pointer-events-auto absolute inset-x-2 top-[7.2rem] z-30 mx-auto max-w-[380px] sm:top-[7rem]">
      <style>{ESTILO_CARIMBO}</style>
      <div className="painel-entra overflow-hidden rounded-2xl text-[#1E2A44] shadow-2xl ring-1 ring-black/10" style={{ background: "#F5F0E4" }}>
        <div className="flex items-start gap-3 p-3">
          {c && <div className="-my-1 shrink-0" style={{ mixBlendMode: "multiply" }}><Carimbo chave={c.chave} nome={c.nome} cor={c.cor} em={c.em} logo={c.logo} tamanho={84} bater={!!c.novo} /></div>}
          <div className="min-w-0 flex-1">
            {c?.novo ? (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E2A44]/60">Carimbo novo no passaporte</div>
                <div className="truncate font-serif text-[16px] font-bold" data-teste="aviso-carimbo">{c.nome}</div>
                <div className="text-[12px] text-[#1E2A44]/75">{a.total} {a.total === 1 ? "lugar carimbado" : "lugares carimbados"}{a.proximo ? ` · falta${a.proximo.falta > 1 ? "m" : ""} ${a.proximo.falta} para o visto ${a.proximo.insignia}` : ""}</div>
                {a.proximo && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#1E2A44]/10"><i className="block h-full rounded-full bg-[#1E2A44]" style={{ width: `${Math.min(100, (a.total / a.proximo.n) * 100)}%` }} /></div>}
              </>
            ) : c ? (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E2A44]/60">Passaporte</div>
                <div className="truncate font-serif text-[16px] font-bold">{c.nome}</div>
                <div className="text-[12px] text-[#1E2A44]/75">{a.limiteDoDia ? "Hoje você já ganhou muitos carimbos: este fica para amanhã." : "Este lugar já está carimbado."}</div>
              </>
            ) : null}
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar o aviso" className="shrink-0 rounded-full p-1 text-[#1E2A44]/60 hover:bg-black/5"><Icone nome="fechar" tamanho={16} /></button>
        </div>
        {a.marcos.map((m) => (
          <div key={m.id} data-teste="aviso-marco" className="mx-3 mb-2 rounded-xl bg-[#1E2A44] px-3 py-2.5 text-white">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#D7B25A]">Visto concedido: {m.insignia}</div>
            <div className="mt-0.5 text-[13.5px] font-semibold">{m.itemNome ? `Você ganhou: ${m.itemNome}. Só tem quem chega aqui.` : "Insígnia nova no seu perfil."}</div>
            {m.bonus > 0 && <div className="text-[12px] text-white/75">E {reais(m.bonus)} em créditos de bônus na sua carteira.</div>}
            {m.item && <button type="button" onClick={() => void usar(m.item!)} disabled={!!usado[m.item]} className="mt-1.5 rounded-full bg-[#D7B25A] px-3 py-1 text-[12px] font-bold text-[#1A1306] disabled:opacity-70">{usado[m.item] === "ok" ? "Usando" : usado[m.item] === "…" ? "…" : "Usar agora"}</button>}
            {usado[m.item ?? ""] && usado[m.item ?? ""] !== "ok" && usado[m.item ?? ""] !== "…" && <p className="mt-1 text-[11px] text-[#FCA5A5]">{usado[m.item ?? ""]}</p>}
          </div>
        ))}
        {a.pedidos.map((p) => (
          <div key={p.moradorId} data-teste="aviso-pedido" className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-[#FFF8D9] px-3 py-2 text-[13px] ring-1 ring-[#E9C46A]/50">
            <Icone nome="check" tamanho={16} className="shrink-0 text-[#166534]" /><span className="min-w-0">Pedido de {p.morador} cumprido. Conte para {p.morador.split(" ").pop()} da próxima vez que passar.</span>
          </div>
        ))}
        {a.cupom && (
          <div data-guia="cupom-passaporte" data-teste="aviso-cupom" className="mx-3 mb-3 rounded-xl border border-dashed border-[#E11D48]/50 bg-[#FFF5F7] px-3 py-2.5">
            <p className="text-[13px] leading-snug"><b>{quem}:</b> {`como você tem o passaporte da cidade, ${c?.nome ?? "a loja"} te dá um presente:`}</p>
            <div className="mt-1 text-[16px] font-black leading-tight text-[#9F1239]">{a.cupom.titulo}</div>
            <div className="text-[12px] text-[#5B6472]">{[a.cupom.desconto, a.cupom.regra, `até ${a.cupom.validade.split("-").reverse().slice(0, 2).join("/")}`].filter(Boolean).join(" · ")}</div>
            {cupom ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                <span className="text-[12px] text-[#5B6472]">Seu código: <b className="font-mono text-[16px] tracking-wider text-[#1D2128]" data-teste="codigo-cupom">{cupom.codigo}</b></span>
                <button type="button" onClick={() => void copiar()} className="text-[12px] font-semibold text-[#1D4ED8]">{copiado ? "Copiado" : "Copiar"}</button>
              </div>
            ) : (
              <div className="mt-1.5 flex gap-2">
                <button type="button" onClick={() => void pegar()} disabled={pegando} data-teste="pegar-cupom-passaporte" className="rounded-lg bg-[#E11D48] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">{pegando ? "…" : "Pegar cupom"}</button>
                <button type="button" onClick={fechar} className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[#5B6472]">Agora não</button>
              </div>
            )}
            {erro && <p className="mt-1 text-[12px] font-semibold text-[#B42318]">{erro}</p>}
            {cupom && <p className="mt-1 text-[11px] text-[#5B6472]">Mostre o código na compra ou use no pedido pela conversa. Ele fica em Meus cupons.</p>}
          </div>
        )}
        <button type="button" onClick={() => { fechar(); abrirPassaporte(); }} className="flex w-full items-center justify-center gap-1.5 border-t border-[#1E2A44]/10 py-2 text-[12.5px] font-bold text-[#1E2A44] hover:bg-black/[.03]"><Icone nome="passaporte" tamanho={15} />Abrir o passaporte</button>
      </div>
    </div>
  );
}
