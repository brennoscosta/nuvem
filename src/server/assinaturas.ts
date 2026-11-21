// Pagamento automático do lote e do quiosque (WE-09, 21/11/2026): assinatura recorrente no Mercado Pago, escolhida pela
// pessoa no pagamento ("Pagar todo mês automaticamente" ou "Pagar só este mês (Pix)", o Pix avulso de sempre).
//  - Cartão de crédito: API de assinaturas sem plano (POST /preapproval com card_token_id e status "authorized"). O cartão
//    é digitado nos campos seguros do Mercado Pago (iframes do MercadoPago.js): o servidor do WorkEnd só recebe o token.
//  - Pix Automático: o Mercado Pago não documenta Pix Automático na API de assinaturas nem na de pagamentos automáticos
//    (conferido em 21/11/2026; as duas listam só cartão). A estrutura fica pronta atrás de MP_PIX_AUTOMATICO=1 (desligada):
//    cria a assinatura "pending" e manda a pessoa para o link do Mercado Pago (init_point). Confirmar antes de ligar.
// Preço: o MESMO do Pix (ofertas.ts › cotacaoLote): a 1ª cobrança do lote novo leva a oferta de entrada (fundador, feira
// ou indicação) e as seguintes são a mensalidade cheia (lote + lotes extras, ou quiosque). O Mercado Pago cobra um valor
// por assinatura: depois da 1ª cobrança aprovada, o valor é trocado para a mensalidade (PUT /preapproval). A cada 30 dias
// (frequência em dias, igual ao DIAS_MES do Pix, para o pago_ate nunca escorregar do calendário de cobrança).
// Cada cobrança aprovada vira uma linha em `pagamento` (id "pagr_…", assinatura_id) e passa por mercadopago.ts › aplicar,
// o mesmo caminho do Pix: PRODUTOS.lote/quiosque › ativarTerreno (+30 dias; o lote extra acompanha o principal).
// Webhook: caixa de entrada própria (assinatura_evento), gravada antes de responder; o mesmo id de evento não processa
// duas vezes e nada é creditado em dobro (a linha do pagamento é única por pagamento do Mercado Pago e aplicar() só libera
// na 1ª aprovação). O ciclo (agendarAssinaturas, a cada 30 min) refaz eventos que ficaram no meio, confere cobranças
// atrasadas, manda o lembrete de 3 dias antes, ajusta a mensalidade quando entra um lote extra e cancela no Mercado Pago a
// assinatura cujo lote saiu do mapa (carência de sempre: DIAS_TOLERANCIA depois do vencimento).
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, id, migrar, temBanco } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno, estenderReserva, ehAdmin, PRECO_LOTE, DIAS_TOLERANCIA } from "./terrenos";
import { cotacaoLote } from "./ofertas";
import { lotesExtrasAtivos } from "./terrenoExtra";
import { PRECO_LOTE_EXTRA, PRECO_QUIOSQUE } from "@/office/data/precosTerreno";
import { aplicar, pagamentoLigado, type PagamentoMP } from "./mercadopago";
import { avisar } from "./avisos";
import { registrar } from "./eventos";
import { brl, dataBR } from "./email";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { QUIOSQUE_POR_CHAVE, ehQuiosque } from "@/office/data/quiosques";
import { numeroDaLoja, rotuloLoja } from "@/office/data/numeroLoja";

declare global {
  var __workendAssinaturaTimer: ReturnType<typeof setInterval> | undefined;
  var __workendAssinaturaRodando: boolean | undefined;
}

// ---------- Mercado Pago (o mesmo MP_API_BASE dos testes; em produção fica vazio) ----------
const API = () => process.env.MP_API_BASE?.trim() || "https://api.mercadopago.com";
const token = () => { const t = process.env.MP_ACCESS_TOKEN?.trim(); if (!t) throw new Error("Pagamento ainda não está ligado (MP_ACCESS_TOKEN)."); return t; };
class ErroMP extends Error { constructor(public status: number, msg: string) { super(msg); } }
async function mp<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API() + caminho, { ...init, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroMP(r.status, `Mercado Pago ${r.status}: ${(j as { message?: string }).message ?? JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}
interface PreapprovalMP { id: string; status: string; external_reference?: string; init_point?: string; next_payment_date?: string; reason?: string; auto_recurring?: { transaction_amount?: number } }
interface CobrancaMP { id: number | string; preapproval_id: string; status?: string; transaction_amount?: number; retry_attempt?: number; debit_date?: string; payment?: { id?: number | string; status?: string; status_detail?: string } }

// ---------- chaves ----------
export const chavePublicaMP = () => process.env.MP_PUBLIC_KEY?.trim() || "";
// cartão: liga quando a conta tem o Access Token (já usado no Pix) e a chave pública (para os campos seguros do cartão)
export const cartaoLigado = () => pagamentoLigado() && !!chavePublicaMP();
// Pix Automático: estrutura pronta, DESLIGADA até o Mercado Pago documentar o Pix Automático na API (ver o topo)
export const pixAutomaticoLigado = () => pagamentoLigado() && process.env.MP_PIX_AUTOMATICO === "1";
export const sdkMP = () => process.env.MP_SDK_URL?.trim() || "https://sdk.mercadopago.com/js/v2";
export function configAssinatura() {
  return { cartao: cartaoLigado(), pixAutomatico: pixAutomaticoLigado(), chavePublica: cartaoLigado() ? chavePublicaMP() : "", sdk: sdkMP() };
}

export type MeioAssinatura = "cartao" | "pix_automatico";
export type EstadoAssinatura = "pendente" | "ativa" | "falhando" | "cancelada" | "encerrada" | "recusada";
const VIVAS = ["pendente", "ativa", "falhando"];
interface Assinatura {
  id: string; usuarioId: string; terrenoChave: string; tipo: "lote" | "quiosque"; meio: MeioAssinatura; estado: EstadoAssinatura; externoId: string | null;
  valor: string; primeiroValor: string; oferta: string | null; desconto: string; primeiroPagamento: string | null; primeira: boolean; inicio: "agora" | "vencimento";
  proximaCobranca: Date | null; tentativas: number; ultimaFalha: string | null; ultimaFalhaEm: Date | null; lembreteEm: Date | null; valorAjustadoEm: Date | null;
  criadoEm: Date; ativadaEm: Date | null; canceladaEm: Date | null; motivoFim: string | null; atualizadoEm: Date;
}
const centavos = (v: number) => Math.round(v * 100) / 100;
const idemValido = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x) ? x : null);
const tokenValido = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(x) ? x : null);
const ehDuplicado = (e: unknown) => (e as { code?: string } | null)?.code === "23505";
const PAGADOR_RESERVA = (uid: string) => `pagador-${uid.replace(/[^a-z0-9]/gi, "").toLowerCase()}@workend.online`;
const DIA = 86400_000;
const rotuloDe = (chave: string) => (ehQuiosque(chave) ? `Quiosque ${QUIOSQUE_POR_CHAVE[chave]?.numero ?? ""}`.trim() : rotuloLoja(numeroDaLoja({ chave })) || `Lote ${LOTE_POR_CHAVE[chave]?.numero ?? "?"}`);
const linkPainel = "/app#assinatura";

async function porId(aid: string) { const [a] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE id = ${aid}`; return a ?? null; }
async function viva(chave: string) { const [a] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE terreno_chave = ${chave} AND estado IN ('pendente', 'ativa', 'falhando')`; return a ?? null; }
async function primeiraPaga(aid: string) { const [r] = await sql`SELECT 1 FROM pagamento WHERE assinatura_id = ${aid} AND status = 'aprovado' LIMIT 1`; return !!r; }

// ---------- quanto custa (o mesmo do Pix) ----------
export interface CotacaoAssinatura { tipo: "lote" | "quiosque"; primeiro: number; mensal: number; oferta: { id: string; nome: string; desconto: number } | null; extras: number; inicio: "agora" | "vencimento"; primeiraCobranca: string; admin: boolean }
// mensalidade das renovações: lote + lotes extras ativos, ou quiosque; a conta admin paga 1/100 (como no Pix)
async function mensalidade(u: Pick<Usuario, "papel" | "email">, chave: string) {
  const mensal = ehQuiosque(chave) ? PRECO_QUIOSQUE : PRECO_LOTE + (await lotesExtrasAtivos(chave)) * PRECO_LOTE_EXTRA;
  return ehAdmin(u as Usuario) ? Math.max(0.01, Math.round(mensal) / 100) : centavos(mensal);
}
export async function cotacaoAssinatura(u: Usuario, chave: string): Promise<CotacaoAssinatura> {
  await migrar();
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) throw new Error("Reserve o lote antes de ligar o pagamento automático.");
  if (t.anexoDe) throw new Error(`O lote extra renova junto com o ${rotuloDe(t.anexoDe)}: ligue o pagamento automático no lote principal.`);
  const cot = await cotacaoLote(u, chave, 1);
  const mensal = await mensalidade(u, chave);
  const ativo = t.status === "ativo";
  // lote já ativo: a 1ª cobrança automática cai no vencimento (sem cobrar duas vezes o mesmo mês); vencido, cobra agora
  const vence = t.pagoAte ? new Date(t.pagoAte).getTime() : 0;
  const noVencimento = ativo && vence > Date.now() + 3600_000;
  return { tipo: ehQuiosque(chave) ? "quiosque" : "lote", primeiro: ativo ? mensal : cot.valor, mensal, oferta: !ativo && cot.oferta ? { id: cot.oferta.id, nome: cot.oferta.nome, desconto: cot.oferta.desconto } : null,
    extras: cot.extras ?? 0, inicio: noVencimento ? "vencimento" : "agora", primeiraCobranca: new Date(noVencimento ? vence : Date.now()).toISOString(), admin: ehAdmin(u) };
}

// ---------- o que a tela mostra ----------
export interface ResumoAssinatura { id: string; estado: EstadoAssinatura; meio: MeioAssinatura; valor: number; primeiroValor: number; proximaCobranca: string | null; tentativas: number; ultimaFalhaEm: string | null; primeiraPaga: boolean; dentroDos7Dias: boolean; inicio: "agora" | "vencimento"; criadoEm: string; canceladaEm: string | null; motivoFim: string | null }
async function resumo(a: Assinatura): Promise<ResumoAssinatura> {
  return { id: a.id, estado: a.estado, meio: a.meio, valor: Number(a.valor), primeiroValor: Number(a.primeiroValor), proximaCobranca: a.proximaCobranca ? new Date(a.proximaCobranca).toISOString() : null, tentativas: a.tentativas,
    ultimaFalhaEm: a.ultimaFalhaEm ? new Date(a.ultimaFalhaEm).toISOString() : null, primeiraPaga: await primeiraPaga(a.id), dentroDos7Dias: a.primeira && Date.now() - new Date(a.criadoEm).getTime() < 7 * DIA, inicio: a.inicio,
    criadoEm: new Date(a.criadoEm).toISOString(), canceladaEm: a.canceladaEm ? new Date(a.canceladaEm).toISOString() : null, motivoFim: a.motivoFim };
}
export async function minhaAssinatura(u: Usuario, chave: string) {
  await migrar();
  const config = configAssinatura();
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) return { config, assinatura: null, cotacao: null };
  const [a] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE terreno_chave = ${chave} AND usuario_id = ${u.id} ORDER BY (estado IN ('pendente', 'ativa', 'falhando')) DESC, criado_em DESC LIMIT 1`;
  const cotacao = (config.cartao || config.pixAutomatico) && !t.anexoDe ? await cotacaoAssinatura(u, chave).catch(() => null) : null;
  return { config, assinatura: a ? await resumo(a) : null, cotacao };
}

// ---------- contratar ----------
export async function contratar(u: Usuario, chave: string, b: { meio?: unknown; token?: unknown; idem?: unknown }, base: string): Promise<ResumoAssinatura & { linkPagamento?: string }> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const meio: MeioAssinatura = b.meio === "pix_automatico" ? "pix_automatico" : "cartao";
  if (meio === "cartao" && !cartaoLigado()) throw new Error("O pagamento automático no cartão ainda não está ligado.");
  if (meio === "pix_automatico" && !pixAutomaticoLigado()) throw new Error("O Pix Automático ainda não está disponível.");
  const cartao = meio === "cartao" ? tokenValido(b.token) : null;
  if (meio === "cartao" && !cartao) throw new Error("Confira os dados do cartão e tente de novo.");
  const idem = idemValido(b.idem);
  if (idem) { const [ja] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE usuario_id = ${u.id} AND idem = ${idem}`; if (ja) return resumo(ja); }
  const cot = await cotacaoAssinatura(u, chave);
  const atual = await viva(chave);
  if (atual) { if (atual.usuarioId === u.id) throw new Error("O pagamento automático já está ligado neste lote."); throw new Error("Lote indisponível."); }
  const [{ ja }] = await sql<{ ja: boolean }[]>`SELECT EXISTS (SELECT 1 FROM assinatura WHERE usuario_id = ${u.id}) AS ja`;
  const t = (await obterTerreno(chave))!;
  const aid = id("ass");
  // 1ª cobrança agora (lote reservado ou vencido): a linha do pagamento já fica reservada, com a oferta, como um Pix aberto
  // (a vaga de fundador conta enquanto a cobrança não chega: vagasFundador olha pagamento pendente da última hora)
  const pid = cot.inicio === "agora" ? id("pagr") : null;
  try {
    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      await db`INSERT INTO assinatura (id, usuario_id, terreno_chave, tipo, meio, estado, valor, primeiro_valor, oferta, desconto, primeiro_pagamento, primeira, inicio, proxima_cobranca, idem)
        VALUES (${aid}, ${u.id}, ${chave}, ${cot.tipo}, ${meio}, 'pendente', ${cot.mensal}, ${cot.primeiro}, ${cot.oferta?.id ?? null}, ${cot.oferta?.desconto ?? 0}, ${pid}, ${!ja}, ${cot.inicio}, ${new Date(cot.primeiraCobranca)}, ${idem})`;
      if (pid) await db`INSERT INTO pagamento (id, terreno_chave, usuario_id, valor, meses, metodo, status, tipo, oferta, desconto, assinatura_id)
        VALUES (${pid}, ${chave}, ${u.id}, ${cot.primeiro}, 1, ${meio}, 'pendente', ${cot.tipo}, ${cot.oferta?.id ?? null}, ${cot.oferta?.desconto ?? 0}, ${aid})`;
    });
  } catch (e) {
    if (ehDuplicado(e)) { if (idem) { const [ja2] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE usuario_id = ${u.id} AND idem = ${idem}`; if (ja2) return resumo(ja2); } throw new Error("O pagamento automático já está ligado neste lote."); }
    throw e;
  }
  const corpo = (email: string) => ({
    reason: `WorkEnd · ${rotuloDe(chave)} (${t.empresaNome})`.slice(0, 250), external_reference: aid, payer_email: email, back_url: `${base}/app`,
    auto_recurring: { frequency: 30, frequency_type: "days", transaction_amount: cot.primeiro, currency_id: "BRL", ...(cot.inicio === "vencimento" ? { start_date: cot.primeiraCobranca } : {}) },
    ...(meio === "cartao" ? { card_token_id: cartao, status: "authorized" } : { status: "pending" }),
  });
  let pre: PreapprovalMP;
  try {
    try { pre = await mp<PreapprovalMP>("/preapproval", { method: "POST", headers: { "x-idempotency-key": aid }, body: JSON.stringify(corpo(u.email)) }); }
    catch (e) {
      // a conta que recebe não pode ser a mesma que paga (o dono testando): usa um e-mail de pagador só do WorkEnd
      if (!/collector|payer|mesmo|same/i.test((e as Error).message)) throw e;
      pre = await mp<PreapprovalMP>("/preapproval", { method: "POST", headers: { "x-idempotency-key": aid + "b" }, body: JSON.stringify(corpo(PAGADOR_RESERVA(u.id))) });
    }
  } catch (e) {
    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      await db`UPDATE assinatura SET estado = 'recusada', motivo_fim = ${(e as Error).message.slice(0, 300)}, atualizado_em = now() WHERE id = ${aid}`;
      if (pid) await db`UPDATE pagamento SET status = 'cancelado' WHERE id = ${pid} AND status = 'pendente'`;
    }).catch((x) => console.error("[assinatura] desfazer:", (x as Error).message));
    console.error("[assinatura] contratar:", (e as Error).message);
    throw new Error("O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão. Se preferir, pague este mês no Pix.");
  }
  const estado: EstadoAssinatura = pre.status === "authorized" ? "ativa" : "pendente";
  await sql`UPDATE assinatura SET externo_id = ${String(pre.id)}, estado = ${estado}, ativada_em = ${estado === "ativa" ? new Date() : null},
    proxima_cobranca = COALESCE(${pre.next_payment_date ? new Date(pre.next_payment_date) : null}::timestamptz, proxima_cobranca), bruto = ${sql.json(pre as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE id = ${aid}`;
  // a 1ª cobrança no cartão chega em até 1 hora: a reserva do lote não pode cair antes
  if (pid && t.status === "reservado") await estenderReserva(chave, 120);
  void registrar("pagamento", `Pagamento automático ligado (${meio === "cartao" ? "cartão" : "Pix Automático"}, ${brl(cot.mensal)} a cada 30 dias)`, { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `${rotuloDe(chave)}. 1ª cobrança: ${brl(cot.primeiro)}${cot.oferta ? ` (${cot.oferta.nome})` : ""}, ${cot.inicio === "agora" ? "agora" : `no vencimento (${dataBR(cot.primeiraCobranca)})`}. Assinatura ${aid}.` } });
  const r = await resumo((await porId(aid))!);
  return pre.init_point && meio === "pix_automatico" ? { ...r, linkPagamento: pre.init_point } : r;
}

// ---------- cancelar no Mercado Pago ----------
// a documentação fala em "canceled" e a API responde "cancelled": tenta um e, se recusar, o outro
async function cancelarNoMP(externoId: string) {
  for (const status of ["cancelled", "canceled"]) {
    try { await mp(`/preapproval/${encodeURIComponent(externoId)}`, { method: "PUT", body: JSON.stringify({ status }) }); return; }
    catch (e) {
      if (e instanceof ErroMP && e.status === 404) return;
      const pre = await mp<PreapprovalMP>(`/preapproval/${encodeURIComponent(externoId)}`).catch(() => null);
      if (pre && /cancel/.test(pre.status)) return;
      if (status === "canceled") throw e;
    }
  }
}

// Cancelar pelo painel: cancela no Mercado Pago e o lote continua até o fim do período pago. Nos 7 primeiros dias da
// PRIMEIRA contratação da conta, registra o pedido de devolução do que foi cobrado (o admin devolve à mão; nada é
// estornado sozinho).
export async function cancelar(u: Usuario, chave: string): Promise<ResumoAssinatura & { devolucao: number | null }> {
  await migrar();
  const a = await viva(chave);
  if (!a || a.usuarioId !== u.id) throw new Error("Não há pagamento automático ligado neste lote.");
  if (a.externoId) await cancelarNoMP(a.externoId);
  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`UPDATE assinatura SET estado = 'cancelada', cancelada_em = now(), motivo_fim = 'cancelada pela pessoa no painel', atualizado_em = now() WHERE id = ${a.id}`;
    if (a.primeiroPagamento) await db`UPDATE pagamento SET status = 'cancelado' WHERE id = ${a.primeiroPagamento} AND status = 'pendente'`;
  });
  let devolucao: number | null = null;
  if (a.primeira && Date.now() - new Date(a.criadoEm).getTime() < 7 * DIA) {
    const pags = await sql<{ id: string; valor: string }[]>`SELECT id, valor FROM pagamento WHERE assinatura_id = ${a.id} AND status = 'aprovado' ORDER BY criado_em`;
    const total = centavos(pags.reduce((s, p) => s + Number(p.valor), 0));
    if (total > 0) {
      await sql`INSERT INTO devolucao_pedido (id, usuario_id, assinatura_id, valor, pagamentos, motivo) VALUES (${id("dev")}, ${u.id}, ${a.id}, ${total}, ${pags.map((p) => p.id)}, 'cancelou nos 7 dias da primeira contratação') ON CONFLICT (assinatura_id) DO NOTHING`;
      devolucao = total;
      void registrar("pagamento", `ATENÇÃO: pedido de devolução de ${brl(total)} (cancelou nos 7 dias)`, { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `A pessoa cancelou o pagamento automático nos 7 dias da primeira contratação. Devolva no Mercado Pago (pagamentos ${pags.map((p) => p.id).join(", ")}) e marque como devolvido na lista de assinaturas do admin. Assinatura ${a.id}.` } });
    }
  }
  const t = await obterTerreno(chave);
  void avisar(u.id, { tipo: "pagamento", ref: `assinatura-cancelada:${a.id}`, titulo: "Pagamento automático cancelado", link: linkPainel,
    texto: devolucao ? `Registramos o pedido de devolução de ${brl(devolucao)}. A equipe do WorkEnd responde por aqui.` : `Nada mais será cobrado no cartão. O ${rotuloDe(chave)} continua seu até ${dataBR(t?.pagoAte)}; depois, renove pelo Pix.` });
  void registrar("pagamento", "Pagamento automático cancelado pelo painel", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `Assinatura ${a.id}. O acesso segue até o fim do período pago.` } });
  return { ...(await resumo((await porId(a.id))!)), devolucao };
}

// Excluir minha conta (src/server/exclusao.ts, junção v98): cancela na hora, no Mercado Pago, as assinaturas da conta que
// ainda valem, pelo mesmo cancelarNoMP do painel, sem esperar o ciclo de 30 min. Sem aviso nem pedido de devolução: a conta
// está sendo apagada (a tela da exclusão já diz que os dias pagos se perdem). Se o Mercado Pago falhar, o erro sobe e a
// exclusão não acontece: senão o cartão continuaria sendo cobrado de uma conta que não existe mais.
export async function cancelarAssinaturasDaConta(uid: string): Promise<number> {
  await migrar();
  const vivas = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE usuario_id = ${uid} AND estado IN ('pendente', 'ativa', 'falhando')`;
  for (const a of vivas) {
    if (a.externoId) await cancelarNoMP(a.externoId);
    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      await db`UPDATE assinatura SET estado = 'cancelada', cancelada_em = now(), motivo_fim = 'conta excluída a pedido do titular', atualizado_em = now() WHERE id = ${a.id}`;
      if (a.primeiroPagamento) await db`UPDATE pagamento SET status = 'cancelado' WHERE id = ${a.primeiroPagamento} AND status = 'pendente'`;
    });
  }
  return vivas.length;
}

// Trocar o cartão (também é o "atualizar o cartão" do aviso de falha): o Mercado Pago usa o novo nas próximas tentativas
export async function trocarCartao(u: Usuario, chave: string, tok: unknown) {
  await migrar();
  const a = await viva(chave);
  if (!a || a.usuarioId !== u.id || !a.externoId) throw new Error("Não há pagamento automático ligado neste lote.");
  const cartao = tokenValido(tok); if (!cartao) throw new Error("Confira os dados do cartão e tente de novo.");
  try { await mp(`/preapproval/${encodeURIComponent(a.externoId)}`, { method: "PUT", body: JSON.stringify({ card_token_id: cartao }) }); }
  catch (e) { console.error("[assinatura] trocar cartão:", (e as Error).message); throw new Error("O Mercado Pago não aceitou este cartão. Confira os dados ou use outro."); }
  await sql`UPDATE assinatura SET atualizado_em = now() WHERE id = ${a.id}`;
  void registrar("pagamento", "Cartão do pagamento automático trocado", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `Assinatura ${a.id}${a.estado === "falhando" ? ": estava com a cobrança falhando; o Mercado Pago tenta de novo com o cartão novo." : "."}` } });
  return resumo((await porId(a.id))!);
}

// ---------- cobranças ----------
// Acha (ou cria) a linha de `pagamento` deste pagamento do Mercado Pago. Trava por pagamento: dois avisos chegando juntos
// não criam duas linhas (e o índice único pagamento_assinatura_mp_idx segura de novo).
async function linhaDoPagamento(a: Assinatura, p: PagamentoMP): Promise<string | null> {
  const mpId = String(p.id);
  return sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`SELECT pg_advisory_xact_lock(hashtext(${"pagr:" + mpId}))`;
    const [ja] = await db<{ id: string }[]>`SELECT id FROM pagamento WHERE pagamento_id = ${mpId} AND assinatura_id IS NOT NULL LIMIT 1`;
    if (ja) return ja.id;
    if (p.status !== "approved") return null; // recusada não vira linha de pagamento (fica em assinatura_cobranca)
    if (a.primeiroPagamento) {
      const [r] = await db<{ id: string }[]>`UPDATE pagamento SET pagamento_id = ${mpId} WHERE id = ${a.primeiroPagamento} AND pagamento_id IS NULL AND status = 'pendente' RETURNING id`;
      if (r) return r.id;
    }
    const nid = `pagr_${mpId.replace(/[^A-Za-z0-9]/g, "")}`;
    await db`INSERT INTO pagamento (id, terreno_chave, usuario_id, pagamento_id, valor, meses, metodo, status, tipo, assinatura_id)
      VALUES (${nid}, ${a.terrenoChave}, ${a.usuarioId}, ${mpId}, ${centavos(Number(p.transaction_amount ?? a.valor))}, 1, ${a.meio}, 'pendente', ${a.tipo}, ${a.id}) ON CONFLICT (id) DO NOTHING`;
    return nid;
  });
}

// Pagamento de uma cobrança da assinatura (vindo do aviso da cobrança, do aviso "payment" ou da conferência)
async function aplicarPagamento(a: Assinatura, p: PagamentoMP, cob: CobrancaMP | null) {
  const ref = await linhaDoPagamento(a, p);
  if (ref) {
    await aplicar({ ...p, external_reference: ref });
    if (cob) await sql`UPDATE assinatura_cobranca SET pagamento_ref = ${ref}, atualizado_em = now() WHERE externo_id = ${String(cob.id)}`;
  }
  if (p.status === "approved") {
    const [x] = await sql`UPDATE assinatura SET estado = 'ativa', tentativas = 0, ultima_falha = NULL, ativada_em = COALESCE(ativada_em, now()), atualizado_em = now()
      WHERE id = ${a.id} AND estado IN ('pendente', 'ativa', 'falhando') RETURNING id`;
    if (x && a.estado === 'falhando') void avisar(a.usuarioId, { tipo: "pagamento", ref: `assinatura-recuperou:${a.id}:${p.id}`, titulo: "Cobrança do cartão aprovada", texto: `O pagamento automático voltou a funcionar. O ${rotuloDe(a.terrenoChave)} está em dia.`, link: linkPainel });
    await ajustarMensalidade((await porId(a.id))!).catch((e) => console.error("[assinatura] mensalidade:", (e as Error).message));
    await sincronizar(a).catch(() => null);
  } else if ((p.status === "rejected" || p.status === "cancelled") && cob) {
    // recusa só pela cobrança (authorized_payment, que traz a tentativa); o aviso "payment" da mesma recusa não conta de novo
    await registrarFalha(a, p, cob);
  }
}

// Depois da 1ª cobrança (com a oferta de entrada) e quando entra ou sai um lote extra: a mensalidade no Mercado Pago
// passa a ser a de sempre (lote + extras, ou quiosque)
async function ajustarMensalidade(a: Assinatura) {
  if (!a.externoId || !VIVAS.includes(a.estado)) return;
  if (a.inicio === "agora" && !(await primeiraPaga(a.id))) return; // a 1ª cobrança ainda não veio: não mexe no valor dela
  const [u] = await sql<{ papel: Usuario["papel"]; email: string }[]>`SELECT papel, email FROM usuario WHERE id = ${a.usuarioId}`;
  if (!u) return;
  const mensal = await mensalidade(u, a.terrenoChave);
  const noMP = a.valorAjustadoEm ? Number(a.valor) : Number(a.primeiroValor);
  if (Math.abs(mensal - noMP) < 0.005) { if (!a.valorAjustadoEm || Number(a.valor) !== mensal) await sql`UPDATE assinatura SET valor = ${mensal}, valor_ajustado_em = COALESCE(valor_ajustado_em, now()) WHERE id = ${a.id}`; return; }
  await mp(`/preapproval/${encodeURIComponent(a.externoId)}`, { method: "PUT", body: JSON.stringify({ auto_recurring: { transaction_amount: mensal, currency_id: "BRL" } }) });
  await sql`UPDATE assinatura SET valor = ${mensal}, valor_ajustado_em = now(), atualizado_em = now() WHERE id = ${a.id}`;
  if (noMP !== Number(a.primeiroValor) || Number(a.valor) !== mensal) void registrar("pagamento", `Mensalidade do pagamento automático: ${brl(mensal)}`, { usuarioId: a.usuarioId, terrenoChave: a.terrenoChave, dados: { detalhes: `Assinatura ${a.id}: de ${brl(noMP)} para ${brl(mensal)} (lote extra ou fim da oferta de entrada).` } });
}

async function registrarFalha(a: Assinatura, p: PagamentoMP, cob: CobrancaMP | null) {
  const tentativa = Math.max(1, Number(cob?.retry_attempt ?? 0) || a.tentativas + 1);
  const t = await obterTerreno(a.terrenoChave);
  // 1ª cobrança de um lote ainda reservado: sem pagamento o lote não é garantido; desliga a assinatura e oferece o Pix
  if (a.inicio === "agora" && t?.status === "reservado" && !(await primeiraPaga(a.id))) {
    if (a.externoId) await cancelarNoMP(a.externoId).catch((e) => console.error("[assinatura] cancelar recusada:", (e as Error).message));
    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      await db`UPDATE assinatura SET estado = 'recusada', ultima_falha = ${p.status_detail ?? p.status}, ultima_falha_em = now(), motivo_fim = '1ª cobrança recusada', atualizado_em = now() WHERE id = ${a.id} AND estado IN ('pendente', 'ativa', 'falhando')`;
      if (a.primeiroPagamento) await db`UPDATE pagamento SET status = 'rejeitado' WHERE id = ${a.primeiroPagamento} AND status = 'pendente'`;
    });
    void avisar(a.usuarioId, { tipo: "pagamento", ref: `assinatura-recusada:${a.id}`, titulo: "O cartão foi recusado", texto: "A 1ª cobrança não passou. Tente outro cartão ou pague o 1º mês no Pix enquanto a reserva vale.", link: `/mundo?lote=${encodeURIComponent(a.terrenoChave)}` });
    return;
  }
  const [mudou] = await sql`UPDATE assinatura SET estado = 'falhando', tentativas = ${tentativa}, ultima_falha = ${p.status_detail ?? p.status}, ultima_falha_em = now(), atualizado_em = now()
    WHERE id = ${a.id} AND estado IN ('ativa', 'falhando') RETURNING id`;
  if (!mudou) return;
  const limite = t?.pagoAte ? new Date(new Date(t.pagoAte).getTime() + DIAS_TOLERANCIA * DIA) : null;
  const texto = `Tentativa ${tentativa}. O Mercado Pago tenta de novo nos próximos dias. Atualize o cartão ou pague este mês no Pix${limite ? ` até ${dataBR(limite)}` : ""} para manter o ${rotuloDe(a.terrenoChave)}.`;
  void avisar(a.usuarioId, { tipo: "pagamento", ref: `assinatura-falha:${a.id}:${cob?.id ?? p.id}:${tentativa}`, titulo: "A cobrança do cartão não passou", texto, link: linkPainel });
  // e-mail (quando ligado) pelo modelo "Atividade na sua loja"
  void registrar("pagamento", `Cobrança do cartão recusada (tentativa ${tentativa})`, { usuarioId: a.usuarioId, terrenoChave: a.terrenoChave, avisarDono: true, dados: { detalhes: `${texto} Para atualizar o cartão, abra Meu escritório › Pagamento automático.` } });
}

// aviso de uma cobrança (authorized_payment)
async function aplicarCobranca(cob: CobrancaMP) {
  const [a] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE externo_id = ${String(cob.preapproval_id)}`;
  if (!a) return null;
  await sql`INSERT INTO assinatura_cobranca (externo_id, assinatura_id, status, pagamento_status, detalhe, tentativa, valor)
    VALUES (${String(cob.id)}, ${a.id}, ${cob.status ?? null}, ${cob.payment?.status ?? null}, ${cob.payment?.status_detail ?? null}, ${Number(cob.retry_attempt ?? 0)}, ${cob.transaction_amount ?? null})
    ON CONFLICT (externo_id) DO UPDATE SET status = EXCLUDED.status, pagamento_status = EXCLUDED.pagamento_status, detalhe = EXCLUDED.detalhe, tentativa = EXCLUDED.tentativa, valor = EXCLUDED.valor, atualizado_em = now()`;
  if (cob.payment?.id) {
    // nunca confiamos no resumo: o pagamento é lido na API com o nosso token
    const p = await mp<PagamentoMP>(`/v1/payments/${encodeURIComponent(String(cob.payment.id))}`);
    await aplicarPagamento(a, p, cob);
  }
  return a.id;
}

// aviso "payment" de uma cobrança da assinatura (mercadopago.ts › tratarWebhook, quando não há pagamento nosso com a
// referência): estorno de uma cobrança já gravada ou cobrança nova pelo id da assinatura
export async function pagamentoDeAssinatura(p: PagamentoMP) {
  await migrar();
  const [ja] = await sql<{ assinaturaId: string }[]>`SELECT assinatura_id FROM pagamento WHERE pagamento_id = ${String(p.id)} AND assinatura_id IS NOT NULL LIMIT 1`;
  const ti = (p.point_of_interaction as { transaction_data?: { subscription_id?: string } } | undefined)?.transaction_data;
  const pre = (p.metadata?.preapproval_id as string | undefined) ?? ti?.subscription_id ?? null;
  const [a] = ja ? await sql<Assinatura[]>`SELECT * FROM assinatura WHERE id = ${ja.assinaturaId}`
    : await sql<Assinatura[]>`SELECT * FROM assinatura WHERE (externo_id IS NOT NULL AND externo_id = ${pre}) OR id = ${p.external_reference ?? ""} LIMIT 1`;
  if (a) await aplicarPagamento(a, p, null);
}

// estado da assinatura no Mercado Pago (aviso subscription_preapproval e conferência)
async function sincronizar(a0: Assinatura, pre0?: PreapprovalMP) {
  if (!a0.externoId) return;
  const pre = pre0 ?? (await mp<PreapprovalMP>(`/preapproval/${encodeURIComponent(a0.externoId)}`));
  const a = (await porId(a0.id))!;
  const prox = pre.next_payment_date ? new Date(pre.next_payment_date) : null;
  if (/cancel/.test(pre.status) && VIVAS.includes(a.estado)) {
    // o Mercado Pago cancela sozinho depois de cobranças recusadas seguidas
    await sql`UPDATE assinatura SET estado = 'cancelada', cancelada_em = now(), motivo_fim = 'cancelada no Mercado Pago', atualizado_em = now() WHERE id = ${a.id}`;
    const t = await obterTerreno(a.terrenoChave);
    void avisar(a.usuarioId, { tipo: "pagamento", ref: `assinatura-cancelada:${a.id}`, titulo: "Pagamento automático desligado", link: linkPainel,
      texto: `O Mercado Pago desligou o pagamento automático${a.estado === "falhando" ? " depois das cobranças recusadas" : ""}. Renove pelo Pix${t?.pagoAte ? ` até ${dataBR(new Date(new Date(t.pagoAte).getTime() + DIAS_TOLERANCIA * DIA))}` : ""} para manter o ${rotuloDe(a.terrenoChave)}.` });
  } else if (pre.status === "authorized" && a.estado === "pendente") {
    await sql`UPDATE assinatura SET estado = 'ativa', ativada_em = COALESCE(ativada_em, now()), atualizado_em = now() WHERE id = ${a.id} AND estado = 'pendente'`;
  }
  if (prox) await sql`UPDATE assinatura SET proxima_cobranca = ${prox} WHERE id = ${a.id}`;
}

// ---------- webhook: caixa de entrada ----------
// Assinatura x-signature do Mercado Pago (só quando MP_WEBHOOK_SEGREDO está configurado): HMAC SHA-256 de
// "id:<data.id da URL>;request-id:<x-request-id>;ts:<ts>;". Sem o segredo, vale a regra de sempre: nada do corpo é
// aceito sem ler de novo na API com o nosso token.
function assinaturaValida(cab: string | null, requestId: string | null, dataId: string | null) {
  const segredo = process.env.MP_WEBHOOK_SEGREDO?.trim(); if (!segredo) return true;
  if (!cab) return false;
  const partes = Object.fromEntries(cab.split(",").map((x) => x.trim().split("=", 2) as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `${dataId ? `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${partes.ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  try { return timingSafeEqual(Buffer.from(esperado), Buffer.from(String(partes.v1))); } catch { return false; }
}
const TOPICOS: Record<string, string> = { subscription_preapproval: "subscription_preapproval", preapproval: "subscription_preapproval", subscription_authorized_payment: "subscription_authorized_payment", authorized_payment: "subscription_authorized_payment", subscription_preapproval_plan: "subscription_preapproval_plan" };
export const ehTopicoAssinatura = (t: string) => !!TOPICOS[t];

export async function receberAvisoAssinatura(o: { topico: string; recursoId: string | null; eventoId: unknown; assinatura: string | null; requestId: string | null; dataIdUrl: string | null }): Promise<{ ok: boolean; status: number }> {
  const topico = TOPICOS[o.topico]; const recurso = o.recursoId?.trim();
  if (!topico || !recurso) return { ok: true, status: 200 };
  if (!assinaturaValida(o.assinatura, o.requestId, o.dataIdUrl ?? recurso)) return { ok: false, status: 401 };
  // sem id de evento (formato antigo, só na URL), cada chegada é um evento; o processamento é idempotente de qualquer jeito
  const eid = o.eventoId != null && String(o.eventoId).trim() ? `mp:${String(o.eventoId).trim()}` : `${topico}:${recurso}:${o.requestId ?? id("chegada")}`;
  try {
    await migrar();
    const [novo] = await sql`INSERT INTO assinatura_evento (evento_id, topico, recurso_id) VALUES (${eid}, ${topico}, ${recurso}) ON CONFLICT (evento_id) DO NOTHING RETURNING evento_id`;
    if (!novo) { const [e] = await sql<{ processadoEm: Date | null }[]>`SELECT processado_em FROM assinatura_evento WHERE evento_id = ${eid}`; if (e?.processadoEm) return { ok: true, status: 200 }; }
  } catch (e) { console.error("[assinatura] caixa de entrada:", (e as Error).message); return { ok: false, status: 503 }; } // não gravou: o Mercado Pago reenvia
  await processarEvento(eid, topico, recurso);
  return { ok: true, status: 200 }; // gravado: se o processamento falhou, o ciclo refaz (não depende do reenvio)
}

async function processarEvento(eid: string, topico: string, recurso: string) {
  try {
    if (topico === "subscription_authorized_payment") await aplicarCobranca(await mp<CobrancaMP>(`/authorized_payments/${encodeURIComponent(recurso)}`));
    else if (topico === "subscription_preapproval") {
      const pre = await mp<PreapprovalMP>(`/preapproval/${encodeURIComponent(recurso)}`);
      const [a] = await sql<Assinatura[]>`SELECT * FROM assinatura WHERE externo_id = ${String(pre.id)} OR id = ${pre.external_reference ?? ""} LIMIT 1`;
      if (a) { if (!a.externoId) await sql`UPDATE assinatura SET externo_id = ${String(pre.id)} WHERE id = ${a.id}`; await sincronizar({ ...a, externoId: String(pre.id) }, pre); }
    }
    await sql`UPDATE assinatura_evento SET processado_em = now(), tentativas = tentativas + 1, erro = NULL WHERE evento_id = ${eid}`;
  } catch (e) {
    console.error("[assinatura] evento", eid, (e as Error).message);
    await sql`UPDATE assinatura_evento SET tentativas = tentativas + 1, erro = ${(e as Error).message.slice(0, 300)} WHERE evento_id = ${eid}`.catch(() => null);
  }
}

// ---------- ciclo (a cada 30 min) ----------
async function encerrar(a: Assinatura, motivo: string, aviso: { titulo: string; texto: string } | null) {
  if (a.externoId) await cancelarNoMP(a.externoId);
  const [r] = await sql`UPDATE assinatura SET estado = 'encerrada', cancelada_em = now(), motivo_fim = ${motivo}, atualizado_em = now() WHERE id = ${a.id} AND estado IN ('pendente', 'ativa', 'falhando') RETURNING id`;
  if (a.primeiroPagamento) await sql`UPDATE pagamento SET status = 'cancelado' WHERE id = ${a.primeiroPagamento} AND status = 'pendente'`;
  if (r && aviso) void avisar(a.usuarioId, { tipo: "pagamento", ref: `assinatura-encerrada:${a.id}`, titulo: aviso.titulo, texto: aviso.texto, link: linkPainel });
  if (r) void registrar("pagamento", `Pagamento automático encerrado: ${motivo}`, { usuarioId: a.usuarioId, terrenoChave: a.terrenoChave, dados: { detalhes: `Assinatura ${a.id} cancelada no Mercado Pago.` } });
}

export async function cicloAssinaturas() {
  if (!temBanco() || globalThis.__workendAssinaturaRodando) return;
  globalThis.__workendAssinaturaRodando = true;
  const passo = async (nome: string, f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.error(`[assinatura] ciclo ${nome}:`, (e as Error).message); } };
  try {
    await migrar();
    // 1) avisos que ficaram gravados sem terminar (queda no meio, Mercado Pago fora do ar)
    await passo("eventos", async () => {
      const pend = await sql<{ eventoId: string; topico: string; recursoId: string }[]>`SELECT evento_id, topico, recurso_id FROM assinatura_evento WHERE processado_em IS NULL AND tentativas < 10 AND recebido_em < now() - interval '1 minute' ORDER BY recebido_em LIMIT 20`;
      for (const e of pend) await processarEvento(e.eventoId, e.topico, e.recursoId);
    });
    if (!pagamentoLigado()) return;
    const vivas = await sql<(Assinatura & { tStatus: string | null; pagoAte: Date | null; donoAinda: boolean; empresaNome: string | null })[]>`SELECT a.*, t.status AS t_status, t.pago_ate, (t.usuario_id = a.usuario_id AND EXISTS (SELECT 1 FROM usuario u WHERE u.id = a.usuario_id)) AS dono_ainda, t.empresa_nome
      FROM assinatura a LEFT JOIN terreno t ON t.chave = a.terreno_chave WHERE a.estado IN ('pendente', 'ativa', 'falhando') ORDER BY a.criado_em`;
    for (const a of vivas) {
      // 2) carência: o lote saiu do mapa (vencido + tolerância), mudou de dono ou a conta foi excluída → cancela no Mercado Pago
      const vencido = a.pagoAte && new Date(a.pagoAte).getTime() + DIAS_TOLERANCIA * DIA < Date.now();
      if (!a.tStatus || !a.donoAinda || (a.tStatus === "ativo" && vencido)) {
        await passo("carencia", () => encerrar(a, !a.tStatus ? "o lote saiu do mapa" : !a.donoAinda ? "o lote mudou de dono ou a conta foi excluída" : "venceu a carência sem pagamento", a.donoAinda ? { titulo: "Pagamento automático encerrado", texto: `O ${rotuloDe(a.terrenoChave)} saiu do mapa e o pagamento automático foi cancelado. Nada mais será cobrado.` } : null));
        continue;
      }
      // 3) Pix pago enquanto o cartão falhava: desliga o automático para o Mercado Pago não cobrar o mesmo mês de novo
      if (a.estado === "falhando" && a.ultimaFalhaEm) {
        const [pix] = await sql`SELECT 1 FROM pagamento WHERE terreno_chave = ${a.terrenoChave} AND usuario_id = ${a.usuarioId} AND status = 'aprovado' AND assinatura_id IS NULL AND tipo IN ('lote', 'quiosque') AND pago_em > ${a.ultimaFalhaEm} LIMIT 1`;
        if (pix) { await passo("pix", () => encerrar(a, "pago no Pix depois da falha do cartão", { titulo: "Recebemos o Pix", texto: "Para não cobrar duas vezes, o pagamento automático com o cartão que falhou foi desligado. Ligue de novo com outro cartão quando quiser." })); continue; }
      }
      // 4) conferência: cobrança que já devia ter chegado (aviso perdido) ou cartão falhando, no máximo a cada 2 horas; a 1ª
      //    cobrança de um lote reservado é conferida a cada 5 min depois de 10 min (a reserva vale 2 horas)
      const primeiraEsperando = a.inicio === "agora" && a.tStatus === "reservado" && Date.now() - new Date(a.criadoEm).getTime() > 10 * 60_000;
      const atrasada = a.externoId && a.estado !== "pendente" && (primeiraEsperando || (a.proximaCobranca && new Date(a.proximaCobranca).getTime() < Date.now() - 3 * 3600_000) || a.estado === "falhando") && Date.now() - new Date(a.atualizadoEm).getTime() > (primeiraEsperando ? 5 * 60_000 : 2 * 3600_000);
      if (atrasada) await passo("conferencia", async () => {
        await sql`UPDATE assinatura SET atualizado_em = now() WHERE id = ${a.id}`;
        await sincronizar(a);
        const r = await mp<{ results?: CobrancaMP[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(a.externoId!)}&limit=5`);
        for (const c of r.results ?? []) await aplicarCobranca(c);
      });
      // 5) lote extra entrou ou saiu: a mensalidade no Mercado Pago acompanha
      if (a.tipo === "lote") await passo("mensalidade", async () => ajustarMensalidade((await porId(a.id))!));
    }
    // 6) lembrete 3 dias antes (uma vez por cobrança), no sino, no celular e por e-mail quando ligado
    await passo("lembrete", async () => {
      const lista = await sql<{ id: string; usuarioId: string; valor: string; meio: string; terrenoChave: string; quando: Date }[]>`UPDATE assinatura a SET lembrete_em = now() FROM terreno t
        WHERE t.chave = a.terreno_chave AND t.usuario_id = a.usuario_id AND a.estado = 'ativa' AND t.status = 'ativo' AND a.externo_id IS NOT NULL
          AND COALESCE(a.proxima_cobranca, t.pago_ate) BETWEEN now() AND now() + interval '3 days'
          AND (a.lembrete_em IS NULL OR a.lembrete_em < COALESCE(a.proxima_cobranca, t.pago_ate) - interval '4 days')
        RETURNING a.id, a.usuario_id, a.valor, a.meio, a.terreno_chave, COALESCE(a.proxima_cobranca, t.pago_ate) AS quando`;
      for (const l of lista) {
        const texto = `No dia ${dataBR(l.quando)} o ${l.meio === "cartao" ? "cartão" : "Pix Automático"} será cobrado em ${brl(Number(l.valor))} pelo ${rotuloDe(l.terrenoChave)}. Para trocar o cartão ou cancelar, abra Meu escritório.`;
        void avisar(l.usuarioId, { tipo: "pagamento", ref: `assinatura-lembrete:${l.id}:${new Date(l.quando).toISOString().slice(0, 10)}`, titulo: "Cobrança automática em 3 dias", texto, link: linkPainel });
        void registrar("pagamento", "Lembrete: cobrança automática em 3 dias", { usuarioId: l.usuarioId, terrenoChave: l.terrenoChave, avisarDono: true, dados: { detalhes: texto } });
      }
    });
  } finally { globalThis.__workendAssinaturaRodando = false; }
}

// Chamado uma vez quando o servidor liga (src/instrumentation.ts)
export function agendarAssinaturas() {
  if (globalThis.__workendAssinaturaTimer || !temBanco() || process.env.NEXT_PHASE === "phase-production-build") return;
  const tick = () => { void cicloAssinaturas().catch((x) => console.error("[assinatura]", (x as Error).message)); };
  globalThis.__workendAssinaturaTimer = setInterval(tick, Number(process.env.ASSINATURA_CICLO_MS) || 30 * 60_000);
  setTimeout(tick, Number(process.env.ASSINATURA_PRIMEIRO_CICLO_MS) || 2 * 60_000);
  console.log("[assinatura] ciclo ligado");
}

// ---------- admin ----------
export async function listarAssinaturasAdmin() {
  await migrar();
  const assinaturas = await sql`SELECT a.id, a.estado, a.meio, a.tipo, a.terreno_chave, a.valor, a.primeiro_valor, a.oferta, a.proxima_cobranca, a.tentativas, a.ultima_falha, a.ultima_falha_em, a.criado_em, a.cancelada_em, a.motivo_fim, a.externo_id, a.primeira,
      u.email, t.empresa_nome, t.pago_ate,
      (SELECT count(*)::int FROM pagamento p WHERE p.assinatura_id = a.id AND p.status = 'aprovado') AS cobradas,
      (SELECT COALESCE(sum(p.valor), 0)::float FROM pagamento p WHERE p.assinatura_id = a.id AND p.status = 'aprovado') AS recebido,
      (SELECT COALESCE(sum(CASE WHEN c.pagamento_status = 'approved' THEN c.tentativa - 1 ELSE c.tentativa END), 0)::int FROM assinatura_cobranca c WHERE c.assinatura_id = a.id AND c.pagamento_status IS NOT NULL) AS falhas
    FROM assinatura a LEFT JOIN usuario u ON u.id = a.usuario_id LEFT JOIN terreno t ON t.chave = a.terreno_chave ORDER BY a.criado_em DESC LIMIT 200`;
  const devolucoes = await sql`SELECT d.id, d.assinatura_id, d.valor, d.pagamentos, d.motivo, d.estado, d.criado_em, d.resolvido_em, d.resolvido_por, u.email, a.terreno_chave
    FROM devolucao_pedido d LEFT JOIN usuario u ON u.id = d.usuario_id LEFT JOIN assinatura a ON a.id = d.assinatura_id ORDER BY d.criado_em DESC LIMIT 100`;
  const [eventos] = await sql<{ pendentes: number; comErro: number }[]>`SELECT count(*) FILTER (WHERE processado_em IS NULL)::int AS pendentes, count(*) FILTER (WHERE processado_em IS NULL AND erro IS NOT NULL)::int AS com_erro FROM assinatura_evento`;
  return { config: configAssinatura(), assinaturas, devolucoes, eventos };
}
export async function resolverDevolucao(admin: Usuario, did: string) {
  await migrar();
  const [r] = await sql`UPDATE devolucao_pedido SET estado = 'resolvido', resolvido_em = now(), resolvido_por = ${admin.email} WHERE id = ${did} AND estado = 'aberto' RETURNING id, usuario_id, valor`;
  if (!r) throw new Error("Pedido não encontrado ou já resolvido.");
  return { ok: true };
}
