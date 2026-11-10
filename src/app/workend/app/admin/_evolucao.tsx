"use client";
// Admin: evolução automática das skills dos especialistas (os agentes treinam e avaliam uns aos outros).
import { useCallback, useEffect, useState } from "react";

interface Ciclo { id: string; inicio: string; fim: string | null; status: string; origem: string; avaliadas: number; melhoradas: number; custoBrl: string; erro: string | null }
interface Mudanca { especialistaId: string; agente: string; skill: string; versao: number; notaAntes: string | null; notaDepois: string | null; placar: string | null; motivo: string | null; revisores: string | null; ativa: boolean; criadoEm: string }
interface Config { ligada: boolean; intervaloHoras: number; skillsPorCiclo: number; tetoCicloBrl: number; tetoMesBrl: number; modelo: string; modeloJuiz: string }
interface Painel { config: Config; rodando: boolean; ia: boolean; gastoMes: number; ciclos: Ciclo[]; mudancas: Mudanca[]; totais: { adotadas: number; mantidas: number; erros: number; skills: number; totalSkills: number }; estimativaCiclo: number; modelos: string[] }

const brl = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const SITUACAO: Record<string, string> = { rodando: "rodando…", concluido: "concluído", teto: "parou no teto de gasto", erro: "erro" };

export function EvolucaoAdmin() {
  const [p, setP] = useState<Painel | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => { const r = await fetch("/api/admin/evolucao"); if (r.ok) { const j = (await r.json()) as Painel; setP(j); setCfg((c) => c ?? j.config); } }, []);
  useEffect(() => { const t0 = setTimeout(carregar, 0); const t = setInterval(carregar, 20000); return () => { clearTimeout(t0); clearInterval(t); }; }, [carregar]);
  const post = async (body: unknown) => { const r = await fetch("/api/admin/evolucao", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`); return j; };
  const salvar = async (c: Partial<Config>) => { try { const j = (await post({ acao: "config", config: c })) as Config; setCfg(j); setAviso("Configuração salva."); await carregar(); } catch (e) { setAviso((e as Error).message); } };
  const rodar = async () => { try { await post({ acao: "rodar" }); setAviso("Ciclo iniciado. Leva alguns minutos e esta área se atualiza sozinha."); await carregar(); } catch (e) { setAviso((e as Error).message); } };
  const voltar = async (m: Mudanca) => { if (!window.confirm(`Voltar “${m.skill}” (${m.agente}) para a versão anterior?`)) return; try { await post({ acao: "voltar", especialistaId: m.especialistaId, skill: m.skill }); setAviso("Versão anterior restaurada."); await carregar(); } catch (e) { setAviso((e as Error).message); } };
  const campo = (k: keyof Config, rotulo: string, passo = "1") => cfg && (
    <label className="flex flex-col gap-1 text-xs text-[var(--tinta-2)]">{rotulo}
      <input type="number" step={passo} value={String(cfg[k])} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} className="w-28 rounded-lg border border-[var(--linha)] bg-white px-2 py-1.5 text-sm text-[var(--tinta)]" />
    </label>
  );
  return (
    <section className="faixa mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.4rem]">Evolução das skills</h2>
          <p className="mt-1 max-w-[75ch] text-sm text-[var(--tinta-2)]">Os especialistas treinam e avaliam uns aos outros: o gerente do setor cria casos reais, o especialista responde, o gerente e o Compliance criticam, o próprio especialista reescreve a skill e as duas versões são comparadas às cegas. A nova só entra se vencer e não quebrar nenhum limite do cargo. Os limites nunca mudam sozinhos.</p>
        </div>
        {p && cfg && (
          <div className="flex gap-2">
            <button onClick={() => salvar({ ligada: !cfg.ligada })} className={`btn ${cfg.ligada ? "btn-linha" : "btn-azul"}`}>{cfg.ligada ? "Desligar" : "Ligar"}</button>
            <button onClick={rodar} disabled={p.rodando || !p.ia} className="btn btn-azul disabled:opacity-50">{p.rodando ? "Rodando…" : "Rodar agora"}</button>
          </div>
        )}
      </div>
      {aviso && <div className="mt-3 rounded-xl bg-[var(--cinza)] px-3 py-2 text-sm">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">fechar</button></div>}
      {!p ? <p className="mt-4 text-sm text-[var(--tinta-2)]">Carregando…</p> : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[["Situação", cfg?.ligada ? (p.rodando ? "rodando agora" : "ligada") : "desligada"], ["Skills já avaliadas", `${p.totais.skills} de ${p.totais.totalSkills}`], ["Melhoradas · mantidas", `${p.totais.adotadas} · ${p.totais.mantidas}`], ["Gasto no mês", `${brl(p.gastoMes)} de ${brl(p.config.tetoMesBrl)}`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-[var(--cinza)] p-4"><div className="text-xs text-[var(--tinta-2)]">{k}</div><div className="mt-1 text-lg font-semibold">{v}</div></div>
            ))}
          </div>
          {!p.ia && <p className="mt-3 text-sm text-[#8A2A2A]">A chave da OpenAI não está configurada: a evolução fica parada.</p>}
          {cfg && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--linha)] p-4">
              {campo("intervaloHoras", "A cada (horas)")}
              {campo("skillsPorCiclo", "Skills por ciclo")}
              {campo("tetoCicloBrl", "Teto por ciclo (R$)", "0.1")}
              {campo("tetoMesBrl", "Teto do mês (R$)", "1")}
              <label className="flex flex-col gap-1 text-xs text-[var(--tinta-2)]">Modelo
                <select value={cfg.modelo} onChange={(e) => setCfg({ ...cfg, modelo: e.target.value })} className="rounded-lg border border-[var(--linha)] bg-white px-2 py-1.5 text-sm text-[var(--tinta)]">{p.modelos.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--tinta-2)]">Avaliador
                <select value={cfg.modeloJuiz} onChange={(e) => setCfg({ ...cfg, modeloJuiz: e.target.value })} className="rounded-lg border border-[var(--linha)] bg-white px-2 py-1.5 text-sm text-[var(--tinta)]">{p.modelos.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
              <button onClick={() => salvar(cfg)} className="btn btn-linha">Salvar</button>
              <p className="w-full text-xs text-[var(--tinta-2)]">Estimativa: cerca de {brl(p.estimativaCiclo)} por ciclo com o modelo gpt-4.1-mini. Com um ciclo por dia, as {p.totais.totalSkills} skills passam pelo treino a cada {Math.ceil(p.totais.totalSkills / Math.max(1, cfg.skillsPorCiclo))} ciclos, mais ou menos.</p>
            </div>
          )}
          <h3 className="mt-6 text-base font-semibold">Ciclos recentes</h3>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--linha)]">
            <table className="w-full text-sm"><thead className="bg-[var(--cinza)] text-left text-xs text-[var(--tinta-2)]"><tr><th className="p-3">Quando</th><th className="p-3">Origem</th><th className="p-3">Situação</th><th className="p-3">Avaliadas</th><th className="p-3">Melhoradas</th><th className="p-3">Custo</th></tr></thead>
              <tbody>
                {p.ciclos.length === 0 && <tr><td colSpan={6} className="p-3 text-[var(--tinta-2)]">Nenhum ciclo ainda. O primeiro roda sozinho poucos minutos depois de ligar, ou clique em “Rodar agora”.</td></tr>}
                {p.ciclos.map((c) => <tr key={c.id} className="border-t border-[var(--linha)]"><td className="p-3">{dt(c.inicio)}</td><td className="p-3">{c.origem === "manual" ? "manual" : "automático"}</td><td className="p-3">{SITUACAO[c.status] ?? c.status}{c.erro ? <span className="block text-xs text-[#8A2A2A]">{c.erro}</span> : null}</td><td className="p-3">{c.avaliadas}</td><td className="p-3">{c.melhoradas}</td><td className="p-3">{brl(c.custoBrl)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <h3 className="mt-6 text-base font-semibold">Skills que evoluíram</h3>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--linha)]">
            <table className="w-full text-sm"><thead className="bg-[var(--cinza)] text-left text-xs text-[var(--tinta-2)]"><tr><th className="p-3">Quando</th><th className="p-3">Agente</th><th className="p-3">Skill</th><th className="p-3">Placar</th><th className="p-3">Nota</th><th className="p-3">O que mudou</th><th className="p-3"></th></tr></thead>
              <tbody>
                {p.mudancas.length === 0 && <tr><td colSpan={7} className="p-3 text-[var(--tinta-2)]">Nenhuma skill mudou ainda.</td></tr>}
                {p.mudancas.map((m) => (
                  <tr key={`${m.especialistaId}-${m.skill}-${m.versao}`} className="border-t border-[var(--linha)] align-top">
                    <td className="p-3 whitespace-nowrap">{dt(m.criadoEm)}</td><td className="p-3">{m.agente}</td>
                    <td className="p-3">{m.skill} <span className="text-xs text-[var(--tinta-2)]">v{m.versao}{m.ativa ? " · em uso" : " · substituída"}</span></td>
                    <td className="p-3 whitespace-nowrap">{m.placar ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">{m.notaAntes ?? "—"} → {m.notaDepois ?? "—"}</td>
                    <td className="p-3 text-xs">{m.motivo}{m.revisores ? <span className="block text-[var(--tinta-2)]">Revisão: {m.revisores}</span> : null}</td>
                    <td className="p-3">{m.ativa && <button onClick={() => voltar(m)} className="rounded-lg border border-[var(--linha)] px-2 py-1 text-xs">Voltar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
