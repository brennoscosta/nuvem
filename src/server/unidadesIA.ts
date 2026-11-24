// Unidades de IA (20/11/2026, pedido do dono): moeda separada dos Créditos, por EMPRESA, para o consumo da IA.
//  - 1 unidade = R$ 0,01 de custo real de IA. Cada chamada debita ceil(custo / 0,01) a partir do custo que o motor já
//    calcula (motor.ts › custoBRL, gravado em uso_ia por agentes.ts › registrarUso). Uma resposta comum do gpt-4.1-mini
//    (~3.900 tokens de entrada + 390 de saída = R$ 0,012) gasta 2 unidades; uma imagem de alta qualidade, ~116.
//  - Mensalidade inclusa: todo lote ativo recebe UNIDADES_MES_LOTE por mês (o antigo teto de R$ 10, TETO_IA_MES). A
//    inclusa vence no fim do mês. A comprada (com créditos ou Pix) NÃO vence. O consumo tira primeiro da inclusa.
//  - Saldo zerado: a equipe para de usar IA e cai no recado fixo que já existia no teto (equipeCliente.ts). Aviso ao dono
//    com 20% e com 0. Visitantes não pagam: a conversa deles gasta da empresa visitada.
//  - Fora da cobrança: a empresa interna da Nuvem (emp_nuvem, agentes do admin) e os moradores da cidade
//    (TETO_IA_MORADORES_MES, também em emp_nuvem). O consumo deles aparece no admin.
//  - Extrato imutável em ia_lancamento (migração 0042), com o agente, o tipo (conversa, tarefa, imagem) e o custo real.
import { sql, migrar, id } from "./db";
import { avisar } from "./avisos";
import { TODOS_QUIOSQUES } from "@/office/data/quiosques";

type Db = typeof sql;

export const VALOR_UNIDADE_BRL = 0.01;
export const UNIDADES_MES_LOTE = 1000; // = R$ 10 de IA, o antigo TETO_IA_MES
export const UNIDADES_MES_QUIOSQUE = 300; // a frente do quiosque liga em mensalidadeDoLote()
export const UNIDADES_MES_VITRINE = 200; // página grátis (Plano Vitrine, WE-13): ≈ 100 respostas por mês (uma resposta comum gasta 2)
export const RESPOSTAS_MES_VITRINE = 100;
export const AVISO_UNIDADES = 0.2; // avisa o dono quando restam 20%
export const UNIDADES_POR_RESPOSTA = 1.6; // estimativa "≈ N respostas" quando a empresa ainda não tem histórico
// pacotes de unidades, pagos com créditos (margem perto de 2 vezes sobre o custo real; fácil de mudar)
export const PACOTES_UNIDADES = [
  { id: "500", unidades: 500, creditos: 10 },
  { id: "1000", unidades: 1000, creditos: 18 },
  { id: "5000", unidades: 5000, creditos: 80 },
] as const;
export const PACOTE_UNIDADES_POR_ID: Record<string, (typeof PACOTES_UNIDADES)[number]> = Object.fromEntries(PACOTES_UNIDADES.map((p) => [p.id, p]));
export const EMPRESAS_SEM_COBRANCA = new Set(["emp_nuvem"]);
// whatsapp (WE-18): o custo da Meta por mensagem que sai pelo WhatsApp da loja (src/server/whatsappMeta.ts › custoMeta)
export type CategoriaIA = "conversa" | "tarefa" | "imagem" | "whatsapp";
export const NOME_CATEGORIA: Record<CategoriaIA, string> = { conversa: "Conversa", tarefa: "Tarefa", imagem: "Imagem", whatsapp: "WhatsApp" };

// ceil sem o erro de ponto flutuante (0,03 / 0,01 = 3,0000000000000004)
export const unidadesDoCusto = (custoBrl: number) => (custoBrl > 0 ? Math.ceil(Math.round((custoBrl / VALOR_UNIDADE_BRL) * 1e6) / 1e6) : 0);
export function mesAtual(agora = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora).slice(0, 7); }
const nomeMes = (m: string) => { const [a, n] = m.split("-").map(Number); return a && n ? new Date(Date.UTC(a, n - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) : "mês anterior"; };

// Quanto a empresa recebe por mês: lote ativo (não ampliação) = UNIDADES_MES_LOTE. Sem lote ativo, nada.
// A empresa do lote segue equipeCliente.ts › empresaIdDe: emp_<usuário> ou, para admin e sedes, emp_<usuário>_<chave>.
// lotes que recebem a mensalidade de quiosque: os 14 quiosques da frente terreno (data/quiosques.ts, quiosque-101 a 114) e,
// desde 24/11/2026, os espaços de 10 × 10 m dos lotes (o lote dividido em 4) (quiosque-201 em diante)
export const LOTES_QUIOSQUE = new Set<string>(TODOS_QUIOSQUES.map((q) => q.chave));
export function mensalidadeDoLote(chave: string) { return LOTES_QUIOSQUE.has(chave) ? UNIDADES_MES_QUIOSQUE : UNIDADES_MES_LOTE; }
// Plano Vitrine (WE-13): sem lote nem quiosque, a página grátis publicada recebe UNIDADES_MES_VITRINE
async function mensalidadeDa(db: Db, empId: string) { return (await mensalidadeComPlano(db, empId)).unidades; }
async function mensalidadeComPlano(db: Db, empId: string): Promise<{ unidades: number; vitrine: boolean }> {
  if (EMPRESAS_SEM_COBRANCA.has(empId)) return { unidades: 0, vitrine: false };
  const [t] = await db<{ chave: string }[]>`SELECT t.chave FROM terreno t WHERE t.status = 'ativo' AND t.anexo_de IS NULL
    AND (('emp_' || t.usuario_id) = ${empId} OR ('emp_' || t.usuario_id || '_' || regexp_replace(replace(t.chave, '-', 'm'), '[^a-zA-Z0-9]', '_', 'g')) = ${empId}) LIMIT 1`;
  if (t) return { unidades: mensalidadeDoLote(t.chave), vitrine: false };
  const [v] = await db`SELECT 1 FROM loja_vitrine WHERE empresa_id = ${empId} AND publicada_em IS NOT NULL`;
  return v ? { unidades: UNIDADES_MES_VITRINE, vitrine: true } : { unidades: 0, vitrine: false };
}

interface CarteiraIA { inclusa: number; comprada: number; mes: string; baseMes: number; avisado: string | null; planoMes: string | null } // planoMes: 'vitrine' = a mensalidade do mês veio da página grátis
interface NovoLancIA { tipo: "mensalidade" | "compra" | "uso" | "vencimento" | "ajuste" | "estorno"; inclusa: number; comprada: number; descricao: string; agenteId?: string | null; categoria?: string | null; modelo?: string | null; custoBrl?: number | null; pagamentoId?: string | null; chave?: string | null }
async function lancarIA(db: Db, empId: string, c: CarteiraIA, l: NovoLancIA) {
  if (l.chave) { const [ja] = await db`SELECT 1 FROM ia_lancamento WHERE chave = ${l.chave}`; if (ja) return false; }
  const inclusa = c.inclusa + l.inclusa, comprada = c.comprada + l.comprada;
  if (inclusa < 0 || comprada < 0) throw new Error("Saldo de unidades de IA insuficiente.");
  await db`INSERT INTO ia_lancamento (id, empresa_id, tipo, inclusa, comprada, saldo_inclusa, saldo_comprada, agente_id, categoria, modelo, custo_brl, descricao, pagamento_id, chave)
    VALUES (${id("il")}, ${empId}, ${l.tipo}, ${l.inclusa}, ${l.comprada}, ${inclusa}, ${comprada}, ${l.agenteId ?? null}, ${l.categoria ?? null}, ${l.modelo ?? null}, ${l.custoBrl ?? null}, ${l.descricao.slice(0, 200)}, ${l.pagamentoId ?? null}, ${l.chave ?? null})`;
  c.inclusa = inclusa; c.comprada = comprada;
  return true;
}
async function gravar(db: Db, empId: string, c: CarteiraIA) {
  await db`UPDATE ia_carteira SET inclusa = ${c.inclusa}, comprada = ${c.comprada}, mes = ${c.mes}, base_mes = ${c.baseMes}, avisado = ${c.avisado}, plano_mes = ${c.planoMes}, atualizado_em = now() WHERE empresa_id = ${empId}`;
}
// Trava a carteira da empresa e vira o mês se preciso: a inclusa que sobrou vence e entra a mensalidade nova.
// Sem lote ativo, o mês não é marcado (quem ativar o lote no meio do mês recebe a mensalidade na próxima chamada).
async function travarIA(db: Db, empId: string): Promise<CarteiraIA> {
  await db`INSERT INTO ia_carteira (empresa_id, mes) VALUES (${empId}, '') ON CONFLICT (empresa_id) DO NOTHING`;
  const [r] = await db<CarteiraIA[]>`SELECT inclusa, comprada, mes, base_mes, avisado, plano_mes FROM ia_carteira WHERE empresa_id = ${empId} FOR UPDATE`;
  const c: CarteiraIA = { inclusa: Number(r.inclusa), comprada: Number(r.comprada), mes: r.mes, baseMes: Number(r.baseMes), avisado: r.avisado, planoMes: r.planoMes ?? null };
  const mes = mesAtual();
  if (c.mes !== mes) {
    if (c.inclusa > 0) await lancarIA(db, empId, c, { tipo: "vencimento", inclusa: -c.inclusa, comprada: 0, descricao: `Unidades inclusas de ${nomeMes(c.mes)} venceram`, chave: `vence:${empId}:${c.mes}` });
    const m = await mensalidadeComPlano(db, empId), mensal = m.unidades;
    if (mensal > 0) {
      await lancarIA(db, empId, c, { tipo: "mensalidade", inclusa: mensal, comprada: 0, descricao: `Mensalidade de ${nomeMes(mes)}: ${mensal.toLocaleString("pt-BR")} unidades inclusas ${m.vitrine ? "na página grátis" : "no lote"}`, chave: `mensal:${empId}:${mes}` });
      c.mes = mes; c.baseMes = c.inclusa + c.comprada; c.avisado = null; c.planoMes = m.vitrine ? "vitrine" : null;
    }
    await gravar(db, empId, c);
  } else if (c.planoMes === "vitrine") {
    // a página grátis virou loja na cidade no meio do mês: entra a diferença para a mensalidade do lote ou do quiosque
    const m = await mensalidadeComPlano(db, empId);
    if (!m.vitrine) {
      const dif = m.unidades - UNIDADES_MES_VITRINE;
      if (dif > 0 && (await lancarIA(db, empId, c, { tipo: "mensalidade", inclusa: dif, comprada: 0, descricao: `Loja na cidade: mais ${dif.toLocaleString("pt-BR")} unidades inclusas em ${nomeMes(mes)}`, chave: `mensal-loja:${empId}:${mes}` }))) c.baseMes += dif;
      c.planoMes = null;
      await gravar(db, empId, c);
    }
  }
  return c;
}

export interface SaldoIA { empresaId: string; inclusa: number; comprada: number; total: number; mes: string; baseMes: number; cobrada: boolean }
export async function saldoIA(empId: string): Promise<SaldoIA> {
  await migrar();
  if (EMPRESAS_SEM_COBRANCA.has(empId)) return { empresaId: empId, inclusa: 0, comprada: 0, total: 0, mes: mesAtual(), baseMes: 0, cobrada: false };
  const c = await sql.begin(async (tx) => travarIA(tx as unknown as Db, empId));
  return { empresaId: empId, inclusa: c.inclusa, comprada: c.comprada, total: c.inclusa + c.comprada, mes: c.mes || mesAtual(), baseMes: c.baseMes, cobrada: true };
}

// O que os pontos de IA da equipe comparam (gasto >= teto = parou). Mantém a conta de antes (equipeCliente.ts, motor.ts,
// delegacao.ts): gasto real do mês em R$ e um "teto" que é o gasto mais o saldo de unidades em R$. Saldo 0 = teto atingido.
export async function tetoDaEmpresa(empId: string, gastoMes: number) {
  const s = await saldoIA(empId);
  return { gasto: gastoMes, teto: s.cobrada ? gastoMes + s.total * VALOR_UNIDADE_BRL : Number.POSITIVE_INFINITY, unidades: s };
}
export const MSG_SEM_UNIDADES = "As unidades de IA da empresa acabaram. Compre unidades em Créditos para a equipe voltar a responder agora, ou espere a mensalidade do mês que vem.";

// Débito de uma chamada de IA (chamado por agentes.ts › registrarUso). Nunca lança: a resposta já foi dada.
export async function debitarUsoIA(d: { agenteId: string; modelo: string; custoBrl: number; categoria?: CategoriaIA }) {
  try {
    const unidades = unidadesDoCusto(d.custoBrl); if (unidades <= 0) return;
    await migrar();
    const [ag] = await sql<{ empresaId: string; nome: string }[]>`SELECT empresa_id, nome FROM agente WHERE id = ${d.agenteId}`;
    if (!ag || EMPRESAS_SEM_COBRANCA.has(ag.empresaId)) return;
    const categoria: CategoriaIA = d.categoria ?? (/image/i.test(d.modelo) ? "imagem" : "conversa");
    const aviso = await sql.begin(async (tx) => {
      const db = tx as unknown as Db;
      const c = await travarIA(db, ag.empresaId);
      const cobrar = Math.min(unidades, c.inclusa + c.comprada); // sem saldo negativo: o que passar do saldo fica por conta do WorkEnd
      const daInclusa = Math.min(c.inclusa, cobrar);
      await lancarIA(db, ag.empresaId, c, { tipo: "uso", inclusa: -daInclusa, comprada: -(cobrar - daInclusa), descricao: `${NOME_CATEGORIA[categoria]} · ${ag.nome}${cobrar < unidades ? ` (${unidades - cobrar} sem saldo)` : ""}`, agenteId: d.agenteId, categoria, modelo: d.modelo, custoBrl: d.custoBrl });
      const resta = c.inclusa + c.comprada;
      let novo: "20" | "0" | null = null;
      if (resta <= 0 && c.avisado !== "0") novo = "0";
      else if (resta > 0 && c.baseMes > 0 && resta <= c.baseMes * AVISO_UNIDADES && !c.avisado) novo = "20";
      if (novo) c.avisado = novo;
      await gravar(db, ag.empresaId, c);
      return novo ? { tipo: novo, resta, mes: c.mes } : null;
    });
    if (aviso) {
      const [e] = await sql<{ usuarioId: string | null }[]>`SELECT usuario_id FROM empresa WHERE id = ${ag.empresaId}`;
      if (e?.usuarioId) void avisar(e.usuarioId, aviso.tipo === "0"
        ? { tipo: "sistema", ref: `ia0:${ag.empresaId}:${aviso.mes}`, titulo: "As unidades de IA da empresa acabaram", texto: "A equipe parou de usar IA e responde com o recado fixo. Compre unidades para ela voltar agora, ou espere a mensalidade do mês que vem.", link: "/app/creditos#unidades" }
        : { tipo: "sistema", ref: `ia20:${ag.empresaId}:${aviso.mes}`, titulo: `Restam ${aviso.resta.toLocaleString("pt-BR")} unidades de IA`, texto: "A equipe já usou 80% das unidades deste mês. Quando acabar, ela para de usar IA até você comprar mais.", link: "/app/creditos#unidades" });
    }
  } catch (e) { console.error("[unidades]", (e as Error).message); }
}

// Compra de unidades (pagamento tipo "ia" aprovado, por créditos ou Pix). Idempotente por pagamento.
export async function creditarUnidades(db: Db, empId: string, unidades: number, pagamentoId: string) {
  const c = await travarIA(db, empId);
  const ok = await lancarIA(db, empId, c, { tipo: "compra", inclusa: 0, comprada: unidades, descricao: `Compra de ${unidades.toLocaleString("pt-BR")} unidades de IA (não vencem)`, pagamentoId, chave: `compra:${pagamentoId}` });
  if (ok) { c.baseMes += unidades; if (c.avisado && c.inclusa + c.comprada > c.baseMes * AVISO_UNIDADES) c.avisado = null; await gravar(db, empId, c); }
  return true;
}
export async function retirarUnidades(db: Db, empId: string, unidades: number, pagamentoId: string) {
  const c = await travarIA(db, empId);
  const tira = Math.min(unidades, c.comprada);
  if (tira > 0 && (await lancarIA(db, empId, c, { tipo: "estorno", inclusa: 0, comprada: -tira, descricao: "Pagamento das unidades estornado", pagamentoId, chave: `estorno:${pagamentoId}` }))) await gravar(db, empId, c);
}

// ---------- telas ----------
// Medidor do dono: saldo, consumo do mês, estimativa em respostas (nunca em tokens) e o extrato por agente e por tipo
export async function medidorIA(empId: string) {
  const s = await saldoIA(empId);
  const mensal = await mensalidadeDa(sql, empId); // quiosque: 300 por mês; lote: 1.000
  const inicioMes = sql`(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')`;
  const [m] = await sql<{ usadas: string; conversas: number; unidadesConversa: string }[]>`SELECT
      COALESCE(-sum(inclusa + comprada) FILTER (WHERE tipo = 'uso'), 0) AS usadas,
      count(*) FILTER (WHERE tipo = 'uso' AND categoria = 'conversa')::int AS conversas, COALESCE(-sum(inclusa + comprada) FILTER (WHERE tipo = 'uso' AND categoria = 'conversa'), 0) AS unidades_conversa
    FROM ia_lancamento WHERE empresa_id = ${s.empresaId} AND criado_em >= ${inicioMes}`;
  const porAgente = await sql<{ agenteId: string; nome: string | null; categoria: string; usadas: string; vezes: number }[]>`SELECT l.agente_id, a.nome, l.categoria, -sum(l.inclusa + l.comprada) AS usadas, count(*)::int AS vezes
    FROM ia_lancamento l LEFT JOIN agente a ON a.id = l.agente_id WHERE l.empresa_id = ${s.empresaId} AND l.tipo = 'uso' AND l.criado_em >= ${inicioMes}
    GROUP BY l.agente_id, a.nome, l.categoria ORDER BY usadas DESC LIMIT 60`;
  const extrato = await sql<{ id: string; tipo: string; inclusa: number; comprada: number; saldoInclusa: number; saldoComprada: number; descricao: string; categoria: string | null; criadoEm: Date }[]>`SELECT id, tipo, inclusa, comprada, saldo_inclusa, saldo_comprada, descricao, categoria, criado_em
    FROM ia_lancamento WHERE empresa_id = ${s.empresaId} ORDER BY criado_em DESC, id DESC LIMIT 40`;
  const porResposta = m && m.conversas >= 5 ? Number(m.unidadesConversa) / m.conversas : UNIDADES_POR_RESPOSTA;
  return {
    saldo: s, usadasMes: Number(m?.usadas ?? 0), respostas: Math.floor(s.total / Math.max(1, porResposta)),
    porAgente: porAgente.map((r) => ({ agenteId: r.agenteId, nome: r.nome ?? "Agente", categoria: r.categoria, nomeCategoria: NOME_CATEGORIA[r.categoria as CategoriaIA] ?? r.categoria, usadas: Number(r.usadas), vezes: r.vezes })),
    extrato: extrato.map((r) => ({ ...r, unidades: Number(r.inclusa) + Number(r.comprada) })),
    pacotes: PACOTES_UNIDADES, mensalidade: mensal || UNIDADES_MES_LOTE, aviso: s.cobrada && s.baseMes > 0 && s.total > 0 && s.total <= s.baseMes * AVISO_UNIDADES, esgotado: s.cobrada && s.total <= 0,
  };
}
// Admin: consumo de todas as empresas no mês, custo real somado (uso_ia) e o que foi vendido em unidades
export async function consumoIAAdmin() {
  await migrar();
  const inicioMes = sql`(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')`;
  const empresas = await sql<{ empresaId: string; nome: string | null; custo: string; chamadas: number; usadas: string; inclusa: number | null; comprada: number | null; compradasMes: string }[]>`
    SELECT x.empresa_id, e.nome, x.custo, x.chamadas, COALESCE(l.usadas, 0) AS usadas, c.inclusa, c.comprada, COALESCE(l.compradas_mes, 0) AS compradas_mes
    FROM (SELECT a.empresa_id, sum(u.custo_brl) AS custo, count(*)::int AS chamadas FROM uso_ia u JOIN agente a ON a.id = u.agente_id WHERE u.criado_em >= ${inicioMes} GROUP BY a.empresa_id) x
    LEFT JOIN empresa e ON e.id = x.empresa_id LEFT JOIN ia_carteira c ON c.empresa_id = x.empresa_id
    LEFT JOIN (SELECT empresa_id, -sum(inclusa + comprada) FILTER (WHERE tipo = 'uso') AS usadas, sum(comprada) FILTER (WHERE tipo = 'compra') AS compradas_mes FROM ia_lancamento WHERE criado_em >= ${inicioMes} GROUP BY empresa_id) l ON l.empresa_id = x.empresa_id
    ORDER BY x.custo DESC LIMIT 200`;
  const [v] = await sql<{ creditos: string; reais: string }[]>`SELECT COALESCE(sum(p.creditos_carteira), 0) AS creditos, COALESCE(sum(p.valor), 0) AS reais
    FROM pagamento p WHERE p.tipo = 'ia' AND p.status = 'aprovado' AND p.pago_em >= ${inicioMes}`;
  const [u] = await sql<{ unidades: string }[]>`SELECT COALESCE(sum(comprada), 0) AS unidades FROM ia_lancamento WHERE tipo = 'compra' AND criado_em >= ${inicioMes}`;
  const lista = empresas.map((e) => ({ empresaId: e.empresaId, nome: e.nome ?? e.empresaId, custo: Number(e.custo), chamadas: e.chamadas, usadas: Number(e.usadas), saldo: e.inclusa == null ? null : Number(e.inclusa) + Number(e.comprada), compradasMes: Number(e.compradasMes), cobrada: !EMPRESAS_SEM_COBRANCA.has(e.empresaId) }));
  const cobradas = lista.filter((e) => e.cobrada);
  return {
    empresas: lista,
    totais: { custoReal: lista.reduce((s, e) => s + e.custo, 0), custoCobradas: cobradas.reduce((s, e) => s + e.custo, 0), custoInterno: lista.filter((e) => !e.cobrada).reduce((s, e) => s + e.custo, 0), unidadesUsadas: cobradas.reduce((s, e) => s + e.usadas, 0), unidadesVendidasMes: Number(u.unidades), creditosPagosMes: Number(v.creditos), reaisPixMes: Number(v.reais) },
  };
}
