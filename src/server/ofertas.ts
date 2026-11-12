// Oferta de entrada e "Indique um vizinho" (12/11/2026, preços decididos pelo Claude a pedido do dono):
//  - Preço de fundador: as 10 primeiras empresas novas pagam R$ 49,90 no 1º mês.
//  - Da feira para o lote: quem já teve barraca paga na feira de sábado paga R$ 69,90 no 1º mês.
//  - Indicação: quem chega pelo link de uma empresa do mapa tem 10% no 1º mês (R$ 89,10). As ofertas não somam: vale a menor.
//  - Quem indicou ganha R$ 20 de desconto por empresa indicada que pagar (o dono não quis mês grátis). O crédito é usado
//    nas próximas mensalidades, até metade de cada pagamento; o que sobra fica para a próxima.
// Oferta de 1º mês só vale para um lote novo (reservado, não ampliação) de quem nunca teve lote. A conta admin vê e
// testa as ofertas (paga 1/100), mas não gasta as vagas de fundador.
import { randomBytes } from "node:crypto";
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { PRECO_LOTE, ADMIN_EMAIL, ehAdmin, obterTerreno } from "./terrenos";
import { avisar } from "./avisos";

export const FUNDADOR = { id: "fundador", nome: "Preço de fundador", valor: 49.9, vagas: 10 } as const;
export const FEIRA = { id: "feira", nome: "Da feira para o lote", valor: 69.9 } as const;
export const INDICADO = { id: "indicado", nome: "Indicação de um vizinho", desconto: 0.1 } as const;
export const CREDITO_INDICACAO = 20; // R$ por empresa indicada que pagou
export const TETO_CREDITO = 0.5; // o crédito cobre até metade de cada pagamento
export type IdOferta = "fundador" | "feira" | "indicado";

const centavos = (v: number) => Math.round(v * 100) / 100;
const naoAdmin = () => sql`NOT EXISTS (SELECT 1 FROM usuario x WHERE x.id = p.usuario_id AND (x.papel = 'admin' OR x.email = ${ADMIN_EMAIL}))`;

// vagas de fundador que ainda restam (conta pagos + Pix aberto na última hora; o Pix aberto do próprio comprador não conta)
export async function vagasFundador(excetoUsuario: string | null = null) {
  await migrar();
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pagamento p WHERE p.oferta = 'fundador' AND ${naoAdmin()}
    AND (p.status = 'aprovado' OR (p.status = 'pendente' AND p.criado_em > now() - interval '1 hour' AND p.usuario_id <> ${excetoUsuario ?? ""}))`;
  return Math.max(0, FUNDADOR.vagas - n);
}
// nunca teve lote: sem pagamento de lote aprovado, sem lote ativo e sem lote guardado no arquivo
async function primeiraVez(uid: string) {
  const [r] = await sql<{ ja: boolean }[]>`SELECT (EXISTS (SELECT 1 FROM pagamento WHERE usuario_id = ${uid} AND tipo = 'lote' AND status = 'aprovado')
    OR EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${uid} AND status = 'ativo') OR EXISTS (SELECT 1 FROM terreno_arquivo WHERE usuario_id = ${uid})) AS ja`;
  return !r?.ja;
}
async function teveBarraca(uid: string) { const [r] = await sql`SELECT 1 FROM barraca WHERE usuario_id = ${uid} AND status = 'paga' LIMIT 1`; return !!r; }
async function indicacaoPendente(uid: string) {
  const [r] = await sql<{ indicadorId: string; empresa: string | null }[]>`SELECT i.indicador_id, (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = i.indicador_id AND t.status = 'ativo' AND t.anexo_de IS NULL LIMIT 1) AS empresa
    FROM indicacao i WHERE i.indicado_id = ${uid} AND i.status = 'pendente'`;
  return r ?? null;
}
// crédito de indicação disponível: o que foi liberado menos o que já foi usado (pago ou com Pix aberto)
export async function creditoDisponivel(uid: string, excetoChave: string | null = null) {
  await migrar();
  const [r] = await sql<{ ganho: string; usado: string }[]>`SELECT
      COALESCE((SELECT sum(credito) FROM indicacao WHERE indicador_id = ${uid} AND status = 'liberada'), 0) AS ganho,
      COALESCE((SELECT sum(credito_usado) FROM pagamento WHERE usuario_id = ${uid} AND (status = 'aprovado' OR (status = 'pendente' AND criado_em > now() - interval '1 hour' AND terreno_chave <> ${excetoChave ?? ""}))), 0) AS usado`;
  return Math.max(0, centavos(Number(r?.ganho ?? 0) - Number(r?.usado ?? 0)));
}

export interface Cotacao { base: number; valor: number; primeiroMes: number | null; oferta: { id: IdOferta; nome: string; desconto: number; detalhe: string } | null; creditoUsado: number; creditoDisponivel: number; meses: number; admin: boolean; restamFundador: number }

// Quanto custa pagar `meses` deste lote agora, para esta conta (em reais de verdade; a conta admin paga 1/100 no fim)
export async function cotacaoLote(u: Usuario, chave: string, meses = 1): Promise<Cotacao> {
  await migrar();
  meses = Math.max(1, Math.min(12, meses | 0));
  const admin = ehAdmin(u);
  const t = await obterTerreno(chave);
  const base = PRECO_LOTE * meses;
  const novo = !!t && t.usuarioId === u.id && t.status === "reservado" && !t.anexoDe;
  const restam = await vagasFundador(u.id);
  let oferta: Cotacao["oferta"] = null;
  if (novo && (admin || (await primeiraVez(u.id)))) {
    const opcoes: NonNullable<Cotacao["oferta"]>[] = [];
    if (restam > 0) opcoes.push({ id: "fundador", nome: FUNDADOR.nome, desconto: centavos(PRECO_LOTE - FUNDADOR.valor), detalhe: `As ${FUNDADOR.vagas} primeiras empresas pagam ${FUNDADOR.valor.toFixed(2).replace(".", ",")} no 1º mês. Restam ${restam}.` });
    if (await teveBarraca(u.id)) opcoes.push({ id: "feira", nome: FEIRA.nome, desconto: centavos(PRECO_LOTE - FEIRA.valor), detalhe: "Você já teve barraca na feira de sábado." });
    const ind = admin ? null : await indicacaoPendente(u.id);
    if (ind) opcoes.push({ id: "indicado", nome: INDICADO.nome, desconto: centavos(PRECO_LOTE * INDICADO.desconto), detalhe: ind.empresa ? `Indicado por ${ind.empresa}.` : "Você chegou por indicação." });
    oferta = opcoes.sort((a, b) => b.desconto - a.desconto)[0] ?? null;
  }
  const subtotal = centavos(base - (oferta?.desconto ?? 0));
  const disp = await creditoDisponivel(u.id, chave);
  const creditoUsado = centavos(Math.min(disp, subtotal * TETO_CREDITO));
  let valor = centavos(subtotal - creditoUsado);
  if (admin) valor = Math.max(0.01, Math.round(valor) / 100);
  return { base, valor, primeiroMes: novo ? centavos(PRECO_LOTE - (oferta?.desconto ?? 0)) : null, oferta, creditoUsado, creditoDisponivel: disp, meses, admin, restamFundador: restam };
}

// ---------- indicação ----------
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export async function meuCodigo(u: Usuario) {
  await migrar();
  const [r] = await sql<{ codigo: string | null }[]>`SELECT codigo_indicacao AS codigo FROM usuario WHERE id = ${u.id}`;
  if (r?.codigo) return r.codigo;
  for (let i = 0; i < 6; i++) {
    const b = randomBytes(6); const c = Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
    const ok = await sql`UPDATE usuario SET codigo_indicacao = ${c} WHERE id = ${u.id} AND codigo_indicacao IS NULL AND NOT EXISTS (SELECT 1 FROM usuario WHERE codigo_indicacao = ${c})`;
    if (ok.count) return c;
    const [de] = await sql<{ codigo: string | null }[]>`SELECT codigo_indicacao AS codigo FROM usuario WHERE id = ${u.id}`;
    if (de?.codigo) return de.codigo;
  }
  throw new Error("Não consegui criar o seu código agora. Tente de novo.");
}
export const codigoValido = (c: unknown) => typeof c === "string" && /^[A-Z0-9]{4,10}$/i.test(c.trim());

// Liga a conta `indicadoId` a quem indicou (pelo código). Só vale para quem ainda não teve lote e uma vez por conta.
// Quem indica precisa ter lote ativo (é "um vizinho"). Devolve o nome da empresa que indicou, ou null se não valeu.
export async function registrarIndicacao(indicadoId: string, codigo: unknown): Promise<string | null> {
  if (!codigoValido(codigo)) return null;
  await migrar();
  const c = String(codigo).trim().toUpperCase();
  const [ind] = await sql<{ id: string; empresa: string | null }[]>`SELECT u.id, (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = u.id AND t.status = 'ativo' AND t.anexo_de IS NULL LIMIT 1) AS empresa
    FROM usuario u WHERE u.codigo_indicacao = ${c} AND u.banido_em IS NULL`;
  if (!ind || ind.id === indicadoId || !ind.empresa) return null;
  if (!(await primeiraVez(indicadoId))) return null;
  const r = await sql`INSERT INTO indicacao (indicado_id, indicador_id) VALUES (${indicadoId}, ${ind.id}) ON CONFLICT (indicado_id) DO NOTHING`;
  if (r.count) void avisar(ind.id, { tipo: "indicacao", ref: `indicacao:${indicadoId}`, titulo: "Uma empresa chegou pelo seu link", texto: `Quando ela pagar o 1º mês, você ganha R$ ${CREDITO_INDICACAO},00 de desconto na sua mensalidade.`, link: "/app/resultados#indicacao" });
  return ind.empresa;
}
// pagamento de lote aprovado: se quem pagou veio por indicação, libera o crédito de quem indicou
export async function liberarIndicacao(pagamentoId: string, indicadoId: string) {
  try {
    const [i] = await sql<{ indicadorId: string }[]>`UPDATE indicacao SET status = 'liberada', credito = ${CREDITO_INDICACAO}, pagamento_id = ${pagamentoId}, liberada_em = now()
      WHERE indicado_id = ${indicadoId} AND status = 'pendente' RETURNING indicador_id`;
    if (!i) return;
    const [quem] = await sql<{ empresa: string | null; nome: string }[]>`SELECT u.nome, (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = u.id AND t.anexo_de IS NULL ORDER BY t.status = 'ativo' DESC LIMIT 1) AS empresa FROM usuario u WHERE u.id = ${indicadoId}`;
    void avisar(i.indicadorId, { tipo: "indicacao", ref: `indicacao-paga:${indicadoId}`, titulo: `Você ganhou R$ ${CREDITO_INDICACAO},00 de desconto`, texto: `${quem?.empresa ?? quem?.nome ?? "A empresa que você indicou"} pagou o 1º mês. O desconto entra na sua próxima mensalidade.`, link: "/app/resultados#indicacao" });
  } catch (e) { console.error("[indicacao]", (e as Error).message); }
}
// pagamento estornado: se foi ele que liberou um crédito, o crédito sai
export async function estornarIndicacao(pagamentoId: string) {
  await sql`UPDATE indicacao SET status = 'estornada', credito = 0 WHERE pagamento_id = ${pagamentoId} AND status = 'liberada'`.catch((e) => console.error("[indicacao]", (e as Error).message));
}
export async function minhasIndicacoes(u: Usuario) {
  await migrar();
  const lista = await sql<{ status: string; credito: string; criadoEm: Date; liberadaEm: Date | null; nome: string; empresa: string | null }[]>`
    SELECT i.status, i.credito, i.criado_em, i.liberada_em, u.nome, (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = u.id AND t.anexo_de IS NULL ORDER BY t.status = 'ativo' DESC LIMIT 1) AS empresa
    FROM indicacao i JOIN usuario u ON u.id = i.indicado_id WHERE i.indicador_id = ${u.id} ORDER BY i.criado_em DESC LIMIT 50`;
  return { lista: lista.map((x) => ({ ...x, credito: Number(x.credito), nome: x.empresa ?? x.nome.split(" ")[0] })), credito: await creditoDisponivel(u.id) };
}
