"use client";
// Painel "Montar escritório": o dono do lote escolhe o layout do prédio, os setores (nome, cor, mesas) e a equipe
// (atendente e CEO obrigatórios; profissionais por setor). A cena desenha o rascunho ao vivo; Salvar grava no servidor.
import { useState } from "react";
import { useMundo } from "../mundoStore";
import { LAYOUTS, CORES_SETOR, CARGOS_SUGERIDOS, MAX_SETORES, MAX_MESAS_SETOR, vagasLivres, type Escritorio, type Setor, type Membro } from "../data/escritorio";
import { BONECOS } from "../data/bonecos";
import { CORES_EMPRESA } from "../mundoStore";

const novoId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// Miniatura do layout desenhada em CSS (sem imagem)
function MiniLayout({ id, cor }: { id: string; cor: string }) {
  if (id === "sobrado") return <div className="relative h-14 w-20 rounded-md bg-[#F7F5F0] shadow-inner"><div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2" style={{ background: cor }} /><div className="absolute left-2 right-2 top-2 h-2 rounded-sm bg-[#9CC9DA]" /><div className="absolute left-2 right-2 bottom-3 h-2 rounded-sm bg-[#9CC9DA]" /><div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 bg-[#2B2E35]" /></div>;
  if (id === "loja") return <div className="relative h-14 w-20 rounded-md bg-[#F3E9D8] shadow-inner"><div className="absolute inset-x-1 top-3 h-3 rounded-sm" style={{ background: `repeating-linear-gradient(90deg, ${cor} 0 6px, #fff 6px 12px)` }} /><div className="absolute bottom-0 left-2 right-2 h-6 rounded-t-sm bg-[#BFE3F2]" /><div className="absolute bottom-0 left-1/2 h-5 w-3 -translate-x-1/2 bg-[#2B2E35]" /></div>;
  return <div className="relative h-14 w-20 rounded-md bg-[#F7F5F0] shadow-inner"><div className="absolute inset-x-0 top-1 h-1.5" style={{ background: cor }} /><div className="absolute bottom-0 left-2 right-2 h-7 rounded-t-sm bg-[#BFE3F2]" /><div className="absolute bottom-0 left-1/2 h-5 w-3 -translate-x-1/2 bg-[#2B2E35]" /></div>;
}

function Avatar({ id, camisa, ativo, onClick }: { id: string; camisa: string; ativo: boolean; onClick: () => void }) {
  const b = BONECOS.find((x) => x.id === id)!;
  return (
    <button type="button" onClick={onClick} title={b.nome} className={`relative h-9 w-9 rounded-full border-2 ${ativo ? "border-[#1D4ED8]" : "border-transparent"}`} style={{ background: camisa }}>
      <span className="absolute left-1/2 top-1 h-4 w-4 -translate-x-1/2 rounded-full" style={{ background: b.pele }} />
      <span className="absolute left-1/2 top-0.5 h-2 w-4 -translate-x-1/2 rounded-t-full" style={{ background: b.estiloCabelo === "careca" ? "transparent" : b.cabelo }} />
      {b.oculos && <span className="absolute left-1/2 top-2 h-1 w-4 -translate-x-1/2 rounded bg-black/60" />}
    </button>
  );
}

function CartaoMembro({ m, e, set, podeRemover }: { m: Membro; e: Escritorio; set: (e: Escritorio) => void; podeRemover: boolean }) {
  const [abrir, setAbrir] = useState(false);
  const mudar = (p: Partial<Membro>) => set({ ...e, equipe: e.equipe.map((x) => (x.id === m.id ? { ...x, ...p } : x)) });
  const remover = () => set({ ...e, equipe: e.equipe.filter((x) => x.id !== m.id) });
  const rotulo = m.papel === "ceo" ? "CEO" : m.papel === "atendente" ? "Atendente" : e.setores.find((s) => s.id === m.setorId)?.nome ?? "Setor";
  return (
    <div className="rounded-xl border border-black/10 bg-white p-2">
      <div className="flex items-center gap-2">
        <Avatar id={m.boneco} camisa={m.camisa} ativo={false} onClick={() => setAbrir((v) => !v)} />
        <div className="min-w-0 flex-1">
          <input value={m.nome} onChange={(ev) => mudar({ nome: ev.target.value.slice(0, 24) })} className="w-full rounded-md border border-black/10 px-2 py-1 text-sm font-semibold" placeholder="Nome" />
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#5B6472]"><span className="rounded-full px-1.5 py-0.5 font-bold uppercase text-white" style={{ background: m.papel === "ceo" ? "#D4A017" : m.papel === "atendente" ? "#16A34A" : "#1D4ED8" }}>{rotulo}</span><input value={m.cargo} onChange={(ev) => mudar({ cargo: ev.target.value.slice(0, 40) })} className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-0.5" placeholder="Cargo" /></div>
        </div>
        <button type="button" onClick={() => setAbrir((v) => !v)} className="rounded-lg bg-[#F1F3F6] px-2 py-1 text-xs">{abrir ? "▲" : "Aparência e treino"}</button>
      </div>
      {abrir && (
        <div className="mt-2 space-y-2 border-t border-black/5 pt-2">
          <div className="flex flex-wrap gap-1.5">{BONECOS.map((b) => <Avatar key={b.id} id={b.id} camisa={m.camisa} ativo={m.boneco === b.id} onClick={() => mudar({ boneco: b.id })} />)}</div>
          <div className="flex items-center gap-1.5"><span className="text-[11px] text-[#5B6472]">Camisa</span>{[...CORES_EMPRESA, "#FFFFFF", "#111827"].map((c) => <button key={c} type="button" onClick={() => mudar({ camisa: c })} className={`h-5 w-5 rounded-full border ${m.camisa === c ? "border-black" : "border-black/10"}`} style={{ background: c }} />)}</div>
          <div className="rounded-lg bg-[#F1F3F6] p-2">
            <div className="text-[11px] font-bold text-[#1D2128]">Treinar {m.papel === "ceo" ? "o CEO" : m.papel === "atendente" ? "a atendente" : m.nome}</div>
            <label className="mt-1 block text-[11px] text-[#5B6472]">O que {m.papel === "ceo" ? "ele" : "essa pessoa"} sabe e faz (a base de como vai atender)
              <textarea value={m.treino?.descricao ?? ""} onChange={(ev) => mudar({ treino: { descricao: ev.target.value.slice(0, 600), saudacao: m.treino?.saudacao ?? "" } })} rows={3} className="mt-0.5 w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-[#1D2128]" placeholder={`Ex.: Conhece todos os produtos da ${"empresa"}, dá orçamento e agenda visitas.`} />
            </label>
            <label className="mt-1 block text-[11px] text-[#5B6472]">Frase de boas-vindas
              <input value={m.treino?.saudacao ?? ""} onChange={(ev) => mudar({ treino: { descricao: m.treino?.descricao ?? "", saudacao: ev.target.value.slice(0, 160) } })} className="mt-0.5 w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-[#1D2128]" placeholder="Ex.: Oi! Seja bem-vindo. Em que posso ajudar?" />
            </label>
          </div>
          {m.papel === "profissional" && <div className="flex items-center gap-1.5 text-[11px] text-[#5B6472]">Setor <select value={m.setorId ?? ""} onChange={(ev) => mudar({ setorId: ev.target.value })} className="rounded-md border border-black/10 px-2 py-0.5 text-xs">{e.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>}
          {podeRemover && <button type="button" onClick={remover} className="text-[11px] font-semibold text-[#E2575B]">Remover da equipe</button>}
        </div>
      )}
    </div>
  );
}

export function PainelEscritorio() {
  const aberto = useMundo((s) => s.painelEscritorio);
  const e = useMundo((s) => s.rascunhoEscritorio);
  const set = useMundo((s) => s.setEscritorio);
  const fechar = useMundo((s) => s.fecharEscritorio);
  const salvar = useMundo((s) => s.salvarEscritorio);
  const salvando = useMundo((s) => s.salvandoEscritorio);
  const vista = useMundo((s) => s.loteSelecionado);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"predio" | "setores" | "equipe">("predio");
  if (!aberto || !e || !vista) return null;
  const vagas = vagasLivres(e);
  const addSetor = () => { if (e.setores.length >= MAX_SETORES) return; set({ ...e, setores: [...e.setores, { id: novoId("set"), nome: CARGOS_SUGERIDOS[e.setores.length % CARGOS_SUGERIDOS.length], cor: CORES_SETOR[e.setores.length % CORES_SETOR.length], mesas: 2 }] }); };
  const mudarSetor = (id: string, p: Partial<Setor>) => set({ ...e, setores: e.setores.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const removerSetor = (id: string) => { if (e.setores.length <= 1) return; set({ ...e, setores: e.setores.filter((s) => s.id !== id), equipe: e.equipe.filter((m) => m.setorId !== id) }); };
  const addMembro = () => { const setor = e.setores.find((s) => s.mesas > e.equipe.filter((m) => m.setorId === s.id).length); if (!setor) return; set({ ...e, equipe: [...e.equipe, { id: novoId("mem"), nome: "Novo", cargo: setor.nome, papel: "profissional", setorId: setor.id, boneco: BONECOS[(e.equipe.length + 2) % BONECOS.length].id, camisa: "#1D4ED8" }] }); };
  const clicarSalvar = async () => { setErro(null); const r = await salvar(); if (r) setErro(r); };
  return (
    <div className="absolute right-3 top-20 z-10 flex max-h-[calc(100vh-7rem)] w-[22rem] flex-col rounded-2xl bg-white/97 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between p-4 pb-2">
        <div><div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">Montar escritório</div><div className="text-lg font-bold">Seu prédio, do seu jeito</div><div className="text-xs text-[#5B6472]">O mapa mostra as mudanças na hora. Use “Ver por dentro” pra ver as salas.</div></div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      <div className="mx-4 flex gap-1 rounded-xl bg-[#F1F3F6] p-1 text-xs font-semibold">
        {([["predio", "Prédio"], ["setores", `Setores (${e.setores.length})`], ["equipe", `Equipe (${e.equipe.length})`]] as const).map(([k, t]) => <button key={k} onClick={() => setAba(k)} className={`flex-1 rounded-lg px-2 py-1.5 ${aba === k ? "bg-white shadow" : "text-[#5B6472]"}`}>{t}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        {aba === "predio" && (
          <div className="space-y-2">
            {LAYOUTS.map((L) => (
              <button key={L.id} type="button" onClick={() => set({ ...e, layout: L.id })} className={`flex w-full items-center gap-3 rounded-xl border-2 p-2 text-left ${e.layout === L.id ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-black/10 hover:bg-black/[0.03]"}`}>
                <MiniLayout id={L.id} cor={useMundo.getState().terrenos[vista]?.cor ?? "#1D4ED8"} />
                <div className="min-w-0"><div className="text-sm font-bold">{L.nome}</div><div className="text-[11px] leading-snug text-[#5B6472]">{L.descricao}</div></div>
              </button>
            ))}
            <div className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">A cor e a logo da fachada são as da placa (botão “Editar placa” no cartão do lote). A planta por dentro é a mesma nos três: recepção, sala do CEO e até {MAX_SETORES} setores.</div>
          </div>
        )}
        {aba === "setores" && (
          <div className="space-y-2">
            {e.setores.map((s) => (
              <div key={s.id} className="rounded-xl border border-black/10 bg-white p-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ background: s.cor }} />
                  <input list="cargos-sugeridos" value={s.nome} onChange={(ev) => mudarSetor(s.id, { nome: ev.target.value.slice(0, 28) })} className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1 text-sm font-semibold" placeholder="Nome do setor" />
                  <label className="flex items-center gap-1 text-[11px] text-[#5B6472]">mesas<select value={s.mesas} onChange={(ev) => mudarSetor(s.id, { mesas: Number(ev.target.value) })} className="rounded-md border border-black/10 px-1 py-0.5 text-xs">{Array.from({ length: MAX_MESAS_SETOR }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                  {e.setores.length > 1 && <button type="button" onClick={() => removerSetor(s.id)} className="rounded-md px-1.5 text-[#E2575B]" title="Remover setor">✕</button>}
                </div>
                <div className="mt-1.5 flex gap-1">{CORES_SETOR.map((c) => <button key={c} type="button" onClick={() => mudarSetor(s.id, { cor: c })} className={`h-4 w-4 rounded-full border ${s.cor === c ? "border-black" : "border-black/10"}`} style={{ background: c }} />)}</div>
              </div>
            ))}
            <datalist id="cargos-sugeridos">{CARGOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}</datalist>
            {e.setores.length < MAX_SETORES ? <button type="button" onClick={addSetor} className="w-full rounded-xl border-2 border-dashed border-[#1D4ED8]/40 px-3 py-2 text-sm font-semibold text-[#1D4ED8]">+ Adicionar setor</button> : <div className="text-center text-[11px] text-[#5B6472]">Este lote comporta {MAX_SETORES} setores. Pra crescer, compre o lote do lado.</div>}
          </div>
        )}
        {aba === "equipe" && (
          <div className="space-y-2">
            {e.equipe.map((m) => <CartaoMembro key={m.id} m={m} e={e} set={set} podeRemover={m.papel === "profissional"} />)}
            {vagas > 0 ? <button type="button" onClick={addMembro} className="w-full rounded-xl border-2 border-dashed border-[#1D4ED8]/40 px-3 py-2 text-sm font-semibold text-[#1D4ED8]">+ Contratar profissional ({vagas} {vagas === 1 ? "mesa livre" : "mesas livres"})</button> : <div className="text-center text-[11px] text-[#5B6472]">Todas as mesas estão ocupadas. Adicione mesas nos setores pra contratar mais.</div>}
            <div className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">A atendente e o CEO fazem parte de todo escritório. Clique em “Aparência” pra trocar o boneco e <b>treinar</b> cada um (o que sabe e como cumprimenta) — é isso que eles vão usar pra atender os visitantes.</div>
          </div>
        )}
      </div>
      <div className="border-t border-black/5 p-4 pt-3">
        {erro && <div className="mb-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
        <div className="flex gap-2">
          <button onClick={fechar} className="rounded-xl bg-[#F1F3F6] px-3 py-2.5 text-sm font-semibold text-[#5B6472]">Cancelar</button>
          <button onClick={clicarSalvar} disabled={salvando} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#1a44c2] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar escritório"}</button>
        </div>
      </div>
    </div>
  );
}
