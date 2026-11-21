"use client";
// Admin do pagamento automático (WE-09, 21/11/2026): cada assinatura com o estado, a próxima cobrança, as cobranças
// aprovadas e as falhas; os pedidos de devolução de quem cancelou nos 7 dias da primeira contratação (a devolução é feita à
// mão no Mercado Pago; aqui só se marca como devolvido).
import { useEffect, useState } from "react";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { QUIOSQUE_POR_CHAVE } from "@/office/data/quiosques";

type Linha = { id: string; estado: string; meio: string; tipo: string; terrenoChave: string; valor: string; primeiroValor: string; oferta: string | null; proximaCobranca: string | null; tentativas: number; ultimaFalha: string | null; ultimaFalhaEm: string | null; criadoEm: string; canceladaEm: string | null; motivoFim: string | null; externoId: string | null; primeira: boolean; email: string | null; empresaNome: string | null; pagoAte: string | null; cobradas: number; recebido: number; falhas: number };
type Devolucao = { id: string; assinaturaId: string; valor: string; pagamentos: string[]; motivo: string; estado: string; criadoEm: string; resolvidoEm: string | null; resolvidoPor: string | null; email: string | null; terrenoChave: string | null };
type Dados = { config: { cartao: boolean; pixAutomatico: boolean }; assinaturas: Linha[]; devolucoes: Devolucao[]; eventos: { pendentes: number; comErro: number } };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const ROTULO: Record<string, string> = { pendente: "aguardando", ativa: "ativa", falhando: "cobrança falhando", cancelada: "cancelada", encerrada: "encerrada", recusada: "1ª cobrança recusada" };
const COR: Record<string, string> = { ativa: "text-[#166534]", falhando: "text-[#B42318]", recusada: "text-[#B42318]" };
const lote = (ch: string | null) => (!ch ? "—" : QUIOSQUE_POR_CHAVE[ch] ? `Quiosque ${QUIOSQUE_POR_CHAVE[ch].numero}` : LOTE_POR_CHAVE[ch] ? `Lote ${LOTE_POR_CHAVE[ch].numero}` : ch);

export function AssinaturasAdmin() {
  const [d, setD] = useState<Dados | null>(null);
  const [v, setV] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { let vivo = true; fetch("/api/admin/assinaturas", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (vivo) { if (j?.assinaturas) setD(j as Dados); else setMsg(j?.erro ?? "Não carregou."); } }).catch(() => vivo && setMsg("Não carregou.")); return () => { vivo = false; }; }, [v]);
  const devolvido = async (id: string) => { const r = await fetch("/api/admin/assinaturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "devolvido", id }) }); const j = await r.json().catch(() => ({})); setMsg(r.ok ? "Marcado como devolvido." : j.erro ?? "Erro."); setV((n) => n + 1); };
  if (!d) return <section className="faixa mt-10"><h2 className="text-[1.5rem]">Pagamento automático</h2><p className="text-[var(--tinta-2)]">{msg ?? "Carregando…"}</p></section>;
  const vivas = d.assinaturas.filter((a) => ["ativa", "falhando", "pendente"].includes(a.estado));
  const abertas = d.devolucoes.filter((x) => x.estado === "aberto");
  return (
    <section className="faixa mt-10" data-admin-assinaturas>
      <h2 className="text-[1.5rem]">Pagamento automático</h2>
      <p className="mt-1 text-sm text-[var(--tinta-2)]">Cartão {d.config.cartao ? "ligado" : "desligado (falta MP_PUBLIC_KEY)"} · Pix Automático {d.config.pixAutomatico ? "ligado" : "desligado"} · {vivas.length} valendo, {vivas.filter((a) => a.estado === "falhando").length} com cobrança falhando · avisos do Mercado Pago sem processar: {d.eventos.pendentes}{d.eventos.comErro ? ` (${d.eventos.comErro} com erro)` : ""}</p>
      {msg && <div className="mt-2 rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold">{msg}</div>}
      {abertas.length > 0 && (
        <div className="mt-3 rounded-2xl bg-[#FFF4D6] px-3 py-2 text-sm text-[#7A5A00]" data-devolucoes-abertas={abertas.length}>
          <b>Pedidos de devolução (cancelou nos 7 dias da primeira contratação)</b>
          <ul className="mt-1 grid gap-1">{abertas.map((x) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2"><span>{x.email ?? "conta excluída"} · {lote(x.terrenoChave)} · <b>{brl(Number(x.valor))}</b> · pedido em {dia(x.criadoEm)} · pagamentos {x.pagamentos.join(", ")}</span><button type="button" onClick={() => void devolvido(x.id)} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#1D4ED8]">Marcar como devolvido</button></li>)}</ul>
          <div className="mt-1 text-xs">Devolva no Mercado Pago, nos pagamentos indicados. O estorno chega pelo aviso do Mercado Pago e tira os dias do lote sozinho.</div>
        </div>
      )}
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead><tr className="border-b border-[var(--linha)] text-[var(--tinta-2)]"><th className="py-2 pr-3 font-semibold">Conta e loja</th><th className="py-2 pr-3 font-semibold">Estado</th><th className="py-2 pr-3 font-semibold">Mensalidade</th><th className="py-2 pr-3 font-semibold">Próxima cobrança</th><th className="py-2 pr-3 font-semibold">Cobradas</th><th className="py-2 pr-3 font-semibold">Falhas</th><th className="py-2 pr-3 font-semibold">Desde</th></tr></thead>
        <tbody>{d.assinaturas.map((a) => (
          <tr key={a.id} className="border-b border-[var(--linha)] align-top" data-assinatura-admin={a.estado}>
            <td className="py-2 pr-3"><div className="font-semibold">{a.empresaNome ?? "—"} · {lote(a.terrenoChave)}</div><div className="text-xs text-[var(--tinta-2)]">{a.email ?? "conta excluída"} · {a.meio === "cartao" ? "cartão" : "Pix Automático"}{a.primeira ? " · 1ª contratação" : ""}</div></td>
            <td className={`py-2 pr-3 font-semibold ${COR[a.estado] ?? ""}`}>{ROTULO[a.estado] ?? a.estado}{a.motivoFim ? <div className="text-xs font-normal text-[var(--tinta-2)]">{a.motivoFim}</div> : null}</td>
            <td className="py-2 pr-3">{brl(Number(a.valor))}{Number(a.primeiroValor) !== Number(a.valor) ? <div className="text-xs text-[var(--tinta-2)]">1ª: {brl(Number(a.primeiroValor))}{a.oferta ? ` (${a.oferta})` : ""}</div> : null}</td>
            <td className="py-2 pr-3">{["ativa", "falhando", "pendente"].includes(a.estado) ? dia(a.proximaCobranca) : "—"}<div className="text-xs text-[var(--tinta-2)]">lote pago até {dia(a.pagoAte)}</div></td>
            <td className="py-2 pr-3">{a.cobradas} · {brl(Number(a.recebido))}</td>
            <td className="py-2 pr-3">{a.falhas}{a.estado === "falhando" ? <div className="text-xs text-[#B42318]">tentativa {a.tentativas}{a.ultimaFalha ? ` · ${a.ultimaFalha}` : ""} · {dia(a.ultimaFalhaEm)}</div> : null}</td>
            <td className="py-2 pr-3">{dia(a.criadoEm)}{a.canceladaEm ? <div className="text-xs text-[var(--tinta-2)]">até {dia(a.canceladaEm)}</div> : null}</td>
          </tr>
        ))}{!d.assinaturas.length && <tr><td colSpan={7} className="py-3 text-[var(--tinta-2)]">Nenhuma assinatura ainda.</td></tr>}</tbody>
      </table></div>
    </section>
  );
}
