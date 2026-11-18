"use client";
// Cartão do pedido na conversa com a atendente (17/11/2026): itens, total, QR Code e "Copiar Pix copia e cola" gerados
// com a chave do DONO da loja (o dinheiro vai direto para ele; o WorkEnd não recebe nada). O cartão consulta o status de
// tempos em tempos: aguardando → "Pagamento confirmado pela loja" → entregue (ou cancelado). Quem confirma é o dono.
// Usado em ui/ChatLoja.tsx (página da loja, cartão do mapa e recepção do prédio). Dados: src/server/pedidos.ts.
import { useEffect, useState } from "react";
import { Icone } from "./Icone";
import { QrCode } from "./QrCode";

export type Pedido = {
  id: string; numero: number; status: "aguardando" | "pago" | "entregue" | "cancelado"; tipo: string; empresa: string; lojaNumero: number | null;
  itens: { nome: string; qtd: number; precoCentavos: number }[]; subtotal: number; desconto: number; total: number; cupom: string | null;
  pix: string | null; temPix: boolean; recebedor: { nome: string; cidade: string } | null; contato: string; criadoEm: string; pagoEm: string | null; canceladoPor: string | null;
};
export const reaisBR = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const SELO_STATUS: Record<Pedido["status"], { t: string; cls: string }> = {
  aguardando: { t: "Aguardando pagamento", cls: "bg-[#FFF4DB] text-[#7A5A00]" },
  pago: { t: "Pagamento confirmado", cls: "bg-[#E3F6EA] text-[#166534]" },
  entregue: { t: "Entregue", cls: "bg-[#EEF3FF] text-[#1D4ED8]" },
  cancelado: { t: "Cancelado", cls: "bg-[#F1F3F6] text-[#5B6472]" },
};
const ABERTO = (s: Pedido["status"]) => s === "aguardando" || s === "pago";

export async function copiarTexto(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch { window.prompt("Copie o código:", t); return false; }
}

export function CartaoPedido({ inicial, compacto = false }: { inicial: Pedido; compacto?: boolean }) {
  const [p, setP] = useState(inicial);
  const [copiado, setCopiado] = useState(false);
  const [verQr, setVerQr] = useState(false); // só no modo compacto (no outro o QR fica sempre à mostra)
  const [cancelar, setCancelar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // acompanha o status (a cada 8 s com a aba à mostra) enquanto o pedido está em aberto
  useEffect(() => {
    if (!ABERTO(p.status)) return;
    let vivo = true;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/workend/pedidos/${encodeURIComponent(p.id)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j?.id) setP((x) => ({ ...x, ...(j as Pedido) })); }).catch(() => {});
    }, 8000);
    return () => { vivo = false; clearInterval(t); };
  }, [p.id, p.status]);
  const copiar = async () => { if (!p.pix) return; await copiarTexto(p.pix); setCopiado(true); setTimeout(() => setCopiado(false), 2200); };
  const confirmarCancelar = async () => {
    setErro(null);
    try {
      const r = await fetch(`/api/workend/pedidos/${encodeURIComponent(p.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "cancelar" }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.erro ?? "Não deu para cancelar.");
      setP((x) => ({ ...x, ...(j as Pedido) })); setCancelar(false);
    } catch (e) { setErro((e as Error).message); }
  };
  const selo = SELO_STATUS[p.status];
  const recebedor = p.recebedor?.nome || p.empresa || "a loja";
  return (
    <div className="max-w-[94%] rounded-2xl border border-black/10 bg-white p-3 text-[13px] text-[#1D2128] shadow-sm" data-pedido={p.id} aria-label={`Pedido número ${p.numero}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold"><Icone nome="recibo" tamanho={16} className="text-[#16A34A]" />Pedido #{p.numero}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${selo.cls}`} role="status">{selo.t}</span>
      </div>
      <ul className="mt-2 space-y-0.5">
        {p.itens.map((i, k) => <li key={k} className="flex justify-between gap-3"><span className="min-w-0">{i.qtd}× {i.nome}</span><span className="shrink-0 tabular-nums text-[#5B6472]">{reaisBR(i.precoCentavos * i.qtd)}</span></li>)}
      </ul>
      <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2">
        {p.desconto > 0 && <>
          <div className="flex justify-between text-[#5B6472]"><span>Subtotal</span><span className="tabular-nums">{reaisBR(p.subtotal)}</span></div>
          <div className="flex justify-between text-[#15803D]"><span>Cupom {p.cupom}</span><span className="tabular-nums">−{reaisBR(p.desconto)}</span></div>
        </>}
        <div className="flex justify-between text-[15px] font-bold"><span>Total</span><span className="tabular-nums">{reaisBR(p.total)}</span></div>
      </div>

      {p.status === "aguardando" && p.pix && (
        <div className={`mt-2.5 rounded-xl bg-[#F6F8FB] p-2.5 ${compacto ? "" : "sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-3"}`}>
          {/* na página da loja o QR fica ao lado do texto (computador); no cartão do mapa e na recepção, só se pedir */}
          {!compacto && <QrCode texto={p.pix} tamanho={168} titulo={`QR Code do Pix do pedido ${p.numero}`} className="mx-auto mb-2 shadow-sm sm:mb-0" />}
          <div className="min-w-0">
            <p className="text-[12.5px] leading-snug">Pague com Pix: o dinheiro vai <b>direto para {recebedor}</b>{p.recebedor?.cidade ? ` (${p.recebedor.cidade})` : ""}. O WorkEnd não recebe esse valor.</p>
            {compacto && (verQr ? <QrCode texto={p.pix} tamanho={148} titulo={`QR Code do Pix do pedido ${p.numero}`} className="mx-auto mt-2 shadow-sm" />
              : <button type="button" onClick={() => setVerQr(true)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1D4ED8] hover:underline">Mostrar o QR Code</button>)}
            <button type="button" onClick={() => void copiar()} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#15803d]">
              <Icone nome={copiado ? "check" : "copiar"} tamanho={16} />{copiado ? "Código copiado" : "Copiar Pix copia e cola"}
            </button>
            <p className="mt-1.5 text-[11.5px] text-[#5B6472]">No app do banco: Pix › Pix copia e cola (ou ler QR Code). Depois de pagar, a loja confirma aqui.</p>
          </div>
        </div>
      )}
      {p.status === "aguardando" && !p.pix && (
        <p className="mt-2.5 rounded-xl bg-[#FFF8E6] p-2.5 text-[12.5px] leading-snug text-[#5B4300]">A loja vai falar com você pelo <b>{p.contato}</b> para combinar o pagamento.</p>
      )}
      {p.status === "pago" && <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[#E3F6EA] p-2.5 text-[12.5px] font-semibold text-[#166534]"><Icone nome="check" tamanho={16} />Pagamento confirmado pela loja. Agora é com eles: o pedido está sendo preparado.</p>}
      {p.status === "entregue" && <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[#EEF3FF] p-2.5 text-[12.5px] font-semibold text-[#1D4ED8]"><Icone nome="check" tamanho={16} />Pedido entregue. Obrigado pela compra!</p>}
      {p.status === "cancelado" && <p className="mt-2.5 rounded-xl bg-[#F1F3F6] p-2.5 text-[12.5px] text-[#5B6472]">Pedido cancelado{p.canceladoPor === "cliente" ? " por você" : p.canceladoPor === "dono" ? " pela loja" : ""}.</p>}

      {p.status === "aguardando" && (cancelar
        ? <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]"><span className="font-semibold">Cancelar este pedido?</span><button type="button" onClick={() => void confirmarCancelar()} className="rounded-lg bg-[#E2575B] px-2.5 py-1 font-bold text-white">Cancelar mesmo</button><button type="button" onClick={() => setCancelar(false)} className="rounded-lg bg-[#F1F3F6] px-2.5 py-1 font-semibold">Não</button></div>
        : <button type="button" onClick={() => setCancelar(true)} className="mt-2 text-[12px] font-semibold text-[#9B1C1C] hover:underline">Cancelar pedido</button>)}
      {erro && <p className="mt-1 text-[12px] font-semibold text-[#B42318]">{erro}</p>}
    </div>
  );
}
