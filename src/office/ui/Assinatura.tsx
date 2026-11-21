"use client";
// Pagamento automático do lote e do quiosque (WE-09, 21/11/2026; servidor em src/server/assinaturas.ts).
//  - EscolhaPagamento: no 1º pagamento, "Pagar só este mês (Pix)" (o botão de sempre, que vem como children) ou
//    "Pagar todo mês automaticamente" (cartão de crédito; Pix Automático só quando o servidor ligar).
//  - AssinaturaDoLote: no lote ativo, o estado do automático (próxima cobrança, trocar o cartão, cancelar), o aviso de
//    falha (atualizar o cartão ou pagar no Pix) ou o convite para ligar; também usado no painel (Meu escritório).
// O cartão é digitado nos campos seguros do Mercado Pago (iframes do MercadoPago.js): número, validade e código nunca
// passam pelo WorkEnd; o servidor recebe só o token. Sem as chaves do Mercado Pago, tudo isto some e fica o Pix de sempre.
// Não importa o mundoStore de propósito (o painel /app não carrega o mapa): o mapa é recarregado por import dinâmico.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icone } from "./Icone";
import { medir, medirUmaVez } from "@/lib/medir";
import { ehQuiosque } from "../data/quiosques";

type Config = { cartao: boolean; pixAutomatico: boolean; chavePublica: string; sdk: string };
type Resumo = { id: string; estado: "pendente" | "ativa" | "falhando" | "cancelada" | "encerrada" | "recusada"; meio: "cartao" | "pix_automatico"; valor: number; primeiroValor: number; proximaCobranca: string | null; tentativas: number; ultimaFalhaEm: string | null; primeiraPaga: boolean; dentroDos7Dias: boolean; inicio: "agora" | "vencimento"; criadoEm: string; canceladaEm: string | null; motivoFim: string | null };
type Cot = { tipo: "lote" | "quiosque"; primeiro: number; mensal: number; oferta: { id: string; nome: string; desconto: number } | null; extras: number; inicio: "agora" | "vencimento"; primeiraCobranca: string; admin: boolean };
type Estado = { config: Config; assinatura: Resumo | null; cotacao: Cot | null };
type CampoMP = { mount: (id: string) => CampoMP; unmount?: () => void };
type SdkMP = { fields: { create: (tipo: string, o?: Record<string, unknown>) => CampoMP; createCardToken: (d: { cardholderName: string; identificationType: string; identificationNumber: string }) => Promise<{ id?: string }> } };
declare global { interface Window { MercadoPago?: new (chave: string, o?: { locale?: string }) => SdkMP } }

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const vivo = (a: Resumo | null | undefined): boolean => !!a && (a.estado === "ativa" || a.estado === "pendente" || a.estado === "falhando");
const novoIdem = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const recarregarMapa = () => { void import("../mundoStore").then((m) => m.useMundo.getState().carregar()).catch(() => {}); };
// lotes que ligaram o automático nesta visita: quando a 1ª cobrança passa, o cartão do lote mostra o próximo passo
const recemLigados = new Set<string>();

async function chamar(corpo: Record<string, unknown>): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetch("/api/assinaturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

function useAssinatura(chave: string, ligado: boolean, sinal: string) {
  const [e, setE] = useState<Estado | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ligado) return;
    let ativo = true;
    fetch(`/api/assinaturas?chave=${encodeURIComponent(chave)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (ativo && j) setE(j as Estado); }).catch(() => {});
    return () => { ativo = false; };
  }, [chave, ligado, v, sinal]);
  // ligado e esperando a 1ª cobrança do cartão (até 1 hora): confere sozinho, e o mapa acompanha
  const esperando = !!e?.assinatura && vivo(e.assinatura) && e.assinatura.inicio === "agora" && !e.assinatura.primeiraPaga;
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => { setV((n) => n + 1); recarregarMapa(); }, 4000);
    return () => clearInterval(t);
  }, [esperando]);
  return { e, recarregar: () => setV((n) => n + 1) };
}

// MercadoPago.js carregado uma vez por página
let sdkCarregando: Promise<void> | null = null;
function carregarSdk(url: string) {
  if (window.MercadoPago) return Promise.resolve();
  sdkCarregando ??= new Promise<void>((ok, falha) => {
    const s = document.createElement("script"); s.src = url; s.async = true;
    s.onload = () => ok(); s.onerror = () => { sdkCarregando = null; falha(new Error("sdk")); };
    document.head.appendChild(s);
  });
  return sdkCarregando;
}

const CAMPO = "h-11 w-full min-w-0 overflow-hidden rounded-xl border border-[#D9DEE6] bg-white px-3 py-2.5";
export function FormCartao({ config, botao, aoToken }: { config: Config; botao: string; aoToken: (token: string) => Promise<string | null> }) {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { numero: `mpnumero${base}`, validade: `mpvalidade${base}`, codigo: `mpcodigo${base}` };
  const mpRef = useRef<SdkMP | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    let ativo = true; const campos: CampoMP[] = [];
    carregarSdk(config.sdk).then(() => {
      if (!ativo || !window.MercadoPago) return;
      const mp = new window.MercadoPago(config.chavePublica, { locale: "pt-BR" }); mpRef.current = mp;
      const estilo = { style: { fontSize: "16px", color: "#1D2128" } };
      campos.push(mp.fields.create("cardNumber", { placeholder: "Número do cartão", ...estilo }).mount(ids.numero));
      campos.push(mp.fields.create("expirationDate", { placeholder: "MM/AA", ...estilo }).mount(ids.validade));
      campos.push(mp.fields.create("securityCode", { placeholder: "Código", ...estilo }).mount(ids.codigo));
      setPronto(true);
    }).catch(() => { if (ativo) setErro("Não deu para abrir os campos do cartão agora. Tente de novo em instantes ou pague no Pix."); });
    return () => { ativo = false; campos.forEach((c) => { try { c.unmount?.(); } catch { /* o campo já saiu */ } }); };
  }, [config.sdk, config.chavePublica, ids.numero, ids.validade, ids.codigo]);
  const enviar = async () => {
    setErro(null);
    const doc = cpf.replace(/\D/g, "");
    if (nome.trim().length < 3) { setErro("Escreva o nome como está no cartão."); return; }
    if (doc.length !== 11) { setErro("Confira o CPF de quem é dono do cartão."); return; }
    if (!mpRef.current) return;
    setEnviando(true);
    try {
      const t = await mpRef.current.fields.createCardToken({ cardholderName: nome.trim(), identificationType: "CPF", identificationNumber: doc }).catch(() => null);
      if (!t?.id) { setErro("Confira o número, a validade e o código do cartão."); return; }
      const e = await aoToken(t.id);
      if (e) setErro(e);
    } finally { setEnviando(false); }
  };
  return (
    <div className="mt-2" data-form-cartao>
      <div className="grid gap-1.5">
        <div id={ids.numero} className={CAMPO} data-campo="numero" />
        <div className="grid grid-cols-2 gap-1.5"><div id={ids.validade} className={CAMPO} data-campo="validade" /><div id={ids.codigo} className={CAMPO} data-campo="codigo" /></div>
        <input value={nome} onChange={(x) => setNome(x.target.value)} name="cc-name" autoComplete="cc-name" placeholder="Nome impresso no cartão" className={`${CAMPO} text-base`} data-campo="nome" />
        <input value={cpf} onChange={(x) => setCpf(x.target.value)} name="cpf" inputMode="numeric" autoComplete="off" placeholder="CPF do titular do cartão" className={`${CAMPO} text-base`} data-campo="cpf" />
      </div>
      <div className="mt-1.5 flex items-start gap-1 text-[11px] text-[#5B6472]"><Icone nome="cadeado" tamanho={13} className="mt-[1px] shrink-0" />O cartão vai direto para o Mercado Pago, em campos seguros. O WorkEnd não vê nem guarda o número do cartão.</div>
      {erro && <div className="mt-1.5 text-xs font-semibold text-[#E2575B]" data-erro-cartao>{erro}</div>}
      <button type="button" onClick={() => void enviar()} disabled={!pronto || enviando} data-enviar-cartao className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#1E40AF] disabled:opacity-50">{enviando ? "Enviando ao Mercado Pago…" : pronto ? botao : "Abrindo os campos do cartão…"}</button>
    </div>
  );
}

// ======================= 1º pagamento: Pix só deste mês ou automático =======================
export function EscolhaPagamento({ chave, desligado = false, sinal = "", children }: { chave: string; desligado?: boolean; sinal?: string; children: ReactNode }) {
  const { e, recarregar } = useAssinatura(chave, !desligado, sinal);
  const [modo, setModo] = useState<"pix" | "auto">("pix");
  const [meio, setMeio] = useState<"cartao" | "pix_automatico">("cartao");
  const [idem] = useState(novoIdem);
  const [erro, setErro] = useState<string | null>(null);
  if (desligado || !e) return <>{children}</>;
  const a = e.assinatura, cfg = e.config, cot = e.cotacao;
  if (a && vivo(a)) return (
    <div className="mt-3 rounded-2xl bg-[#EEF3FF] px-3 py-2.5 text-xs text-[#1D4ED8]" data-assinatura="esperando">
      <div className="font-bold"><Icone nome="relogio" tamanho={15} className="mr-1 inline align-[-3px]" />Pagamento automático ligado{a.meio === "cartao" ? " no cartão" : ""}</div>
      <div className="mt-1">A 1ª cobrança ({brl(a.primeiroValor)}) cai em instantes, em até 1 hora. O lote ativa sozinho: não precisa ficar nesta tela.</div>
    </div>
  );
  if ((!cfg.cartao && !cfg.pixAutomatico) || !cot) return <>{children}</>;
  const usarMeio = cfg.cartao ? (cfg.pixAutomatico ? meio : "cartao") : "pix_automatico";
  const contratar = async (token: string | null) => {
    setErro(null);
    const r = await chamar({ acao: "contratar", chave, meio: usarMeio, token, idem });
    if (!r.ok) return String(r.j.erro ?? "Não deu para ligar agora. Tente de novo ou pague no Pix.");
    if (typeof r.j.linkPagamento === "string") { window.location.href = r.j.linkPagamento; return null; }
    recemLigados.add(chave); recarregar(); recarregarMapa();
    return null;
  };
  const aba = (ativo: boolean) => `rounded-xl px-2 py-2 text-center leading-tight transition ${ativo ? "bg-white text-[#1D2128] shadow-sm" : "text-[#5B6472] hover:text-[#1D2128]"}`;
  return (
    <div data-assinatura-escolha>
      <div role="radiogroup" aria-label="Como pagar" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-[#F1F3F6] p-1 text-[12px] font-semibold">
        <button type="button" role="radio" aria-checked={modo === "pix"} data-modo="pix" onClick={() => setModo("pix")} className={aba(modo === "pix")}>Pagar só este mês<span className="block text-[10px] font-normal">Pix</span></button>
        <button type="button" role="radio" aria-checked={modo === "auto"} data-modo="auto" onClick={() => { if (modo !== "auto" && usarMeio === "cartao") medir("cartao_iniciado", { tipo: cot.tipo, value: cot.primeiro, currency: "BRL" }); setModo("auto"); }} className={aba(modo === "auto")}>Pagar todo mês automaticamente<span className="block text-[10px] font-normal">{cfg.pixAutomatico && cfg.cartao ? "cartão ou Pix Automático" : cfg.cartao ? "cartão de crédito" : "Pix Automático"}</span></button>
      </div>
      {modo === "pix" ? children : (
        <div className="mt-2 rounded-2xl border border-[#D9E2FF] bg-[#F7F9FF] px-3 py-2.5 text-xs text-[#1D2128]" data-assinatura-auto>
          {cfg.cartao && cfg.pixAutomatico && (
            <div className="mb-2 flex gap-1.5 text-[12px] font-semibold">
              {(["cartao", "pix_automatico"] as const).map((m) => <button key={m} type="button" onClick={() => setMeio(m)} aria-pressed={meio === m} className={`flex-1 rounded-xl border px-2 py-1.5 ${meio === m ? "border-[#1D4ED8] bg-white text-[#1D4ED8]" : "border-transparent text-[#5B6472]"}`}>{m === "cartao" ? "Cartão de crédito" : "Pix Automático"}</button>)}
            </div>
          )}
          <div data-assinatura-preco><b>Agora: {brl(cot.primeiro)}</b>{cot.oferta ? ` (${cot.oferta.nome})` : ""}. Depois, {brl(cot.mensal)} a cada 30 dias{cot.extras ? " com o lote extra" : ""}, sozinho, sem precisar lembrar.</div>
          <div className="mt-0.5 text-[11px] text-[#5B6472]">Você recebe um lembrete 3 dias antes de cada cobrança e cancela quando quiser em Meu escritório.</div>
          {usarMeio === "cartao"
            ? <FormCartao config={cfg} botao={`Ligar e pagar ${brl(cot.primeiro)} no cartão`} aoToken={(t) => contratar(t)} />
            : <><button type="button" onClick={() => void contratar(null).then((x) => x && setErro(x))} className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white">Autorizar o Pix Automático no Mercado Pago</button>{erro && <div className="mt-1.5 text-xs font-semibold text-[#E2575B]">{erro}</div>}</>}
        </div>
      )}
    </div>
  );
}

// ======================= lote ativo e painel: estado do automático =======================
export function AssinaturaDoLote({ chave, sinal = "", pagoAte = null, painel = false, linkPix, moldura, children }: { chave: string; sinal?: string; pagoAte?: string | null; painel?: boolean; linkPix?: string; moldura?: (x: ReactNode) => ReactNode; children?: ReactNode }) {
  const { e, recarregar } = useAssinatura(chave, true, sinal);
  const [aberto, setAberto] = useState<"ligar" | "cartao" | "cancelar" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [idem] = useState(novoIdem);
  const [visto, setVisto] = useState(false);
  // funil (src/lib/medir.ts, junção v98): cartao_pago quando a pessoa vê a 1ª cobrança aprovada no cartão do lote que ela
  // acabou de ligar (o mesmo momento do aviso "1ª cobrança aprovada no cartão"), uma vez por assinatura; não é o pix_pago
  const paga = e?.assinatura && e.assinatura.meio === "cartao" && e.assinatura.primeiraPaga && recemLigados.has(chave) ? e.assinatura : null;
  const pagaId = paga?.id ?? null, pagaValor = paga?.primeiroValor ?? 0;
  useEffect(() => { if (pagaId) medirUmaVez(`cartao_pago:${pagaId}`, "cartao_pago", { tipo: ehQuiosque(chave) ? "quiosque" : "lote", value: pagaValor, currency: "BRL" }); }, [pagaId, pagaValor, chave]);
  if (!e) return painel ? null : <>{children}</>;
  const a = e.assinatura, cfg = e.config, cot = e.cotacao;
  const podeLigar = (cfg.cartao || cfg.pixAutomatico) && !!cot;
  const caixa = "mt-3 rounded-2xl px-3 py-2.5 text-xs";
  const embrulha = (x: ReactNode) => <>{moldura ? moldura(x) : x}</>;
  const pix = painel ? (linkPix ? <a href={linkPix} className="mt-2 block w-full rounded-xl bg-[#16A34A] px-3 py-2 text-center text-xs font-bold text-white">Pagar este mês no Pix, pelo mapa</a> : null) : children;
  const aviso = msg && <div className={`mt-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ${msg.ok ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#FDE8E8] text-[#8A2A2A]"}`} data-assinatura-msg>{msg.t}</div>;
  const trocar = async (token: string) => {
    const r = await chamar({ acao: "cartao", chave, token });
    if (!r.ok) return String(r.j.erro ?? "Não deu para trocar o cartão agora.");
    setAberto(null); setMsg({ ok: true, t: a?.estado === "falhando" ? "Cartão atualizado. O Mercado Pago tenta a cobrança de novo com ele." : "Cartão trocado. As próximas cobranças vão para ele." }); recarregar();
    return null;
  };
  const cancelar = async () => {
    setOcupado(true);
    try {
      const r = await chamar({ acao: "cancelar", chave });
      if (!r.ok) { setMsg({ ok: false, t: String(r.j.erro ?? "Não deu para cancelar agora. Tente de novo.") }); return; }
      const dev = Number(r.j.devolucao ?? 0);
      setAberto(null); setMsg({ ok: true, t: dev > 0 ? `Pagamento automático cancelado. Registramos o pedido de devolução de ${brl(dev)}.` : `Pagamento automático cancelado. O lote continua seu até ${dataBR(pagoAte)}.` }); recarregar(); recarregarMapa();
    } finally { setOcupado(false); }
  };
  const ligar = async (token: string | null) => {
    const r = await chamar({ acao: "contratar", chave, meio: cfg.cartao ? "cartao" : "pix_automatico", token, idem });
    if (!r.ok) return String(r.j.erro ?? "Não deu para ligar agora.");
    if (typeof r.j.linkPagamento === "string") { window.location.href = r.j.linkPagamento; return null; }
    setAberto(null); setMsg({ ok: true, t: "Pagamento automático ligado." }); recarregar();
    return null;
  };

  // sem automático valendo: o Pix de sempre e, se as chaves estiverem ligadas, o convite discreto para ligar
  if (!vivo(a)) {
    if (painel && !podeLigar && !a) return null;
    return embrulha(
      <>
        {!painel && children}
        {painel && <div className="text-sm text-[#5B6472]" data-assinatura="sem">{a?.estado === "cancelada" || a?.estado === "encerrada" ? `O pagamento automático está desligado desde ${dataBR(a.canceladaEm)}. ` : ""}A renovação é pelo Pix, no mapa.</div>}
        {aviso}
        {podeLigar && (aberto === "ligar" ? (
          <div className={`${caixa} border border-[#D9E2FF] bg-[#F7F9FF] text-[#1D2128]`} data-assinatura-ligar>
            <div><b>{cot!.inicio === "vencimento" ? `1ª cobrança no vencimento, ${dataBR(cot!.primeiraCobranca)}: ${brl(cot!.primeiro)}` : `Agora: ${brl(cot!.primeiro)}`}</b>. Depois, {brl(cot!.mensal)} a cada 30 dias{cot!.extras ? " com o lote extra" : ""}. Lembrete 3 dias antes de cada cobrança.</div>
            {cfg.cartao ? <FormCartao config={cfg} botao="Ligar no cartão" aoToken={ligar} /> : <button type="button" onClick={() => void ligar(null)} className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white">Autorizar o Pix Automático</button>}
            <button type="button" onClick={() => setAberto(null)} className="mt-1.5 w-full text-center text-[11px] font-semibold text-[#5B6472]">Agora não</button>
          </div>
        ) : <button type="button" onClick={() => setAberto("ligar")} data-ligar-automatico className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-semibold text-[#1D4ED8]"><Icone nome="relogio" tamanho={14} />Ligar o pagamento automático (cartão)</button>)}
      </>
    );
  }

  if (!a) return null;
  const falhando = a.estado === "falhando";
  const meio = a.meio === "cartao" ? "cartão de crédito" : "Pix Automático";
  return embrulha(
    <div data-assinatura={a.estado}>
      {!visto && recemLigados.has(chave) && a.primeiraPaga && !painel && (
        <div className={`${caixa} bg-[#E3F6EA] text-[#166534]`} data-assinatura="primeira-paga"><div className="font-bold"><Icone nome="check" tamanho={15} className="mr-1 inline align-[-3px]" />1ª cobrança aprovada no cartão</div><div className="mt-0.5">O chão é seu por 30 dias e renova sozinho. Falta um passo rápido: o nicho, os nomes e a logo, que já vêm sugeridos.</div>
          <button type="button" onClick={() => { setVisto(true); recemLigados.delete(chave); void import("../mundoStore").then((m) => m.useMundo.getState().abrirConfiguracao()); }} className="mt-2 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white">Escolher nicho, nomes e logo</button></div>
      )}
      {falhando ? (
        <div className={`${caixa} bg-[#FDE8E8] text-[#8A2A2A]`} data-assinatura-falha>
          <div className="font-bold">A cobrança do cartão não passou{a.tentativas ? ` (tentativa ${a.tentativas})` : ""}</div>
          <div className="mt-0.5">O Mercado Pago tenta de novo nos próximos dias. Atualize o cartão ou pague este mês no Pix para manter o lote.</div>
          {aberto === "cartao" ? <FormCartao config={cfg} botao="Usar este cartão" aoToken={trocar} /> : <button type="button" onClick={() => setAberto("cartao")} data-atualizar-cartao className="mt-2 w-full rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white">Atualizar o cartão</button>}
          {pix}
          <div className="mt-1 text-[11px] opacity-90">Pagando no Pix, o pagamento automático deste cartão é desligado, para não cobrar o mesmo mês duas vezes.</div>
        </div>
      ) : (
        <div className={`${caixa} bg-[#EEF3FF] text-[#1D4ED8]`} data-assinatura-ligada>
          <div className="font-bold"><Icone nome="relogio" tamanho={15} className="mr-1 inline align-[-3px]" />Pagamento automático ligado · {meio}</div>
          <div className="mt-0.5 text-[#1D2128]">{a.proximaCobranca ? <>Próxima cobrança: <b>{dataBR(a.proximaCobranca)}</b> · {brl(a.primeiraPaga || a.inicio === "vencimento" ? a.valor : a.primeiroValor)}</> : "Aguardando a 1ª cobrança."} Lembrete 3 dias antes.</div>
          {aberto === "cartao" && <FormCartao config={cfg} botao="Usar este cartão" aoToken={trocar} />}
          {aberto === "cancelar" && (
            <div className="mt-2 rounded-xl bg-white px-2.5 py-2 text-[#1D2128]" data-confirmar-cancelar>
              <div>Cancelar o pagamento automático? Nada mais será cobrado e o lote continua seu até <b>{dataBR(pagoAte)}</b>.</div>
              {a.dentroDos7Dias && a.primeiraPaga && <div className="mt-1 text-[#166534]">Como é a sua primeira contratação e ainda está nos 7 dias, registramos o pedido de devolução do que foi cobrado.</div>}
              <div className="mt-2 flex gap-1.5"><button type="button" onClick={() => void cancelar()} disabled={ocupado} data-confirmar className="flex-1 rounded-xl bg-[#E2575B] px-2 py-2 text-xs font-bold text-white disabled:opacity-50">{ocupado ? "Cancelando…" : "Cancelar o automático"}</button><button type="button" onClick={() => setAberto(null)} className="flex-1 rounded-xl bg-[#F1F3F6] px-2 py-2 text-xs font-semibold text-[#5B6472]">Voltar</button></div>
            </div>
          )}
          {!aberto && <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] font-semibold"><button type="button" onClick={() => setAberto("cartao")} data-trocar-cartao className="rounded-xl bg-white px-2 py-1.5 text-[#1D4ED8]">Trocar o cartão</button><button type="button" onClick={() => setAberto("cancelar")} data-cancelar-automatico className="rounded-xl bg-white px-2 py-1.5 text-[#8A2A2A]">Cancelar</button></div>}
          {aberto === "cartao" && <button type="button" onClick={() => setAberto(null)} className="mt-1.5 w-full text-center text-[11px] font-semibold text-[#5B6472]">Voltar</button>}
        </div>
      )}
      {aviso}
    </div>
  );
}
