// Passaporte da cidade, cupom do passaporte, pedidos dos moradores e caça de Natal (20/11/2026, frente "visitante").
// O que vale (dados e textos em src/office/data/passaporte.ts):
//  - CARIMBO: nasce do atendimento na recepção (rotas loja/[numero]/recepcao e loja/[numero]/conversa chamam
//    aoSerAtendido). Só com personagem ativo (pago ou admin), fora da própria loja, e com a última batida de posição
//    (personagem.x/z, a cada 3 s) perto do balcão daquela loja há menos de 60 s: abrir a API por fora, de outra aba sem
//    o mapa ou de outra conta não carimba. Um por loja (chave primária) e no máximo NOVOS_CARIMBOS_DIA novos em 24 h.
//    Tudo dentro de uma transação com trava por conta: várias abas ao mesmo tempo não duplicam nada.
//  - MARCOS: o item exclusivo vai para item_comprado (a tabela de "itens na conta"; não é receita: o relatório de
//    vendas olha os pagamentos) e o marco para passaporte_marco (insígnia no perfil público). Bônus em créditos só
//    onde o marco diz (o de 6 carimbos usa BONUS_VISTO, de data/passaporte.ts: desligado, 0, na v95), uma vez por conta (chave única no extrato) e com teto global de
//    BONUS_TETO_MES por mês somando todas as contas: passou do teto, o marco dá o item e a insígnia, sem o crédito.
//  - CUPOM DO PASSAPORTE: o dono marca 1 dos cupons ativos; ele sai da lista pública da loja e só é entregue a quem tem
//    carimbo daquela loja (a recepcionista oferece no atendimento). O WorkEnd não recebe nada da venda.
//  - PEDIDOS DOS MORADORES: até 2 por dia por pessoa; o morador aponta uma loja ativa com recepção (de preferência sem
//    carimbo ainda); cumpre no atendimento da recepção dessa loja; o morador agradece na próxima conversa (+5 de afinidade).
//  - NATAL: 3 presentes por dia, iguais para todos; achar exige a batida de posição a poucos metros do presente.
import { sql, migrar, id } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin, obterTerreno, ehDonoOuSocio, type Terreno } from "./terrenos";
import { meuPersonagem, personagemAtivo, presenca } from "./personagens";
import { lancar } from "./creditos";
import { pegarCupom, descontoTexto, ErroCupom } from "./cupons";
import { buscarEmpresas } from "./equipeCliente";
import { bloqueio, contar } from "./limite";
import { chaveDaLoja, numeroDaLoja } from "@/office/data/numeroLoja";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { QUIOSQUE_POR_CHAVE, ehQuiosque, balcaoDoQuiosque } from "@/office/data/quiosques";
import { entradasDoLote } from "@/office/data/entradas";
import { posesDoTerreno } from "@/office/data/posicaoPredio";
import { epocaDeNatal } from "@/office/data/natal";
import { MORADOR_POR_ID } from "@/office/data/moradores";
import { ACESSORIO_POR_ID } from "@/office/data/acessorios";
import {
  MARCOS, MARCO_POR_ID, proximoMarco, NATAL_META, NATAL_ITEM, NATAL_POR_DIA, RAIO_PRESENTE, insigniaNatal, temporadaNatal, diaBR,
  presentesDoDia, moradoresComPedido, textoDoPedido, textoDoObrigado, hashTexto, numeroPassaporte, PEDIDOS_POR_DIA, type Marco,
} from "@/office/data/passaporte";

// ---------- limites (fáceis de mudar) ----------
export const NOVOS_CARIMBOS_DIA = 8; // carimbos novos por conta em 24 h
export const BONUS_TETO_MES = 300; // R$ de bônus do passaporte por mês, todas as contas juntas (custo máximo para o WorkEnd)
const PERTO_DO_BALCAO = 14; // m entre a última batida de posição e o ponto de espera do balcão
const BATIDA_RECENTE_S = 60;
const PERTO_DO_PRESENTE = 6; // m entre a batida (mandada logo antes) e o presente
const BATIDA_PRESENTE_S = 20;

export class ErroPassaporte extends Error { constructor(msg: string, public status = 400) { super(msg); } }
type Tx = typeof sql;

// ---------- a loja pelo número (lojas, quiosques e sedes), com o ponto do balcão ----------
// balcoes: onde a pessoa pode estar para ganhar o carimbo. A posição e o giro do prédio vêm de UMA fonte só
// (data/posicaoPredio.ts, modo "Editar posição"): a porta e o centro pela pose gravada no terreno, mais o ponto de espera
// da recepção (data/entradas.ts) e o balcão da lista de quiosques. No servidor a lista de sedes e de quiosques fica na vaga
// de sempre (a pose só é aplicada no navegador), por isso a pose entra aqui direto.
interface LojaCarimbo { t: Terreno; chave: string; numero: number; nome: string; cor: string; donoId: string; logo: string | null; balcoes: [number, number][] }
async function lojaParaCarimbo(numero: number): Promise<LojaCarimbo | null> {
  const ch = chaveDaLoja(numero); if (!ch) return null;
  let t = await obterTerreno(ch);
  if (t?.anexoDe) t = await obterTerreno(t.anexoDe);
  if (!t || t.status !== "ativo") return null;
  const cor = /^#[0-9a-fA-F]{6}$/.test(t.cor) ? t.cor : "#1D4ED8", logo = t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null;
  // quiosque: o carimbo é pela chave (quiosque-1xx); o balcão sai de data/quiosques.ts na hora (se o quiosque mudar de
  // lugar, a conferência acompanha sem mudar nada aqui)
  // lote em quartos (21/11/2026, data/quartosLote.ts): o carimbo é um por empresa e vale em qualquer estrutura do lote (o
  // prédio médio e cada quiosque, com o balcão de cada um)
  const pontosDaPose = (anexo: string | null): [number, number][] => {
    const terrenos: Record<string, Terreno> = { [t!.chave]: t! };
    return posesDoTerreno(t!.chave, terrenos, anexo ? { [t!.chave]: anexo } : {}).flatMap((pose) => [pose.porta, pose.centro]);
  };
  if (ehQuiosque(t.chave)) { const k = QUIOSQUE_POR_CHAVE[t.chave]; return { t, chave: t.chave, numero, nome: t.empresaNome, cor, donoId: t.usuarioId, logo, balcoes: [...pontosDaPose(null), ...(k ? [balcaoDoQuiosque(k)] : [])] }; }
  const [anexo] = await sql<{ chave: string }[]>`SELECT chave FROM terreno WHERE anexo_de = ${t.chave} AND status = 'ativo' LIMIT 1`;
  const es = entradasDoLote(t, anexo?.chave ?? null);
  const centro = LOTE_POR_CHAVE[t.chave]?.centro ?? null;
  const balcoes: [number, number][] = [...es.map((e) => e.espera), ...pontosDaPose(anexo?.chave ?? null)];
  if (!balcoes.length && centro) balcoes.push([centro[0], centro[1]]);
  return { t, chave: t.chave, numero, nome: t.empresaNome, cor, donoId: t.usuarioId, logo, balcoes };
}
const pertoDe = (p: { x: number; z: number; vistoEm: Date | null }, ponto: [number, number], raio: number, segundos: number) =>
  !!p.vistoEm && Date.now() - new Date(p.vistoEm).getTime() < segundos * 1000 && Math.hypot(Number(p.x) - ponto[0], Number(p.z) - ponto[1]) <= raio;

// ---------- itens, insígnias e bônus ----------
async function darItem(tx: Tx, uid: string, item: string) {
  await tx`INSERT INTO item_comprado (usuario_id, item) VALUES (${uid}, ${item}) ON CONFLICT DO NOTHING`;
}
export interface MarcoGanho { id: string; insignia: string; item: string | null; itemNome: string | null; bonus: number; semBonusPorTeto: boolean }
async function concederMarco(tx: Tx, uid: string, m: { id: string; insignia: string; item: string | null; bonus: number }): Promise<MarcoGanho | null> {
  const [ja] = await tx`SELECT 1 FROM passaporte_marco WHERE usuario_id = ${uid} AND marco = ${m.id}`;
  if (ja) return null;
  let bonus = 0, semBonusPorTeto = false;
  if (m.bonus > 0) {
    await tx`SELECT pg_advisory_xact_lock(hashtext('passaporte:bonus'))`;
    const [{ soma }] = await tx<{ soma: string }[]>`SELECT COALESCE(sum(bonus), 0) AS soma FROM passaporte_marco WHERE criado_em >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`;
    if (Number(soma) + m.bonus <= BONUS_TETO_MES) {
      const r = await lancar(tx, uid, { tipo: "bonus", comprado: 0, bonus: Math.round(m.bonus * 100), descricao: `Bônus do passaporte da cidade: ${m.insignia} (não volta em dinheiro)`, chave: `passaporte:${m.id}:${uid}` });
      if (r) bonus = m.bonus;
    } else semBonusPorTeto = true;
  }
  if (m.item) await darItem(tx, uid, m.item);
  await tx`INSERT INTO passaporte_marco (usuario_id, marco, item, bonus) VALUES (${uid}, ${m.id}, ${m.item}, ${bonus}) ON CONFLICT DO NOTHING`;
  return { id: m.id, insignia: m.insignia, item: m.item, itemNome: m.item ? ACESSORIO_POR_ID[m.item]?.nome ?? null : null, bonus, semBonusPorTeto };
}
async function marcosDoTotal(tx: Tx, uid: string, total: number) {
  const ganhos: MarcoGanho[] = [];
  for (const m of MARCOS) if (total >= m.n) { const g = await concederMarco(tx, uid, m); if (g) ganhos.push(g); }
  return ganhos;
}

// ---------- cupom do passaporte ----------
export interface CupomPassaporte { id: string; titulo: string; regra: string; validade: string; desconto: string | null; meu: string | null; usado: boolean }
export async function cupomDoPassaporte(donoId: string, uid: string | null): Promise<CupomPassaporte | null> {
  await migrar();
  const [c] = await sql<{ id: string; titulo: string; regra: string; validade: string; descontoPct: number | null; descontoCentavos: number | null; minimoCentavos: number | null; limite: number | null; pegos: number; meu: string | null; usado: Date | null }[]>`
    SELECT c.id, c.titulo, c.regra, c.validade::text AS validade, c.desconto_pct, c.desconto_centavos, c.minimo_centavos, c.limite,
      (SELECT count(*)::int FROM cupom_resgate r WHERE r.cupom_id = c.id) AS pegos,
      (SELECT r.codigo FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${uid ?? ""}) AS meu,
      (SELECT r.usado_em FROM cupom_resgate r WHERE r.cupom_id = c.id AND r.usuario_id = ${uid ?? ""}) AS usado
    FROM cupom c WHERE c.dono_id = ${donoId} AND c.passaporte AND c.ativo AND c.validade >= ${diaBR()}::date ORDER BY c.criado_em DESC LIMIT 1`;
  if (!c || (!c.meu && c.limite != null && c.pegos >= c.limite)) return null;
  return { id: c.id, titulo: c.titulo, regra: c.regra, validade: c.validade, desconto: descontoTexto(c), meu: c.meu, usado: !!c.usado };
}
// o dono escolhe qual cupom ativo é o do passaporte (null = nenhum)
export async function marcarCupomPassaporte(u: Usuario, cupomId: string | null) {
  await migrar();
  return sql.begin(async (tx) => {
    if (cupomId) {
      const [c] = await tx<{ id: string }[]>`SELECT id FROM cupom WHERE id = ${cupomId} AND dono_id = ${u.id} AND ativo AND validade >= ${diaBR()}::date`;
      if (!c) throw new ErroPassaporte("Esse cupom não está ativo na sua loja.", 404);
    }
    await tx`UPDATE cupom SET passaporte = (id = ${cupomId ?? ""}) WHERE dono_id = ${u.id} AND (passaporte OR id = ${cupomId ?? ""})`;
    return { cupomId };
  });
}
export async function cupomMarcadoDoDono(u: Usuario) {
  await migrar();
  const [c] = await sql<{ id: string }[]>`SELECT id FROM cupom WHERE dono_id = ${u.id} AND passaporte AND ativo AND validade >= ${diaBR()}::date LIMIT 1`;
  return c?.id ?? null;
}
// o visitante pega o cupom que a recepcionista ofereceu (só com carimbo daquela loja: cupons.ts › pegarCupom confere)
export async function pegarCupomDoPassaporte(u: Usuario, numero: number) {
  const loja = await lojaParaCarimbo(numero); if (!loja) throw new ErroPassaporte("Esta loja não está aberta agora.", 404);
  const c = await cupomDoPassaporte(loja.donoId, u.id); if (!c) throw new ErroPassaporte("Esta loja não tem cupom do passaporte agora.", 404);
  try { return { ...(await pegarCupom(u, c.id)), titulo: c.titulo }; }
  catch (e) { if (e instanceof ErroCupom) throw new ErroPassaporte(e.message, e.status); throw e; }
}

// ---------- o atendimento na recepção ----------
export interface ResultadoAtendimento {
  carimbo: { chave: string; nome: string; cor: string; numero: number; logo: string | null; em: string; novo: boolean } | null;
  total: number; proximo: { n: number; falta: number; insignia: string } | null; marcos: MarcoGanho[];
  cupom: CupomPassaporte | null; pedidos: { moradorId: string; morador: string }[]; limiteDoDia: boolean;
}
export async function aoSerAtendido(u: Usuario, numero: number): Promise<ResultadoAtendimento | null> {
  await migrar();
  if (u.banidoEm) return null;
  const loja = await lojaParaCarimbo(numero); if (!loja || !loja.balcoes.length) return null;
  if (ehDonoOuSocio(loja.t, u.id)) return null; // a própria loja não carimba
  const p = await meuPersonagem(u.id);
  if (!p || !personagemAtivo(p, u)) return null;
  if (!loja.balcoes.some((b) => pertoDe(p, b, PERTO_DO_BALCAO, BATIDA_RECENTE_S))) return null; // não está no balcão (API aberta por fora)
  const base = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"passaporte:" + u.id}))`;
    const [ja] = await tx<{ criadoEm: Date }[]>`SELECT criado_em FROM passaporte_carimbo WHERE usuario_id = ${u.id} AND loja_chave = ${loja.chave}`;
    let novo = false, limiteDoDia = false, em = ja?.criadoEm ?? null;
    if (!ja) {
      const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM passaporte_carimbo WHERE usuario_id = ${u.id} AND criado_em > now() - interval '24 hours'`;
      if (n < NOVOS_CARIMBOS_DIA) {
        const [r] = await tx<{ criadoEm: Date }[]>`INSERT INTO passaporte_carimbo (usuario_id, loja_chave, dono_id, empresa_nome, cor, numero) VALUES (${u.id}, ${loja.chave}, ${loja.donoId}, ${loja.nome}, ${loja.cor}, ${numero}) RETURNING criado_em`;
        novo = true; em = r.criadoEm;
      } else limiteDoDia = true;
    }
    const [{ total }] = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM passaporte_carimbo WHERE usuario_id = ${u.id}`;
    const marcos = novo ? await marcosDoTotal(tx as unknown as Tx, u.id, total) : [];
    // pedidos de morador para esta loja (de hoje ou de ontem) ficam cumpridos
    const pedidos = await tx<{ moradorId: string }[]>`UPDATE morador_pedido SET status = 'feito', feito_em = now() WHERE usuario_id = ${u.id} AND loja_chave = ${loja.chave} AND status = 'aceito' AND dia >= ${diaBR(Date.now() - 86400_000)}::date RETURNING morador_id`;
    return { novo, limiteDoDia, em, total, marcos, pedidos };
  });
  const cupom = await cupomDoPassaporte(loja.donoId, u.id).catch(() => null);
  const prox = proximoMarco(base.total);
  if (!base.novo && !base.pedidos.length && (!cupom || cupom.meu) && !base.limiteDoDia) return null; // nada de novo para mostrar
  return {
    carimbo: base.em ? { chave: loja.chave, nome: loja.nome, cor: loja.cor, numero, logo: loja.logo, em: new Date(base.em).toISOString(), novo: base.novo } : null,
    total: base.total, proximo: prox ? { n: prox.n, falta: prox.n - base.total, insignia: prox.insignia } : null, marcos: base.marcos,
    cupom, pedidos: base.pedidos.map((x) => ({ moradorId: x.moradorId, morador: MORADOR_POR_ID[x.moradorId]?.nome ?? "Um morador" })), limiteDoDia: base.limiteDoDia,
  };
}

// ---------- o passaporte (a tela) ----------
export async function meuPassaporte(u: Usuario) {
  await migrar();
  const [p, carimbos, marcos, pedidos, natal] = await Promise.all([
    meuPersonagem(u.id),
    sql<{ lojaChave: string; empresaNome: string; cor: string; numero: number | null; criadoEm: Date; temLogo: boolean | null }[]>`
      SELECT c.loja_chave, c.empresa_nome, c.cor, c.numero, c.criado_em, (t.logo IS NOT NULL) AS tem_logo
      FROM passaporte_carimbo c LEFT JOIN terreno t ON t.chave = c.loja_chave WHERE c.usuario_id = ${u.id} ORDER BY c.criado_em`,
    sql<{ marco: string; item: string | null; bonus: string; criadoEm: Date }[]>`SELECT marco, item, bonus, criado_em FROM passaporte_marco WHERE usuario_id = ${u.id} ORDER BY criado_em`,
    pedidosDeHoje(u),
    natalDoUsuario(u),
  ]);
  const ativo = !!p && personagemAtivo(p, u);
  const emitido = carimbos[0]?.criadoEm ?? p?.criadoEm ?? new Date();
  const total = carimbos.length;
  const prox = proximoMarco(total);
  const assinaturas = await sql<{ moradorId: string; empresaNome: string; feitoEm: Date }[]>`SELECT morador_id, empresa_nome, feito_em FROM morador_pedido WHERE usuario_id = ${u.id} AND status IN ('feito', 'agradecido') ORDER BY feito_em DESC LIMIT 12`;
  return {
    ativo, nome: p?.nome ?? u.nome.split(" ")[0] ?? "", boneco: p?.boneco ?? null, roupa: p?.roupa ?? null, acessorios: p?.acessorios ?? [],
    numero: numeroPassaporte(u.id), emitido: new Date(emitido).toISOString(),
    carimbos: carimbos.map((c) => ({ chave: c.lojaChave, nome: c.empresaNome, cor: c.cor, numero: c.numero, em: new Date(c.criadoEm).toISOString(), logo: c.temLogo ? `/api/terrenos/${encodeURIComponent(c.lojaChave)}/logo` : null })),
    total, proximo: prox ? { n: prox.n, falta: prox.n - total, insignia: prox.insignia } : null,
    marcos: MARCOS.map((m) => { const g = marcos.find((x) => x.marco === m.id); return { ...m, itemNome: ACESSORIO_POR_ID[m.item]?.nome ?? m.item, ganho: !!g, em: g ? new Date(g.criadoEm).toISOString() : null, bonusRecebido: g ? Number(g.bonus) : 0 }; }),
    insignias: insigniasDaLista(marcos.map((m) => m.marco)),
    pedidos, assinaturas: assinaturas.map((a) => ({ moradorId: a.moradorId, morador: MORADOR_POR_ID[a.moradorId]?.nome ?? "Morador", loja: a.empresaNome, em: new Date(a.feitoEm).toISOString() })),
    natal, limiteDia: NOVOS_CARIMBOS_DIA,
  };
}

// ---------- insígnias (perfil público e passaporte) ----------
function insigniasDaLista(ids: string[]) {
  return ids.map((idM) => {
    const m = MARCO_POR_ID[idM]; if (m) return { id: m.id, nome: m.insignia, frase: m.frase, cor: m.cor };
    const nt = /^natal-(\d{4})$/.exec(idM); if (nt) { const i = insigniaNatal(Number(nt[1])); return { id: i.id, nome: i.insignia, frase: i.frase, cor: i.cor }; }
    return null;
  }).filter((x): x is { id: string; nome: string; frase: string; cor: string } => !!x);
}
export async function insigniasDe(usuarioId: string) {
  await migrar();
  const [marcos, [{ total }]] = await Promise.all([
    sql<{ marco: string }[]>`SELECT marco FROM passaporte_marco WHERE usuario_id = ${usuarioId} ORDER BY criado_em`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM passaporte_carimbo WHERE usuario_id = ${usuarioId}`,
  ]);
  return { carimbos: total, insignias: insigniasDaLista(marcos.map((m) => m.marco)) };
}

// ---------- pedidos dos moradores ----------
type Empresa = Awaited<ReturnType<typeof buscarEmpresas>>[number];
let empresasGuardadas: { ate: number; lista: Empresa[] } | null = null;
async function empresasComRecepcao() {
  if (empresasGuardadas && empresasGuardadas.ate > Date.now()) return empresasGuardadas.lista;
  const lista = (await buscarEmpresas({}).catch(() => [] as Empresa[])).filter((e) => e.numero >= 0 && !!e.atendente);
  empresasGuardadas = { ate: Date.now() + 2 * 60_000, lista };
  return lista;
}
interface Oferta { moradorId: string; numero: number; chave: string; nome: string; texto: string }
// a loja que o morador indica hoje: ativa, com recepção, que não é da pessoa e, se der, que ela ainda não carimbou
// (nem a que o outro morador já indicou hoje). O mesmo resultado a cada consulta do dia.
async function ofertaDoMorador(u: Usuario, moradorId: string, dia: string): Promise<Oferta | null> {
  const m = MORADOR_POR_ID[moradorId]; if (!m) return null;
  const [lista, meus, ja, hoje] = await Promise.all([
    empresasComRecepcao(),
    sql<{ chave: string }[]>`SELECT chave FROM terreno WHERE usuario_id = ${u.id} OR ${u.id} = ANY(COALESCE(socios, '{}'::text[]))`.catch(() => [] as { chave: string }[]),
    sql<{ lojaChave: string }[]>`SELECT loja_chave FROM passaporte_carimbo WHERE usuario_id = ${u.id}`,
    sql<{ lojaChave: string; moradorId: string }[]>`SELECT loja_chave, morador_id FROM morador_pedido WHERE usuario_id = ${u.id} AND dia = ${dia}::date`,
  ]);
  const minhas = new Set(meus.map((x) => x.chave)), carimbadas = new Set(ja.map((x) => x.lojaChave));
  const indicadas = new Set(hoje.filter((x) => x.moradorId !== moradorId).map((x) => x.lojaChave));
  const candidatas = lista.filter((e) => !minhas.has(e.chave) && !indicadas.has(e.chave));
  if (!candidatas.length) return null;
  const nota = (e: Empresa) => (carimbadas.has(e.chave) ? 1 : 0) * 2 ** 32 + hashTexto(`${u.id}:${dia}:${moradorId}:${e.chave}`);
  const e = [...candidatas].sort((a, b) => nota(a) - nota(b))[0];
  const donoId = (await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM terreno WHERE chave = ${e.chave}`)[0]?.usuarioId;
  const cupom = donoId ? await cupomDoPassaporte(donoId, null).catch(() => null) : null;
  const sorte = (hashTexto(`${u.id}:${dia}:${moradorId}`) % 1000) / 1000;
  return { moradorId, numero: e.numero, chave: e.chave, nome: e.nome, texto: textoDoPedido(m, { nome: e.nome, nicho: e.nicho, atendente: e.atendente }, cupom?.titulo ?? null, sorte) };
}
type EstadoPedido = "disponivel" | "aceito" | "feito" | "agradecido" | "recusado";
export async function pedidosDeHoje(u: Usuario) {
  await migrar();
  const dia = diaBR();
  const quem = moradoresComPedido(u.id, dia);
  const rows = await sql<{ moradorId: string; status: EstadoPedido; empresaNome: string; numero: number | null; lojaChave: string; texto: string }[]>`
    SELECT morador_id, status, empresa_nome, numero, loja_chave, texto FROM morador_pedido WHERE usuario_id = ${u.id} AND dia = ${dia}::date`;
  return quem.map((m) => {
    const r = rows.find((x) => x.moradorId === m.id);
    return { moradorId: m.id, morador: m.nome, estado: (r?.status ?? "disponivel") as EstadoPedido, loja: r ? { nome: r.empresaNome, numero: r.numero, chave: r.lojaChave } : null, texto: r?.texto ?? null };
  });
}
// a ficha do morador: o pedido de hoje (oferta, aceito) ou o obrigado de um pedido cumprido
export async function pedidoNaFicha(u: Usuario, moradorId: string) {
  await migrar();
  const m = MORADOR_POR_ID[moradorId]; if (!m) throw new ErroPassaporte("Morador não encontrado.", 404);
  const p = await meuPersonagem(u.id);
  if (!p || !personagemAtivo(p, u)) return { estado: "sem-personagem" as const };
  // cumprido e ainda sem obrigado: agradece agora (uma vez) e a amizade sobe
  const [feito] = await sql<{ id: string; empresaNome: string }[]>`SELECT id, empresa_nome FROM morador_pedido WHERE usuario_id = ${u.id} AND morador_id = ${m.id} AND status = 'feito' ORDER BY feito_em DESC LIMIT 1`;
  if (feito) {
    const r = await sql`UPDATE morador_pedido SET status = 'agradecido', agradecido_em = now() WHERE id = ${feito.id} AND status = 'feito'`;
    if (r.count) await sql`UPDATE morador_relacao SET afinidade = LEAST(100, afinidade + 5) WHERE morador_id = ${m.id} AND usuario_id = ${u.id}`.catch(() => {});
    return { estado: "obrigado" as const, texto: textoDoObrigado(m, feito.empresaNome, p.nome.split(" ")[0] || null), loja: feito.empresaNome };
  }
  const dia = diaBR();
  const [hoje] = await sql<{ status: EstadoPedido; empresaNome: string; numero: number | null; lojaChave: string; texto: string }[]>`SELECT status, empresa_nome, numero, loja_chave, texto FROM morador_pedido WHERE usuario_id = ${u.id} AND morador_id = ${m.id} AND dia = ${dia}::date`;
  if (hoje) return { estado: hoje.status, texto: hoje.texto, loja: { nome: hoje.empresaNome, numero: hoje.numero, chave: hoje.lojaChave } };
  if (!moradoresComPedido(u.id, dia).some((x) => x.id === m.id)) return { estado: "nada" as const };
  const o = await ofertaDoMorador(u, m.id, dia);
  return o ? { estado: "oferta" as const, texto: o.texto, loja: { nome: o.nome, numero: o.numero, chave: o.chave } } : { estado: "nada" as const };
}
export async function responderPedido(u: Usuario, moradorId: string, aceitar: boolean) {
  await migrar();
  const m = MORADOR_POR_ID[moradorId]; if (!m) throw new ErroPassaporte("Morador não encontrado.", 404);
  if (u.banidoEm) throw new ErroPassaporte("Conta suspensa.", 403);
  const p = await meuPersonagem(u.id);
  if (!p || !personagemAtivo(p, u)) throw new ErroPassaporte("Crie o seu personagem (é grátis) para aceitar pedidos dos moradores.", 403);
  const dia = diaBR();
  if (!moradoresComPedido(u.id, dia).some((x) => x.id === m.id)) throw new ErroPassaporte(`${m.nome} não tem pedido para você hoje.`, 404);
  const o = await ofertaDoMorador(u, m.id, dia);
  if (!o) throw new ErroPassaporte("Hoje não tem loja para esse pedido. Volte amanhã.", 404);
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"pedido:" + u.id}))`;
    const [ja] = await tx<{ status: string }[]>`SELECT status FROM morador_pedido WHERE usuario_id = ${u.id} AND morador_id = ${m.id} AND dia = ${dia}::date`;
    if (ja) return { estado: ja.status };
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM morador_pedido WHERE usuario_id = ${u.id} AND dia = ${dia}::date AND status <> 'recusado'`;
    if (aceitar && n >= PEDIDOS_POR_DIA) throw new ErroPassaporte(`Você já pegou ${PEDIDOS_POR_DIA} pedidos hoje. Amanhã tem mais.`, 429);
    await tx`INSERT INTO morador_pedido (id, usuario_id, morador_id, dia, loja_chave, empresa_nome, numero, texto, status)
      VALUES (${id("mpd")}, ${u.id}, ${m.id}, ${dia}::date, ${o.chave}, ${o.nome}, ${o.numero}, ${o.texto}, ${aceitar ? "aceito" : "recusado"})`;
    return { estado: aceitar ? "aceito" : "recusado", loja: { nome: o.nome, numero: o.numero, chave: o.chave } };
  });
}

// ---------- caça aos presentes de Natal ----------
export async function natalDoUsuario(u: Usuario | null) {
  const ativo = epocaDeNatal();
  const temporada = temporadaNatal(), dia = diaBR();
  const presentes = ativo ? presentesDoDia(dia) : [];
  if (!u) return { ativo, temporada, meta: NATAL_META, porDia: NATAL_POR_DIA, achados: 0, hoje: presentes.map((p) => ({ ...p, achado: false })), ganhou: false, dia };
  await migrar();
  const [rows, [ganho]] = await Promise.all([
    sql<{ dia: string; idx: number }[]>`SELECT dia::text AS dia, idx FROM natal_presente WHERE usuario_id = ${u.id} AND temporada = ${temporada}`,
    sql<{ x: number }[]>`SELECT 1 AS x FROM passaporte_marco WHERE usuario_id = ${u.id} AND marco = ${`natal-${temporada}`}`,
  ]);
  return { ativo, temporada, meta: NATAL_META, porDia: NATAL_POR_DIA, achados: rows.length, hoje: presentes.map((p) => ({ ...p, achado: rows.some((r) => r.dia === dia && r.idx === p.idx) })), ganhou: !!ganho, dia };
}
export async function acharPresente(u: Usuario, d: { idx?: unknown; x?: unknown; z?: unknown; rot?: unknown }) {
  await migrar();
  if (!epocaDeNatal()) throw new ErroPassaporte("A caça aos presentes é só no Natal.", 404);
  if (u.banidoEm) throw new ErroPassaporte("Conta suspensa.", 403);
  const k = `natal:${u.id}`;
  if (bloqueio(k, 40)) throw new ErroPassaporte("Calma! Tente de novo daqui a pouco.", 429);
  contar(k, 60);
  const dia = diaBR(), temporada = temporadaNatal();
  const pr = presentesDoDia(dia).find((p) => p.idx === Number(d.idx));
  if (!pr) throw new ErroPassaporte("Esse presente não está mais aí.", 404);
  const x = Number(d.x), z = Number(d.z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x - pr.x, z - pr.z) > RAIO_PRESENTE + 0.8) throw new ErroPassaporte("Chegue mais perto do presente.", 400);
  // a posição enviada vira a batida de presença (a mesma rota do mapa); a prova é a batida anterior, já gravada, perto daqui
  const p = await meuPersonagem(u.id);
  if (!p || !personagemAtivo(p, u)) throw new ErroPassaporte("Crie o seu personagem (é grátis) para pegar presentes.", 403);
  if (!pertoDe(p, [pr.x, pr.z], PERTO_DO_PRESENTE, BATIDA_PRESENTE_S)) throw new ErroPassaporte("Chegue mais perto do presente.", 400);
  await presenca(u.id, { x, z, rot: Number(d.rot) || 0 }).catch(() => {});
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"natal:" + u.id}))`;
    const r = await tx`INSERT INTO natal_presente (usuario_id, temporada, dia, idx) VALUES (${u.id}, ${temporada}, ${dia}::date, ${pr.idx}) ON CONFLICT DO NOTHING`;
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM natal_presente WHERE usuario_id = ${u.id} AND temporada = ${temporada}`;
    let premio: MarcoGanho | null = null;
    if (n >= NATAL_META) { const i = insigniaNatal(temporada); premio = await concederMarco(tx as unknown as Tx, u.id, { id: i.id, insignia: i.insignia, item: NATAL_ITEM, bonus: 0 }); }
    return { novo: r.count > 0, achados: n, meta: NATAL_META, premio };
  });
}

// ---------- acontecendo agora (aviso discreto na cidade) ----------
let agoraGuardado: { ate: number; itens: ItemAgora[] } | null = null;
export interface ItemAgora { tipo: "evento" | "cupom" | "natal" | "loja"; texto: string; chave?: string | null; numero?: number | null }
export async function acontecendoAgora(): Promise<ItemAgora[]> {
  if (agoraGuardado && agoraGuardado.ate > Date.now()) return agoraGuardado.itens;
  await migrar();
  const itens: ItemAgora[] = [];
  const hoje = diaBR();
  const [eventos, cupons, novas] = await Promise.all([
    sql<{ titulo: string; inicio: Date; fim: Date; empresa: string | null }[]>`SELECT e.titulo, e.inicio, e.fim, (SELECT t.empresa_nome FROM terreno t WHERE t.usuario_id = e.usuario_id AND t.anexo_de IS NULL ORDER BY t.status = 'ativo' DESC LIMIT 1) AS empresa
      FROM evento_praca e WHERE NOT e.cancelado AND e.fim > now() AND e.inicio < now() + interval '12 hours' ORDER BY e.inicio LIMIT 2`.catch(() => []),
    sql<{ chave: string; empresaNome: string; titulo: string }[]>`SELECT t.chave, t.empresa_nome, c.titulo FROM cupom c JOIN terreno t ON t.usuario_id = c.dono_id AND t.anexo_de IS NULL AND t.status = 'ativo'
      WHERE c.passaporte AND c.ativo AND c.validade >= ${hoje}::date ORDER BY c.criado_em DESC LIMIT 3`.catch(() => []),
    sql<{ chave: string; empresaNome: string }[]>`SELECT chave, empresa_nome FROM terreno WHERE status = 'ativo' AND anexo_de IS NULL AND inaugurado_em > now() - interval '3 days' ORDER BY inaugurado_em DESC LIMIT 1`.catch(() => []),
  ]);
  const hora = (d: Date) => new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  for (const e of eventos) itens.push({ tipo: "evento", texto: new Date(e.inicio).getTime() <= Date.now() ? `Agora na Praça de Eventos: ${e.titulo}` : `Hoje às ${hora(e.inicio)} na Praça de Eventos: ${e.titulo}` });
  for (const c of cupons) itens.push({ tipo: "cupom", texto: `${c.empresaNome} dá ${c.titulo} para quem chega com o passaporte`, chave: c.chave, numero: numeroDaLoja({ chave: c.chave }) });
  for (const n of novas) itens.push({ tipo: "loja", texto: `Loja nova na cidade: ${n.empresaNome}`, chave: n.chave, numero: numeroDaLoja({ chave: n.chave }) });
  if (epocaDeNatal()) itens.push({ tipo: "natal", texto: `${NATAL_POR_DIA} presentes de Natal escondidos pela cidade hoje` });
  agoraGuardado = { ate: Date.now() + 30_000, itens };
  return itens;
}
export const temPassaporte = (u: Usuario | null) => !!u && !u.banidoEm;
export { ehAdmin, type Marco };
