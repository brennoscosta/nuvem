// Planta interna da lanchonete drive-thru (quarteirão a leste da Nuvem). Unidade: metros, coordenadas do mundo.
// O prédio (modelo do Higgsfield) tem 17,4 x 14,3 m, centro em (58, -5), frente (vitrine e porta) virada pro oeste
// e a janela do drive-thru no lado sul. Por dentro: salão na frente (oeste), balcão no meio, cozinha nos fundos (leste),
// posto do drive-thru e escritório do gerente na faixa sul. Os lugares da equipe ficam aqui pra quando ela existir.
import { centroQuarteirao } from "./mundo";

const [CX, CZ] = centroQuarteirao(1, 0);
export const LANCH = {
  centro: [CX + 6, CZ - 5] as [number, number],
  x0: CX + 6 - 8.7, x1: CX + 6 + 8.7, z0: CZ - 5 - 7.15, z1: CZ - 5 + 7.15,
  altura: 8.5,
};
// divisões internas (x)
export const BALCAO_X = LANCH.x0 + 9.2; // linha do balcão (frente do balcão olha pro oeste)
export const COZINHA_X0 = BALCAO_X + 0.9;
export const FAIXA_SUL_Z = LANCH.z1 - 3.6; // começo da faixa sul (drive-thru + escritório)
export const DRIVE_X1 = LANCH.x0 + 13.4; // divisa entre o posto do drive-thru e o escritório do gerente
export const PORTA = { z: LANCH.z0 + 4.6, largura: 2.2 }; // porta de entrada na parede oeste
export const JANELA_DRIVE = { x: LANCH.x0 + 11.0, largura: 1.6 }; // janela na parede sul

export interface LugarLanchonete { id: string; nome: string; pos: [number, number, number]; rot: number }
// rot: pra onde o funcionário olha (0 = +z, π/2 = -x... mesma convenção das mesas do escritório)
export const LUGARES_LANCHONETE: LugarLanchonete[] = [
  { id: "caixa-1", nome: "Caixa 1", pos: [BALCAO_X + 0.55, 0, LANCH.z0 + 2.6], rot: Math.PI / 2 },
  { id: "caixa-2", nome: "Caixa 2", pos: [BALCAO_X + 0.55, 0, LANCH.z0 + 6.4], rot: Math.PI / 2 },
  { id: "cozinha-1", nome: "Chapa", pos: [LANCH.x1 - 1.3, 0, LANCH.z0 + 2.4], rot: -Math.PI / 2 },
  { id: "cozinha-2", nome: "Montagem", pos: [COZINHA_X0 + 2.2, 0, LANCH.z0 + 6.6], rot: Math.PI },
  { id: "drive", nome: "Drive-thru", pos: [JANELA_DRIVE.x, 0, LANCH.z1 - 1.1], rot: 0 },
  { id: "gerente", nome: "Gerente", pos: [DRIVE_X1 + 1.9, 0, FAIXA_SUL_Z + 1.9], rot: Math.PI },
];
