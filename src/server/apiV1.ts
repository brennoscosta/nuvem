// API v1 do WorkEnd (17/11/2026, conectores): outro sistema da empresa dá tarefas para a equipe de IA e lê as entregas.
// Autenticação "Authorization: Bearer we_…" (chave criada na aba Conectores; só o hash fica no banco), limite de 60
// pedidos por hora por chave e o teto de IA do mês do lote. A tarefa roda como se o dono tivesse pedido na conversa
// (pedirComEquipe): aparece na conversa dele, a equipe divide o trabalho e a entrega fica em tarefa_api. Ao entregar,
// dispara o aviso tarefa.entregue e, se o pedido trouxe "avisar", um POST para essa URL assinado com o sha256 da chave.
import { sql, id, migrar } from "./db";
import { brl } from "./email";
import type { Usuario } from "./usuarios";
import type { AgenteDB } from "./agentes";
import { bloqueio, contar } from "./limite";
import { temIA } from "./motor";
import { pedirComEquipe } from "./delegacao";
import { ErroHttp, TETO_IA_MES, painelEquipe, empresaDoDono, agenteDoMembro, gastoDoMes } from "./equipeCliente";
import { assinar, avisar, hashChave, pedirSeguro, validarUrl } from "./conectores";

const LIMITE_HORA = 60;
export interface CtxApi { chaveId: string; hash: string; empresaId: string; usuario: Usuario; lote: string }

export async function autenticar(req: Request): Promise<CtxApi> {
  const m = /^Bearer\s+(we_[A-Za-z0-9_-]{20,80})\s*$/.exec(req.headers.get("authorization") ?? "");
  if (!m) throw new ErroHttp("Envie a chave no cabeçalho Authorization: Bearer we_…", 401);
  await migrar();
  const hash = hashChave(m[1]);
  const [c] = await sql<{ id: string; empresaId: string; usuarioId: string; lote: string }[]>`
    SELECT id, empresa_id, usuario_id, lote FROM chave_api WHERE hash = ${hash} AND revogada_em IS NULL`;
  if (!c) throw new ErroHttp("Chave inválida ou revogada.", 401);
  const lim = `api:${c.id}`, falta = bloqueio(lim, LIMITE_HORA);
  if (falta) throw new ErroHttp(`Limite de ${LIMITE_HORA} pedidos por hora desta chave. Tente de novo em ${Math.ceil(falta / 60)} min.`, 429);
  contar(lim, 60);
  const [u] = await sql<Usuario[]>`SELECT id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo FROM usuario WHERE id = ${c.usuarioId}`;
  if (!u || u.banidoEm) throw new ErroHttp("Conta indisponível.", 403);
  void sql`UPDATE chave_api SET ultimo_uso = now() WHERE id = ${c.id}`.catch(() => {});
  return { chaveId: c.id, hash, empresaId: c.empresaId, usuario: u, lote: c.lote };
}

export async function equipeApi(ctx: CtxApi) {
  const p = await painelEquipe(ctx.usuario, ctx.lote);
  return {
    empresa: p.lote.empresaNome,
    pessoas: p.equipe.map((m) => ({ id: m.membroId, nome: m.nome, cargo: m.cargo, departamento: m.setor, nivel: m.nivel, chefe: m.chefeId, comanda: p.equipe.filter((x) => x.chefeId === m.membroId).map((x) => x.membroId) })),
  };
}

export async function criarTarefaApi(ctx: CtxApi, d: { para?: unknown; texto?: unknown; avisar?: unknown }) {
  const texto = String(d.texto ?? "").trim().slice(0, 4000);
  if (!texto) throw new ErroHttp("Envie o campo texto com o que a equipe deve fazer.");
  let avisarUrl: string | null = null;
  if (d.avisar) { try { avisarUrl = validarUrl(d.avisar); } catch (e) { throw new ErroHttp(`avisar: ${(e as Error).message}`); } }
  if (!temIA()) throw new ErroHttp("A IA está desligada no servidor agora. Tente de novo mais tarde.", 503);
  const { t, empId } = await empresaDoDono(ctx.usuario, ctx.lote);
  const para = d.para ? String(d.para) : t.escritorio?.equipe.find((m) => m.papel === "ceo")?.id ?? "ceo";
  const a = await agenteDoMembro(empId, para);
  if ((await gastoDoMes(empId)) >= TETO_IA_MES) throw new ErroHttp(`A equipe já usou os ${brl(TETO_IA_MES)} de IA deste mês. Ela volta a responder no dia 1º.`, 402);
  const tid = id("tf");
  await sql`INSERT INTO tarefa_api (id, empresa_id, chave_id, membro_id, agente_id, texto, avisar) VALUES (${tid}, ${empId}, ${ctx.chaveId}, ${para}, ${a.id}, ${texto}, ${avisarUrl})`;
  void executar(tid, empId, ctx.usuario.id, a.id, texto, avisarUrl, ctx.hash);
  return { id: tid, status: "trabalhando" as const, para: { id: para, nome: a.nome } };
}

async function executar(tid: string, empId: string, usuarioId: string, agenteId: string, texto: string, avisarUrl: string | null, hash: string) {
  try {
    const [ag] = await sql<AgenteDB[]>`SELECT * FROM agente WHERE id = ${agenteId}`;
    const autor = `dono:${usuarioId}`;
    const r = await pedirComEquipe({ empId, autorDono: autor, teto: async () => ({ gasto: await gastoDoMes(empId), teto: TETO_IA_MES }) }, ag, texto);
    const [msg] = await sql<{ id: string }[]>`SELECT id FROM mensagem WHERE agente_id = ${agenteId} AND papel = 'user' AND autor = ${autor} ORDER BY criado_em DESC LIMIT 1`;
    await sql`UPDATE tarefa_api SET resposta_inicial = ${r.mensagem.conteudo}, mensagem_id = ${msg?.id ?? null} WHERE id = ${tid}`;
    const entrega = await r.fim;
    if (!entrega) throw new Error("A equipe não conseguiu terminar a tarefa.");
    await sql`UPDATE tarefa_api SET status = 'entregue', entrega = ${entrega}, entregue_em = now() WHERE id = ${tid}`;
  } catch (e) {
    await sql`UPDATE tarefa_api SET status = 'erro', erro = ${(e as Error).message.slice(0, 500)} WHERE id = ${tid}`.catch(() => {});
  }
  const tarefa = await tarefaPublica(empId, tid).catch(() => null);
  if (!tarefa) return;
  if (tarefa.status === "entregue") avisar(empId, "tarefa.entregue", { origem: "api", tarefa });
  if (avisarUrl) {
    // assinado com o sha256 da chave (o sistema que pediu tem a chave e calcula o mesmo valor)
    const corpo = JSON.stringify({ evento: tarefa.status === "entregue" ? "tarefa.entregue" : "tarefa.erro", tarefa });
    for (const ms of [0, 5_000, 30_000]) {
      if (ms) await new Promise((ok) => setTimeout(ok, ms));
      const r = await pedirSeguro(avisarUrl, { metodo: "POST", corpo, tempo: 8000, maxBytes: 4000, cabecalhos: { "x-workend-evento": "tarefa.entregue", "x-workend-assinatura": assinar(hash, corpo) } }).catch(() => null);
      if (r && r.status >= 200 && r.status < 300) break;
    }
  }
}

async function tarefaPublica(empId: string, tid: string) {
  const [t] = await sql<{ id: string; membroId: string; agenteId: string; texto: string; status: string; respostaInicial: string | null; entrega: string | null; erro: string | null; mensagemId: string | null; criadoEm: Date; entregueEm: Date | null }[]>`
    SELECT id, membro_id, agente_id, texto, status, resposta_inicial, entrega, erro, mensagem_id, criado_em, entregue_em FROM tarefa_api WHERE id = ${tid} AND empresa_id = ${empId}`;
  if (!t) return null;
  const [ag] = await sql<{ nome: string; funcao: string }[]>`SELECT nome, funcao FROM agente WHERE id = ${t.agenteId}`;
  const internas = t.mensagemId ? await sql<{ de: string; deNome: string; para: string; paraNome: string; pedido: string; resposta: string | null; status: string }[]>`
    SELECT d.config->>'membroId' AS de, d.nome AS de_nome, p.config->>'membroId' AS para, p.nome AS para_nome, c.pedido, c.resposta,
      CASE WHEN c.status = 'pedido' AND c.criado_em < now() - interval '15 minutes' THEN 'erro' ELSE c.status END AS status
    FROM conversa_interna c JOIN agente d ON d.id = c.de_agente JOIN agente p ON p.id = c.para_agente
    WHERE c.empresa_id = ${empId} AND c.origem_mensagem = ${t.mensagemId} ORDER BY c.criado_em` : [];
  return {
    id: t.id, status: t.status as "trabalhando" | "entregue" | "erro", para: { id: t.membroId, nome: ag?.nome ?? null, cargo: ag?.funcao ?? null }, texto: t.texto,
    resposta_inicial: t.respostaInicial, entrega: t.entrega, erro: t.erro, criado_em: t.criadoEm, entregue_em: t.entregueEm,
    pedidos_internos: internas.map((i) => ({ de: { id: i.de, nome: i.deNome }, para: { id: i.para, nome: i.paraNome }, pedido: i.pedido, resposta: i.resposta, status: i.status })),
  };
}
export async function obterTarefaApi(ctx: CtxApi, tid: string) {
  const t = await tarefaPublica(ctx.empresaId, String(tid ?? ""));
  if (!t) throw new ErroHttp("Tarefa não encontrada.", 404);
  return t;
}
