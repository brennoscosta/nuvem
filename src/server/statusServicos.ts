// Página pública de status (WE-23, 22/11/2026). A cada 5 minutos o próprio WorkEnd confere seis serviços pela agenda
// interna (src/instrumentation.ts) e grava o resultado em status_checagem (migração 0059); a página /status
// (src/app/workend/status) mostra o estado de agora e o histórico das últimas 24 horas e dos últimos 7 dias.
// Nenhuma conferência gasta dinheiro nem mexe em dado de ninguém:
//  - IA: um GET na lista de modelos da OpenAI (/v1/models), que não cobra; nunca gera texto nem imagem;
//  - pagamentos: um GET nos meios de pagamento do Mercado Pago (/v1/payment_methods); nunca cria cobrança;
//  - e-mail: só olha se o envio está configurado (SENDGRID_API_KEY e EMAIL_REMETENTE); nunca envia;
//  - site e cidade: pedem a página inicial e /api/cidade/online ao próprio servidor, por dentro.
// Quando o site inteiro cai, a conferência cai junto e o intervalo aparece como "sem registro". Para ser avisado nessa
// hora é preciso um monitor de fora (UptimeRobot ou Better Stack) olhando /api/status.
// Se o banco não responder, o resultado fica guardado na memória e é gravado na próxima conferência que conseguir.
import { sql, migrar, temBanco } from "./db";
import { pagamentoLigado } from "./mercadopago";
import { emailLigado } from "./email";

declare global {
  var __workendStatusTimer: ReturnType<typeof setInterval> | undefined;
  var __workendStatusRodando: boolean | undefined;
  var __workendStatusPendentes: Conferencia[] | undefined;
}

export type EstadoServico = "ok" | "falha" | "desligado";
export type IdServico = "site" | "banco" | "cidade" | "pagamentos" | "email" | "ia";
export const SERVICOS: { id: IdServico; nome: string; descricao: string }[] = [
  { id: "site", nome: "Site", descricao: "As páginas do WorkEnd abrindo." },
  { id: "banco", nome: "Banco de dados", descricao: "Contas, lotes, lojas e pedidos." },
  { id: "cidade", nome: "Cidade ao vivo", descricao: "Quem está passeando pelo mapa agora." },
  { id: "pagamentos", nome: "Pagamentos", descricao: "O Mercado Pago, que gera e confere o Pix." },
  { id: "email", nome: "E-mails", descricao: "Avisos de reserva, pagamento e vencimento." },
  { id: "ia", nome: "Equipe de IA", descricao: "A OpenAI, que responde pelos atendentes das lojas." },
];
export const MINUTOS_CICLO = 5;
const DIAS_GUARDADOS = 8; // a página mostra 7 dias; um a mais de folga
const PRAZO_MS = 8000; // cada conferência espera no máximo isso
const MAX_PENDENTES = 300; // um dia de conferências guardadas na memória enquanto o banco não volta

interface Resultado { servico: IdServico; estado: EstadoServico; ms: number | null; detalhe: string }
interface Conferencia { em: Date; resultados: Resultado[] }

// o próprio servidor, por dentro (o endereço público pode não voltar para a mesma máquina); com HOSTNAME=0.0.0.0, como no
// Dockerfile, o pedido vai para 127.0.0.1
function baseLocal() {
  const h = (process.env.HOSTNAME ?? "").trim();
  const host = !h || h === "0.0.0.0" || h === "::" ? "127.0.0.1" : h;
  return `http://${host.includes(":") ? `[${host}]` : host}:${process.env.PORT || 3000}`;
}
// só o tipo do problema, nunca a mensagem inteira (pode ter endereço interno ou dado de alguém)
function motivo(e: unknown) {
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || e.message === "tempo esgotado")) return "tempo esgotado";
  const causa = (e as { cause?: { code?: unknown } } | null)?.cause?.code ?? (e as { code?: unknown } | null)?.code;
  return typeof causa === "string" && /^[A-Z_0-9]{3,40}$/.test(causa) ? `sem conexão (${causa})` : "sem resposta";
}
async function pedir(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(PRAZO_MS) });
  await r.arrayBuffer().catch(() => null); // lê até o fim para soltar a conexão
  return r;
}
const porHttp = (r: Response, aceita3xx = false): { estado: EstadoServico; detalhe: string } =>
  r.ok || (aceita3xx && r.status >= 300 && r.status < 400) ? { estado: "ok", detalhe: "" } : { estado: "falha", detalhe: `HTTP ${r.status}` };

async function medir(servico: IdServico, f: () => Promise<{ estado: EstadoServico; detalhe?: string }>): Promise<Resultado> {
  const ini = Date.now();
  try {
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const r = await Promise.race([f(), new Promise<never>((_, rej) => { prazo = setTimeout(() => rej(new Error("tempo esgotado")), PRAZO_MS + 500); })]).finally(() => clearTimeout(prazo));
    return { servico, estado: r.estado, ms: r.estado === "desligado" ? null : Date.now() - ini, detalhe: r.detalhe ?? "" };
  } catch (e) { return { servico, estado: "falha", ms: Date.now() - ini, detalhe: motivo(e) }; }
}

const CONFERE: Record<IdServico, () => Promise<{ estado: EstadoServico; detalhe?: string }>> = {
  site: async () => porHttp(await pedir(`${baseLocal()}/`, { headers: { "x-forwarded-host": "workend.online", "user-agent": "WorkEnd-status" } }), true),
  banco: async () => { if (!temBanco()) return { estado: "falha", detalhe: "sem banco configurado" }; await sql`SELECT 1`; return { estado: "ok" }; },
  cidade: async () => {
    const r = await fetch(`${baseLocal()}/api/cidade/online`, { cache: "no-store", headers: { "user-agent": "WorkEnd-status" }, signal: AbortSignal.timeout(PRAZO_MS) });
    if (!r.ok) { await r.arrayBuffer().catch(() => null); return { estado: "falha", detalhe: `HTTP ${r.status}` }; }
    const j = await r.json().catch(() => null);
    return j && typeof j === "object" ? { estado: "ok" } : { estado: "falha", detalhe: "resposta sem os dados da cidade" };
  },
  // o Mercado Pago responde? Sem a chave, os pagamentos estão desligados
  pagamentos: async () => {
    if (!pagamentoLigado()) return { estado: "desligado" };
    const base = (process.env.MP_API_BASE?.trim() || "https://api.mercadopago.com").replace(/\/+$/, "");
    const r = await pedir(`${base}/v1/payment_methods`, { headers: { authorization: `Bearer ${process.env.MP_ACCESS_TOKEN?.trim()}`, "user-agent": "WorkEnd-status" } });
    return r.status === 401 || r.status === 403 ? { estado: "falha", detalhe: `chave recusada (HTTP ${r.status})` } : porHttp(r);
  },
  email: async () => (emailLigado() ? { estado: "ok", detalhe: "configurado" } : { estado: "desligado" }),
  // a OpenAI responde? Só a lista de modelos: não gasta crédito (nunca gerar texto aqui)
  ia: async () => {
    const chave = process.env.OPENAI_API_KEY?.trim(); if (!chave) return { estado: "desligado" };
    const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    const r = await pedir(`${base}/models`, { method: "GET", headers: { authorization: `Bearer ${chave}`, "user-agent": "WorkEnd-status" } });
    return r.status === 401 || r.status === 403 ? { estado: "falha", detalhe: `chave recusada (HTTP ${r.status})` } : porHttp(r);
  },
};

// Uma rodada: confere os seis serviços ao mesmo tempo, grava e apaga o que passou de 8 dias
export async function conferirServicos(): Promise<Resultado[] | null> {
  if (globalThis.__workendStatusRodando) return null;
  globalThis.__workendStatusRodando = true;
  try {
    const em = new Date();
    const resultados = await Promise.all(SERVICOS.map((s) => medir(s.id, CONFERE[s.id])));
    const fila = [...(globalThis.__workendStatusPendentes ?? []), { em, resultados }];
    try {
      await migrar();
      const linhas = fila.flatMap((c) => c.resultados.map((r) => ({ servico: r.servico, estado: r.estado, ms: r.ms, detalhe: r.detalhe.slice(0, 120), criado_em: c.em })));
      await sql`INSERT INTO status_checagem ${sql(linhas, "servico", "estado", "ms", "detalhe", "criado_em")}`;
      globalThis.__workendStatusPendentes = [];
      await sql`DELETE FROM status_checagem WHERE criado_em < now() - make_interval(days => ${DIAS_GUARDADOS})`;
    } catch (e) {
      globalThis.__workendStatusPendentes = fila.slice(-MAX_PENDENTES);
      console.error("[status] não gravou a conferência:", motivo(e));
    }
    return resultados;
  } finally { globalThis.__workendStatusRodando = false; }
}

// Liga a conferência a cada 5 minutos (a primeira 1 minuto depois de o servidor subir). Testes: STATUS_CICLO_MS e
// STATUS_PRIMEIRO_CICLO_MS encurtam os tempos.
export function agendarStatus() {
  if (globalThis.__workendStatusTimer || !temBanco() || process.env.NEXT_PHASE === "phase-production-build") return;
  const tick = () => { void conferirServicos().catch((e) => console.error("[status]", motivo(e))); };
  globalThis.__workendStatusTimer = setInterval(tick, Number(process.env.STATUS_CICLO_MS) || MINUTOS_CICLO * 60_000);
  setTimeout(tick, Number(process.env.STATUS_PRIMEIRO_CICLO_MS) || 60_000);
  console.log("[status] conferência dos serviços ligada");
}

// ---------- leitura para a página ----------
export type Periodo = "24h" | "7d";
export const BLOCOS = 24; // 24 blocos: de 1 hora (24 h) ou de 7 horas (7 dias)
export interface Bloco { inicio: Date; fim: Date; ok: number; falha: number; desligado: number }
export interface LinhaStatus {
  id: IdServico; nome: string; descricao: string;
  agora: EstadoServico | "sem_registro"; conferidoEm: Date | null; ms: number | null;
  blocos: Bloco[]; noAr: number | null; // % de conferências ok no período (sem contar as de serviço desligado)
}
export async function historicoStatus(periodo: Periodo): Promise<{ servicos: LinhaStatus[]; ultima: Date | null }> {
  await migrar();
  const horas = periodo === "7d" ? 24 * 7 : 24, passoSeg = (horas * 3600) / BLOCOS;
  const agora = Date.now();
  const linhas = await sql<{ servico: IdServico; idx: number; ok: number; falha: number; desligado: number }[]>`
    SELECT servico, floor(extract(epoch FROM (now() - criado_em)) / ${passoSeg})::int AS idx,
      count(*) FILTER (WHERE estado = 'ok')::int AS ok, count(*) FILTER (WHERE estado = 'falha')::int AS falha,
      count(*) FILTER (WHERE estado = 'desligado')::int AS desligado
    FROM status_checagem WHERE criado_em > now() - make_interval(hours => ${horas}) GROUP BY 1, 2`;
  const ultimos = await sql<{ servico: IdServico; estado: EstadoServico; ms: number | null; criadoEm: Date }[]>`
    SELECT DISTINCT ON (servico) servico, estado, ms, criado_em FROM status_checagem
    WHERE criado_em > now() - interval '1 day' ORDER BY servico, criado_em DESC`;
  // mais de 3 ciclos sem conferência: não dá para dizer como está agora
  const velho = 3 * (Number(process.env.STATUS_CICLO_MS) || MINUTOS_CICLO * 60_000);
  const servicos = SERVICOS.map((s): LinhaStatus => {
    const blocos: Bloco[] = Array.from({ length: BLOCOS }, (_, k) => {
      const idx = BLOCOS - 1 - k; // k = 0 é o mais antigo; idx 0 é o mais recente
      return { inicio: new Date(agora - (idx + 1) * passoSeg * 1000), fim: new Date(agora - idx * passoSeg * 1000), ok: 0, falha: 0, desligado: 0 };
    });
    for (const l of linhas) if (l.servico === s.id && l.idx >= 0 && l.idx < BLOCOS) { const b = blocos[BLOCOS - 1 - l.idx]; b.ok += l.ok; b.falha += l.falha; b.desligado += l.desligado; }
    const ok = blocos.reduce((n, b) => n + b.ok, 0), falha = blocos.reduce((n, b) => n + b.falha, 0);
    const u = ultimos.find((x) => x.servico === s.id);
    const recente = !!u && agora - new Date(u.criadoEm).getTime() <= velho;
    return { ...s, agora: recente && u ? u.estado : "sem_registro", conferidoEm: u ? new Date(u.criadoEm) : null, ms: recente && u ? u.ms : null, blocos, noAr: ok + falha ? (ok / (ok + falha)) * 100 : null };
  });
  const ultima = ultimos.reduce<Date | null>((m, u) => (!m || new Date(u.criadoEm) > m ? new Date(u.criadoEm) : m), null);
  return { servicos, ultima };
}
