// Pagamento do chão no Mercado Pago por Pix direto: criamos o pagamento na API, mostramos o QR Code no cartão do
// lote e o comprador paga pelo app do banco dele — sem login no Mercado Pago. A confirmação vem pelo webhook e pela
// conferência que o mapa faz a cada poucos segundos. Só o Access Token é necessário (MP_ACCESS_TOKEN no CapRover).
import { sql, id, migrar } from "./db";
import { precoPara, ativarTerreno, reverterTerreno, estenderReserva, obterTerreno, creditarTrocaLayout, retirarCreditoLayout, ehAdmin } from "./terrenos";
import { ativarPersonagem, reverterPersonagem, PRECO_PERSONAGEM } from "./personagens";
import { registrar } from "./eventos";
import { PRECO_TROCA_LAYOUT } from "@/office/data/escritorio";
import type { Usuario } from "./usuarios";
import { enviarEmail, brl, dataBR } from "./email";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { ativarOutdoor, reverterOutdoor } from "./outdoors";
import { ativarBarraca, reverterBarraca, ativarItem, reverterItem } from "./cidade";

const API = "https://api.mercadopago.com";
export const pagamentoLigado = () => !!process.env.MP_ACCESS_TOKEN;
const token = () => { const t = process.env.MP_ACCESS_TOKEN?.trim(); if (!t) throw new Error("Pagamento ainda não está ligado (MP_ACCESS_TOKEN)."); return t; };

export interface Pagamento { id: string; terrenoChave: string; usuarioId: string; status: string; valor: string; meses: number; metodo: string | null; preferenciaId: string | null; pagamentoId: string | null; criadoEm: Date; pagoEm: Date | null; tipo?: string }
export interface PagamentoAdmin extends Pagamento { email: string; empresaNome: string | null }

async function mp<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + caminho, { ...init, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${(j as { message?: string }).message ?? JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}

// Cria a cobrança Pix direto (API de pagamentos, sem Checkout Pro): devolve o QR Code e o copia-e-cola pra mostrar
// no próprio cartão do lote. Ninguém precisa de conta no Mercado Pago: paga pelo app de qualquer banco. A conta que
// recebe precisa ter uma chave Pix cadastrada no Mercado Pago (senão a API recusa: "Collector user without key").
export interface CobrancaPix { id: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; pagamentoId: string }
const PAGADOR_RESERVA = (uid: string) => `pagador-${uid.replace(/[^a-z0-9]/gi, "").toLowerCase()}@workend.online`;

async function criarPix(u: Usuario, base: string, o: { valor: number; descricao: string; tipo: "lote" | "layout" | "personagem" | "outdoor" | "barraca" | "item"; chave: string; meses: number; metadata: Record<string, unknown> }): Promise<CobrancaPix> {
  const pid = id("pag");
  const expira = new Date(Date.now() + 60 * 60 * 1000); // o QR vale 1 hora
  const expiraMP = expira.toISOString().replace("Z", "-00:00");
  const corpo = (email: string) => ({
    transaction_amount: o.valor, description: o.descricao, payment_method_id: "pix",
    payer: { email, first_name: u.nome.split(" ")[0] || "Cliente", last_name: u.nome.split(" ").slice(1).join(" ") || "WorkEnd" },
    external_reference: pid, statement_descriptor: "WORKEND", date_of_expiration: expiraMP, notification_url: `${base}/api/mercadopago/webhook`, metadata: { ...o.metadata, usuario: u.id, tipo: o.tipo },
  });
  let p: PagamentoMP;
  try { p = await mp<PagamentoMP>("/v1/payments", { method: "POST", headers: { "x-idempotency-key": pid }, body: JSON.stringify(corpo(u.email)) }); }
  catch (e) {
    const msg = (e as Error).message.toLowerCase();
    if (!/collector|payer|mesmo|same/.test(msg)) throw e;
    p = await mp<PagamentoMP>("/v1/payments", { method: "POST", headers: { "x-idempotency-key": pid + "b" }, body: JSON.stringify(corpo(PAGADOR_RESERVA(u.id))) });
  }
  const dados = p.point_of_interaction?.transaction_data;
  if (!dados?.qr_code) throw new Error("O Mercado Pago não devolveu o QR Code do Pix. Confira se a conta tem chave Pix cadastrada.");
  await sql`INSERT INTO pagamento (id, terreno_chave, usuario_id, pagamento_id, valor, meses, metodo, status, bruto, tipo) VALUES (${pid}, ${o.chave}, ${u.id}, ${String(p.id)}, ${o.valor}, ${o.meses}, 'pix', 'pendente', ${sql.json(p as unknown as Parameters<typeof sql.json>[0])}, ${o.tipo})`;
  return { id: pid, valor: o.valor, codigo: dados.qr_code, qrBase64: dados.qr_code_base64 ?? "", expiraEm: expira.toISOString(), pagamentoId: String(p.id) };
}

// Chão: 1º mês ou renovação; ou troca de prédio (R$ 9,90)
export async function criarCobranca(u: Usuario, chave: string, numeroLote: number, base: string, meses = 1, tipo: "lote" | "layout" = "lote"): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) throw new Error("Reserve o lote antes de pagar.");
  meses = Math.max(1, Math.min(12, meses | 0));
  const unit = precoPara(u); // admin paga R$ 0,99 (teste real sem gastar)
  const valor = tipo === "layout" ? PRECO_TROCA_LAYOUT : Math.round(unit * meses * 100) / 100;
  const r = await criarPix(u, base, { valor, tipo, chave, meses, metadata: { terreno: chave, meses }, descricao: tipo === "layout" ? `WorkEnd · troca de prédio · Lote ${numeroLote} (${t.empresaNome})` : `WorkEnd · Lote ${numeroLote} · ${meses} ${meses === 1 ? "mês" : "meses"} (${t.empresaNome})` });
  if (tipo === "lote") await estenderReserva(chave, 70); // ele está pagando: a reserva dura mais que o QR (60 min)
  return r;
}
// Personagem do visitante: R$ 5,90/mês (admin paga 1/100)
export async function criarCobrancaPersonagem(u: Usuario, base: string, meses = 1): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  meses = Math.max(1, Math.min(12, meses | 0));
  const unit = ehAdmin(u) ? Math.round(PRECO_PERSONAGEM * 100) / 10000 : PRECO_PERSONAGEM;
  const valor = Math.round(unit * meses * 100) / 100;
  return criarPix(u, base, { valor, tipo: "personagem", chave: "personagem", meses, metadata: { meses }, descricao: `WorkEnd · personagem · ${meses} ${meses === 1 ? "mês" : "meses"}` });
}

// Outdoor nas avenidas (12/11/2026): 30 dias; a vaga já foi reservada em src/server/outdoors.ts
export async function criarCobrancaOutdoor(u: Usuario, base: string, slot: string, valor: number, descricao: string): Promise<CobrancaPix> {
  return criarPix(u, base, { valor, tipo: "outdoor", chave: slot, meses: 1, metadata: { outdoor: slot }, descricao });
}
// Barraca da feira e roupas do personagem (12/11/2026): a reserva/o item já foi conferido em src/server/cidade.ts
export async function criarCobrancaGenerica(u: Usuario, base: string, o: { tipo: "barraca" | "item"; chave: string; valor: number; descricao: string; metadata: Record<string, unknown> }): Promise<CobrancaPix> {
  return criarPix(u, base, { ...o, meses: 1 });
}
interface PagamentoMP { id: number; status: string; status_detail?: string; external_reference?: string; payment_method_id?: string; payment_type_id?: string; transaction_amount?: number; date_approved?: string; metadata?: Record<string, unknown>; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } }

// Aplica um pagamento vindo da API do Mercado Pago (webhook ou conferência). A linha do pagamento fica travada na transação:
// o webhook e a conferência do mapa chegam juntos e só um deles pode liberar o benefício.
async function aplicar(p: PagamentoMP) {
  const ref = p.external_reference; if (!ref) return null;
  const statusMP = p.status === "approved" ? "aprovado" : p.status === "rejected" ? "rejeitado" : p.status === "refunded" || p.status === "charged_back" ? "estornado" : p.status === "cancelled" ? "cancelado" : "pendente";
  const feito = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    const [reg] = await db<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em, tipo FROM pagamento WHERE id = ${ref} FOR UPDATE`;
    if (!reg) return null;
    const aprovadoAntes = reg.status === "aprovado";
    // aprovado só muda para estornado, e estornado não muda mais
    const status = reg.status === "estornado" ? "estornado" : aprovadoAntes && statusMP !== "estornado" ? "aprovado" : statusMP;
    await db`UPDATE pagamento SET status = ${status}, pagamento_id = ${String(p.id)}, metodo = ${p.payment_method_id ?? p.payment_type_id ?? null}, pago_em = ${p.date_approved ? new Date(p.date_approved) : reg.pagoEm}, bruto = ${sql.json(p as unknown as Parameters<typeof sql.json>[0])} WHERE id = ${ref}`;
    let efeito: "liberou" | "sem_lote" | "estornou" | null = null;
    if (status === "aprovado" && !aprovadoAntes) {
      if (reg.tipo === "personagem") { await ativarPersonagem(reg.usuarioId, 30 * reg.meses, db); efeito = "liberou"; }
      else if (reg.tipo === "outdoor") efeito = (await ativarOutdoor(reg.terrenoChave, reg.usuarioId, reg.meses, db)) ? "liberou" : "sem_lote";
      else if (reg.tipo === "barraca") efeito = (await ativarBarraca(reg.terrenoChave, reg.usuarioId, db)) ? "liberou" : "sem_lote";
      else if (reg.tipo === "item") efeito = (await ativarItem(reg.terrenoChave, reg.usuarioId, db)) ? "liberou" : "sem_lote";
      else if (reg.tipo === "layout") efeito = (await creditarTrocaLayout(reg.terrenoChave, reg.usuarioId, db)) ? "liberou" : "sem_lote";
      else efeito = (await ativarTerreno(reg.terrenoChave, reg.meses, reg.usuarioId, db)) ? "liberou" : "sem_lote";
    } else if (status === "estornado" && aprovadoAntes) {
      if (reg.tipo === "personagem") await reverterPersonagem(reg.usuarioId, 30 * reg.meses, db);
      else if (reg.tipo === "outdoor") await reverterOutdoor(reg.terrenoChave, reg.usuarioId, reg.meses, db);
      else if (reg.tipo === "barraca") await reverterBarraca(reg.terrenoChave, reg.usuarioId, db);
      else if (reg.tipo === "item") await reverterItem(reg.terrenoChave, reg.usuarioId, db);
      else if (reg.tipo === "layout") await retirarCreditoLayout(reg.terrenoChave, reg.usuarioId, db);
      else await reverterTerreno(reg.terrenoChave, reg.meses, reg.usuarioId, db);
      efeito = "estornou";
    }
    return { reg, status, efeito };
  });
  if (!feito) return null;
  const { reg, status, efeito } = feito;
  const valor = brl(Number(reg.valor));
  // e-mails e registros só depois de gravar
  if (efeito === "sem_lote" && (reg.tipo === "barraca" || reg.tipo === "item")) void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem ${reg.tipo === "barraca" ? "a barraca" : "o item"}`, { usuarioId: reg.usuarioId, dados: { detalhes: `${reg.terrenoChave} não pôde ser liberado (reserva vencida ou item desconhecido). Devolva o valor. Pagamento ${reg.id}.` } });
  else if (efeito === "sem_lote" && reg.tipo === "outdoor") void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem o outdoor`, { usuarioId: reg.usuarioId, dados: { detalhes: `A vaga ${reg.terrenoChave} passou para outra empresa antes do pagamento chegar. Devolva o valor ou realoque. Pagamento ${reg.id}.` } });
  else if (efeito === "sem_lote") void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem lote`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `O lote não está mais com quem pagou. Devolva o valor ou realoque pelo painel. Pagamento ${reg.id}.` } });
  else if (efeito === "estornou") void registrar("pagamento", `Pagamento estornado (${valor})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `Os dias ou o crédito desse pagamento foram retirados. Pagamento ${reg.id}.` } });
  else if (efeito === "liberou" && reg.tipo === "personagem") void registrar("pagamento", `Personagem pago (${valor})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Personagem ativo por ${30 * reg.meses} dias.` } });
  else if (efeito === "liberou" && reg.tipo === "barraca") void registrar("pagamento", `Barraca da feira paga (${valor})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Barraca ${reg.terrenoChave}.` }, avisarDono: true });
  else if (efeito === "liberou" && reg.tipo === "item") void registrar("pagamento", `Item do personagem pago (${valor})`, { usuarioId: reg.usuarioId, dados: { detalhes: reg.terrenoChave } });
  else if (efeito === "liberou" && reg.tipo === "outdoor") void registrar("pagamento", `Outdoor pago (${valor})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Anúncio no outdoor ${reg.terrenoChave} por 30 dias.` }, avisarDono: true });
  else if (efeito === "liberou" && reg.tipo === "layout") void registrar("pagamento", `Troca de prédio paga (${valor})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: "Crédito de 1 troca de prédio liberado." }, avisarDono: true });
  else if (efeito === "liberou") {
    void registrar("pagamento", `Lote pago (${valor}, ${reg.meses} mês${reg.meses > 1 ? "es" : ""})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `Pagamento aprovado no Mercado Pago (${p.payment_method_id ?? "pix"}).` } });
    const [d] = await sql<{ email: string; nome: string; empresaNome: string | null; pagoAte: Date | null }[]>`SELECT u.email, u.nome, t.empresa_nome, t.pago_ate FROM usuario u LEFT JOIN terreno t ON t.chave = ${reg.terrenoChave} WHERE u.id = ${reg.usuarioId}`;
    if (d) void enviarEmail("pagamento", d.email, { nome: d.nome, empresa: d.empresaNome ?? "", lote: `Lote ${LOTE_POR_CHAVE[reg.terrenoChave]?.numero ?? "?"}`, valor, pago_ate: dataBR(d.pagoAte), link_mapa: `https://workend.online/mundo?lote=${encodeURIComponent(reg.terrenoChave)}`, link_painel: "https://workend.online/app" });
  }
  return { ...reg, status };
}

// Webhook: o Mercado Pago manda só o id; buscamos o pagamento na API (assim ninguém forja uma confirmação)
export async function tratarWebhook(tipo: string | null, idPagamento: string | null) {
  if (tipo !== "payment" || !idPagamento) return;
  const p = await mp<PagamentoMP>(`/v1/payments/${idPagamento}`);
  await aplicar(p);
}

// Quando o usuário volta do checkout (ou o admin pede): procura pagamentos daquela referência e aplica
export async function conferirPagamento(ref: string) {
  await migrar();
  let ultimo = null;
  const [reg0] = await sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE id = ${ref}`;
  if (reg0?.pagamentoId) {
    // Pix direto: já sabemos o id do pagamento no MP
    const p = await mp<PagamentoMP>(`/v1/payments/${reg0.pagamentoId}`);
    ultimo = await aplicar(p);
  } else {
    const r = await mp<{ results: PagamentoMP[] }>(`/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`);
    for (const p of r.results ?? []) { ultimo = (await aplicar(p)) ?? ultimo; if (p.status === "approved") break; }
  }
  if (!ultimo) { const [reg] = await sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE id = ${ref}`; ultimo = reg ?? null; }
  return ultimo;
}

export async function pagamentosDoUsuario(usuarioId: string) {
  await migrar();
  return sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT 20`;
}
export async function listarPagamentosAdmin() {
  await migrar();
  return sql<PagamentoAdmin[]>`SELECT p.id, p.terreno_chave, p.usuario_id, p.status, p.valor, p.meses, p.metodo, p.preferencia_id, p.pagamento_id, p.criado_em, p.pago_em, p.tipo, u.email, t.empresa_nome
    FROM pagamento p JOIN usuario u ON u.id = p.usuario_id LEFT JOIN terreno t ON t.chave = p.terreno_chave ORDER BY p.criado_em DESC LIMIT 200`;
}
