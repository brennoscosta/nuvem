"use client";
// Vitrine "Contratar agente" e ficha do agente (20/11/2026, frente "creditos"), dentro do painel "Montar escritório":
//  - vitrine: setor, cargo, nível, o que faz e preço; ao escolher, 3 personalidades sorteadas que a empresa ainda não usa
//    (ou "outras 3") e o botão único de cobrança (créditos ou Pix). Quem foi comprado e saiu da equipe volta sem pagar.
//  - ficha: personalidade (nome e descrição, troca por 9 créditos), "Faz" e "Não faz (passa para…)" e o treino só dele.
import { useEffect, useMemo, useState } from "react";
import { useMundo } from "../mundoStore";
import { novoIdem, fmtCreditos } from "../creditosStore";
import { BotaoCobrar } from "./Cobrar";
import { Icone } from "./Icone";
import { PERSONALIDADE_POR_ID, PRECO_TROCA_PERSONALIDADE, sortearPersonalidades, type Personalidade } from "../data/personalidades";
import { escopoDe, naoFaz } from "../data/escopo";
import type { Escritorio, Membro } from "../data/escritorio";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
interface AgenteVitrine { id: string; nome: string; cargo: string; setor: string; nomeNivel: string; descricao: string; skills: string[]; preco: number; precoCobrado: number; boneco: string; camisa: string; naEquipe: number }
interface Fora { membroId: string; catalogoId: string; nome: string; cargo: string; setor: string; boneco: string; camisa: string; descricao: string }
interface Vitrine { agentes: AgenteVitrine[]; foraDaEquipe: Fora[]; vagas: number; maximo: number; personalidadesUsadas: string[]; precoTrocaPersonalidade: number }

// escolha de personalidade: 3 sorteadas entre as livres, com "outras 3"
function EscolherPersonalidade({ usadas, valor, aoMudar }: { usadas: string[]; valor: string | null; aoMudar: (id: string) => void }) {
  const [vistas, setVistas] = useState<string[]>([]);
  const [opcoes, setOpcoes] = useState<Personalidade[]>(() => sortearPersonalidades(usadas, 3));
  useEffect(() => { if (!valor && opcoes[0]) aoMudar(opcoes[0].id); }, [valor, opcoes, aoMudar]);
  const outras = () => { const ja = [...vistas, ...opcoes.map((o) => o.id)]; setVistas(ja); const n = sortearPersonalidades(usadas, 3, ja); setOpcoes(n); if (n[0]) aoMudar(n[0].id); };
  return (
    <div className="mt-2" data-personalidades>
      <div className="flex items-center justify-between text-[11px] font-bold text-[#1D2128]">Personalidade<button type="button" onClick={outras} className="font-semibold text-[#1D4ED8] hover:underline">Outras 3</button></div>
      <div className="mt-1 space-y-1">
        {opcoes.map((p) => (
          <label key={p.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 ${valor === p.id ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-black/10 bg-white"}`}>
            <input type="radio" name="personalidade" checked={valor === p.id} onChange={() => aoMudar(p.id)} className="mt-0.5" data-personalidade={p.id} />
            <span className="min-w-0"><span className="block text-[12px] font-semibold">{p.nome}</span><span className="block text-[11px] leading-snug text-[#5B6472]">{p.descricao} Tom: {p.tom}.</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function VitrineAgentes({ chave, e, set, abertaDeInicio = false }: { chave: string; e: Escritorio; set: (e: Escritorio) => void; abertaDeInicio?: boolean }) {
  const [v, setV] = useState<Vitrine | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState(abertaDeInicio);
  const [setor, setSetor] = useState<string>("todos");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [personalidade, setPersonalidade] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  // agente pago (créditos ou Pix): a vitrine relê (contagem na equipe e personalidades usadas)
  const recarga = useMundo((s) => (s.pix?.tipo === "agente" && s.pix.status === "aprovado" ? s.pix.id : ""));
  useEffect(() => {
    if (!aberta) return; const c = new AbortController();
    fetch(`/api/workend/contratar?chave=${encodeURIComponent(chave)}`, { signal: c.signal, cache: "no-store" }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setErro(j.erro ?? `Erro ${r.status}`); else setV(j as Vitrine); }).catch(() => {});
    return () => c.abort();
  }, [aberta, chave, recarga]);
  const usadas = useMemo(() => [...new Set([...(v?.personalidadesUsadas ?? []), ...e.equipe.map((m) => m.personalidadeId).filter((x): x is string => !!x)])], [v, e.equipe]);
  const setores = useMemo(() => [...new Set((v?.agentes ?? []).map((a) => a.setor))], [v]);
  const profissionais = e.equipe.filter((m) => m.papel === "profissional").length;
  const contratar = async (a: AgenteVitrine, creditos: boolean) => {
    setErro(null); setPagando(true);
    try {
      const r = await fetch("/api/workend/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chave, catalogoId: a.id, personalidadeId: personalidade, creditos, idem: novoIdem() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      await useMundo.getState().abrirCobranca(j, chave, "agente");
      setEscolhido(null); setPersonalidade(null);
    } catch (x) { setErro((x as Error).message); } finally { setPagando(false); }
  };
  // volta de quem já foi comprado: entra no rascunho com o mesmo id (o servidor devolve a personalidade e o escopo)
  const porDeVolta = (f: Fora) => {
    const livre = (s: Escritorio["setores"][number]) => s.mesas > e.equipe.filter((m) => m.setorId === s.id).length;
    const s = e.setores.find((x) => x.nome.toLowerCase() === f.setor.toLowerCase() && livre(x)) ?? e.setores.find(livre);
    if (!s) { setErro("Não há mesa livre: aumente as mesas de um setor na aba Setores."); return; }
    set({ ...e, equipe: [...e.equipe, { id: f.membroId, nome: f.nome, cargo: f.cargo, papel: "profissional", setorId: s.id, boneco: f.boneco, camisa: f.camisa, treino: { descricao: f.descricao.slice(0, 600), saudacao: "" }, ...(f.catalogoId !== "sob-medida" ? { catalogoId: f.catalogoId } : {}) }] });
  };
  if (!aberta) return <button type="button" onClick={() => setAberta(true)} className="w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white" data-abrir-vitrine>Contratar agente</button>;
  const fora = (v?.foraDaEquipe ?? []).filter((f) => !e.equipe.some((m) => m.id === f.membroId));
  return (
    <div className="rounded-xl border border-black/10 bg-white p-2" data-vitrine>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-[#1D2128]">Contratar agente</div>
        <button type="button" onClick={() => setAberta(false)} className="rounded-full px-1.5 text-[#5B6472] hover:bg-black/5" aria-label="Fechar a vitrine"><Icone nome="fechar" tamanho={14} /></button>
      </div>
      <div className="text-[11px] leading-snug text-[#5B6472]">Compra única: fica enquanto o lote estiver ativo. Cada agente chega com nome, personalidade e escopo só dele. {v ? `${profissionais} de ${v.maximo} profissionais.` : ""}</div>
      {fora.length > 0 && (
        <div className="mt-2 rounded-lg bg-[#F1F3F6] p-2">
          <div className="text-[11px] font-bold">Já contratados, fora da equipe (voltam sem pagar)</div>
          {fora.map((f) => <div key={f.membroId} className="mt-1 flex items-center justify-between gap-2 text-[12px]"><span className="min-w-0 truncate"><b>{f.nome}</b> · {f.cargo}</span><button type="button" onClick={() => porDeVolta(f)} className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#1D4ED8]">Pôr de volta</button></div>)}
        </div>
      )}
      {v && (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 text-[11px]">
          {["todos", ...setores].map((s) => <button key={s} type="button" onClick={() => setSetor(s)} className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${setor === s ? "border-[#1D4ED8] bg-[#EEF3FF] text-[#1D4ED8]" : "border-black/10 text-[#5B6472]"}`}>{s === "todos" ? "Todos os setores" : s}</button>)}
        </div>
      )}
      <div className="mt-1 max-h-80 space-y-1 overflow-y-auto">
        {!v && !erro && <div className="px-2 py-1 text-[11px] text-[#5B6472]">Carregando…</div>}
        {(v?.agentes ?? []).filter((a) => setor === "todos" || a.setor === setor).map((a) => (
          <div key={a.id} className={`rounded-lg px-2 py-1.5 ${escolhido === a.id ? "bg-[#F7F9FF] ring-1 ring-[#1D4ED8]/30" : "hover:bg-[#F1F3F6]"}`} data-agente={a.id}>
            <button type="button" onClick={() => { setEscolhido(escolhido === a.id ? null : a.id); setPersonalidade(null); }} className="flex w-full items-start gap-2 text-left">
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full" style={{ background: a.camisa }} />
              <span className="min-w-0 flex-1">
                <span className="text-[13px] font-semibold">{a.cargo}</span> <span className="rounded bg-[#EEF3FF] px-1 py-0.5 text-[10px] font-bold text-[#1D4ED8]">{a.nomeNivel}</span>
                <span className="block text-[11px] text-[#5B6472]">{a.setor}{a.naEquipe ? ` · ${a.naEquipe} na equipe` : ""}</span>
                <span className="block text-[11px] leading-snug text-[#5B6472] line-clamp-2">{a.descricao}</span>
              </span>
              <span className="shrink-0 text-right text-[12px] font-bold text-[#1D2128]">{fmtCreditos(a.precoCobrado)}<span className="block text-[10px] font-semibold text-[#5B6472]">créditos</span></span>
            </button>
            {escolhido === a.id && (
              <div className="pl-8">
                {a.skills.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{a.skills.slice(0, 4).map((k) => <span key={k} className="rounded bg-[#EEF3FF] px-1.5 py-0.5 text-[10px] text-[#1D4ED8]">{k}</span>)}</div>}
                {a.naEquipe > 0 && <div className="mt-1 text-[11px] text-[#7A5A00]">Já tem {a.naEquipe} {a.cargo} na equipe: o novo recebe um foco diferente e as tarefas são divididas sem repetir.</div>}
                <EscolherPersonalidade usadas={usadas} valor={personalidade} aoMudar={setPersonalidade} />
                {v && profissionais >= v.maximo ? <div className="mt-2 text-[11px] text-[#B42318]">O escritório já tem o máximo de profissionais deste lote.</div>
                  : <BotaoCobrar valor={a.precoCobrado} rotuloPix={`Contratar · ${brl(a.precoCobrado)} no Pix`} rotuloCreditos="Contratar" pagando={pagando || !personalidade} compacto onPagar={(c) => void contratar(a, c)} />}
              </div>
            )}
          </div>
        ))}
      </div>
      {erro && <div className="mt-1 text-[11px] font-semibold text-[#B42318]">{erro}</div>}
    </div>
  );
}

// linha curta da personalidade, logo abaixo do nome no cartão do membro
export function LinhaPersonalidade({ m }: { m: Membro }) {
  const p = m.personalidadeId ? PERSONALIDADE_POR_ID[m.personalidadeId] : null;
  const esc = escopoDe(m);
  return (
    <div className="mt-1 text-[11px] leading-snug text-[#5B6472]" data-ficha-linha={m.id}>
      {p ? <><b className="text-[#1D2128]">{p.nome}</b> · {p.descricao}</> : <span>Personalidade de antes (sem perfil do banco)</span>}
      {esc.foco && <span className="ml-1 rounded bg-[#FFF4D6] px-1 py-0.5 text-[10px] font-semibold text-[#7A5A00]">Foco: {esc.foco}</span>}
    </div>
  );
}

interface Regra { id: string; texto: string }
const TIPOS_TREINO: { id: string; nome: string; dica: string }[] = [
  { id: "regra", nome: "Regra", dica: "Ex.: Sempre ofereça o frete grátis acima de R$ 150." },
  { id: "exemplo", nome: "Exemplo de resposta", dica: "Ex.: Cliente pergunta do prazo → \"Entregamos em 2 dias úteis na cidade.\"" },
  { id: "nao", nome: "Não deve fazer", dica: "Ex.: Não prometa desconto sem falar com o dono." },
  { id: "saudacao", nome: "Frase fixa: saudação", dica: "Usada também quando a IA estiver fora." },
  { id: "recado", nome: "Frase fixa: recado", dica: "O que a atendente diz quando a IA estiver fora." },
  { id: "despedida", nome: "Frase fixa: despedida", dica: "Fecha o recado sem IA." },
];
// Ficha do agente: personalidade (troca paga), Faz / Não faz e o treino só dele
export function FichaAgente({ m, e, chave }: { m: Membro; e: Escritorio; chave: string }) {
  const salvo = useMundo((s) => !!s.terrenos[chave]?.escritorio?.equipe.some((x) => x.id === m.id));
  const esc = escopoDe(m); const nao = naoFaz(m, e);
  const p = m.personalidadeId ? PERSONALIDADE_POR_ID[m.personalidadeId] : null;
  const [trocar, setTrocar] = useState(false);
  const [nova, setNova] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [tipo, setTipo] = useState("regra");
  const [texto, setTexto] = useState("");
  const usadasOutros = e.equipe.filter((x) => x.id !== m.id && x.personalidadeId).map((x) => x.personalidadeId!);
  const treino = (corpo: Record<string, unknown>) => fetch("/api/workend/equipe/treino", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lote: chave, membro: m.id, ...corpo }) }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`); return j; });
  useEffect(() => { if (!salvo) return; let vivo = true; treino({ listar: true }).then((j) => { if (vivo) setRegras(j.regras ?? []); }).catch(() => { if (vivo) setRegras([]); }); return () => { vivo = false; }; }, [salvo, m.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pagarTroca = async (creditos: boolean) => {
    setErro(null); setPagando(true);
    try {
      const r = await fetch("/api/workend/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "personalidade", chave, membroId: m.id, personalidadeId: nova, creditos, idem: novoIdem() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      await useMundo.getState().abrirCobranca(j, chave, "personalidade"); setTrocar(false); setNova(null);
    } catch (x) { setErro((x as Error).message); } finally { setPagando(false); }
  };
  const adicionar = async () => { setErro(null); try { const j = await treino({ novaRegra: { tipo, texto } }); if (j.regra) setRegras((r) => [...(r ?? []), j.regra]); setTexto(""); } catch (x) { setErro((x as Error).message); } };
  const remover = async (id: string) => { setErro(null); try { await treino({ removerRegra: id }); setRegras((r) => (r ?? []).filter((x) => x.id !== id)); } catch (x) { setErro((x as Error).message); } };
  return (
    <div className="space-y-2" data-ficha={m.id}>
      <div className="rounded-lg bg-[#F7F9FF] p-2">
        <div className="text-[11px] font-bold text-[#1D2128]">Personalidade</div>
        {p ? <div className="text-[12px]"><b>{p.nome}</b>: {p.descricao}<div className="text-[11px] text-[#5B6472]">Tom: {p.tom}. {p.manias.join(". ")}.</div><div className="text-[11px] text-[#5B6472]">Cliente com pressa ou irritado: {p.apressado}</div></div>
          : <div className="text-[11px] text-[#5B6472]">Este agente responde do jeito de antes. Você pode dar uma personalidade do banco a ele.</div>}
        {salvo && !trocar && <button type="button" onClick={() => setTrocar(true)} className="mt-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline">Trocar personalidade · {fmtCreditos(PRECO_TROCA_PERSONALIDADE)} créditos</button>}
        {trocar && <><EscolherPersonalidade usadas={[...usadasOutros, ...(m.personalidadeId ? [m.personalidadeId] : [])]} valor={nova} aoMudar={setNova} /><BotaoCobrar valor={PRECO_TROCA_PERSONALIDADE} rotuloPix={`Trocar · ${brl(PRECO_TROCA_PERSONALIDADE)} no Pix`} rotuloCreditos="Trocar personalidade" pagando={pagando || !nova} compacto onPagar={(c) => void pagarTroca(c)} /></>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-[#F3FBF5] p-2"><div className="text-[11px] font-bold text-[#166534]">Faz{esc.foco ? ` (foco: ${esc.foco})` : ""}</div><ul className="mt-0.5 list-disc pl-4 text-[11px] text-[#1D2128]">{esc.faz.slice(0, 5).map((f) => <li key={f}>{f}</li>)}</ul></div>
        <div className="rounded-lg bg-[#FFF7ED] p-2"><div className="text-[11px] font-bold text-[#9A3412]">Não faz (passa para…)</div><ul className="mt-0.5 text-[11px] text-[#1D2128]">{nao.length ? nao.slice(0, 6).map((x) => <li key={x.id}>{x.assunto} → <b>{x.nome}</b></li>) : <li className="text-[#5B6472]">Ninguém mais na equipe ainda.</li>}</ul></div>
      </div>
      <div className="rounded-lg bg-[#F1F3F6] p-2" data-treino={m.id}>
        <div className="text-[11px] font-bold text-[#1D2128]">Treinar este agente (fica só com {m.nome})</div>
        {!salvo ? <div className="text-[11px] text-[#5B6472]">Salve o escritório para começar o treino.</div> : (
          <>
            {regras === null ? <div className="text-[11px] text-[#5B6472]">Carregando…</div> : regras.length === 0 ? <div className="text-[11px] text-[#5B6472]">Nenhum treino ainda.</div>
              : <ul className="mt-1 space-y-1">{regras.map((r) => <li key={r.id} className="flex items-start justify-between gap-2 rounded bg-white px-2 py-1 text-[11px]"><span>{r.texto}</span><button type="button" onClick={() => void remover(r.id)} className="shrink-0 text-[#B42318]" aria-label="Apagar este treino"><Icone nome="fechar" tamanho={12} /></button></li>)}</ul>}
            <div className="mt-1 flex flex-col gap-1 sm:flex-row">
              <select value={tipo} onChange={(ev) => setTipo(ev.target.value)} className="rounded-md border border-black/10 bg-white px-1 py-1 text-base sm:text-xs">{TIPOS_TREINO.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
              <input value={texto} onChange={(ev) => setTexto(ev.target.value.slice(0, 280))} placeholder={TIPOS_TREINO.find((t) => t.id === tipo)?.dica} className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-base sm:text-xs" />
              <button type="button" onClick={() => void adicionar()} disabled={texto.trim().length < 3} className="rounded-md bg-[#1D4ED8] px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Guardar</button>
            </div>
          </>
        )}
      </div>
      {erro && <div className="text-[11px] font-semibold text-[#B42318]">{erro}</div>}
    </div>
  );
}
