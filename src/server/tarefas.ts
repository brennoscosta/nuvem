// Tarefas reais dos agentes.
// - "publicar_video" (CEO): dono envia vídeo + legenda → agente planeja (título, descrição, tags) → dono aprova → publica no YouTube/Instagram/TikTok.
// - "criar_arte" (gerente de Design gráfico): dono envia briefing (+ referências) → agente escreve o prompt → dono aprova → gpt-image-2 gera a arte.
// - "arquivo_recebido": uma arte encaminhada de outro setor (manual ou pela ação automática "ao concluir").
// Fluxo comum: a tarefa chega sempre pelo gerente do setor (ou CEO); cada agente pode ter várias tarefas em paralelo.
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { sql, id, migrar } from "./db";
import { EMPRESA_PADRAO, fichaCompleta, gravarEvento, registrarUso, salvarFalaPublica, gastoHoje } from "./agentes";
import { montarSistema, custoBRL, temIA } from "./motor";
import { gravarMural } from "./mural";
import { publicarNoYouTube } from "./youtube";
import { publicarNoInstagram } from "./instagram";
import { publicarNoTikTok } from "./tiktok";
import { gerarImagem, custoImagemBRL, FORMATOS, type Formato } from "./imagens";
import { AREAS, type AreaId } from "@/office/data/org";

export const DIR_UPLOADS = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
export type StatusTarefa = "planejando" | "aguardando_aprovacao" | "executando" | "concluida" | "falhou" | "cancelada" | "recebida";
export interface Tarefa { id: string; agenteId: string; tipo: string; status: StatusTarefa; titulo: string; dados: Record<string, unknown>; plano: Record<string, unknown> | null; resultado: Record<string, unknown> | null; erro: string | null; criadoEm: Date; atualizadoEm: Date }
export interface Arquivo { id: string; nome: string; mime: string; tamanho: number; caminho: string; criadoEm: Date }
export interface PlanoArte { prompt: string; resumo: string; formato: Formato; titulo: string }
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
export async function obterArquivos(ids: string[]) {
  if (!ids.length) return [] as Arquivo[];
  return sql<Arquivo[]>`SELECT id, nome, mime, tamanho, caminho, criado_em FROM arquivo WHERE id IN ${sql(ids)} AND empresa_id = ${EMPRESA_PADRAO.id}`;
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
export async function executarPublicacao(tid: string, baseUrl: string, ajustes?: Partial<Pick<PlanoPublicacao, "titulo" | "descricao" | "privacidade">>) {
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
      if (p === "youtube") resultado.youtube = await publicarNoYouTube({ caminho: arq.caminho, mime: arq.mime, tamanho: Number(arq.tamanho), titulo: plano.titulo, descricao: plano.descricao, tags: plano.tags, privacidade: plano.privacidade });
      else if (p === "instagram") resultado.instagram = await publicarNoInstagram({ videoUrl: `${baseUrl}/api/arquivos/${arq.id}/raw`, legenda: plano.descricao });
      else if (p === "tiktok") { const r = await publicarNoTikTok({ caminho: arq.caminho, tamanho: Number(arq.tamanho), titulo: plano.descricao, publico: plano.privacidade === "public" }); resultado.tiktok = r; if (r.aviso) erros.push(`tiktok: ${r.aviso}`); }
      else erros.push(`${p}: ainda não integrado`);
    } catch (e) { erros.push(`${p}: ${(e as Error).message}`); }
  }
  const okPlat = Object.keys(resultado);
  if (okPlat.length) {
    const links = okPlat.map((p) => `${p}: ${(resultado[p] as { url: string }).url}`).join(" · ");
    const redes = okPlat.map((p) => ({ youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" }[p] ?? p)).join(", ");
    const fala = `Acabei de publicar um vídeo novo no ${redes} 🎬`;
    await salvarFalaPublica(t.agenteId, fala);
    await gravarEvento(f.agente.empresaId, t.agenteId, "aprovado", fala, { links });
    await gravarMural({ autorTipo: "agente", autorNome: f.agente.nome, agenteId: t.agenteId, texto: `Publiquei "${plano.titulo}" — ${links}${erros.length ? ` (pendente: ${erros.join("; ")})` : ""}`, publico: `${f.agente.nome} publicou um vídeo novo 🎬` });
  } else {
    await gravarEvento(f.agente.empresaId, t.agenteId, "bloqueado", "A publicação falhou, preciso de ajuda do dono.");
  }
  return atualizar(tid, { status: okPlat.length ? "concluida" : "falhou", resultado: { ...resultado, pendentes: erros }, erro: okPlat.length ? null : erros.join("; ") });
}

// ======================== Criar arte (Design gráfico, gpt-image-2) ========================

// 1) Dono entrega o briefing ao gerente de Design gráfico (+ imagens de referência opcionais).
export async function criarArte(agenteId: string, d: { briefing: string; formato: Formato; referenciaIds?: string[]; titulo?: string }) {
  await migrar();
  const f = await fichaCompleta(agenteId); if (!f) throw new Error("Agente não encontrado");
  const refs = await obterArquivos(d.referenciaIds ?? []);
  const tid = id("tar");
  const titulo = (d.titulo || d.briefing.split("\n")[0] || "Nova arte").slice(0, 80);
  const dados = { briefing: d.briefing, formato: d.formato, referenciaIds: refs.map((r) => r.id), referenciaNomes: refs.map((r) => r.nome), titulo };
  await sql`INSERT INTO tarefa (id, empresa_id, agente_id, tipo, status, titulo, dados) VALUES (${tid}, ${EMPRESA_PADRAO.id}, ${agenteId}, 'criar_arte', 'planejando', ${titulo}, ${sql.json(dados as never)})`;
  await gravarEvento(f.agente.empresaId, agenteId, "tarefa_recebida", "Recebi um briefing de arte, vou pensar na peça.");
  await gravarMural({ autorTipo: "sistema", autorNome: f.agente.nome, agenteId, texto: `Recebeu um briefing de arte: "${titulo}".` });
  try {
    const plano = await planejarArte(f, dados);
    await gravarEvento(f.agente.empresaId, agenteId, "planejando", "Prompt da arte pronto, aguardando o ok do dono.");
    return atualizar(tid, { status: "aguardando_aprovacao", plano, titulo: plano.titulo });
  } catch (e) {
    await gravarEvento(f.agente.empresaId, agenteId, "bloqueado", "Não consegui montar o prompt da arte.");
    return atualizar(tid, { status: "falhou", erro: (e as Error).message });
  }
}

// 2) O agente escreve o prompt da imagem (o que o dono aprova antes de gastar com a geração).
async function planejarArte(f: Awaited<ReturnType<typeof fichaCompleta>> & object, dados: { briefing: string; formato: Formato; referenciaNomes: string[]; titulo: string }): Promise<PlanoArte> {
  const base: PlanoArte = { prompt: dados.briefing, resumo: "Vou gerar a arte a partir do briefing, do jeito que você escreveu.", formato: dados.formato, titulo: dados.titulo };
  if (!temIA()) return base;
  const cli = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const modelo = f.agente.modelo;
  const r = await cli.chat.completions.create({
    model: modelo, temperature: 0.5, max_completion_tokens: 900, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: montarSistema(f) },
      { role: "user", content: `Tarefa real: criar UMA arte (imagem) com o gerador de imagens da empresa (gpt-image-2). Formato: ${FORMATOS[dados.formato].nome} (${FORMATOS[dados.formato].size}).
${dados.referenciaNomes.length ? `O dono anexou ${dados.referenciaNomes.length} imagem(ns) de referência (${dados.referenciaNomes.join(", ")}): a arte deve ser feita EM CIMA delas (manter logo, produto, pessoa ou identidade visual que aparecer).` : "Sem imagem de referência: a arte é criada do zero."}
Briefing do dono:
"""
${dados.briefing}
"""
Escreva o prompt como um designer sênior escreveria pra um gerador de imagens: descreva composição, assunto, estilo, paleta, iluminação, tipografia (se houver texto, diga exatamente o texto entre aspas e peça que seja legível e sem erros de ortografia), enquadramento adequado ao formato e o que evitar. Em português está ótimo. Não invente marcas de terceiros.

Responda SÓ um JSON com: {"titulo": string (nome curto da peça, máx. 60 caracteres), "prompt": string (o prompt completo, 60 a 200 palavras), "resumo": string (1 frase, em primeira pessoa, dizendo o que você vai gerar, pro dono aprovar)}` },
    ],
  });
  const tin = r.usage?.prompt_tokens ?? 0, tout = r.usage?.completion_tokens ?? 0;
  await registrarUso({ agenteId: f.agente.id, modelo, tokensIn: tin, tokensOut: tout, custoBrl: custoBRL(modelo, tin, tout) });
  try {
    const j = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    return { ...base, titulo: String(j.titulo || base.titulo).slice(0, 80), prompt: String(j.prompt || base.prompt).slice(0, 4000), resumo: String(j.resumo || base.resumo) };
  } catch { return base; }
}

// 3) Dono aprovou (podendo ajustar o prompt): gera a imagem de verdade, salva e avisa a cena.
export async function executarArte(tid: string, baseUrl: string, ajustes?: Partial<Pick<PlanoArte, "prompt" | "titulo">>) {
  const t = await obterTarefa(tid); if (!t) throw new Error("Tarefa não encontrada");
  if (!["aguardando_aprovacao", "falhou"].includes(t.status)) throw new Error(`Tarefa não está aguardando aprovação (status: ${t.status}).`);
  const f = await fichaCompleta(t.agenteId); if (!f) throw new Error("Agente não encontrado");
  const plano = { ...(t.plano as unknown as PlanoArte), ...(ajustes ?? {}) };
  if (!plano.prompt?.trim()) throw new Error("Prompt vazio.");
  const custoPrevisto = custoImagemBRL(plano.formato ?? "quadrado");
  const gasto = await gastoHoje(t.agenteId);
  if (gasto + custoPrevisto > Number(f.agente.tetoDiarioBrl)) throw new Error(`Teto diário do agente atingido (R$ ${gasto.toFixed(2)} de R$ ${Number(f.agente.tetoDiarioBrl).toFixed(2)}). Aumente o teto no Perfil ou tente amanhã.`);
  await atualizar(tid, { status: "executando", plano, erro: null });
  await gravarEvento(f.agente.empresaId, t.agenteId, "trabalhando", "Gerando a arte agora.");
  try {
    const refs = await obterArquivos((t.dados.referenciaIds as string[]) ?? []);
    const { arquivo, custoBrl } = await gerarImagem({ agenteId: t.agenteId, prompt: plano.prompt, formato: plano.formato ?? "quadrado", referencias: refs, nome: plano.titulo });
    const url = `${baseUrl}/api/arquivos/${arquivo.id}/raw`;
    const resultado = { arquivoId: arquivo.id, arquivoNome: arquivo.nome, url, custoBrl, modelo: "gpt-image-2", formato: plano.formato };
    const fala = `Terminei a arte "${plano.titulo}" 🎨`;
    await salvarFalaPublica(t.agenteId, fala);
    await gravarEvento(f.agente.empresaId, t.agenteId, "concluido", `Arte pronta: ${plano.titulo}`, { tarefaId: tid, url });
    await gravarMural({ autorTipo: "agente", autorNome: f.agente.nome, agenteId: t.agenteId, texto: `Arte "${plano.titulo}" pronta (R$ ${custoBrl.toFixed(2)}).`, publico: `${f.agente.nome} terminou uma arte nova 🎨` });
    const tarefa = await atualizar(tid, { status: "concluida", resultado });
    // ação automática configurada no agente: encaminhar pro gerente de outro setor
    const destino = f.agente.config?.aoConcluir?.encaminharPara;
    if (destino && AREAS[destino as AreaId]) {
      try { await encaminharTarefa(tid, destino as AreaId, `Encaminhado automaticamente por ${f.agente.nome} (ação configurada: ao concluir uma arte).`); }
      catch (e) { await gravarMural({ autorTipo: "sistema", autorNome: f.agente.nome, agenteId: t.agenteId, texto: `Não consegui encaminhar pra ${AREAS[destino as AreaId].nome}: ${(e as Error).message}` }); }
    }
    return (await obterTarefa(tid)) ?? tarefa;
  } catch (e) {
    await gravarEvento(f.agente.empresaId, t.agenteId, "bloqueado", "A geração da arte falhou, preciso de ajuda do dono.");
    return atualizar(tid, { status: "falhou", erro: resumoErroOpenAI(e) });
  }
}
function resumoErroOpenAI(e: unknown) {
  const m = (e as { message?: string; error?: { message?: string } });
  return (m.error?.message ?? m.message ?? String(e)).slice(0, 400);
}

// ======================== Encaminhar uma tarefa concluída pra outro setor ========================
// Quem recebe é o gerente do setor (se não houver, o nível mais alto de lá). Vira uma tarefa "arquivo_recebido" na lista dele.
export async function responsavelDaArea(area: AreaId) {
  const ordem = ["gerente", "senior", "pleno", "junior", "estagiario"];
  const lista = await sql<{ id: string; nome: string; nivel: string }[]>`SELECT id, nome, nivel FROM agente WHERE empresa_id = ${EMPRESA_PADRAO.id} AND ativo = true AND area = ${area}`;
  return lista.sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel))[0] ?? null;
}
export async function encaminharTarefa(tid: string, area: AreaId, mensagem?: string) {
  const t = await obterTarefa(tid); if (!t) throw new Error("Tarefa não encontrada");
  if (t.status !== "concluida" || !t.resultado?.arquivoId) throw new Error("Só dá pra encaminhar uma tarefa concluída com arquivo.");
  const de = await fichaCompleta(t.agenteId); if (!de) throw new Error("Agente não encontrado");
  const alvo = await responsavelDaArea(area);
  if (!alvo) throw new Error(`Ninguém no setor ${AREAS[area].nome} ainda. Contrate alguém lá (de preferência um gerente).`);
  const nid = id("tar");
  const titulo = `${t.titulo} (de ${de.agente.nome})`;
  const dados = { arquivoId: t.resultado.arquivoId, arquivoNome: t.resultado.arquivoNome, url: t.resultado.url, deAgenteId: t.agenteId, deNome: de.agente.nome, deArea: de.agente.area, origemTarefaId: tid, mensagem: mensagem ?? "" };
  await sql`INSERT INTO tarefa (id, empresa_id, agente_id, tipo, status, titulo, dados) VALUES (${nid}, ${EMPRESA_PADRAO.id}, ${alvo.id}, 'arquivo_recebido', 'recebida', ${titulo}, ${sql.json(dados as never)})`;
  await gravarEvento(de.agente.empresaId, alvo.id, "tarefa_recebida", `Recebi "${t.titulo}" do ${de.agente.nome}.`, { tarefaId: nid });
  await gravarMural({ autorTipo: "sistema", autorNome: de.agente.nome, agenteId: t.agenteId, texto: `Encaminhou "${t.titulo}" pra ${alvo.nome} (${AREAS[area].nome}).` });
  // registra na tarefa de origem pra quem foi
  const enc = Array.isArray(t.resultado.encaminhadoPara) ? (t.resultado.encaminhadoPara as unknown[]) : [];
  await atualizar(tid, { resultado: { ...t.resultado, encaminhadoPara: [...enc, { area, agenteId: alvo.id, nome: alvo.nome, tarefaId: nid, em: new Date().toISOString() }] } });
  return { tarefaId: nid, para: alvo, area };
}

// Executa a tarefa aprovada conforme o tipo.
export async function executarTarefa(tid: string, baseUrl: string, ajustes?: Record<string, unknown>) {
  const t = await obterTarefa(tid); if (!t) throw new Error("Tarefa não encontrada");
  if (t.tipo === "criar_arte") return executarArte(tid, baseUrl, ajustes as Partial<PlanoArte>);
  if (t.tipo === "publicar_video") return executarPublicacao(tid, baseUrl, ajustes as Partial<PlanoPublicacao>);
  throw new Error(`Tarefa do tipo "${t.tipo}" não tem execução.`);
}
