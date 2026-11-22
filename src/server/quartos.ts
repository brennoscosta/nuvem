// Lote em quartos (21/11/2026, pedido do dono: usar 1/4 do lote com um quiosque e CRESCER DEPOIS nos quartos livres, sem
// comprar outro lote; data/quartosLote.ts). Grava escritorio.decor.quartos depois de conferir tudo de novo no servidor:
// quem pede (o dono ou sócio; o admin), o lote (da lista, ativo, sem lote extra do lado), o modelo do prédio médio (só os
// que cabem em meio lote: data/modelos.ts › MODELOS_MEDIO) e as posições (cada estrutura no seu quarto ou na sua metade,
// com a porta ou o balcão com passagem até a calçada: data/posicaoPredio.ts › conferirQuartos). Sem migração.
// Preço: nenhum. O lote continua no preço de sempre (PRECO_LOTE, decisão do dono); pôr estrutura num quarto livre não cobra nada; trocar o
// modelo do prédio segue a regra das trocas de sempre (src/server/terrenos.ts › salvarEscritorio).
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno, ehAdmin, ehDonoOuSocio } from "./terrenos";
import { registrar } from "./eventos";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { ehSede } from "@/office/data/sedes";
import { ehQuiosque } from "@/office/data/quiosques";
import { DECOR_PADRAO, limparDecor, type Escritorio } from "@/office/data/escritorio";
import { MODELO, MODELO_INICIAL, MODELOS_MEDIO, cabeEmMeioLote, modeloDe } from "@/office/data/modelos";
import { limparQuartos, tamanhoDoLote, NOME_TAMANHO, NOME_METADE } from "@/office/data/quartosLote";
import { acomodarQuartos, conferirQuartos, comEstrutura, giroPreferido, ID_PREDIO } from "@/office/data/posicaoPredio";

export class ErroQuartos extends Error { constructor(msg: string, public status = 400) { super(msg); } }

// Confere o escritório com os quartos (aqui e no salvar do painel "Montar escritório"). Devolve o escritório com os giros
// que valem (quem chega sem giro escolhido acha a frente para a rua); lança ErroQuartos com o motivo quando não vale.
export function conferirQuartosNoServidor(chave: string, e: Escritorio, temAnexo: boolean): Escritorio {
  const q = e.decor?.quartos; if (!q) return e;
  if (ehSede(chave) || ehQuiosque(chave) || !LOTE_POR_CHAVE[chave]) throw new ErroQuartos("Só os lotes da cidade se dividem em quartos.");
  if (temAnexo) throw new ErroQuartos("No lote duplo o prédio grande ocupa os dois terrenos: os quartos não valem nele.");
  if (q.predio) {
    const m = modeloDe(e);
    if (!cabeEmMeioLote(m)) throw new ErroQuartos(`O modelo "${m ? MODELO[m].nome : "atual"}" não cabe em meio lote. Escolha um modelo médio (${MODELOS_MEDIO.map((id) => MODELO[id].nome).join(", ")}) ou o prédio grande.`);
  }
  const a = acomodarQuartos(chave, e), lc = conferirQuartos(chave, a);
  if (!lc.ok) throw new ErroQuartos(lc.motivo ?? "Essa divisão do lote não vale.");
  return a;
}

// POST /api/terrenos/[chave]/quartos { quartos } (cartão do lote: pôr mais um quiosque, pôr o prédio médio, tirar um
// quiosque, trocar tudo pelo prédio grande com quartos: null). O resto do escritório fica como está.
export async function salvarQuartos(u: Usuario, chave: string, dados: unknown) {
  await migrar();
  if (!LOTE_POR_CHAVE[chave] || ehSede(chave) || ehQuiosque(chave)) throw new ErroQuartos("Só os lotes da cidade se dividem em quartos.", 404);
  const t = await obterTerreno(chave);
  if (!t) throw new ErroQuartos("Este lote não tem dono.", 404);
  if (!ehDonoOuSocio(t, u.id) && !ehAdmin(u)) throw new ErroQuartos("Esse chão não é seu.", 403);
  if (t.anexoDe) throw new ErroQuartos("A divisão do lote é feita pelo lote principal.");
  if (t.status !== "ativo" || !t.escritorio) throw new ErroQuartos("Pague o 1º mês para usar o lote.");
  const o = (dados && typeof dados === "object" ? dados : {}) as { quartos?: unknown };
  if (o.quartos === undefined) throw new ErroQuartos("Diga como fica o lote.");
  const novo = o.quartos === null ? null : limparQuartos(o.quartos);
  const final = await sql.begin(async (db) => {
    const [r] = await db<{ escritorio: Escritorio | null }[]>`SELECT escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
    if (!r?.escritorio) throw new ErroQuartos("O escritório deste lote sumiu. Recarregue a página.");
    const [anexo] = await db<{ chave: string }[]>`SELECT chave FROM terreno WHERE anexo_de = ${chave} AND status = 'ativo' LIMIT 1`;
    if (anexo && novo) throw new ErroQuartos("No lote duplo o prédio grande ocupa os dois terrenos: os quartos não valem nele.");
    const antes = r.escritorio.decor?.quartos ?? null, tinhaPredio = !antes || !!antes.predio;
    const decor = limparDecor(r.escritorio.decor ?? {}, DECOR_PADRAO);
    if (novo) decor.quartos = novo; else delete decor.quartos;
    let e: Escritorio = { ...r.escritorio, decor };
    // o prédio médio entra num lote que só tinha quiosques: se o modelo guardado não cabe em meio lote, entra o escritório
    // básico (grátis); não conta como troca, porque não havia prédio. Num lote que já tinha prédio, quem troca o modelo é o
    // painel "Montar escritório" (com a regra das trocas)
    if (novo?.predio && !cabeEmMeioLote(modeloDe(e))) {
      if (tinhaPredio) throw new ErroQuartos("O modelo do seu prédio não cabe em meio lote. Escolha um modelo médio em Montar escritório › Prédio.");
      e = { ...e, modelo: MODELO_INICIAL, layout: MODELO[MODELO_INICIAL].base };
    }
    // o prédio médio que chega agora fica de frente para a rua que a metade dele toca (o mesmo giro que o cartão mostra)
    if (novo?.predio && !antes?.predio) e = comEstrutura(e, ID_PREDIO, giroPreferido(chave, "medio", novo.predio.metade));
    if (novo) e = conferirQuartosNoServidor(chave, e, !!anexo);
    else if (antes) {
      // de volta ao prédio grande: o giro fica e, se não couber, ele vai para o lugar válido mais perto (como numa troca)
      const { reposicionar } = await import("./posicao");
      e = reposicionar(chave, { ...e, decor: { ...decor, desloc: [0, 0] } }, null);
    }
    await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
    return e;
  });
  const q = final.decor?.quartos ?? null;
  const partes = q ? [q.predio ? `prédio médio na metade ${NOME_METADE[q.predio.metade]}` : null, q.quiosques.length ? `${q.quiosques.length} quiosque${q.quiosques.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" e ") : "prédio grande no lote inteiro";
  void registrar("escritorio", "Lote reorganizado", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `${NOME_TAMANHO[tamanhoDoLote(q)]}: ${partes}.` } });
  return { ok: true, escritorio: final };
}
