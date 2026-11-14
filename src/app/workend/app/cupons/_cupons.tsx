"use client";
// Tela dos cupons (13/11/2026): validar código, criar e encerrar cupons da loja e a lista "Meus cupons".
import { useEffect, useState } from "react";

type CupomDono = { id: string; titulo: string; regra: string; validade: string; limite: number | null; ativo: boolean; pegos: number; usados: number; vencido: boolean };
type Meu = { codigo: string; titulo: string; regra: string; validade: string; usado: boolean; vencido: boolean; empresa: string; numero: number | null };
type Dados = { temLoja: boolean; daLoja: CupomDono[]; meus: Meu[] };
const dataBR = (d: string) => d.split("-").reverse().join("/");
// a data de hoje no horário de Brasília (para o mínimo do campo de validade)
const hojeBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || `Erro ${r.status}`);
  return j as T;
}

export function PainelCupons() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [versao, setVersao] = useState(0);
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; t: string } | null>(null);
  const [form, setForm] = useState({ titulo: "", regra: "", validade: "", limite: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    api<Dados>("/api/workend/cupons").then((d) => vivo && setDados(d)).catch(() => vivo && setDados({ temLoja: false, daLoja: [], meus: [] }));
    return () => { vivo = false; };
  }, [versao]);
  const validar = async () => {
    setResultado(null); setOcupado(true);
    try { const r = await api<{ titulo: string; cliente: string; codigo: string }>("/api/workend/cupons/validar", { method: "POST", body: JSON.stringify({ codigo }) }); setResultado({ ok: true, t: `✓ ${r.codigo} válido: ${r.titulo}, de ${r.cliente}. Marcado como usado.` }); setCodigo(""); setVersao((v) => v + 1); }
    catch (e) { setResultado({ ok: false, t: (e as Error).message }); }
    finally { setOcupado(false); }
  };
  const criar = async () => {
    setErro(null); setOcupado(true);
    try { await api("/api/workend/cupons", { method: "POST", body: JSON.stringify(form) }); setForm({ titulo: "", regra: "", validade: "", limite: "" }); setVersao((v) => v + 1); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };
  const encerrar = async (id: string) => { await api(`/api/workend/cupons/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null); setVersao((v) => v + 1); };
  if (!dados) return <section className="faixa mt-8 text-[var(--tinta-2)]">Carregando…</section>;
  const ativos = dados.daLoja.filter((c) => c.ativo && !c.vencido);
  const campo = "mt-1 block w-full min-w-0 rounded-xl border border-[var(--linha)] bg-white px-3 py-2 text-base";
  return (
    <>
      {dados.temLoja && (
        <section className="faixa mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
          <div className="rounded-2xl bg-[#1D2128] p-6 text-white">
            <h2 className="!text-[1.3rem]" style={{ color: "#fff" }}>Validar cupom</h2>
            <p className="mt-1 text-[14px] text-white/70">Digite o código que o cliente mostrar (ex.: PADA-7K3Q).</p>
            <div className="mt-3 flex gap-2">
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 12))} onKeyDown={(e) => { if (e.key === "Enter") void validar(); }} placeholder="CÓDIGO" aria-label="Código do cupom" className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 font-mono text-lg tracking-widest text-[#1D2128]" />
              <button type="button" onClick={validar} disabled={ocupado || codigo.length < 6} className="rounded-xl bg-[#16A34A] px-4 font-bold disabled:opacity-50">Validar</button>
            </div>
            {resultado && <p className={`mt-3 rounded-xl px-3 py-2 text-[14px] font-semibold ${resultado.ok ? "bg-[#16A34A]/20 text-[#86EFAC]" : "bg-[#E11D48]/20 text-[#FDA4AF]"}`}>{resultado.t}</p>}
          </div>
          <div className="rounded-2xl border border-[var(--linha)] p-6">
            <h2 className="!text-[1.3rem]">Criar cupom <span className="text-[14px] font-normal text-[var(--tinta-2)]">· {ativos.length} de 3 ativos</span></h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
              <label className="block sm:col-span-2 text-[13px] font-semibold">Desconto<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value.slice(0, 40) })} placeholder="Ex.: 10% no pão" className={campo} /></label>
              <label className="block sm:col-span-2 text-[13px] font-semibold">Regra curta (opcional)<input value={form.regra} onChange={(e) => setForm({ ...form, regra: e.target.value.slice(0, 120) })} placeholder="Ex.: compras acima de R$ 30" className={campo} /></label>
              <label className="block text-[13px] font-semibold">Vale até<input type="date" value={form.validade} min={hojeBR()} onChange={(e) => setForm({ ...form, validade: e.target.value })} className={campo} /></label>
              <label className="block text-[13px] font-semibold">Limite de cupons (opcional)<input inputMode="numeric" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="Sem limite" className={campo} /></label>
            </div>
            {erro && <p className="mt-2 text-[14px] font-semibold text-[#B42318]">{erro}</p>}
            <button type="button" onClick={criar} disabled={ocupado || ativos.length >= 3} className="btn btn-azul mt-3 !py-2">Criar cupom</button>
          </div>
        </section>
      )}
      {dados.temLoja && dados.daLoja.length > 0 && (
        <section className="faixa mt-6">
          <h2 className="!text-[1.3rem]">Cupons da sua loja</h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 [&>*]:min-w-0">
            {dados.daLoja.map((c) => (
              <li key={c.id} className={`rounded-2xl border border-dashed p-4 ${c.ativo && !c.vencido ? "border-[#E11D48]/50 bg-[#FFF5F7]" : "border-[var(--linha)] bg-[var(--cinza)] opacity-70"}`}>
                <b className="text-[17px] text-[#9F1239]">{c.titulo}</b>
                <p className="text-[13px] text-[var(--tinta-2)]">{c.regra ? `${c.regra} · ` : ""}até {dataBR(c.validade)}{c.limite != null ? ` · limite ${c.limite}` : ""}</p>
                <p className="mt-2 text-[14px]"><b>{c.pegos}</b> pego{c.pegos === 1 ? "" : "s"} · <b>{c.usados}</b> usado{c.usados === 1 ? "" : "s"}</p>
                <p className="mt-1 text-[12px] font-semibold text-[var(--tinta-2)]">{!c.ativo ? "Encerrado" : c.vencido ? "Vencido" : "Ativo"}</p>
                {c.ativo && !c.vencido && <button type="button" onClick={() => encerrar(c.id)} className="mt-2 text-[13px] font-semibold text-[#B42318] hover:underline">Encerrar cupom</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="faixa mt-8">
        <h2 className="!text-[1.3rem]">Meus cupons</h2>
        {dados.meus.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 [&>*]:min-w-0">
            {dados.meus.map((m) => (
              <li key={m.codigo} className={`rounded-2xl border p-4 ${m.usado || m.vencido ? "border-[var(--linha)] opacity-60" : "border-[#E11D48]/40 bg-[#FFF5F7]"}`}>
                <div className="text-[13px] text-[var(--tinta-2)]">{m.numero ? <a href={`/loja/${m.numero}`} className="font-semibold text-[var(--azul)] hover:underline">{m.empresa}</a> : m.empresa}</div>
                <b className="text-[16px] text-[#9F1239]">{m.titulo}</b>
                <div className="mt-1 font-mono text-[19px] tracking-widest">{m.codigo}</div>
                <div className="text-[12px] text-[var(--tinta-2)]">{m.usado ? "Usado ✓" : m.vencido ? `Venceu em ${dataBR(m.validade)}` : `Vale até ${dataBR(m.validade)}`}{m.regra ? ` · ${m.regra}` : ""}</div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[var(--tinta-2)]">Você ainda não pegou nenhum cupom. Procure o selo 🎟️ nas lojas do mapa.</p>}
      </section>
    </>
  );
}
