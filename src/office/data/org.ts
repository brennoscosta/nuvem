// Estrutura da empresa: áreas, níveis (cargos), funções e personalidades.

// Setores com time de IA: planejamento, criacao, social, trafego, desenvolvimento, analise, atendimento, vendas.
// Diretoria (pessoas reais) e apoio (financeiro, rh, juridico) completam o prédio.
export type AreaId = "planejamento" | "criacao" | "social" | "trafego" | "desenvolvimento" | "analise" | "atendimento" | "vendas"
  | "diretoria" | "financeiro" | "rh" | "juridico";

export interface Area {
  id: AreaId;
  nome: string;
  cor: string; // cor de destaque da área
  piso: string; // cor do piso da área
}

export const AREAS: Record<AreaId, Area> = {
  planejamento: { id: "planejamento", nome: "Planejamento", cor: "#5C6BC0", piso: "#E4E6F7" },
  criacao: { id: "criacao", nome: "Criação", cor: "#EC6B8D", piso: "#FBE6EC" },
  social: { id: "social", nome: "Social", cor: "#F2913D", piso: "#FDEBDD" },
  trafego: { id: "trafego", nome: "Tráfego", cor: "#00ACC1", piso: "#DFF3F6" },
  desenvolvimento: { id: "desenvolvimento", nome: "Desenvolvimento", cor: "#4F7DF3", piso: "#E4EBFB" },
  analise: { id: "analise", nome: "Análise", cor: "#8B6CF0", piso: "#ECE6FB" },
  atendimento: { id: "atendimento", nome: "Atendimento", cor: "#3FBFA8", piso: "#DFF4F0" },
  vendas: { id: "vendas", nome: "Vendas", cor: "#22A86B", piso: "#E2F4EA" },
  diretoria: { id: "diretoria", nome: "Diretoria", cor: "#D9A23A", piso: "#F6EEDF" },
  financeiro: { id: "financeiro", nome: "Financeiro", cor: "#2E7D32", piso: "#E0F0E1" },
  rh: { id: "rh", nome: "RH & Cultura", cor: "#EC407A", piso: "#FBE4EC" },
  juridico: { id: "juridico", nome: "Jurídico", cor: "#6D4C41", piso: "#EFE7E3" },
};

export const AREAS_OPERACIONAIS: AreaId[] = ["planejamento", "criacao", "social", "trafego", "desenvolvimento", "analise", "atendimento", "vendas", "financeiro", "rh", "juridico"];

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
  planejamento: ["Planejador(a) estratégico", "Gestor(a) de projetos", "Analista de processos", "Cronograma e prazos"],
  criacao: ["Roteirista", "Redator(a) / copy", "Designer gráfico", "Editor(a) de vídeo", "Diretor(a) de arte"],
  social: ["Social media", "Community manager", "Programação de posts", "Monitoramento de comentários"],
  trafego: ["Gestor(a) de tráfego", "Analista de campanhas", "Otimização de anúncios", "Pixel e conversões"],
  desenvolvimento: ["Dev front-end", "Dev back-end", "Dev mobile", "QA", "DevOps / automações"],
  analise: ["Analista de dados", "Analista de BI", "Relatórios e métricas", "Cientista de dados"],
  atendimento: ["Atendente N1", "Atendente N2", "Sucesso do cliente", "Base de conhecimento"],
  vendas: ["SDR", "Closer", "Follow-up", "Analista comercial"],
  diretoria: ["Gestão"],
  financeiro: ["Analista financeiro", "Contas a pagar/receber", "Controller"],
  rh: ["Recrutador(a)", "Onboarding", "Cultura e comunicação interna"],
  juridico: ["Contratos", "Compliance", "Privacidade (LGPD)"],
};

export const PERSONALIDADES = ["Animado", "Focado", "Calmo", "Detalhista", "Comunicativo", "Criativo"];
