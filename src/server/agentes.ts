// Acesso aos agentes e à ficha completa (perfil, conhecimento, skills, regras).
import { sql, migrar, id } from "./db";

export const EMPRESA_PADRAO = { id: "emp_nuvem", slug: "nuvem", nome: "Nuvem" };

export interface AgenteDB {
  id: string; empresaId: string; nome: string; area: string; nivel: string; funcao: string;
  personalidade: string; tomDeVoz: string; descricao: string; modelo: string; boneco: string;
  mesaId: string | null; chefeId: string | null; tetoDiarioBrl: string; ativo: boolean; criadoEm: Date; atualizadoEm: Date;
  falaPublica: string; falaPublicaEm: Date | null;
}
export interface ConhecimentoDB { id: string; agenteId: string; titulo: string; conteudo: string; origem: string; ativo: boolean; criadoEm: Date }
export interface SkillDB { id: string; agenteId: string; nome: string; quandoUsar: string; passos: string; ativo: boolean; ordem: number; criadoEm: Date }
export interface RegraDB { id: string; agenteId: string; texto: string; origemMensagemId: string | null; ativo: boolean; criadoEm: Date }
export interface MensagemDB { id: string; agenteId: string; papel: string; autor: string; conteudo: string; avaliacao: number | null; correcao: string | null; custoBrl: string; tokensIn: number; tokensOut: number; criadoEm: Date }

export async function garantirEmpresa() {
  await migrar();
  await sql`INSERT INTO empresa (id, slug, nome) VALUES (${EMPRESA_PADRAO.id}, ${EMPRESA_PADRAO.slug}, ${EMPRESA_PADRAO.nome}) ON CONFLICT (id) DO NOTHING`;
  return EMPRESA_PADRAO.id;
}

export async function listarAgentes(empresaId: string) {
  await migrar();
  return sql<AgenteDB[]>`SELECT * FROM agente WHERE empresa_id = ${empresaId} AND ativo = true ORDER BY criado_em`;
}

export async function obterAgente(agenteId: string) {
  await migrar();
  const [a] = await sql<AgenteDB[]>`SELECT * FROM agente WHERE id = ${agenteId}`;
  return a ?? null;
}

export async function fichaCompleta(agenteId: string) {
  const agente = await obterAgente(agenteId);
  if (!agente) return null;
  const [conhecimentos, skills, regras, empresa, chefe] = await Promise.all([
    sql<ConhecimentoDB[]>`SELECT * FROM conhecimento WHERE agente_id = ${agenteId} ORDER BY criado_em`,
    sql<SkillDB[]>`SELECT * FROM skill WHERE agente_id = ${agenteId} ORDER BY ordem, criado_em`,
    sql<RegraDB[]>`SELECT * FROM regra WHERE agente_id = ${agenteId} ORDER BY criado_em`,
    sql<{ id: string; nome: string; sobre: string }[]>`SELECT id, nome, sobre FROM empresa WHERE id = ${agente.empresaId}`,
    agente.chefeId ? sql<AgenteDB[]>`SELECT * FROM agente WHERE id = ${agente.chefeId}` : Promise.resolve([] as AgenteDB[]),
  ]);
  const subordinados = await sql<AgenteDB[]>`SELECT * FROM agente WHERE chefe_id = ${agenteId} AND ativo = true ORDER BY criado_em`;
  return { agente, conhecimentos, skills, regras, empresa: empresa[0], chefe: chefe[0] ?? null, subordinados };
}

export type NovoAgente = Pick<AgenteDB, "nome" | "area" | "nivel" | "funcao" | "personalidade" | "boneco"> & Partial<Pick<AgenteDB, "tomDeVoz" | "descricao" | "modelo" | "mesaId" | "chefeId">> & { tetoDiarioBrl?: number };

export async function criarAgente(empresaId: string, d: NovoAgente) {
  await migrar();
  const novoId = id("ag");
  const [a] = await sql<AgenteDB[]>`INSERT INTO agente ${sql({
    id: novoId, empresaId, nome: d.nome, area: d.area, nivel: d.nivel, funcao: d.funcao ?? "", personalidade: d.personalidade ?? "",
    tomDeVoz: d.tomDeVoz ?? "", descricao: d.descricao ?? "", modelo: d.modelo ?? modeloPadrao(d.nivel), boneco: d.boneco ?? "classico",
    mesaId: d.mesaId ?? null, chefeId: d.chefeId ?? null, tetoDiarioBrl: d.tetoDiarioBrl ?? tetoPadrao(d.nivel),
  })} RETURNING *`;
  return a;
}

export async function atualizarAgente(agenteId: string, campos: Partial<Omit<AgenteDB, "id" | "empresaId" | "criadoEm" | "atualizadoEm">>) {
  const permitidos = ["nome", "area", "nivel", "funcao", "personalidade", "tomDeVoz", "descricao", "modelo", "boneco", "mesaId", "chefeId", "tetoDiarioBrl", "ativo"] as const;
  const dados: Record<string, unknown> = {};
  for (const k of permitidos) if (k in campos) dados[k] = (campos as Record<string, unknown>)[k];
  dados.atualizadoEm = new Date();
  const [a] = await sql<AgenteDB[]>`UPDATE agente SET ${sql(dados)} WHERE id = ${agenteId} RETURNING *`;
  return a;
}

export async function desligarAgente(agenteId: string) {
  await sql`UPDATE agente SET ativo = false, mesa_id = NULL, atualizado_em = now() WHERE id = ${agenteId}`;
}

// ---- conhecimento / skills / regras ----
export async function salvarConhecimento(agenteId: string, d: { id?: string; titulo: string; conteudo: string; origem?: string; ativo?: boolean }) {
  if (d.id) { const [r] = await sql<ConhecimentoDB[]>`UPDATE conhecimento SET titulo = ${d.titulo}, conteudo = ${d.conteudo}, ativo = ${d.ativo ?? true} WHERE id = ${d.id} AND agente_id = ${agenteId} RETURNING *`; return r; }
  const [r] = await sql<ConhecimentoDB[]>`INSERT INTO conhecimento (id, agente_id, titulo, conteudo, origem) VALUES (${id("kn")}, ${agenteId}, ${d.titulo}, ${d.conteudo}, ${d.origem ?? "manual"}) RETURNING *`; return r;
}
export async function removerConhecimento(agenteId: string, cid: string) { await sql`DELETE FROM conhecimento WHERE id = ${cid} AND agente_id = ${agenteId}`; }

export async function salvarSkill(agenteId: string, d: { id?: string; nome: string; quandoUsar?: string; passos: string; ativo?: boolean; ordem?: number }) {
  if (d.id) { const [r] = await sql<SkillDB[]>`UPDATE skill SET nome = ${d.nome}, quando_usar = ${d.quandoUsar ?? ""}, passos = ${d.passos}, ativo = ${d.ativo ?? true}, ordem = ${d.ordem ?? 0} WHERE id = ${d.id} AND agente_id = ${agenteId} RETURNING *`; return r; }
  const [{ n }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM skill WHERE agente_id = ${agenteId}`;
  const [r] = await sql<SkillDB[]>`INSERT INTO skill (id, agente_id, nome, quando_usar, passos, ordem) VALUES (${id("sk")}, ${agenteId}, ${d.nome}, ${d.quandoUsar ?? ""}, ${d.passos}, ${d.ordem ?? n}) RETURNING *`; return r;
}
export async function removerSkill(agenteId: string, sid: string) { await sql`DELETE FROM skill WHERE id = ${sid} AND agente_id = ${agenteId}`; }

export async function salvarRegra(agenteId: string, d: { id?: string; texto: string; ativo?: boolean; origemMensagemId?: string }) {
  if (d.id) { const [r] = await sql<RegraDB[]>`UPDATE regra SET texto = ${d.texto}, ativo = ${d.ativo ?? true} WHERE id = ${d.id} AND agente_id = ${agenteId} RETURNING *`; return r; }
  const [r] = await sql<RegraDB[]>`INSERT INTO regra (id, agente_id, texto, origem_mensagem_id) VALUES (${id("rg")}, ${agenteId}, ${d.texto}, ${d.origemMensagemId ?? null}) RETURNING *`; return r;
}
export async function removerRegra(agenteId: string, rid: string) { await sql`DELETE FROM regra WHERE id = ${rid} AND agente_id = ${agenteId}`; }

// ---- mensagens ----
export async function listarMensagens(agenteId: string, limite = 60) {
  const rows = await sql<MensagemDB[]>`SELECT * FROM mensagem WHERE agente_id = ${agenteId} AND papel IN ('user','assistant') ORDER BY criado_em DESC LIMIT ${limite}`;
  return rows.reverse();
}
export async function gravarMensagem(d: { agenteId: string; papel: string; autor?: string; conteudo: string; custoBrl?: number; tokensIn?: number; tokensOut?: number }) {
  const [r] = await sql<MensagemDB[]>`INSERT INTO mensagem (id, agente_id, papel, autor, conteudo, custo_brl, tokens_in, tokens_out) VALUES (${id("msg")}, ${d.agenteId}, ${d.papel}, ${d.autor ?? "admin"}, ${d.conteudo}, ${d.custoBrl ?? 0}, ${d.tokensIn ?? 0}, ${d.tokensOut ?? 0}) RETURNING *`;
  return r;
}
export async function avaliarMensagem(agenteId: string, mensagemId: string, avaliacao: 1 | -1 | null, correcao?: string) {
  const [r] = await sql<MensagemDB[]>`UPDATE mensagem SET avaliacao = ${avaliacao}, correcao = ${correcao ?? null} WHERE id = ${mensagemId} AND agente_id = ${agenteId} RETURNING *`;
  return r;
}

export async function gastoHoje(agenteId: string) {
  const [r] = await sql<{ total: string }[]>`SELECT COALESCE(SUM(custo_brl), 0)::text AS total FROM uso_ia WHERE agente_id = ${agenteId} AND criado_em >= date_trunc('day', now())`;
  return Number(r.total);
}
export async function registrarUso(d: { agenteId: string; modelo: string; tokensIn: number; tokensOut: number; custoBrl: number }) {
  await sql`INSERT INTO uso_ia (id, agente_id, modelo, tokens_in, tokens_out, custo_brl) VALUES (${id("uso")}, ${d.agenteId}, ${d.modelo}, ${d.tokensIn}, ${d.tokensOut}, ${d.custoBrl})`;
}

// ---- eventos da cena ----
export async function gravarEvento(empresaId: string, agenteId: string | null, tipo: string, texto?: string, payload?: unknown) {
  const [r] = await sql<{ id: string; criadoEm: Date }[]>`INSERT INTO evento (id, empresa_id, agente_id, tipo, texto, payload) VALUES (${id("ev")}, ${empresaId}, ${agenteId}, ${tipo}, ${texto ?? null}, ${payload ? sql.json(payload as never) : null}) RETURNING id, criado_em`;
  return r;
}
export async function eventosDesde(empresaId: string, desde: Date) {
  return sql<{ id: string; agenteId: string | null; tipo: string; texto: string | null; payload: unknown; criadoEm: Date }[]>`SELECT id, agente_id, tipo, texto, payload, criado_em FROM evento WHERE empresa_id = ${empresaId} AND criado_em > ${desde} ORDER BY criado_em LIMIT 200`;
}

export async function salvarFalaPublica(agenteId: string, fala: string) {
  await sql`UPDATE agente SET fala_publica = ${fala}, fala_publica_em = now() WHERE id = ${agenteId}`;
}

// Versão do agente que um visitante pode ver (sem nada sensível)
export function resumoPublico(a: AgenteDB) {
  return { id: a.id, nome: a.nome, area: a.area, nivel: a.nivel, funcao: a.funcao, boneco: a.boneco, mesaId: a.mesaId, criadoEm: a.criadoEm, falaPublica: a.falaPublica, falaPublicaEm: a.falaPublicaEm };
}

export function modeloPadrao(nivel: string) {
  switch (nivel) {
    case "ceo": case "diretor": case "gerente": return "gpt-4.1";
    case "senior": case "pleno": return "gpt-4.1-mini";
    default: return "gpt-4.1-nano";
  }
}
export function tetoPadrao(nivel: string) {
  switch (nivel) { case "ceo": return 50; case "diretor": return 30; case "gerente": return 20; default: return 10; }
}
