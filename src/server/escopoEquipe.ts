// Quem faz o quê na equipe do cliente (20/11/2026, pedido do dono: "ele será treinado e identificado para não fazer as
// mesmas coisas dos outros"). Usa o roteamento que já existe (conversa_interna de src/server/delegacao.ts):
//  - contextoEquipeIA: o mapa da equipe (o próprio escopo e o dos colegas) que entra no prompt de toda conversa;
//  - encaminharPedido: grava o pedido para o colega certo, mas antes procura um pedido igual ou parecido ainda aberto
//    nos últimos dias; se existe, junta nele em vez de duplicar;
//  - roteiroDono / roteiroVisitante: as respostas SEM IA (sem OpenAI ou sem unidades), no jeito da personalidade do
//    agente, com o encaminhamento ("Isso é com a Fulana, do Financeiro; já passei para ela") e as frases fixas do treino.
import { sql, id } from "./db";
import { gravarEvento } from "./agentes";
import type { Escritorio, Membro } from "@/office/data/escritorio";
import { mapaDaEquipe, notasDoPedido, palavras, escopoDe } from "@/office/data/escopo";
import { PERSONALIDADE_POR_ID, falaDe } from "@/office/data/personalidades";

type Db = typeof sql;
export const DIAS_PEDIDO_ABERTO = 3;
const membroIdDe = (config: unknown) => ((config ?? {}) as { membroId?: string }).membroId ?? "";

// ---------- prompt ----------
export async function contextoEquipeIA(empId: string, agenteId: string) {
  const ags = await sql<{ id: string; nome: string; funcao: string; config: { membroId?: string; escopo?: { foco: string | null; faz: string[] }; setor?: string } | null }[]>`
    SELECT id, nome, funcao, config FROM agente WHERE empresa_id = ${empId} AND ativo ORDER BY criado_em`;
  if (ags.length < 2) return "";
  const linha = (a: (typeof ags)[number]) => { const s = a.config?.escopo; const foco = s?.foco ? ` – ${s.foco}` : ""; return `${a.nome} (${a.funcao}${foco}${a.config?.setor ? `, ${a.config.setor}` : ""}): ${(s?.faz ?? [a.funcao]).slice(0, 5).join("; ")}`; };
  const eu = ags.find((a) => a.id === agenteId);
  return [
    "Quem faz o quê nesta empresa (cada um tem o seu escopo; não faça o trabalho de um colega):",
    eu ? `- Você, ${linha(eu)}` : "",
    ...ags.filter((a) => a.id !== agenteId).map((a) => `- ${linha(a)}`),
    "Se o pedido for do escopo de um colega, não faça: diga com quem é e que já passou para essa pessoa (por exemplo: \"Isso é com a Fulana, do Financeiro; já passei para ela\"). Se puder pedir com [[PEDIR id: ...]], peça a ela.",
  ].filter(Boolean).join("\n");
}

// ---------- sem tarefa duplicada ----------
const parecidos = (a: string, b: string) => {
  const A = palavras(a), B = palavras(b); if (!A.size || !B.size) return false;
  let comum = 0; for (const w of A) if (B.has(w)) comum++;
  return comum / Math.min(A.size, B.size) >= 0.6 || comum / (A.size + B.size - comum) >= 0.5;
};
export async function pedidoAbertoParecido(empId: string, texto: string, db: Db = sql) {
  const abertos = await db<{ id: string; paraAgente: string; pedido: string; nome: string }[]>`SELECT c.id, c.para_agente, c.pedido, a.nome FROM conversa_interna c JOIN agente a ON a.id = c.para_agente
    WHERE c.empresa_id = ${empId} AND c.status = 'pedido' AND c.criado_em > now() - make_interval(days => ${DIAS_PEDIDO_ABERTO}) ORDER BY c.criado_em DESC LIMIT 60`;
  return abertos.find((c) => parecidos(c.pedido, texto)) ?? null;
}
// grava o pedido para o colega (ou junta num igual que já está aberto). Devolve o id e com quem ficou.
export async function encaminharPedido(d: { empId: string; deAgente: string; paraAgente: string; pedido: string; origemAgente?: string; origemMensagem?: string }) {
  const ja = await pedidoAbertoParecido(d.empId, d.pedido);
  if (ja) {
    await sql`UPDATE conversa_interna SET pedido = ${`${ja.pedido}\n\n(Pedido parecido juntado aqui em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}): ${d.pedido.slice(0, 800)}`} WHERE id = ${ja.id}`;
    return { cid: ja.id, juntou: true, paraAgente: ja.paraAgente, paraNome: ja.nome };
  }
  const cid = id("ci");
  await sql`INSERT INTO conversa_interna (id, empresa_id, de_agente, para_agente, origem_agente, origem_mensagem, pedido)
    VALUES (${cid}, ${d.empId}, ${d.deAgente}, ${d.paraAgente}, ${d.origemAgente ?? d.deAgente}, ${d.origemMensagem ?? ""}, ${d.pedido.slice(0, 1500)})`;
  await gravarEvento(d.empId, d.deAgente, "delegou", d.pedido.slice(0, 120), { para: d.paraAgente }).catch(() => {});
  const [p] = await sql<{ nome: string }[]>`SELECT nome FROM agente WHERE id = ${d.paraAgente}`;
  return { cid, juntou: false, paraAgente: d.paraAgente, paraNome: p?.nome ?? "" };
}

// ---------- roteiro sem IA ----------
// frases fixas do treino (regras que começam com "Saudação:", "Recado:" ou "Despedida:") valem no lugar das da personalidade
export async function frasesDoTreino(agenteId: string) {
  const regras = await sql<{ texto: string }[]>`SELECT texto FROM regra WHERE agente_id = ${agenteId} AND ativo ORDER BY criado_em DESC`;
  const pega = (r: RegExp) => regras.map((x) => r.exec(x.texto)?.[1]?.trim()).find(Boolean) ?? null;
  return { saudacao: pega(/^sauda[cç][aã]o\s*:\s*([\s\S]+)/i), recado: pega(/^recado\s*:\s*([\s\S]+)/i), despedida: pega(/^despedida\s*:\s*([\s\S]+)/i) };
}
// para quem vai o pedido: o colega com o escopo que mais bate, se bater mais que o de quem recebeu
function destino(texto: string, e: Escritorio, quem: Membro) {
  const notas = notasDoPedido(texto, e);
  const eu = notas.find((x) => x.item.id === quem.id)?.nota ?? 0;
  const melhor = notas.filter((x) => x.item.id !== quem.id).sort((a, b) => b.nota - a.nota)[0];
  return melhor && melhor.nota >= 2 && melhor.nota > eu ? melhor.item : null;
}
export async function roteiroDono(d: { empId: string; empresa: string; e: Escritorio; membro: Membro; agenteId: string; texto: string; agenteDe: (membroId: string) => string }) {
  const p = d.membro.personalidadeId ? PERSONALIDADE_POR_ID[d.membro.personalidadeId] : null;
  const para = destino(d.texto, d.e, d.membro);
  if (para) {
    const enc = await encaminharPedido({ empId: d.empId, deAgente: d.agenteId, paraAgente: d.agenteDe(para.id), pedido: d.texto });
    const fala = falaDe(p, "encaminhar", { colega: para.nome, setor: para.setor, nome: d.membro.nome, empresa: d.empresa });
    return { texto: enc.juntou ? `${fala} Já havia um pedido parecido aberto com ${enc.paraNome}: juntei os dois para não fazer em dobro.` : fala, delegado: { membroId: para.id, nome: para.nome, cargo: para.cargo, tarefa: d.texto.slice(0, 200) }, juntou: enc.juntou };
  }
  return { texto: falaDe(p, "anotar", { nome: d.membro.nome, empresa: d.empresa }), delegado: null, juntou: false };
}
// atendente: quem atende o visitante (a recepcionista ou, depois da recepção, o responsável do setor, 20/11/2026);
// recado: o recado do setor (data/recepcao.ts), no lugar do recado da personalidade (o do treino continua valendo antes)
export async function roteiroVisitante(d: { empId: string; empresa: string; e: Escritorio | null; atendente: Membro; agenteId: string; texto: string; visitante: string; agenteDe: (membroId: string) => string; recado?: string }) {
  const p = d.atendente.personalidadeId ? PERSONALIDADE_POR_ID[d.atendente.personalidadeId] : null;
  const fixas = await frasesDoTreino(d.agenteId).catch(() => ({ saudacao: null, recado: null, despedida: null }));
  const recado = fixas.recado ?? d.recado ?? falaDe(p, "recado", { nome: d.atendente.nome, empresa: d.empresa });
  const despedida = fixas.despedida ?? falaDe(p, "despedida", { nome: d.atendente.nome, empresa: d.empresa });
  const para = d.e ? destino(d.texto, d.e, d.atendente) : null;
  let inicio = "";
  if (para && d.e) {
    await encaminharPedido({ empId: d.empId, deAgente: d.agenteId, paraAgente: d.agenteDe(para.id), pedido: `Visitante ${d.visitante} na loja: ${d.texto}` }).catch(() => null);
    inicio = falaDe(p, "encaminhar", { colega: para.nome, setor: para.setor, nome: d.atendente.nome, empresa: d.empresa }) + " ";
  }
  return `${inicio}${recado}${despedida ? ` ${despedida}` : ""}`.trim();
}
export { mapaDaEquipe, escopoDe, membroIdDe };
