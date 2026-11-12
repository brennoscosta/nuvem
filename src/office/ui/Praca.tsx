"use client";
// Cartão da praça de eventos (12/11/2026): agenda do palco (lives e lançamentos das empresas, com o link de cada uma),
// marcar um evento (empresas com lote ativo, de graça, até 2 por vez) e a feira de sábado (barraca a R$ 9,90 para quem
// ainda não tem lote, paga no Pix aqui mesmo). Também o aviso que aparece no mapa quando um evento vai começar.
import { useEffect, useState } from "react";
import { useMundo, LOTE_POR_CHAVE, type EventoPraca, type BarracaFeira } from "../mundoStore";
import { PRACA_CHAVE, TIPOS_BARRACA, CORES_BARRACA, DURACOES_EVENTO, PRECO_BARRACA, FEIRA_ABRE, FEIRA_FECHA, dataCurta } from "../data/praca";
import { eventosDoMomento } from "../scene/Praca";
import { PixAberto } from "./Lote";
import { FLUTUANTE, LARGO } from "./estilo";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TZ = { timeZone: "America/Sao_Paulo" } as const;
const quando = (e: EventoPraca) => {
  const i = new Date(e.inicio), f = new Date(e.fim);
  return `${i.toLocaleDateString("pt-BR", { ...TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")} · ${i.toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" })}–${f.toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" })}`;
};
// relógio do cartão (o "ao vivo" muda sozinho)
function useAgora(passo = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), passo); return () => clearInterval(t); }, [passo]);
  return agora;
}

export function CartaoPraca() {
  const chave = useMundo((s) => s.loteSelecionado);
  const praca = useMundo((s) => s.praca);
  const carregar = useMundo((s) => s.carregarPraca);
  const usuario = useMundo((s) => s.usuario);
  const meu = useMundo((s) => s.meu);
  const admin = useMundo((s) => s.admin);
  const loteAtivo = useMundo((s) => (s.meu ? s.terrenos[s.meu]?.status === "ativo" : false));
  const pixPraca = useMundo((s) => !!s.pix && s.pix.lote === PRACA_CHAVE);
  const [aba, setAba] = useState<"agenda" | "feira">("agenda");
  const agora = useAgora();
  if (chave !== PRACA_CHAVE) return null;
  const { vivo } = eventosDoMomento(praca?.agenda ?? [], agora);
  const fechar = () => useMundo.getState().selecionarLote(null);
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra !z-10 overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#0F766E]">WorkEnd · praça da cidade</div>
          <div className="text-lg font-bold">Praça de Eventos</div>
          <div className="text-xs text-[#5B6472]">Palco para lives e lançamentos · feira aos sábados, das {FEIRA_ABRE}h às {FEIRA_FECHA}h</div>
        </div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>
      <div className="mt-3 flex gap-1 rounded-xl bg-[#F1F3F6] p-1 text-xs font-semibold">
        {([["agenda", vivo ? "🔴 Palco ao vivo" : "Agenda do palco"], ["feira", `Feira de sábado${praca ? ` · ${dataCurta(praca.feira.dia)}` : ""}`]] as const).map(([k, t]) => <button key={k} onClick={() => setAba(k)} className={`flex-1 rounded-lg px-2 py-1.5 ${aba === k ? "bg-white shadow" : "text-[#5B6472]"}`}>{t}</button>)}
      </div>
      {!praca ? <div className="mt-3 text-xs text-[#5B6472]">Abrindo a agenda…</div> : aba === "agenda" ? (
        <Agenda agenda={praca.agenda} agora={agora} podeMarcar={loteAtivo || admin} logado={!!usuario} temLote={!!meu} aoMudar={carregar} />
      ) : (
        <Feira barracas={praca.feira.barracas} dia={praca.feira.dia} preco={praca.feira.preco ?? PRECO_BARRACA} logado={!!usuario} podeAlugar={!!usuario && (!loteAtivo || admin)} pixAberto={pixPraca} aoMudar={carregar} />
      )}
    </div>
  );
}

function Agenda({ agenda, agora, podeMarcar, logado, temLote, aoMudar }: { agenda: EventoPraca[]; agora: number; podeMarcar: boolean; logado: boolean; temLote: boolean; aoMudar: () => Promise<void> }) {
  const [form, setForm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = async (id: string) => { setErro(null); const r = await fetch(`/api/workend/praca?evento=${encodeURIComponent(id)}`, { method: "DELETE" }); if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j.erro ?? "Não deu para cancelar."); } await aoMudar(); };
  return (
    <div className="mt-3">
      {agenda.length === 0 && <div className="rounded-2xl bg-[#F1F3F6] px-3 py-3 text-xs text-[#5B6472]">Nenhum evento marcado ainda. O palco está livre: a primeira live da cidade pode ser a sua.</div>}
      <ol className="space-y-2">
        {agenda.map((e) => {
          const aoVivo = new Date(e.inicio).getTime() <= agora && new Date(e.fim).getTime() > agora;
          return (
            <li key={e.id} className={`relative overflow-hidden rounded-2xl border px-3 py-2.5 pl-4 text-sm ${aoVivo ? "border-[#E11D48]/40 bg-[#FFF1F3]" : "border-black/5 bg-white"}`}>
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: e.empresa.cor }} />
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5B6472]">
                <span>{aoVivo ? <span className="mr-1 rounded-full bg-[#E11D48] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">ao vivo</span> : null}{quando(e)}</span>
                {e.meu && <button onClick={() => cancelar(e.id)} className="text-[11px] font-semibold text-[#E2575B]">Cancelar</button>}
              </div>
              <div className="mt-0.5 font-bold leading-snug">{e.titulo}</div>
              {e.descricao && <div className="mt-0.5 text-xs text-[#5B6472]">{e.descricao}</div>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                {e.empresa.chave && LOTE_POR_CHAVE[e.empresa.chave] ? <button onClick={() => useMundo.getState().selecionarLote(e.empresa.chave)} className="text-[#1D4ED8]">{e.empresa.nome} · ver no mapa</button> : <span className="text-[#5B6472]">{e.empresa.nome}</span>}
                {e.link && <a href={e.link} target="_blank" rel="noreferrer nofollow" className={aoVivo ? "rounded-full bg-[#E11D48] px-2.5 py-1 text-white" : "text-[#1D4ED8]"}>{aoVivo ? "Assistir agora ↗" : "Link do evento ↗"}</a>}
              </div>
            </li>
          );
        })}
      </ol>
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      {podeMarcar ? (form ? <FormEvento aoFechar={() => setForm(false)} aoMudar={aoMudar} /> : (
        <button onClick={() => setForm(true)} className="mt-3 w-full rounded-xl bg-[#0F766E] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0d6b63]">🎤 Marcar um evento no palco</button>
      )) : (
        <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">{!logado ? <>Empresas com lote no mapa marcam lives e lançamentos aqui de graça. <a href="/entrar?destino=/mundo?lote=0,1,1" className="font-semibold text-[#1D4ED8]">Entrar</a></> : temLote ? "Assim que o 1º mês do seu lote for pago, você marca eventos aqui de graça (até 2 por vez)." : "Marcar eventos é para empresas com lote no mapa. Sem lote? A feira de sábado é para você."}</div>
      )}
      <div className="mt-2 text-center text-[10px] text-[#5B6472]">Quem está no mapa recebe um aviso 10 minutos antes de cada evento.</div>
    </div>
  );
}

// data e hora em Brasília para o campo do formulário (próxima hora cheia)
function sugestaoInicio() {
  const d = new Date(Date.now() + 3600_000);
  const p = new Intl.DateTimeFormat("en-CA", { ...TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:00` };
}
function FormEvento({ aoFechar, aoMudar }: { aoFechar: () => void; aoMudar: () => Promise<void> }) {
  const [f, setF] = useState(() => ({ titulo: "", descricao: "", link: "", ...sugestaoInicio(), duracao: 60 }));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const muda = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const enviar = async () => {
    setErro(null); setEnviando(true);
    try {
      const inicio = new Date(`${f.data}T${f.hora}:00-03:00`).toISOString(); // horário de Brasília
      const r = await fetch("/api/workend/praca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo: f.titulo, descricao: f.descricao, link: f.link, inicio, duracao: f.duracao }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      await aoMudar(); aoFechar();
    } catch { setErro("Confira a data e a hora."); } finally { setEnviando(false); }
  };
  const campo = "mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#0F766E]";
  return (
    <div className="mt-3 rounded-2xl border border-[#0F766E]/25 bg-[#F0FAF8] p-3">
      <div className="text-sm font-bold text-[#0F766E]">Novo evento no palco</div>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">Nome do evento<input value={f.titulo} onChange={(e) => muda({ titulo: e.target.value.slice(0, 60) })} placeholder="Ex.: Lançamento da coleção de verão" className={campo} /></label>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">O que vai acontecer (opcional)<textarea value={f.descricao} onChange={(e) => muda({ descricao: e.target.value.slice(0, 300) })} rows={2} className={campo} /></label>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">Link da live ou da página (opcional)<input value={f.link} onChange={(e) => muda({ link: e.target.value.slice(0, 200) })} placeholder="youtube.com/... ou instagram.com/..." className={campo} /></label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="col-span-1 block text-xs font-semibold text-[#5B6472]">Dia<input type="date" value={f.data} onChange={(e) => muda({ data: e.target.value })} className={`${campo} px-2`} /></label>
        <label className="block text-xs font-semibold text-[#5B6472]">Hora<input type="time" step={900} value={f.hora} onChange={(e) => muda({ hora: e.target.value })} className={`${campo} px-2`} /></label>
        <label className="block text-xs font-semibold text-[#5B6472]">Duração<select value={f.duracao} onChange={(e) => muda({ duracao: Number(e.target.value) })} className={`${campo} bg-white px-2`}>{DURACOES_EVENTO.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h${d % 60 ? "30" : ""}`.replace("1.5 h30", "1h30").replace(" h", "h")}</option>)}</select></label>
      </div>
      <div className="mt-1 text-[10px] text-[#5B6472]">Horário de Brasília. O palco é de um evento por vez; até 30 dias à frente.</div>
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={aoFechar} className="rounded-xl px-3 py-2 text-xs text-[#5B6472]">Cancelar</button>
        <button onClick={enviar} disabled={enviando || f.titulo.trim().length < 4} className="rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{enviando ? "Marcando…" : "Marcar no palco"}</button>
      </div>
    </div>
  );
}

// a feira vista de cima, como está na praça: palco no fundo, 3 barracas de cada lado
function Feira({ barracas, dia, preco, logado, podeAlugar, pixAberto, aoMudar }: { barracas: BarracaFeira[]; dia: string; preco: number; logado: boolean; podeAlugar: boolean; pixAberto: boolean; aoMudar: () => Promise<void> }) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const minha = barracas.find((b) => b.meu);
  const b = escolhida != null ? barracas.find((x) => x.vaga === escolhida) ?? null : null;
  const Toldo = ({ x }: { x: BarracaFeira }) => {
    const paga = x.status === "paga", livre = x.status === "livre";
    const pode = podeAlugar && (livre || x.meu) && !(minha && !x.meu);
    return (
      <button type="button" onClick={() => setEscolhida(x.vaga)} disabled={!paga && !pode} title={paga ? x.nome : livre ? "Barraca livre" : "Reservada"}
        className={`relative h-14 w-full overflow-hidden rounded-lg text-left text-[10px] font-bold transition ${escolhida === x.vaga ? "ring-2 ring-[#1D2128]" : ""} ${livre ? "border-2 border-dashed border-[#B9B2A4] bg-[#F7F4EE] text-[#7A7366] hover:bg-[#EFEBE2]" : ""} ${!paga && !livre ? "bg-[#E6E2DA] text-[#7A7366]" : ""}`}
        style={paga ? { background: `repeating-linear-gradient(90deg, ${x.cor} 0 9px, #fff 9px 18px)` } : undefined}>
        <span className={`absolute inset-x-1 bottom-1 truncate rounded px-1 py-0.5 ${paga ? "bg-white/95 text-[#1D2128]" : ""}`}>{paga ? `${TIPOS_BARRACA.find((t) => t.id === x.tipo)?.icone ?? "🛍️"} ${x.nome}` : livre ? `Vaga ${x.vaga} · livre` : x.meu ? "Sua (falta o Pix)" : "Reservada"}</span>
      </button>
    );
  };
  return (
    <div className="mt-3">
      <div className="rounded-2xl bg-[#FFF8E6] px-3 py-2 text-xs text-[#7A5A00]">Sábado, {dataCurta(dia)}, das {FEIRA_ABRE}h às {FEIRA_FECHA}h. Barraca por <b>{brl(preco)}</b> o sábado, para quem ainda não tem lote: seu nome na placa, seus contatos aqui e as pessoas passando na praça.</div>
      <div className="mt-3 rounded-2xl bg-[#ECE7DD] p-2">
        <div className="mx-auto mb-2 w-3/5 rounded-md bg-[#3B2A1E] py-1 text-center text-[9px] font-bold uppercase tracking-wide text-white/80">palco</div>
        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
          <div className="flex flex-col-reverse gap-1.5">{barracas.slice(0, 3).map((x) => <Toldo key={x.vaga} x={x} />)}</div>
          <div className="flex items-center justify-center rounded-lg bg-[#E0D9CB] text-center text-[9px] font-semibold uppercase tracking-wide text-[#7A7366]">plateia<br />e corredor</div>
          <div className="flex flex-col-reverse gap-1.5">{barracas.slice(3, 6).map((x) => <Toldo key={x.vaga} x={x} />)}</div>
        </div>
        <div className="mt-2 text-center text-[9px] font-semibold uppercase tracking-wide text-[#7A7366]">rua · em frente à Nuvem</div>
      </div>
      {b && b.status === "paga" && !b.meu && (
        <div className="mt-3 rounded-2xl border border-black/5 bg-white px-3 py-2.5 text-sm">
          <div className="font-bold">{TIPOS_BARRACA.find((t) => t.id === b.tipo)?.icone} {b.nome}</div>
          {b.descricao && <div className="mt-0.5 text-xs text-[#5B6472]">{b.descricao}</div>}
          <div className="mt-1.5 flex gap-3 text-xs font-semibold">
            {b.contato.whatsapp && <a href={`https://wa.me/${b.contato.whatsapp.length <= 11 ? `55${b.contato.whatsapp}` : b.contato.whatsapp}`} target="_blank" rel="noreferrer" className="text-[#16A34A]">WhatsApp ↗</a>}
            {b.contato.instagram && <a href={`https://instagram.com/${b.contato.instagram}`} target="_blank" rel="noreferrer" className="text-[#DB2777]">@{b.contato.instagram} ↗</a>}
            {!b.contato.whatsapp && !b.contato.instagram && <span className="text-[#5B6472]">Passe na praça no sábado.</span>}
          </div>
        </div>
      )}
      {pixAberto && <PixAberto chave={PRACA_CHAVE} />}
      {!pixAberto && b && (b.status === "livre" || b.meu) && podeAlugar && b.status !== "paga" && <FormBarraca key={b.vaga} vaga={b.vaga} nomeInicial={b.meu ? b.nome : ""} aoMudar={aoMudar} />}
      {!pixAberto && minha?.status === "paga" && <div className="mt-3 rounded-2xl bg-[#E3F6EA] px-3 py-2 text-xs text-[#166534]">Sua barraca <b>{minha.nome}</b> está garantida neste sábado. 🎪</div>}
      {!logado && <div className="mt-3 text-center text-[11px] text-[#5B6472]"><a href="/cadastro?lote=0,1,1" className="font-semibold text-[#1D4ED8]">Crie sua conta</a> para alugar uma barraca.</div>}
      {logado && !podeAlugar && <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-[11px] text-[#5B6472]">A feira é para quem ainda não tem lote: a sua empresa já tem endereço no mapa. Que tal marcar um evento no palco?</div>}
      {podeAlugar && !b && !minha && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Toque numa vaga livre para alugar.</div>}
    </div>
  );
}

function FormBarraca({ vaga, nomeInicial, aoMudar }: { vaga: number; nomeInicial: string; aoMudar: () => Promise<void> }) {
  const [f, setF] = useState({ nome: nomeInicial, descricao: "", tipo: "artesanato", cor: CORES_BARRACA[0], whatsapp: "", instagram: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const muda = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const enviar = async () => {
    setErro(null); setEnviando(true);
    try {
      const r = await fetch("/api/workend/feira", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vaga, ...f }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); await aoMudar(); return; }
      useMundo.getState().abrirPix({ id: j.id, lote: PRACA_CHAVE, valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, status: "pendente", tipo: "barraca" });
      await aoMudar();
    } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };
  const campo = "mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#D97706]";
  return (
    <div className="mt-3 rounded-2xl border border-[#D97706]/30 bg-[#FFFBF2] p-3">
      <div className="text-sm font-bold text-[#7A5A00]">Barraca {vaga} · sua placa</div>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">Nome na placa<input autoFocus value={f.nome} onChange={(e) => muda({ nome: e.target.value.slice(0, 28) })} placeholder="Ex.: Doces da Lu" className={campo} /></label>
      <div className="mt-2 text-xs font-semibold text-[#5B6472]">O que você vende</div>
      <div className="mt-1 flex flex-wrap gap-1.5">{TIPOS_BARRACA.map((t) => <button key={t.id} type="button" onClick={() => muda({ tipo: t.id })} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${f.tipo === t.id ? "border-[#D97706] bg-[#FFF1D6] text-[#7A5A00]" : "border-black/10 bg-white text-[#5B6472]"}`}>{t.icone} {t.nome}</button>)}</div>
      <div className="mt-2 text-xs font-semibold text-[#5B6472]">Cor do toldo</div>
      <div className="mt-1 flex gap-1.5">{CORES_BARRACA.map((c) => <button key={c} type="button" onClick={() => muda({ cor: c })} aria-label={`Toldo ${c}`} className={`h-7 w-7 rounded-full border-2 ${f.cor === c ? "border-[#1D2128]" : "border-transparent"}`} style={{ background: `repeating-linear-gradient(90deg, ${c} 0 5px, #fff 5px 10px)` }} />)}</div>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">Uma frase (opcional)<input value={f.descricao} onChange={(e) => muda({ descricao: e.target.value.slice(0, 120) })} placeholder="Ex.: bolos caseiros e brigadeiros gourmet" className={campo} /></label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-[#5B6472]">WhatsApp<input inputMode="tel" value={f.whatsapp} onChange={(e) => muda({ whatsapp: e.target.value.slice(0, 20) })} placeholder="(79) 99999-9999" className={campo} /></label>
        <label className="block text-xs font-semibold text-[#5B6472]">Instagram<input value={f.instagram} onChange={(e) => muda({ instagram: e.target.value.slice(0, 40) })} placeholder="@sualoja" className={campo} /></label>
      </div>
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      <button onClick={enviar} disabled={enviando || f.nome.trim().length < 2} className="mt-3 w-full rounded-xl bg-[#16A34A] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#15803d] disabled:opacity-50">{enviando ? "Gerando o Pix…" : `Reservar e pagar ${brl(PRECO_BARRACA)} no Pix`}</button>
      <div className="mt-1 text-center text-[10px] text-[#5B6472]">A vaga fica guardada por 1 hora enquanto você paga.</div>
    </div>
  );
}

// Aviso no mapa: 10 minutos antes de um evento e quando ele começa (cada aviso aparece uma vez por sessão)
const avisados = new Set<string>();
export function AvisoEventos() {
  const praca = useMundo((s) => s.praca);
  const [aviso, setAviso] = useState<{ e: EventoPraca; comecou: boolean } | null>(null);
  useEffect(() => {
    const conferir = () => {
      const agora = Date.now();
      for (const e of praca?.agenda ?? []) {
        const ini = new Date(e.inicio).getTime(), fim = new Date(e.fim).getTime();
        if (agora >= ini && agora < fim && !avisados.has(`${e.id}:ja`)) { avisados.add(`${e.id}:ja`); avisados.add(`${e.id}:antes`); setAviso({ e, comecou: true }); return; }
        if (ini - agora <= 10 * 60_000 && ini > agora && !avisados.has(`${e.id}:antes`)) { avisados.add(`${e.id}:antes`); setAviso({ e, comecou: false }); return; }
      }
    };
    const primeiro = setTimeout(conferir, 1500); const t = setInterval(conferir, 20_000);
    return () => { clearTimeout(primeiro); clearInterval(t); };
  }, [praca]);
  if (!aviso) return null;
  const { e, comecou } = aviso;
  const hora = new Date(e.inicio).toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" });
  return (
    <div className="pointer-events-auto absolute bottom-[4.6rem] left-1/2 z-30 w-[min(26rem,calc(100%-1rem))] sm:bottom-auto sm:top-[4.6rem] -translate-x-1/2 rounded-2xl bg-[#111418]/95 p-3 text-white shadow-2xl backdrop-blur painel-entra">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${comecou ? "animate-pulse bg-[#E11D48]" : "bg-[#FACC15]"}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">{comecou ? "Começou agora na praça" : `Às ${hora} na praça`}</div>
          <div className="truncate text-sm font-bold">{e.titulo}</div>
          <div className="truncate text-xs text-white/70">por {e.empresa.nome}</div>
        </div>
        <button onClick={() => setAviso(null)} aria-label="Fechar" className="rounded-full px-1.5 text-white/60 hover:bg-white/10">✕</button>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => { useMundo.getState().selecionarLote(PRACA_CHAVE); setAviso(null); }} className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">Ir para a praça</button>
        {e.link && <a href={e.link} target="_blank" rel="noreferrer nofollow" onClick={() => setAviso(null)} className="flex-1 rounded-xl bg-[#E11D48] px-3 py-2 text-center text-xs font-bold text-white">{comecou ? "Assistir agora ↗" : "Abrir o link ↗"}</a>}
      </div>
    </div>
  );
}
