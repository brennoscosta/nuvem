// Identidade e escopo de cada agente (20/11/2026, pedido do dono: "ele será treinado e identificado para não fazer as
// mesmas coisas dos outros"). Cada membro tem "Faz" (das skills do cargo no catálogo de especialistas) e o resto da equipe
// vira o "Não faz (passa para…)". Dois do mesmo cargo recebem focos diferentes e dividem as skills sem sobrepor
// (ex.: "Vendas – clientes novos" e "Vendas – pós-venda e recompra"). Usado no servidor (prompt da IA, roteiro sem IA,
// compra do agente) e na ficha do escritório.
import type { Membro, Escritorio } from "./escritorio";
import { ESPECIALISTA_POR_ID } from "./especialistas";
import { AREAS, type AreaId } from "./org";

export interface Escopo { foco: string | null; faz: string[] }

// focos para cargos repetidos, por área (o 1º agente fica com o 1º foco, o 2º com o 2º...)
export const FOCOS: Partial<Record<AreaId, string[]>> = {
  vendas: ["clientes novos", "pós-venda e recompra", "grandes contas"],
  atendimento: ["primeiro contato", "dúvidas de quem já é cliente", "reclamações e trocas"],
  social: ["calendário e posts", "comunidade e respostas", "parcerias e influenciadores"],
  trafego: ["campanhas de venda", "campanhas de alcance", "relatórios de anúncios"],
  criacao: ["textos e roteiros", "vídeos curtos", "campanhas de data especial"],
  designgrafico: ["peças do dia a dia", "identidade e impressos", "embalagens e vitrine"],
  webdesign: ["páginas de venda", "site institucional", "melhorias de conversão"],
  desenvolvimento: ["funções novas", "correções e suporte técnico", "integrações"],
  analise: ["vendas e faturamento", "marketing e funil", "clientes e retenção"],
  financeiro: ["contas a receber", "contas a pagar", "fluxo de caixa e relatórios"],
  rh: ["recrutamento", "rotina e cultura", "treinamentos"],
  juridico: ["contratos", "consumidor e reclamações", "documentos e registros"],
  planejamento: ["metas e prioridades", "projetos e prazos", "rotina da equipe"],
};
const FOCOS_PADRAO = ["demanda principal", "demanda de apoio", "projetos especiais", "frente extra"];

// mesma ideia de src/server/equipeCliente.ts › AREA_POR_PALAVRA: de que área é um texto
export const AREA_POR_PALAVRA: [RegExp, AreaId][] = [
  [/vend|comercial|or[cç]amento|pre[cç]o|desconto|comprar/i, "vendas"], [/tr[aá]fego|an[uú]ncio|campanha|impulsion/i, "trafego"], [/social|rede|instagram|post|stories|reels/i, "social"],
  [/financ|cobran|cont[aá]b|fiscal|nota fiscal|boleto|pagamento|pix|caixa/i, "financeiro"], [/jur[ií]d|contrat|advog|lei\b|processo/i, "juridico"], [/\brh\b|pessoas|recrut|contrata[cç][aã]o de gente|cultura|f[eé]rias/i, "rh"],
  [/site|web|landing|p[aá]gina/i, "webdesign"], [/dev|program|sistema|software|aplicativo|integra/i, "desenvolvimento"], [/dado|an[aá]lis|\bbi\b|relat[oó]rio|planilha|m[eé]trica/i, "analise"],
  [/planej|projeto|estrat|meta|prioridad/i, "planejamento"], [/design|arte|logo|identidade|gr[aá]fic|banner|panfleto/i, "designgrafico"], [/cria|conte[uú]do|roteir|v[ií]deo|copy|reda|texto/i, "criacao"],
  [/suporte|atend|recep|agend|sac\b|d[uú]vida|reclama|troca/i, "atendimento"],
];
export const areaDoTexto = (t: string): AreaId | null => AREA_POR_PALAVRA.find(([r]) => r.test(t))?.[1] ?? null;

export function areaDoMembro(m: Pick<Membro, "papel" | "catalogoId" | "cargo">, setorNome = ""): AreaId {
  if (m.papel === "ceo") return "diretoria";
  if (m.papel === "atendente") return "atendimento";
  const esp = m.catalogoId?.startsWith("esp-") ? ESPECIALISTA_POR_ID[m.catalogoId.slice(4)] : null;
  return esp?.area ?? areaDoTexto(`${m.cargo} ${setorNome}`) ?? "atendimento";
}
function fazPadrao(m: Membro): string[] {
  if (m.papel === "ceo") return ["Decide prioridades e aprova planos", "Fecha negócios maiores", "Cuida da equipe e do relatório da semana"];
  if (m.papel === "atendente") return ["Recebe quem chega na loja", "Tira dúvidas e anota contatos", "Passa os pedidos para a pessoa certa da equipe"];
  const esp = m.catalogoId?.startsWith("esp-") ? ESPECIALISTA_POR_ID[m.catalogoId.slice(4)] : null;
  if (esp?.skills.length) return esp.skills.map((s) => s.nome);
  const d = (m.treino?.descricao ?? "").split(/(?<=[.!?])\s+/)[0]?.trim();
  return [d || m.cargo];
}
export const escopoDe = (m: Membro): Escopo => (m.escopo?.faz?.length ? { foco: m.escopo.foco ?? null, faz: m.escopo.faz } : { foco: null, faz: fazPadrao(m) });
export const cargoComFoco = (m: Membro) => { const f = escopoDe(m).foco; return f ? `${m.cargo} – ${f}` : m.cargo; };
const nomeSetor = (m: Membro, e: Pick<Escritorio, "setores">) => (m.papel === "ceo" ? "Diretoria" : m.papel === "atendente" ? "Recepção" : e.setores.find((s) => s.id === m.setorId)?.nome ?? AREAS[areaDoMembro(m)].nome);

export interface ItemMapa { id: string; nome: string; cargo: string; setor: string; area: AreaId; foco: string | null; faz: string[] }
export function mapaDaEquipe(e: Pick<Escritorio, "equipe" | "setores">): ItemMapa[] {
  return e.equipe.map((m) => { const s = escopoDe(m); return { id: m.id, nome: m.nome, cargo: m.cargo, setor: nomeSetor(m, e), area: areaDoMembro(m, nomeSetor(m, e)), foco: s.foco, faz: s.faz }; });
}
// "Não faz (passa para…)": o que é dos colegas
export function naoFaz(m: Membro, e: Pick<Escritorio, "equipe" | "setores">) {
  return mapaDaEquipe(e).filter((x) => x.id !== m.id).map((x) => ({ id: x.id, nome: x.nome, assunto: x.foco ? `${x.setor} (${x.foco})` : x.setor }));
}

// quem da equipe faz este pedido: pela área do texto e pelas palavras do "Faz" de cada um
// palavras que não dizem de quem é o pedido ("cliente" aparece em quase todo pedido e em quase todo escopo)
const PARADAS = new Set(["para", "como", "mais", "voce", "voces", "esse", "essa", "isso", "aqui", "fazer", "preciso", "quero", "pode", "favor", "sobre", "pelo", "pela", "tambem", "porque", "quando", "qual", "quais", "minha", "nosso", "nossa", "dele", "dela", "seus", "suas", "uma", "umas", "uns", "cliente", "clientes", "empresa", "hoje", "amanha", "semana"]);
export const palavras = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !PARADAS.has(w)));
export function notasDoPedido(texto: string, e: Pick<Escritorio, "equipe" | "setores">) {
  const area = areaDoTexto(texto); const pw = palavras(texto);
  return mapaDaEquipe(e).map((it) => {
    // a área do pedido pesa mais que palavras soltas: "nota fiscal" é do Financeiro mesmo que cite um cliente
    let nota = area && it.area === area ? 5 : 0;
    const dele = palavras(`${it.cargo} ${it.setor} ${it.foco ?? ""} ${it.faz.join(" ")}`);
    for (const w of pw) if (dele.has(w)) nota += 1;
    if (it.foco && [...palavras(it.foco)].some((w) => pw.has(w))) nota += 1;
    return { item: it, nota };
  });
}
export function quemFaz(texto: string, e: Pick<Escritorio, "equipe" | "setores">) {
  let melhor: { item: ItemMapa; nota: number } | null = null;
  for (const x of notasDoPedido(texto, e)) if (x.nota > 0 && (!melhor || x.nota > melhor.nota)) melhor = x;
  return melhor;
}

// Dois ou mais do mesmo cargo: cada um ganha um foco diferente e uma parte das skills (sem repetir). Muda `e` no lugar.
export function especializar(e: Escritorio, catalogoId: string | undefined, cargo: string) {
  const iguais = e.equipe.filter((m) => m.papel === "profissional" && (catalogoId ? m.catalogoId === catalogoId : m.cargo === cargo));
  if (iguais.length < 2) return;
  const area = areaDoMembro(iguais[0], nomeSetor(iguais[0], e));
  const focos = FOCOS[area] ?? FOCOS_PADRAO;
  const skills = fazPadrao({ ...iguais[0], escopo: undefined });
  iguais.forEach((m, i) => {
    const foco = focos[i] ?? `${FOCOS_PADRAO[i % FOCOS_PADRAO.length]} ${i + 1}`;
    const parte = skills.filter((_, k) => k % iguais.length === i);
    m.escopo = { foco, faz: [`Cuida de ${foco}`, ...parte] };
  });
}
