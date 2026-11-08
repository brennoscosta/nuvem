"use client";
// Painel "Montar escritório": o dono do lote escolhe o layout do prédio, os setores (nome, cor, mesas) e a equipe
// (atendente e CEO obrigatórios; profissionais por setor). A cena desenha o rascunho ao vivo; Salvar grava no servidor.
import { useEffect, useState } from "react";
import { PixAberto } from "./Lote";
import { useMundo } from "../mundoStore";
import { LAYOUTS, CORES_SETOR, CARGOS_SUGERIDOS, MAX_SETORES, MAX_MESAS_SETOR, CATALOGO_PROFISSIONAIS, PRECO_TROCA_LAYOUT, TROCAS_LAYOUT_GRATIS, trocasRestantes, vagasLivres, type Escritorio, type Setor, type Membro, type Pronto } from "../data/escritorio";

interface AgenteVenda { id: string; nome: string; cargo: string; setor: string; descricao: string; saudacao: string; skills: string[]; apis: string[]; preco: number; boneco: string; camisa: string }
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
import { BONECOS } from "../data/bonecos";
import { CORES_EMPRESA } from "../mundoStore";

const novoId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// Miniatura do layout: a imagem que gerou o prédio (public/escritorios/<id>.jpg)
function MiniLayout({ id }: { id: string; cor?: string }) {
  return <img src={`/escritorios/${id}.jpg`} alt="" className="h-16 w-20 shrink-0 rounded-lg bg-white object-cover" />;
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

function CartaoMembro({ m, e, set, podeRemover, abrirTreino = false }: { m: Membro; e: Escritorio; set: (e: Escritorio) => void; podeRemover: boolean; abrirTreino?: boolean }) {
  const [abrir, setAbrir] = useState(abrirTreino);
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
  const [erroPix, setErroPix] = useState<string | null>(null);
  const abaPedida = useMundo((s) => s.abaEscritorio);
  const setAbaPedida = useMundo((s) => s.setAbaEscritorio);
  // "contratar" e "treinar" são atalhos pra aba Equipe (com o catálogo aberto / com os treinos abertos)
  const aba = abaPedida === "contratar" || abaPedida === "treinar" ? "equipe" : abaPedida;
  const setAba = (a: "predio" | "setores" | "equipe") => setAbaPedida(a);
  const [catalogoLocal, setCatalogo] = useState<boolean | null>(null);
  const catalogo = catalogoLocal ?? abaPedida === "contratar";
  const [aVenda, setAVenda] = useState<AgenteVenda[] | null>(null);
  useEffect(() => { if (!aberto || aVenda) return; const c = new AbortController(); fetch("/api/catalogo", { signal: c.signal }).then((r) => r.json()).then((j) => setAVenda(j.agentes ?? [])).catch(() => setAVenda(CATALOGO_PROFISSIONAIS.map((p) => ({ ...p, descricao: p.treino.descricao, saudacao: p.treino.saudacao, skills: [], apis: [], preco: 0 })))); return () => c.abort(); }, [aberto, aVenda]);
  const pagar = useMundo((s) => s.pagar);
  const pix = useMundo((s) => s.pix);
  const terrenoAtual = useMundo((s) => (s.loteSelecionado ? s.terrenos[s.loteSelecionado] : undefined));
  if (!aberto || !e || !vista) return null;
  const vagas = vagasLivres(e);
  const addSetor = () => { if (e.setores.length >= MAX_SETORES) return; set({ ...e, setores: [...e.setores, { id: novoId("set"), nome: CARGOS_SUGERIDOS[e.setores.length % CARGOS_SUGERIDOS.length], cor: CORES_SETOR[e.setores.length % CORES_SETOR.length], mesas: 2 }] }); };
  const mudarSetor = (id: string, p: Partial<Setor>) => set({ ...e, setores: e.setores.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const removerSetor = (id: string) => { if (e.setores.length <= 1) return; set({ ...e, setores: e.setores.filter((s) => s.id !== id), equipe: e.equipe.filter((m) => m.setorId !== id) }); };
  const setorComVaga = (preferido?: string) => { const livre = (s: Setor) => s.mesas > e.equipe.filter((m) => m.setorId === s.id).length; return e.setores.find((s) => s.nome.toLowerCase() === (preferido ?? "").toLowerCase() && livre(s)) ?? e.setores.find(livre) ?? null; };
  // criar do zero: pessoa em branco pro dono nomear e treinar
  const addMembro = () => { const setor = setorComVaga(); if (!setor) return; set({ ...e, equipe: [...e.equipe, { id: novoId("mem"), nome: "Novo", cargo: setor.nome, papel: "profissional", setorId: setor.id, boneco: BONECOS[(e.equipe.length + 2) % BONECOS.length].id, camisa: "#1D4ED8", treino: { descricao: "", saudacao: "" } }] }); };
  // contratar do catálogo: já vem com cargo, aparência e treino (vai pro setor de mesmo nome se tiver vaga)
  const contratar = (p: Pronto | AgenteVenda) => { const setor = setorComVaga(p.setor); if (!setor) return; const treino = "treino" in p ? { ...p.treino } : { descricao: p.descricao, saudacao: p.saudacao }; set({ ...e, equipe: [...e.equipe, { id: novoId("mem"), nome: p.nome, cargo: p.cargo, papel: "profissional", setorId: setor.id, boneco: p.boneco, camisa: p.camisa, treino }] }); setCatalogo(false); };
  const restantes = trocasRestantes(e);
  const trocou = terrenoAtual?.escritorio && terrenoAtual.escritorio.layout !== e.layout;
  const comprarTroca = async () => { setErroPix(null); const r = await pagar(1, "layout"); if (r) setErroPix(r); };
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
                <MiniLayout id={L.id} />
                <div className="min-w-0"><div className="text-sm font-bold">{L.nome}</div><div className="text-[11px] leading-snug text-[#5B6472]">{L.descricao}</div></div>
              </button>
            ))}
            <div className={`rounded-xl px-3 py-2 text-[11px] ${restantes > 0 ? "bg-[#F1F3F6] text-[#5B6472]" : "bg-[#FFF4D6] text-[#7A5A00]"}`}>
              {restantes > 0
                ? <>Você pode trocar de prédio mais <b>{restantes}</b> {restantes === 1 ? "vez" : "vezes"} {(e.trocasLayout ?? 0) < TROCAS_LAYOUT_GRATIS ? `(${TROCAS_LAYOUT_GRATIS} grátis no total)` : "(crédito comprado)"}; depois cada troca custa {brl(PRECO_TROCA_LAYOUT)}.</>
                : <>Suas {TROCAS_LAYOUT_GRATIS} trocas grátis acabaram. Cada troca de prédio custa <b>{brl(PRECO_TROCA_LAYOUT)}</b> (Pix).</>}
            </div>
            {restantes <= 0 && trocou && pix?.tipo !== "layout" && <button type="button" onClick={comprarTroca} className="w-full rounded-xl bg-[#16A34A] px-3 py-2 text-sm font-bold text-white">Pagar {brl(PRECO_TROCA_LAYOUT)} no Pix pra trocar</button>}
            {erroPix && <div className="text-xs font-semibold text-[#E2575B]">{erroPix}</div>}
            {pix?.tipo === "layout" && vista && <PixAberto chave={vista} />}
            <div className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">O letreiro usa o nome, a cor e a logo da sua marca (botão “Marca e logo” no cartão do lote). Por dentro a planta é a mesma em todos: recepção, sala do CEO e até {MAX_SETORES} setores.</div>
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
            {e.equipe.map((m) => <CartaoMembro key={m.id} m={m} e={e} set={set} podeRemover={m.papel === "profissional"} abrirTreino={abaPedida === "treinar"} />)}
            {vagas > 0 ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setCatalogo((v) => !v)} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white">Contratar profissional</button>
                <button type="button" onClick={addMembro} className="flex-1 rounded-xl border-2 border-dashed border-[#1D4ED8]/40 px-3 py-2 text-sm font-semibold text-[#1D4ED8]">Criar do zero</button>
              </div>
            ) : <div className="text-center text-[11px] text-[#5B6472]">Todas as mesas estão ocupadas. Adicione mesas nos setores pra contratar mais.</div>}
            {vagas > 0 && <div className="text-center text-[11px] text-[#5B6472]">{vagas} {vagas === 1 ? "mesa livre" : "mesas livres"}</div>}
            {catalogo && vagas > 0 && (
              <div className="rounded-xl border border-black/10 bg-white p-2">
                <div className="mb-1 text-[11px] font-bold text-[#1D2128]">Agentes prontos do WorkEnd (já vêm treinados)</div>
                <div className="space-y-1">
                  {(aVenda ?? []).map((p) => (
                    <button key={p.id} type="button" onClick={() => contratar(p)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#F1F3F6]">
                      <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full" style={{ background: p.camisa }} />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-semibold">{p.cargo} <span className="font-normal text-[#5B6472]">· {p.nome}</span></span>
                        <span className="block text-[11px] leading-snug text-[#5B6472]">{p.descricao}</span>
                        {(p.skills.length > 0 || p.apis.length > 0) && <span className="mt-0.5 flex flex-wrap gap-1">{p.skills.slice(0, 4).map((k) => <span key={k} className="rounded bg-[#EEF3FF] px-1.5 py-0.5 text-[10px] text-[#1D4ED8]">{k}</span>)}{p.apis.map((a) => <span key={a} className="rounded bg-[#E3F6EA] px-1.5 py-0.5 text-[10px] text-[#166534]">{a.replace("_", " ")}</span>)}</span>}
                      </span>
                      <span className="text-right text-[11px] font-bold text-[#1D4ED8]">{p.preco > 0 ? `${brl(p.preco)}/mês` : "Incluso"}<span className="block font-semibold">Contratar</span></span>
                    </button>
                  ))}
                  {aVenda && aVenda.length === 0 && <div className="px-2 py-1 text-[11px] text-[#5B6472]">Nenhum agente à venda ainda.</div>}
                  {!aVenda && <div className="px-2 py-1 text-[11px] text-[#5B6472]">Carregando…</div>}
                </div>
              </div>
            )}
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
