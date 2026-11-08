"use client";
// Admin: os personagens dos visitantes (quem comprou pra andar no mapa). Lista, mostra se está online/pago e dá dias.
import { useCallback, useEffect, useState } from "react";

interface P { usuarioId: string; nome: string; tipo: string; boneco: string; roupa: string; bio: string; redes: Record<string, string> | null; mostrarRedes: boolean; pagoAte: string | null; vistoEm: string | null; criadoEm: string; email: string }
const dataBR = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export function PersonagensAdmin() {
  const [lista, setLista] = useState<P[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await fetch("/api/admin/personagens"); if (r.ok) setLista((await r.json()).personagens); }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);
  const darDias = async (p: P, dias: number) => {
    const r = await fetch("/api/admin/personagens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuarioId: p.usuarioId, dias }) });
    setAviso(r.ok ? `${dias} dias liberados pra ${p.nome}.` : "Não deu pra liberar."); await carregar();
  };
  const [agora, setAgora] = useState(0);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 5000); setTimeout(() => setAgora(Date.now()), 0); return () => clearInterval(t); }, []);
  return (
    <section className="faixa mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[1.4rem]">Personagens no mapa</h2><p className="mt-1 max-w-[70ch] text-sm text-[var(--tinta-2)]">Quem comprou um personagem pra andar pelo mundo, conversar e fazer negócios (de R$ 19,90 por R$ 5,90/mês). Aqui você vê quem está pago, quem está online e libera dias de cortesia.</p></div>
        <div className="text-sm text-[var(--tinta-2)]">{lista ? `${lista.length} personagem(ns) · ${lista.filter((p) => p.pagoAte && new Date(p.pagoAte).getTime() > agora).length} ativos` : "…"}</div>
      </div>
      {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase tracking-wide text-[var(--tinta-2)]"><tr><th className="px-3 py-2">Personagem</th><th className="px-3 py-2">Conta</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Pago até</th><th className="px-3 py-2">Visto</th><th className="px-3 py-2">Redes</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {lista?.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--tinta-2)]">Ninguém montou personagem ainda.</td></tr>}
            {lista?.map((p) => { const pago = !!p.pagoAte && new Date(p.pagoAte).getTime() > agora; const online = !!p.vistoEm && agora - new Date(p.vistoEm).getTime() < 30000; return (
              <tr key={p.usuarioId} className="border-t border-[var(--linha)]">
                <td className="px-3 py-2"><div className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full" style={{ background: p.roupa }} /><b>{p.nome}</b>{online && <span className="rounded-full bg-[#E3F6EA] px-1.5 text-[10px] font-bold text-[#166534]">online</span>}</div>{p.bio && <div className="max-w-[32ch] truncate text-xs text-[var(--tinta-2)]">{p.bio}</div>}</td>
                <td className="px-3 py-2 text-xs">{p.email}</td>
                <td className="px-3 py-2 text-xs">{p.tipo}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pago ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>{pago ? dataBR(p.pagoAte) : "não pago"}</span></td>
                <td className="px-3 py-2 text-xs">{p.vistoEm ? new Date(p.vistoEm).toLocaleString("pt-BR") : "nunca"}</td>
                <td className="px-3 py-2 text-xs">{p.redes && Object.values(p.redes).some(Boolean) ? Object.entries(p.redes).filter(([, v]) => v).map(([k]) => k).join(", ") : "—"}{p.mostrarRedes && " (públicas)"}</td>
                <td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => darDias(p, 30)} className="btn btn-linha !px-2 !py-1 text-xs">+30 dias</button><button onClick={() => darDias(p, 365)} className="btn btn-linha !px-2 !py-1 text-xs">+1 ano</button></div></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
