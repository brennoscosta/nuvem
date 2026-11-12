"use client";
// Meu escritório › Agenda (12/11/2026): ligar o agendamento, serviços (até 8), horários da semana com pausa,
// antecedência e até quantos dias à frente; e a lista de quem marcou (cancelar, concluído, faltou).
import { useEffect, useState } from "react";
import { MAX_SERVICOS, DURACOES, PASSOS, ANTECEDENCIAS, DIAS_FRENTE, NOMES_DIAS, NOMES_STATUS, duracaoTexto, paraHHMM, type ConfigAgenda, type DiaAgenda } from "@/office/data/agenda";

type Ag = { id: string; servico: string; preco: string; inicio: string; quando: string; dia: string; nome: string; contato: string; obs: string; status: string; origem: string; canceladoPor: string | null; passou: boolean };
type Dados = { config: ConfigAgenda; usavel: boolean; loja: { chave: string; numero: number | null; empresa: string } | null; proximos: Ag[]; historico: Ag[] };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}
function linkContato(c: string) {
  if (/@/.test(c) && !/\s/.test(c.trim())) return `mailto:${c.trim()}`;
  const n = c.replace(/\D/g, "");
  if (n.length >= 10 && n.length <= 13) return `https://wa.me/${n.length <= 11 ? `55${n}` : n}`;
  return null;
}
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const HORAS = Array.from({ length: 96 }, (_, i) => paraHHMM(i * 15));
function HoraSelect({ valor, mudar, rotulo }: { valor: string | undefined; mudar: (v: string) => void; rotulo: string }) {
  const v = valor ?? "08:00", lista = HORAS.includes(v) ? HORAS : [...HORAS, v].sort();
  return <select value={v} onChange={(e) => mudar(e.target.value)} aria-label={rotulo} className="rounded-lg border border-[var(--line-strong)] bg-white px-2 py-1 text-[16px] tabular-nums sm:text-sm">{lista.map((h) => <option key={h} value={h}>{h}</option>)}</select>;
}
const COR_STATUS: Record<string, string> = { marcado: "bg-[#EEF3FF] text-[#1D4ED8]", cancelado: "bg-[#FDECEC] text-[#9B1C1C]", concluido: "bg-[#E3F6EA] text-[#166534]", faltou: "bg-[#FFF4DB] text-[#7A5A00]" };

export function AgendaDono() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [rascunho, setRascunho] = useState<ConfigAgenda | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api<Dados>("/api/workend/agenda").then((d) => { if (vivo) { setDados(d); setErroCarga(null); } }).catch((e) => vivo && setErroCarga((e as Error).message));
    return () => { vivo = false; };
  }, [versao]);

  if (!dados) return <section className="faixa mt-4"><p className="text-[var(--tinta-2)]">{erroCarga ?? "Carregando a agenda…"}</p></section>;
  const c = rascunho ?? dados.config;
  const mudou = !!rascunho;
  const muda = (p: Partial<ConfigAgenda>) => { setRascunho({ ...c, ...p }); setAviso(null); };
  const mudaDia = (d: number, p: Partial<DiaAgenda>) => muda({ horarios: { ...c.horarios, [String(d)]: { ...c.horarios[String(d)], ...p } } });
  const mudaServico = (i: number, p: Partial<ConfigAgenda["servicos"][number]>) => muda({ servicos: c.servicos.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const salvar = async (cfg: ConfigAgenda, msg: string) => {
    setSalvando(true); setErro(null); setAviso(null);
    try { await api("/api/workend/agenda", { method: "POST", body: JSON.stringify(cfg) }); setRascunho(null); setAviso(msg); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  const acao = async (a: Ag, qual: "cancelar" | "concluido" | "faltou") => {
    if (qual === "cancelar" && !window.confirm(`Cancelar o horário de ${a.nome} (${a.servico}, ${a.quando})? O cliente recebe um aviso.`)) return;
    setErro(null);
    try { await api(`/api/workend/agenda/${encodeURIComponent(a.id)}`, { method: "POST", body: JSON.stringify({ acao: qual }) }); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
  };
  const numero = dados.loja?.numero ?? null;
  // próximos agrupados por dia
  const grupos: { dia: string; rotulo: string; itens: Ag[] }[] = [];
  for (const a of dados.proximos) { const g = grupos.find((x) => x.dia === a.dia); if (g) g.itens.push(a); else grupos.push({ dia: a.dia, rotulo: a.quando.split(" · ")[0], itens: [a] }); }

  return (
    <>
      <section className="faixa pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[2rem] lg:text-[2.4rem]">Agenda da loja{dados.loja && <span className="text-[var(--tinta-2)]"> · {dados.loja.empresa}</span>}</h1>
            <p className="mt-2 max-w-[62ch] text-[var(--tinta-2)]">Ligada, a agenda aparece no cartão da sua loja no mapa e na página da loja, e a atendente de IA passa a marcar horários pela conversa. Cada horário marcado chega no sino.</p>
          </div>
          {numero != null && <a href={`/loja/${numero}#agenda`} target="_blank" rel="noreferrer" className="btn btn-linha">Ver como o cliente vê ↗</a>}
        </div>
      </section>

      <section className="faixa mt-6 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <form onSubmit={(e) => { e.preventDefault(); void salvar(c, c.ligada ? "Agenda salva. Os clientes já podem marcar." : "Agenda salva (desligada)."); }} className="min-w-0 self-start rounded-2xl bg-[var(--cinza)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.4rem]">Como a sua agenda funciona</h2>
            <button type="button" role="switch" aria-checked={c.ligada} onClick={() => muda({ ligada: !c.ligada })} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${c.ligada ? "bg-[#16A34A] text-white" : "bg-[var(--surface-dim)] text-[var(--tinta-2)]"}`}>
              <span className={`inline-block h-4 w-7 rounded-full p-0.5 ${c.ligada ? "bg-white/30" : "bg-black/15"}`}><span className={`block h-3 w-3 rounded-full bg-white transition ${c.ligada ? "translate-x-3" : ""}`} /></span>
              {c.ligada ? "Agenda ligada" : "Agenda desligada"}
            </button>
          </div>

          <h3 className="mt-5 text-[1.05rem] font-semibold">Serviços</h3>
          <p className="text-sm text-[var(--tinta-2)]">O que o cliente pode marcar, quanto tempo leva e o preço (opcional, aparece para o cliente). Até {MAX_SERVICOS}.</p>
          <ul className="mt-2 space-y-2">
            {c.servicos.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-xl bg-[var(--surface)] p-2 sm:grid-cols-[1fr_7.5rem_7.5rem_auto]">
                <input value={s.nome} onChange={(e) => mudaServico(i, { nome: e.target.value.slice(0, 50) })} placeholder="Ex.: Corte masculino" aria-label="Nome do serviço" className="col-span-3 min-w-0 rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[16px] sm:col-span-1 sm:text-[15px]" />
                <select value={s.duracao} onChange={(e) => mudaServico(i, { duracao: Number(e.target.value) })} aria-label="Duração" className="min-w-0 rounded-lg border border-[var(--line-strong)] bg-white px-2 py-2 text-[16px] sm:text-[15px]">
                  {DURACOES.map((d) => <option key={d} value={d}>{duracaoTexto(d)}</option>)}
                </select>
                <input value={s.preco} onChange={(e) => mudaServico(i, { preco: e.target.value.slice(0, 30) })} placeholder="R$ 40" aria-label="Preço (opcional)" className="min-w-0 rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[16px] sm:text-[15px]" />
                <button type="button" onClick={() => muda({ servicos: c.servicos.filter((_, j) => j !== i) })} aria-label={`Tirar ${s.nome || "o serviço"}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#9B1C1C] hover:bg-[#FDECEC]">Tirar</button>
              </li>
            ))}
          </ul>
          {c.servicos.length === 0 && <p className="mt-2 rounded-xl border-2 border-dashed border-[var(--linha)] p-4 text-center text-sm text-[var(--tinta-2)]">Nenhum serviço ainda. Comece pelo que você mais atende.</p>}
          {c.servicos.length < MAX_SERVICOS && <button type="button" onClick={() => muda({ servicos: [...c.servicos, { id: `s${Date.now().toString(36)}`, nome: "", duracao: 30, preco: "" }] })} className="btn btn-claro mt-2 !py-2 text-sm">+ Adicionar serviço</button>}

          <h3 className="mt-6 text-[1.05rem] font-semibold">Dias e horários de atendimento</h3>
          <ul className="mt-2 space-y-1.5">
            {ORDEM_DIAS.map((d) => {
              const h = c.horarios[String(d)], temPausa = !!(h.pausaIni && h.pausaFim);
              return (
                <li key={d} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2 ${h.aberto ? "bg-[var(--surface)]" : "bg-transparent"}`}>
                  <label className="flex w-28 items-center gap-2 text-[15px] font-semibold"><input type="checkbox" checked={h.aberto} onChange={(e) => mudaDia(d, { aberto: e.target.checked })} className="h-4 w-4" />{NOMES_DIAS[d]}</label>
                  {h.aberto ? (
                    <>
                      <span className="flex items-center gap-1.5 text-sm"><HoraSelect valor={h.ini} mudar={(x) => mudaDia(d, { ini: x })} rotulo={`${NOMES_DIAS[d]}: abre às`} />às<HoraSelect valor={h.fim} mudar={(x) => mudaDia(d, { fim: x })} rotulo={`${NOMES_DIAS[d]}: fecha às`} /></span>
                      <label className="flex items-center gap-1.5 text-sm text-[var(--tinta-2)]"><input type="checkbox" checked={temPausa} onChange={(e) => mudaDia(d, e.target.checked ? { pausaIni: "12:00", pausaFim: "13:00" } : { pausaIni: undefined, pausaFim: undefined })} />pausa</label>
                      {temPausa && <span className="flex items-center gap-1.5 text-sm text-[var(--tinta-2)]"><HoraSelect valor={h.pausaIni} mudar={(x) => mudaDia(d, { pausaIni: x })} rotulo={`${NOMES_DIAS[d]}: pausa começa`} />às<HoraSelect valor={h.pausaFim} mudar={(x) => mudaDia(d, { pausaFim: x })} rotulo={`${NOMES_DIAS[d]}: pausa termina`} /></span>}
                    </>
                  ) : <span className="text-sm text-[var(--tinta-2)]">Fechado</span>}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="campo">Horários de
              <select value={c.passo} onChange={(e) => muda({ passo: Number(e.target.value) })}>{PASSOS.map((p) => <option key={p} value={p}>{p} em {p} min</option>)}</select>
            </label>
            <label className="campo">Antecedência mínima
              <select value={c.antecedenciaMin} onChange={(e) => muda({ antecedenciaMin: Number(e.target.value) })}>{ANTECEDENCIAS.map((a) => <option key={a.min} value={a.min}>{a.nome}</option>)}</select>
            </label>
            <label className="campo">Marcar até
              <select value={c.diasFrente} onChange={(e) => muda({ diasFrente: Number(e.target.value) })}>{DIAS_FRENTE.map((d) => <option key={d} value={d}>{d} dias à frente</option>)}</select>
            </label>
          </div>

          {erro && <p className="mt-4 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
          {aviso && <p className="mt-4 rounded-lg bg-[#E3F6EA] px-3 py-2 text-sm text-[#166534]">{aviso}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={salvando || !mudou} className="btn btn-azul flex-1">{salvando ? "Salvando…" : mudou ? "Salvar a agenda" : "Tudo salvo"}</button>
            {mudou && <button type="button" onClick={() => { setRascunho(null); setErro(null); }} className="btn btn-linha">Desfazer</button>}
          </div>
        </form>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[1.3rem]">Próximos horários</h2>
            <span className="text-sm text-[var(--tinta-2)]">{dados.proximos.length} marcado{dados.proximos.length === 1 ? "" : "s"}</span>
          </div>
          {!dados.usavel && <p className="mt-3 rounded-xl bg-[#FFF4DB] px-3 py-2 text-sm text-[#6B4A00]">A agenda está {dados.config.ligada ? "sem serviço ou sem dia aberto" : "desligada"}: ninguém consegue marcar agora.</p>}
          {grupos.length === 0 && <div className="mt-3 rounded-2xl border-2 border-dashed border-[var(--linha)] p-7 text-center"><b>Nenhum horário marcado.</b><p className="mt-1 text-sm text-[var(--tinta-2)]">Quando alguém marcar pelo mapa, pela página da loja ou pela atendente, aparece aqui e no sino.</p></div>}
          <div className="mt-3 space-y-4">
            {grupos.map((g) => (
              <div key={g.dia}>
                <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--tinta-2)]">{g.rotulo}</div>
                <ul className="mt-1.5 space-y-2">{g.itens.map((a) => <ItemAgenda key={a.id} a={a} acao={acao} />)}</ul>
              </div>
            ))}
          </div>
          {dados.historico.length > 0 && (
            <>
              <h2 className="mt-8 text-[1.15rem]">Últimos 30 dias</h2>
              <ul className="mt-2 space-y-2">{dados.historico.map((a) => <ItemAgenda key={a.id} a={a} acao={acao} />)}</ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function ItemAgenda({ a, acao }: { a: Ag; acao: (a: Ag, q: "cancelar" | "concluido" | "faltou") => void }) {
  const href = linkContato(a.contato);
  return (
    <li className={`equipe-entra rounded-2xl border border-[var(--linha)] p-3 ${a.status === "cancelado" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><b className="tabular-nums">{a.quando.split(" · ")[1] ?? a.quando}</b><span className="font-semibold">{a.servico}</span>{a.preco && <span className="text-sm text-[var(--tinta-2)]">{a.preco}</span>}</div>
          <div className="text-sm">{a.nome}{a.origem === "atendente" && <span className="ml-2 rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-bold text-[#6B21A8]">marcado pela atendente de IA</span>}</div>
          {a.status !== "marcado" && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_STATUS[a.status] ?? ""}`}>{NOMES_STATUS[a.status] ?? a.status}{a.status === "cancelado" && a.canceladoPor ? (a.canceladoPor === "dono" ? " por você" : " pelo cliente") : ""} · {a.quando.split(" · ")[0]}</span>}
          {a.obs && <p className="mt-1 text-[14px] text-[var(--tinta-2)]">“{a.obs}”</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {href ? <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-[#E3F6EA] px-3 py-2 text-[#166534]">{a.contato}</a> : <span className="rounded-lg bg-[var(--cinza)] px-3 py-2">{a.contato}</span>}
          {a.status === "marcado" && !a.passou && <button type="button" onClick={() => void acao(a, "cancelar")} className="rounded-lg bg-[#FDECEC] px-3 py-2 text-[#9B1C1C]">Cancelar</button>}
          {a.status === "marcado" && a.passou && <>
            <button type="button" onClick={() => void acao(a, "concluido")} className="rounded-lg bg-[#E3F6EA] px-3 py-2 text-[#166534]">Atendido</button>
            <button type="button" onClick={() => void acao(a, "faltou")} className="rounded-lg bg-[#FFF4DB] px-3 py-2 text-[#7A5A00]">Faltou</button>
          </>}
        </div>
      </div>
    </li>
  );
}
