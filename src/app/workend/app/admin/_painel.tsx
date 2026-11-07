"use client";
// Tabelas do admin (carregam das rotas /api/admin/*). Ações confirmam antes de executar.
import { useCallback, useEffect, useState } from "react";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

interface Terreno { chave: string; usuarioId: string; status: string; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: string; reservadoAte: string | null; pagoAte: string | null; email: string; usuarioNome: string; banidoEm: string | null }
interface Pagamento { id: string; terrenoChave: string; usuarioId: string; status: string; valor: string; meses: number; metodo: string | null; pagamentoId: string | null; criadoEm: string; pagoEm: string | null; email: string; empresaNome: string | null }
interface Usuario { id: string; email: string; nome: string; empresaNome: string; papel: string; banidoEm: string | null; banidoMotivo: string | null; criadoEm: string; ultimoAcesso: string | null; lote: string | null; loteStatus: string | null }

const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const lote = (chave: string) => `Lote ${LOTE_POR_CHAVE[chave]?.numero ?? "?"}`;
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`); });

export function PainelAdmin() {
  const [terrenos, setTerrenos] = useState<Terreno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try {
      const [t, p, u] = await Promise.all([fetch("/api/admin/terrenos").then((r) => r.json()), fetch("/api/admin/pagamentos").then((r) => r.json()), fetch("/api/admin/usuarios").then((r) => r.json())]);
      setTerrenos(Array.isArray(t) ? t : []); setPagamentos(Array.isArray(p) ? p : []); setUsuarios(Array.isArray(u) ? u : []);
    } catch (e) { setErro((e as Error).message); }
  }, []);
  useEffect(() => { const t0 = setTimeout(carregar, 0); const t = setInterval(carregar, 30000); return () => { clearTimeout(t0); clearInterval(t); }; }, [carregar]);
  const agir = async (url: string, body: unknown, confirmar: string) => {
    if (!window.confirm(confirmar)) return;
    try { await post(url, body); await carregar(); } catch (e) { setErro((e as Error).message); }
  };
  const banir = (chave: string) => { const motivo = window.prompt("Motivo do banimento (o dono vai ver):", "descumprimento das políticas de uso"); if (motivo == null) return; agir(`/api/admin/terrenos/${encodeURIComponent(chave)}`, { acao: "banir", motivo }, `Banir o imóvel ${lote(chave)} e suspender o dono?`); };
  const ativos = terrenos.filter((t) => t.status === "ativo").length;
  const receita = pagamentos.filter((p) => p.status === "aprovado").reduce((a, p) => a + Number(p.valor), 0);
  return (
    <>
      {erro && <div className="faixa mt-4"><div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro} <button onClick={() => setErro(null)} className="ml-2 underline">fechar</button></div></div>}
      <section className="faixa mt-8 grid gap-4 sm:grid-cols-4">
        {[["Lotes ativos (pagos)", ativos], ["Reservas em aberto", terrenos.length - ativos], ["Usuários", usuarios.length], ["Recebido (aprovados)", `R$ ${receita.toFixed(2)}`]].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl bg-[var(--cinza)] p-5"><div className="text-sm text-[var(--tinta-2)]">{k}</div><div className="mt-1 text-[1.6rem] font-semibold">{v}</div></div>
        ))}
      </section>

      <section className="faixa mt-12">
        <h2 className="text-[1.4rem]">Lotes</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Lote</th><th className="p-3">Empresa</th><th className="p-3">Dono</th><th className="p-3">Status</th><th className="p-3">Reservado</th><th className="p-3">Pago até</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {terrenos.length === 0 && <tr><td colSpan={7} className="p-4 text-[var(--tinta-2)]">Nenhum lote reservado ainda.</td></tr>}
              {terrenos.map((t) => (
                <tr key={t.chave} className="border-t border-[var(--linha)]">
                  <td className="p-3 font-semibold"><a href={`/mundo?lote=${encodeURIComponent(t.chave)}`} className="text-[var(--azul)]">{lote(t.chave)}</a></td>
                  <td className="p-3"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: t.cor }} />{t.empresaNome}</td>
                  <td className="p-3">{t.usuarioNome}<br /><span className="text-xs text-[var(--tinta-2)]">{t.email}</span></td>
                  <td className="p-3">{t.status === "ativo" ? <span className="rounded-full bg-[#E3F6EA] px-2 py-0.5 text-xs font-semibold text-[#1B8A4C]">ativo</span> : <span className="rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#7A5A00]">reservado até {dt(t.reservadoAte)}</span>}</td>
                  <td className="p-3">{dt(t.reservadoEm)}</td>
                  <td className="p-3">{dt(t.pagoAte)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button onClick={() => agir(`/api/admin/terrenos/${encodeURIComponent(t.chave)}`, { acao: "ativar", meses: 1 }, `Dar +30 dias pagos ao ${lote(t.chave)}?`)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">+30 dias</button>
                    <button onClick={() => agir(`/api/admin/terrenos/${encodeURIComponent(t.chave)}`, { acao: "liberar" }, `Liberar o ${lote(t.chave)} (tira a empresa, sem suspender o dono)?`)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Liberar</button>
                    <button onClick={() => banir(t.chave)} className="rounded-lg bg-[#E2575B] px-2 py-1 text-xs font-semibold text-white">Banir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="faixa mt-12">
        <h2 className="text-[1.4rem]">Pagamentos (Mercado Pago)</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Quando</th><th className="p-3">Lote</th><th className="p-3">Quem</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Meio</th><th className="p-3">Id MP</th></tr></thead>
            <tbody>
              {pagamentos.length === 0 && <tr><td colSpan={7} className="p-4 text-[var(--tinta-2)]">Nenhum pagamento ainda.</td></tr>}
              {pagamentos.map((p) => (
                <tr key={p.id} className="border-t border-[var(--linha)]">
                  <td className="p-3">{dt(p.criadoEm)}</td><td className="p-3">{lote(p.terrenoChave)}</td><td className="p-3">{p.email}<br /><span className="text-xs text-[var(--tinta-2)]">{p.empresaNome ?? ""}</span></td>
                  <td className="p-3">R$ {Number(p.valor).toFixed(2)} · {p.meses} mês{p.meses > 1 ? "es" : ""}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "aprovado" ? "bg-[#E3F6EA] text-[#1B8A4C]" : p.status === "pendente" ? "bg-[#FFF4D6] text-[#7A5A00]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`}>{p.status}</span>{p.status === "pendente" && <button onClick={() => fetch(`/api/pagamentos/${p.id}`, { method: "POST" }).then(carregar)} className="ml-2 text-xs underline">conferir</button>}</td>
                  <td className="p-3">{p.metodo ?? "—"}</td><td className="p-3 text-xs">{p.pagamentoId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="faixa mt-12">
        <h2 className="text-[1.4rem]">Usuários</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Empresa</th><th className="p-3">Lote</th><th className="p-3">Papel</th><th className="p-3">Criado</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`border-t border-[var(--linha)] ${u.banidoEm ? "bg-[#FDE8E8]/40" : ""}`}>
                  <td className="p-3 font-semibold">{u.nome}{u.banidoEm && <div className="text-xs font-normal text-[#8A2A2A]">suspenso: {u.banidoMotivo}</div>}</td>
                  <td className="p-3">{u.email}</td><td className="p-3">{u.empresaNome || "—"}</td>
                  <td className="p-3">{u.lote ? `${lote(u.lote)} · ${u.loteStatus}` : "—"}</td>
                  <td className="p-3">{u.papel === "admin" ? <span className="rounded-full bg-[#E6EEFF] px-2 py-0.5 text-xs font-semibold text-[var(--azul)]">admin</span> : "dono"}</td>
                  <td className="p-3">{dt(u.criadoEm)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {u.banidoEm
                      ? <button onClick={() => agir(`/api/admin/usuarios/${u.id}`, { acao: "desbanir" }, `Reativar a conta de ${u.email}?`)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Reativar</button>
                      : <button onClick={() => { const motivo = window.prompt("Motivo:", "descumprimento das políticas de uso"); if (motivo != null) agir(`/api/admin/usuarios/${u.id}`, { acao: "banir", motivo }, `Suspender ${u.email} e tirar o lote dele?`); }} className="mr-1 rounded-lg bg-[#E2575B] px-2 py-1 text-xs font-semibold text-white">Suspender</button>}
                    {u.papel === "admin"
                      ? <button onClick={() => agir(`/api/admin/usuarios/${u.id}`, { acao: "dono" }, `Tirar o admin de ${u.email}?`)} className="rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Tirar admin</button>
                      : <button onClick={() => agir(`/api/admin/usuarios/${u.id}`, { acao: "admin" }, `Tornar ${u.email} admin do WorkEnd?`)} className="rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Tornar admin</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
