// Estrutura da empresa: áreas, níveis (cargos), funções e personalidades.

export type AreaId = "engenharia" | "marketing" | "vendas" | "suporte" | "diretoria";

export interface Area {
  id: AreaId;
  nome: string;
  cor: string; // cor de destaque da área
  piso: string; // cor do piso da área
}

export const AREAS: Record<AreaId, Area> = {
  engenharia: { id: "engenharia", nome: "Engenharia", cor: "#4F7DF3", piso: "#E4EBFB" },
  marketing: { id: "marketing", nome: "Marketing", cor: "#EC6B8D", piso: "#FBE6EC" },
  vendas: { id: "vendas", nome: "Vendas", cor: "#22A86B", piso: "#E2F4EA" },
  suporte: { id: "suporte", nome: "Suporte", cor: "#8B6CF0", piso: "#ECE6FB" },
  diretoria: { id: "diretoria", nome: "Diretoria", cor: "#D9A23A", piso: "#F6EEDF" },
};

export const AREAS_OPERACIONAIS: AreaId[] = ["engenharia", "marketing", "vendas", "suporte"];

export type Nivel = "estagiario" | "junior" | "pleno" | "senior" | "gerente" | "diretor" | "ceo";

export interface NivelInfo {
  id: Nivel;
  nome: string;
  ordem: number; // 1 = base, 7 = topo
  cor: string; // cor do crachá
  modelo: string; // faixa de modelo de IA (plano)
  autonomia: string;
}

export const NIVEIS: NivelInfo[] = [
  { id: "estagiario", nome: "Estagiário", ordem: 1, cor: "#B8C0CC", modelo: "o mais barato", autonomia: "Rascunhos e pesquisa; tudo revisado" },
  { id: "junior", nome: "Júnior", ordem: 2, cor: "#3FBFA8", modelo: "barato", autonomia: "Tarefas simples; revisado" },
  { id: "pleno", nome: "Pleno", ordem: 3, cor: "#4F7DF3", modelo: "intermediário", autonomia: "Tarefas médias; revisão por amostragem" },
  { id: "senior", nome: "Sênior", ordem: 4, cor: "#8B6CF0", modelo: "intermediário/forte", autonomia: "Tarefas complexas; revisa juniores" },
  { id: "gerente", nome: "Gerente", ordem: 5, cor: "#F2913D", modelo: "forte", autonomia: "Distribui o trabalho do time e aprova entregas" },
  { id: "diretor", nome: "Diretor(a)", ordem: 6, cor: "#E2575B", modelo: "forte", autonomia: "Planeja a área; aprova planos e gastos" },
  { id: "ceo", nome: "CEO", ordem: 7, cor: "#D9A23A", modelo: "o mais forte", autonomia: "Coordena os diretores; presta contas ao dono" },
];

export const NIVEL: Record<Nivel, NivelInfo> = Object.fromEntries(NIVEIS.map((n) => [n.id, n])) as Record<Nivel, NivelInfo>;

export const FUNCOES: Record<AreaId, string[]> = {
  engenharia: ["Dev front-end", "Dev back-end", "QA", "DevOps", "Dev mobile"],
  marketing: ["Social media", "Designer", "Redator(a)", "Analista de SEO", "Editor(a) de vídeo"],
  vendas: ["SDR", "Closer", "Customer success", "Analista comercial"],
  suporte: ["Atendente N1", "Atendente N2", "Analista de qualidade", "Base de conhecimento"],
  diretoria: ["Gestão"],
};

export const PERSONALIDADES = ["Animado", "Focado", "Calmo", "Detalhista", "Comunicativo", "Criativo"];
