"use client";
// Minha equipe › Vagas (12/11/2026): o dono abre até 5 vagas, edita, fecha ou reabre, e lê as candidaturas.
// Cada vaga aberta acende a placa "Estamos contratando" na fachada do prédio no mapa e aparece em /encontrar?tipo=vagas.
import { useEffect, useState } from "react";
import { NOME_MODELO } from "../../_vagas";

type Candidatura = { id: string; vagaId: string; mensagem: string; contato: string; criadoEm: string; nome: string | null; profissao: string | null; usuarioId: string };
type Vaga = { id: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; aberta: boolean; criadoEm: string; candidatos: number; candidaturas: Candidatura[] };
type Rascunho = { id?: string; cargo: string; descricao: string; modelo: string; local: string; salario: string; aberta: boolean };
const VAZIO: Rascunho = { cargo: "", descricao: "", modelo: "presencial", local: "", salario: "", aberta: true };
const MAX = 5;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}
// contato da candidatura vira link: e-mail → mailto, telefone → WhatsApp
function linkContato(c: string) {
  if (/@/.test(c) && !/\s/.test(c.trim())) return `mailto:${c.trim()}`;
  const n = c.replace(/\D/g, "");
  if (n.length >= 10 && n.length <= 13) return `https://wa.me/${n.length <= 11 ? `55${n}` : n}`;
  return null;
}
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function VagasDono({ empresa, numero }: { empresa: string; numero: number | null }) {
  const [lista, setLista] = useState<Vaga[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [r, setR] = useState<Rascunho>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null); // vaga com as candidaturas abertas
  useEffect(() => {
    let vivo = true;
    api<Vaga[]>("/api/workend/vagas/minhas").then((v) => { if (vivo) { setLista(v); setErroLista(null); } }).catch((e) => vivo && setErroLista((e as Error).message));
    return () => { vivo = false; };
  }, [versao]);
  const abertas = lista?.filter((v) => v.aberta).length ?? 0;
  const editando = !!r.id;
  const salvar = async (d: Rascunho, msg: string) => {
    setSalvando(true); setErro(null); setAviso(null);
    try { await api("/api/workend/vagas", { method: "POST", body: JSON.stringify(d) }); setAviso(msg); setR(VAZIO); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  };
  const editar = (v: Vaga) => { setR({ id: v.id, cargo: v.cargo, descricao: v.descricao, modelo: v.modelo, local: v.local, salario: v.salario, aberta: v.aberta }); setErro(null); setAviso(null); };
  const alternar = (v: Vaga) => salvar({ id: v.id, cargo: v.cargo, descricao: v.descricao, modelo: v.modelo, local: v.local, salario: v.salario, aberta: !v.aberta }, v.aberta ? `A vaga de ${v.cargo} foi fechada.` : `A vaga de ${v.cargo} está aberta de novo.`);
  const podeCriar = editando || abertas < MAX;

  return (
    <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <form onSubmit={(e) => { e.preventDefault(); if (podeCriar) void salvar(r, editando ? "Vaga atualizada." : "Vaga aberta! A placa “Estamos contratando” já aparece no seu prédio."); }} className="self-start rounded-2xl bg-[var(--cinza)] p-6">
        <h2 className="text-[1.4rem]">{editando ? "Editar a vaga" : "Abrir uma vaga"}</h2>
        <p className="mt-1 text-sm text-[var(--tinta-2)]">Enquanto a {empresa} tiver vaga aberta, o prédio ganha a placa <b>“Estamos contratando”</b> na fachada do mapa, e a vaga aparece na busca de profissionais (Encontrar › Vagas){numero != null && <> e na <a href={`/loja/${numero}#vagas`} className="font-semibold text-[var(--azul)] hover:underline">página da loja</a></>}. Até {MAX} vagas abertas.</p>
        <div className="mt-4 space-y-3">
          <label className="campo">Cargo
            <input value={r.cargo} onChange={(e) => setR({ ...r, cargo: e.target.value.slice(0, 60) })} placeholder="Ex.: Atendente de balcão" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="campo">Modelo
              <select value={r.modelo} onChange={(e) => setR({ ...r, modelo: e.target.value })}>
                {Object.entries(NOME_MODELO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label className="campo">Cidade ou bairro
              <input value={r.local} onChange={(e) => setR({ ...r, local: e.target.value.slice(0, 60) })} placeholder="Ex.: Lagarto (SE)" />
            </label>
          </div>
          <label className="campo">Salário ou pagamento (opcional)
            <input value={r.salario} onChange={(e) => setR({ ...r, salario: e.target.value.slice(0, 60) })} placeholder="Ex.: R$ 1.800 + comissão" />
          </label>
          <label className="campo">O que a pessoa vai fazer e o que precisa saber
            <textarea rows={5} value={r.descricao} onChange={(e) => setR({ ...r, descricao: e.target.value.slice(0, 600) })} placeholder={"Ex.: Atender no balcão e pelo WhatsApp, de segunda a sábado, das 7h às 15h.\nExperiência com caixa é um diferencial."} />
          </label>
        </div>
        {!podeCriar && <p className="mt-3 rounded-lg bg-[#FFF4DB] px-3 py-2 text-sm text-[#6B4A00]">Você já tem {MAX} vagas abertas. Feche uma para abrir outra.</p>}
        {erro && <p className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
        {aviso && <p className="mt-3 rounded-lg bg-[#E3F6EA] px-3 py-2 text-sm text-[#166534]">{aviso}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={salvando || !podeCriar || r.cargo.trim().length < 3} className="btn btn-azul flex-1">{salvando ? "Salvando…" : editando ? "Salvar a vaga" : "Abrir a vaga"}</button>
          {editando && <button type="button" onClick={() => { setR(VAZIO); setErro(null); }} className="btn btn-linha">Cancelar</button>}
        </div>
      </form>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.3rem]">Suas vagas</h2>
          {lista && <span className="text-sm text-[var(--tinta-2)]">{abertas} de {MAX} abertas</span>}
        </div>
        {erroLista && !lista && <p className="mt-3 text-[var(--tinta-2)]">{erroLista}</p>}
        {!lista && !erroLista && <p className="mt-3 text-[var(--tinta-2)]">Carregando…</p>}
        {lista?.length === 0 && (
          <div className="mt-3 rounded-2xl border-2 border-dashed border-[var(--linha)] p-7 text-center">
            <b>Nenhuma vaga ainda.</b>
            <p className="mt-1 text-sm text-[var(--tinta-2)]">Quem visita o mapa e procura trabalho em Encontrar vê as vagas abertas e se candidata em um minuto. As candidaturas chegam aqui.</p>
          </div>
        )}
        <ul className="mt-3 space-y-3">
          {lista?.map((v) => (
            <li key={v.id} className={`equipe-entra rounded-2xl border p-4 transition ${r.id === v.id ? "border-[var(--azul)] shadow-md" : "border-[var(--linha)]"} ${v.aberta ? "bg-[var(--surface)]" : "bg-[var(--cinza)] opacity-80"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[17px]">{v.cargo}</b>
                    {v.aberta
                      ? <span className="rounded-full bg-[#FFF4DB] px-2 py-0.5 text-[11px] font-bold text-[#7A5A00]"><span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#E8A317] align-middle" />Aberta · na fachada</span>
                      : <span className="rounded-full bg-[var(--surface-dim)] px-2 py-0.5 text-[11px] font-bold text-[var(--tinta-2)]">Fechada</span>}
                  </div>
                  <span className="text-[13px] text-[var(--tinta-2)]">{NOME_MODELO[v.modelo] ?? v.modelo}{v.local && ` · ${v.local}`}{v.salario && ` · ${v.salario}`} · desde {data(v.criadoEm)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  <button type="button" onClick={() => editar(v)} className="rounded-lg bg-[#EEF3FF] px-3 py-2 text-[#1D4ED8]">Editar</button>
                  <button type="button" disabled={salvando || (!v.aberta && abertas >= MAX)} onClick={() => void alternar(v)} className="rounded-lg bg-[var(--cinza)] px-3 py-2 disabled:opacity-50" title={!v.aberta && abertas >= MAX ? `Já há ${MAX} vagas abertas` : undefined}>{v.aberta ? "Fechar" : "Reabrir"}</button>
                </div>
              </div>
              <button type="button" onClick={() => setAberta(aberta === v.id ? null : v.id)} disabled={!v.candidatos} className="mt-3 flex w-full items-center justify-between rounded-xl bg-[var(--cinza)] px-3 py-2 text-left text-sm font-semibold disabled:cursor-default">
                <span>{v.candidatos ? `${v.candidatos} ${v.candidatos === 1 ? "candidatura" : "candidaturas"}` : "Nenhuma candidatura ainda"}</span>
                {v.candidatos > 0 && <span className="text-[var(--azul)]">{aberta === v.id ? "esconder" : "ler"}</span>}
              </button>
              {aberta === v.id && (
                <ul className="mt-2 space-y-2">
                  {v.candidaturas.map((c) => {
                    const href = linkContato(c.contato);
                    return (
                      <li key={c.id} className="equipe-entra rounded-xl border border-[var(--linha)] p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2"><b>{c.nome ?? "Candidato"}{c.profissao && <span className="font-normal text-[var(--tinta-2)]"> · {c.profissao}</span>}</b><small className="text-[var(--tinta-2)]">{data(c.criadoEm)}</small></div>
                        <p className="mt-1 whitespace-pre-line text-[14px]">{c.mensagem}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-semibold">
                          {href ? <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-[#E3F6EA] px-3 py-1.5 text-[#166534]">Responder: {c.contato}</a> : <span className="rounded-lg bg-[var(--cinza)] px-3 py-1.5">Contato: {c.contato}</span>}
                          <a href={`/app/rede?com=${encodeURIComponent(c.usuarioId)}`} className="rounded-lg bg-[#EEF3FF] px-3 py-1.5 text-[#1D4ED8]">Conversar no WorkEnd</a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
