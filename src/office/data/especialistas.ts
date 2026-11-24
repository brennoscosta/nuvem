// Especialistas do WorkEnd: os 39 cargos dos 13 setores (gerente + 2 especialistas por setor). Cada um tem treino,
// limites do cargo e skills (procedimentos que o motor de IA segue ao trabalhar). Fonte única para o catálogo à venda,
// a biblioteca de skills do escritório e a página /app. Escrito em 10/11/2026.
import type { AreaId, Nivel } from "./org";

export interface SkillEspecialista { nome: string; quandoUsar: string; passos: string }
export interface EspecialistaIA {
  id: string; area: AreaId; cargo: string; nivel: Nivel; nome: string; boneco: string;
  descricao: string; saudacao: string; personalidade: string; tomDeVoz: string;
  apis: string[]; limites: string[]; skills: SkillEspecialista[];
}
const s = (nome: string, quandoUsar: string, passos: string[]): SkillEspecialista => ({ nome, quandoUsar, passos: passos.map((p, i) => `${i + 1}. ${p}`).join("\n") });

// 24/11/2026 (pedido do dono: "vamos zerar agentes... quero criar 1 a 1 desde o atendente, CEO"): o catálogo ficou vazio
// e os 39 especialistas de 10/11/2026 foram apagados (estão no histórico do git). Os novos entram aqui um a um.
export const ESPECIALISTAS_IA: EspecialistaIA[] = [];

export const ESPECIALISTA_POR_ID: Record<string, EspecialistaIA> = Object.fromEntries(ESPECIALISTAS_IA.map((e) => [e.id, e]));
