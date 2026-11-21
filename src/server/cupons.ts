// Cupons da loja (13/11/2026). O dono cria até 3 cupons ativos (texto do desconto, regra curta, validade e limite de
// pegos). O visitante com conta toca em "Pegar cupom" e recebe um código só dele (ex.: PADA-7K3Q). Na hora da compra o
// dono confere o código em /app/cupons ("Validar cupom") e ele vira usado. Pegos e usados aparecem nos resultados.
import { randomBytes } from "node:crypto";
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { lojaDoNumero, diaBR } from "./resultados";
import { terrenoDoUsuario } from "./terrenos";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export class ErroCupom extends Error { constructor(msg: string, public status = 400) { super(msg); } }
export const MAX_CUPONS_ATIVOS = 3;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const limpa = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/<[^>]*>/g, "").replace(/[<>{}[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const somaDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
const prefixo = (nome: string) => (nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "LOJA").padEnd(4, "X");

// passaporte (20/11/2026, frente "visitante", migração 0050): o cupom que a recepcionista oferece a quem chega com o
// passaporte da cidade; fica fora da lista pública e só quem tem carimbo da loja pega (src/server/passaporte.ts)
export interface CupomDono { id: string; titulo: string; regra: string; validade: string; limite: number | null; ativo: boolean; pegos: number; usados: number; vencido: boolean; descontoPct: number | null; descontoCentavos: number | null; minimoCentavos: number | null; passaporte: boolean }

// ---------- desconto em número (17/11/2026, pedidos pela atendente; colunas na migração 0039) ----------
// Sem número, o cupom é só de balcão (o dono confere em "Validar cupom"). Com número, a atendente aplica no pedido.
export interface DescontoCupom { descontoPct: number | null; descontoCentavos: number | null; minimoCentavos: number | null }
const reaisBR = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
export function descontoTexto(c: DescontoCupom) {
  const base = c.descontoPct ? `${c.descontoPct}% de desconto` : c.descontoCentavos ? `${reaisBR(c.descontoCentavos)} de desconto` : null;
  return base && c.minimoCentavos ? `${base} em pedidos a partir de ${reaisBR(c.minimoCentavos)}` : base;
}
export const temDescontoNoPedido = (c: DescontoCupom) => !!(c.descontoPct || c.descontoCentavos);
export function calcularDesconto(c: DescontoCupom, subtotal: number) {
  if (c.descontoPct) return Math.floor((subtotal * c.descontoPct) / 100);
  return Math.min(c.descontoCentavos ?? 0, subtotal);
}
// "12,90", "R$ 5" → centavos (vazio = null)
function lerReais(v: unknown, campo: string): number | null {
  if (v == null || v === "") return null;
  let s = String(v).replace(/[^\d,.]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Math.round(Number(s) * 100);
  if (!Number.isFinite(n) || n < 1 || n > 10_000_000) throw new ErroCupom(`${campo}: escreva um valor em reais, por exemplo 5,00.`);
  return n;
}
function lerDesconto(d: { descontoTipo?: unknown; descontoValor?: unknown; minimo?: unknown }): DescontoCupom {
  const tipo = d.descontoTipo === "pct" || d.descontoTipo === "valor" ? d.descontoTipo : null;
  if (!tipo) return { descontoPct: null, descontoCentavos: null, minimoCentavos: null };
  const minimoCentavos = lerReais(d.minimo, "Pedido mínimo");
  if (tipo === "pct") {
    const p = Math.trunc(Number(String(d.descontoValor ?? "").replace(",", ".")));
    if (!(p >= 1 && p <= 90)) throw new ErroCupom("O desconto em porcentagem vai de 1% a 90%.");
    return { descontoPct: p, descontoCentavos: null, minimoCentavos };
  }
  const v = lerReais(d.descontoValor, "Desconto");
  if (!v) throw new ErroCupom("Escreva quanto o cupom desconta, por exemplo 5,00.");
  if (minimoCentavos != null && v >= minimoCentavos) throw new ErroCupom("O pedido mínimo precisa ser maior que o desconto.");
  return { descontoPct: null, descontoCentavos: v, minimoCentavos };
}

async function lojaAtivaDo(u: Usuario) {
  const t = await terrenoDoUsuario(u.id);
  if (!t || t.status !== "ativo") throw new ErroCupom("Os cupons ficam dentro da sua loja. Abra a sua loja no mapa primeiro.", 404);
  return t;
}

export async function cuponsDoDono(u: Usuario): Promise<CupomDono[]> {
  await migrar();
  const hoje = diaBR();
  const rows = await sql<Omit<CupomDono, "vencido">[]>`
    SELECT c.id, c.titulo, c.regra, c.validade::text AS validade, c.limite, c.ativo, c.desconto_pct, c.desconto_centavos, c.minimo_centavos, c.passaporte,
      (SELECT count(*)::int FROM cupom_resgate r WHERE r.cupom_id = c.id) AS pegos,
      (SELECT count(*)::int FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usado_em IS NOT NULL) AS usados
    FROM cupom c WHERE c.dono_id = ${u.id} ORDER BY c.ativo DESC, c.criado_em DESC LIMIT 30`;
  return rows.map((r) => ({ ...r, vencido: r.validade < hoje }));
}

export async function criarCupom(u: Usuario, d: { titulo?: unknown; regra?: unknown; validade?: unknown; limite?: unknown; descontoTipo?: unknown; descontoValor?: unknown; minimo?: unknown }) {
  await migrar(); await lojaAtivaDo(u);
  const titulo = limpa(d.titulo, 40); if (titulo.length < 3) throw new ErroCupom("Escreva o desconto (ex.: 10% no pão, Frete grátis).");
  const regra = limpa(d.regra, 120);
  const hoje = diaBR();
  const validade = typeof d.validade === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.validade) ? d.validade : "";
  if (!validade || validade < hoje) throw new ErroCupom("Escolha a validade: hoje ou uma data à frente.");
  if (validade > somaDias(hoje, 180)) throw new ErroCupom("A validade vai até 6 meses.");
  const limBruto = d.limite === "" || d.limite == null ? null : Math.trunc(Number(d.limite));
  if (limBruto !== null && (!Number.isFinite(limBruto) || limBruto < 1 || limBruto > 10000)) throw new ErroCupom("O limite é um número de 1 a 10.000 (ou deixe em branco).");
  const desc = lerDesconto(d);
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"cupom:" + u.id}))`;
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM cupom WHERE dono_id = ${u.id} AND ativo AND validade >= ${hoje}::date`;
    if (n >= MAX_CUPONS_ATIVOS) throw new ErroCupom(`Cada loja pode ter até ${MAX_CUPONS_ATIVOS} cupons ativos. Encerre um antes de criar outro.`);
    const [c] = await tx<{ id: string }[]>`INSERT INTO cupom (id, dono_id, titulo, regra, validade, limite, desconto_pct, desconto_centavos, minimo_centavos)
      VALUES (${id("cup")}, ${u.id}, ${titulo}, ${regra}, ${validade}::date, ${limBruto}, ${desc.descontoPct}, ${desc.descontoCentavos}, ${desc.minimoCentavos}) RETURNING id`;
    return c;
  });
}

export async function encerrarCupom(u: Usuario, cupomId: string) {
  await migrar();
  const r = await sql`UPDATE cupom SET ativo = false WHERE id = ${cupomId} AND dono_id = ${u.id}`;
  if (!r.count) throw new ErroCupom("Cupom não encontrado.", 404);
}

// cupons que o visitante pode pegar nesta loja (ativos, na validade, sem esgotar), com o código dele se já pegou
export async function cuponsDaLoja(numero: number, u: Usuario | null) {
  await migrar();
  const loja = await lojaDoNumero(numero); if (!loja) return { cupons: [], ehDono: false };
  const hoje = diaBR();
  const rows = await sql<{ id: string; titulo: string; regra: string; validade: string; limite: number | null; pegos: number; meu: string | null; usado: Date | null; passaporte: boolean }[]>`
    SELECT c.id, c.titulo, c.regra, c.validade::text AS validade, c.limite, c.passaporte,
      (SELECT count(*)::int FROM cupom_resgate r WHERE r.cupom_id = c.id) AS pegos,
      (SELECT r.codigo FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${u?.id ?? ""}) AS meu,
      (SELECT r.usado_em FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${u?.id ?? ""}) AS usado
    FROM cupom c WHERE c.dono_id = ${loja.donoId} AND c.ativo AND c.validade >= ${hoje}::date ORDER BY c.criado_em`;
  return {
    ehDono: u?.id === loja.donoId,
    cupons: rows.filter((r) => r.meu || (!r.passaporte && (r.limite == null || r.pegos < r.limite))).map((r) => ({ id: r.id, titulo: r.titulo, regra: r.regra, validade: r.validade, restam: r.limite == null ? null : Math.max(0, r.limite - r.pegos), meu: r.meu, usado: !!r.usado })),
  };
}

export async function pegarCupom(u: Usuario, cupomId: string) {
  await migrar();
  if (u.banidoEm) throw new ErroCupom("Conta suspensa.", 403);
  const hoje = diaBR();
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; donoId: string; ativo: boolean; validade: string; limite: number | null; passaporte: boolean }[]>`SELECT id, dono_id, ativo, validade::text AS validade, limite, passaporte FROM cupom WHERE id = ${cupomId} FOR UPDATE`;
    if (!c || !c.ativo || c.validade < hoje) throw new ErroCupom("Esse cupom não está mais valendo.", 404);
    if (c.donoId === u.id) throw new ErroCupom("Esse cupom é da sua loja.");
    const [ja] = await tx<{ codigo: string }[]>`SELECT codigo FROM cupom_resgate WHERE cupom_id = ${c.id} AND usuario_id = ${u.id}`;
    if (ja) return { codigo: ja.codigo, novo: false };
    // cupom do passaporte: só para quem foi atendido na recepção da loja (tem o carimbo dela)
    if (c.passaporte) {
      const [carimbo] = await tx`SELECT 1 FROM passaporte_carimbo WHERE usuario_id = ${u.id} AND dono_id = ${c.donoId} LIMIT 1`;
      if (!carimbo) throw new ErroCupom("Este cupom é do passaporte da cidade: a recepcionista da loja oferece para quem é atendido lá.", 403);
    }
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM cupom_resgate WHERE cupom_id = ${c.id}`;
    if (c.limite != null && n >= c.limite) throw new ErroCupom("Esse cupom esgotou.");
    const [t] = await tx<{ empresaNome: string }[]>`SELECT empresa_nome FROM terreno WHERE usuario_id = ${c.donoId} AND anexo_de IS NULL ORDER BY status = 'ativo' DESC LIMIT 1`;
    const pre = prefixo(t?.empresaNome ?? "LOJA");
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const codigo = `${pre}-${Array.from(randomBytes(4), (b) => ALFABETO[b % ALFABETO.length]).join("")}`;
      const r = await tx`INSERT INTO cupom_resgate (id, cupom_id, usuario_id, codigo) VALUES (${id("cpr")}, ${c.id}, ${u.id}, ${codigo}) ON CONFLICT (codigo) DO NOTHING`;
      if (r.count) return { codigo, novo: true };
    }
    throw new ErroCupom("Não consegui gerar o código agora. Tente de novo.", 500);
  });
}

export async function meusCupons(u: Usuario) {
  await migrar();
  const rows = await sql<{ codigo: string; titulo: string; regra: string; validade: string; usadoEm: Date | null; chave: string | null; empresa: string | null }[]>`
    SELECT r.codigo, c.titulo, c.regra, c.validade::text AS validade, r.usado_em,
      (SELECT t.chave FROM terreno t WHERE t.usuario_id = c.dono_id AND t.anexo_de IS NULL AND t.status = 'ativo' LIMIT 1) AS chave,
      (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = c.dono_id AND t.anexo_de IS NULL ORDER BY t.status = 'ativo' DESC LIMIT 1) AS empresa
    FROM cupom_resgate r JOIN cupom c ON c.id = r.cupom_id WHERE r.usuario_id = ${u.id} ORDER BY r.criado_em DESC LIMIT 50`;
  const hoje = diaBR();
  return rows.map((r) => ({ codigo: r.codigo, titulo: r.titulo, regra: r.regra, validade: r.validade, usado: !!r.usadoEm, vencido: r.validade < hoje, empresa: r.empresa ?? "Loja", numero: r.chave ? LOTE_POR_CHAVE[r.chave]?.numero ?? null : null }));
}

// o dono confere o código na hora da compra: se é da loja dele, se está na validade e se ainda não foi usado
export async function validarCupom(u: Usuario, codigoBruto: unknown) {
  await migrar(); await lojaAtivaDo(u);
  const codigo = (typeof codigoBruto === "string" ? codigoBruto : "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.+)$/, "$1-$2").slice(0, 12);
  if (codigo.length < 6) throw new ErroCupom("Digite o código do cupom (ex.: PADA-7K3Q).");
  const hoje = diaBR();
  return sql.begin(async (tx) => {
    const [r] = await tx<{ id: string; donoId: string; titulo: string; validade: string; usadoEm: Date | null; cliente: string }[]>`
      SELECT r.id, c.dono_id, c.titulo, c.validade::text AS validade, r.usado_em, COALESCE(p.nome, us.nome) AS cliente
      FROM cupom_resgate r JOIN cupom c ON c.id = r.cupom_id JOIN usuario us ON us.id = r.usuario_id LEFT JOIN personagem p ON p.usuario_id = r.usuario_id
      WHERE r.codigo = ${codigo} FOR UPDATE OF r`;
    if (!r || r.donoId !== u.id) throw new ErroCupom("Esse código não é de um cupom da sua loja.", 404);
    if (r.usadoEm) throw new ErroCupom(`Esse cupom já foi usado em ${new Date(r.usadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`, 409);
    if (r.validade < hoje) throw new ErroCupom(`Esse cupom venceu em ${r.validade.split("-").reverse().join("/")}.`, 409);
    await tx`UPDATE cupom_resgate SET usado_em = now() WHERE id = ${r.id}`;
    return { ok: true, codigo, titulo: r.titulo, cliente: r.cliente.split(" ")[0] };
  });
}

// resultados da loja: pegos e usados no período
export async function resumoCupons(donoId: string, desde: string) {
  await migrar();
  const TZ = "America/Sao_Paulo";
  const [r] = await sql<{ pegos: number; usados: number }[]>`SELECT
      count(*) FILTER (WHERE (r.criado_em AT TIME ZONE ${TZ})::date >= ${desde}::date)::int AS pegos,
      count(*) FILTER (WHERE r.usado_em IS NOT NULL AND (r.usado_em AT TIME ZONE ${TZ})::date >= ${desde}::date)::int AS usados
    FROM cupom_resgate r JOIN cupom c ON c.id = r.cupom_id WHERE c.dono_id = ${donoId}`;
  return { pegos: r?.pegos ?? 0, usados: r?.usados ?? 0 };
}

// ---------- cupom no pedido feito pela atendente (17/11/2026) ----------
// O código é pessoal: só vale para quem pegou, na loja dele, dentro da validade, ainda não usado e com desconto em número.
// No pedido ele fica reservado (usado_em + pedido_id); se o pedido for cancelado, volta a valer.
type Tx = typeof sql;
export const normalizarCodigo = (bruto: unknown) => (typeof bruto === "string" ? bruto : "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.+)$/, "$1-$2").slice(0, 12);

// para a atendente: cupons da loja que dão desconto no pedido e os códigos que este visitante já pegou e pode usar
export async function cuponsParaPedido(donoId: string, clienteId: string) {
  await migrar();
  const hoje = diaBR();
  const rows = await sql<(DescontoCupom & { titulo: string; meu: string | null; usado: Date | null })[]>`
    SELECT c.titulo, c.desconto_pct, c.desconto_centavos, c.minimo_centavos,
      (SELECT r.codigo FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${clienteId}) AS meu,
      (SELECT r.usado_em FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${clienteId}) AS usado
    FROM cupom c WHERE c.dono_id = ${donoId} AND c.ativo AND c.validade >= ${hoje}::date AND (c.desconto_pct IS NOT NULL OR c.desconto_centavos IS NOT NULL)
    ORDER BY c.criado_em`;
  return rows.map((r) => ({ titulo: r.titulo, desconto: descontoTexto(r) ?? "", codigo: r.meu && !r.usado ? r.meu : null }));
}

export async function reservarCupomNoPedido(tx: Tx, d: { donoId: string; clienteId: string; codigo: unknown; subtotal: number; pedidoId: string }) {
  const codigo = normalizarCodigo(d.codigo);
  if (codigo.length < 6) throw new ErroCupom("Esse código de cupom não existe.");
  const hoje = diaBR();
  const [r] = await tx<(DescontoCupom & { id: string; donoId: string; usuarioId: string; ativo: boolean; validade: string; usadoEm: Date | null })[]>`
    SELECT r.id, c.dono_id, r.usuario_id, c.ativo, c.validade::text AS validade, r.usado_em, c.desconto_pct, c.desconto_centavos, c.minimo_centavos
    FROM cupom_resgate r JOIN cupom c ON c.id = r.cupom_id WHERE r.codigo = ${codigo} FOR UPDATE OF r`;
  if (!r) throw new ErroCupom(`O cupom ${codigo} não existe. Confira o código.`);
  if (r.donoId !== d.donoId) throw new ErroCupom(`O cupom ${codigo} não é desta loja.`);
  if (r.usuarioId !== d.clienteId) throw new ErroCupom(`O cupom ${codigo} é de outra pessoa: cada código vale só para quem pegou.`);
  if (r.usadoEm) throw new ErroCupom(`O cupom ${codigo} já foi usado.`);
  if (!r.ativo || r.validade < hoje) throw new ErroCupom(`O cupom ${codigo} não está mais valendo.`);
  if (!temDescontoNoPedido(r)) throw new ErroCupom(`O cupom ${codigo} é de balcão: mostre o código à loja na hora da entrega.`);
  if (r.minimoCentavos && d.subtotal < r.minimoCentavos) throw new ErroCupom(`O cupom ${codigo} vale em pedidos a partir de ${reaisBR(r.minimoCentavos)}.`);
  const desconto = calcularDesconto(r, d.subtotal);
  if (desconto >= d.subtotal) throw new ErroCupom(`O desconto do cupom ${codigo} é maior que o pedido.`);
  await tx`UPDATE cupom_resgate SET usado_em = now(), pedido_id = ${d.pedidoId} WHERE id = ${r.id}`;
  return { codigo, desconto };
}
export async function liberarCupomDoPedido(tx: Tx, pedidoId: string) {
  await tx`UPDATE cupom_resgate SET usado_em = NULL, pedido_id = NULL WHERE pedido_id = ${pedidoId}`;
}
