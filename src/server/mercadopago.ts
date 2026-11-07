// Pagamento do chão no Mercado Pago (Checkout Pro): criamos uma preferência de R$ 99 x meses, o comprador paga na
// página do Mercado Pago (Pix, cartão ou boleto) e volta pro mapa. A confirmação vem pelo webhook e também quando
// ele volta (conferimos na API). Só o Access Token é necessário (MP_ACCESS_TOKEN no CapRover).
import { sql, id, migrar } from "./db";
import { precoPara, ativarTerreno, estenderReserva, obterTerreno } from "./terrenos";
import type { Usuario } from "./usuarios";
import { enviarEmail, brl, dataBR } from "./email";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

const API = "https://api.mercadopago.com";
export const pagamentoLigado = () => !!process.env.MP_ACCESS_TOKEN;
const token = () => { const t = process.env.MP_ACCESS_TOKEN?.trim(); if (!t) throw new Error("Pagamento ainda não está ligado (MP_ACCESS_TOKEN)."); return t; };

export interface Pagamento { id: string; terrenoChave: string; usuarioId: string; status: string; valor: string; meses: number; metodo: string | null; preferenciaId: string | null; pagamentoId: string | null; criadoEm: Date; pagoEm: Date | null }
export interface PagamentoAdmin extends Pagamento { email: string; empresaNome: string | null }

async function mp<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + caminho, { ...init, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${(j as { message?: string }).message ?? JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}

// Cria a cobrança e devolve o link do checkout. `base` = https://workend.online (de onde o usuário veio)
export async function criarCobranca(u: Usuario, chave: string, numeroLote: number, base: string, meses = 1) {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) throw new Error("Reserve o lote antes de pagar.");
  meses = Math.max(1, Math.min(12, meses | 0));
  const pid = id("pag");
  const unit = precoPara(u); // admin paga R$ 0,99 (teste real sem gastar)
  const valor = Math.round(unit * meses * 100) / 100;
  const volta = (r: string) => `${base}/mundo?lote=${encodeURIComponent(chave)}&pagamento=${r}&ref=${pid}`;
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": pid },
    body: JSON.stringify({
      items: [{ id: chave, title: `WorkEnd · Lote ${numeroLote} · ${meses} ${meses === 1 ? "mês" : "meses"}`, description: `Chão de 20 x 20 m no mundo WorkEnd (${t.empresaNome})`, category_id: "services", quantity: 1, currency_id: "BRL", unit_price: valor }],
      payer: { email: u.email, name: u.nome },
      external_reference: pid,
      statement_descriptor: "WORKEND",
      back_urls: { success: volta("ok"), pending: volta("pendente"), failure: volta("falhou") },
      auto_return: "approved",
      notification_url: `${base}/api/mercadopago/webhook`,
      metadata: { terreno: chave, usuario: u.id, meses },
    }),
  });
  await sql`INSERT INTO pagamento (id, terreno_chave, usuario_id, preferencia_id, valor, meses) VALUES (${pid}, ${chave}, ${u.id}, ${pref.id}, ${valor}, ${meses})`;
  await estenderReserva(chave, 30); // ele está pagando: a reserva não some embaixo dele
  return { id: pid, url: pref.init_point, valor };
}

interface PagamentoMP { id: number; status: string; status_detail?: string; external_reference?: string; payment_method_id?: string; payment_type_id?: string; transaction_amount?: number; date_approved?: string; metadata?: Record<string, unknown> }

// Aplica um pagamento vindo da API do Mercado Pago (webhook ou conferência): grava e, se aprovado, ativa o chão
async function aplicar(p: PagamentoMP) {
  const ref = p.external_reference; if (!ref) return null;
  const [reg] = await sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE id = ${ref}`;
  if (!reg) return null;
  const status = p.status === "approved" ? "aprovado" : p.status === "rejected" ? "rejeitado" : p.status === "refunded" || p.status === "charged_back" ? "estornado" : p.status === "cancelled" ? "cancelado" : "pendente";
  const jaAprovado = reg.status === "aprovado";
  await sql`UPDATE pagamento SET status = ${status}, pagamento_id = ${String(p.id)}, metodo = ${p.payment_method_id ?? p.payment_type_id ?? null}, pago_em = ${p.date_approved ? new Date(p.date_approved) : reg.pagoEm}, bruto = ${sql.json(p as unknown as Parameters<typeof sql.json>[0])} WHERE id = ${ref}`;
  if (status === "aprovado" && !jaAprovado) {
    await ativarTerreno(reg.terrenoChave, reg.meses);
    const [d] = await sql<{ email: string; nome: string; empresaNome: string | null; pagoAte: Date | null }[]>`SELECT u.email, u.nome, t.empresa_nome, t.pago_ate FROM usuario u LEFT JOIN terreno t ON t.chave = ${reg.terrenoChave} WHERE u.id = ${reg.usuarioId}`;
    if (d) void enviarEmail("pagamento", d.email, { nome: d.nome, empresa: d.empresaNome ?? "", lote: `Lote ${LOTE_POR_CHAVE[reg.terrenoChave]?.numero ?? "?"}`, valor: brl(Number(reg.valor)), pago_ate: dataBR(d.pagoAte), link_mapa: `https://workend.online/mundo?lote=${encodeURIComponent(reg.terrenoChave)}`, link_painel: "https://workend.online/app" });
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
  const r = await mp<{ results: PagamentoMP[] }>(`/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`);
  let ultimo = null;
  for (const p of r.results ?? []) { ultimo = (await aplicar(p)) ?? ultimo; if (p.status === "approved") break; }
  if (!ultimo) { const [reg] = await sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE id = ${ref}`; ultimo = reg ?? null; }
  return ultimo;
}

export async function pagamentosDoUsuario(usuarioId: string) {
  await migrar();
  return sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT 20`;
}
export async function listarPagamentosAdmin() {
  await migrar();
  return sql<PagamentoAdmin[]>`SELECT p.id, p.terreno_chave, p.usuario_id, p.status, p.valor, p.meses, p.metodo, p.preferencia_id, p.pagamento_id, p.criado_em, p.pago_em, u.email, t.empresa_nome
    FROM pagamento p JOIN usuario u ON u.id = p.usuario_id LEFT JOIN terreno t ON t.chave = p.terreno_chave ORDER BY p.criado_em DESC LIMIT 200`;
}
