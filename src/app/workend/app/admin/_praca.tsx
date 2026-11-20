"use client";
// Admin: fila dos anúncios da praça (20/11/2026). Anúncio pago (telão, evento em destaque, patrocínio) só entra na grade
// depois de aprovado aqui; recusar pede o motivo (o dono vê no sino) e deixa registrado que o Pix precisa ser devolvido.
import { useCallback, useEffect, useRef, useState } from "react";
import { NOME_TIPO, type TipoAnuncio } from "@/office/data/telao";
import { desenharAnuncio, desenharEventoDestaque, desenharPatrocinio, imagemPronta } from "@/office/telaoDesenho";

interface Item { id: string; tipo: TipoAnuncio; formato: string; frase: string; inicio: string; dias: number; valor: string; status: string; motivo: string; pagoEm: string | null; decididoEm: string | null; email: string; empresaNome: string | null; cor: string | null; temLogo: boolean | null; terrenoChave: string | null; eventoTitulo: string | null; eventoInicio: string | null }
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dm = (iso: string) => { const [, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}`; };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

function Previa({ a }: { a: Item }) {
  const c = useRef<HTMLCanvasElement>(null);
  const logo = a.temLogo && a.terrenoChave ? `/api/terrenos/${encodeURIComponent(a.terrenoChave)}/logo` : null;
  const midia = a.formato !== "modelo" ? `/api/workend/telao/${a.id}/midia` : null;
  useEffect(() => {
    const el = c.current; if (!el) return; const g = el.getContext("2d")!;
    const nome = a.empresaNome ?? "Empresa", cor = a.cor ?? "#1D4ED8";
    const pintar = () => {
      const lg = imagemPronta(logo, pintar);
      if (a.tipo === "patrocinio") desenharPatrocinio(g, el.width, el.height, { id: a.id, nome, cor, logo, numero: null, chave: null, frase: a.frase, ate: "" }, lg, false);
      else if (a.tipo === "destaque") desenharEventoDestaque(g, el.width, el.height, { titulo: a.eventoTitulo ?? "Evento", nome, cor, frase: a.frase, inicio: a.eventoInicio ?? new Date().toISOString(), fim: a.eventoInicio ?? new Date().toISOString() }, lg, 0);
      else desenharAnuncio(g, el.width, el.height, { nome, cor, frase: a.frase, numero: null, formato: a.formato === "imagem" ? "imagem" : "modelo" }, lg, a.formato === "imagem" ? imagemPronta(midia, pintar) : null);
    };
    pintar();
  }, [a, logo, midia]);
  if (a.formato === "video" && midia) return <video src={midia} muted loop autoPlay playsInline controls className="aspect-video w-full rounded-lg bg-black" />;
  return <canvas ref={c} width={1024} height={576} className="aspect-video w-full rounded-lg" />;
}

export function AnunciosPracaAdmin() {
  const [fila, setFila] = useState<Item[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await fetch("/api/admin/praca", { cache: "no-store" }); if (r.ok) setFila((await r.json()).fila); }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); const i = setInterval(carregar, 30000); return () => { clearTimeout(t); clearInterval(i); }; }, [carregar]);
  const decidir = async (a: Item, acao: "aprovar" | "recusar") => {
    let motivo = "";
    if (acao === "recusar") { const m = window.prompt("Motivo da recusa (o dono vai ver):", "conteúdo fora das regras do WorkEnd"); if (m == null) return; motivo = m; }
    else if (!window.confirm(`Aprovar ${NOME_TIPO[a.tipo].toLowerCase()} de ${a.empresaNome ?? a.email}? Ele entra na grade do telão.`)) return;
    const r = await fetch("/api/admin/praca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: a.id, acao, motivo }) });
    const j = await r.json().catch(() => ({}));
    setAviso(r.ok ? (acao === "aprovar" ? "Aprovado: já está na grade." : "Recusado. Lembre de devolver o Pix no Mercado Pago.") : j.erro ?? `Erro ${r.status}`);
    await carregar();
  };
  const pendentes = (fila ?? []).filter((a) => a.status === "em_analise"), decididos = (fila ?? []).filter((a) => a.status !== "em_analise");
  return (
    <section data-fila-praca className="faixa mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[1.4rem]">Anúncios da praça</h2><p className="mt-1 max-w-[70ch] text-sm text-[var(--tinta-2)]">Telão, evento em destaque e patrocínio, já pagos. Só entram na grade depois de aprovados aqui. Ao recusar, devolva o Pix pelo Mercado Pago.</p></div>
        <div className="text-sm text-[var(--tinta-2)]">{fila ? `${pendentes.length} para aprovar` : "…"}</div>
      </div>
      {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}
      {fila && pendentes.length === 0 && <p className="mt-4 rounded-2xl bg-[var(--cinza)] px-4 py-3 text-sm text-[var(--tinta-2)]">Nada esperando aprovação.</p>}
      <ul className="mt-4 space-y-4">
        {pendentes.map((a) => (
          <li key={a.id} data-fila-item={a.id} className="grid gap-4 rounded-2xl border border-[var(--linha)] p-4 md:grid-cols-[minmax(0,22rem)_1fr]">
            <Previa a={a} />
            <div className="min-w-0 text-sm">
              <div className="text-[12px] font-bold text-[var(--azul)]">{NOME_TIPO[a.tipo]} · {a.formato === "modelo" ? "modelo pronto" : a.formato}</div>
              <div className="text-lg font-semibold">{a.empresaNome ?? "—"}</div>
              <div className="text-[var(--tinta-2)]">{a.email}</div>
              <div className="mt-1">{a.tipo === "destaque" ? `Evento: ${a.eventoTitulo ?? "—"}` : a.tipo === "telao" ? `A partir de ${dm(a.inicio)}, ${a.dias} dia${a.dias > 1 ? "s" : ""}` : `Patrocínio a partir de ${dm(a.inicio)} (30 dias)`} · {brl(Number(a.valor))} · pago {dt(a.pagoEm)}</div>
              {a.frase && <div className="mt-1 italic">“{a.frase}”</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button data-aprovar onClick={() => decidir(a, "aprovar")} className="rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-bold text-white">Aprovar</button>
                <button data-recusar onClick={() => decidir(a, "recusar")} className="rounded-xl bg-[#FDE8E8] px-4 py-2 text-sm font-semibold text-[#8A2A2A]">Recusar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {decididos.length > 0 && (
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Decididos ({decididos.length})</summary>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--linha)]"><table className="w-full text-sm"><tbody>
            {decididos.map((a) => <tr key={a.id} className="border-t border-[var(--linha)]"><td className="px-3 py-2">{NOME_TIPO[a.tipo]}</td><td className="px-3 py-2">{a.empresaNome ?? a.email}</td><td className="px-3 py-2">{brl(Number(a.valor))}</td><td className="px-3 py-2">{a.status === "recusado" ? `recusado: ${a.motivo}` : a.status}</td><td className="px-3 py-2">{dt(a.decididoEm)}</td></tr>)}
          </tbody></table></div>
        </details>
      )}
    </section>
  );
}
