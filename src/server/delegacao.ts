// Comunicação entre os agentes da equipe (16/11/2026, pedido do dono: "preciso que eles se comuniquem entre si").
// Quem tem equipe (CEO, diretor, gerente: agentes com subordinados pela coluna chefe_id) recebe no prompt a lista da
// equipe direta e pode pedir partes da tarefa com a marcação [[PEDIR <id>: <o que precisa>]]. O servidor:
//  1. responde ao dono na hora com o que o chefe escreveu (sem as marcações) e a lista de quem foi acionado;
//  2. em segundo plano, manda cada pedido para a pessoa (que responde como "pedido do chefe"); quem também tem equipe
//     pode descer mais um nível (CEO → gerente → equipe);
//  3. o chefe junta as respostas e entrega a resposta final ao dono (nova mensagem na conversa).
// Tudo fica em conversa_interna (feed "Conversas internas", andamento da conversa, cena 3D) e em eventos
// delegou/respondeu. Limites: até 4 pedidos por nível, 2 níveis, 10 pedidos por tarefa e o teto de IA do lote.
import { sql, id, migrar } from "./db";
import { conversar } from "./motor";
import { gravarEvento, gravarMensagem, type AgenteDB, type MensagemDB } from "./agentes";
import { avisar, dadosParaAgente } from "./conectores";

export const PEDIDOS_POR_NIVEL = 4;
export const PROFUNDIDADE_MAX = 2;
export const PEDIDOS_POR_TAREFA = 10;
const MARCA = /\[\[\s*PEDIR\s+([a-zA-Z0-9_-]+)\s*:\s*([\s\S]*?)\]\]/gi;

export interface Contexto {
  empId: string;
  autorDono: string; // "dono:<usuario>"
  teto: () => Promise<{ gasto: number; teto: number }>;
  origemAgente: string; // quem recebeu o pedido do dono
  origemMensagem: string; // a mensagem do dono
  total: { n: number }; // pedidos já feitos nesta tarefa
}

// trabalhos em andamento (por agente que recebeu o pedido do dono): a conversa mostra "a equipe está trabalhando"
const g = globalThis as unknown as { __trabalhosEquipe?: Map<string, number> };
const TRABALHOS = (g.__trabalhosEquipe ??= new Map<string, number>());
export const trabalhando = (agenteId: string) => { const t = TRABALHOS.get(agenteId); return !!t && Date.now() - t < 15 * 60_000; };

const membroDe = (a: Pick<AgenteDB, "config">) => (a.config ?? {}).membroId ?? "";
const resumo = (t: string, n = 120) => { const s = t.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/[#*_`>]+/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export async function subordinadosDe(agenteId: string) {
  return sql<AgenteDB[]>`SELECT * FROM agente WHERE chefe_id = ${agenteId} AND ativo ORDER BY nivel DESC, criado_em`;
}

function instrucoes(chefe: AgenteDB, subs: AgenteDB[], restante: number) {
  return [
    "Você tem uma equipe que responde a você. Quando uma parte do pedido for trabalho de alguém da sua equipe, peça a essa pessoa em vez de fazer tudo sozinho.",
    "Sua equipe direta (use exatamente estes ids):",
    ...subs.map((s) => `- ${membroDe(s)}: ${s.nome}, ${s.funcao}`),
    "Como pedir: no fim da sua resposta, uma linha por pessoa, assim:",
    "[[PEDIR id_da_pessoa: o que você precisa dela, com o contexto que ela precisa para fazer]]",
    `Regras: no máximo ${Math.min(PEDIDOS_POR_NIVEL, restante)} pedidos; só peça a quem está na lista; não peça o que você mesmo resolve rápido; para pedidos simples, responda direto sem pedir nada.`,
    "Antes das marcações, escreva para o dono em 1 a 3 linhas o que vai fazer e a quem vai pedir cada parte. A resposta completa você entrega depois que a equipe responder.",
    `Você é ${chefe.nome}. Não escreva as respostas da equipe por ela.`,
  ].join("\n");
}

function extrair(texto: string, subs: AgenteDB[], limite: number) {
  const porMembro = new Map(subs.map((s) => [membroDe(s), s]));
  const pedidos: { sub: AgenteDB; tarefa: string }[] = [];
  for (const m of texto.matchAll(MARCA)) {
    const sub = porMembro.get(m[1]); const tarefa = m[2].trim().slice(0, 1500);
    if (!sub || !tarefa || pedidos.length >= limite) continue;
    const ja = pedidos.find((p) => p.sub.id === sub.id);
    if (ja) ja.tarefa += `\n${tarefa}`; else pedidos.push({ sub, tarefa });
  }
  const limpo = texto.replace(MARCA, "").replace(/\n{3,}/g, "\n\n").trim();
  return { limpo, pedidos };
}

async function registrar(ctx: Contexto, chefe: AgenteDB, sub: AgenteDB, tarefa: string) {
  const cid = id("ci");
  await sql`INSERT INTO conversa_interna (id, empresa_id, de_agente, para_agente, origem_agente, origem_mensagem, pedido)
    VALUES (${cid}, ${ctx.empId}, ${chefe.id}, ${sub.id}, ${ctx.origemAgente}, ${ctx.origemMensagem}, ${tarefa})`;
  await gravarEvento(ctx.empId, chefe.id, "delegou", resumo(tarefa), { de: membroDe(chefe), para: membroDe(sub), resumo: resumo(tarefa) }).catch(() => {});
  return cid;
}

// o chefe recebe o texto e talvez peça partes para a equipe. Devolve a mensagem gravada (sem marcações) e os pedidos feitos.
async function primeiraPassada(ctx: Contexto, chefe: AgenteDB, texto: string, autor: string, profundidade: number, contextoExtra?: string) {
  const subs = profundidade < PROFUNDIDADE_MAX ? await subordinadosDe(chefe.id) : [];
  const restante = PEDIDOS_POR_TAREFA - ctx.total.n;
  const comEquipe = subs.length > 0 && restante > 0;
  // conectores (17/11/2026): dados reais das fontes da empresa que esta pessoa lê (erro numa fonte não para a conversa)
  const dados = await dadosParaAgente(ctx.empId, chefe).catch(() => null);
  const contexto = [contextoExtra, dados, comEquipe ? instrucoes(chefe, subs, restante) : ""].filter(Boolean).join("\n\n");
  const r = await conversar(chefe.id, texto, autor, { modo: "dono", contexto: contexto || undefined, tetoMes: await ctx.teto(), maxTokens: profundidade === 0 ? 1600 : 1200 });
  if (!comEquipe) return { mensagem: r.mensagem, pedidos: [] as { sub: AgenteDB; tarefa: string; cid: string }[] };
  const { limpo, pedidos } = extrair(r.mensagem.conteudo, subs, Math.min(PEDIDOS_POR_NIVEL, restante));
  if (!pedidos.length) {
    if (limpo !== r.mensagem.conteudo) await sql`UPDATE mensagem SET conteudo = ${limpo || "(sem resposta)"} WHERE id = ${r.mensagem.id}`;
    return { mensagem: { ...r.mensagem, conteudo: limpo || r.mensagem.conteudo }, pedidos: [] };
  }
  ctx.total.n += pedidos.length;
  const lista = pedidos.map((p) => `- ${p.sub.nome} (${p.sub.funcao})`).join("\n");
  const texto1 = `${limpo || "Vou acionar a equipe."}\n\nPedi para:\n${lista}`;
  await sql`UPDATE mensagem SET conteudo = ${texto1} WHERE id = ${r.mensagem.id}`;
  const comId: { sub: AgenteDB; tarefa: string; cid: string }[] = [];
  for (const p of pedidos) comId.push({ ...p, cid: await registrar(ctx, chefe, p.sub, p.tarefa) });
  return { mensagem: { ...r.mensagem, conteudo: texto1 } as MensagemDB, pedidos: comId };
}

// manda cada pedido, espera as respostas (quem tem equipe desce mais um nível) e o chefe junta tudo. Devolve o texto final.
async function resolver(ctx: Contexto, chefe: AgenteDB, pedidoOriginal: string, pedidos: { sub: AgenteDB; tarefa: string; cid: string }[], profundidade: number): Promise<string> {
  const respostas = await Promise.all(pedidos.map(async (p) => {
    const texto = `Pedido de ${chefe.nome} (${chefe.funcao}), seu chefe, para uma tarefa do dono da empresa:\n\n${p.tarefa}`;
    const contexto = `Quem está pedindo agora é ${chefe.nome}, seu chefe. Entregue a sua parte pronta, direta e completa, para ${chefe.nome} juntar com o resto da equipe e levar ao dono.`;
    try {
      const pass = await primeiraPassada(ctx, p.sub, texto, `chefe:${chefe.id}`, profundidade + 1, contexto);
      const final = pass.pedidos.length ? await resolver(ctx, p.sub, p.tarefa, pass.pedidos, profundidade + 1) : pass.mensagem.conteudo;
      await sql`UPDATE conversa_interna SET resposta = ${final}, status = 'respondido', respondido_em = now() WHERE id = ${p.cid}`;
      await gravarEvento(ctx.empId, p.sub.id, "respondeu", resumo(final), { de: membroDe(p.sub), para: membroDe(chefe), resumo: resumo(final) }).catch(() => {});
      avisar(ctx.empId, "pedido_interno.respondido", { id: p.cid, de: { id: membroDe(chefe), nome: chefe.nome, cargo: chefe.funcao }, para: { id: membroDe(p.sub), nome: p.sub.nome, cargo: p.sub.funcao }, pedido: p.tarefa, resposta: final });
      return { sub: p.sub, texto: final, ok: true };
    } catch (e) {
      const msg = (e as Error).message;
      await sql`UPDATE conversa_interna SET resposta = ${msg}, status = 'erro', respondido_em = now() WHERE id = ${p.cid}`.catch(() => {});
      return { sub: p.sub, texto: `(não conseguiu responder: ${msg})`, ok: false };
    }
  }));
  const compilado = respostas.map((r) => `### ${r.sub.nome} (${r.sub.funcao})\n${r.texto}`).join("\n\n");
  try {
    const r = await conversar(chefe.id, `Respostas da sua equipe:\n\n${compilado}`, "sistema:equipe", {
      modo: "dono", tetoMes: await ctx.teto(), maxTokens: profundidade === 0 ? 2200 : 1400,
      contexto: `A sua equipe respondeu. Junte as respostas e entregue a resposta final e completa ao pedido: "${pedidoOriginal.slice(0, 1500)}". Diga quem fez cada parte quando ajudar. Não use marcações [[PEDIR]].${profundidade === 0 ? " Esta é a entrega para o DONO da empresa: escreva diretamente para ele (você), sem se dirigir ao seu chefe nem a colegas pelo nome no começo." : " Esta resposta vai para o seu chefe."}`,
    });
    return r.mensagem.conteudo.replace(MARCA, "").trim();
  } catch (e) {
    const texto = `A equipe respondeu, mas não consegui juntar tudo agora (${(e as Error).message}). Aqui estão as respostas:\n\n${compilado}`;
    await gravarMensagem({ agenteId: chefe.id, papel: "assistant", autor: `agente:${chefe.id}`, conteudo: texto });
    return texto;
  }
}

// Pedido do dono para uma pessoa da equipe. Sem equipe (ou sem pedidos), é a conversa de sempre. Com pedidos, devolve a
// primeira resposta já e continua em segundo plano até a entrega final.
export async function pedirComEquipe(ctx: Omit<Contexto, "origemAgente" | "origemMensagem" | "total">, agente: AgenteDB, pedido: string) {
  await migrar(); // a tabela conversa_interna vem da migração 0035 (a função guarda o resultado: roda uma vez por processo)
  const c: Contexto = { ...ctx, origemAgente: agente.id, origemMensagem: "", total: { n: 0 } };
  // a mensagem do dono é gravada pelo motor; para ligar as conversas internas a ela, guardamos o id depois
  const pass = await primeiraPassada(c, agente, pedido, ctx.autorDono, 0);
  // fim: a entrega final (a própria resposta quando ninguém foi acionado); a API v1 e os avisos esperam por ela
  if (!pass.pedidos.length) return { mensagem: pass.mensagem, delegados: [] as { membroId: string; nome: string; cargo: string; tarefa: string }[], fim: Promise.resolve<string | null>(pass.mensagem.conteudo) };
  const [dono] = await sql<{ id: string }[]>`SELECT id FROM mensagem WHERE agente_id = ${agente.id} AND papel = 'user' AND autor = ${ctx.autorDono} ORDER BY criado_em DESC LIMIT 1`;
  if (dono) { c.origemMensagem = dono.id; await sql`UPDATE conversa_interna SET origem_mensagem = ${dono.id} WHERE id = ANY(${sql.array(pass.pedidos.map((p) => p.cid))})`; }
  TRABALHOS.set(agente.id, Date.now());
  const fim: Promise<string | null> = resolver(c, agente, pedido, pass.pedidos, 0)
    .catch((e) => { console.error("[equipe] delegação", (e as Error).message); return null; })
    .finally(() => TRABALHOS.delete(agente.id));
  return { mensagem: pass.mensagem, delegados: pass.pedidos.map((p) => ({ membroId: membroDe(p.sub), nome: p.sub.nome, cargo: p.sub.funcao, tarefa: resumo(p.tarefa, 200) })), fim };
}

// ---------- leitura ----------
// origemMensagem/tarefa: a mensagem do dono que começou a cadeia (para agrupar os pedidos por tarefa)
export interface TrocaInterna { id: string; de: string; deNome: string; deCargo: string; para: string; paraNome: string; paraCargo: string; pedido: string; resposta: string | null; status: string; em: Date; respondidoEm: Date | null; origemAgente: string | null; origemMensagem: string | null; tarefa: string | null }
export async function trocasInternas(empId: string, opts: { agenteId?: string; limite?: number } = {}) {
  await migrar();
  const lim = Math.min(80, opts.limite ?? 40);
  const filtro = opts.agenteId ? sql`AND (c.de_agente = ${opts.agenteId} OR c.para_agente = ${opts.agenteId} OR c.origem_agente = ${opts.agenteId})` : sql``;
  const rows = await sql<{ id: string; de: string; deNome: string; deCargo: string; para: string; paraNome: string; paraCargo: string; pedido: string; resposta: string | null; status: string; criadoEm: Date; respondidoEm: Date | null; origemAgente: string | null; origemMensagem: string | null; tarefa: string | null }[]>`
    SELECT c.id, d.config->>'membroId' AS de, d.nome AS de_nome, d.funcao AS de_cargo, p.config->>'membroId' AS para, p.nome AS para_nome, p.funcao AS para_cargo,
      c.pedido, c.resposta,
      CASE WHEN c.status = 'pedido' AND c.criado_em < now() - interval '15 minutes' THEN 'erro' ELSE c.status END AS status,
      c.criado_em, c.respondido_em, c.origem_agente, c.origem_mensagem, left(om.conteudo, 300) AS tarefa
    FROM conversa_interna c JOIN agente d ON d.id = c.de_agente JOIN agente p ON p.id = c.para_agente
    LEFT JOIN mensagem om ON om.id = c.origem_mensagem
    WHERE c.empresa_id = ${empId} ${filtro}
    ORDER BY c.criado_em DESC LIMIT ${lim}`;
  return rows.map((r): TrocaInterna => ({ id: r.id, de: r.de, deNome: r.deNome, deCargo: r.deCargo, para: r.para, paraNome: r.paraNome, paraCargo: r.paraCargo, pedido: r.pedido, resposta: r.resposta, status: r.status, em: r.criadoEm, respondidoEm: r.respondidoEm, origemAgente: r.origemAgente, origemMensagem: r.origemMensagem, tarefa: r.tarefa }));
}
// atividade para a cena 3D: pedidos e respostas como trocas de uma pessoa para outra (as últimas, da mais antiga à mais nova)
export async function atividadeInterna(empId: string, limite = 30) {
  const rows = await trocasInternas(empId, { limite });
  const out: { de: string; para: string; texto: string; em: string; tipo: "pedido" | "resposta" }[] = [];
  for (const r of rows) {
    out.push({ de: r.de, para: r.para, texto: resumo(r.pedido), em: new Date(r.em).toISOString(), tipo: "pedido" });
    if (r.respondidoEm && r.resposta && r.status === "respondido") out.push({ de: r.para, para: r.de, texto: resumo(r.resposta), em: new Date(r.respondidoEm).toISOString(), tipo: "resposta" });
  }
  return out.sort((a, b) => a.em.localeCompare(b.em)).slice(-limite);
}
