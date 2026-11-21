// Lote extra e quiosque (20/11/2026, frente "terreno"). Cada cobrança tem três partes separadas, para a frente "creditos"
// trocar só o meio de pagamento depois:
//   1. quanto custa  -> cotacaoLoteExtra() aqui; o quiosque usa a cotacaoLote() de ofertas.ts com o preço dele;
//   2. a cobrança    -> criarCobrancaLoteExtra() / criarCobrancaQuiosque() em mercadopago.ts (hoje Pix);
//   3. o que libera  -> liberarLoteExtra() / devolverLoteExtra() aqui; o quiosque usa ativarTerreno() / reverterTerreno().
// Regra do lote extra: custa PRECO_LOTE_EXTRA por mês e vence junto com o lote principal. No dia da compra paga só os dias
// que faltam até o vencimento do principal (proporcional, nunca abaixo de MINIMO_LOTE_EXTRA); depois disso a renovação do
// principal já cobra os dois (ofertas.ts › cotacaoLote) e ativarTerreno() leva o extra junto.
import { sql, migrar } from "./db";
import { obterTerreno, ehAdmin, DIAS_MES, DIAS_TOLERANCIA, semQuartosNoDuplo, type Terreno } from "./terrenos";
import type { Usuario } from "./usuarios";
import type { Cotacao } from "./ofertas";
import { PRECO_LOTE_EXTRA, MINIMO_LOTE_EXTRA } from "@/office/data/precosTerreno";

type Db = typeof sql;
const centavos = (n: number) => Math.round(n * 100) / 100;
const DIA = 86_400_000;

export interface CotacaoLoteExtra extends Cotacao { loteExtra: { dias: number; ate: string; mensal: number; principal: string } }

// 1. Quanto custa juntar este lote (já reservado como ampliação) ao principal agora
export async function cotacaoLoteExtra(u: Usuario, anexo: Pick<Terreno, "chave" | "anexoDe" | "usuarioId" | "status">): Promise<CotacaoLoteExtra> {
  await migrar();
  if (!anexo.anexoDe) throw new Error("Este lote não é um lote extra.");
  if (anexo.status === "ativo") throw new Error("O lote extra já está pago e renova junto com o lote principal.");
  const p = await obterTerreno(anexo.anexoDe);
  if (!p || p.status !== "ativo" || !p.pagoAte) throw new Error("O lote principal precisa estar ativo para juntar o lote extra.");
  const dias = Math.max(1, Math.ceil((new Date(p.pagoAte).getTime() - Date.now()) / DIA));
  const cheio = centavos((PRECO_LOTE_EXTRA * Math.min(dias, DIAS_MES * 12)) / DIAS_MES);
  const admin = ehAdmin(u);
  let valor = Math.max(MINIMO_LOTE_EXTRA, cheio);
  if (admin) valor = Math.max(0.01, Math.round(valor) / 100); // a conta admin paga 1/100 (teste real sem gastar)
  return { base: cheio, valor, primeiroMes: null, oferta: null, creditoUsado: 0, creditoDisponivel: 0, meses: 1, admin, restamFundador: 0,
    loteExtra: { dias, ate: new Date(p.pagoAte).toISOString(), mensal: PRECO_LOTE_EXTRA, principal: p.chave } };
}

// Quantos lotes extras ativos o lote principal tem (entram na mensalidade da renovação)
export async function lotesExtrasAtivos(chave: string, db: Db = sql): Promise<number> {
  const [r] = await db<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM terreno WHERE anexo_de = ${chave} AND status = 'ativo'`;
  return r?.n ?? 0;
}

// 3. Pagamento aprovado: o lote extra fica ativo até o mesmo dia do principal. Devolve false se ele não for mais de quem pagou
// ou se o principal não estiver ativo (o pagamento vira "aprovado sem lote" e o admin devolve).
export async function liberarLoteExtra(chave: string, usuarioId: string, db: Db = sql): Promise<boolean> {
  const r = await db`UPDATE terreno a SET status = 'ativo', reservado_ate = NULL, avisado_em = NULL, atualizado_em = now(),
      inaugurado_em = COALESCE(a.inaugurado_em, now()), pago_ate = GREATEST(p.pago_ate, now() + interval '1 day')
    FROM terreno p WHERE a.chave = ${chave} AND a.usuario_id = ${usuarioId} AND p.chave = a.anexo_de AND p.status = 'ativo'`;
  if (r.count > 0) await semQuartosNoDuplo(chave, db); // lote em quartos (21/11/2026): no lote duplo vale o prédio grande
  return r.count > 0;
}
// Estorno: o lote extra sai do mapa na próxima limpeza (sem tolerância); o prédio volta ao tamanho de um lote
export async function devolverLoteExtra(chave: string, usuarioId: string, db: Db = sql) {
  await db`UPDATE terreno SET atualizado_em = now(), pago_ate = now() - make_interval(days => ${DIAS_TOLERANCIA + 1}) WHERE chave = ${chave} AND usuario_id = ${usuarioId} AND anexo_de IS NOT NULL`;
}
