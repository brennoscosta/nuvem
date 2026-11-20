"use client";
// Admin: os cadastros (20/11/2026, frente "cadastro"). O que cada conta contou ao WorkEnd no formulário depois de criar a
// conta: objetivo, tipo, área, cidade, o que oferece e o que procura, e a data. Filtros e planilha CSV (/api/admin/cadastros).
import { useEffect, useMemo, useState } from "react";
import { NICHOS } from "@/office/data/mundo";
import { OBJETIVOS, TIPOS, UFS, ETAPAS, nomeObjetivo, nomeTipo, nomeAtendimento } from "@/office/data/cadastro";
import { Icone } from "@/office/ui/Icone";
import type { LinhaCadastro, Situacao } from "@/server/perfis";

const SITUACOES: { id: Situacao; nome: string }[] = [
  { id: "completo", nome: "Completo" }, { id: "parcial", nome: "Em andamento" }, { id: "pulou", nome: "Deixou para depois" }, { id: "sem", nome: "Não respondeu" },
];
const COR: Record<Situacao, string> = { completo: "bg-[#E3F6EA] text-[#1B8A4C]", parcial: "bg-[#E3ECFA] text-[#0453CC]", pulou: "bg-[#FFF4D6] text-[#7A5A00]", sem: "bg-[var(--cinza)] text-[var(--tinta-2)]" };
const nomeNicho = (id: string) => NICHOS.find((n) => n.id === id)?.nome ?? id;
const dataBR = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
type Filtros = { q: string; objetivo: string; tipo: string; nicho: string; uf: string; situacao: string; de: string; ate: string };
const VAZIO: Filtros = { q: "", objetivo: "", tipo: "", nicho: "", uf: "", situacao: "", de: "", ate: "" };

function Etiquetas({ lista, texto, proc = false }: { lista: string[]; texto: string; proc?: boolean }) {
  if (!lista.length && !texto) return <span className="text-[var(--tinta-2)]">—</span>;
  return (
    <div className="min-w-[180px] max-w-[260px]">
      {lista.length > 0 && <div className="flex flex-wrap gap-1">{lista.slice(0, 6).map((t) => <span key={t} className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${proc ? "text-[#0453CC] shadow-[inset_0_0_0_1px_#A9C6F5]" : "bg-[#E3ECFA] text-[#0453CC]"}`}>{t}</span>)}</div>}
      {texto && <p className="mt-1 line-clamp-2 text-[12px] text-[var(--tinta-2)]" title={texto}>{texto}</p>}
    </div>
  );
}

export function CadastrosAdmin() {
  const [f, setF] = useState<Filtros>(VAZIO);
  const [termo, setTermo] = useState("");
  useEffect(() => { const t = setTimeout(() => setTermo(f.q), 300); return () => clearTimeout(t); }, [f.q]);
  const params = useMemo(() => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ ...f, q: termo })) if (v) p.set(k, v); return p.toString(); }, [f, termo]);
  const [resDe, setResDe] = useState<{ de: string; lista: LinhaCadastro[] | null; erro?: string } | null>(null);
  const lista = resDe?.de === params ? resDe.lista : null;
  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/cadastros?${params}`, { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!vivo) return; if (!r.ok) setResDe({ de: params, lista: [], erro: j.erro ?? `Erro ${r.status}` }); else setResDe({ de: params, lista: j }); }).catch((e) => vivo && setResDe({ de: params, lista: [], erro: (e as Error).message }));
    return () => { vivo = false; };
  }, [params]);
  const set = (k: keyof Filtros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const conta = useMemo(() => {
    const l = lista ?? [];
    return { total: l.length, completo: l.filter((r) => r.situacao === "completo").length, mostrar: l.filter((r) => r.objetivo === "mostrar").length, encontrar: l.filter((r) => r.objetivo === "encontrar").length, ambos: l.filter((r) => r.objetivo === "ambos").length, pulou: l.filter((r) => r.situacao === "pulou" || r.situacao === "sem").length };
  }, [lista]);
  const filtrando = Object.values(f).some(Boolean);
  const sel = "rounded-lg border border-[var(--linha)] bg-white px-2.5 py-2 text-[14px]";

  return (
    <section className="faixa mt-12" id="cadastros" data-teste="admin-cadastros">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.4rem]">Cadastros</h2>
          <p className="mt-1 max-w-[72ch] text-sm text-[var(--tinta-2)]">O que cada conta contou ao WorkEnd no formulário depois de criar a conta: se quer mostrar o negócio ou encontrar empresas, quem é, a área, a cidade, o que oferece e o que procura. Os contatos aparecem só aqui e no CSV, para a equipe.</p>
        </div>
        <a href={`/api/admin/cadastros?${params}${params ? "&" : ""}formato=csv`} download className="btn btn-linha !py-2.5 text-sm" data-teste="csv"><Icone nome="baixar" tamanho={17} />Baixar CSV{filtrando ? " (filtrado)" : ""}</a>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span><b className="text-[1.1rem]">{lista ? conta.total : "…"}</b> {conta.total === 1 ? "conta" : "contas"}</span>
        <span><b>{conta.completo}</b> com perfil completo</span>
        <span><b>{conta.mostrar}</b> querem mostrar</span>
        <span><b>{conta.encontrar}</b> querem encontrar</span>
        <span><b>{conta.ambos}</b> os dois</span>
        <span className="text-[var(--tinta-2)]"><b>{conta.pulou}</b> sem responder ou para depois</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--linha)] bg-white px-3 py-2"><Icone nome="encontrar" tamanho={16} /><span className="sr-only">Buscar</span><input value={f.q} onChange={set("q")} placeholder="Nome, e-mail, cidade, o que oferece ou procura" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" /></label>
        <select aria-label="Objetivo" value={f.objetivo} onChange={set("objetivo")} className={sel}><option value="">Todo objetivo</option>{OBJETIVOS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select aria-label="Tipo" value={f.tipo} onChange={set("tipo")} className={sel}><option value="">Todo tipo</option>{TIPOS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>
        <select aria-label="Área" value={f.nicho} onChange={set("nicho")} className={sel}><option value="">Toda área</option>{NICHOS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</select>
        <select aria-label="Estado" value={f.uf} onChange={set("uf")} className={sel}><option value="">Todo estado</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <select aria-label="Situação" value={f.situacao} onChange={set("situacao")} className={sel}><option value="">Toda situação</option>{SITUACOES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        <label className="flex items-center gap-1.5 text-sm text-[var(--tinta-2)]">de<input type="date" value={f.de} onChange={set("de")} className={sel} /></label>
        <label className="flex items-center gap-1.5 text-sm text-[var(--tinta-2)]">até<input type="date" value={f.ate} onChange={set("ate")} className={sel} /></label>
        {filtrando && <button type="button" onClick={() => setF(VAZIO)} className="px-2 text-sm font-semibold text-[var(--azul)]">Limpar</button>}
      </div>
      {resDe?.erro && <div className="mt-3 rounded-xl bg-[#FDE8E8] px-3 py-2 text-sm text-[#8A2A2A]">{resDe.erro}</div>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase tracking-wide text-[var(--tinta-2)]">
            <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Conta</th><th className="px-3 py-2">Objetivo e tipo</th><th className="px-3 py-2">Negócio e área</th><th className="px-3 py-2">Cidade</th><th className="px-3 py-2">Oferece</th><th className="px-3 py-2">Procura</th><th className="px-3 py-2">Situação</th></tr>
          </thead>
          <tbody>
            {lista === null && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--tinta-2)]">Carregando…</td></tr>}
            {lista?.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--tinta-2)]">{filtrando ? "Nenhum cadastro com esses filtros." : "Nenhuma conta ainda."}</td></tr>}
            {lista?.map((r) => (
              <tr key={r.usuarioId} className="border-t border-[var(--linha)] align-top" data-email={r.email}>
                <td className="whitespace-nowrap px-3 py-2.5 text-[var(--tinta-2)]">{dataBR(r.criadoEm)}</td>
                <td className="px-3 py-2.5"><b className="block max-w-[200px] truncate">{r.nomeConta}</b><span className="block max-w-[220px] truncate text-xs text-[var(--tinta-2)]">{r.email}</span>{r.whatsapp && <span className="block text-xs text-[var(--tinta-2)]">WhatsApp {r.whatsapp}</span>}</td>
                <td className="px-3 py-2.5">{r.objetivo ? <b className="block">{nomeObjetivo(r.objetivo)}</b> : <span className="text-[var(--tinta-2)]">—</span>}{r.tipo && <span className="block text-xs text-[var(--tinta-2)]">{nomeTipo(r.tipo)}</span>}</td>
                <td className="px-3 py-2.5">{r.nome ? <span className="block max-w-[200px] truncate font-semibold">{r.nome}</span> : <span className="text-[var(--tinta-2)]">—</span>}{r.nichos.length > 0 && <span className="block text-xs text-[var(--tinta-2)]">{r.nichos.map(nomeNicho).join(", ")}</span>}{r.lote != null && <span className="block text-xs text-[var(--tinta-2)]">Lote {r.lote}</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{[r.cidade, r.uf].filter(Boolean).join(" / ") || <span className="text-[var(--tinta-2)]">—</span>}{r.atendimento && <span className="block text-xs text-[var(--tinta-2)]">{nomeAtendimento(r.atendimento)}</span>}</td>
                <td className="px-3 py-2.5"><Etiquetas lista={r.oferece} texto={r.ofereceTexto} /></td>
                <td className="px-3 py-2.5"><Etiquetas lista={r.procura} texto={r.procuraTexto} proc /></td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COR[r.situacao]}`}>{SITUACOES.find((s) => s.id === r.situacao)?.nome}</span><span className="mt-1 block text-xs text-[var(--tinta-2)]">{r.etapas}/{ETAPAS.length} etapas</span>{r.apelido && r.publico && r.situacao !== "sem" && <a href={`/perfil/${r.apelido}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-semibold text-[var(--azul)] hover:underline">ver perfil</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista && lista.length >= 2000 && <p className="mt-2 text-xs text-[var(--tinta-2)]">Mostrando os 2.000 mais recentes. O CSV leva todos os que passam nos filtros.</p>}
    </section>
  );
}
