// Mural da fachada: feed público do que está acontecendo + conversa de quem está autenticado com o CEO.
import { sql, id, migrar } from "./db";
import { EMPRESA_PADRAO, listarAgentes } from "./agentes";
import { conversar } from "./motor";

export interface ItemMural { id: string; autorTipo: "humano" | "agente" | "sistema"; autorNome: string; agenteId: string | null; texto: string; criadoEm: Date }

export async function listarMural(admin: boolean, limite = 60): Promise<ItemMural[]> {
  await migrar();
  const rows = await sql<{ id: string; autorTipo: ItemMural["autorTipo"]; autorNome: string; agenteId: string | null; texto: string; publico: string; criadoEm: Date }[]>`
    SELECT id, autor_tipo, autor_nome, agente_id, texto, publico, criado_em FROM mural WHERE empresa_id = ${EMPRESA_PADRAO.id} ORDER BY criado_em DESC LIMIT ${limite}`;
  // visitante vê a versão pública (quando existe); admin vê tudo
  return rows.reverse().map((r) => ({ id: r.id, autorTipo: r.autorTipo, autorNome: r.autorNome, agenteId: r.agenteId, texto: admin || !r.publico ? r.texto : r.publico, criadoEm: r.criadoEm }));
}

export async function gravarMural(item: { autorTipo: ItemMural["autorTipo"]; autorNome: string; agenteId?: string | null; texto: string; publico?: string }) {
  const [r] = await sql<{ id: string; criadoEm: Date }[]>`INSERT INTO mural (id, empresa_id, autor_tipo, autor_nome, agente_id, texto, publico)
    VALUES (${id("mu")}, ${EMPRESA_PADRAO.id}, ${item.autorTipo}, ${item.autorNome}, ${item.agenteId ?? null}, ${item.texto}, ${item.publico ?? ""}) RETURNING id, criado_em`;
  return r;
}

// Mensagem de alguém autenticado no mural: grava, manda pro CEO (ou pro agente indicado) e grava a resposta.
export async function falarNoMural(texto: string, autorNome: string, paraAgenteId?: string) {
  let alvo = paraAgenteId ?? null;
  if (!alvo) {
    const agentes = await listarAgentes(EMPRESA_PADRAO.id);
    alvo = agentes.find((a) => a.nivel === "ceo")?.id ?? agentes.find((a) => a.nivel === "diretor")?.id ?? null;
  }
  // o que o visitante vê da mensagem humana é só que alguém da diretoria falou
  await gravarMural({ autorTipo: "humano", autorNome, texto, publico: `${autorNome} passou uma orientação pra equipe.` });
  if (!alvo) return { resposta: null as null | string };
  const r = await conversar(alvo, texto, `mural:${autorNome}`);
  const agente = (await listarAgentes(EMPRESA_PADRAO.id)).find((a) => a.id === alvo);
  await gravarMural({ autorTipo: "agente", autorNome: agente?.nome ?? "Agente", agenteId: alvo, texto: r.mensagem.conteudo, publico: r.fala || `${agente?.nome ?? "O agente"} respondeu à diretoria.` });
  return { resposta: r.mensagem.conteudo, fala: r.fala, custo: r.custo };
}
