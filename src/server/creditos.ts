// Créditos WorkEnd (20/11/2026, pedido do dono: "um sistema de créditos na empresa para poder comprar, algo estilo
// moedas, mas que não tenha nome de moedas, algo mais sério e robusto"). 1 crédito = R$ 1,00.
//  - Carteira por usuário com dois baldes: COMPRADO (pacotes no Pix; o que não foi usado volta em dinheiro em até 7 dias,
//    CDC art. 49) e BÔNUS (bônus dos pacotes, indicação e cortesia do admin; nunca volta em dinheiro).
//  - Extrato imutável (credito_lancamento, migração 0042): cada movimento grava os dois saldos depois dele. A carteira
//    (credito_carteira) é travada com FOR UPDATE em toda escrita e tem CHECK >= 0: duas compras ao mesmo tempo não
//    deixam o saldo negativo. Cada lançamento pode ter uma chave única: repetir a mesma operação não lança de novo.
//  - Gasto: primeiro o bônus, depois o comprado (o mais antigo primeiro), para o comprado recente continuar devolvível.
//  - Valores no código em CENTAVOS de crédito (inteiros); no banco NUMERIC(12,2), exato.
import { sql, migrar, id } from "./db";

type Db = typeof sql;

// Pacotes à venda no Pix (fácil de mudar: o bônus é em créditos, separado do comprado)
export const PACOTES_CREDITOS = [
  { id: "50", creditos: 50, bonus: 0 },
  { id: "100", creditos: 100, bonus: 0 },
  { id: "250", creditos: 250, bonus: 12.5 }, // 5%
  { id: "500", creditos: 500, bonus: 40 }, // 8%
  { id: "1000", creditos: 1000, bonus: 100 }, // 10%
] as const;
export type PacoteCreditos = (typeof PACOTES_CREDITOS)[number];
export const PACOTE_POR_ID: Record<string, PacoteCreditos> = Object.fromEntries(PACOTES_CREDITOS.map((p) => [p.id, p]));
export const DIAS_DEVOLUCAO = 7;
// regras que aparecem na página de créditos e no rodapé do extrato
export const REGRAS_CREDITOS = [
  "1 crédito vale R$ 1,00 e paga tudo o que o WorkEnd vende: lote, renovação, troca de prédio, agentes, unidades de IA, outdoor, barraca da feira e itens do personagem.",
  "Os créditos não vencem e não são transferidos para outra conta.",
  "O bônus dos pacotes maiores é separado do que você comprou: ele é usado primeiro e não volta em dinheiro.",
  `Crédito comprado e ainda não usado pode ser devolvido em até ${DIAS_DEVOLUCAO} dias da compra (Código de Defesa do Consumidor). Ao devolver um pacote, o bônus dele sai junto; se esse bônus já foi usado, o valor usado é descontado da devolução.`,
  "Quando o saldo não cobre o preço, você usa o que tem e paga o resto no Pix. Se esse Pix não for pago, os créditos reservados voltam para a carteira.",
  "Se um Pix aprovado não puder ser entregue (por exemplo, a vaga acabou), o valor vira crédito comprado na sua carteira.",
];

export class ErroSaldo extends Error { constructor(msg = "Saldo de créditos insuficiente.") { super(msg); } }

const cent = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const reais = (c: number) => c / 100;
export const fmtCreditos = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Saldo { comprado: number; bonus: number; total: number }
export interface Lancamento { id: string; tipo: string; comprado: number; bonus: number; saldoComprado: number; saldoBonus: number; descricao: string; pagamentoId: string | null; motivo: string | null; criadoEm: Date }

export async function saldoDe(uid: string, db: Db = sql): Promise<Saldo> {
  await migrar();
  const [c] = await db<{ comprado: string; bonus: string }[]>`SELECT comprado, bonus FROM credito_carteira WHERE usuario_id = ${uid}`;
  const comprado = cent(c?.comprado), bonus = cent(c?.bonus);
  return { comprado: reais(comprado), bonus: reais(bonus), total: reais(comprado + bonus) };
}

// trava a carteira (cria vazia na primeira vez) e devolve os saldos em centavos
async function travar(db: Db, uid: string) {
  await db`INSERT INTO credito_carteira (usuario_id) VALUES (${uid}) ON CONFLICT (usuario_id) DO NOTHING`;
  const [c] = await db<{ comprado: string; bonus: string }[]>`SELECT comprado, bonus FROM credito_carteira WHERE usuario_id = ${uid} FOR UPDATE`;
  return { comprado: cent(c.comprado), bonus: cent(c.bonus) };
}

export interface NovoLancamento { tipo: "compra" | "bonus" | "uso" | "estorno" | "ajuste" | "devolucao"; comprado: number; bonus: number; descricao: string; pagamentoId?: string | null; chave?: string | null; motivo?: string | null; adminId?: string | null }
// Lança um movimento (valores em CENTAVOS, + entra / − sai) dentro da transação `db`. Com chave já usada, não faz nada
// e devolve null. Saldo que ficaria negativo: ErroSaldo (a transação toda volta).
export async function lancar(db: Db, uid: string, l: NovoLancamento) {
  const s = await travar(db, uid);
  if (l.chave) { const [ja] = await db`SELECT 1 FROM credito_lancamento WHERE chave = ${l.chave}`; if (ja) return null; }
  const comprado = s.comprado + Math.round(l.comprado), bonus = s.bonus + Math.round(l.bonus);
  if (comprado < 0 || bonus < 0) throw new ErroSaldo();
  const lid = id("cl");
  await db`INSERT INTO credito_lancamento (id, usuario_id, tipo, comprado, bonus, saldo_comprado, saldo_bonus, descricao, pagamento_id, chave, motivo, admin_id)
    VALUES (${lid}, ${uid}, ${l.tipo}, ${reais(Math.round(l.comprado))}, ${reais(Math.round(l.bonus))}, ${reais(comprado)}, ${reais(bonus)}, ${l.descricao.slice(0, 200)}, ${l.pagamentoId ?? null}, ${l.chave ?? null}, ${l.motivo ?? null}, ${l.adminId ?? null})`;
  await db`UPDATE credito_carteira SET comprado = ${reais(comprado)}, bonus = ${reais(bonus)}, atualizado_em = now() WHERE usuario_id = ${uid}`;
  return { id: lid, comprado: reais(comprado), bonus: reais(bonus) };
}

// Gasta `valor` (em reais = créditos): primeiro o bônus, depois o comprado. Saldo curto: ErroSaldo.
export async function debitar(db: Db, uid: string, valor: number, descricao: string, pagamentoId: string, chave: string) {
  const v = cent(valor); if (v <= 0) return { comprado: 0, bonus: 0 };
  const s = await travar(db, uid);
  if (s.comprado + s.bonus < v) throw new ErroSaldo(`Saldo de créditos insuficiente (você tem ${fmtCreditos(reais(s.comprado + s.bonus))}).`);
  const doBonus = Math.min(s.bonus, v), doComprado = v - doBonus;
  await lancar(db, uid, { tipo: "uso", comprado: -doComprado, bonus: -doBonus, descricao, pagamentoId, chave });
  return { comprado: reais(doComprado), bonus: reais(doBonus) };
}
// Gasta até `valor`, o que tiver (estornos e descontos antigos que não podem travar um pagamento já aprovado)
export async function debitarAte(db: Db, uid: string, valor: number, l: Omit<NovoLancamento, "comprado" | "bonus">) {
  const s = await travar(db, uid);
  const v = Math.min(cent(valor), s.comprado + s.bonus); if (v <= 0) return 0;
  const doBonus = Math.min(s.bonus, v);
  await lancar(db, uid, { ...l, comprado: -(v - doBonus), bonus: -doBonus });
  return reais(v);
}
// Devolve à carteira o que um pagamento tirou dela (Pix não pago, produto estornado), nos mesmos baldes. Idempotente.
export async function devolverUso(db: Db, uid: string, pagamentoId: string, descricao: string) {
  await travar(db, uid); // a soma abaixo só vale com a carteira parada
  const [u] = await db<{ comprado: string; bonus: string; usos: number }[]>`SELECT COALESCE(sum(comprado), 0) AS comprado, COALESCE(sum(bonus), 0) AS bonus, count(*) FILTER (WHERE tipo = 'uso')::int AS usos
    FROM credito_lancamento WHERE pagamento_id = ${pagamentoId} AND usuario_id = ${uid} AND (tipo = 'uso' OR (tipo = 'estorno' AND chave LIKE 'devolve:%'))`;
  const comprado = -cent(u?.comprado), bonus = -cent(u?.bonus); // o que ainda está fora da carteira
  if (comprado <= 0 && bonus <= 0) return false;
  const r = await lancar(db, uid, { tipo: "estorno", comprado: Math.max(0, comprado), bonus: Math.max(0, bonus), descricao, pagamentoId, chave: `devolve:${pagamentoId}:${u?.usos ?? 0}` });
  return !!r;
}
// a reserva de um pagamento já voltou para a carteira? (Pix pago depois de vencer precisa debitar de novo)
export async function usoEmAberto(db: Db, pagamentoId: string) {
  const [u] = await db<{ t: string }[]>`SELECT COALESCE(-sum(comprado + bonus), 0) AS t FROM credito_lancamento WHERE pagamento_id = ${pagamentoId} AND (tipo = 'uso' OR (tipo = 'estorno' AND chave LIKE 'devolve:%'))`;
  return reais(cent(u?.t));
}

// ---------- pacotes ----------
// Pix do pacote aprovado: comprado e bônus em lançamentos separados (chaves por pagamento: o webhook pode chegar 2 vezes)
export async function creditarPacote(db: Db, uid: string, pagamentoId: string, pacoteId: string) {
  const p = PACOTE_POR_ID[pacoteId]; if (!p) return false;
  await lancar(db, uid, { tipo: "compra", comprado: cent(p.creditos), bonus: 0, descricao: `Compra do pacote de ${p.creditos} créditos (Pix)`, pagamentoId, chave: `compra:${pagamentoId}` });
  if (p.bonus > 0) await lancar(db, uid, { tipo: "bonus", comprado: 0, bonus: cent(p.bonus), descricao: `Bônus do pacote de ${p.creditos} créditos (não volta em dinheiro)`, pagamentoId, chave: `bonus:${pagamentoId}` });
  return true;
}
// Pix aprovado que não pôde virar o produto: o valor entra como crédito comprado (devolvível como um pacote)
export async function creditarPixSemProduto(db: Db, uid: string, pagamentoId: string, valor: number, oQue: string) {
  if (valor <= 0) return false;
  return !!(await lancar(db, uid, { tipo: "compra", comprado: cent(valor), bonus: 0, descricao: `Pix de ${oQue} virou crédito (não deu para entregar)`, pagamentoId, chave: `compra:${pagamentoId}` }));
}

// Quanto de um pacote ainda pode ser devolvido. Gasto do comprado é do mais antigo para o mais novo, então o saldo
// comprado que sobrou pertence primeiro aos pacotes mais novos.
export interface Devolucao { pagamentoId: string; creditosComprados: number; restante: number; bonusPacote: number; bonusSai: number; descontoBonus: number; creditosSaem: number; valorReais: number; prazoAte: Date; noPrazo: boolean; jaDevolvido: boolean }
export async function calcularDevolucao(pagamentoId: string, db: Db = sql): Promise<Devolucao> {
  await migrar();
  const [pg] = await db<{ usuarioId: string; valor: string; pagoEm: Date | null; criadoEm: Date; devolvidoEm: Date | null; status: string }[]>`SELECT usuario_id, valor, pago_em, criado_em, devolvido_em, status FROM pagamento WHERE id = ${pagamentoId}`;
  if (!pg) throw new Error("Pagamento não encontrado.");
  const compras = await db<{ pagamentoId: string; comprado: string; criadoEm: Date }[]>`SELECT l.pagamento_id, l.comprado, l.criado_em FROM credito_lancamento l
    WHERE l.usuario_id = ${pg.usuarioId} AND l.tipo = 'compra' AND l.comprado > 0
      AND NOT EXISTS (SELECT 1 FROM credito_lancamento d WHERE d.pagamento_id = l.pagamento_id AND d.tipo = 'devolucao')
    ORDER BY l.criado_em DESC`;
  const [daqui] = await db<{ comprado: string; bonus: string; criadoEm: Date }[]>`SELECT
      COALESCE((SELECT sum(comprado) FROM credito_lancamento WHERE pagamento_id = ${pagamentoId} AND tipo = 'compra'), 0) AS comprado,
      COALESCE((SELECT sum(bonus) FROM credito_lancamento WHERE pagamento_id = ${pagamentoId} AND tipo = 'bonus'), 0) AS bonus,
      (SELECT min(criado_em) FROM credito_lancamento WHERE pagamento_id = ${pagamentoId} AND tipo = 'compra') AS criado_em`;
  const comprados = cent(daqui?.comprado), bonusPacote = cent(daqui?.bonus);
  if (comprados <= 0) throw new Error("Esse pagamento não colocou créditos comprados na carteira.");
  const s = await saldoDe(pg.usuarioId, db);
  let antes = 0, restante = 0;
  for (const c of compras) {
    const q = cent(c.comprado);
    if (c.pagamentoId === pagamentoId) { restante = Math.max(0, Math.min(q, cent(s.comprado) - antes)); break; }
    antes += q;
  }
  const bonusSai = Math.min(bonusPacote, cent(s.bonus));
  const descontoBonus = bonusPacote - bonusSai;
  const devolvivel = Math.max(0, restante - descontoBonus);
  const taxa = Number(pg.valor) > 0 ? cent(pg.valor) / comprados : 1; // a conta admin paga 1/100: devolve 1/100
  const desde = daqui?.criadoEm ? new Date(daqui.criadoEm) : new Date(pg.pagoEm ?? pg.criadoEm);
  const prazoAte = new Date(desde.getTime() + DIAS_DEVOLUCAO * 86400_000);
  return { pagamentoId, creditosComprados: reais(comprados), restante: reais(restante), bonusPacote: reais(bonusPacote), bonusSai: reais(bonusSai), descontoBonus: reais(Math.min(descontoBonus, restante)), creditosSaem: reais(restante), valorReais: reais(Math.round(devolvivel * taxa)), prazoAte, noPrazo: Date.now() <= prazoAte.getTime(), jaDevolvido: !!pg.devolvidoEm || compras.every((c) => c.pagamentoId !== pagamentoId) };
}
// Admin marca a devolução: os créditos do pacote (e o bônus dele) saem da carteira; o Pix volta à mão no Mercado Pago
export async function marcarDevolucao(adminId: string, pagamentoId: string, motivo: string, foraDoPrazo = false) {
  await migrar();
  const m = motivo.trim().slice(0, 300);
  if (m.length < 5) throw new Error("Escreva o motivo da devolução (fica no extrato).");
  return sql.begin(async (tx) => {
    const db = tx as unknown as Db;
    const [pg] = await db<{ usuarioId: string }[]>`SELECT usuario_id FROM pagamento WHERE id = ${pagamentoId} FOR UPDATE`;
    if (!pg) throw new Error("Pagamento não encontrado.");
    await travar(db, pg.usuarioId); // a conta fica parada enquanto calcula
    const d = await calcularDevolucao(pagamentoId, db);
    if (d.jaDevolvido) throw new Error("Esse pacote já foi devolvido.");
    if (!d.noPrazo && !foraDoPrazo) throw new Error(`Passou o prazo de ${DIAS_DEVOLUCAO} dias (venceu em ${d.prazoAte.toLocaleDateString("pt-BR")}). Marque "fora do prazo" se for uma exceção.`);
    if (d.restante <= 0) throw new Error("Os créditos desse pacote já foram usados: não há o que devolver.");
    await lancar(db, pg.usuarioId, { tipo: "devolucao", comprado: -cent(d.restante), bonus: -cent(d.bonusSai), descricao: `Devolução de ${fmtCreditos(d.restante)} créditos comprados${d.bonusSai > 0 ? ` e do bônus do pacote` : ""} · R$ ${d.valorReais.toFixed(2).replace(".", ",")} no Pix`, pagamentoId, chave: `devolucao:${pagamentoId}`, motivo: m, adminId });
    await db`UPDATE pagamento SET devolvido_em = now(), devolvido_valor = ${d.valorReais}, devolvido_por = ${adminId} WHERE id = ${pagamentoId}`;
    return d;
  });
}
// Estorno feito pelo Mercado Pago (reembolso ou contestação) de um pagamento que pôs créditos na carteira: tira o que
// ainda sobra dele (o que já foi devolvido à mão não sai de novo). Devolve o que não deu para retirar.
export async function retirarCreditosDoPagamento(db: Db, uid: string, pagamentoId: string) {
  const [x] = await db<{ entrou: string; saiu: string }[]>`SELECT COALESCE(sum(comprado + bonus) FILTER (WHERE tipo IN ('compra', 'bonus')), 0) AS entrou,
    COALESCE(-sum(comprado + bonus) FILTER (WHERE tipo IN ('devolucao') OR (tipo = 'estorno' AND chave LIKE 'mp-estorno:%')), 0) AS saiu FROM credito_lancamento WHERE pagamento_id = ${pagamentoId}`;
  const falta = Math.max(0, cent(x?.entrou) - cent(x?.saiu));
  if (falta <= 0) return 0;
  const tirou = await debitarAte(db, uid, reais(falta), { tipo: "estorno", descricao: "Pix estornado no Mercado Pago: créditos desse pagamento retirados", pagamentoId, chave: `mp-estorno:${pagamentoId}` });
  return reais(falta) - tirou;
}

// ---------- ajuste do admin ----------
// Positivo entra como bônus (cortesia: não volta em dinheiro). Negativo tira do bônus e depois do comprado.
export async function ajustarCreditos(adminId: string, uid: string, valor: number, motivo: string) {
  await migrar();
  const m = motivo.trim().slice(0, 300);
  if (m.length < 5) throw new Error("Escreva o motivo do ajuste (fica no extrato).");
  const v = cent(valor);
  if (!v || Math.abs(v) > 1_000_000) throw new Error("Valor do ajuste inválido.");
  const [u] = await sql`SELECT 1 FROM usuario WHERE id = ${uid}`; if (!u) throw new Error("Usuário não encontrado.");
  return sql.begin(async (tx) => {
    const db = tx as unknown as Db;
    if (v > 0) return lancar(db, uid, { tipo: "ajuste", comprado: 0, bonus: v, descricao: "Ajuste do WorkEnd (cortesia, entra como bônus)", motivo: m, adminId });
    const s = await travar(db, uid);
    if (s.comprado + s.bonus < -v) throw new ErroSaldo(`A carteira só tem ${fmtCreditos(reais(s.comprado + s.bonus))} créditos.`);
    const doBonus = Math.min(s.bonus, -v);
    return lancar(db, uid, { tipo: "ajuste", comprado: -(-v - doBonus), bonus: -doBonus, descricao: "Ajuste do WorkEnd (retirada)", motivo: m, adminId });
  });
}

// ---------- leitura ----------
export async function extratoDe(uid: string, limite = 60): Promise<Lancamento[]> {
  await migrar();
  const rows = await sql<{ id: string; tipo: string; comprado: string; bonus: string; saldoComprado: string; saldoBonus: string; descricao: string; pagamentoId: string | null; motivo: string | null; criadoEm: Date }[]>`
    SELECT id, tipo, comprado, bonus, saldo_comprado, saldo_bonus, descricao, pagamento_id, motivo, criado_em FROM credito_lancamento WHERE usuario_id = ${uid} ORDER BY criado_em DESC, id DESC LIMIT ${Math.min(500, limite)}`;
  return rows.map((r) => ({ ...r, comprado: Number(r.comprado), bonus: Number(r.bonus), saldoComprado: Number(r.saldoComprado), saldoBonus: Number(r.saldoBonus) }));
}
// pacotes da pessoa que ainda estão no prazo de devolução (aparece na página: "pode pedir a devolução até ...")
export async function pacotesDevolviveis(uid: string) {
  await migrar();
  const rows = await sql<{ pagamentoId: string }[]>`SELECT DISTINCT l.pagamento_id FROM credito_lancamento l WHERE l.usuario_id = ${uid} AND l.tipo = 'compra'
    AND l.criado_em > now() - make_interval(days => ${DIAS_DEVOLUCAO}) AND NOT EXISTS (SELECT 1 FROM credito_lancamento d WHERE d.pagamento_id = l.pagamento_id AND d.tipo = 'devolucao')`;
  const out: Devolucao[] = [];
  for (const r of rows) { const d = await calcularDevolucao(r.pagamentoId).catch(() => null); if (d && d.restante > 0 && d.noPrazo) out.push(d); }
  return out;
}

// admin: carteiras, totais e conferência (soma do extrato = saldo da carteira)
export async function carteirasAdmin() {
  await migrar();
  const lista = await sql<{ usuarioId: string; email: string | null; nome: string | null; comprado: string; bonus: string; atualizadoEm: Date; somaComprado: string; somaBonus: string; lancamentos: number }[]>`
    SELECT c.usuario_id, u.email, u.nome, c.comprado, c.bonus, c.atualizado_em,
      COALESCE((SELECT sum(l.comprado) FROM credito_lancamento l WHERE l.usuario_id = c.usuario_id), 0) AS soma_comprado,
      COALESCE((SELECT sum(l.bonus) FROM credito_lancamento l WHERE l.usuario_id = c.usuario_id), 0) AS soma_bonus,
      (SELECT count(*)::int FROM credito_lancamento l WHERE l.usuario_id = c.usuario_id) AS lancamentos
    FROM credito_carteira c LEFT JOIN usuario u ON u.id = c.usuario_id ORDER BY c.atualizado_em DESC LIMIT 300`;
  const [t] = await sql<{ pacotes: number; reais: string; creditosVendidos: string; bonusDados: string; usados: string; devolvidos: string; devolvidosReais: string }[]>`SELECT
      (SELECT count(*)::int FROM pagamento WHERE tipo = 'creditos' AND status = 'aprovado') AS pacotes,
      (SELECT COALESCE(sum(valor), 0) FROM pagamento WHERE tipo = 'creditos' AND status = 'aprovado') AS reais,
      (SELECT COALESCE(sum(comprado), 0) FROM credito_lancamento WHERE tipo = 'compra') AS creditos_vendidos,
      (SELECT COALESCE(sum(bonus), 0) FROM credito_lancamento WHERE bonus > 0 AND tipo IN ('bonus', 'ajuste')) AS bonus_dados,
      (SELECT COALESCE(-sum(comprado + bonus), 0) FROM credito_lancamento WHERE tipo = 'uso') - (SELECT COALESCE(sum(comprado + bonus), 0) FROM credito_lancamento WHERE tipo = 'estorno' AND chave LIKE 'devolve:%') AS usados,
      (SELECT COALESCE(-sum(comprado), 0) FROM credito_lancamento WHERE tipo = 'devolucao') AS devolvidos,
      (SELECT COALESCE(sum(devolvido_valor), 0) FROM pagamento WHERE devolvido_em IS NOT NULL) AS devolvidos_reais`;
  const carteiras = lista.map((c) => ({ usuarioId: c.usuarioId, email: c.email, nome: c.nome, comprado: Number(c.comprado), bonus: Number(c.bonus), total: Number(c.comprado) + Number(c.bonus), atualizadoEm: c.atualizadoEm, lancamentos: c.lancamentos, confere: cent(c.comprado) === cent(c.somaComprado) && cent(c.bonus) === cent(c.somaBonus) }));
  const pacotes = await sql<{ id: string; usuarioId: string; email: string; valor: string; terrenoChave: string; criadoEm: Date; devolvidoEm: Date | null; devolvidoValor: string | null }[]>`SELECT p.id, p.usuario_id, u.email, p.valor, p.terreno_chave, p.criado_em, p.devolvido_em, p.devolvido_valor
    FROM pagamento p JOIN usuario u ON u.id = p.usuario_id WHERE p.tipo = 'creditos' AND p.status = 'aprovado' ORDER BY p.criado_em DESC LIMIT 100`;
  return {
    carteiras,
    totais: { pacotes: t.pacotes, reais: Number(t.reais), creditosVendidos: Number(t.creditosVendidos), bonusDados: Number(t.bonusDados), usados: Number(t.usados), devolvidos: Number(t.devolvidos), devolvidosReais: Number(t.devolvidosReais), emCirculacao: carteiras.reduce((s, c) => s + c.total, 0), divergencias: carteiras.filter((c) => !c.confere).length },
    pacotes: pacotes.map((p) => ({ ...p, valor: Number(p.valor), devolvidoValor: p.devolvidoValor == null ? null : Number(p.devolvidoValor), pacote: p.terrenoChave.replace(/^creditos:/, "") })),
  };
}
