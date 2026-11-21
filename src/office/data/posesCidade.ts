// Leva os quiosques e as sedes para a posição gravada pelo dono (quiosque) ou pela conta admin (sede), quando os terrenos
// chegam do servidor (mundoStore › carregar, a cada 30 s: é assim que os outros visitantes veem a posição nova). As lojas
// dos lotes não precisam: a cena e a colisão pedem a pose direto a data/posicaoPredio.ts. (21/11/2026, modo "Editar posição")
import { anexosDe, poseDoTerreno } from "./posicaoPredio";
import { aplicarPosesQuiosques } from "./quiosques";
import { aplicarPosesSedes } from "./sedes";
import { refazerCaminhos } from "./caminhos";
import type { Escritorio } from "./escritorio";

interface TerrenoPoses { chave: string; status: string; escritorio: Escritorio | null; anexoDe?: string | null }
export function aplicarPosesCidade(terrenos: Record<string, TerrenoPoses>): { quiosques: boolean; sedes: boolean } {
  const anexos = anexosDe(terrenos);
  const poseDe = (chave: string) => poseDoTerreno(chave, terrenos, anexos);
  const quiosques = aplicarPosesQuiosques(terrenos, poseDe);
  if (quiosques) refazerCaminhos(); // o desvio dos quiosques mudou: a grade do caminho é montada de novo
  const sedes = aplicarPosesSedes(poseDe);
  return { quiosques, sedes };
}
