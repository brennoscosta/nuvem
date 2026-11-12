// Missões de visitante e selos do perfil (12/11/2026). O progresso é calculado dos dados (visitas, conversas, negócios,
// amizades, avaliações, candidaturas e barracas); o selo aparece na ficha do personagem, na busca e na página da loja.
export interface Missao { id: string; nome: string; desc: string; meta: number; selo: string; cor: string }
export const MISSOES: Missao[] = [
  { id: "explorador", nome: "Explorador", desc: "Visite 5 lojas diferentes no mapa", meta: 5, selo: "🧭", cor: "#1D4ED8" },
  { id: "papo", nome: "Bom de papo", desc: "Converse com a atendente de 3 lojas", meta: 3, selo: "💬", cor: "#16A34A" },
  { id: "amigos", nome: "Rede de amigos", desc: "Faça 3 amizades", meta: 3, selo: "🤝", cor: "#DB2777" },
  { id: "negociante", nome: "Negociante", desc: "Feche 1 negócio até a conclusão", meta: 1, selo: "💼", cor: "#D97706" },
  { id: "avaliador", nome: "Avaliador", desc: "Avalie 1 negócio concluído", meta: 1, selo: "⭐", cor: "#E8A317" },
  { id: "candidato", nome: "Na batalha", desc: "Candidate-se a 1 vaga", meta: 1, selo: "📨", cor: "#7C3AED" },
  { id: "feirante", nome: "Feirante", desc: "Monte uma barraca na feira de sábado", meta: 1, selo: "🎪", cor: "#E2575B" },
];
export const MISSAO_POR_ID: Record<string, Missao> = Object.fromEntries(MISSOES.map((m) => [m.id, m]));
