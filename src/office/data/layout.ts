// Planta do escritório. Unidade: metros. Boneco tem ~1,1 m (estilo chibi).
// Corredor central horizontal em z=0. Salas ao norte (z<0) e ao sul (z>0), todas abrindo pro corredor.
import type { AreaId, Nivel } from "./org";

export type V3 = [number, number, number];

export interface Mesa {
  id: string;
  sala: string;
  pos: V3; // centro da mesa
  rot: number; // rotação em Y (rad). A cadeira fica "atrás" da mesa, olhando pra ela.
  tipo: "comum" | "senior" | "gerente" | "diretor" | "ceo";
}

export interface Sala {
  id: string;
  nome: string;
  area?: AreaId;
  tipo: "recepcao" | "area" | "gerencia" | "diretoria" | "ceo" | "reuniao" | "copa" | "lounge";
  x0: number; x1: number; z0: number; z1: number; // retângulo no plano
  entrada: V3; // ponto de entrada (junto ao corredor)
  piso: string;
  vidro?: boolean; // paredes de vidro
}

export const CORREDOR = { z0: -1.6, z1: 1.6, x0: -18, x1: 18 };

export const PONTOS = {
  elevador: [-17.2, 0, -5.5] as V3, // porta do elevador (recepção)
  recepcaoEspera: [-14, 0, -3] as V3,
  mesaReuniao: [9.5, 0, -5.2] as V3,
  copaBalcao: [8.5, 0, 5.2] as V3,
  loungeSofa: [13.5, 0, 6.2] as V3,
  loungeSinuca: [15.2, 0, 3.6] as V3,
  loungeFliperama: [11.6, 0, 8.3] as V3,
  caixaSaida: [-17.2, 0, -5.5] as V3,
};

export const SALAS: Sala[] = [
  // Norte
  { id: "recepcao", nome: "Recepção", tipo: "recepcao", x0: -18, x1: -10, z0: -9, z1: -1.6, entrada: [-14, 0, -1.6], piso: "#EFEAE2" },
  { id: "engenharia", nome: "Engenharia", area: "engenharia", tipo: "area", x0: -10, x1: -1, z0: -9, z1: -1.6, entrada: [-5.5, 0, -1.6], piso: "#E4EBFB" },
  { id: "marketing", nome: "Marketing", area: "marketing", tipo: "area", x0: -1, x1: 7, z0: -9, z1: -1.6, entrada: [3, 0, -1.6], piso: "#FBE6EC" },
  { id: "reuniao", nome: "Sala de reunião", tipo: "reuniao", x0: 7, x1: 12, z0: -9, z1: -1.6, entrada: [9.5, 0, -1.6], piso: "#ECEFF4", vidro: true },
  { id: "ceo", nome: "Sala do CEO", tipo: "ceo", x0: 12, x1: 18, z0: -9, z1: -1.6, entrada: [15, 0, -1.6], piso: "#F6EEDF", vidro: true },
  // Sul
  { id: "vendas", nome: "Vendas", area: "vendas", tipo: "area", x0: -18, x1: -9, z0: 1.6, z1: 9, entrada: [-13.5, 0, 1.6], piso: "#E2F4EA" },
  { id: "suporte", nome: "Suporte", area: "suporte", tipo: "area", x0: -9, x1: 0, z0: 1.6, z1: 9, entrada: [-4.5, 0, 1.6], piso: "#ECE6FB" },
  { id: "diretoria", nome: "Diretoria", area: "diretoria", tipo: "diretoria", x0: 0, x1: 6, z0: 1.6, z1: 9, entrada: [3, 0, 1.6], piso: "#F6EEDF", vidro: true },
  { id: "copa", nome: "Copa", tipo: "copa", x0: 6, x1: 11, z0: 1.6, z1: 9, entrada: [8.5, 0, 1.6], piso: "#E9F2E4" },
  { id: "lounge", nome: "Lounge & jogos", tipo: "lounge", x0: 11, x1: 18, z0: 1.6, z1: 9, entrada: [14.5, 0, 1.6], piso: "#F1E7DC" },
];

export const SALA: Record<string, Sala> = Object.fromEntries(SALAS.map((s) => [s.id, s]));

// Mesas de cada área: 2 fileiras de 3 mesas (open space) + 1 mesa sênior + sala de vidro do gerente no fundo.
function mesasDaArea(s: Sala): Mesa[] {
  const out: Mesa[] = [];
  const norte = s.z1 <= 0; // sala ao norte do corredor
  const cx = (s.x0 + s.x1) / 2;
  const fundo = norte ? s.z0 : s.z1; // parede do fundo
  const dir = norte ? 1 : -1; // sentido "em direção ao corredor"
  // open space: 2 fileiras (z) x 3 (x); cadeiras viradas pra parede do fundo (quem olha vê o rosto de quem trabalha)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = cx - 2.4 + c * 2.4;
    const z = fundo + dir * (2.4 + r * 2.3);
    out.push({ id: `${s.id}-m${r * 3 + c + 1}`, sala: s.id, pos: [x, 0, z], rot: norte ? 0 : Math.PI, tipo: "comum" });
  }
  // sênior: mesa maior, junto à parede lateral
  out.push({ id: `${s.id}-senior`, sala: s.id, pos: [s.x0 + 1.4, 0, fundo + dir * 5.5], rot: Math.PI / 2, tipo: "senior" });
  // gerente: sala de vidro no canto do fundo, do lado oposto
  out.push({ id: `${s.id}-gerente`, sala: s.id, pos: [s.x1 - 1.7, 0, fundo + dir * 1.6], rot: norte ? 0 : Math.PI, tipo: "gerente" });
  return out;
}

export const MESAS: Mesa[] = [
  ...SALAS.filter((s) => s.tipo === "area").flatMap(mesasDaArea),
  // diretoria: 4 mesas de diretor
  { id: "diretoria-d1", sala: "diretoria", pos: [1.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d2", sala: "diretoria", pos: [4.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d3", sala: "diretoria", pos: [1.5, 0, 7], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d4", sala: "diretoria", pos: [4.5, 0, 7], rot: Math.PI, tipo: "diretor" },
  // CEO
  { id: "ceo-mesa", sala: "ceo", pos: [15, 0, -6.2], rot: 0, tipo: "ceo" },
];

export const MESA: Record<string, Mesa> = Object.fromEntries(MESAS.map((m) => [m.id, m]));

// Sala de vidro do gerente: retângulo dentro da área
export function salaGerente(s: Sala) {
  const norte = s.z1 <= 0;
  const fundo = norte ? s.z0 : s.z1;
  const dir = norte ? 1 : -1;
  return norte
    ? { x0: s.x1 - 3.4, x1: s.x1, z0: fundo, z1: fundo + dir * 3.2 }
    : { x0: s.x1 - 3.4, x1: s.x1, z0: fundo + dir * 3.2, z1: fundo };
}

// Onde cada nível senta
export function mesaParaNivel(area: AreaId, nivel: Nivel, ocupadas: Set<string>): Mesa | undefined {
  if (nivel === "ceo") return MESA["ceo-mesa"];
  if (nivel === "diretor") return MESAS.find((m) => m.sala === "diretoria" && !ocupadas.has(m.id));
  const mesas = MESAS.filter((m) => m.sala === area);
  const tipo = nivel === "gerente" ? "gerente" : nivel === "senior" ? "senior" : "comum";
  return mesas.find((m) => m.tipo === tipo && !ocupadas.has(m.id)) ?? mesas.find((m) => m.tipo === "comum" && !ocupadas.has(m.id));
}

// Ponto onde o boneco fica em pé/sentado na cadeira da mesa (atrás da mesa)
export function pontoCadeira(m: Mesa): { pos: V3; rot: number } {
  const d = 0.62;
  const x = m.pos[0] - Math.sin(m.rot) * d;
  const z = m.pos[2] - Math.cos(m.rot) * d;
  return { pos: [x, 0, z], rot: m.rot };
}

// Caminho entre dois pontos usando o corredor (evita atravessar paredes).
export function caminho(de: V3, para: V3): V3[] {
  const salaDe = salaDoPonto(de), salaPara = salaDoPonto(para);
  if (salaDe && salaPara && salaDe.id === salaPara.id) return [de, para];
  const pts: V3[] = [de];
  if (salaDe) pts.push(salaDe.entrada, [salaDe.entrada[0], 0, 0]);
  else pts.push([de[0], 0, 0]);
  if (salaPara) pts.push([salaPara.entrada[0], 0, 0], salaPara.entrada);
  else pts.push([para[0], 0, 0]);
  pts.push(para);
  return pts;
}

export function salaDoPonto(p: V3): Sala | undefined {
  return SALAS.find((s) => p[0] >= s.x0 && p[0] <= s.x1 && p[2] >= Math.min(s.z0, s.z1) && p[2] <= Math.max(s.z0, s.z1));
}

export function salaDoNivel(area: AreaId, nivel: Nivel): string {
  if (nivel === "ceo") return "ceo";
  if (nivel === "diretor") return "diretoria";
  return area;
}

export function mesaDoChefe(area: AreaId, nivel: Nivel): V3 | undefined {
  // onde o subordinado vai pedir revisão: gerente da área; gerente vai à diretoria; diretor vai ao CEO
  if (nivel === "ceo") return undefined;
  if (nivel === "diretor") return [MESA["ceo-mesa"].pos[0], 0, MESA["ceo-mesa"].pos[2] + 1.1];
  if (nivel === "gerente") return [3, 0, 5.3];
  const g = MESA[`${area}-gerente`];
  const norte = SALA[area].z1 <= 0;
  return [g.pos[0], 0, g.pos[2] + (norte ? 1.1 : -1.1)];
}
