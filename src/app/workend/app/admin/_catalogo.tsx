"use client";
// Admin: os agentes que o WorkEnd vende. Cria, treina (o que sabe, skills, APIs ligadas), põe preço e liga/desliga.
// As lojas contratam destes em "Contratar agentes".
import { useCallback, useEffect, useState } from "react";
import { BONECOS } from "@/office/data/bonecos";

interface Agente { id: string; nome: string; cargo: string; setor: string; descricao: string; saudacao: string; skills: string[]; apis: string[]; preco: number; boneco: string; camisa: string; ativo: boolean; ordem: number }
interface Api { id: string; nome: string; desc: string }
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CORES = ["#1D4ED8", "#0EA5A4", "#16A34A", "#D97706", "#DC2626", "#DB2777", "#7C3AED", "#1F2937", "#374151"];
const vazio = (): Agente => ({ id: "", nome: "", cargo: "", setor: "Atendimento", descricao: "", saudacao: "", skills: [], apis: ["chatgpt_texto"], preco: 0, boneco: "classico", camisa: "#1D4ED8", ativo: true, ordem: 0 });

export function CatalogoAdmin() {
  const [agentes, setAgentes] = useState<Agente[] | null>(null);
  const [apis, setApis] = useState<Api[]>([]);
  const [edit, setEdit] = useState<Agente | null>(null);
  const [skillNova, setSkillNova] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await fetch("/api/admin/catalogo"); if (r.ok) { const j = await r.json(); setAgentes(j.agentes); setApis(j.apis); } }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);
  const post = async (body: unknown) => { const r = await fetch("/api/admin/catalogo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`); return j; };
  const salvar = async () => { if (!edit) return; try { await post(edit); setEdit(null); setAviso("Agente salvo."); await carregar(); } catch (e) { setAviso((e as Error).message); } };
  const apagar = async (a: Agente) => { if (!window.confirm(`Apagar "${a.cargo} · ${a.nome}" do catálogo?`)) return; await post({ acao: "apagar", id: a.id }); await carregar(); };
  const semear = async () => { await post({ acao: "semear" }); await carregar(); setAviso("Os 8 agentes de exemplo foram copiados pro catálogo: edite e treine cada um."); };
  const m = (p: Partial<Agente>) => setEdit((e) => (e ? { ...e, ...p } : e));
  return (
    <section className="faixa mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[1.4rem]">Agentes à venda</h2><p className="mt-1 max-w-[70ch] text-sm text-[var(--tinta-2)]">Os profissionais prontos que o WorkEnd vende pras lojas. Você cria cada um, dá o treino (o que sabe e faz), as skills e as APIs que ele usa, e o preço. Quem tem loja contrata em “Contratar agentes”.</p></div>
        <div className="flex gap-2">{agentes && agentes.length === 0 && <button onClick={semear} className="btn btn-linha">Importar os 8 de exemplo</button>}<button onClick={() => setEdit(vazio())} className="btn btn-azul">+ Novo agente</button></div>
      </div>
      {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}
      {edit && (
        <div className="mt-4 rounded-2xl border border-[var(--linha)] p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="campo">Cargo (o que aparece na loja)<input value={edit.cargo} onChange={(e) => m({ cargo: e.target.value })} placeholder="Ex.: Vendedor" /></label>
            <label className="campo">Nome do boneco<input value={edit.nome} onChange={(e) => m({ nome: e.target.value })} placeholder="Ex.: Rodrigo" /></label>
            <label className="campo">Setor sugerido<input value={edit.setor} onChange={(e) => m({ setor: e.target.value })} placeholder="Ex.: Vendas" /></label>
          </div>
          <label className="campo mt-3">Treino — o que ele sabe e faz (a base de como vai atender e trabalhar)<textarea rows={5} value={edit.descricao} onChange={(e) => m({ descricao: e.target.value })} placeholder="Ex.: Apresenta produtos, entende a necessidade do cliente, monta orçamento, fecha a venda e anota o contato. Nunca inventa preço: pergunta ao dono quando não sabe." /></label>
          <label className="campo mt-3">Frase de boas-vindas<input value={edit.saudacao} onChange={(e) => m({ saudacao: e.target.value })} placeholder="Ex.: Oi! Me conta o que você procura." /></label>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold">Skills</div>
              <div className="mt-1 flex flex-wrap gap-1.5">{edit.skills.map((k) => <span key={k} className="flex items-center gap-1 rounded-full bg-[var(--azul-claro)] px-2.5 py-1 text-xs text-[var(--azul)]">{k}<button onClick={() => m({ skills: edit.skills.filter((x) => x !== k) })}>✕</button></span>)}</div>
              <div className="mt-2 flex gap-2"><input value={skillNova} onChange={(e) => setSkillNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && skillNova.trim()) { m({ skills: [...edit.skills, skillNova.trim()] }); setSkillNova(""); } }} placeholder="Ex.: fechar vendas, montar orçamento" className="flex-1 rounded-xl border border-[var(--linha)] px-3 py-2 text-sm" /><button onClick={() => { if (skillNova.trim()) { m({ skills: [...edit.skills, skillNova.trim()] }); setSkillNova(""); } }} className="btn btn-linha">Adicionar</button></div>
            </div>
            <div>
              <div className="text-sm font-semibold">APIs ligadas</div>
              <div className="mt-1 grid gap-1.5">{apis.map((a) => <label key={a.id} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={edit.apis.includes(a.id)} onChange={(e) => m({ apis: e.target.checked ? [...edit.apis, a.id] : edit.apis.filter((x) => x !== a.id) })} className="mt-1" /><span><b>{a.nome}</b> <span className="text-[var(--tinta-2)]">— {a.desc}</span></span></label>)}</div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="campo">Preço (R$/mês, 0 = incluso)<input type="number" min={0} step={0.1} value={edit.preco} onChange={(e) => m({ preco: Number(e.target.value) })} /></label>
            <label className="campo">Ordem<input type="number" value={edit.ordem} onChange={(e) => m({ ordem: Number(e.target.value) })} /></label>
            <div><div className="text-sm font-semibold">Boneco</div><div className="mt-1 flex flex-wrap gap-1">{BONECOS.map((b) => <button key={b.id} onClick={() => m({ boneco: b.id })} title={b.nome} className={`h-8 w-8 rounded-full border-2 ${edit.boneco === b.id ? "border-[var(--azul)]" : "border-transparent"}`} style={{ background: b.pele }} />)}</div></div>
            <div><div className="text-sm font-semibold">Camisa</div><div className="mt-1 flex flex-wrap gap-1">{CORES.map((c) => <button key={c} onClick={() => m({ camisa: c })} className={`h-6 w-6 rounded-full border ${edit.camisa === c ? "border-black" : "border-black/10"}`} style={{ background: c }} />)}</div></div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.ativo} onChange={(e) => m({ ativo: e.target.checked })} /> À venda (aparece pras lojas)</label>
          <div className="mt-4 flex gap-2"><button onClick={salvar} className="btn btn-azul">Salvar agente</button><button onClick={() => setEdit(null)} className="btn btn-linha">Cancelar</button></div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Agente</th><th className="p-3">Treino</th><th className="p-3">Skills / APIs</th><th className="p-3">Preço</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>
            {agentes === null && <tr><td colSpan={6} className="p-4 text-[var(--tinta-2)]">Carregando…</td></tr>}
            {agentes && agentes.length === 0 && <tr><td colSpan={6} className="p-4 text-[var(--tinta-2)]">Nenhum agente cadastrado ainda. Enquanto isso as lojas veem os 8 de exemplo do código. Clique em “Importar os 8 de exemplo” pra começar a treinar os seus.</td></tr>}
            {agentes?.map((a) => (
              <tr key={a.id} className="border-t border-[var(--linha)] align-top">
                <td className="p-3"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: a.camisa }} /><b>{a.cargo}</b><div className="text-xs text-[var(--tinta-2)]">{a.nome} · {a.setor}</div></td>
                <td className="max-w-[36ch] p-3 text-xs text-[var(--tinta-2)]">{a.descricao.slice(0, 140)}{a.descricao.length > 140 && "…"}</td>
                <td className="p-3 text-xs"><div className="flex flex-wrap gap-1">{a.skills.map((k) => <span key={k} className="rounded bg-[var(--azul-claro)] px-1.5 py-0.5 text-[var(--azul)]">{k}</span>)}{a.apis.map((x) => <span key={x} className="rounded bg-[#E3F6EA] px-1.5 py-0.5 text-[#166534]">{x.replace("_", " ")}</span>)}</div></td>
                <td className="p-3">{a.preco > 0 ? `${brl(a.preco)}/mês` : "Incluso"}</td>
                <td className="p-3">{a.ativo ? <span className="rounded-full bg-[#E3F6EA] px-2 py-0.5 text-xs font-semibold text-[#1B8A4C]">à venda</span> : <span className="rounded-full bg-[var(--cinza)] px-2 py-0.5 text-xs">pausado</span>}</td>
                <td className="p-3 text-right"><button onClick={() => setEdit(a)} className="mr-1 rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Editar / treinar</button><button onClick={() => apagar(a)} className="rounded-lg border border-[#FDE8E8] px-2 py-1 text-xs text-[#8A2A2A]">Apagar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Atividade do mundo: tudo que acontece (cadastros, reservas, pagamentos, escritórios, contratações, trocas de prédio)
interface Evento { id: string; tipo: string; usuarioId: string | null; terrenoChave: string | null; titulo: string; dados: { detalhes?: string } | null; criadoEm: string; email: string | null; empresaNome: string | null }
const TIPOS: [string, string][] = [["", "Tudo"], ["cadastro", "Cadastros"], ["reserva", "Reservas"], ["pagamento", "Pagamentos"], ["escritorio", "Escritórios"], ["contratacao", "Contratações"], ["layout", "Trocas de prédio"], ["contato", "Contatos"]];
export function AtividadeAdmin() {
  const [tipo, setTipo] = useState("");
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  useEffect(() => { const c = new AbortController(); fetch(`/api/admin/eventos${tipo ? `?tipo=${tipo}` : ""}`, { signal: c.signal }).then((r) => r.json()).then((j) => setEventos(j.eventos ?? [])).catch(() => {}); return () => c.abort(); }, [tipo]);
  const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="faixa mt-12">
      <h2 className="text-[1.4rem]">Atividade do mundo</h2>
      <p className="mt-1 text-sm text-[var(--tinta-2)]">Tudo que acontece: quem se cadastrou, quem reservou e pagou chão, escritórios montados, contratações, trocas de prédio. O dono de cada loja recebe por e-mail o que é da loja dele (modelo “Atividade na sua loja”).</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{TIPOS.map(([k, t]) => <button key={k} onClick={() => setTipo(k)} className={`rounded-full border px-3 py-1 text-xs ${tipo === k ? "border-[var(--azul)] bg-[var(--azul-claro)] text-[var(--azul)]" : "border-[var(--linha)]"}`}>{t}</button>)}</div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--linha)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase text-[var(--tinta-2)]"><tr><th className="p-3">Quando</th><th className="p-3">Tipo</th><th className="p-3">O que</th><th className="p-3">Quem</th><th className="p-3">Loja</th></tr></thead>
          <tbody>
            {eventos === null && <tr><td colSpan={5} className="p-4 text-[var(--tinta-2)]">Carregando…</td></tr>}
            {eventos && eventos.length === 0 && <tr><td colSpan={5} className="p-4 text-[var(--tinta-2)]">Nada registrado ainda.</td></tr>}
            {eventos?.map((e) => (
              <tr key={e.id} className="border-t border-[var(--linha)] align-top">
                <td className="whitespace-nowrap p-3">{dt(e.criadoEm)}</td>
                <td className="p-3"><span className="rounded-full bg-[var(--cinza)] px-2 py-0.5 text-xs">{e.tipo}</span></td>
                <td className="p-3"><b>{e.titulo}</b>{e.dados?.detalhes && <div className="text-xs text-[var(--tinta-2)]">{e.dados.detalhes}</div>}</td>
                <td className="p-3 text-xs">{e.email ?? "—"}</td>
                <td className="p-3 text-xs">{e.terrenoChave ? <a href={`/mundo?lote=${encodeURIComponent(e.terrenoChave)}`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--azul)]">{e.empresaNome ?? e.terrenoChave} ↗</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
