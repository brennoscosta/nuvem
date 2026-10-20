"use client";
// Painel completo do agente: Perfil · Conhecimento · Skills · Regras · Conversar (treinar).
import { useCallback, useEffect, useRef, useState } from "react";
import { AREAS, AREAS_OPERACIONAIS, FUNCOES, NIVEIS, NIVEL, PERSONALIDADES, type AreaId, type Nivel } from "../data/org";
import { BONECOS } from "../data/bonecos";
import { SALA } from "../data/layout";
import { useEscritorio, type Status } from "../store";
import { SKILLS_PRONTAS } from "../data/skillsProntas";
import { AbaTarefas } from "./AbaTarefas";

export const STATUS: Record<Status, { nome: string; cor: string }> = {
  chegando: { nome: "Chegando", cor: "#9AA3AD" }, disponivel: { nome: "Disponível", cor: "#3FBFA8" }, trabalhando: { nome: "Trabalhando", cor: "#4F7DF3" },
  planejando: { nome: "Planejando", cor: "#8B6CF0" }, em_revisao: { nome: "Em revisão", cor: "#F2913D" }, bloqueado: { nome: "Bloqueado", cor: "#E2575B" },
  reuniao: { nome: "Em reunião", cor: "#D9A23A" }, pausa: { nome: "Pausa", cor: "#9AA3AD" }, fora: { nome: "Fora", cor: "#6B7280" }, comemorando: { nome: "Comemorando", cor: "#22A86B" },
};

interface Conhecimento { id: string; titulo: string; conteudo: string; origem: string; ativo: boolean }
interface Skill { id: string; nome: string; quandoUsar: string; passos: string; ativo: boolean; ordem: number }
interface Regra { id: string; texto: string; ativo: boolean; criadoEm: string }
interface Mensagem { id: string; papel: string; conteudo: string; avaliacao: number | null; correcao: string | null; custoBrl: string; criadoEm: string }
interface Ficha {
  agente: { id: string; nome: string; area: AreaId; nivel: Nivel; funcao: string; personalidade: string; tomDeVoz: string; descricao: string; modelo: string; boneco: string; chefeId: string | null; mesaId?: string | null; tetoDiarioBrl: string; config?: { aoConcluir?: { encaminharPara?: string | null } } };
  conhecimentos: Conhecimento[]; skills: Skill[]; regras: Regra[];
  empresa: { id: string; nome: string; sobre: string };
  chefe: { id: string; nome: string; nivel: Nivel } | null;
  subordinados: { id: string; nome: string; nivel: Nivel; funcao: string }[];
}

const MODELOS = ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5", "gpt-5-mini", "gpt-5-nano", "o4-mini"];
const api = async (url: string, method = "GET", body?: unknown) => {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
};

type Aba = "perfil" | "conhecimento" | "skills" | "regras" | "conversar" | "tarefas";

export function PainelAgente() {
  const id = useEscritorio((s) => s.selecionado);
  const a = useEscritorio((s) => (id ? s.agentes[id] : undefined));
  const online = useEscritorio((s) => s.online);
  const selecionar = useEscritorio((s) => s.selecionar);
  const [aba, setAba] = useState<Aba>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("conexao")) ? "tarefas" : "conversar");
  const abaPedida = useEscritorio((s) => s.abaPedida);
  const setAbaPedida = useEscritorio((s) => s.setAbaPedida);
  useEffect(() => { if (abaPedida) { setAba(abaPedida as Aba); setAbaPedida(null); } }, [abaPedida, setAbaPedida]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => { if (!id) return; try { setFicha(await api(`/api/agentes/${id}`)); setErro(null); } catch (e) { setErro((e as Error).message); } }, [id]);
  useEffect(() => { setFicha(null); if (id && a?.real) carregar(); }, [id, a?.real, carregar]);
  if (!a) return null;
  const st = STATUS[a.status]; const nv = NIVEL[a.nivel]; const area = AREAS[a.area];
  const abas: { id: Aba; nome: string }[] = [{ id: "conversar", nome: "Conversar" }, { id: "tarefas", nome: "Tarefas" }, { id: "perfil", nome: "Perfil" }, { id: "conhecimento", nome: "Conhecimento" }, { id: "skills", nome: "Skills" }, { id: "regras", nome: "Regras" }];
  return (
    <div className="absolute right-3 top-20 bottom-3 z-10 flex w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl bg-white/97 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: nv.cor }} /><span className="text-lg font-bold">{a.nome}</span></div>
          <div className="text-xs text-[#5B6472]">{nv.nome} · {a.funcao} · {area.nome} · {SALA[a.sala]?.nome}</div>
          <div className="mt-1 flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: st.cor }} />{st.nome}{a.fala ? <span className="text-[#5B6472]">· “{a.fala}”</span> : null}</div>
        </div>
        <button onClick={() => selecionar(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      {!a.real && <div className="mx-4 mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Agente simulado (sem banco). Os agentes reais ficam disponíveis quando o servidor está com banco e IA configurados.</div>}
      {a.real && !online && <div className="mx-4 mt-3 rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">Servidor sem banco no momento.</div>}
      {a.real && (
        <div className="mt-3 flex gap-1 border-b border-black/5 px-3">
          {abas.map((t) => <button key={t.id} onClick={() => setAba(t.id)} className={`px-3 py-2 text-xs font-semibold ${aba === t.id ? "border-b-2 border-[#4F7DF3] text-[#4F7DF3]" : "text-[#5B6472]"}`}>{t.nome}{t.id === "skills" && ficha ? ` (${ficha.skills.filter((s) => s.ativo).length})` : ""}{t.id === "regras" && ficha ? ` (${ficha.regras.filter((r) => r.ativo).length})` : ""}</button>)}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {erro && <div className="mb-2 rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}
        {a.real && !ficha && !erro && <div className="text-xs text-[#5B6472]">Carregando ficha…</div>}
        {a.real && ficha && aba === "perfil" && <AbaPerfil ficha={ficha} recarregar={carregar} />}
        {a.real && ficha && aba === "conhecimento" && <AbaConhecimento ficha={ficha} recarregar={carregar} />}
        {a.real && ficha && aba === "skills" && <AbaSkills ficha={ficha} recarregar={carregar} />}
        {a.real && ficha && aba === "regras" && <AbaRegras ficha={ficha} recarregar={carregar} />}
        {a.real && ficha && aba === "conversar" && <AbaConversar ficha={ficha} recarregar={carregar} />}
        {a.real && ficha && aba === "tarefas" && <AbaTarefas agenteId={ficha.agente.id} nomeAgente={ficha.agente.nome} area={ficha.agente.area} nivel={ficha.agente.nivel} config={ficha.agente.config} recarregarFicha={carregar} />}
        {!a.real && <FichaSimulada />}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs"><span className="font-semibold text-[#5B6472]">{label}</span>{children}</label>;
}
const inp = "rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#4F7DF3]";

function AbaPerfil({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const ag = ficha.agente;
  const [f, setF] = useState({ nome: ag.nome, area: ag.area, nivel: ag.nivel, funcao: ag.funcao, personalidade: ag.personalidade, tomDeVoz: ag.tomDeVoz, descricao: ag.descricao, modelo: ag.modelo, boneco: ag.boneco, tetoDiarioBrl: Number(ag.tetoDiarioBrl) });
  const [salvando, setSalvando] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const atualizarLocal = useEscritorio((s) => s.atualizarLocal);
  const carregarDoServidor = useEscritorio((s) => s.carregarDoServidor);
  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      const novo = await api(`/api/agentes/${ag.id}`, "PATCH", f);
      atualizarLocal(ag.id, { nome: f.nome, funcao: f.funcao, personalidade: f.personalidade, boneco: f.boneco });
      // área/cargo/mesa vêm do servidor (ele escolhe a mesa na sala certa); recarregar a cena faz o boneco andar até lá
      await carregarDoServidor(); await recarregar();
      setF((x) => ({ ...x, area: novo.area ?? x.area, nivel: novo.nivel ?? x.nivel }));
      setMsg(novo.area !== ag.area || novo.mesaId !== ficha.agente.mesaId ? "Salvo. Mudou de sala — indo pra mesa nova." : "Salvo.");
    }
    catch (e) { setMsg((e as Error).message); } finally { setSalvando(false); }
  };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nome"><input className={inp} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Função"><input className={inp} value={f.funcao} onChange={(e) => set("funcao", e.target.value)} list="funcoes" /><datalist id="funcoes">{(FUNCOES[f.area] ?? []).map((x) => <option key={x} value={x} />)}</datalist></Campo>
        <Campo label="Área"><select className={inp} value={f.area} disabled={f.nivel === "ceo"} onChange={(e) => set("area", e.target.value as AreaId)}>{(f.nivel === "ceo" ? (["diretoria"] as AreaId[]) : AREAS_OPERACIONAIS).map((x) => <option key={x} value={x}>{AREAS[x].nome}</option>)}</select></Campo>
        <Campo label="Cargo"><select className={inp} value={f.nivel} onChange={(e) => { const n = e.target.value as Nivel; setF((x) => ({ ...x, nivel: n, area: n === "ceo" ? "diretoria" : x.area === "diretoria" ? "planejamento" : x.area })); }}>{NIVEIS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</select></Campo>
        <Campo label="Modelo de IA"><select className={inp} value={f.modelo} onChange={(e) => set("modelo", e.target.value)}>{MODELOS.map((m) => <option key={m}>{m}</option>)}</select></Campo>
        <Campo label="Teto de gasto por dia (R$)"><input type="number" min={1} step={1} className={inp} value={f.tetoDiarioBrl} onChange={(e) => set("tetoDiarioBrl", Number(e.target.value))} /></Campo>
      </div>
      <Campo label="Personalidade"><input className={inp} value={f.personalidade} onChange={(e) => set("personalidade", e.target.value)} placeholder="ex.: hiperfocado, determinado, respeitoso, se iguala à equipe, gosta de tudo pronto e organizado" list="pers" /><datalist id="pers">{PERSONALIDADES.map((x) => <option key={x} value={x} />)}</datalist></Campo>
      <Campo label="Tom de voz"><input className={inp} value={f.tomDeVoz} onChange={(e) => set("tomDeVoz", e.target.value)} placeholder="ex.: direto, caloroso, sem formalidade excessiva" /></Campo>
      <Campo label="Quem é (identidade livre)"><textarea className={inp + " min-h-[110px]"} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Como pensa, como trata as pessoas, o que valoriza, o que não aceita..." /></Campo>
      <Campo label="Boneco"><div className="flex flex-wrap gap-1.5">{BONECOS.map((b) => <button key={b.id} onClick={() => set("boneco", b.id)} className={`rounded-full border px-2.5 py-1 text-xs ${f.boneco === b.id ? "border-[#4F7DF3] bg-[#4F7DF3]/10" : "border-black/10"}`}>{b.nome}</button>)}</div></Campo>
      <div className="text-xs text-[#5B6472]">Responde a: <b>{ficha.chefe ? `${ficha.chefe.nome} (${NIVEL[ficha.chefe.nivel].nome})` : ag.nivel === "ceo" ? "você (dono)" : "você"}</b>{ficha.subordinados.length ? <> · Time: {ficha.subordinados.map((s) => s.nome).join(", ")}</> : null}</div>
      <div className="flex items-center gap-2"><button onClick={salvar} disabled={salvando} className="rounded-xl bg-[#4F7DF3] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando ? "Salvando…" : "Salvar perfil"}</button>{msg && <span className="text-xs text-[#5B6472]">{msg}</span>}</div>
      <EmpresaSobre ficha={ficha} recarregar={recarregar} />
    </div>
  );
}

function EmpresaSobre({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const [sobre, setSobre] = useState(ficha.empresa.sobre); const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-2 rounded-xl border border-black/10 p-3">
      <div className="text-xs font-bold">Sobre a empresa ({ficha.empresa.nome})</div>
      <div className="mb-2 text-[11px] text-[#5B6472]">Conhecimento compartilhado por todos os agentes: o que a empresa é, vende, clientes, metas.</div>
      <textarea className={inp + " min-h-[90px] w-full"} value={sobre} onChange={(e) => setSobre(e.target.value)} />
      <div className="mt-2 flex items-center gap-2"><button onClick={async () => { try { await api("/api/empresa", "PATCH", { sobre }); await recarregar(); setMsg("Salvo."); } catch (e) { setMsg((e as Error).message); } }} className="rounded-xl bg-[#1D2128] px-3 py-1.5 text-xs font-bold text-white">Salvar</button>{msg && <span className="text-xs text-[#5B6472]">{msg}</span>}</div>
    </div>
  );
}

function AbaConhecimento({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const [edit, setEdit] = useState<Partial<Conhecimento> | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const salvar = async () => { if (!edit?.titulo || !edit.conteudo) return; try { await api(`/api/agentes/${ficha.agente.id}/conhecimento`, "POST", edit); setEdit(null); await recarregar(); } catch (e) { setMsg((e as Error).message); } };
  const remover = async (cid: string) => { await api(`/api/agentes/${ficha.agente.id}/conhecimento`, "DELETE", { itemId: cid }); await recarregar(); };
  const alternar = async (c: Conhecimento) => { await api(`/api/agentes/${ficha.agente.id}/conhecimento`, "POST", { ...c, ativo: !c.ativo }); await recarregar(); };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-[#5B6472]">O que este agente sabe (memória de longo prazo). Cada bloco vira parte da mente dele.</div>
      {ficha.conhecimentos.map((c) => (
        <div key={c.id} className={`rounded-xl border border-black/10 p-3 ${c.ativo ? "" : "opacity-50"}`}>
          <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold">{c.titulo}</div><div className="flex gap-1 text-[11px]"><button onClick={() => alternar(c)} className="rounded-full bg-black/5 px-2 py-0.5">{c.ativo ? "Desligar" : "Ligar"}</button><button onClick={() => setEdit(c)} className="rounded-full bg-black/5 px-2 py-0.5">Editar</button><button onClick={() => remover(c.id)} className="rounded-full bg-black/5 px-2 py-0.5 text-[#E2575B]">Excluir</button></div></div>
          <div className="mt-1 whitespace-pre-wrap text-xs text-[#3A3F47]">{c.conteudo.length > 300 ? c.conteudo.slice(0, 300) + "…" : c.conteudo}</div>
        </div>
      ))}
      {edit ? (
        <div className="rounded-xl border border-[#4F7DF3] p-3">
          <input className={inp + " mb-2 w-full"} placeholder="Título (ex.: Produtos da Nuvem)" value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} />
          <textarea className={inp + " min-h-[140px] w-full"} placeholder="Conteúdo" value={edit.conteudo ?? ""} onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} />
          <div className="mt-2 flex gap-2"><button onClick={salvar} className="rounded-xl bg-[#4F7DF3] px-3 py-1.5 text-xs font-bold text-white">Salvar</button><button onClick={() => setEdit(null)} className="rounded-xl px-3 py-1.5 text-xs">Cancelar</button></div>
        </div>
      ) : <button onClick={() => setEdit({})} className="rounded-xl border border-dashed border-black/20 py-2 text-xs font-semibold text-[#4F7DF3]">+ Adicionar conhecimento</button>}
      {msg && <div className="text-xs text-[#E2575B]">{msg}</div>}
    </div>
  );
}

function AbaSkills({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const [edit, setEdit] = useState<Partial<Skill> | null>(null); const [msg, setMsg] = useState<string | null>(null); const [biblioteca, setBiblioteca] = useState(false);
  const base = `/api/agentes/${ficha.agente.id}/skills`;
  const salvar = async (s: Partial<Skill>) => { if (!s.nome || !s.passos) return; try { await api(base, "POST", s); setEdit(null); await recarregar(); } catch (e) { setMsg((e as Error).message); } };
  const remover = async (sid: string) => { await api(base, "DELETE", { itemId: sid }); await recarregar(); };
  const prontas = SKILLS_PRONTAS.filter((p) => p.niveis.includes(ficha.agente.nivel) || p.niveis.includes("todos"));
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-[#5B6472]">Procedimentos que o agente sabe executar: quando usar e o passo a passo. Ele segue isso ao trabalhar.</div>
      {ficha.skills.map((s) => (
        <div key={s.id} className={`rounded-xl border border-black/10 p-3 ${s.ativo ? "" : "opacity-50"}`}>
          <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold">{s.nome}</div><div className="flex gap-1 text-[11px]"><button onClick={() => salvar({ ...s, ativo: !s.ativo })} className="rounded-full bg-black/5 px-2 py-0.5">{s.ativo ? "Desligar" : "Ligar"}</button><button onClick={() => setEdit(s)} className="rounded-full bg-black/5 px-2 py-0.5">Editar</button><button onClick={() => remover(s.id)} className="rounded-full bg-black/5 px-2 py-0.5 text-[#E2575B]">Excluir</button></div></div>
          {s.quandoUsar && <div className="mt-1 text-[11px] text-[#5B6472]">Quando usar: {s.quandoUsar}</div>}
          <div className="mt-1 whitespace-pre-wrap text-xs text-[#3A3F47]">{s.passos.length > 260 ? s.passos.slice(0, 260) + "…" : s.passos}</div>
        </div>
      ))}
      {edit ? (
        <div className="rounded-xl border border-[#4F7DF3] p-3">
          <input className={inp + " mb-2 w-full"} placeholder="Nome da skill" value={edit.nome ?? ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
          <input className={inp + " mb-2 w-full"} placeholder="Quando usar" value={edit.quandoUsar ?? ""} onChange={(e) => setEdit({ ...edit, quandoUsar: e.target.value })} />
          <textarea className={inp + " min-h-[160px] w-full"} placeholder={"Passos, um por linha:\n1. ...\n2. ..."} value={edit.passos ?? ""} onChange={(e) => setEdit({ ...edit, passos: e.target.value })} />
          <div className="mt-2 flex gap-2"><button onClick={() => salvar(edit)} className="rounded-xl bg-[#4F7DF3] px-3 py-1.5 text-xs font-bold text-white">Salvar</button><button onClick={() => setEdit(null)} className="rounded-xl px-3 py-1.5 text-xs">Cancelar</button></div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setEdit({})} className="flex-1 rounded-xl border border-dashed border-black/20 py-2 text-xs font-semibold text-[#4F7DF3]">+ Nova skill</button>
          <button onClick={() => setBiblioteca(!biblioteca)} className="flex-1 rounded-xl border border-dashed border-black/20 py-2 text-xs font-semibold text-[#8B6CF0]">Biblioteca ({prontas.length})</button>
        </div>
      )}
      {biblioteca && (
        <div className="rounded-xl bg-[#F4F2FB] p-3">
          <div className="mb-2 text-xs font-bold">Skills prontas pra este cargo</div>
          {prontas.map((p) => { const ja = ficha.skills.some((s) => s.nome === p.nome); return (
            <div key={p.nome} className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-white p-2"><div><div className="text-xs font-bold">{p.nome}</div><div className="text-[11px] text-[#5B6472]">{p.quandoUsar}</div></div><button disabled={ja} onClick={() => salvar({ nome: p.nome, quandoUsar: p.quandoUsar, passos: p.passos })} className="shrink-0 rounded-full bg-[#8B6CF0] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40">{ja ? "Instalada" : "Instalar"}</button></div>); })}
        </div>
      )}
      {msg && <div className="text-xs text-[#E2575B]">{msg}</div>}
    </div>
  );
}

function AbaRegras({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const [novo, setNovo] = useState(""); const base = `/api/agentes/${ficha.agente.id}/regras`;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-[#5B6472]">Regras permanentes. Nascem do treino (correções na conversa) ou você escreve direto. Têm prioridade sobre tudo.</div>
      {ficha.regras.map((r) => (
        <div key={r.id} className={`flex items-start justify-between gap-2 rounded-xl border border-black/10 p-3 ${r.ativo ? "" : "opacity-50"}`}>
          <div className="text-xs">{r.texto}</div>
          <div className="flex shrink-0 gap-1 text-[11px]"><button onClick={async () => { await api(base, "POST", { ...r, ativo: !r.ativo }); await recarregar(); }} className="rounded-full bg-black/5 px-2 py-0.5">{r.ativo ? "Desligar" : "Ligar"}</button><button onClick={async () => { await api(base, "DELETE", { itemId: r.id }); await recarregar(); }} className="rounded-full bg-black/5 px-2 py-0.5 text-[#E2575B]">Excluir</button></div>
        </div>
      ))}
      <div className="flex gap-2"><input className={inp + " flex-1"} placeholder="Nova regra (ex.: Responda em no máximo 5 linhas)" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && novo.trim()) { await api(base, "POST", { texto: novo.trim() }); setNovo(""); await recarregar(); } }} /><button onClick={async () => { if (!novo.trim()) return; await api(base, "POST", { texto: novo.trim() }); setNovo(""); await recarregar(); }} className="rounded-xl bg-[#4F7DF3] px-3 text-xs font-bold text-white">Adicionar</button></div>
    </div>
  );
}

function AbaConversar({ ficha, recarregar }: { ficha: Ficha; recarregar: () => Promise<void> }) {
  const agId = ficha.agente.id;
  const [msgs, setMsgs] = useState<Mensagem[]>([]); const [texto, setTexto] = useState(""); const [enviando, setEnviando] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<string | null>(null); const [correcao, setCorrecao] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const statusIA = useEscritorio((s) => s.statusServidor?.ia);
  const atualizarLocal = useEscritorio((s) => s.atualizarLocal);
  const emitir = useEscritorio((s) => s.emitir);
  const carregar = useCallback(async () => { try { setMsgs(await api(`/api/agentes/${agId}/chat`)); } catch (e) { setErro((e as Error).message); } }, [agId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs.length, enviando]);
  const enviar = async () => {
    const t = texto.trim(); if (!t || enviando) return;
    setTexto(""); setEnviando(true); setErro(null);
    setMsgs((m) => [...m, { id: "tmp", papel: "user", conteudo: t, avaliacao: null, correcao: null, custoBrl: "0", criadoEm: new Date().toISOString() }]);
    emitir(agId, "trabalhando", "Pensando na sua mensagem");
    try {
      const r = await api(`/api/agentes/${agId}/chat`, "POST", { texto: t });
      atualizarLocal(agId, { gastoHoje: Number(r.gastoHoje.toFixed(2)) });
      emitir(agId, "aprovado", "Respondi");
      await carregar();
    } catch (e) { setErro((e as Error).message); emitir(agId, "bloqueado", "Não consegui responder"); } finally { setEnviando(false); }
  };
  const avaliar = async (m: Mensagem, av: 1 | -1 | null) => { await api(`/api/agentes/${agId}/treino`, "POST", { mensagemId: m.id, avaliacao: av }); await carregar(); };
  const enviarCorrecao = async (m: Mensagem) => {
    if (!correcao.trim()) return;
    try { const r = await api(`/api/agentes/${agId}/treino`, "POST", { mensagemId: m.id, avaliacao: -1, correcao: correcao.trim(), virarRegra: true }); setCorrigindo(null); setCorrecao(""); await carregar(); await recarregar(); if (r.regra) setErro(null); }
    catch (e) { setErro((e as Error).message); }
  };
  return (
    <div className="flex h-full flex-col">
      {statusIA !== "ok" && <div className="mb-2 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Falta a chave da OpenAI no servidor (variável OPENAI_API_KEY). O agente ainda não consegue responder.</div>}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {msgs.length === 0 && <div className="text-xs text-[#5B6472]">Fale com {ficha.agente.nome}. Dê uma meta, pergunte, peça um plano. Em cada resposta você pode marcar 👍 ou corrigir; a correção vira uma regra permanente dele.</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.papel === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug ${m.papel === "user" ? "bg-[#4F7DF3] text-white" : "bg-[#F1F3F6] text-[#1D2128]"}`}>{m.conteudo}</div>
            {m.papel === "assistant" && m.id !== "tmp" && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#5B6472]">
                <button onClick={() => avaliar(m, m.avaliacao === 1 ? null : 1)} className={`rounded-full px-2 py-0.5 ${m.avaliacao === 1 ? "bg-[#22A86B] text-white" : "bg-black/5"}`}>👍</button>
                <button onClick={() => { setCorrigindo(corrigindo === m.id ? null : m.id); setCorrecao(m.correcao ?? ""); }} className={`rounded-full px-2 py-0.5 ${m.avaliacao === -1 ? "bg-[#E2575B] text-white" : "bg-black/5"}`}>👎 Corrigir</button>
                {Number(m.custoBrl) > 0 && <span>R$ {Number(m.custoBrl).toFixed(3)}</span>}
                {m.correcao && <span className="italic">· regra criada</span>}
              </div>
            )}
            {corrigindo === m.id && (
              <div className="mt-1 w-[92%] rounded-xl border border-[#E2575B]/40 bg-[#FFF5F5] p-2">
                <textarea className={inp + " min-h-[60px] w-full"} placeholder="O que ele deveria ter feito diferente? (vira regra permanente)" value={correcao} onChange={(e) => setCorrecao(e.target.value)} />
                <div className="mt-1 flex gap-2"><button onClick={() => enviarCorrecao(m)} className="rounded-xl bg-[#E2575B] px-3 py-1 text-xs font-bold text-white">Treinar</button><button onClick={() => setCorrigindo(null)} className="rounded-xl px-3 py-1 text-xs">Cancelar</button></div>
              </div>
            )}
          </div>
        ))}
        {enviando && <div className="text-xs text-[#5B6472]">{ficha.agente.nome} está pensando…</div>}
        <div ref={fim} />
      </div>
      {erro && <div className="mt-2 rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}
      <div className="mt-2 flex gap-2">
        <textarea className={inp + " max-h-28 min-h-[40px] flex-1 resize-none"} placeholder={`Mensagem pra ${ficha.agente.nome}… (Enter envia, Shift+Enter quebra linha)`} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <button onClick={enviar} disabled={enviando || !texto.trim()} className="rounded-xl bg-[#4F7DF3] px-4 text-sm font-bold text-white disabled:opacity-50">Enviar</button>
      </div>
    </div>
  );
}

function FichaSimulada() {
  const id = useEscritorio((s) => s.selecionado);
  const a = useEscritorio((s) => (id ? s.agentes[id] : undefined));
  const promover = useEscritorio((s) => s.promover); const demitir = useEscritorio((s) => s.demitir); const selecionar = useEscritorio((s) => s.selecionar);
  if (!a) return null;
  const nv = NIVEL[a.nivel]; const prox = NIVEIS.find((n) => n.ordem === nv.ordem + 1);
  return (
    <div className="flex flex-col gap-3 text-xs">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5"><dt className="text-[#5B6472]">Personalidade</dt><dd>{a.personalidade}</dd><dt className="text-[#5B6472]">Autonomia</dt><dd>{nv.autonomia}</dd><dt className="text-[#5B6472]">Entregas hoje</dt><dd>{a.tarefasConcluidas}</dd><dt className="text-[#5B6472]">Gasto hoje</dt><dd>R$ {a.gastoHoje.toFixed(2)}</dd></dl>
      <div className="flex gap-2">{prox && prox.id !== "ceo" && prox.id !== "diretor" && <button onClick={() => promover(a.id, prox.id)} className="flex-1 rounded-xl bg-[#22A86B] px-3 py-2 font-bold text-white">Promover a {prox.nome}</button>}<button onClick={() => { demitir(a.id); selecionar(null); }} className="rounded-xl bg-[#F1F3F6] px-3 py-2 font-bold text-[#E2575B]">Demitir</button></div>
    </div>
  );
}
