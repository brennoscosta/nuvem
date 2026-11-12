"use client";
// Minha equipe (11/11/2026): o dono conversa com cada pessoa da equipe de IA do lote, aprova ou corrige as respostas
// (a correção vira regra), pede o relatório da semana ao CEO, lê as conversas dos visitantes da loja e escreve o
// "Sobre a empresa" que a equipe e a página pública usam. Dados: /api/workend/equipe* (src/server/equipeCliente.ts).
// Aba Vagas (12/11/2026): o dono abre vagas e lê as candidaturas (src/server/cidade.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VagasDono } from "./_vagas-dono";

type Regra = { id: string; texto: string };
type Membro = {
  membroId: string; nome: string; cargo: string; papel: "atendente" | "ceo" | "profissional"; setor: string; boneco: string; camisa: string;
  foto: string | null; especialista: { cargo: string; habilidades: string[] } | null; saudacao: string; treino: string; atendeVisitantes: boolean;
  ultima: { texto: string; deQuem: "voce" | "equipe"; em: string } | null; regras: Regra[];
};
type Contatos = { whatsapp?: string; instagram?: string; site?: string; email?: string };
type Painel = {
  lote: { chave: string; numero: number | null; empresaNome: string; cor: string; nicho: string; pagoAte: string | null };
  sobre: string; contatos: Contatos; equipe: Membro[];
  gasto: { mes: number; teto: number; aviso: boolean; esgotado: boolean };
  visitantes: { total: number; ultimas24h: number }; ia: boolean;
};
type Msg = { id: string; papel: string; conteudo: string; avaliacao: number | null; correcao: string | null; em: string };
type Visitante = { visitanteId: string; nome: string | null; n: number; ultimaEm: string; ultimaFala: string | null };
type FalaVisita = { id: string; papel: string; conteudo: string; quem: string; criadoEm: string };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (iso: string) => {
  const d = new Date(iso), dif = Date.now() - d.getTime();
  if (dif < 60_000) return "agora";
  if (dif < 3600_000) return `há ${Math.floor(dif / 60_000)} min`;
  if (dif < 86400_000) return `há ${Math.floor(dif / 3600_000)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const MES = () => new Date().toLocaleDateString("pt-BR", { month: "long" });
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}

// sugestões de pedido por papel: o dono não começa da página em branco
function sugestoes(m: Membro, empresa: string): string[] {
  if (m.papel === "ceo") return [`Monte o plano desta semana para a ${empresa}`, "Quais 3 coisas eu devo resolver primeiro?", "O que a equipe precisa saber sobre a empresa?"];
  if (m.papel === "atendente") return ["Como você responderia quem pede preço?", "Escreva a mensagem de boas-vindas da loja", "Quais perguntas os clientes mais fazem?"];
  if (m.especialista) return m.especialista.habilidades.slice(0, 3).map((h) => `${h} para a ${empresa}`);
  return [`O que você pode fazer pela ${empresa}?`, "Me mande um plano do seu trabalho para este mês"];
}

function Avatar({ m, tamanho = 44 }: { m: Pick<Membro, "nome" | "camisa" | "foto" | "papel">; tamanho?: number }) {
  if (m.foto) return <img src={m.foto} alt="" width={tamanho} height={tamanho} className="shrink-0 rounded-full object-cover shadow-[0_0_0_2px_#fff]" style={{ width: tamanho, height: tamanho }} />;
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[0_0_0_2px_#fff]" style={{ width: tamanho, height: tamanho, background: m.camisa, fontSize: tamanho * 0.4 }}>
      {m.nome.slice(0, 1).toUpperCase()}
      {m.papel !== "profissional" && <span className="absolute -bottom-0.5 -right-0.5 rounded-full px-1 text-[8px] font-black leading-[14px] text-white" style={{ background: m.papel === "ceo" ? "#D4A017" : "#16A34A" }}>{m.papel === "ceo" ? "CEO" : "ATD"}</span>}
    </span>
  );
}

// texto da IA: quebras de linha, **negrito** e listas simples, sem HTML vindo de fora
function Texto({ t }: { t: string }) {
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {t.split(/\n{2,}/).map((bloco, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {bloco.replace(/^#{1,4}\s*/gm, "").split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : <span key={k}>{p}</span>))}
        </p>
      ))}
    </div>
  );
}

type AbaEquipe = "conversas" | "visitantes" | "vagas" | "sobre";
export function EquipePainel({ chaveInicial, membroInicial, abaInicial }: { chaveInicial: string | null; membroInicial: string | null; abaInicial?: AbaEquipe }) {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaEquipe>(abaInicial ?? "conversas");
  const [sel, setSel] = useState<string | null>(membroInicial);
  const lote = p?.lote.chave ?? chaveInicial;
  const q = lote ? `lote=${encodeURIComponent(lote)}` : "";

  // recarregar = pedir uma versão nova; a busca roda no efeito e só grava o estado quando a resposta chega
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(async () => { setVersao((v) => v + 1); }, []);
  useEffect(() => {
    let vivo = true;
    api<Painel>(`/api/workend/equipe?${q}`)
      .then((d) => { if (!vivo) return; setP(d); setErro(null); setSel((s) => s ?? d.equipe[0]?.membroId ?? null); })
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, versao]);

  if (erro && !p) return <div className="faixa mt-6"><div className="rounded-2xl bg-[var(--cinza)] p-7"><h2 className="text-[1.4rem]">Minha equipe</h2><p className="mt-2 text-[var(--tinta-2)]">{erro}</p><Link href="/mundo" className="btn btn-azul mt-5">Ir para o mapa</Link></div></div>;
  if (!p) return <div className="faixa mt-6 text-[var(--tinta-2)]">Carregando a sua equipe…</div>;
  const membro = p.equipe.find((m) => m.membroId === sel) ?? p.equipe[0];
  const pct = Math.min(100, (p.gasto.mes / p.gasto.teto) * 100);

  return (
    <div className="faixa mt-2">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--azul)]">Lote {p.lote.numero} · {p.lote.nicho}</span>
          <h1 className="mt-1 text-[2rem] lg:text-[2.6rem]">Equipe da {p.lote.empresaNome}</h1>
          <p className="mt-2 max-w-[62ch] text-[var(--tinta-2)]">Converse com cada pessoa, aprove ou corrija o que ela entrega e peça o relatório da semana ao CEO. A atendente já responde quem entra na sua loja pelo mapa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.lote.numero && <Link href={`/loja/${p.lote.numero}`} className="btn btn-linha">Ver minha loja</Link>}
          <Link href={`/mundo?lote=${encodeURIComponent(p.lote.chave)}`} className="btn btn-claro">Montar escritório</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-[var(--cinza)] p-5 md:col-span-2">
          <div className="flex items-baseline justify-between gap-3"><b>IA usada em {MES()}</b><span className="text-sm text-[var(--tinta-2)]">{brl(p.gasto.mes)} de {brl(p.gasto.teto)}</span></div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-dim)]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, pct)}%`, background: p.gasto.esgotado ? "#E2575B" : p.gasto.aviso ? "#E8A317" : "var(--azul)" }} /></div>
          <p className="mt-2 text-[13px] text-[var(--tinta-2)]">{p.gasto.esgotado ? "Os R$ 10 do mês acabaram: a equipe volta a responder no dia 1º. Os visitantes continuam deixando recado." : p.gasto.aviso ? "Perto do limite do mês. Prefira pedidos completos numa mensagem só." : "Cada lote tem R$ 10 de IA por mês, incluídos no aluguel. Uma conversa comum gasta poucos centavos."}</p>
        </div>
        <button type="button" onClick={() => setAba("visitantes")} className="rounded-2xl border border-[var(--linha)] bg-[var(--surface)] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
          <b className="text-[2rem] leading-none">{p.visitantes.total}</b>
          <span className="mt-1 block font-semibold">{p.visitantes.total === 1 ? "visitante conversou" : "visitantes conversaram"} com a loja</span>
          <span className="text-[13px] text-[var(--tinta-2)]">{p.visitantes.ultimas24h ? `${p.visitantes.ultimas24h} nas últimas 24 horas · ver conversas` : "ver conversas"}</span>
        </button>
      </section>

      <nav className="sem-barra mt-7 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-dim)] p-1 text-sm font-semibold sm:w-max" aria-label="Seções da equipe">
        {([["conversas", "Conversas com a equipe"], ["visitantes", `Visitantes (${p.visitantes.total})`], ["vagas", "Vagas"], ["sobre", "Sobre a empresa"]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setAba(k)} className={`flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 transition sm:flex-none ${aba === k ? "bg-[var(--surface)] shadow" : "text-[var(--tinta-2)] hover:text-[var(--tinta)]"}`}>{t}</button>
        ))}
      </nav>

      {!p.sobre && aba !== "sobre" && (
        <button type="button" onClick={() => setAba("sobre")} className="mt-4 w-full rounded-xl bg-[#FFF4DB] px-4 py-3 text-left text-sm text-[#6B4A00]">
          <b>Conte para a equipe o que a {p.lote.empresaNome} faz.</b> Sem o “Sobre a empresa”, a atendente não sabe preços, horários nem serviços. Escrever leva 2 minutos →
        </button>
      )}

      {aba === "conversas" && membro && <Conversas p={p} membro={membro} q={q} selecionar={setSel} recarregar={carregar} />}
      {aba === "visitantes" && <Visitantes q={q} />}
      {aba === "vagas" && <VagasDono empresa={p.lote.empresaNome} numero={p.lote.numero} />}
      {aba === "sobre" && <Sobre p={p} lote={p.lote.chave} salvo={carregar} />}
    </div>
  );
}

function Conversas({ p, membro, q, selecionar, recarregar }: { p: Painel; membro: Membro; q: string; selecionar: (id: string) => void; recarregar: () => Promise<void> }) {
  // a conversa fica guardada com o id da pessoa: trocar de pessoa mostra "carregando" sem limpar o estado no efeito
  const [conv, setConv] = useState<{ de: string; msgs: Msg[] } | null>(null);
  const msgs = conv?.de === membro.membroId ? conv.msgs : null;
  const setMsgs = (f: (m: Msg[] | null) => Msg[]) => setConv((c) => ({ de: membro.membroId, msgs: f(c?.de === membro.membroId ? c.msgs : null) }));
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState<"msg" | "relatorio" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const chave = p.lote.chave;

  useEffect(() => {
    let vivo = true; const de = membro.membroId;
    api<Msg[]>(`/api/workend/equipe/chat?${q}&membro=${encodeURIComponent(de)}`).then((m) => vivo && setConv({ de, msgs: m })).catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [q, membro.membroId]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, enviando]);

  const enviar = async (t = texto) => {
    const pedido = t.trim(); if (!pedido || enviando) return;
    setEnviando("msg"); setErro(null); setTexto("");
    const provisoria: Msg = { id: `tmp-${Date.now()}`, papel: "user", conteudo: pedido, avaliacao: null, correcao: null, em: new Date().toISOString() };
    setMsgs((m) => [...(m ?? []), provisoria]);
    try {
      const r = await api<{ mensagem: Msg }>(`/api/workend/equipe/chat`, { method: "POST", body: JSON.stringify({ lote: chave, membro: membro.membroId, texto: pedido }) });
      setMsgs((m) => [...(m ?? []), r.mensagem]);
      void recarregar();
    } catch (e) { setErro((e as Error).message); setTexto(pedido); setMsgs((m) => (m ?? []).filter((x) => x.id !== provisoria.id)); }
    setEnviando(null);
  };
  const relatorio = async () => {
    setEnviando("relatorio"); setErro(null);
    try {
      const r = await api<{ membroId: string; mensagem: Msg }>(`/api/workend/equipe/relatorio`, { method: "POST", body: JSON.stringify({ lote: chave }) });
      if (r.membroId !== membro.membroId) selecionar(r.membroId); else setMsgs((m) => [...(m ?? []), { id: `tmp-r-${Date.now()}`, papel: "user", conteudo: "Me mande o relatório da semana.", avaliacao: null, correcao: null, em: new Date().toISOString() }, r.mensagem]);
      void recarregar();
    } catch (e) { setErro((e as Error).message); }
    setEnviando(null);
  };

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Pessoas da equipe">
        {p.equipe.map((m) => (
          <button key={m.membroId} type="button" onClick={() => { setErro(null); selecionar(m.membroId); }}
            className={`flex min-w-[230px] items-center gap-3 rounded-2xl border p-3 text-left transition lg:min-w-0 ${m.membroId === membro.membroId ? "border-[var(--azul)] bg-[var(--surface)] shadow-md" : "border-transparent bg-[var(--cinza)] hover:border-[var(--linha)]"}`}>
            <Avatar m={m} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{m.nome} <span className="font-normal text-[var(--tinta-2)]">· {m.cargo}</span></span>
              <span className="block truncate text-[12px] text-[var(--tinta-2)]">{m.ultima ? `${m.ultima.deQuem === "voce" ? "Você: " : ""}${m.ultima.texto}` : m.setor}</span>
            </span>
            {m.ultima && <span className="self-start text-[11px] text-[var(--tinta-2)]">{quando(m.ultima.em)}</span>}
          </button>
        ))}
        <Link href={`/mundo?lote=${encodeURIComponent(chave)}`} className="hidden rounded-2xl border-2 border-dashed border-[var(--linha)] p-3 text-center text-sm font-semibold text-[var(--azul)] lg:block">+ Contratar especialista no mapa</Link>
      </aside>

      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--linha)] bg-[var(--surface)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--linha)] p-4">
          <Avatar m={membro} tamanho={52} />
          <div className="min-w-0 flex-1">
            <b className="text-lg">{membro.nome}</b> <span className="text-[var(--tinta-2)]">· {membro.cargo}</span>
            <p className="line-clamp-2 text-[13px] text-[var(--tinta-2)]">{membro.treino || (membro.atendeVisitantes ? "Atende quem chega na loja pelo mapa." : "Ainda sem treino: diga o que essa pessoa faz em Montar escritório.")}</p>
          </div>
          {membro.papel === "ceo" && <button type="button" onClick={relatorio} disabled={!!enviando || p.gasto.esgotado} className="btn btn-tinta !py-2.5 text-sm">{enviando === "relatorio" ? "Escrevendo o relatório…" : "Pedir relatório da semana"}</button>}
        </header>

        {(membro.especialista || membro.regras.length > 0) && (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--linha)] bg-[var(--cinza)] px-4 py-2.5 text-[12px]">
            {membro.especialista?.habilidades.map((h) => <span key={h} className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-medium text-[var(--azul)]">{h}</span>)}
            {membro.regras.length > 0 && <Regras membro={membro} lote={chave} mudou={recarregar} />}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {msgs === null && !erro && <p className="text-sm text-[var(--tinta-2)]">Carregando a conversa…</p>}
          {msgs?.length === 0 && (
            <div className="mx-auto max-w-[46ch] py-8 text-center">
              <Avatar m={membro} tamanho={72} />
              <p className="mt-3 font-semibold">{membro.saudacao || `Oi! Sou ${membro.nome}. Em que posso ajudar a ${p.lote.empresaNome}?`}</p>
              <p className="mt-1 text-sm text-[var(--tinta-2)]">Peça uma tarefa como pediria a um funcionário. Ela responde com o material pronto.</p>
            </div>
          )}
          {msgs?.map((m) => <Bolha key={m.id} m={m} membro={membro} lote={chave} mudou={recarregar} />)}
          {enviando && <div className="flex items-center gap-2 text-sm text-[var(--tinta-2)]"><Avatar m={membro} tamanho={28} /><span className="equipe-digitando"><i /><i /><i /></span>{membro.nome} está {enviando === "relatorio" ? "escrevendo o relatório" : "trabalhando"}…</div>}
          <div ref={fim} />
        </div>

        <footer className="border-t border-[var(--linha)] p-3">
          {erro && <p className="mb-2 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
          {(msgs?.length ?? 0) < 2 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {sugestoes(membro, p.lote.empresaNome).map((s) => <button key={s} type="button" onClick={() => { setTexto(s); caixa.current?.focus(); }} className="rounded-full border border-[var(--linha)] px-3 py-1 text-[13px] hover:border-[var(--azul)] hover:text-[var(--azul)]">{s}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex items-end gap-2">
            <textarea ref={caixa} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              rows={2} placeholder={p.gasto.esgotado ? "Os R$ 10 de IA deste mês acabaram." : `Peça algo para ${membro.nome}…`} disabled={p.gasto.esgotado || !p.ia}
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--azul)]" />
            <button type="submit" disabled={!texto.trim() || !!enviando || p.gasto.esgotado} className="btn btn-azul !py-3.5">Enviar</button>
          </form>
        </footer>
      </div>
    </section>
  );
}

// resposta da equipe com aprovar / corrigir (a correção vira regra permanente daquela pessoa)
function Bolha({ m, membro, lote, mudou }: { m: Msg; membro: Membro; lote: string; mudou: () => Promise<void> }) {
  const [av, setAv] = useState(m.avaliacao);
  const [corrigindo, setCorrigindo] = useState(false);
  const [correcao, setCorrecao] = useState("");
  const [regra, setRegra] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (m.papel === "user") return <div className="equipe-entra ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[var(--azul)] px-4 py-2.5 text-[15px] text-white"><p className="whitespace-pre-wrap">{m.conteudo}</p></div>;
  const treinar = async (avaliacao: 1 | -1, texto?: string) => {
    if (m.id.startsWith("tmp")) return;
    setOcupado(true);
    try {
      const r = await api<{ regra: Regra | null }>(`/api/workend/equipe/treino`, { method: "POST", body: JSON.stringify({ lote, membro: membro.membroId, mensagemId: m.id, avaliacao, correcao: texto }) });
      setAv(avaliacao); setCorrigindo(false); if (r.regra) { setRegra(r.regra.texto); void mudou(); }
    } catch { /* mantém como estava */ }
    setOcupado(false);
  };
  return (
    <div className="equipe-entra flex max-w-[92%] gap-2.5">
      <Avatar m={membro} tamanho={32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-[var(--cinza)] px-4 py-3"><Texto t={m.conteudo} /></div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          <button type="button" disabled={ocupado} onClick={() => treinar(1)} className={`rounded-full px-2.5 py-1 font-semibold ${av === 1 ? "bg-[#E3F6EA] text-[#166534]" : "text-[var(--tinta-2)] hover:bg-[var(--cinza)]"}`}>{av === 1 ? "✓ Aprovado" : "Aprovar"}</button>
          <button type="button" disabled={ocupado} onClick={() => setCorrigindo((v) => !v)} className={`rounded-full px-2.5 py-1 font-semibold ${av === -1 ? "bg-[#FDECEC] text-[#9B1C1C]" : "text-[var(--tinta-2)] hover:bg-[var(--cinza)]"}`}>{av === -1 ? "Corrigido" : "Corrigir"}</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.conteudo); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="rounded-full px-2.5 py-1 font-semibold text-[var(--tinta-2)] hover:bg-[var(--cinza)]">{copiado ? "Copiado!" : "Copiar"}</button>
          <span className="text-[var(--tinta-2)]">{quando(m.em)}</span>
        </div>
        {corrigindo && (
          <form onSubmit={(e) => { e.preventDefault(); if (correcao.trim().length >= 4) void treinar(-1, correcao); }} className="mt-2 flex gap-2">
            <input value={correcao} onChange={(e) => setCorrecao(e.target.value.slice(0, 600))} autoFocus placeholder="O que estava errado? Ex.: nosso horário é das 7h às 19h" className="min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--azul)]" />
            <button type="submit" disabled={ocupado || correcao.trim().length < 4} className="btn btn-tinta !py-2 text-sm">{ocupado ? "Ensinando…" : "Ensinar"}</button>
          </form>
        )}
        {(regra || m.correcao) && <p className="mt-1.5 rounded-lg bg-[#EEF3FF] px-3 py-1.5 text-[12px] text-[var(--azul)]">{regra ? <>Aprendeu: <b>{regra}</b></> : <>Correção: {m.correcao}</>}</p>}
      </div>
    </div>
  );
}

function Regras({ membro, lote, mudou }: { membro: Membro; lote: string; mudou: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const remover = async (id: string) => { await api(`/api/workend/equipe/treino`, { method: "POST", body: JSON.stringify({ lote, membro: membro.membroId, removerRegra: id }) }).catch(() => {}); void mudou(); };
  return (
    <span className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className="rounded-full bg-[var(--tinta)] px-2.5 py-1 font-semibold text-white">Já aprendeu {membro.regras.length} {membro.regras.length === 1 ? "regra" : "regras"}</button>
      {aberto && (
        <span className="absolute left-0 top-8 z-20 block w-[300px] rounded-xl border border-[var(--linha)] bg-[var(--surface)] p-3 shadow-xl">
          {membro.regras.map((r) => <span key={r.id} className="flex items-start gap-2 py-1 text-[13px]"><span className="flex-1">{r.texto}</span><button type="button" onClick={() => remover(r.id)} className="text-[#E2575B]" title="Esquecer esta regra">✕</button></span>)}
        </span>
      )}
    </span>
  );
}

function Visitantes({ q }: { q: string }) {
  const [lista, setLista] = useState<Visitante[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [falasDe, setFalasDe] = useState<{ de: string; falas: FalaVisita[] } | null>(null);
  const falas = aberto && falasDe?.de === aberto ? falasDe.falas : null;
  useEffect(() => { api<Visitante[]>(`/api/workend/equipe/visitantes?${q}`).then(setLista).catch(() => setLista([])); }, [q]);
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    api<FalaVisita[]>(`/api/workend/equipe/visitantes?${q}&visitante=${encodeURIComponent(aberto)}`).then((f) => vivo && setFalasDe({ de: aberto, falas: f })).catch(() => vivo && setFalasDe({ de: aberto, falas: [] }));
    return () => { vivo = false; };
  }, [aberto, q]);
  if (!lista) return <p className="mt-6 text-[var(--tinta-2)]">Carregando…</p>;
  if (!lista.length) return <div className="mt-5 rounded-2xl bg-[var(--cinza)] p-7"><b>Ninguém conversou com a loja ainda.</b><p className="mt-1 text-[var(--tinta-2)]">Quando alguém clicar na sua atendente no mapa ou abrir a página da loja, a conversa aparece aqui, com o contato que a pessoa deixar.</p></div>;
  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
      <ul className="space-y-2">
        {lista.map((v) => (
          <li key={v.visitanteId}><button type="button" onClick={() => setAberto(v.visitanteId)} className={`w-full rounded-2xl border p-3 text-left transition ${aberto === v.visitanteId ? "border-[var(--azul)] bg-[var(--surface)] shadow-md" : "border-transparent bg-[var(--cinza)] hover:border-[var(--linha)]"}`}>
            <span className="flex items-baseline justify-between gap-2"><b>{v.nome ?? "Visitante"}</b><span className="text-[11px] text-[var(--tinta-2)]">{quando(v.ultimaEm)}</span></span>
            <span className="block truncate text-[13px] text-[var(--tinta-2)]">{v.ultimaFala ?? "—"}</span>
          </button></li>
        ))}
      </ul>
      <div className="min-h-[360px] rounded-2xl border border-[var(--linha)] bg-[var(--surface)] p-4">
        {!aberto && <p className="text-[var(--tinta-2)]">Escolha uma conversa para ler.</p>}
        {aberto && !falas && <p className="text-[var(--tinta-2)]">Carregando…</p>}
        <div className="space-y-3">
          {falas?.map((f) => (
            <div key={f.id} className={f.papel === "user" ? "max-w-[80%]" : "ml-auto max-w-[85%]"}>
              <span className="text-[11px] font-semibold text-[var(--tinta-2)]">{f.papel === "user" ? "Visitante" : f.quem} · {quando(f.criadoEm)}</span>
              <div className={`mt-0.5 rounded-2xl px-4 py-2.5 ${f.papel === "user" ? "bg-[var(--cinza)]" : "bg-[#EEF3FF]"}`}><Texto t={f.conteudo} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sobre({ p, lote, salvo }: { p: Painel; lote: string; salvo: () => Promise<void> }) {
  const [sobre, setSobre] = useState(p.sobre);
  const [c, setC] = useState<Contatos>(p.contatos ?? {});
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | string>("");
  const [base, setBase] = useState({ sobre: p.sobre, contatos: JSON.stringify(p.contatos ?? {}) });
  const mudou = useMemo(() => sobre !== base.sobre || JSON.stringify(c) !== base.contatos, [sobre, c, base]);
  const salvar = async () => {
    setEstado("salvando");
    try { const r = await api<{ contatos: Contatos | null }>(`/api/workend/equipe`, { method: "PUT", body: JSON.stringify({ lote, sobre, contatos: c }) }); if (r.contatos) setC(r.contatos); setBase({ sobre, contatos: JSON.stringify(r.contatos ?? c) }); setEstado("salvo"); void salvo(); }
    catch (e) { setEstado((e as Error).message); }
  };
  const campo = (k: keyof Contatos, rotulo: string, ph: string) => <label className="campo">{rotulo}<input value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={ph} /></label>;
  return (
    <section className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl bg-[var(--cinza)] p-6">
        <h2 className="text-[1.4rem]">Sobre a {p.lote.empresaNome}</h2>
        <p className="mt-1 text-sm text-[var(--tinta-2)]">Toda a equipe lê este texto antes de responder, e a atendente usa só ele para falar com os visitantes. Ele também aparece na página pública da loja.</p>
        <label className="campo mt-4">O que a empresa faz, para quem, preços, horários, onde atende e como contratar
          <textarea rows={12} value={sobre} onChange={(e) => setSobre(e.target.value.slice(0, 3000))} placeholder={"Ex.: Padaria artesanal no centro de Lagarto (SE).\nPães de fermentação natural a partir de R$ 12; bolos sob encomenda com 2 dias de antecedência.\nAberta de segunda a sábado, das 6h às 19h. Entregamos no centro por R$ 5.\nPedidos pelo WhatsApp."} />
        </label>
        <p className="mt-1 text-right text-[12px] text-[var(--tinta-2)]">{sobre.length} de 3000</p>
      </div>
      <div className="rounded-2xl border border-[var(--linha)] p-6">
        <h2 className="text-[1.2rem]">Contatos públicos</h2>
        <p className="mt-1 text-sm text-[var(--tinta-2)]">Aparecem na página da loja e na busca. Deixe em branco o que não quiser mostrar.</p>
        <div className="mt-4 space-y-3">
          {campo("whatsapp", "WhatsApp (com DDD)", "79 99999-0000")}
          {campo("instagram", "Instagram", "@suaempresa")}
          {campo("site", "Site", "suaempresa.com.br")}
          {campo("email", "E-mail", "contato@suaempresa.com.br")}
        </div>
        <button type="button" onClick={salvar} disabled={!mudou || estado === "salvando"} className="btn btn-azul mt-5 w-full">{estado === "salvando" ? "Salvando…" : "Salvar"}</button>
        {estado === "salvo" && !mudou && <p className="mt-2 text-center text-sm text-[#166534]">Salvo. A equipe já usa o texto novo.</p>}
        {estado && !["salvando", "salvo"].includes(estado) && <p className="mt-2 text-center text-sm text-[#9B1C1C]">{estado}</p>}
      </div>
    </section>
  );
}
