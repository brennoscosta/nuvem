// Veículos do personagem (19/11/2026, pedido do dono: "quero que tenha meios de transportes mais rápido, quero que meu
// personagem possa ter acesso a uma bicicleta para poder se locomover mais rápido"). Por enquanto só a bicicleta, grátis
// para todo visitante com personagem. A lista já está pronta para outros (patinete, carro): cada um tem a velocidade, a
// arrancada e a freada (m/s e m/s²), as cores e o nome. Quem anda é scene/Personagens.tsx; o desenho é scene/Bicicleta.tsx.
// Onde fica guardado: personagem.visual.veiculo (JSON, sem migração) = { cor, em, parada }. "em" é o veículo em que está
// agora (null = a pé) e "parada" é onde a bicicleta ficou estacionada (porta de um prédio), ambos vindos da batida.

export type IdVeiculo = "bicicleta"; // futuro: | "patinete" | "carro"

export interface Veiculo {
  id: IdVeiculo;
  nome: string;
  vel: number; // velocidade de cruzeiro (m/s); a pé são 2,2
  acel: number; // arrancada (m/s²)
  freio: number; // freada (m/s²)
  giro: number; // quão depressa vira nas esquinas (a pé: 12)
  cores: { id: string; nome: string; cor: string }[];
}

export const VEICULOS: Record<IdVeiculo, Veiculo> = {
  bicicleta: {
    id: "bicicleta", nome: "Bicicleta", vel: 5.5, acel: 2.6, freio: 4.2, giro: 7,
    cores: [
      { id: "azul", nome: "Azul", cor: "#2563EB" },
      { id: "vermelha", nome: "Vermelha", cor: "#E11D48" },
      { id: "verde", nome: "Verde", cor: "#16A34A" },
      { id: "amarela", nome: "Amarela", cor: "#F59E0B" },
      { id: "preta", nome: "Preta", cor: "#1F2329" },
    ],
  },
};

export const ID_VEICULOS = Object.keys(VEICULOS) as IdVeiculo[];
export const ehVeiculo = (x: unknown): x is IdVeiculo => typeof x === "string" && x in VEICULOS;
export const COR_BICICLETA_PADRAO = VEICULOS.bicicleta.cores[0].cor;
// cor válida da lista (vinda do banco ou do navegador); qualquer outra vira a padrão
export function corDaBicicleta(c: unknown): string {
  const ok = VEICULOS.bicicleta.cores.find((x) => typeof c === "string" && x.cor.toUpperCase() === c.toUpperCase());
  return ok ? ok.cor : COR_BICICLETA_PADRAO;
}
// a maior velocidade entre os veículos: o servidor limita a velocidade que chega na batida a isto (com folga)
export const VEL_MAX_VEICULO = Math.max(...ID_VEICULOS.map((id) => VEICULOS[id].vel));

// estado público que vai para os outros visitantes na batida
// parada: [x, z, giro]; vaga: parada na vaga da porta de um prédio (com paraciclo) e não no meio da rua
export interface VeiculoPublico { id: IdVeiculo; cor: string; montado: boolean; parada: [number, number, number] | null; vaga: boolean }
