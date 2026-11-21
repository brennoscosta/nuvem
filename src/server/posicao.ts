// Grava a posição do prédio no terreno (21/11/2026, modo "Editar posição", office/edicaoStore.ts). Não confia no
// navegador: confere quem pede (o dono ou sócio do lote ou do quiosque; a sede, só a conta admin), refaz a conta da pose
// com o escritório gravado (data/posicaoPredio.ts: dentro do terreno com margem e a porta com caminho até a calçada) e
// só então grava escritorio.decor.giro e escritorio.decor.desloc (o resto da decoração fica como está). Sem migração.
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno, ehAdmin, ehDonoOuSocio } from "./terrenos";
import { registrar } from "./eventos";
import { ehSede } from "@/office/data/sedes";
import { ehQuiosque, QUIOSQUE_POR_CHAVE } from "@/office/data/quiosques";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { DECOR_PADRAO, limparDecor, type Escritorio } from "@/office/data/escritorio";
import { poseCrua, conferirPose, ajustarPose, giroValido, deslocValido, NOME_LADO, ladoDoVetor, estruturasDoLote, comEstrutura, conferirQuartos, giroDoMedio, nomeDoLugar, ID_PREDIO, type PedidoPose } from "@/office/data/posicaoPredio";
import { METADES, type Metade, type Quarto } from "@/office/data/quartosLote";
import type { Terreno } from "./terrenos";

export class ErroPosicao extends Error { constructor(msg: string, public status = 400) { super(msg); } }

export async function salvarPosicao(u: Usuario, chave: string, dados: unknown) {
  await migrar();
  if (!ehSede(chave) && !ehQuiosque(chave) && !LOTE_POR_CHAVE[chave]) throw new ErroPosicao("Terreno desconhecido.", 404);
  if (ehQuiosque(chave) && !QUIOSQUE_POR_CHAVE[chave]) throw new ErroPosicao("Quiosque desconhecido.", 404);
  const t = await obterTerreno(chave);
  if (!t) throw new ErroPosicao("Este terreno não tem dono.", 404);
  if (ehSede(chave)) { if (!ehAdmin(u)) throw new ErroPosicao("A posição da sede só muda pela conta admin.", 403); }
  else if (!ehDonoOuSocio(t, u.id) && !ehAdmin(u)) throw new ErroPosicao("Esse chão não é seu.", 403);
  if (t.anexoDe) throw new ErroPosicao("A posição do prédio é ajustada pelo lote principal.");
  if (t.status !== "ativo" || !t.escritorio) throw new ErroPosicao("Pague o 1º mês para posicionar o prédio.");
  // lote em quartos (21/11/2026, data/quartosLote.ts): cada estrutura (o prédio médio ou um quiosque) muda de lugar e de giro
  if (dados && typeof dados === "object" && typeof (dados as { estrutura?: unknown }).estrutura === "string") return salvarEstrutura(u, chave, t, dados as { estrutura: string; giro?: unknown; lugar?: unknown });
  const o = (dados && typeof dados === "object" ? dados : {}) as PedidoPose;
  if (![0, 1, 2, 3].includes(Number(o.giro))) throw new ErroPosicao("Giro inválido.");
  const giro = giroValido(o.giro), desloc = deslocValido(o.desloc);
  const [anexo] = await sql<{ chave: string }[]>`SELECT chave FROM terreno WHERE anexo_de = ${chave} AND status = 'ativo' LIMIT 1`;
  const pose = poseCrua({ chave, status: t.status, escritorio: t.escritorio }, anexo?.chave ?? null, { giro, desloc });
  if (!pose) throw new ErroPosicao("Não achei o prédio deste terreno.");
  const conf = conferirPose(pose);
  if (!conf.ok) throw new ErroPosicao(conf.motivo ?? "Esta posição não vale.");
  // grava só o giro e o deslocamento (a pose pode ter corrigido o giro no lote duplo), dentro da mesma transação
  const decorFinal = await sql.begin(async (db) => {
    const [r] = await db<{ escritorio: Escritorio | null }[]>`SELECT escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
    if (!r?.escritorio) throw new ErroPosicao("O escritório deste terreno sumiu. Recarregue a página.");
    // a decoração gravada (completa, com os padrões no que faltar) e só a posição nova
    const decor = { ...limparDecor(r.escritorio.decor ?? {}, DECOR_PADRAO), giro: pose.giro, desloc: pose.desloc };
    const e = { ...r.escritorio, decor };
    await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
    return decor;
  });
  void registrar("escritorio", "Posição do prédio alterada", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `Giro de ${pose.giro * 90}°, deslocamento de ${pose.desloc[0]} m e ${pose.desloc[1]} m; porta para o ${NOME_LADO[ladoDoVetor(pose.frente)]}.` } });
  return { ok: true, giro: decorFinal.giro, desloc: decorFinal.desloc };
}

// Lote em quartos: { estrutura: "predio" | "q1"…, giro, lugar } (lugar = o quarto 0 a 3 do quiosque ou a metade n, s, o, l do
// prédio médio). Encaixa no lugar (sem deslocamento fino) e confere o lote inteiro: o lugar livre e a passagem de todas
// as estruturas até a calçada. Grava decor.quartos (e o giro do prédio médio em decor.giro, como o do prédio grande).
async function salvarEstrutura(u: Usuario, chave: string, t: Terreno, o: { estrutura: string; giro?: unknown; lugar?: unknown }) {
  if (![0, 1, 2, 3].includes(Number(o.giro))) throw new ErroPosicao("Giro inválido.");
  const [anexo] = await sql<{ chave: string }[]>`SELECT chave FROM terreno WHERE anexo_de = ${chave} AND status = 'ativo' LIMIT 1`;
  if (anexo) throw new ErroPosicao("No lote duplo o prédio grande ocupa os dois terrenos: ajuste a posição dele.");
  const resultado = await sql.begin(async (db) => {
    const [r] = await db<{ escritorio: Escritorio | null }[]>`SELECT escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
    const e0 = r?.escritorio; const q = e0?.decor?.quartos;
    if (!e0 || !q) throw new ErroPosicao("Este lote não está dividido em quartos. Recarregue a página.");
    const est = estruturasDoLote(q, e0).find((s) => s.id === o.estrutura);
    if (!est) throw new ErroPosicao("Não achei essa parte do lote. Recarregue a página.", 404);
    const lugar: Quarto | Metade = est.tamanho === "medio" ? ((METADES as string[]).includes(String(o.lugar)) ? (String(o.lugar) as Metade) : est.lugar)
      : [0, 1, 2, 3].includes(Number(o.lugar)) ? (Number(o.lugar) as Quarto) : est.lugar;
    const giro = est.tamanho === "medio" ? giroDoMedio(lugar as Metade, o.giro) : giroValido(o.giro);
    const e = comEstrutura({ ...e0, decor: limparDecor(e0.decor ?? {}, DECOR_PADRAO) }, est.id, giro, lugar);
    const lc = conferirQuartos(chave, e);
    if (!lc.ok) throw new ErroPosicao(lc.motivo ?? "Esta posição não vale.");
    await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
    const p = lc.poses.find((x) => x.estrutura?.id === est.id);
    return { est, giro, lugar, frente: p ? NOME_LADO[ladoDoVetor(p.frente)] : "" };
  });
  const { est, giro, lugar, frente } = resultado;
  void registrar("escritorio", est.id === ID_PREDIO ? "Posição do prédio alterada" : "Posição do quiosque alterada", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `${est.tamanho === "medio" ? "Prédio médio na" : "Quiosque no"} ${nomeDoLugar(est.tamanho, lugar)}, giro de ${giro * 90}°${frente ? `, de frente para o ${frente}` : ""}.` } });
  return { ok: true, estrutura: est.id, giro, lugar };
}

// Troca de modelo (salvarEscritorio) e lote duplo novo: mantém o giro e, se o prédio novo não couber onde estava, leva
// para o lugar válido mais perto (o mesmo cálculo que a cena faz ao desenhar).
export function reposicionar(chave: string, e: Escritorio, anexo: string | null): Escritorio {
  const d = e.decor; if (!d) return e;
  const a = ajustarPose({ chave, status: "ativo", escritorio: e }, anexo, { giro: d.giro, desloc: d.desloc ?? [0, 0] });
  if (!a || !a.ajustada) return e;
  return { ...e, decor: { ...d, giro: a.pose.giro, desloc: a.pose.desloc } };
}
