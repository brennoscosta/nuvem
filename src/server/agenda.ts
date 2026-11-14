// Agendamento pela loja (12/11/2026, ideia do dono): barbearia, clínica, aulas. O dono liga a agenda em /app/agenda
// (serviços, horários da semana, antecedência); o visitante logado escolhe serviço → dia → horário no cartão da loja ou
// na página /loja/N, e a atendente de IA também marca pela conversa (marcação [[AGENDAR ...]] que o servidor valida).
// Regras: tudo no horário de Brasília; sem choque (trava por dono na transação); no máximo 3 horários futuros por
// cliente numa loja; o dono não marca na própria loja. Avisos no sino (src/server/avisos.ts).
import { sql, id, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno, terrenoDoUsuario } from "./terrenos";
import { avisar } from "./avisos";
import { bloqueio, contar } from "./limite";
import { LOTES, LOTE_POR_CHAVE } from "@/office/data/mundo";
import { CONFIG_PADRAO, MAX_FUTUROS_CLIENTE, faixasDoDia, limparConfig, agendaUsavel, paraHHMM, paraMin, duracaoTexto, type ConfigAgenda, type ServicoAgenda } from "@/office/data/agenda";

export class ErroAgenda extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const statusAgenda = (e: unknown) => (e instanceof ErroAgenda ? e.status : 500);

// ---------- horário de Brasília ----------
const TZ = "America/Sao_Paulo";
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtOffset = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });
const fmtSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });
const fmtSemanaLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" });
export const diaDe = (d: Date) => fmtDia.format(d); // AAAA-MM-DD
export const horaDe = (d: Date) => fmtHora.format(d); // HH:MM
function offsetMin(d: Date) {
  const v = fmtOffset.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(v);
  return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] ?? 0)) : -180;
}
// "2026-11-14" + minutos desde 0h (no horário de Brasília) → instante
function instante(dia: string, min: number) {
  const base = Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10), Math.floor(min / 60), min % 60);
  return new Date(base - offsetMin(new Date(base)) * 60000);
}
const meioDia = (dia: string) => new Date(`${dia}T12:00:00Z`);
const somaDias = (dia: string, n: number) => new Date(meioDia(dia).getTime() + n * 86400_000).toISOString().slice(0, 10);
const semanaDe = (dia: string) => meioDia(dia).getUTCDay();
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
export const rotuloDia = (dia: string) => `${fmtSemana.format(meioDia(dia)).replace(".", "")} ${ddmm(dia)}`; // "sáb 14/11"
const rotuloLongo = (dia: string) => `${fmtSemanaLonga.format(meioDia(dia))}, ${ddmm(dia)}`; // "sábado, 14/11"
export function quando(inicio: Date, fim: Date) { const d = diaDe(inicio); return `${rotuloDia(d)} · ${horaDe(inicio)}–${horaDe(fim)}`; }

// ---------- loja e configuração ----------
async function lojaAberta(numero: number): Promise<{ chave: string; donoId: string; empresa: string; numero: number } | null> {
  const l = LOTES.find((x) => x.numero === numero); if (!l) return null;
  let t = await obterTerreno(l.chave);
  if (t?.anexoDe) t = await obterTerreno(t.anexoDe); // lote duplo: a ampliação usa a loja principal
  if (!t || t.status !== "ativo") return null;
  return { chave: t.chave, donoId: t.usuarioId, empresa: t.empresaNome, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? numero };
}
export async function configDe(donoId: string): Promise<ConfigAgenda> {
  await migrar();
  const [r] = await sql<{ ligada: boolean; servicos: unknown; horarios: unknown; passo: number; antecedenciaMin: number; diasFrente: number }[]>`SELECT ligada, servicos, horarios, passo, antecedencia_min, dias_frente FROM agenda_loja WHERE dono_id = ${donoId}`;
  return r ? limparConfig(r) : { ...CONFIG_PADRAO, horarios: { ...CONFIG_PADRAO.horarios } };
}

interface Ocupado { inicio: Date; fim: Date }
async function ocupadosDe(donoId: string, ate: Date, db: typeof sql = sql): Promise<Ocupado[]> {
  return db<Ocupado[]>`SELECT inicio, fim FROM agendamento WHERE dono_id = ${donoId} AND status = 'marcado' AND fim > now() AND inicio < ${ate}`;
}
const choca = (o: Ocupado[], a: Date, b: Date) => o.some((x) => new Date(x.inicio) < b && new Date(x.fim) > a);
const minimoDe = (c: ConfigAgenda) => new Date(Date.now() + c.antecedenciaMin * 60000);
const ultimoDia = (c: ConfigAgenda) => somaDias(diaDe(new Date()), c.diasFrente - 1);

// horários em que o serviço pode começar num dia (HH:MM), já sem os ocupados e sem o que está antes da antecedência
function horariosDoDia(c: ConfigAgenda, dia: string, duracao: number, ocupados: Ocupado[], minimo: Date): string[] {
  const out: string[] = [];
  for (const [a, b] of faixasDoDia(c.horarios[String(semanaDe(dia))])) {
    for (let m = a; m + duracao <= b; m += c.passo) {
      const ini = instante(dia, m), fim = new Date(ini.getTime() + duracao * 60000);
      if (ini < minimo || choca(ocupados, ini, fim)) continue;
      out.push(paraHHMM(m));
    }
  }
  return out;
}
function diasComHorarios(c: ConfigAgenda, s: ServicoAgenda, ocupados: Ocupado[], deDia: string, nDias: number) {
  const minimo = minimoDe(c), fimDia = ultimoDia(c), dias: { dia: string; rotulo: string; horarios: string[] }[] = [];
  for (let i = 0; i < nDias; i++) {
    const dia = somaDias(deDia, i); if (dia > fimDia) break;
    const horarios = horariosDoDia(c, dia, s.duracao, ocupados, minimo);
    if (horarios.length) dias.push({ dia, rotulo: rotuloDia(dia), horarios });
  }
  return dias;
}

// ---------- o dono ----------
const servicoPublico = (s: ServicoAgenda) => ({ id: s.id, nome: s.nome, duracao: s.duracao, duracaoTexto: duracaoTexto(s.duracao), preco: s.preco });
type LinhaAg = { id: string; donoId: string; clienteId: string | null; terrenoChave: string | null; empresa: string; servicoId: string; servico: string; preco: string; inicio: Date; fim: Date; nome: string; contato: string; obs: string; status: string; origem: string; canceladoPor: string | null; criadoEm: Date };
const paraTela = (a: LinhaAg) => ({ id: a.id, servico: a.servico, preco: a.preco, inicio: new Date(a.inicio).toISOString(), fim: new Date(a.fim).toISOString(), quando: quando(new Date(a.inicio), new Date(a.fim)), dia: diaDe(new Date(a.inicio)), nome: a.nome, contato: a.contato, obs: a.obs, status: a.status, origem: a.origem, canceladoPor: a.canceladoPor, passou: new Date(a.inicio).getTime() < Date.now() });

async function loteAtivoDoDono(u: Usuario) {
  const t = await terrenoDoUsuario(u.id);
  if (!t || t.status !== "ativo") throw new ErroAgenda("A agenda é para empresas com lote ativo no mapa.", 402);
  return t;
}
export async function agendaDoDono(u: Usuario) {
  await migrar();
  const t = await terrenoDoUsuario(u.id);
  const config = await configDe(u.id);
  const [proximos, historico] = await Promise.all([
    sql<LinhaAg[]>`SELECT * FROM agendamento WHERE dono_id = ${u.id} AND status = 'marcado' AND fim > now() ORDER BY inicio LIMIT 200`,
    sql<LinhaAg[]>`SELECT * FROM agendamento WHERE dono_id = ${u.id} AND (fim <= now() OR status <> 'marcado') AND inicio > now() - interval '30 days' ORDER BY inicio DESC LIMIT 100`,
  ]);
  return {
    config, usavel: agendaUsavel(config),
    loja: t && t.status === "ativo" ? { chave: t.chave, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? null, empresa: t.empresaNome } : null,
    proximos: proximos.map(paraTela), historico: historico.map(paraTela),
  };
}
export async function salvarAgenda(u: Usuario, dados: unknown) {
  await migrar(); await loteAtivoDoDono(u);
  const c = limparConfig(dados);
  if (c.ligada && !c.servicos.length) throw new ErroAgenda("Cadastre pelo menos um serviço para ligar a agenda.");
  if (c.ligada && !agendaUsavel(c)) throw new ErroAgenda("Abra pelo menos um dia da semana, com o horário de fim depois do de início.");
  const j = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);
  await sql`INSERT INTO agenda_loja (dono_id, ligada, servicos, horarios, passo, antecedencia_min, dias_frente, atualizado_em)
    VALUES (${u.id}, ${c.ligada}, ${j(c.servicos)}, ${j(c.horarios)}, ${c.passo}, ${c.antecedenciaMin}, ${c.diasFrente}, now())
    ON CONFLICT (dono_id) DO UPDATE SET ligada = EXCLUDED.ligada, servicos = EXCLUDED.servicos, horarios = EXCLUDED.horarios, passo = EXCLUDED.passo,
      antecedencia_min = EXCLUDED.antecedencia_min, dias_frente = EXCLUDED.dias_frente, atualizado_em = now()`;
  return c;
}

// ---------- quem chega ----------
export async function agendaPublica(numero: number, u: Usuario | null, servicoId?: string | null) {
  await migrar();
  const loja = await lojaAberta(numero);
  if (!loja) return { ligada: false as const, paraAvaliar: [] };
  const ehDono = !!u && u.id === loja.donoId;
  // atendimentos concluídos que o cliente ainda não avaliou (aparecem mesmo se a loja desligar a agenda depois)
  const paraAvaliar = u && !ehDono ? await pendentesDeAvaliacao(loja.donoId, u.id) : [];
  const c = await configDe(loja.donoId);
  if (!agendaUsavel(c)) return { ligada: false as const, paraAvaliar };
  const meus = u && !ehDono ? (await sql<LinhaAg[]>`SELECT * FROM agendamento WHERE dono_id = ${loja.donoId} AND cliente_id = ${u.id} AND status = 'marcado' AND fim > now() ORDER BY inicio`).map(paraTela) : [];
  const s = servicoId ? c.servicos.find((x) => x.id === servicoId) ?? null : null;
  let dias: { dia: string; rotulo: string; horarios: string[] }[] | undefined;
  if (s) {
    const ocupados = await ocupadosDe(loja.donoId, instante(somaDias(ultimoDia(c), 1), 0));
    dias = diasComHorarios(c, s, ocupados, diaDe(new Date()), c.diasFrente);
  }
  return {
    ligada: true as const, numero: loja.numero, empresa: loja.empresa, servicos: c.servicos.map(servicoPublico), antecedenciaMin: c.antecedenciaMin,
    eu: u ? { nome: u.nome, ehDono } : null, meus, servico: s?.id ?? null, dias, paraAvaliar,
  };
}

const limpa = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/<[^>]*>/g, "").replace(/[<>{}[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
// "2026-11-14T10:00" (horário de Brasília) ou um ISO com fuso
function lerInicio(v: unknown): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})$/.exec(s);
  if (m) return instante(m[1], +m[2] * 60 + +m[3]);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  return null;
}

export async function marcar(u: Usuario, numero: number, d: { servicoId?: unknown; inicio?: unknown; nome?: unknown; contato?: unknown; obs?: unknown }, origem: "cartao" | "atendente" = "cartao") {
  await migrar();
  if (u.banidoEm) throw new ErroAgenda("Conta suspensa.", 403);
  const loja = await lojaAberta(numero);
  if (!loja) throw new ErroAgenda("Esta loja não está aberta agora.", 404);
  if (loja.donoId === u.id) throw new ErroAgenda("Esta loja é sua: os clientes marcam por aqui. Veja a agenda em Meu escritório › Agenda.");
  const c = await configDe(loja.donoId);
  if (!agendaUsavel(c)) throw new ErroAgenda("Esta loja não está recebendo agendamentos agora.");
  const s = c.servicos.find((x) => x.id === String(d.servicoId ?? ""));
  if (!s) throw new ErroAgenda("Escolha um dos serviços da loja.");
  const nome = limpa(d.nome, 60), contato = limpa(d.contato, 80), obs = limpa(d.obs, 300);
  if (nome.length < 2) throw new ErroAgenda("Diga o seu nome.");
  if (contato.length < 6) throw new ErroAgenda("Deixe um WhatsApp ou e-mail para a loja falar com você.");
  const ini = lerInicio(d.inicio);
  if (!ini) throw new ErroAgenda("Escolha o dia e o horário.");
  const dia = diaDe(ini), hora = horaDe(ini);
  if (dia > ultimoDia(c)) throw new ErroAgenda(`Esta loja marca só até ${c.diasFrente} dias à frente.`);
  if (ini < minimoDe(c)) throw new ErroAgenda(c.antecedenciaMin ? "Esse horário já passou ou está em cima da hora para esta loja. Escolha outro." : "Esse horário já passou. Escolha outro.");
  if (!horariosDoDia(c, dia, s.duracao, [], new Date(0)).includes(hora)) throw new ErroAgenda("A loja não atende nesse horário. Escolha um dos horários da lista.");
  const k = `agenda:${u.id}`;
  if (bloqueio(k, 12)) throw new ErroAgenda("Você marcou muitos horários hoje. Tente de novo amanhã.", 429);
  const fim = new Date(ini.getTime() + s.duracao * 60000);
  const aid = id("ag");
  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`SELECT pg_advisory_xact_lock(hashtext(${loja.donoId}))`;
    const [{ n }] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM agendamento WHERE dono_id = ${loja.donoId} AND cliente_id = ${u.id} AND status = 'marcado' AND fim > now()`;
    if (n >= MAX_FUTUROS_CLIENTE) throw new ErroAgenda(`Você já tem ${MAX_FUTUROS_CLIENTE} horários marcados nesta loja. Cancele um para marcar outro.`);
    const [ch] = await db`SELECT 1 FROM agendamento WHERE dono_id = ${loja.donoId} AND status = 'marcado' AND inicio < ${fim} AND fim > ${ini} LIMIT 1`;
    if (ch) throw new ErroAgenda("Esse horário acabou de ser ocupado. Escolha outro.", 409);
    await db`INSERT INTO agendamento (id, dono_id, terreno_chave, empresa, cliente_id, servico_id, servico, preco, inicio, fim, nome, contato, obs, origem)
      VALUES (${aid}, ${loja.donoId}, ${loja.chave}, ${loja.empresa}, ${u.id}, ${s.id}, ${s.nome}, ${s.preco}, ${ini}, ${fim}, ${nome}, ${contato}, ${obs}, ${origem})`;
  });
  contar(k, 24 * 60);
  const q = quando(ini, fim);
  void avisar(loja.donoId, { tipo: "agendamento", ref: `agenda:novo:${aid}`, titulo: `Novo horário: ${s.nome}, ${rotuloDia(dia)} às ${hora}`, texto: `${nome} · ${contato}${origem === "atendente" ? " · marcado pela atendente de IA" : ""}`, link: "/app/agenda" });
  return { id: aid, servico: s.nome, preco: s.preco, quando: q, inicio: ini.toISOString(), fim: fim.toISOString(), empresa: loja.empresa, numero: loja.numero };
}

// cliente cancela o dele (antes de começar); dono cancela, marca concluído ou falta
export async function mudarStatus(u: Usuario, agId: string, acao: unknown) {
  await migrar();
  const [a] = await sql<LinhaAg[]>`SELECT * FROM agendamento WHERE id = ${agId}`;
  if (!a) throw new ErroAgenda("Horário não encontrado.", 404);
  const ehDono = a.donoId === u.id, ehCliente = a.clienteId === u.id;
  if (!ehDono && !ehCliente) throw new ErroAgenda("Esse horário não é seu.", 403);
  const numero = a.terrenoChave ? LOTE_POR_CHAVE[a.terrenoChave]?.numero ?? null : null;
  const q = quando(new Date(a.inicio), new Date(a.fim));
  if (acao === "cancelar") {
    if (a.status !== "marcado") throw new ErroAgenda("Esse horário não está mais marcado.");
    if (!ehDono && new Date(a.inicio).getTime() <= Date.now()) throw new ErroAgenda("Esse horário já começou. Fale direto com a loja.");
    const por = ehDono ? "dono" : "cliente";
    await sql`UPDATE agendamento SET status = 'cancelado', cancelado_por = ${por}, atualizado_em = now() WHERE id = ${agId}`;
    if (por === "cliente") void avisar(a.donoId, { tipo: "agendamento", ref: `agenda:cancelou:${agId}`, titulo: `${a.nome} cancelou o horário`, texto: `${a.servico} · ${q}`, link: "/app/agenda" });
    else if (a.clienteId) void avisar(a.clienteId, { tipo: "agendamento", ref: `agenda:cancelou:${agId}`, titulo: `${a.empresa} cancelou o seu horário`, texto: `${a.servico} · ${q}. Escolha outro horário na loja.`, link: numero ? `/loja/${numero}#agenda` : "/mundo" });
    return { ok: true, status: "cancelado" };
  }
  if (acao === "concluido" || acao === "faltou") {
    if (!ehDono) throw new ErroAgenda("Só a loja marca isso.", 403);
    if (a.status === "cancelado") throw new ErroAgenda("Esse horário foi cancelado.");
    if (new Date(a.inicio).getTime() > Date.now()) throw new ErroAgenda("Esse horário ainda não chegou.");
    await sql`UPDATE agendamento SET status = ${acao}, atualizado_em = now() WHERE id = ${agId}`;
    // atendimento concluído (13/11/2026): o cliente recebe o pedido de avaliação no sino
    if (acao === "concluido" && a.clienteId) void avisar(a.clienteId, { tipo: "agendamento", ref: `agenda:avaliar:${agId}`, titulo: `Como foi o seu atendimento na ${a.empresa}?`, texto: `${a.servico} · ${q}. Toque para dar uma nota de 1 a 5.`, link: numero ? `/loja/${numero}?avaliar=${agId}#agenda` : "/mundo" });
    return { ok: true, status: acao };
  }
  throw new ErroAgenda("Ação inválida.");
}

// ---------- avaliação do atendimento (13/11/2026) ----------
// Uma por agendamento concluído, só do próprio cliente, até 45 dias depois. Vai para a tabela avaliacao (a mesma das
// negociações), então já entra na nota da loja (média em lojaPublica e na busca).
async function pendentesDeAvaliacao(donoId: string, clienteId: string) {
  const rows = await sql<{ id: string; servico: string; inicio: Date; fim: Date }[]>`SELECT a.id, a.servico, a.inicio, a.fim FROM agendamento a
    WHERE a.dono_id = ${donoId} AND a.cliente_id = ${clienteId} AND a.status = 'concluido' AND a.fim > now() - interval '45 days'
      AND NOT EXISTS (SELECT 1 FROM avaliacao v WHERE v.agendamento_id = a.id) ORDER BY a.inicio DESC LIMIT 3`;
  return rows.map((r) => ({ id: r.id, servico: r.servico, quando: quando(new Date(r.inicio), new Date(r.fim)) }));
}
export async function avaliarAtendimento(u: Usuario, agId: string, d: { nota?: unknown; texto?: unknown }) {
  await migrar();
  const nota = Math.trunc(Number(d.nota));
  if (!(nota >= 1 && nota <= 5)) throw new ErroAgenda("Escolha uma nota de 1 a 5.");
  const texto = limpa(d.texto, 300);
  const [a] = await sql<LinhaAg[]>`SELECT * FROM agendamento WHERE id = ${agId}`;
  if (!a || a.clienteId !== u.id) throw new ErroAgenda("Esse atendimento não é seu.", 404);
  if (a.status !== "concluido") throw new ErroAgenda("Só dá para avaliar depois que a loja marca o atendimento como concluído.");
  if (new Date(a.fim).getTime() < Date.now() - 45 * 86400_000) throw new ErroAgenda("O prazo para avaliar este atendimento já passou.");
  const r = await sql`INSERT INTO avaliacao (id, negociacao_id, agendamento_id, de_id, para_id, nota, texto, servico)
    VALUES (${id("av")}, NULL, ${agId}, ${u.id}, ${a.donoId}, ${nota}, ${texto}, ${a.servico}) ON CONFLICT (agendamento_id) WHERE agendamento_id IS NOT NULL DO NOTHING`;
  if (!r.count) throw new ErroAgenda("Você já avaliou este atendimento. Obrigado!", 409);
  void avisar(a.donoId, { tipo: "agendamento", ref: `agenda:avaliado:${agId}`, titulo: `Nova avaliação: ${"★".repeat(nota)}${"☆".repeat(5 - nota)}`, texto: `${a.nome} · ${a.servico}${texto ? ` · “${texto.slice(0, 90)}”` : ""}`, link: "/app/agenda" });
  return { ok: true };
}

// ---------- lembretes no sino (chamado por src/server/avisos.ts ao abrir o sino) ----------
export async function lembretesDaAgenda(usuarioId: string): Promise<void> {
  await migrar();
  const [cli, dono] = await Promise.all([
    sql<LinhaAg[]>`SELECT * FROM agendamento WHERE cliente_id = ${usuarioId} AND status = 'marcado' AND inicio > now() AND inicio <= now() + interval '60 minutes'`,
    sql<LinhaAg[]>`SELECT * FROM agendamento WHERE dono_id = ${usuarioId} AND status = 'marcado' AND inicio > now() - interval '5 minutes' AND inicio <= now() + interval '15 minutes'`,
  ]);
  for (const a of cli) {
    const numero = a.terrenoChave ? LOTE_POR_CHAVE[a.terrenoChave]?.numero ?? null : null;
    await avisar(usuarioId, { tipo: "agendamento", ref: `agenda:lembrete:${a.id}`, titulo: `Lembrete: ${a.servico} às ${horaDe(new Date(a.inicio))} · ${a.empresa}`, texto: `${quando(new Date(a.inicio), new Date(a.fim))}. Se não puder ir, cancele na loja.`, link: numero ? `/loja/${numero}#agenda` : "/mundo" });
  }
  for (const a of dono) await avisar(usuarioId, { tipo: "agendamento", ref: `agenda:chegando:${a.id}`, titulo: `${a.nome} tem horário às ${horaDe(new Date(a.inicio))}`, texto: `${a.servico} · ${a.contato}`, link: "/app/agenda" });
}

// ---------- atendente de IA ----------
// Faixas livres de um dia, alinhadas aos horários de início (passo): um serviço pode começar em qualquer horário de
// início dentro da faixa, desde que termine dentro dela.
function faixasLivres(c: ConfigAgenda, dia: string, ocupados: Ocupado[], minimo: Date): string[] {
  const out: string[] = [];
  for (const [a, b] of faixasDoDia(c.horarios[String(semanaDe(dia))])) {
    let ini: number | null = null;
    for (let m = a; m < b; m += c.passo) {
      const fimCel = Math.min(m + c.passo, b);
      const livre = instante(dia, m) >= minimo && !choca(ocupados, instante(dia, m), instante(dia, fimCel));
      if (livre && ini == null) ini = m;
      if (!livre && ini != null) { out.push(`${paraHHMM(ini)}–${paraHHMM(m)}`); ini = null; }
    }
    if (ini != null) out.push(`${paraHHMM(ini)}–${paraHHMM(b)}`);
  }
  return out;
}
export async function contextoAgendaIA(numero: number, visitante: Usuario): Promise<string | null> {
  await migrar();
  const loja = await lojaAberta(numero);
  if (!loja || loja.donoId === visitante.id) return null;
  const c = await configDe(loja.donoId);
  if (!agendaUsavel(c)) return null;
  const hoje = diaDe(new Date()), minimo = minimoDe(c), fimDia = ultimoDia(c);
  const ocupados = await ocupadosDe(loja.donoId, instante(somaDias(hoje, 8), 0));
  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dia = somaDias(hoje, i); if (dia > fimDia) break;
    const f = faixasLivres(c, dia, ocupados, minimo);
    dias.push(`- ${rotuloLongo(dia)} (${dia}): ${f.length ? f.join(", ") : "sem horário livre"}`);
  }
  const meus = await sql<LinhaAg[]>`SELECT * FROM agendamento WHERE dono_id = ${loja.donoId} AND cliente_id = ${visitante.id} AND status = 'marcado' AND fim > now() ORDER BY inicio`;
  const agora = new Date();
  return [
    "## Agenda da loja (você pode marcar horários de verdade)",
    "Esta loja marca horários pelo WorkEnd. Quando o assunto for agendar, isto vale mais que a instrução geral de só anotar o contato: você marca direto.",
    `Agora: ${rotuloLongo(hoje)}, ${horaDe(agora)} (horário de Brasília).`,
    "Serviços que o dono cadastrou na agenda (a empresa oferece todos eles, mesmo que não estejam no Sobre; use o id na marcação; preço só se estiver aqui):",
    ...c.servicos.map((s) => `- id="${s.id}" · ${s.nome} · ${duracaoTexto(s.duracao)}${s.preco ? ` · ${s.preco}` : ""}`),
    `Faixas livres nos próximos dias. Um serviço pode começar de ${c.passo} em ${c.passo} minutos a partir do início de cada faixa (ex.: 09:00, ${paraHHMM(paraMin("09:00") + c.passo)}) e precisa terminar dentro dela:`,
    ...dias,
    meus.length ? `Horários que este visitante já tem nesta loja: ${meus.map((a) => `${a.servico} (${quando(new Date(a.inicio), new Date(a.fim))})`).join("; ")}. Para cancelar, ele usa "Agendar horário" no cartão ou na página da loja.` : "Este visitante ainda não tem horário marcado nesta loja.",
    `O visitante entrou na conta como "${visitante.nome}".`,
    "Como marcar: 1) descubra o serviço e o dia/horário que ele quer, oferecendo só horários das faixas acima; 2) peça o nome e um WhatsApp ou e-mail; 3) repita serviço, dia e horário e pergunte se pode confirmar; 4) só depois do sim dele, termine a sua resposta com esta linha, exatamente neste formato (o sistema lê a linha e ela some da conversa):",
    '[[AGENDAR servico="ID" inicio="AAAA-MM-DDTHH:MM" nome="NOME" contato="WHATSAPP OU E-MAIL" obs="OBSERVAÇÃO OPCIONAL"]]',
    "Não escreva que o horário está confirmado: o sistema confirma logo abaixo da sua resposta. Nunca invente horário fora das faixas. Uma marcação por resposta.",
  ].join("\n");
}

// sugestões para quando a marcação da atendente não deu certo
async function sugestoes(numero: number, servicoId: string, dia: string | null) {
  const loja = await lojaAberta(numero); if (!loja) return "";
  const c = await configDe(loja.donoId); const s = c.servicos.find((x) => x.id === servicoId); if (!s) return "";
  const ocupados = await ocupadosDe(loja.donoId, instante(somaDias(ultimoDia(c), 1), 0));
  const hoje = diaDe(new Date());
  const de = dia && dia >= hoje ? dia : hoje;
  const dias = diasComHorarios(c, s, ocupados, de, 14).slice(0, 2);
  if (!dias.length) return "";
  return ` Horários livres para ${s.nome}: ${dias.map((d) => `${d.rotulo}: ${d.horarios.slice(0, 6).join(", ")}`).join("; ")}.`;
}
const MARCACAO = /\[\[\s*AGENDAR\b([^\]]*)\]\]/i;
export const temMarcacao = (t: string) => /\[\[\s*AGENDAR/i.test(t);
// Tira a marcação da resposta da atendente, marca de verdade (validando tudo de novo) e acrescenta o resultado
export async function aplicarMarcacaoDaAtendente(resposta: string, u: Usuario, numero: number): Promise<string> {
  const m = MARCACAO.exec(resposta);
  let limpo = resposta.replace(/\[\[\s*AGENDAR\b[^\]]*\]\]/gi, "").replace(/\[\[\s*AGENDAR[^\n]*$/i, "").trim();
  if (!m) return limpo || resposta;
  const at: Record<string, string> = {};
  for (const x of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) at[x[1].toLowerCase()] = x[2];
  try {
    const r = await marcar(u, numero, { servicoId: at.servico, inicio: at.inicio, nome: at.nome || u.nome, contato: at.contato, obs: at.obs }, "atendente");
    limpo += `\n\n✅ Horário marcado: ${r.servico}, ${r.quando}. Você recebe um lembrete no sino 1 hora antes. Para cancelar, toque em “Agendar horário” no cartão da loja.`;
  } catch (e) {
    const ini = lerInicio(at.inicio);
    const extra = at.servico ? await sugestoes(numero, at.servico, ini ? diaDe(ini) : null).catch(() => "") : "";
    limpo += `\n\n⚠️ Não consegui marcar: ${(e as Error).message}${extra}`;
  }
  return limpo.trim();
}
