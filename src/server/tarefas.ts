// Tarefas reais dos agentes. Primeira função: "publicar_video" (YouTube agora; Instagram e TikTok depois).
// Fluxo: dono envia vídeo + legenda → agente planeja (título, descrição, tags) → dono aprova → agente executa → resultado no painel e no mural.
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { sql, id, migrar } from "./db";
import { EMPRESA_PADRAO, fichaCompleta, gravarEvento, registrarUso, salvarFalaPublica } from "./agentes";
import { montarSistema, custoBRL, temIA } from "./motor";
import { gravarMural } from "./mural";
import { publicarNoYouTube } from "./youtube";

export const DIR_UPLOADS = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
export type StatusTarefa = "planejando" | "aguardando_aprovacao" | "executando" | "concluida" | "falhou" | "cancelada";
export interface Tarefa { id: string; agenteId: string; tipo: string; status: StatusTarefa; titulo: string; dados: Record<string, unknown>; plano: Record<string, unknown> | null; resultado: Record<string, unknown> | null; erro: string | null; criadoEm: Date; atualizadoEm: Date }
export interface Arquivo { id: string; nome: string; mime: string; tamanho: number; caminho: string; criadoEm: Date }
export interface PlanoPublicacao { titulo: string; descricao: string; tags: string[]; resumo: string; plataformas: string[]; privacidade: "public" | "unlisted" | "private" }

// ---- arquivos ----
export async function salvarArquivo(f: File) {
  await migrar();
  fs.mkdirSync(DIR_UPLOADS, { recursive: true });
  const ext = path.extname(f.name).toLowerCase() || ".bin";
  const aid = id("arq");
  const caminho = path.join(DIR_UPLOADS, aid + ext);
  fs.writeFileSync(caminho, Buffer.from(await f.arrayBuffer()));
  const [r] = await sql<Arquivo[]>`INSERT INTO arquivo (id, empresa_id, nome, mime, tamanho, caminho) VALUES (${aid}, ${EMPRESA_PADRAO.id}, ${f.name}, ${f.type || "application/octet-stream"}, ${f.size}, ${caminho}) RETURNING id, nome, mime, tamanho, caminho, criado_em`;
  return r;
}
export async function obterArquivo(aid: string) {
  const [r] = await sql<Arquivo[]>`SELECT id, nome, mime, tamanho, caminho, criado_em FROM arquivo WHERE id = ${aid} AND empresa_id = ${EMPRESA_PADRAO.id}`;
  return r ?? null;
}

// ---- tarefas ----
export async function listarTarefas(agenteId: string, limite = 30) {
  await migrar();
  return sql<Tarefa[]>`SELECT id, agente_id, tipo, status, titulo, dados, plano, resultado, erro, criado_em, atualizado_em FROM tarefa WHERE agente_id = ${agenteId} ORDER BY criado_em DESC LIMIT ${limite}`;
}
export async function obterTarefa(tid: string) {
  const [t] = await sql<Tarefa[]>`SELECT id, agente_id, tipo, status, titulo, dados, plano, resultado, erro, criado_em, atualizado_em FROM tarefa WHERE id = ${tid}`;
  return t ?? null;
}
async function atualizar(tid: string, campos: { status?: StatusTarefa; plano?: unknown; resultado?: unknown; erro?: string | null; titulo?: string }) {
  const t = await obterTarefa(tid); if (!t) throw new Error("Tarefa não encontrada");
  await sql`UPDATE tarefa SET status = ${campos.status ?? t.status}, plano = ${campos.plano !== undefined ? sql.json(campos.plano as never) : (t.plano ? sql.json(t.plano as never) : null)},
    resultado = ${campos.resultado !== undefined ? sql.json(campos.resultado as never) : (t.resultado ? sql.json(t.resultado as never) : null)},
    erro = ${campos.erro !== undefined ? campos.erro : t.erro}, titulo = ${campos.titulo ?? t.titulo}, atualizado_em = now() WHERE id = ${tid}`;
  return (await obterTarefa(tid))!;
}
export async function cancelarTarefa(tid: string) { return atualizar(tid, { status: "cancelada" }); }

// 1) Criar a tarefa de publicação: grava, avisa a cena e pede o plano ao agente.
export async function criarPublicacao(agenteId: string, d: { arquivoId: string; legenda: string; titulo?: string; plataformas: string[]; privacidade?: PlanoPublicacao["privacidade"] }) {
  await migrar();
  const f = await fichaCompleta(agenteId); if (!f) throw new Error("Agente não encontrado");
  const arq = await obterArquivo(d.arquivoId); if (!arq) throw new Error("Arquivo não encontrado");
  const tid = id("tar");
  const dados = { arquivoId: arq.id, arquivoNome: arq.nome, legenda: d.legenda, titulo: d.titulo ?? "", plataformas: d.plataformas, privacidade: d.privacidade ?? "public" };
  await sql`INSERT INTO tarefa (id, empresa_id, agente_id, tipo, status, titulo, dados) VALUES (${tid}, ${EMPRESA_PADRAO.id}, ${agenteId}, 'publicar_video', 'planejando', ${d.titulo || "Publicar vídeo"}, ${sql.json(dados as never)})`;
  await gravarEvento(f.agente.empresaId, agenteId, "tarefa_recebida", "Recebi um vídeo pra publicar, vou preparar.");
  await gravarMural({ autorTipo: "sistema", autorNome: f.agente.nome, agenteId, texto: `Recebeu um vídeo pra publicar em ${d.plataformas.join(", ")}.` });
  try {
    const plano = await planejarPublicacao(f, dados);
    await gravarEvento(f.agente.empresaId, agenteId, "planejando", "Plano de publicação pronto, aguardando o ok do dono.");
    return atualizar(tid, { status: "aguardando_aprovacao", plano, titulo: plano.titulo });
  } catch (e) {
    await gravarEvento(f.agente.empresaId, agenteId, "bloqueado", "Não consegui montar o plano de publicação.");
    return atualizar(tid, { status: "falhou", erro: (e as Error).message });
  }
}

// 2) O agente pensa: título, descrição, tags e resumo do que vai fazer (JSON).
async function planejarPublicacao(f: Awaited<ReturnType<typeof fichaCompleta>> & object, dados: { legenda: string; titulo: string; plataformas: string[]; privacidade: string; arquivoNome: string }): Promise<PlanoPublicacao> {
  const base: PlanoPublicacao = {
    titulo: (dados.titulo || dados.legenda.split("\n")[0] || "Novo vídeo").slice(0, 100),
    descricao: dados.legenda, tags: [], resumo: "Vou publicar o vídeo com a legenda enviada.",
    plataformas: dados.plataformas, privacidade: dados.privacidade as PlanoPublicacao["privacidade"],
  };
  if (!temIA()) return base;
  const cli = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const modelo = f.agente.modelo;
  const r = await cli.chat.completions.create({
    model: modelo, temperature: 0.4, max_completion_tokens: 700, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: montarSistema(f) },
      { role: "user", content: `Tarefa real: publicar um vídeo nas redes (${dados.plataformas.join(", ")}). Arquivo: ${dados.arquivoNome}.
O dono enviou esta legenda (é a mensagem principal; mantenha o sentido, corrija só erros claros):
"""
${dados.legenda}
"""
${dados.titulo ? `Título sugerido pelo dono: "${dados.titulo}" (use como base).` : "O dono não deu título: crie um, curto e chamativo, a partir da legenda."}

Responda SÓ um JSON com: {"titulo": string (máx. 90 caracteres, sem aspas), "descricao": string (legenda final pro YouTube; pode acrescentar no fim até 5 hashtags relevantes), "tags": string[] (até 12 palavras-chave), "resumo": string (1 frase, em primeira pessoa, dizendo o que você vai fazer, pro dono aprovar)}` },
    ],
  });
  const tin = r.usage?.prompt_tokens ?? 0, tout = r.usage?.completion_tokens ?? 0;
  await registrarUso({ agenteId: f.agente.id, modelo, tokensIn: tin, tokensOut: tout, custoBrl: custoBRL(modelo, tin, tout) });
  try {
    const j = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    return { ...base, titulo: String(j.titulo || base.titulo).slice(0, 100), descricao: String(j.descricao || base.descricao).slice(0, 5000), tags: Array.isArray(j.tags) ? j.tags.map(String).slice(0, 12) : [], resumo: String(j.resumo || base.resumo) };
  } catch { return base; }
}

// 3) Dono aprovou (podendo editar título/descrição): executa de verdade.
export async function executarPublicacao(tid: string, ajustes?: Partial<Pick<PlanoPublicacao, "titulo" | "descricao" | "privacidade">>) {
  const t = await obterTarefa(tid); if (!t) throw new Error("Tarefa não encontrada");
  if (!["aguardando_aprovacao", "falhou"].includes(t.status)) throw new Error(`Tarefa não está aguardando aprovação (status: ${t.status}).`);
  const f = await fichaCompleta(t.agenteId); if (!f) throw new Error("Agente não encontrado");
  const plano = { ...(t.plano as unknown as PlanoPublicacao), ...(ajustes ?? {}) };
  const arq = await obterArquivo(String(t.dados.arquivoId)); if (!arq || !fs.existsSync(arq.caminho)) throw new Error("O arquivo do vídeo não está mais no servidor (ele é apagado em novos deploys). Envie de novo.");
  await atualizar(tid, { status: "executando", plano, erro: null });
  await gravarEvento(f.agente.empresaId, t.agenteId, "trabalhando", "Publicando o vídeo agora.");
  const resultado: Record<string, unknown> = {};
  const erros: string[] = [];
  for (const p of plano.plataformas) {
    try {
      if (p === "youtube") resultado.youtube = await publicarNoYouTube({ caminho: arq.caminho, mime: arq.mime, tamanho: arq.tamanho, titulo: plano.titulo, descricao: plano.descricao, tags: plano.tags, privacidade: plano.privacidade });
      else erros.push(`${p}: ainda não integrado`);
    } catch (e) { erros.push(`${p}: ${(e as Error).message}`); }
  }
  const okPlat = Object.keys(resultado);
  if (okPlat.length) {
    const links = okPlat.map((p) => `${p}: ${(resultado[p] as { url: string }).url}`).join(" · ");
    const fala = "Acabei de publicar um vídeo novo 🎬";
    await salvarFalaPublica(t.agenteId, fala);
    await gravarEvento(f.agente.empresaId, t.agenteId, "aprovado", fala, { links });
    await gravarMural({ autorTipo: "agente", autorNome: f.agente.nome, agenteId: t.agenteId, texto: `Publiquei "${plano.titulo}" — ${links}${erros.length ? ` (pendente: ${erros.join("; ")})` : ""}`, publico: `${f.agente.nome} publicou um vídeo novo 🎬` });
  } else {
    await gravarEvento(f.agente.empresaId, t.agenteId, "bloqueado", "A publicação falhou, preciso de ajuda do dono.");
  }
  return atualizar(tid, { status: okPlat.length ? "concluida" : "falhou", resultado: { ...resultado, pendentes: erros }, erro: okPlat.length ? null : erros.join("; ") });
}
