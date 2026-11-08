// Agentes que o WorkEnd vende. O admin cria e treina cada um (o que sabe, skills, APIs ligadas, preço); as lojas
// contratam do catálogo. Enquanto o admin não cadastra nenhum, vale a lista fixa do código (CATALOGO_PROFISSIONAIS).
import { sql, id, migrar } from "./db";
import { CATALOGO_PROFISSIONAIS } from "@/office/data/escritorio";

export interface AgenteCatalogo { id: string; nome: string; cargo: string; setor: string; descricao: string; saudacao: string; skills: string[]; apis: string[]; preco: number; boneco: string; camisa: string; ativo: boolean; ordem: number; criadoEm?: Date; atualizadoEm?: Date }
export const APIS_DISPONIVEIS = [
  { id: "chatgpt_texto", nome: "ChatGPT · texto", desc: "Conversa, escreve, resume e responde clientes." },
  { id: "chatgpt_imagem", nome: "ChatGPT · imagens", desc: "Cria artes, posts e banners a partir de um briefing." },
  { id: "landing_page", nome: "Landing page", desc: "Monta uma página de vendas pronta pra publicar." },
  { id: "email", nome: "E-mail", desc: "Manda e-mails pro cliente e pro dono (SendGrid)." },
  { id: "agenda", nome: "Agenda", desc: "Marca e confirma horários." },
  { id: "whatsapp", nome: "WhatsApp", desc: "Avisa o dono e o cliente no WhatsApp (em breve)." },
  { id: "planilha", nome: "Planilhas", desc: "Organiza pedidos, orçamentos e contatos em planilha." },
];

const CAMPOS = () => sql`id, nome, cargo, setor, descricao, saudacao, skills, apis, preco, boneco, camisa, ativo, ordem, criado_em, atualizado_em`;
const normal = (a: AgenteCatalogo): AgenteCatalogo => ({ ...a, preco: Number(a.preco), skills: Array.isArray(a.skills) ? a.skills : [], apis: Array.isArray(a.apis) ? a.apis : [] });

// Lista pra venda (ativos). Sem nenhum no banco, devolve os fixos do código
export async function catalogoAVenda(): Promise<AgenteCatalogo[]> {
  await migrar();
  const lista = await sql<AgenteCatalogo[]>`SELECT ${CAMPOS()} FROM agente_catalogo WHERE ativo ORDER BY ordem, criado_em`;
  if (lista.length) return lista.map(normal);
  return CATALOGO_PROFISSIONAIS.map((p, i) => ({ id: p.id, nome: p.nome, cargo: p.cargo, setor: p.setor, descricao: p.treino.descricao, saudacao: p.treino.saudacao, skills: [], apis: ["chatgpt_texto"], preco: 0, boneco: p.boneco, camisa: p.camisa, ativo: true, ordem: i }));
}
export async function listarCatalogoAdmin(): Promise<AgenteCatalogo[]> {
  await migrar();
  return (await sql<AgenteCatalogo[]>`SELECT ${CAMPOS()} FROM agente_catalogo ORDER BY ordem, criado_em`).map(normal);
}
const texto = (t: unknown, max: number, padrao = "") => (typeof t === "string" ? t.trim().slice(0, max) : padrao) || padrao;
const lista = (x: unknown, max = 20) => (Array.isArray(x) ? x.filter((s) => typeof s === "string").map((s) => (s as string).trim().slice(0, 60)).filter(Boolean).slice(0, max) : []);

export async function salvarAgenteCatalogo(d: Partial<AgenteCatalogo> & { id?: string }) {
  await migrar();
  const aid = d.id && /^[a-zA-Z0-9_-]{1,40}$/.test(d.id) ? d.id : id("agc");
  const nome = texto(d.nome, 40); const cargo = texto(d.cargo, 40); const setor = texto(d.setor, 28, "Atendimento");
  if (!nome || !cargo) throw new Error("Nome e cargo são obrigatórios.");
  const preco = Math.max(0, Math.min(9999, Number(d.preco) || 0));
  const skills = sql.json(lista(d.skills)); const apis = sql.json(lista(d.apis).filter((a) => APIS_DISPONIVEIS.some((x) => x.id === a)));
  const camisa = typeof d.camisa === "string" && /^#[0-9a-fA-F]{6}$/.test(d.camisa) ? d.camisa : "#1D4ED8";
  const [a] = await sql<AgenteCatalogo[]>`INSERT INTO agente_catalogo (id, nome, cargo, setor, descricao, saudacao, skills, apis, preco, boneco, camisa, ativo, ordem)
    VALUES (${aid}, ${nome}, ${cargo}, ${setor}, ${texto(d.descricao, 1500)}, ${texto(d.saudacao, 200)}, ${skills}, ${apis}, ${preco}, ${texto(d.boneco, 24, "classico")}, ${camisa}, ${d.ativo !== false}, ${Number(d.ordem) || 0})
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, setor = EXCLUDED.setor, descricao = EXCLUDED.descricao, saudacao = EXCLUDED.saudacao, skills = EXCLUDED.skills, apis = EXCLUDED.apis, preco = EXCLUDED.preco, boneco = EXCLUDED.boneco, camisa = EXCLUDED.camisa, ativo = EXCLUDED.ativo, ordem = EXCLUDED.ordem, atualizado_em = now()
    RETURNING ${CAMPOS()}`;
  return normal(a);
}
export async function apagarAgenteCatalogo(aid: string) { await migrar(); await sql`DELETE FROM agente_catalogo WHERE id = ${aid}`; }
// Importa os 8 fixos do código pro banco (ponto de partida pro admin treinar os dele)
export async function semearCatalogo() {
  for (const [i, p] of CATALOGO_PROFISSIONAIS.entries()) await salvarAgenteCatalogo({ id: p.id, nome: p.nome, cargo: p.cargo, setor: p.setor, descricao: p.treino.descricao, saudacao: p.treino.saudacao, skills: [], apis: ["chatgpt_texto"], preco: 0, boneco: p.boneco, camisa: p.camisa, ativo: true, ordem: i });
}
