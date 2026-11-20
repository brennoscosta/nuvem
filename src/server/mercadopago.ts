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
import { cotacaoLote, liberarIndicacao, estornarIndicacao } from "./ofertas";
import { avisar } from "./avisos";
import { saldoDe, debitar, debitarAte, devolverUso, usoEmAberto, creditarPacote, creditarPixSemProduto, retirarCreditosDoPagamento, ErroSaldo, fmtCreditos } from "./creditos";
import { creditarUnidades, retirarUnidades, PACOTE_UNIDADES_POR_ID } from "./unidadesIA";
import { liberarAgente, reverterAgente, liberarPersonalidade } from "./agentesVenda";
import { empresaIdDe } from "./equipeCliente";
// lote extra e quiosque (20/11/2026, frente terreno): cotação e efeito em terrenoExtra.ts; aqui só a cobrança
import { cotacaoLoteExtra, liberarLoteExtra, devolverLoteExtra } from "./terrenoExtra";
import { QUIOSQUE_POR_CHAVE, ehQuiosque } from "@/office/data/quiosques";
import { numeroDaLoja, rotuloLoja } from "@/office/data/numeroLoja";
import type { Terreno } from "./terrenos";
// telão, destaque e patrocínio da Praça de Eventos (20/11/2026, frente praca)
import { ativarAnuncioPraca, reverterAnuncioPraca } from "./praca";

// MP_API_BASE só nos testes (Mercado Pago falso); em produção fica vazio
const API = process.env.MP_API_BASE?.trim() || "https://api.mercadopago.com";
export const pagamentoLigado = () => !!process.env.MP_ACCESS_TOKEN;
const token = () => { const t = process.env.MP_ACCESS_TOKEN?.trim(); if (!t) throw new Error("Pagamento ainda não está ligado (MP_ACCESS_TOKEN)."); return t; };

export interface Pagamento { id: string; terrenoChave: string; usuarioId: string; status: string; valor: string; meses: number; metodo: string | null; preferenciaId: string | null; pagamentoId: string | null; criadoEm: Date; pagoEm: Date | null; tipo?: string; creditosCarteira?: string; devolvidoEm?: Date | null }
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
// ================= cobrança única (20/11/2026, frente "creditos") =================
// Tudo o que o WorkEnd vende passa por cobrar() (= criarPix):
//  - opc.creditos e saldo suficiente: paga tudo com créditos; débito, pagamento e produto na MESMA transação; volta
//    status "aprovado" sem QR Code;
//  - saldo curto: usa o que tem (os créditos ficam reservados) e gera o Pix só do resto; se o Pix não for pago, a
//    reserva volta para a carteira (aplicar e liberarReservasVencidas);
//  - sem créditos: o Pix de sempre.
// opc.idem (gerado no clique) faz o mesmo clique repetido devolver a mesma cobrança. O que cada tipo libera fica no mapa
// PRODUTOS, mais abaixo: produto novo = uma linha lá + chamar cobrar() com o tipo dele.
export type TipoPagamento = "lote" | "layout" | "personagem" | "outdoor" | "barraca" | "item" | "creditos" | "agente" | "ia" | "personalidade" | "expansao" | "quiosque" | "praca" | `modelo:${string}`;
export interface CobrancaPix { id: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; pagamentoId: string; status?: "pendente" | "aprovado"; creditos?: number }
export interface OpcoesCobranca { creditos?: boolean; idem?: unknown }
export interface ProdutoCobranca { valor: number; descricao: string; tipo: TipoPagamento; chave: string; meses: number; metadata: Record<string, unknown> }
const PAGADOR_RESERVA = (uid: string) => `pagador-${uid.replace(/[^a-z0-9]/gi, "").toLowerCase()}@workend.online`;
const centavos = (v: number) => Math.round(v * 100) / 100;
const idemValido = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x) ? x : null);
const ehDuplicado = (e: unknown) => (e as { code?: string } | null)?.code === "23505";
const rotuloDe = (descricao: string) => descricao.replace(/^WorkEnd · /, "");
// opções que vêm do corpo de qualquer rota de pagamento ({ creditos, idem })
export const opcoesDoCorpo = (b: { creditos?: unknown; idem?: unknown } | null | undefined): OpcoesCobranca => ({ creditos: b?.creditos === true, idem: b?.idem });

async function cobrancaExistente(uid: string, idem: string): Promise<CobrancaPix | null> {
  const [p] = await sql<{ id: string; status: string; valor: string; creditosCarteira: string; pagamentoId: string | null; qr: string | null; qrB64: string | null; criadoEm: Date }[]>`SELECT id, status, valor, creditos_carteira, pagamento_id,
    bruto->'point_of_interaction'->'transaction_data'->>'qr_code' AS qr, bruto->'point_of_interaction'->'transaction_data'->>'qr_code_base64' AS qr_b64, criado_em FROM pagamento WHERE usuario_id = ${uid} AND idem = ${idem}`;
  if (!p) return null;
  if (p.status !== "aprovado" && p.status !== "pendente") throw new Error("Essa tentativa de pagamento não valeu. Clique de novo para gerar outra.");
  return { id: p.id, valor: Number(p.valor), codigo: p.qr ?? "", qrBase64: p.qrB64 ?? "", expiraEm: new Date(new Date(p.criadoEm).getTime() + 3600e3).toISOString(), pagamentoId: p.pagamentoId ?? "", status: p.status === "aprovado" ? "aprovado" : "pendente", creditos: Number(p.creditosCarteira) };
}

// Paga tudo com créditos: débito, pagamento aprovado e produto liberado na mesma transação (ou nada acontece)
async function pagarComCreditos(u: Usuario, o: ProdutoCobranca, idem: string | null): Promise<CobrancaPix> {
  const pid = id("pag");
  let reg: RegPagamento;
  try {
    reg = await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      const [r] = await db<RegPagamento[]>`INSERT INTO pagamento (id, terreno_chave, usuario_id, valor, meses, metodo, status, tipo, creditos_carteira, idem, pago_em)
        VALUES (${pid}, ${o.chave}, ${u.id}, 0, ${o.meses}, 'creditos', 'aprovado', ${o.tipo}, ${o.valor}, ${idem}, now()) RETURNING ${CAMPOS_REG()}`;
      await debitar(db, u.id, o.valor, rotuloDe(o.descricao), pid, `uso:${pid}`);
      if (!(await produtoDe(r.tipo).liberar(r, db))) throw new Error("Não deu para liberar agora (a reserva, a vaga ou o lote mudou). Nenhum crédito foi gasto.");
      return r;
    });
  } catch (e) { if (idem && ehDuplicado(e)) { const ja = await cobrancaExistente(u.id, idem); if (ja) return ja; } throw e; }
  await posPagamento(reg, "liberou", "créditos");
  return { id: pid, valor: 0, codigo: "", qrBase64: "", expiraEm: new Date().toISOString(), pagamentoId: "", status: "aprovado", creditos: o.valor };
}

async function criarPix(u: Usuario, base: string, o0: ProdutoCobranca, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const o = { ...o0, valor: centavos(o0.valor) };
  if (!(o.valor > 0)) throw new Error("Valor inválido.");
  const idem = idemValido(opc.idem);
  if (idem) { const ja = await cobrancaExistente(u.id, idem); if (ja) return ja; }
  // o pacote de créditos não se paga com créditos
  const saldo = opc.creditos && o.tipo !== "creditos" ? (await saldoDe(u.id)).total : 0;
  const usar = centavos(Math.min(saldo, o.valor));
  if (usar > 0 && usar >= o.valor) return pagarComCreditos(u, o, idem);
  const pid = id("pag");
  const valorPix = centavos(o.valor - usar);
  if (usar > 0) {
    try {
      await sql.begin(async (tx) => {
        const db = tx as unknown as typeof sql;
        await db`INSERT INTO pagamento (id, terreno_chave, usuario_id, valor, meses, metodo, status, tipo, creditos_carteira, idem) VALUES (${pid}, ${o.chave}, ${u.id}, ${valorPix}, ${o.meses}, 'pix+creditos', 'pendente', ${o.tipo}, ${usar}, ${idem})`;
        await debitar(db, u.id, usar, `Reservado para o Pix: ${rotuloDe(o.descricao)}`, pid, `uso:${pid}`);
      });
    } catch (e) { if (idem && ehDuplicado(e)) { const ja = await cobrancaExistente(u.id, idem); if (ja) return ja; } throw e; }
  }
  const expira = new Date(Date.now() + 60 * 60 * 1000); // o QR vale 1 hora
  const expiraMP = expira.toISOString().replace("Z", "-00:00");
  const descricao = (usar > 0 ? `${o.descricao} · ${fmtCreditos(usar)} em créditos` : o.descricao).slice(0, 250);
  const corpo = (email: string) => ({
    transaction_amount: valorPix, description: descricao, payment_method_id: "pix",
    payer: { email, first_name: u.nome.split(" ")[0] || "Cliente", last_name: u.nome.split(" ").slice(1).join(" ") || "WorkEnd" },
    external_reference: pid, statement_descriptor: "WORKEND", date_of_expiration: expiraMP, notification_url: `${base}/api/mercadopago/webhook`, metadata: { ...o.metadata, usuario: u.id, tipo: o.tipo, creditos: usar },
  });
  let p: PagamentoMP;
  try {
    try { p = await mp<PagamentoMP>("/v1/payments", { method: "POST", headers: { "x-idempotency-key": pid }, body: JSON.stringify(corpo(u.email)) }); }
    catch (e) {
      const msg = (e as Error).message.toLowerCase();
      if (!/collector|payer|mesmo|same/.test(msg)) throw e;
      p = await mp<PagamentoMP>("/v1/payments", { method: "POST", headers: { "x-idempotency-key": pid + "b" }, body: JSON.stringify(corpo(PAGADOR_RESERVA(u.id))) });
    }
    if (!p.point_of_interaction?.transaction_data?.qr_code) throw new Error("O Mercado Pago não devolveu o QR Code do Pix. Confira se a conta tem chave Pix cadastrada.");
  } catch (e) {
    // o Pix não saiu: a reserva de créditos volta na hora
    if (usar > 0) await sql.begin(async (tx) => { const db = tx as unknown as typeof sql; await db`UPDATE pagamento SET status = 'cancelado' WHERE id = ${pid}`; await devolverUso(db, u.id, pid, "Reserva devolvida: o Pix não pôde ser gerado"); }).catch((x) => console.error("[cobranca] devolver reserva:", (x as Error).message));
    throw e;
  }
  const dados = p.point_of_interaction!.transaction_data!;
  const bruto = sql.json(p as unknown as Parameters<typeof sql.json>[0]);
  if (usar > 0) await sql`UPDATE pagamento SET pagamento_id = ${String(p.id)}, bruto = ${bruto} WHERE id = ${pid}`;
  else {
    try { await sql`INSERT INTO pagamento (id, terreno_chave, usuario_id, pagamento_id, valor, meses, metodo, status, bruto, tipo, idem) VALUES (${pid}, ${o.chave}, ${u.id}, ${String(p.id)}, ${valorPix}, ${o.meses}, 'pix', 'pendente', ${bruto}, ${o.tipo}, ${idem})`; }
    catch (e) { if (idem && ehDuplicado(e)) { const ja = await cobrancaExistente(u.id, idem); if (ja) return ja; } throw e; }
  }
  return { id: pid, valor: valorPix, codigo: dados.qr_code ?? "", qrBase64: dados.qr_code_base64 ?? "", expiraEm: expira.toISOString(), pagamentoId: String(p.id), status: "pendente", creditos: usar };
}
// A função única para os produtos novos das outras frentes (modelos de prédio, expansão, quiosque, telão da praça...)
export const cobrar = criarPix;

// Chão: 1º mês ou renovação; ou troca de prédio (R$ 9,90)
export async function criarCobranca(u: Usuario, chave: string, numeroLote: number, base: string, meses = 1, tipo: "lote" | "layout" = "lote", opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) throw new Error("Reserve o lote antes de pagar.");
  meses = Math.max(1, Math.min(12, meses | 0));
  // lote extra (expandir o terreno) e quiosque têm cobrança própria (20/11/2026, frente terreno), pelo mesmo caminho único
  if (tipo === "lote" && t.anexoDe) {
    if (t.status === "ativo") throw new Error(`O lote extra renova junto com o ${rotuloLoja(numeroDaLoja({ chave: t.anexoDe }))}: renove pelo lote principal.`);
    return criarCobrancaLoteExtra(u, t, numeroLote, base, opc);
  }
  if (tipo === "lote" && ehQuiosque(chave)) return criarCobrancaQuiosque(u, t, base, meses, opc);
  // lote: oferta de entrada (fundador, feira, indicação) e crédito de indicação entram aqui (src/server/ofertas.ts);
  // a conta admin paga 1/100 do valor final (teste real sem gastar)
  const cot = tipo === "lote" ? await cotacaoLote(u, chave, meses) : null;
  const valor = tipo === "layout" ? PRECO_TROCA_LAYOUT : cot ? cot.valor : Math.round(precoPara(u) * meses * 100) / 100;
  const extra = cot?.oferta ? ` · ${cot.oferta.nome}` : cot?.creditoUsado ? " · desconto de indicação" : "";
  const r = await criarPix(u, base, { valor, tipo, chave, meses, metadata: { terreno: chave, meses, oferta: cot?.oferta?.id ?? null }, descricao: tipo === "layout" ? `WorkEnd · troca de prédio · Lote ${numeroLote} (${t.empresaNome})` : `WorkEnd · Lote ${numeroLote} · ${meses} ${meses === 1 ? "mês" : "meses"} (${t.empresaNome})${extra}` }, opc);
  if (cot) await sql`UPDATE pagamento SET oferta = ${cot.oferta?.id ?? null}, desconto = ${cot.oferta?.desconto ?? 0}, credito_usado = ${cot.creditoUsado} WHERE id = ${r.id}`;
  if (tipo === "lote") await estenderReserva(chave, 70); // ele está pagando: a reserva dura mais que o QR (60 min)
  return r;
}
// Lote extra (expandir o terreno, 20/11/2026): só os dias até o vencimento do lote principal (terrenoExtra.ts)
export async function criarCobrancaLoteExtra(u: Usuario, anexo: Terreno, numeroLote: number, base: string, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  const cot = await cotacaoLoteExtra(u, anexo);
  const principal = rotuloLoja(numeroDaLoja({ chave: cot.loteExtra.principal }));
  const r = await criarPix(u, base, { valor: cot.valor, tipo: "expansao", chave: anexo.chave, meses: 1, metadata: { terreno: anexo.chave, principal: cot.loteExtra.principal, dias: cot.loteExtra.dias },
    descricao: `WorkEnd · lote extra · Lote ${numeroLote} junto ao ${principal} · ${cot.loteExtra.dias} dia${cot.loteExtra.dias === 1 ? "" : "s"} (${anexo.empresaNome})` }, opc);
  if (r.status !== "aprovado") await estenderReserva(anexo.chave, 70);
  return r;
}
// Quiosque (20/11/2026): mensalidade própria (PRECO_QUIOSQUE), com o crédito de indicação; ativa como um lote
export async function criarCobrancaQuiosque(u: Usuario, t: Terreno, base: string, meses = 1, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  const k = QUIOSQUE_POR_CHAVE[t.chave]; if (!k) throw new Error("Quiosque inválido.");
  const cot = await cotacaoLote(u, t.chave, meses);
  const r = await criarPix(u, base, { valor: cot.valor, tipo: "quiosque", chave: t.chave, meses, metadata: { terreno: t.chave, meses, quiosque: k.numero },
    descricao: `WorkEnd · Quiosque ${k.numero} · ${meses} ${meses === 1 ? "mês" : "meses"} (${t.empresaNome})${cot.creditoUsado ? " · desconto de indicação" : ""}` }, opc);
  await sql`UPDATE pagamento SET oferta = NULL, desconto = 0, credito_usado = ${cot.creditoUsado} WHERE id = ${r.id}`;
  if (t.status === "reservado" && r.status !== "aprovado") await estenderReserva(t.chave, 70);
  return r;
}
// Modelo de prédio do catálogo (20/11/2026, frente predios): a conferência e o preço ficam em src/server/modelos.ts › cobrarModelo;
// o tipo do pagamento é "modelo:<id>" (sem coluna nova) e o produto é PRODUTOS.modelo
export async function criarCobrancaModelo(u: Usuario, chave: string, numeroLote: number, base: string, valor: number, idModelo: string, nomeModelo: string, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  const t = await obterTerreno(chave);
  return criarPix(u, base, { valor, tipo: `modelo:${idModelo}`, chave, meses: 1, metadata: { terreno: chave, modelo: idModelo }, descricao: `WorkEnd · prédio ${nomeModelo} · Lote ${numeroLote} (${t?.empresaNome ?? ""})` }, opc);
}
// Personagem do visitante: R$ 5,90/mês (admin paga 1/100)
export async function criarCobrancaPersonagem(u: Usuario, base: string, meses = 1, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  meses = Math.max(1, Math.min(12, meses | 0));
  const unit = ehAdmin(u) ? Math.round(PRECO_PERSONAGEM * 100) / 10000 : PRECO_PERSONAGEM;
  const valor = Math.round(unit * meses * 100) / 100;
  return criarPix(u, base, { valor, tipo: "personagem", chave: "personagem", meses, metadata: { meses }, descricao: `WorkEnd · personagem · ${meses} ${meses === 1 ? "mês" : "meses"}` }, opc);
}

// Outdoor nas avenidas (12/11/2026): 30 dias; a vaga já foi reservada em src/server/outdoors.ts
export async function criarCobrancaOutdoor(u: Usuario, base: string, slot: string, valor: number, descricao: string, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  return criarPix(u, base, { valor, tipo: "outdoor", chave: slot, meses: 1, metadata: { outdoor: slot }, descricao }, opc);
}
// Barraca da feira e roupas do personagem (12/11/2026): a reserva/o item já foi conferido em src/server/cidade.ts
export async function criarCobrancaGenerica(u: Usuario, base: string, o: { tipo: TipoPagamento; chave: string; valor: number; descricao: string; metadata: Record<string, unknown> }, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  return criarPix(u, base, { ...o, meses: 1 }, opc);
}
interface PagamentoMP { id: number; status: string; status_detail?: string; external_reference?: string; payment_method_id?: string; payment_type_id?: string; transaction_amount?: number; date_approved?: string; metadata?: Record<string, unknown>; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } }

// Registro do pagamento lido dentro da transação (o que cada produto recebe para liberar ou reverter)
export interface RegPagamento extends Pagamento { tipo: string; creditosCarteira: string; creditoUsado: string }
const CAMPOS_REG = () => sql`id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em, tipo, creditos_carteira, credito_usado`;
type Db = typeof sql;

// ================= o que cada tipo de pagamento libera (e tira no estorno) =================
// Produto novo de outra frente: uma linha aqui. liberar devolve false quando não dá para entregar; com viraCredito (ou
// quando o pagamento usou créditos) o valor do Pix entra como crédito comprado na carteira em vez do aviso de devolução.
export interface Produto { nome: string; pago: string; liberar: (r: RegPagamento, db: Db) => Promise<boolean>; reverter: (r: RegPagamento, db: Db) => Promise<void>; link?: (r: RegPagamento) => string; viraCredito?: boolean }
async function unidadesDoPagamento(r: RegPagamento, db: Db) {
  const [, lote, pacote] = r.terrenoChave.split(":");
  const p = PACOTE_UNIDADES_POR_ID[pacote ?? ""]; if (!p || !lote) return null;
  const [t] = await db<{ usuarioId: string; socios: string[] | null; status: string; papel: Usuario["papel"]; email: string }[]>`SELECT t.usuario_id, t.socios, t.status, u.papel, u.email FROM terreno t JOIN usuario u ON u.id = t.usuario_id WHERE t.chave = ${lote}`;
  if (!t || t.status !== "ativo" || (t.usuarioId !== r.usuarioId && !(t.socios ?? []).includes(r.usuarioId))) return null;
  return { empId: empresaIdDe(t.usuarioId, lote, ehAdmin({ papel: t.papel, email: t.email } as Usuario)), unidades: p.unidades };
}
const linkLote = (r: RegPagamento) => `/mundo?lote=${encodeURIComponent(r.terrenoChave)}`;
export const PRODUTOS: Record<string, Produto> = {
  lote: { nome: "o lote", pago: "O seu lote está ativo. Os dias pagos já contam.", link: linkLote, liberar: (r, db) => ativarTerreno(r.terrenoChave, r.meses, r.usuarioId, db), reverter: async (r, db) => { await reverterTerreno(r.terrenoChave, r.meses, r.usuarioId, db); } },
  layout: { nome: "a troca de prédio", pago: "Você ganhou 1 troca de prédio.", link: linkLote, liberar: (r, db) => creditarTrocaLayout(r.terrenoChave, r.usuarioId, db), reverter: async (r, db) => { await retirarCreditoLayout(r.terrenoChave, r.usuarioId, db); } },
  personagem: { nome: "o personagem", pago: "O seu personagem está ativo por 30 dias.", liberar: async (r, db) => { await ativarPersonagem(r.usuarioId, 30 * r.meses, db); return true; }, reverter: async (r, db) => { await reverterPersonagem(r.usuarioId, 30 * r.meses, db); } },
  outdoor: { nome: "o outdoor", pago: "O seu anúncio já está no outdoor por 30 dias.", liberar: (r, db) => ativarOutdoor(r.terrenoChave, r.usuarioId, r.meses, db), reverter: async (r, db) => { await reverterOutdoor(r.terrenoChave, r.usuarioId, r.meses, db); } },
  barraca: { nome: "a barraca da feira", pago: "A sua barraca está garantida na feira de sábado.", liberar: (r, db) => ativarBarraca(r.terrenoChave, r.usuarioId, db), reverter: async (r, db) => { await reverterBarraca(r.terrenoChave, r.usuarioId, db); } },
  item: { nome: "o item do personagem", pago: "A roupa nova já está no seu personagem.", liberar: (r, db) => ativarItem(r.terrenoChave, r.usuarioId, db), reverter: async (r, db) => { await reverterItem(r.terrenoChave, r.usuarioId, db); } },
  creditos: { nome: "o pacote de créditos", pago: "Os créditos já estão na sua carteira.", viraCredito: true, link: () => "/app/creditos", liberar: (r, db) => creditarPacote(db, r.usuarioId, r.id, r.terrenoChave.replace(/^creditos:/, "")), reverter: async (r, db) => { await retirarCreditosDoPagamento(db, r.usuarioId, r.id); } },
  agente: { nome: "o agente", pago: "O agente novo já está na equipe. Converse com ele em Minha equipe.", viraCredito: true, link: () => "/app/equipe", liberar: (r, db) => liberarAgente(db, r), reverter: (r, db) => reverterAgente(db, r) },
  // troca de personalidade (9 créditos): no estorno a personalidade nova fica (não há o que tirar de volta com segurança)
  personalidade: { nome: "a troca de personalidade", pago: "A personalidade nova já vale nas próximas conversas.", viraCredito: true, link: () => "/app/equipe", liberar: (r, db) => liberarPersonalidade(db, r), reverter: async () => {} },
  // frente terreno (20/11/2026): lote extra (renova junto com o principal) e quiosque (ativa como um lote)
  expansao: { nome: "o lote extra", pago: "Terreno expandido: o seu prédio já ocupa os dois lotes.", link: linkLote, liberar: (r, db) => liberarLoteExtra(r.terrenoChave, r.usuarioId, db), reverter: async (r, db) => { await devolverLoteExtra(r.terrenoChave, r.usuarioId, db); } },
  quiosque: { nome: "o quiosque", pago: "O seu quiosque está aberto por 30 dias. A atendente já atende no balcão.", link: linkLote, liberar: (r, db) => ativarTerreno(r.terrenoChave, r.meses, r.usuarioId, db), reverter: async (r, db) => { await reverterTerreno(r.terrenoChave, r.meses, r.usuarioId, db); } },
  // frente praca (20/11/2026): telão, destaque de evento e patrocínio; entram na praça depois da aprovação no admin
  praca: { nome: "o anúncio da praça", pago: "Pago. O anúncio entra na praça assim que a equipe do WorkEnd aprovar.", link: () => "/app/divulgar", liberar: (r, db) => ativarAnuncioPraca(r.terrenoChave, r.usuarioId, db), reverter: async (r, db) => { await reverterAnuncioPraca(r.terrenoChave, r.usuarioId, db); } },
  // frente predios (20/11/2026): modelo de prédio do catálogo; pagamento.tipo = "modelo:<id>" (produtoDe acha pelo prefixo).
  // liberarModelo grava a compra e já troca o prédio; no estorno, retirarModelo (src/server/modelos.ts)
  modelo: { nome: "o modelo de prédio", pago: "O seu prédio novo já está no lote.", link: linkLote,
    liberar: async (r, db) => { const { liberarModelo } = await import("./modelos"); return liberarModelo(r.terrenoChave, r.usuarioId, r.tipo.slice(7), db); },
    reverter: async (r, db) => { const { retirarModelo } = await import("./modelos"); await retirarModelo(r.terrenoChave, r.usuarioId, r.tipo.slice(7), db); } },
  ia: { nome: "as unidades de IA", pago: "As unidades de IA já estão na empresa.", viraCredito: true, link: () => "/app/creditos#unidades", liberar: async (r, db) => { const x = await unidadesDoPagamento(r, db); return x ? creditarUnidades(db, x.empId, x.unidades, r.id) : false; }, reverter: async (r, db) => { const x = await unidadesDoPagamento(r, db); if (x) await retirarUnidades(db, x.empId, x.unidades, r.id); } },
};
export const produtoDe = (tipo: string | null | undefined) => PRODUTOS[tipo ?? "lote"] ?? (tipo?.startsWith("modelo:") ? PRODUTOS.modelo : PRODUTOS.lote);

// Aplica um pagamento vindo da API do Mercado Pago (webhook ou conferência). A linha do pagamento fica travada na transação:
// o webhook e a conferência do mapa chegam juntos e só um deles pode liberar o benefício.
type Efeito = "liberou" | "sem_lote" | "estornou" | "virou_credito" | "devolveu_reserva" | null;
async function aplicar(p: PagamentoMP) {
  const ref = p.external_reference; if (!ref) return null;
  const statusMP = p.status === "approved" ? "aprovado" : p.status === "rejected" ? "rejeitado" : p.status === "refunded" || p.status === "charged_back" ? "estornado" : p.status === "cancelled" ? "cancelado" : "pendente";
  const feito = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    const [reg] = await db<RegPagamento[]>`SELECT ${CAMPOS_REG()} FROM pagamento WHERE id = ${ref} FOR UPDATE`;
    if (!reg) return null;
    const aprovadoAntes = reg.status === "aprovado";
    // aprovado só muda para estornado, e estornado não muda mais; o Pix com créditos que venceu (expirado) só sai disso se o banco aprovar
    const status = reg.status === "estornado" ? "estornado" : aprovadoAntes && statusMP !== "estornado" ? "aprovado" : reg.status === "expirado" && statusMP === "pendente" ? "expirado" : statusMP;
    await db`UPDATE pagamento SET status = ${status}, pagamento_id = ${String(p.id)}, metodo = ${Number(reg.creditosCarteira) > 0 ? "pix+creditos" : p.payment_method_id ?? p.payment_type_id ?? null}, pago_em = ${p.date_approved ? new Date(p.date_approved) : reg.pagoEm}, bruto = ${sql.json(p as unknown as Parameters<typeof sql.json>[0])} WHERE id = ${ref}`;
    const prod = produtoDe(reg.tipo);
    const reservado = Number(reg.creditosCarteira ?? 0);
    let efeito: Efeito = null;
    if (status === "aprovado" && !aprovadoAntes) {
      let ok = true;
      if (reservado > 0) {
        // Pix pago depois que a reserva já tinha voltado para a carteira: reserva de novo (sem saldo, o produto não sai)
        const falta = centavos(reservado - (await usoEmAberto(db, reg.id)));
        if (falta > 0) ok = await debitar(db, reg.usuarioId, falta, `Créditos do Pix pago depois de vencer: ${prod.nome}`, reg.id, `uso-de-novo:${reg.id}`).then(() => true, (e) => { if (e instanceof ErroSaldo) return false; throw e; });
      }
      efeito = ok && (await prod.liberar(reg, db)) ? "liberou" : "sem_lote";
      // Pix antigo (aberto antes da carteira) com o desconto de indicação no valor: o desconto sai do bônus convertido
      if (efeito === "liberou" && Number(reg.creditoUsado ?? 0) > 0) await debitarAte(db, reg.usuarioId, Number(reg.creditoUsado), { tipo: "uso", descricao: "Desconto de indicação usado num Pix aberto antes da carteira", chave: `indicacao-antiga:${reg.id}` });
      if (efeito === "sem_lote" && (reservado > 0 || prod.viraCredito)) {
        if (reservado > 0) await devolverUso(db, reg.usuarioId, reg.id, `Créditos devolvidos: não deu para entregar ${prod.nome}`);
        await creditarPixSemProduto(db, reg.usuarioId, reg.id, Number(reg.valor), prod.nome);
        efeito = "virou_credito";
      }
    } else if (status === "estornado" && aprovadoAntes) {
      await prod.reverter(reg, db);
      if (reservado > 0) await devolverUso(db, reg.usuarioId, reg.id, "Créditos devolvidos: o Pix desse pagamento foi estornado");
      efeito = "estornou";
    } else if (reservado > 0 && !aprovadoAntes && (status === "rejeitado" || status === "cancelado" || status === "expirado")) {
      if (await devolverUso(db, reg.usuarioId, reg.id, "Reserva devolvida: o Pix não foi pago")) efeito = "devolveu_reserva";
    }
    return { reg, status, efeito };
  });
  if (!feito) return null;
  const { reg, status, efeito } = feito;
  await posPagamento(reg, efeito, p.payment_method_id ?? "pix");
  return { ...reg, status };
}

// e-mails, sino e registros só depois de gravar
async function posPagamento(reg: RegPagamento, efeito: Efeito, metodo: string) {
  const valor = brl(Number(reg.valor));
  const cred = Number(reg.creditosCarteira ?? 0);
  const quanto = cred > 0 ? (Number(reg.valor) > 0 ? `${valor} no Pix + ${fmtCreditos(cred)} créditos` : `${fmtCreditos(cred)} créditos`) : valor;
  const tipo = reg.tipo ?? "lote";
  const prod = produtoDe(tipo);
  if (efeito === "sem_lote" && (tipo === "barraca" || tipo === "item")) void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem ${tipo === "barraca" ? "a barraca" : "o item"}`, { usuarioId: reg.usuarioId, dados: { detalhes: `${reg.terrenoChave} não pôde ser liberado (reserva vencida ou item desconhecido). Devolva o valor. Pagamento ${reg.id}.` } });
  else if (efeito === "sem_lote" && tipo === "praca") void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem o anúncio da praça`, { usuarioId: reg.usuarioId, dados: { detalhes: `${reg.terrenoChave} já tinha sido decidido ou apagado. Devolva o valor. Pagamento ${reg.id}.` } });
  else if (efeito === "sem_lote" && tipo === "outdoor") void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem o outdoor`, { usuarioId: reg.usuarioId, dados: { detalhes: `A vaga ${reg.terrenoChave} passou para outra empresa antes do pagamento chegar. Devolva o valor ou realoque. Pagamento ${reg.id}.` } });
  else if (efeito === "sem_lote") void registrar("pagamento", `ATENÇÃO: Pix de ${valor} aprovado sem lote`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `O lote não está mais com quem pagou. Devolva o valor ou realoque pelo painel. Pagamento ${reg.id}.` } });
  if (efeito === "virou_credito") {
    void registrar("pagamento", `Pix de ${valor} virou crédito`, { usuarioId: reg.usuarioId, dados: { detalhes: `Não deu para entregar ${prod.nome} (${reg.terrenoChave}). O valor do Pix entrou como crédito comprado na carteira${cred > 0 ? " e os créditos reservados voltaram" : ""}. Pagamento ${reg.id}.` } });
    void avisar(reg.usuarioId, { tipo: "pagamento", ref: `pagamento:${reg.id}`, titulo: "O seu Pix virou crédito", texto: `Não deu para entregar ${prod.nome}. ${valor} entraram como créditos na sua carteira: use em outra compra ou peça a devolução em até 7 dias.`, link: "/app/creditos" });
  }
  // sino: quem pagou vê a confirmação; indicação: o 1º lote pago libera o crédito de quem indicou
  if (efeito === "liberou") void avisar(reg.usuarioId, { tipo: "pagamento", ref: `pagamento:${reg.id}`, titulo: `Pagamento confirmado · ${quanto}`, texto: prod.pago, link: prod.link?.(reg) ?? "/mundo" });
  if (efeito === "liberou" && (tipo === "lote" || tipo === "quiosque")) void liberarIndicacao(reg.id, reg.usuarioId);
  if (efeito === "estornou") void estornarIndicacao(reg.id);
  if (efeito === "estornou") void registrar("pagamento", `Pagamento estornado (${quanto})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `Os dias ou o crédito desse pagamento foram retirados${cred > 0 ? "; os créditos usados voltaram para a carteira" : ""}. Pagamento ${reg.id}.` } });
  else if (efeito === "liberou" && tipo === "personagem") void registrar("pagamento", `Personagem pago (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Personagem ativo por ${30 * reg.meses} dias.` } });
  else if (efeito === "liberou" && tipo === "barraca") void registrar("pagamento", `Barraca da feira paga (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Barraca ${reg.terrenoChave}.` }, avisarDono: true });
  else if (efeito === "liberou" && tipo === "item") void registrar("pagamento", `Item do personagem pago (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: reg.terrenoChave } });
  else if (efeito === "liberou" && tipo === "outdoor") void registrar("pagamento", `Outdoor pago (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: `Anúncio no outdoor ${reg.terrenoChave} por 30 dias.` }, avisarDono: true });
  else if (efeito === "liberou" && tipo === "praca") void registrar("pagamento", `Anúncio da praça pago (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: `${reg.terrenoChave}: aprove ou recuse na fila da praça, no admin.` }, avisarDono: true });
  else if (efeito === "liberou" && tipo === "expansao") void registrar("pagamento", `Lote extra pago (${quanto})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: "O terreno foi expandido: o prédio passa a ocupar os dois lotes e renova junto com o lote principal." }, avisarDono: true });
  else if (efeito === "liberou" && tipo.startsWith("modelo:")) void registrar("pagamento", `Modelo de prédio pago (${quanto})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `Modelo ${tipo.slice(7)} comprado e já aplicado no lote.` }, avisarDono: true });
  else if (efeito === "liberou" && tipo === "layout") void registrar("pagamento", `Troca de prédio paga (${quanto})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: "Crédito de 1 troca de prédio liberado." }, avisarDono: true });
  else if (efeito === "liberou" && (tipo === "lote" || tipo === "quiosque")) {
    void registrar("pagamento", `${tipo === "quiosque" ? "Quiosque" : "Lote"} pago (${quanto}, ${reg.meses} mês${reg.meses > 1 ? "es" : ""})`, { usuarioId: reg.usuarioId, terrenoChave: reg.terrenoChave, dados: { detalhes: `Pagamento aprovado (${metodo}).` } });
    const [d] = await sql<{ email: string; nome: string; empresaNome: string | null; pagoAte: Date | null }[]>`SELECT u.email, u.nome, t.empresa_nome, t.pago_ate FROM usuario u LEFT JOIN terreno t ON t.chave = ${reg.terrenoChave} WHERE u.id = ${reg.usuarioId}`;
    if (d) void enviarEmail("pagamento", d.email, { nome: d.nome, empresa: d.empresaNome ?? "", lote: rotuloLoja(numeroDaLoja({ chave: reg.terrenoChave })) || `Lote ${LOTE_POR_CHAVE[reg.terrenoChave]?.numero ?? "?"}`, valor: quanto, pago_ate: dataBR(d.pagoAte), link_mapa: `https://workend.online/mundo?lote=${encodeURIComponent(reg.terrenoChave)}`, link_painel: "https://workend.online/app" });
  }
  else if (efeito === "liberou") void registrar("pagamento", `Pagamento de ${prod.nome} (${quanto})`, { usuarioId: reg.usuarioId, dados: { detalhes: `${reg.terrenoChave}. Pagamento ${reg.id}.` } });
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

// Pix com créditos reservados que passou do prazo do QR (60 min) sem pagar: confere no Mercado Pago e, se continua
// sem pagamento, marca "expirado" e devolve os créditos. Roda quando a pessoa abre a carteira ou paga outra coisa.
export async function liberarReservasVencidas(uid: string) {
  await migrar();
  const lista = await sql<{ id: string; dia: boolean }[]>`SELECT id, (criado_em < now() - interval '1 day') AS dia FROM pagamento WHERE usuario_id = ${uid} AND status = 'pendente' AND creditos_carteira > 0 AND criado_em < now() - interval '75 minutes'`;
  for (const p of lista) {
    try { const r = await conferirPagamento(p.id); if (r && r.status !== "pendente") continue; }
    catch (e) { if (!p.dia) { console.error("[cobranca] conferir reserva:", (e as Error).message); continue; } }
    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      const [r] = await db`UPDATE pagamento SET status = 'expirado' WHERE id = ${p.id} AND status = 'pendente' RETURNING id`;
      if (r) await devolverUso(db, uid, p.id, "Reserva devolvida: o Pix venceu sem pagamento");
    }).catch((e) => console.error("[cobranca] expirar reserva:", (e as Error).message));
  }
}

export async function pagamentosDoUsuario(usuarioId: string) {
  await migrar();
  return sql<Pagamento[]>`SELECT id, terreno_chave, usuario_id, status, valor, meses, metodo, preferencia_id, pagamento_id, criado_em, pago_em FROM pagamento WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT 20`;
}
export async function listarPagamentosAdmin() {
  await migrar();
  return sql<PagamentoAdmin[]>`SELECT p.id, p.terreno_chave, p.usuario_id, p.status, p.valor, p.meses, p.metodo, p.preferencia_id, p.pagamento_id, p.criado_em, p.pago_em, p.tipo, p.creditos_carteira, p.devolvido_em, u.email, t.empresa_nome
    FROM pagamento p JOIN usuario u ON u.id = p.usuario_id LEFT JOIN terreno t ON t.chave = p.terreno_chave ORDER BY p.criado_em DESC LIMIT 200`;
}
