// Planta do escritório da Nuvem. Unidade: metros. Boneco tem ~1,1 m (estilo chibi).
// Versão compacta (07/11/2026, pedido do Brenno): prédio de 18 x 18 m (1/4 do anterior), corredor central em z=0,
// três salas de 6 m de cada lado, todas abrindo pro corredor.
//   Norte (z<0): Recepção · Gestão de tráfego · Criativos (imagens e vídeo)
//   Sul   (z>0): Consultoria · Diretoria · Sala do CEO (a mesa de reunião fica dentro da sala do CEO)
// Entrada pela porta de vidro na parede oeste; cantinho do café no fim do corredor (leste).
import type { AreaId, Nivel } from "./org";

export type V3 = [number, number, number];

export interface Mesa {
  id: string;
  sala: string;
  pos: V3; // centro da mesa
  rot: number; // rotação em Y (rad). A cadeira fica "atrás" da mesa, olhando pra ela.
  tipo: "comum" | "senior" | "gerente" | "diretor" | "ceo" | "balcao";
}

// O prédio é térreo. O código de andares ficou da versão com 1º andar: tudo aqui é andar 0.
export const ALT_ANDAR = 4.0;
export type Andar = 0 | 1;
export const andarDeY = (y: number): Andar => (y >= ALT_ANDAR / 2 ? 1 : 0);
export const yDoAndar = (a: Andar) => a * ALT_ANDAR;

export interface Sala {
  id: string;
  nome: string;
  area?: AreaId;
  andar: Andar;
  tipo: "recepcao" | "area" | "diretoria" | "ceo";
  x0: number; x1: number; z0: number; z1: number; // retângulo no plano
  entrada: V3; // ponto de entrada (no meio da parede do corredor)
  piso: string;
  vidro?: boolean; // paredes de vidro
}

export const PREDIO = { x0: -9, x1: 9, z0: -9, z1: 9 };
export const CORREDOR = { z0: -1.6, z1: 1.6, x0: -9, x1: 9 };

export const PONTOS = {
  porta: [-8.5, 0, -1.1] as V3, // logo depois da porta de vidro: quem é contratado aparece aqui e quem sai vai embora por aqui
  recepcaoEspera: [-7.2, 0, -3.4] as V3,
  sofaRecepcao: [-8.15, 0, -5.4] as V3,
  mesaReuniao: [6, 0, 4.0] as V3, // mesa redonda da sala do CEO
  cafe: [7.75, 0, 0] as V3, // balcão do café, no fim do corredor
};
export const RAIO_REUNIAO = 1.55; // distância das cadeiras ao centro da mesa de reunião

export const SALAS: Sala[] = [
  // ---- norte ----
  { id: "recepcao", nome: "Recepção", andar: 0, tipo: "recepcao", x0: -9, x1: -3, z0: -9, z1: -1.6, entrada: [-6, 0, -1.6], piso: "#EFEAE2" },
  { id: "trafego", nome: "Gestão de tráfego", area: "trafego", andar: 0, tipo: "area", x0: -3, x1: 3, z0: -9, z1: -1.6, entrada: [0, 0, -1.6], piso: "#DFF3F6" },
  { id: "criativos", nome: "Criativos", area: "criativos", andar: 0, tipo: "area", x0: 3, x1: 9, z0: -9, z1: -1.6, entrada: [6, 0, -1.6], piso: "#FBE6EC" },
  // ---- sul ----
  { id: "consultoria", nome: "Consultoria", area: "consultoria", andar: 0, tipo: "area", x0: -9, x1: -3, z0: 1.6, z1: 9, entrada: [-6, 0, 1.6], piso: "#EDE7F6" },
  { id: "diretoria", nome: "Diretoria", area: "diretoria", andar: 0, tipo: "diretoria", x0: -3, x1: 3, z0: 1.6, z1: 9, entrada: [0, 0, 1.6], piso: "#F6EEDF", vidro: true },
  { id: "ceo", nome: "Sala do CEO", andar: 0, tipo: "ceo", x0: 3, x1: 9, z0: 1.6, z1: 9, entrada: [6, 0, 1.6], piso: "#F6EEDF", vidro: true },
];

export const SALA: Record<string, Sala> = Object.fromEntries(SALAS.map((s) => [s.id, s]));

// Setores com time (as salas "area" da planta), na ordem em que aparecem no menu de contratar/reunião
export const SETORES_ESCRITORIO: AreaId[] = SALAS.filter((s) => s.tipo === "area").map((s) => s.area!);

// Mesas de cada setor (sala de 6 m): 2 fileiras de 2 mesas (open space) + mesa do gerente de lado na parede
// + sala de vidro do sênior no canto do fundo. 6 lugares por setor.
function mesasDaArea(s: Sala): Mesa[] {
  const out: Mesa[] = [];
  const norte = s.z1 <= 0; // sala ao norte do corredor
  const fundo = norte ? s.z0 : s.z1; // parede do fundo
  const dir = norte ? 1 : -1; // sentido "em direção ao corredor"
  const rot = norte ? 0 : Math.PI;
  const colunas = [s.x0 + 3.0, s.x0 + 4.85];
  const fileiras = [4.35, 6.2];
  fileiras.forEach((f, r) => colunas.forEach((x, c) => out.push({ id: `${s.id}-m${r * 2 + c + 1}`, sala: s.id, pos: [x, 0, fundo + dir * f], rot, tipo: "comum" })));
  // gerente: a mesa de lado, encostada na parede lateral, de frente pro time (pedido do Brenno, 20/10)
  out.push({ id: `${s.id}-gerente`, sala: s.id, pos: [s.x0 + 1.4, 0, fundo + dir * 5.4], rot: Math.PI / 2, tipo: "gerente" });
  // sênior: a sala de vidro no canto do fundo, do lado oposto
  out.push({ id: `${s.id}-senior`, sala: s.id, pos: [s.x1 - 1.7, 0, fundo + dir * 1.6], rot, tipo: "senior" });
  return out;
}

export const MESAS: Mesa[] = [
  ...SALAS.filter((s) => s.tipo === "area").flatMap(mesasDaArea),
  // diretoria: 4 mesas de diretor (as cadeiras ficam do lado da parede do fundo, olhando pro corredor)
  { id: "diretoria-d1", sala: "diretoria", pos: [-1.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d2", sala: "diretoria", pos: [1.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d3", sala: "diretoria", pos: [-1.5, 0, 7.0], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d4", sala: "diretoria", pos: [1.5, 0, 7.0], rot: Math.PI, tipo: "diretor" },
  // CEO: mesa no fundo da sala, olhando pra mesa de reunião e pra porta
  { id: "ceo-mesa", sala: "ceo", pos: [6, 0, 7.3], rot: Math.PI, tipo: "ceo" },
  // recepção: a recepcionista fica atrás do balcão (o balcão é desenhado pelo prédio; esta mesa é só o lugar)
  { id: "recepcao-balcao", sala: "recepcao", pos: [-6, 0, -7.0], rot: 0, tipo: "balcao" },
];

export const MESA: Record<string, Mesa> = Object.fromEntries(MESAS.map((m) => [m.id, m]));

// Sala de vidro no canto do fundo (do sênior): retângulo dentro da área
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
  if (area === "recepcao") return mesas.find((m) => !ocupadas.has(m.id));
  const tipo = nivel === "gerente" ? "gerente" : nivel === "senior" ? "senior" : "comum";
  return mesas.find((m) => m.tipo === tipo && !ocupadas.has(m.id)) ?? mesas.find((m) => m.tipo === "comum" && !ocupadas.has(m.id));
}

// Ponto onde o boneco fica em pé/sentado na cadeira da mesa (atrás da mesa)
export function pontoCadeira(m: Mesa): { pos: V3; rot: number } {
  const d = 0.62;
  const x = m.pos[0] - Math.sin(m.rot) * d;
  const z = m.pos[2] - Math.cos(m.rot) * d;
  return { pos: [x, m.pos[1], z], rot: m.rot };
}

// Caminho entre dois pontos usando o corredor (evita atravessar paredes): sai da sala pela porta, anda no eixo do
// corredor e entra na sala de destino pela porta dela.
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
  const ceo = MESA["ceo-mesa"];
  if (nivel === "diretor") return [ceo.pos[0], 0, ceo.pos[2] - 1.1]; // a mesa do CEO olha pro norte: para na frente dela
  if (nivel === "gerente") return [0, 0, 2.6];
  const g = MESA[`${area}-gerente`];
  if (!g) return undefined;
  // a mesa do gerente fica de lado (virada pro leste): o subordinado para na frente dela
  return [g.pos[0] + 1.1, g.pos[1], g.pos[2]];
}
