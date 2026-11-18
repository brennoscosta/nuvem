// Pedidos pela atendente (17/11/2026, frente "atendente que fecha a venda"). Na conversa da loja (/loja/N, cartão do mapa
// e recepção do prédio), a atendente de IA mostra os produtos da vitrine, monta o pedido, aplica o cupom e pede nome e
// contato; quando o visitante confirma, ela termina a resposta com a marcação [[PEDIDO ...]], que o servidor lê e tira
// da conversa (o mesmo desenho do [[AGENDAR ...]] em ./agenda.ts). O servidor confere tudo de novo e cria o pedido:
//  - preço SEMPRE da tabela produto (centavos); nada de preço vindo da IA ou do navegador; total recalculado aqui;
//  - só produtos ativos daquele dono, 1 a 99 de cada, cupom pela regra de ./cupons.ts;
//  - no máximo 3 pedidos "aguardando" por visitante em cada loja, e limite por IP e por conta a cada hora;
//  - o Pix copia e cola (BR Code estático com valor, ./brcode.ts) usa a chave do DONO: o dinheiro vai direto para ele.
//    O WorkEnd não recebe nem repassa dinheiro e não confirma pagamento sozinho: quem confirma é o dono, em /app/vendas.
// Tabelas: pedido e recebimento_pix (migração 0038, lida também pelo painel de resultados) e as colunas da 0039.
// O pedido guarda em `conversa` o id da mensagem da atendente em que ele nasceu: é assim que o cartão volta para o lugar
// certo da conversa.
import { sql, id, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno } from "./terrenos";
import { avisar } from "./avisos";
import { bloqueio, contar } from "./limite";
import { montarBrCode, validarChavePix, tipoDaChaveGuardada, textoBrCode, ErroChavePix, NOME_TIPO_CHAVE, MAX_NOME_RECEBEDOR, MAX_CIDADE_RECEBEDOR } from "./brcode";
import { reservarCupomNoPedido, liberarCupomDoPedido, cuponsParaPedido, ErroCupom } from "./cupons";
import { numeroDaLoja, chaveDaLoja } from "@/office/data/numeroLoja";

export class ErroPedido extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const statusPedido = (e: unknown) => (e instanceof ErroPedido || e instanceof ErroCupom ? e.status : e instanceof ErroChavePix ? 400 : 500);

export const MAX_AGUARDANDO = 3;
const MAX_QTD = 99, MAX_ITENS = 12, MAX_TOTAL = 10_000_000; // R$ 100 mil por pedido
const LIMITE_IP_HORA = 10, LIMITE_CLIENTE_HORA = 10;

export type StatusPedido = "aguardando" | "pago" | "entregue" | "cancelado";
export const NOME_STATUS: Record<StatusPedido, string> = { aguardando: "Aguardando pagamento", pago: "Pagamento confirmado", entregue: "Entregue", cancelado: "Cancelado" };
export interface ItemPedido { produtoId: string; nome: string; precoCentavos: number; qtd: number }
type Linha = {
  id: string; numero: number; usuarioId: string; lote: string | null; clienteNome: string; clienteContato: string; clienteUsuarioId: string | null;
  conversa: string | null; itens: ItemPedido[]; subtotalCentavos: number; descontoCentavos: number; totalCentavos: number; cupomCodigo: string | null;
  tipo: string; agendamentoId: string | null; status: StatusPedido; pixCopiaCola: string | null; criadoEm: Date; pagoEm: Date | null; atualizadoEm: Date;
  canceladoPor: string | null; empresa: string | null;
};

export const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
const limpa = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/<[^>]*>/g, "").replace(/[<>{}[\]\\"]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const primeiroNome = (n: string) => n.split(" ")[0] || n;

// ---------- loja ----------
async function lojaAberta(numero: number): Promise<{ chave: string; donoId: string; empresa: string; numero: number } | null> {
  const chave = chaveDaLoja(numero); if (!chave) return null;
  let t = await obterTerreno(chave);
  if (t?.anexoDe) t = await obterTerreno(t.anexoDe); // lote duplo: a ampliação usa a loja principal
  if (!t || t.status !== "ativo") return null;
  return { chave: t.chave, donoId: t.usuarioId, empresa: t.empresaNome, numero: numeroDaLoja(t) ?? numero };
}

// ---------- contato do cliente ----------
// WhatsApp/telefone com DDD (10 a 13 dígitos) ou e-mail
export function lerContato(bruto: unknown): string | null {
  const s = limpa(bruto, 80);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return s.toLowerCase();
  const d = s.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13 && !/[a-z]/i.test(s) ? s : null;
}
export function whatsappDoContato(contato: string): string | null {
  if (contato.includes("@")) return null;
  const d = contato.replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  return d.length <= 11 ? `55${d}` : d;
}

// ---------- chave Pix do dono ----------
export async function recebimentoDe(donoId: string) {
  await migrar();
  const [r] = await sql<{ chave: string; nome: string; cidade: string; atualizadoEm: Date }[]>`SELECT chave, nome, cidade, atualizado_em FROM recebimento_pix WHERE usuario_id = ${donoId}`;
  if (!r) return null;
  const tipo = tipoDaChaveGuardada(r.chave);
  return { tipo, tipoNome: NOME_TIPO_CHAVE[tipo], chave: r.chave, nome: r.nome, cidade: r.cidade, comoAparece: `${textoBrCode(r.nome, MAX_NOME_RECEBEDOR)} · ${textoBrCode(r.cidade, MAX_CIDADE_RECEBEDOR)}`, atualizadoEm: r.atualizadoEm };
}
export async function salvarRecebimento(u: Usuario, d: { tipo?: unknown; chave?: unknown; nome?: unknown; cidade?: unknown }) {
  await migrar();
  if (u.banidoEm) throw new ErroPedido("Conta suspensa.", 403);
  const { chave } = validarChavePix(d.tipo, d.chave);
  const nome = limpa(d.nome, MAX_NOME_RECEBEDOR), cidade = limpa(d.cidade, MAX_CIDADE_RECEBEDOR);
  if (textoBrCode(nome, MAX_NOME_RECEBEDOR).length < 2) throw new ErroPedido("Escreva o nome de quem recebe (como está no banco), até 25 letras.");
  if (textoBrCode(cidade, MAX_CIDADE_RECEBEDOR).length < 2) throw new ErroPedido("Escreva a cidade de quem recebe, até 15 letras.");
  await sql`INSERT INTO recebimento_pix (usuario_id, chave, nome, cidade, atualizado_em) VALUES (${u.id}, ${chave}, ${nome}, ${cidade}, now())
    ON CONFLICT (usuario_id) DO UPDATE SET chave = EXCLUDED.chave, nome = EXCLUDED.nome, cidade = EXCLUDED.cidade, atualizado_em = now()`;
  return recebimentoDe(u.id);
}
export async function apagarRecebimento(u: Usuario) {
  await migrar();
  await sql`DELETE FROM recebimento_pix WHERE usuario_id = ${u.id}`;
  return { ok: true };
}

// ---------- o cartão do pedido (o que o cliente vê na conversa) ----------
// nome e cidade de quem recebe saem do próprio copia e cola (campos 59 e 60): é o que o app do banco vai mostrar
function recebedorDoPix(pix: string | null) {
  if (!pix) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i + 4 <= pix.length;) { const k = pix.slice(i, i + 2), n = Number(pix.slice(i + 2, i + 4)); if (!Number.isInteger(n)) break; out[k] = pix.slice(i + 4, i + 4 + n); i += 4 + n; }
  return { nome: out["59"] ?? "", cidade: out["60"] ?? "" };
}
function paraCartao(p: Linha) {
  return {
    id: p.id, numero: p.numero, status: p.status, tipo: p.tipo, empresa: p.empresa ?? "", lojaNumero: p.lote ? numeroDaLoja({ chave: p.lote }) : null,
    itens: (p.itens ?? []).map((i) => ({ nome: i.nome, qtd: i.qtd, precoCentavos: i.precoCentavos })),
    subtotal: p.subtotalCentavos, desconto: p.descontoCentavos, total: p.totalCentavos, cupom: p.cupomCodigo,
    pix: p.status === "aguardando" ? p.pixCopiaCola : null, temPix: !!p.pixCopiaCola, recebedor: recebedorDoPix(p.pixCopiaCola),
    contato: p.clienteContato, criadoEm: p.criadoEm, pagoEm: p.pagoEm, atualizadoEm: p.atualizadoEm, canceladoPor: p.canceladoPor,
  };
}
export type CartaoPedido = ReturnType<typeof paraCartao>;
const SELECT_PEDIDO = () => sql`SELECT p.*, t.empresa_nome AS empresa FROM pedido p LEFT JOIN terreno t ON t.chave = p.lote`;

// pedidos que nasceram nestas mensagens da atendente (para a conversa do próprio cliente)
export async function pedidosDasMensagens(clienteId: string, mensagens: string[]) {
  await migrar();
  if (!mensagens.length) return new Map<string, CartaoPedido>();
  const rows = await sql<Linha[]>`${SELECT_PEDIDO()} WHERE p.conversa = ANY(${sql.array(mensagens)}) AND p.cliente_usuario_id = ${clienteId}`;
  return new Map(rows.map((r) => [r.conversa as string, paraCartao(r)]));
}
export async function cartaoDoPedido(u: Usuario, pedidoId: string) {
  await migrar();
  const [p] = await sql<Linha[]>`${SELECT_PEDIDO()} WHERE p.id = ${String(pedidoId).slice(0, 40)}`;
  if (!p || (p.clienteUsuarioId !== u.id && p.usuarioId !== u.id)) throw new ErroPedido("Pedido não encontrado.", 404);
  return { ...paraCartao(p), souCliente: p.clienteUsuarioId === u.id };
}

// ---------- criar o pedido ----------
export interface NovoPedido { numero: number; cliente: Usuario; itens: { produtoId: string; qtd: number }[]; cupom?: string | null; nome: unknown; contato: unknown; conversa?: string | null; ip?: string | null }

export async function criarPedido(d: NovoPedido): Promise<CartaoPedido> {
  await migrar();
  const u = d.cliente;
  if (u.banidoEm) throw new ErroPedido("Conta suspensa.", 403);
  const loja = await lojaAberta(d.numero);
  if (!loja) throw new ErroPedido("Esta loja não está aberta agora.", 404);
  if (loja.donoId === u.id) throw new ErroPedido("Esta loja é sua: os pedidos dos clientes aparecem em Vendas.");
  const kIp = `pedido:ip:${d.ip || "sem-ip"}`, kConta = `pedido:conta:${u.id}`;
  if (bloqueio(kIp, LIMITE_IP_HORA) || bloqueio(kConta, LIMITE_CLIENTE_HORA)) throw new ErroPedido("Muitos pedidos em pouco tempo. Tente de novo daqui a uma hora.", 429);

  // itens: ids e quantidades (preço nenhum vem de fora); o mesmo produto repetido soma
  if (!Array.isArray(d.itens) || !d.itens.length) throw new ErroPedido("O pedido está sem produtos.");
  const qtds = new Map<string, number>();
  for (const it of d.itens) {
    const pid = typeof it?.produtoId === "string" ? it.produtoId.trim().slice(0, 40) : "";
    const q = Number(it?.qtd);
    if (!pid) throw new ErroPedido("Um dos produtos do pedido está sem identificação.");
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTD) throw new ErroPedido(`A quantidade de cada produto vai de 1 a ${MAX_QTD}.`);
    qtds.set(pid, (qtds.get(pid) ?? 0) + q);
  }
  if (qtds.size > MAX_ITENS) throw new ErroPedido(`Um pedido tem no máximo ${MAX_ITENS} produtos diferentes.`);
  for (const q of qtds.values()) if (q > MAX_QTD) throw new ErroPedido(`A quantidade de cada produto vai de 1 a ${MAX_QTD}.`);
  const nome = limpa(d.nome, 60) || limpa(u.nome, 60);
  if (nome.length < 2) throw new ErroPedido("Falta o nome de quem está pedindo.");
  const contato = lerContato(d.contato);
  if (!contato) throw new ErroPedido("Falta um WhatsApp com DDD ou um e-mail para a loja falar com você.");

  const pid = id("ped");
  const linha = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    await db`SELECT pg_advisory_xact_lock(hashtext(${"pedido:" + loja.donoId}))`;
    const [{ n }] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM pedido WHERE usuario_id = ${loja.donoId} AND cliente_usuario_id = ${u.id} AND status = 'aguardando'`;
    if (n >= MAX_AGUARDANDO) throw new ErroPedido(`Você já tem ${MAX_AGUARDANDO} pedidos esperando pagamento nesta loja. Pague ou cancele um deles antes de fazer outro.`, 429);
    const ids = [...qtds.keys()];
    const prods = await db<{ id: string; nome: string; precoCentavos: number | null }[]>`SELECT id, nome, preco_centavos FROM produto WHERE usuario_id = ${loja.donoId} AND ativo AND id = ANY(${sql.array(ids)})`;
    const porId = new Map(prods.map((p) => [p.id, p]));
    const itens: ItemPedido[] = [];
    for (const [produtoId, qtd] of qtds) {
      const p = porId.get(produtoId);
      if (!p) throw new ErroPedido("Um dos produtos não está na vitrine desta loja.");
      if (p.precoCentavos == null) throw new ErroPedido(`“${p.nome}” é sob consulta e não entra no pedido. A loja responde pelo seu contato.`);
      itens.push({ produtoId, nome: p.nome, precoCentavos: p.precoCentavos, qtd });
    }
    const subtotal = itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0);
    if (subtotal < 1) throw new ErroPedido("O pedido está sem valor.");
    if (subtotal > MAX_TOTAL) throw new ErroPedido(`Pedidos pela atendente vão até ${reais(MAX_TOTAL)}. Fale direto com a loja.`);
    const cupom = d.cupom && String(d.cupom).trim() ? await reservarCupomNoPedido(db, { donoId: loja.donoId, clienteId: u.id, codigo: d.cupom, subtotal, pedidoId: pid }) : null;
    const desconto = cupom?.desconto ?? 0, total = subtotal - desconto;
    const [{ prox }] = await db<{ prox: number }[]>`SELECT COALESCE(max(numero), 0)::int + 1 AS prox FROM pedido WHERE usuario_id = ${loja.donoId}`;
    const [rec] = await db<{ chave: string; nome: string; cidade: string }[]>`SELECT chave, nome, cidade FROM recebimento_pix WHERE usuario_id = ${loja.donoId}`;
    const pix = rec ? montarBrCode({ chave: rec.chave, nome: rec.nome, cidade: rec.cidade, valorCentavos: total, txid: `PEDIDO${prox}` }) : null;
    await db`INSERT INTO pedido (id, numero, usuario_id, lote, cliente_nome, cliente_contato, cliente_usuario_id, conversa, itens, subtotal_centavos, desconto_centavos, total_centavos, cupom_codigo, tipo, status, pix_copia_cola)
      VALUES (${pid}, ${prox}, ${loja.donoId}, ${loja.chave}, ${nome}, ${contato}, ${u.id}, ${d.conversa ?? null}, ${sql.json(itens as never)}, ${subtotal}, ${desconto}, ${total}, ${cupom?.codigo ?? null}, 'pedido', 'aguardando', ${pix})`;
    const [p] = await db<Linha[]>`SELECT p.*, ${loja.empresa}::text AS empresa FROM pedido p WHERE p.id = ${pid}`;
    return p;
  });
  contar(kIp, 60); contar(kConta, 60);
  const resumoItens = linha.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ");
  void avisar(loja.donoId, {
    tipo: "venda", ref: `pedido:novo:${pid}`, link: `/app/vendas?pedido=${pid}`,
    titulo: `Novo pedido #${linha.numero} · ${reais(linha.totalCentavos)} · ${primeiroNome(nome)}`,
    texto: `${resumoItens}${linha.cupomCodigo ? ` · cupom ${linha.cupomCodigo}` : ""} · ${linha.pixCopiaCola ? "esperando o Pix" : "sem chave Pix: combine o pagamento com o cliente"}`,
  });
  return paraCartao(linha);
}

// ---------- o dono (e o cliente cancelando o dele) ----------
type Acao = "pago" | "entregue" | "cancelar";
export async function mudarStatusPedido(u: Usuario, pedidoId: string, acaoBruta: unknown) {
  await migrar();
  const acao = (["pago", "entregue", "cancelar"] as const).find((a) => a === acaoBruta) as Acao | undefined;
  if (!acao) throw new ErroPedido("Ação inválida.");
  const r = await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    const [p] = await db<Linha[]>`SELECT p.*, t.empresa_nome AS empresa FROM pedido p LEFT JOIN terreno t ON t.chave = p.lote WHERE p.id = ${String(pedidoId).slice(0, 40)} FOR UPDATE OF p`;
    const ehDono = !!p && p.usuarioId === u.id, ehCliente = !!p && p.clienteUsuarioId === u.id;
    if (!p || (!ehDono && !ehCliente)) throw new ErroPedido("Pedido não encontrado.", 404);
    if (acao === "cancelar") {
      if (ehDono) { if (p.status !== "aguardando" && p.status !== "pago") throw new ErroPedido(p.status === "entregue" ? "Esse pedido já foi entregue." : "Esse pedido já foi cancelado.", 409); }
      else if (p.status !== "aguardando") throw new ErroPedido(p.status === "cancelado" ? "Esse pedido já foi cancelado." : "A loja já confirmou o pagamento. Para cancelar, fale direto com ela.", 409);
      await liberarCupomDoPedido(db, p.id);
      await db`UPDATE pedido SET status = 'cancelado', cancelado_por = ${ehDono ? "dono" : "cliente"}, atualizado_em = now() WHERE id = ${p.id}`;
    } else {
      if (!ehDono) throw new ErroPedido("Só a loja confirma o pagamento e a entrega.", 403);
      if (acao === "pago") {
        if (p.status !== "aguardando") throw new ErroPedido(p.status === "cancelado" ? "Esse pedido foi cancelado." : "O pagamento desse pedido já foi confirmado.", 409);
        await db`UPDATE pedido SET status = 'pago', pago_em = COALESCE(pago_em, now()), atualizado_em = now() WHERE id = ${p.id}`;
      } else {
        if (p.status !== "pago") throw new ErroPedido(p.status === "aguardando" ? "Confirme o pagamento antes de marcar como entregue." : p.status === "entregue" ? "Esse pedido já foi entregue." : "Esse pedido foi cancelado.", 409);
        // pago_em sempre preenchido em pago/entregue: o painel de resultados soma as vendas por essa data
        await db`UPDATE pedido SET status = 'entregue', pago_em = COALESCE(pago_em, now()), atualizado_em = now() WHERE id = ${p.id}`;
      }
    }
    const [novo] = await db<Linha[]>`SELECT p.*, t.empresa_nome AS empresa FROM pedido p LEFT JOIN terreno t ON t.chave = p.lote WHERE p.id = ${p.id}`;
    return { p: novo, ehDono };
  });
  const p = r.p, numero = p.lote ? numeroDaLoja({ chave: p.lote }) : null, empresa = p.empresa ?? "A loja";
  const linkCliente = numero != null ? `/loja/${numero}#conversa` : "/mundo";
  if (r.ehDono && p.clienteUsuarioId) {
    const titulo = acao === "pago" ? `Pagamento confirmado pela ${empresa}` : acao === "entregue" ? `Pedido #${p.numero} entregue pela ${empresa}` : `${empresa} cancelou o pedido #${p.numero}`;
    void avisar(p.clienteUsuarioId, { tipo: "venda", ref: `pedido:${acao}:${p.id}`, link: linkCliente, titulo, texto: `Pedido #${p.numero} · ${reais(p.totalCentavos)}` });
  } else if (!r.ehDono) {
    void avisar(p.usuarioId, { tipo: "venda", ref: `pedido:cancelou:${p.id}`, link: `/app/vendas?pedido=${p.id}`, titulo: `${primeiroNome(p.clienteNome)} cancelou o pedido #${p.numero}`, texto: `${reais(p.totalCentavos)} · ${p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}` });
  }
  return paraCartao(p);
}

const paraDono = (p: Linha) => ({
  ...paraCartao(p), pix: p.pixCopiaCola, clienteNome: p.clienteNome, clienteContato: p.clienteContato,
  whatsapp: whatsappDoContato(p.clienteContato), email: p.clienteContato.includes("@") ? p.clienteContato : null, clienteUsuarioId: p.clienteUsuarioId,
});
export type PedidoDono = ReturnType<typeof paraDono>;
const STATUS: StatusPedido[] = ["aguardando", "pago", "entregue", "cancelado"];
export async function vendasDoDono(u: Usuario, statusBruto?: string | null) {
  await migrar();
  const status = STATUS.find((s) => s === statusBruto) ?? null;
  const [pedidos, contagem, somas, pix] = await Promise.all([
    sql<Linha[]>`${SELECT_PEDIDO()} WHERE p.usuario_id = ${u.id} AND (${status}::text IS NULL OR p.status = ${status}) ORDER BY p.criado_em DESC LIMIT 200`,
    sql<{ status: StatusPedido; n: number }[]>`SELECT status, count(*)::int AS n FROM pedido WHERE usuario_id = ${u.id} GROUP BY status`,
    sql<{ aguardando: number; recebido30: number }[]>`SELECT COALESCE(sum(total_centavos) FILTER (WHERE status = 'aguardando'), 0)::int AS aguardando,
      COALESCE(sum(total_centavos) FILTER (WHERE status IN ('pago','entregue') AND pago_em > now() - interval '30 days'), 0)::int AS recebido30 FROM pedido WHERE usuario_id = ${u.id}`,
    recebimentoDe(u.id),
  ]);
  const c = Object.fromEntries(STATUS.map((s) => [s, contagem.find((x) => x.status === s)?.n ?? 0])) as Record<StatusPedido, number>;
  return { pix, status, contagem: { ...c, todos: STATUS.reduce((a, s) => a + c[s], 0) }, somas: somas[0] ?? { aguardando: 0, recebido30: 0 }, pedidos: pedidos.map(paraDono) };
}
// cartão "Vendas" do painel Meu escritório
export async function resumoVendas(donoId: string) {
  await migrar();
  const ultimos = await sql<{ numero: number; clienteNome: string; totalCentavos: number }[]>`SELECT numero, cliente_nome, total_centavos FROM pedido WHERE usuario_id = ${donoId} AND status = 'aguardando' ORDER BY criado_em DESC LIMIT 2`;
  const [r] = await sql<{ aguardando: number; valor: number; semana: number }[]>`SELECT count(*) FILTER (WHERE status = 'aguardando')::int AS aguardando,
      COALESCE(sum(total_centavos) FILTER (WHERE status = 'aguardando'), 0)::int AS valor,
      count(*) FILTER (WHERE criado_em > now() - interval '7 days' AND status <> 'cancelado')::int AS semana
    FROM pedido WHERE usuario_id = ${donoId}`;
  const [pix] = await sql`SELECT 1 FROM recebimento_pix WHERE usuario_id = ${donoId}`;
  return { aguardando: r?.aguardando ?? 0, valorAguardando: r?.valor ?? 0, semana: r?.semana ?? 0, temPix: !!pix, ultimos: ultimos.map((u) => ({ numero: u.numero, nome: primeiroNome(u.clienteNome), total: u.totalCentavos })) };
}

// ---------- atendente de IA ----------
export async function contextoPedidosIA(numero: number, visitante: Usuario): Promise<string | null> {
  await migrar();
  const loja = await lojaAberta(numero);
  if (!loja || loja.donoId === visitante.id) return null;
  const prods = await sql<{ id: string; nome: string; precoCentavos: number | null; descricao: string }[]>`SELECT id, nome, preco_centavos, descricao FROM produto WHERE usuario_id = ${loja.donoId} AND ativo ORDER BY ordem, criado_em LIMIT ${MAX_ITENS}`;
  const comPreco = prods.filter((p) => p.precoCentavos != null);
  if (!comPreco.length) return null;
  const consulta = prods.filter((p) => p.precoCentavos == null);
  const [cupons, rec, abertos] = await Promise.all([
    cuponsParaPedido(loja.donoId, visitante.id),
    sql`SELECT 1 FROM recebimento_pix WHERE usuario_id = ${loja.donoId}`,
    sql<{ numero: number; totalCentavos: number }[]>`SELECT numero, total_centavos FROM pedido WHERE usuario_id = ${loja.donoId} AND cliente_usuario_id = ${visitante.id} AND status = 'aguardando' ORDER BY criado_em`,
  ]);
  const meus = cupons.filter((c) => c.codigo);
  return [
    "## Vitrine e pedidos (você pode fazer pedidos de verdade)",
    "Esta loja vende os produtos abaixo pelo WorkEnd. Quando o visitante quiser comprar, isto vale mais que a instrução geral de só anotar o contato: você monta o pedido com ele.",
    "Produtos (use o id na marcação; o preço é este e nenhum outro):",
    ...comPreco.map((p) => `- id="${p.id}" · ${p.nome} · ${reais(p.precoCentavos as number)}${p.descricao ? ` · ${p.descricao.replace(/\s+/g, " ").slice(0, 90)}` : ""}`),
    consulta.length ? `Sob consulta (não entram no pedido; ofereça anotar o contato para o dono responder): ${consulta.map((p) => p.nome).join("; ")}.` : "",
    cupons.length ? `Cupons desta loja que dão desconto no pedido: ${cupons.map((c) => `"${c.titulo}" (${c.desconto})`).join("; ")}.` : "Esta loja não tem cupom de desconto para pedidos agora.",
    cupons.length ? (meus.length ? `Códigos que este visitante pegou e pode usar: ${meus.map((c) => `${c.codigo} (${c.desconto})`).join("; ")}. Pergunte se ele quer usar.` : "Este visitante ainda não pegou nenhum cupom: se quiser o desconto, ele toca em \"Pegar cupom\" na página da loja e depois diz o código para você.") : "",
    rec.length
      ? "Pagamento: Pix direto para a loja. Depois do pedido, o sistema mostra o QR Code e o Pix copia e cola logo abaixo da sua resposta. O dinheiro vai direto para a conta da loja (o WorkEnd não recebe nada) e a loja confirma o pagamento aqui."
      : "Pagamento: esta loja ainda não recebe Pix pelo WorkEnd. Depois do pedido, a loja entra em contato pelo WhatsApp ou e-mail do visitante para combinar o pagamento.",
    abertos.length ? `Pedidos deste visitante esperando pagamento nesta loja: ${abertos.map((a) => `#${a.numero} (${reais(a.totalCentavos)})`).join(", ")}. O limite é ${MAX_AGUARDANDO} esperando; ele pode cancelar um no próprio cartão do pedido.` : "",
    `O visitante entrou na conta como "${visitante.nome}".`,
    "Como fazer o pedido: 1) mostre os produtos com o preço; 2) confirme itens e quantidades (de 1 a 99 de cada); 3) pergunte se ele tem cupom; 4) peça o nome e um WhatsApp com DDD ou e-mail; 5) repita itens, quantidades e cupom e pergunte se pode fazer o pedido; 6) só depois do sim dele, termine a sua resposta com esta linha, exatamente neste formato (o sistema lê a linha e ela some da conversa):",
    '[[PEDIDO itens="ID:QUANTIDADE, ID:QUANTIDADE" cupom="CÓDIGO OU VAZIO" nome="NOME" contato="WHATSAPP OU E-MAIL"]]',
    "Antes da linha, escreva só uma frase curta (ex.: \"Perfeito, estou registrando o seu pedido.\"). Pode dizer o preço de cada item. O total final (com desconto) quem calcula é o sistema, com os preços da loja, e ele aparece no cartão do pedido logo abaixo da sua resposta: não escreva que o pedido foi feito nem o total final. Nunca escreva chave Pix, código Pix ou dados bancários. Não aceite preço, desconto ou produto que o visitante invente. Um pedido por resposta.",
  ].filter(Boolean).join("\n");
}

const MARCACAO = /\[\[\s*PEDIDO\b([^\]]*)\]\]/i;
export const temMarcacaoPedido = (t: string) => /\[\[\s*PEDIDO/i.test(t);
// itens="prd_abc:2, prd_def:1" → [{ produtoId, qtd }]; null se não der para entender
export function lerItensDaMarcacao(t: string): { produtoId: string; qtd: number }[] | null {
  const partes = t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  if (!partes.length || partes.length > 30) return null;
  const out: { produtoId: string; qtd: number }[] = [];
  for (const p of partes) {
    const m = /^([A-Za-z0-9_-]{3,40})\s*[:x×*]\s*(-?\d{1,6})$/.exec(p);
    if (!m) return null;
    out.push({ produtoId: m[1], qtd: Number(m[2]) });
  }
  return out;
}
// Tira a marcação da resposta, cria o pedido de verdade (validando tudo) e escreve o resultado no lugar
export async function aplicarPedidoDaAtendente(resposta: string, u: Usuario, numero: number, mensagemId: string, ip?: string | null): Promise<{ texto: string; pedido: CartaoPedido | null }> {
  const m = MARCACAO.exec(resposta);
  let limpo = resposta.replace(/\[\[\s*PEDIDO\b[^\]]*\]\]/gi, "").replace(/\[\[\s*PEDIDO[^\n]*$/i, "").trim();
  if (!m) return { texto: limpo || resposta, pedido: null };
  const at: Record<string, string> = {};
  for (const x of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) at[x[1].toLowerCase()] = x[2];
  try {
    const itens = lerItensDaMarcacao(at.itens ?? "");
    if (!itens) throw new ErroPedido("não entendi os produtos e as quantidades. Me diga de novo o que você quer.");
    const cupom = /^(vazio|nenhum|sem cupom|-)?$/i.test((at.cupom ?? "").trim()) ? null : at.cupom;
    const p = await criarPedido({ numero, cliente: u, itens, cupom, nome: at.nome, contato: at.contato, conversa: mensagemId, ip });
    limpo += `\n\nPedido #${p.numero} feito: ${reais(p.total)}${p.desconto ? ` (já com ${reais(p.desconto)} de desconto do cupom ${p.cupom})` : ""}.`
      + (p.temPix ? ` O pagamento vai direto para ${p.recebedor?.nome || p.empresa}, pelo Pix logo abaixo. A loja confirma aqui quando receber.` : ` A loja vai falar com você pelo ${p.contato} para combinar o pagamento.`);
    return { texto: limpo.trim(), pedido: p };
  } catch (e) {
    const msg = (e as Error).message;
    limpo += `\n\nNão consegui fazer o pedido: ${msg.charAt(0).toLowerCase() === msg.charAt(0) ? msg : msg.charAt(0).toLowerCase() + msg.slice(1)}`;
    return { texto: limpo.trim(), pedido: null };
  }
}
