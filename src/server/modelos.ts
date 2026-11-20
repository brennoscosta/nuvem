// Compra dos modelos de prédio do catálogo (20/11/2026, src/office/data/modelos.ts). Preço em compra única: fica com a
// empresa enquanto o lote estiver ativo (o lote que vence vai para o arquivo sem as compras: terrenos.ts › reservarTerreno).
// A COBRANÇA FICA TODA EM cobrarModelo, pelo caminho único da frente creditos (mercadopago.ts › cobrar, PRODUTOS.modelo):
// créditos, Pix ou os dois, com tipo "modelo:<id>" na tabela pagamento (sem coluna nova). Pago todo com créditos, o débito
// e o liberarModelo acontecem na mesma transação.
// Ao aprovar, liberarModelo grava a compra no escritório e já troca o prédio para o modelo comprado: a compra inclui a
// troca (não gasta troca grátis nem crédito de troca). No estorno, retirarModelo tira a compra e, se o prédio era esse,
// volta para o escritório básico.
import { sql, migrar } from "./db";
import { obterTerreno, ehAdmin } from "./terrenos";
import { criarCobrancaModelo, type CobrancaPix, type OpcoesCobranca } from "./mercadopago";
import { ehQuiosque } from "@/office/data/quiosques";
import { MODELO, MODELO_INICIAL, ehModelo, temModelo, brlModelo, type IdModelo } from "@/office/data/modelos";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { ehSede } from "@/office/data/sedes";
import type { Usuario } from "./usuarios";
import type { Escritorio } from "@/office/data/escritorio";

type Db = typeof sql;
export const TIPO_MODELO = "modelo:"; // pagamento.tipo = "modelo:<id>"
export const modeloDoTipo = (tipo: string | null | undefined): IdModelo | null => { const id = tipo?.startsWith(TIPO_MODELO) ? tipo.slice(TIPO_MODELO.length) : null; return ehModelo(id) ? id : null; };
// a conta admin paga 1/100 (teste real do Pix sem gastar), como no lote
export const precoModeloPara = (u: Usuario, id: IdModelo) => (ehAdmin(u) ? Math.round(MODELO[id].preco) / 100 : MODELO[id].preco);

export async function anexoAtivo(chave: string, db: Db = sql) {
  const [r] = await db`SELECT 1 FROM terreno WHERE anexo_de = ${chave} AND status = 'ativo' LIMIT 1`;
  return !!r;
}
// Confere tudo e cobra. É a única função que cobra um modelo.
export async function cobrarModelo(u: Usuario, chave: string, idModelo: unknown, base: string, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  if (!ehModelo(idModelo)) throw new Error("Modelo de prédio desconhecido.");
  const t = await obterTerreno(chave);
  if (!t || t.usuarioId !== u.id) throw new Error("Esse lote não é seu.");
  if (t.status !== "ativo" || !t.escritorio) throw new Error("Pague o 1º mês do lote antes de escolher o prédio.");
  if (ehSede(chave)) throw new Error("A sede usa o modelo escolhido pelo WorkEnd.");
  if (ehQuiosque(chave)) throw new Error("O quiosque tem o desenho próprio e não troca de prédio."); // frente terreno
  const m = MODELO[idModelo];
  if (m.preco <= 0) throw new Error("Esse modelo é grátis: é só escolher e salvar.");
  if (temModelo(t.escritorio, idModelo)) throw new Error("Esse modelo já é seu: é só escolher e salvar.");
  if (m.lotes === 2 && !(await anexoAtivo(chave))) throw new Error(`O modelo "${m.nome}" ocupa dois lotes: amplie o seu lote para o vizinho do lado antes.`);
  return criarCobrancaModelo(u, chave, LOTE_POR_CHAVE[chave]?.numero ?? 0, base, precoModeloPara(u, idModelo), idModelo, m.nome, opc);
}

// Pagamento aprovado: grava a compra e troca o prédio para o modelo. Só vale se o lote ainda for de quem pagou.
export async function liberarModelo(chave: string, usuarioId: string, idModelo: string, db: Db = sql) {
  await migrar();
  if (!ehModelo(idModelo)) return false;
  const [t] = await db<{ usuarioId: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
  if (!t?.escritorio || t.usuarioId !== usuarioId) return false;
  const comprados = [...new Set([...(t.escritorio.modelosComprados ?? []), idModelo])];
  const e: Escritorio = { ...t.escritorio, modelo: idModelo, layout: MODELO[idModelo].base, modelosComprados: comprados };
  await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
  return true;
}
// Estorno: tira a compra; se o prédio era esse modelo, volta para o escritório básico (grátis)
export async function retirarModelo(chave: string, usuarioId: string, idModelo: string, db: Db = sql) {
  await migrar();
  const [t] = await db<{ usuarioId: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
  if (!t?.escritorio || t.usuarioId !== usuarioId) return false;
  const comprados = (t.escritorio.modelosComprados ?? []).filter((m) => m !== idModelo);
  const voltar = t.escritorio.modelo === idModelo;
  const e: Escritorio = { ...t.escritorio, modelosComprados: comprados, ...(voltar ? { modelo: MODELO_INICIAL, layout: MODELO[MODELO_INICIAL].base } : {}) };
  await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
  return true;
}
// texto do aviso de pagamento
export const textoModeloPago = (idModelo: IdModelo | null) => (idModelo ? `O prédio "${MODELO[idModelo].nome}" já está no seu lote.` : "O seu prédio novo já está no seu lote.");
export const descricaoModelo = (idModelo: IdModelo) => `${MODELO[idModelo].nome} (${brlModelo(MODELO[idModelo].preco)})`;
