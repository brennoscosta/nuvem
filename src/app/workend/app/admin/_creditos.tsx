"use client";
// Admin dos créditos e das unidades de IA (20/11/2026, frente "creditos"): totais vendidos, carteiras com extrato
// (a soma do extrato confere com o saldo), ajuste manual com motivo (fica no extrato), devolução marcada (o estorno do Pix
// continua à mão no Mercado Pago) e o consumo de IA de todas as empresas, com o custo real somado.
import { useEffect, useState } from "react";

type Carteira = { usuarioId: string; email: string | null; nome: string | null; comprado: number; bonus: number; total: number; lancamentos: number; confere: boolean };
type Totais = { pacotes: number; reais: number; creditosVendidos: number; bonusDados: number; usados: number; devolvidos: number; devolvidosReais: number; emCirculacao: number; divergencias: number };
type PacoteV = { id: string; email: string; valor: number; pacote: string; criadoEm: string; devolvidoEm: string | null; devolvidoValor: number | null };
type IA = { empresas: { empresaId: string; nome: string; custo: number; chamadas: number; usadas: number; saldo: number | null; compradasMes: number; cobrada: boolean }[]; totais: { custoReal: number; custoCobradas: number; custoInterno: number; unidadesUsadas: number; unidadesVendidasMes: number; creditosPagosMes: number; reaisPixMes: number } };
type Dados = { carteiras: Carteira[]; totais: Totais; pacotes: PacoteV[]; ia: IA };
type Extrato = { saldo: { comprado: number; bonus: number; total: number }; extrato: { id: string; tipo: string; comprado: number; bonus: number; descricao: string; motivo: string | null; criadoEm: string }[]; devolucoes: { pagamentoId: string; restante: number; bonusSai: number; descontoBonus: number; valorReais: number; prazoAte: string; noPrazo: boolean; jaDevolvido: boolean }[] };

const c2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || `Erro ${r.status}`);
  return j as T;
}

export function CreditosAdmin() {
  const [d, setD] = useState<Dados | null>(null);
  const [v, setV] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const [ext, setExt] = useState<Extrato | null>(null);
  const [aj, setAj] = useState({ email: "", valor: "", motivo: "" });
  const [dev, setDev] = useState({ motivo: "", fora: false });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { let vivo = true; api<Dados>("/api/admin/creditos").then((x) => vivo && setD(x)).catch((e) => vivo && setMsg({ ok: false, t: (e as Error).message })); return () => { vivo = false; }; }, [v]);
  useEffect(() => { if (!aberto) return; let vivo = true; api<Extrato>(`/api/admin/creditos?usuario=${encodeURIComponent(aberto)}`).then((x) => vivo && setExt(x)).catch(() => vivo && setExt(null)); return () => { vivo = false; }; }, [aberto, v]);
  const ajustar = async () => { setMsg(null); try { await api("/api/admin/creditos", { method: "POST", body: JSON.stringify({ acao: "ajuste", email: aj.email, valor: Number(aj.valor.replace(",", ".")), motivo: aj.motivo }) }); setAj({ email: "", valor: "", motivo: "" }); setMsg({ ok: true, t: "Ajuste lançado no extrato." }); setV((x) => x + 1); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } };
  const devolver = async (pagamento: string) => { setMsg(null); try { const r = await api<{ valorReais: number }>("/api/admin/creditos", { method: "POST", body: JSON.stringify({ acao: "devolucao", pagamento, motivo: dev.motivo, foraDoPrazo: dev.fora }) }); setDev({ motivo: "", fora: false }); setMsg({ ok: true, t: `Devolução marcada. Estorne ${brl(r.valorReais)} à mão no Mercado Pago.` }); setV((x) => x + 1); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } };
  if (!d) return <section className="faixa mt-10"><h2 className="text-[1.5rem]">Créditos e unidades de IA</h2><p className="text-[var(--tinta-2)]">{msg?.t ?? "Carregando…"}</p></section>;
  const t = d.totais; const ia = d.ia.totais;
  const campo = "mt-1 block w-full min-w-0 rounded-xl border border-[var(--linha)] bg-white px-3 py-2 text-base";
  return (
    <section className="faixa mt-10" data-admin-creditos>
      <h2 className="text-[1.5rem]">Créditos e unidades de IA</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><tbody>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">Total vendido em créditos</th><td className="py-2 pr-3" data-total-vendido={t.creditosVendidos}>{c2(t.creditosVendidos)} créditos em {t.pacotes} pacotes · {brl(t.reais)} recebidos no Pix</td></tr>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">Bônus dados</th><td className="py-2 pr-3">{c2(t.bonusDados)} (pacotes, indicação e ajustes)</td></tr>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">Usados nos produtos</th><td className="py-2 pr-3">{c2(t.usados)}</td></tr>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">Devolvidos</th><td className="py-2 pr-3">{c2(t.devolvidos)} créditos · {brl(t.devolvidosReais)} a estornar ou estornados</td></tr>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">Em circulação</th><td className="py-2 pr-3">{c2(t.emCirculacao)} nas carteiras · conferência: {t.divergencias ? <b className="text-[#B42318]">{t.divergencias} carteira(s) com diferença</b> : <b className="text-[#166534]">extratos batem com os saldos</b>}</td></tr>
        <tr className="border-b border-[var(--linha)]"><th className="py-2 pr-3 font-semibold">IA neste mês</th><td className="py-2 pr-3">custo real {brl(ia.custoReal)} (empresas {brl(ia.custoCobradas)} + Nuvem interna {brl(ia.custoInterno)}) · {ia.unidadesUsadas.toLocaleString("pt-BR")} unidades usadas · vendidas {ia.unidadesVendidasMes.toLocaleString("pt-BR")} unidades ({c2(ia.creditosPagosMes)} créditos + {brl(ia.reaisPixMes)} no Pix)</td></tr>
      </tbody></table></div>
      {msg && <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${msg.ok ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>{msg.t}</div>}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div className="rounded-2xl border border-[var(--linha)] bg-white p-4">
          <h3 className="font-bold">Carteiras</h3>
          <div className="mt-2 max-h-96 overflow-auto"><table className="w-full min-w-[480px] text-left text-[13px]">
            <thead className="text-[11.5px] text-[var(--tinta-2)]"><tr><th className="py-1 pr-2">Conta</th><th className="py-1 pr-2 text-right">Comprado</th><th className="py-1 pr-2 text-right">Bônus</th><th className="py-1 pr-2 text-right">Total</th><th className="py-1">Extrato</th></tr></thead>
            <tbody>{d.carteiras.map((c) => (
              <tr key={c.usuarioId} className="border-t border-[var(--linha)]"><td className="py-1.5 pr-2">{c.email ?? c.usuarioId}</td><td className="py-1.5 pr-2 text-right">{c2(c.comprado)}</td><td className="py-1.5 pr-2 text-right">{c2(c.bonus)}</td><td className="py-1.5 pr-2 text-right font-semibold">{c2(c.total)}</td><td className="py-1.5"><button type="button" onClick={() => setAberto(aberto === c.usuarioId ? null : c.usuarioId)} className="text-xs font-semibold text-[var(--azul)] underline">{aberto === c.usuarioId ? "fechar" : `ver (${c.lancamentos})`}</button>{!c.confere && <span className="ml-1 text-[11px] font-bold text-[#B42318]">diferença</span>}</td></tr>
            ))}</tbody>
          </table></div>
          {aberto && ext && (
            <div className="mt-3 rounded-xl bg-[#F1F3F6] p-3 text-[13px]" data-extrato-admin>
              <div className="font-semibold">Saldo: {c2(ext.saldo.total)} (comprado {c2(ext.saldo.comprado)} · bônus {c2(ext.saldo.bonus)})</div>
              {ext.devolucoes.filter((x) => !x.jaDevolvido && x.restante > 0).map((x) => (
                <div key={x.pagamentoId} className="mt-2 rounded-lg bg-white p-2">
                  <div>Pacote {x.pagamentoId}: devolver {c2(x.restante)} créditos{x.bonusSai > 0 ? ` (o bônus de ${c2(x.bonusSai)} sai junto)` : ""}{x.descontoBonus > 0 ? `, descontando ${c2(x.descontoBonus)} de bônus já usado` : ""} = <b>{brl(x.valorReais)}</b> no Pix. Prazo até {new Date(x.prazoAte).toLocaleDateString("pt-BR")}{x.noPrazo ? "" : " (vencido)"}.</div>
                  <input value={dev.motivo} onChange={(e) => setDev({ ...dev, motivo: e.target.value.slice(0, 300) })} placeholder="Motivo da devolução (fica no extrato)" className={campo} />
                  {!x.noPrazo && <label className="mt-1 flex items-center gap-1 text-[12px]"><input type="checkbox" checked={dev.fora} onChange={(e) => setDev({ ...dev, fora: e.target.checked })} />Devolver fora do prazo (exceção)</label>}
                  <button type="button" onClick={() => void devolver(x.pagamentoId)} className="mt-1 rounded-lg bg-[#1D2128] px-3 py-1.5 text-xs font-bold text-white">Marcar devolução</button>
                </div>
              ))}
              <ul className="mt-2 max-h-60 overflow-auto">{ext.extrato.map((l) => <li key={l.id} className="flex justify-between gap-2 border-t border-black/5 py-1"><span className="min-w-0"><span className="text-[var(--tinta-2)]">{quando(l.criadoEm)}</span> · {l.descricao}{l.motivo ? <span className="block text-[11.5px] text-[var(--tinta-2)]">Motivo: {l.motivo}</span> : null}</span><b className="shrink-0">{l.comprado + l.bonus >= 0 ? "+" : ""}{c2(l.comprado + l.bonus)}</b></li>)}</ul>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--linha)] bg-white p-4" data-ajuste>
            <h3 className="font-bold">Ajuste manual</h3>
            <p className="text-[12.5px] text-[var(--tinta-2)]">Positivo entra como bônus (cortesia, não volta em dinheiro); negativo tira do bônus e depois do comprado. O motivo fica no extrato.</p>
            <label className="mt-2 block text-[12.5px] font-semibold">E-mail da conta<input value={aj.email} onChange={(e) => setAj({ ...aj, email: e.target.value })} className={campo} /></label>
            <label className="mt-2 block text-[12.5px] font-semibold">Créditos (ex.: 20 ou -5,50)<input value={aj.valor} onChange={(e) => setAj({ ...aj, valor: e.target.value })} inputMode="decimal" className={campo} /></label>
            <label className="mt-2 block text-[12.5px] font-semibold">Motivo<input value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value.slice(0, 300) })} className={campo} /></label>
            <button type="button" onClick={() => void ajustar()} disabled={!aj.email || !aj.valor || aj.motivo.trim().length < 5} className="mt-2 rounded-xl bg-[#1D4ED8] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Lançar ajuste</button>
          </div>
          <div className="rounded-2xl border border-[var(--linha)] bg-white p-4">
            <h3 className="font-bold">Pacotes vendidos</h3>
            <ul className="mt-1 max-h-60 overflow-auto text-[12.5px]">{d.pacotes.length === 0 ? <li className="text-[var(--tinta-2)]">Nenhum ainda.</li> : d.pacotes.map((p) => <li key={p.id} className="flex justify-between gap-2 border-t border-[var(--linha)] py-1"><span className="min-w-0 truncate">{quando(p.criadoEm)} · {p.email} · {p.pacote} créditos</span><span className="shrink-0">{brl(p.valor)}{p.devolvidoEm ? ` · devolvido ${brl(p.devolvidoValor ?? 0)}` : ""}</span></li>)}</ul>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[var(--linha)] bg-white p-4">
        <h3 className="font-bold">Consumo de IA por empresa (mês)</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[13px]" data-consumo-ia>
          <thead className="text-[11.5px] text-[var(--tinta-2)]"><tr><th className="py-1 pr-2">Empresa</th><th className="py-1 pr-2 text-right">Chamadas</th><th className="py-1 pr-2 text-right">Custo real</th><th className="py-1 pr-2 text-right">Unidades usadas</th><th className="py-1 pr-2 text-right">Saldo</th><th className="py-1 text-right">Compradas no mês</th></tr></thead>
          <tbody>{d.ia.empresas.map((e) => <tr key={e.empresaId} className="border-t border-[var(--linha)]"><td className="py-1.5 pr-2">{e.nome}{!e.cobrada && <span className="ml-1 rounded bg-[#F1F3F6] px-1.5 text-[11px]">interna, sem cobrança</span>}</td><td className="py-1.5 pr-2 text-right">{e.chamadas}</td><td className="py-1.5 pr-2 text-right">{brl(e.custo)}</td><td className="py-1.5 pr-2 text-right">{e.usadas.toLocaleString("pt-BR")}</td><td className="py-1.5 pr-2 text-right">{e.saldo == null ? "—" : e.saldo.toLocaleString("pt-BR")}</td><td className="py-1.5 text-right">{e.compradasMes.toLocaleString("pt-BR")}</td></tr>)}</tbody>
        </table></div>
      </div>
    </section>
  );
}
