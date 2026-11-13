// Prédios do kit modular (v66, 13/11/2026): os 8 tipos novos são montados em código (scene/KitPredio.tsx) a partir de
// paredes, janelas, vitrines, marquises, telhados, docas e portões. Aqui ficam só as MEDIDAS de cada tipo, usadas pela
// cena (onde vai o letreiro, a vitrine, o topo da cobertura), pelo painel (andares possíveis) e pelo balão (altura).
// Coordenadas locais do lote: centro (0, 0), frente para -z (rua), x positivo = esquerda de quem olha a fachada.
// O lote tem 20 × 20 m: o prédio fica entre x ±9,2 e z de -7,6 a 9,2 (a calçada da frente é da decoração do lote).
export type KitId = "comercial" | "torre" | "esquina" | "logistico" | "industrial" | "coworking" | "cafeteria" | "consultorio";
export const KIT_IDS: KitId[] = ["comercial", "torre", "esquina", "logistico", "industrial", "coworking", "cafeteria", "consultorio"];
export const ehKit = (id: string): id is KitId => (KIT_IDS as string[]).includes(id);

// andares: base (como o tipo nasce), mínimo e máximo que o dono pode escolher (no galpão é o anexo de escritório)
export const KIT_ANDARES: Record<KitId, { base: number; min: number; max: number }> = {
  comercial: { base: 3, min: 3, max: 5 }, torre: { base: 8, min: 6, max: 12 }, esquina: { base: 2, min: 1, max: 3 },
  logistico: { base: 2, min: 1, max: 3 }, industrial: { base: 2, min: 1, max: 3 }, coworking: { base: 2, min: 1, max: 4 },
  cafeteria: { base: 1, min: 1, max: 2 }, consultorio: { base: 2, min: 1, max: 3 },
};

export interface MedidasKit {
  w: number; z0: number; z1: number; // largura total e frente/fundos do corpo principal
  terreo: number; andar: number; n: number; // pé-direito do térreo e dos andares, e quantos andares
  topo: { x: number; y: number; w: number; d: number; cz: number }; // laje onde vai a cobertura (terraço, jardim, solar...)
  altura: number; // ponto mais alto (balão, câmera)
  letreiro: { x: number; y: number; z: number; largura: number };
  vidroZ: number; // plano do vidro da vitrine (cartazes ficam logo atrás) e das peças presas na parede
  frenteZ: number; // o que mais avança na frente (marquise, deck, rampa): peça da área e inauguração ficam à frente disso
  vitrine: { x: number; y: number }[]; // onde os cartazes da vitrine ficam no vidro do térreo
  anexo?: { x0: number; x1: number; z0: number; z1: number; h: number }; // escritório na frente do galpão
}

// toldo de lona embaixo do letreiro: só onde não há marquise, pérgola ou cobertura metálica na entrada
export const KIT_TOLDO: Record<KitId, boolean> = { comercial: false, torre: false, esquina: false, logistico: true, industrial: true, coworking: false, cafeteria: true, consultorio: false };

const clampN = (id: KitId, n: number) => Math.max(KIT_ANDARES[id].min, Math.min(KIT_ANDARES[id].max, Math.round(n) || KIT_ANDARES[id].base));

// cobertura: sem cobertura especial a café tem telhado de barro; com terraço, jardim etc. vira laje
export function medidasKit(id: KitId, andares: number, duplo: boolean, coberturaPlana = false): MedidasKit {
  const n = clampN(id, andares);
  const W = (s: number, d: number) => (duplo ? d : s);
  switch (id) {
    case "comercial": {
      const w = W(15, 25), z0 = -6.2, z1 = 6.0, terreo = 4.2, andar = 3.3;
      const topoY = terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.2, d: z1 - z0 - 1.2, cz: (z0 + z1) / 2 }, altura: topoY + 3.4,
        letreiro: { x: 0, y: 4.62, z: -7.32, largura: duplo ? 9 : 6.6 }, vidroZ: -5.15, frenteZ: -7.3,
        vitrine: duplo ? [{ x: -10.0, y: 1.45 }, { x: -8.6, y: 1.45 }, { x: 8.6, y: 1.45 }, { x: 10.0, y: 1.45 }] : [{ x: -5.6, y: 1.45 }, { x: -4.2, y: 1.45 }, { x: 4.2, y: 1.45 }, { x: 5.6, y: 1.45 }] };
    }
    case "torre": {
      const w = W(13, 22), z0 = -6.4, z1 = 6.4, terreo = 5.0, andar = 3.4;
      const topoY = terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.6, d: z1 - z0 - 1.6, cz: 0 }, altura: topoY + 4.2,
        letreiro: { x: 0, y: 5.45, z: -6.62, largura: duplo ? 9 : 7 }, vidroZ: -5.3, frenteZ: -7.9,
        vitrine: duplo ? [{ x: -8.0, y: 1.6 }, { x: -6.6, y: 1.6 }, { x: 6.6, y: 1.6 }, { x: 8.0, y: 1.6 }] : [{ x: -4.5, y: 1.6 }, { x: -3.1, y: 1.6 }, { x: 3.1, y: 1.6 }, { x: 4.5, y: 1.6 }] };
    }
    case "esquina": {
      const w = W(15, 25), z0 = -6.4, z1 = 5.8, terreo = 4.5, andar = 3.1;
      const topoY = terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.2, d: z1 - z0 - 1.2, cz: (z0 + z1) / 2 }, altura: topoY + 1.6,
        letreiro: { x: duplo ? -2 : -1.2, y: 4.15, z: -7.95, largura: duplo ? 10 : 7 }, vidroZ: -6.3, frenteZ: -7.9,
        vitrine: duplo ? [{ x: -10.2, y: 1.5 }, { x: -8.8, y: 1.5 }, { x: -7.4, y: 1.5 }, { x: 2.6, y: 1.5 }] : [{ x: -6.0, y: 1.5 }, { x: -4.6, y: 1.5 }, { x: -3.2, y: 1.5 }, { x: 2.6, y: 1.5 }] };
    }
    case "logistico": {
      const w = W(18, 28), z0 = -1.6, z1 = 7.4, terreo = 3.3, andar = 3.3;
      const anexo = { x0: -w / 2, x1: -w / 2 + 8, z0: -7.0, z1: -1.6, h: n * 3.3 + 0.7 };
      return { w, z0, z1, terreo, andar, n, anexo, topo: { x: (anexo.x0 + anexo.x1) / 2, y: anexo.h - 0.64, w: 7.2, d: 4.6, cz: (anexo.z0 + anexo.z1) / 2 }, altura: 11.4,
        letreiro: { x: (anexo.x0 + anexo.x1) / 2, y: n === 1 ? 3.35 : 3.55, z: -7.08, largura: 6.2 }, vidroZ: -6.82, frenteZ: -7.1,
        vitrine: [{ x: anexo.x0 + 1.5, y: 1.45 }, { x: anexo.x0 + 2.9, y: 1.45 }] };
    }
    case "industrial": {
      const w = W(17, 27), z0 = -3.6, z1 = 7.4, terreo = 3.3, andar = 3.3;
      const anexo = { x0: w / 2 - 8, x1: w / 2, z0: -7.2, z1: -3.6, h: n * 3.3 + 0.7 };
      return { w, z0, z1, terreo, andar, n, anexo, topo: { x: (anexo.x0 + anexo.x1) / 2, y: anexo.h - 0.64, w: 7.2, d: 3.0, cz: (anexo.z0 + anexo.z1) / 2 }, altura: 18.5,
        letreiro: { x: (anexo.x0 + anexo.x1) / 2, y: n === 1 ? 3.35 : 3.55, z: -7.28, largura: 6.2 }, vidroZ: -7.02, frenteZ: -7.3,
        vitrine: [{ x: anexo.x1 - 1.5, y: 1.45 }, { x: anexo.x1 - 2.9, y: 1.45 }] };
    }
    case "coworking": {
      const w = W(15, 25), z0 = -6.0, z1 = 6.2, terreo = 3.9, andar = 3.8;
      const topoY = terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.2, d: z1 - z0 - 1.2, cz: (z0 + z1) / 2 }, altura: topoY + 2.4,
        letreiro: { x: 0, y: 3.6, z: -6.18, largura: duplo ? 8 : 6 }, vidroZ: -5.82, frenteZ: -7.7,
        vitrine: duplo ? [{ x: -10.2, y: 1.55 }, { x: -6.8, y: 1.55 }, { x: 6.8, y: 1.55 }, { x: 10.2, y: 1.55 }] : [{ x: -5.1, y: 1.55 }, { x: 5.1, y: 1.55 }] };
    }
    case "cafeteria": {
      const w = W(14, 24), z0 = -4.4, z1 = 6.4, terreo = 4.0, andar = 3.2;
      const topoY = terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.2, d: z1 - z0 - 1.2, cz: (z0 + z1) / 2 }, altura: topoY + (coberturaPlana ? 1.2 : 3.4),
        letreiro: { x: 0, y: 3.72, z: -7.58, largura: duplo ? 8 : 6 }, vidroZ: -4.28, frenteZ: -7.75,
        vitrine: duplo ? [{ x: -8.2, y: 1.35 }, { x: -6.8, y: 1.35 }, { x: 6.8, y: 1.35 }, { x: 8.2, y: 1.35 }] : [{ x: -4.7, y: 1.35 }, { x: -3.3, y: 1.35 }, { x: 3.3, y: 1.35 }, { x: 4.7, y: 1.35 }] };
    }
    case "consultorio": {
      const w = W(15, 25), z0 = -5.6, z1 = 6.0, terreo = 3.6, andar = 3.4, pod = 0.45;
      const topoY = pod + terreo + (n - 1) * andar;
      return { w, z0, z1, terreo, andar, n, topo: { x: 0, y: topoY + 0.06, w: w - 1.2, d: z1 - z0 - 1.2, cz: (z0 + z1) / 2 }, altura: topoY + 1.6,
        letreiro: { x: 0, y: 4.3, z: -7.32, largura: duplo ? 8 : 6 }, vidroZ: -5.5, frenteZ: -7.95,
        vitrine: duplo ? [{ x: -3.0, y: 1.4 }, { x: -1.65, y: 1.4 }, { x: 1.65, y: 1.4 }, { x: 3.0, y: 1.4 }] : [{ x: -1.65, y: 1.4 }, { x: 1.65, y: 1.4 }] };
    }
  }
}
