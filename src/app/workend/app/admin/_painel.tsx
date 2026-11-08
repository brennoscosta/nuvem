"use client";
// Tabelas do admin (carregam das rotas /api/admin/*). Ações confirmam antes de executar; placa do lote é editável na linha.
import { useCallback, useEffect, useState } from "react";
import { LOTE_POR_CHAVE, descricaoLote } from "@/office/data/mundo";

// Entrar no admin com a senha única (abre a conta do dono)
export function EntrarAdmin({ temSenha }: { temSenha: boolean }) {
  const [senha, setSenha] = useState(""); const [erro, setErro] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault(); setOcupado(true); setErro(null);
    try {
      const r = await fetch("/api/workend/admin-senha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`);
      window.location.reload();
    } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  if (!temSenha) return <p className="mt-6 rounded-xl bg-[#FFF4D6] px-4 py-3 text-sm text-[#7A5A00]">Falta a variável ADMIN_SENHA no CapRover.</p>;
  return (
    <form onSubmit={entrar} className="mt-6 flex max-w-sm flex-col gap-3">
      <label className="campo">Senha do admin<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required autoFocus /></label>
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro}</div>}
      <button type="submit" disabled={ocupado} className="btn btn-azul">{ocupado ? "Entrando…" : "Entrar no admin"}</button>
      <a href="/entrar" className="text-sm text-[var(--tinta-2)] underline">ou entrar com e-mail e senha da conta</a>
    </form>
  );
}

export interface ConfigAdmin { preco: number; precoAdmin: number; minutosReserva: number; diasMes: number; diasTolerancia: number; pagamento: boolean; adminEmail: string; eu: string }

interface Terreno { chave: string; usuarioId: string; status: string; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: string; reservadoAte: string | null; pagoAte: string | null; email: string; usuarioNome: string; banidoEm: string | null }
interface Pagamento { id: string; terrenoChave: string; usuarioId: string; status: string; valor: string; meses: number; metodo: string | null; pagamentoId: string | null; criadoEm: string; pagoEm: string | null; tipo?: string; email: string; empresaNome: string | null }
interface Usuario { id: string; email: string; nome: string; empresaNome: string; papel: string; banidoEm: string | null; banidoMotivo: string | null; criadoEm: string; ultimoAcesso: string | null; lote: string | null; loteStatus: string | null }

const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const lote = (chave: string) => `Lote ${LOTE_POR_CHAVE[chave]?.numero ?? "?"}`;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// link que abre o mapa já no lote (nova aba, pra não perder o admin)
const LinkLote = ({ chave, children }: { chave: string; children?: React.ReactNode }) => <a href={`/mundo?lote=${encodeURIComponent(chave)}`} target="_blank" rel="noreferrer" title={LOTE_POR_CHAVE[chave] ? `${descricaoLote(LOTE_POR_CHAVE[chave])} · abrir no mapa` : "abrir no mapa"} className="font-semibold text-[var(--azul)] hover:underline">{children ?? lote(chave)} ↗</a>;
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? `Erro ${r.status}`); });

export function PainelAdmin({ config }: { config: ConfigAdmin }) {
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
  const editar = (t: Terreno) => {
    const nome = window.prompt("Nome na placa:", t.empresaNome); if (nome == null) return;
    const cor = window.prompt("Cor da marca (hex):", t.cor); if (cor == null) return;
    agir(`/api/admin/terrenos/${encodeURIComponent(t.chave)}`, { acao: "editar", empresaNome: nome, cor }, `Mudar a placa do ${lote(t.chave)} pra "${nome}"?`);
  };
  const dias = (chave: string) => { const v = window.prompt("Quantos dias pagos somar? (negativo tira; ex.: 30, 365, -10)", "30"); if (v == null) return; const n = Number(v); if (!Number.isFinite(n) || n === 0) return; agir(`/api/admin/terrenos/${encodeURIComponent(chave)}`, { acao: "dias", dias: n }, `${n > 0 ? "Somar" : "Tirar"} ${Math.abs(n)} dias pagos ${n > 0 ? "ao" : "do"} ${lote(chave)}?`); };
  const transferir = (chave: string) => { const email = window.prompt("E-mail do novo dono do lote:"); if (!email) return; agir(`/api/admin/terrenos/${encodeURIComponent(chave)}`, { acao: "transferir", email }, `Passar o ${lote(chave)} pra ${email}?`); };
  const banir = (chave: string) => { const motivo = window.prompt("Motivo do banimento (o dono vai ver):", "descumprimento das políticas de uso"); if (motivo == null) return; agir(`/api/admin/terrenos/${encodeURIComponent(chave)}`, { acao: "banir", motivo }, `Banir o imóvel ${lote(chave)} e suspender o dono?`); };
  const ativos = terrenos.filter((t) => t.status === "ativo").length;
  const receita = pagamentos.filter((p) => p.status === "aprovado").reduce((a, p) => a + Number(p.valor), 0);
  return (
    <>
      {erro && <div className="faixa mt-4"><div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{erro} <button onClick={() => setErro(null)} className="ml-2 underline">fechar</button></div></div>}
      <section className="faixa mt-8 grid gap-4 sm:grid-cols-4">
        {[["Lotes ativos (pagos)", ativos], ["Reservas em aberto", terrenos.length - ativos], ["Usuários", usuarios.length], ["Recebido (aprovados)", brl(receita)]].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl bg-[var(--cinza)] p-5"><div className="text-sm text-[var(--tinta-2)]">{k}</div><div className="mt-1 text-[1.6rem] font-semibold">{v}</div></div>
        ))}
      </section>

      <section className="faixa mt-8">
        <div className="rounded-2xl border border-[var(--linha)] p-5 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span><b>Preço:</b> {brl(config.preco)}/lote/mês</span>
            <span><b>Conta admin paga:</b> {brl(config.precoAdmin)} (1/100, pra testar de verdade)</span>
            <span><b>Reserva:</b> {config.minutosReserva >= 60 ? `${config.minutosReserva / 60} h` : `${config.minutosReserva} min`} pra pagar</span>
            <span><b>Mês:</b> {config.diasMes} dias + {config.diasTolerancia} de tolerância</span>
            <span><b>Mercado Pago:</b> {config.pagamento ? <span className="text-[#1B8A4C]">ligado</span> : <span className="text-[#8A2A2A]">desligado (falta MP_ACCESS_TOKEN)</span>}</span>
            <span><b>Dono:</b> {config.adminEmail}{config.eu !== config.adminEmail && <> · você: {config.eu}</>}</span>
          </div>
          <p className="mt-2 text-xs text-[var(--tinta-2)]">Preço, reserva e prazos ficam no código (<code>src/server/terrenos.ts</code>); mudar exige um build. O resto (placa, dias pagos, dono do lote, banir) é editável aqui.</p>
        </div>
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
                  <td className="p-3"><LinkLote chave={t.chave} /><div className="text-xs font-normal text-[var(--tinta-2)]">{LOTE_POR_CHAVE[t.chave] ? descricaoLote(LOTE_POR_CHAVE[t.chave]) : t.chave}</div></td>
                  <td className="p-3"><button onClick={() => editar(t)} title="Editar nome e cor da placa" className="text-left hover:underline"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: t.cor }} />{t.empresaNome} <span className="text-xs text-[var(--tinta-2)]">✎</span></button></td>
                  <td className="p-3">{t.usuarioNome}<br /><span className="text-xs text-[var(--tinta-2)]">{t.email}</span></td>
                  <td className="p-3">{t.status === "ativo" ? <span className="rounded-full bg-[#E3F6EA] px-2 py-0.5 text-xs font-semibold text-[#1B8A4C]">ativo</span> : <span className="rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#7A5A00]">reservado até {dt(t.reservadoAte)}</span>}</td>
                  <td className="p-3">{dt(t.reservadoEm)}</td>
                  <td className="p-3">{dt(t.pagoAte)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button onClick={() => agir(`/api/admin/terrenos/${encodeURIComponent(t.chave)}`, { acao: "ativar", meses: 1 }, `Dar +30 dias pagos ao ${lote(t.chave)}?`)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">+30 dias</button>
                    <button onClick={() => dias(t.chave)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">± dias</button>
                    <button onClick={() => editar(t)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Editar placa</button>
                    <button onClick={() => transferir(t.chave)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Transferir</button>
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
                  <td className="p-3">{dt(p.criadoEm)}</td><td className="p-3"><LinkLote chave={p.terrenoChave} /></td><td className="p-3">{p.email}<br /><span className="text-xs text-[var(--tinta-2)]">{p.empresaNome ?? ""}</span></td>
                  <td className="p-3">{brl(Number(p.valor))} · {p.tipo === "layout" ? "troca de prédio" : `${p.meses} mês${p.meses > 1 ? "es" : ""}`}</td>
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
                  <td className="p-3">{u.lote ? <><LinkLote chave={u.lote} /> <span className="text-xs text-[var(--tinta-2)]">{u.loteStatus}</span></> : "—"}</td>
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
