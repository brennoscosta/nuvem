// Planta do escritório. Unidade: metros. Boneco tem ~1,1 m (estilo chibi).
// Corredor central horizontal em z=0. Salas ao norte (z<0) e ao sul (z>0), todas abrindo pro corredor.
import type { AreaId, Nivel } from "./org";

export type V3 = [number, number, number];

export interface Mesa {
  id: string;
  sala: string;
  pos: V3; // centro da mesa
  rot: number; // rotação em Y (rad). A cadeira fica "atrás" da mesa, olhando pra ela.
  tipo: "comum" | "senior" | "gerente" | "diretor" | "ceo" | "balcao";
}

// Andares: térreo (0) e 1º andar (1). Toda posição no 1º andar tem y = ALT_ANDAR.
export const ALT_ANDAR = 4.0;
export const ANDARES = [0, 1] as const;
export type Andar = (typeof ANDARES)[number];
export const andarDeY = (y: number): Andar => (y >= ALT_ANDAR / 2 ? 1 : 0);
export const yDoAndar = (a: Andar) => a * ALT_ANDAR;

export interface Sala {
  id: string;
  nome: string;
  area?: AreaId;
  andar: Andar;
  tipo: "recepcao" | "hall" | "area" | "gerencia" | "diretoria" | "ceo" | "reuniao" | "copa" | "lounge" | "auditorio";
  x0: number; x1: number; z0: number; z1: number; // retângulo no plano
  entrada: V3; // ponto de entrada (junto ao corredor)
  piso: string;
  vidro?: boolean; // paredes de vidro
}

export const CORREDOR = { z0: -1.6, z1: 1.6, x0: -36, x1: 36 };

// O prédio tem 72 m (x de -36 a 36), um corredor central em z=0. Ala oeste (x<0): recepção, Desenvolvimento, Criação,
// reunião, CEO, Vendas, Atendimento, Diretoria, copa, lounge. Ala leste (x>0): Planejamento, Social, Tráfego, Análise,
// Financeiro, RH, Jurídico, Auditório.
export const PREDIO = { x0: -36, x1: 36, z0: -9, z1: 9 };
export const PONTOS = {
  elevador: [-35.2, 0, -5.5] as V3, // porta do elevador (recepção)
  elevador1: [-35.2, ALT_ANDAR, -5.5] as V3, // (reservado) mesma porta num andar superior
  recepcaoEspera: [-32, 0, -3] as V3,
  hallEspera: [-32, ALT_ANDAR, -3] as V3,
  mesaReuniao: [-8.5, 0, -5.2] as V3,
  copaBalcao: [-9.5, 0, 5.2] as V3,
  loungeSofa: [-4.5, 0, 6.2] as V3,
  loungeSinuca: [-2.8, 0, 3.6] as V3,
  loungeFliperama: [-6.4, 0, 8.3] as V3,
  caixaSaida: [-35.2, 0, -5.5] as V3,
};
export const elevadorNoAndar = (a: Andar): V3 => (a === 1 ? PONTOS.elevador1 : PONTOS.elevador);
export const esperaNoAndar = (a: Andar): V3 => (a === 1 ? PONTOS.hallEspera : PONTOS.recepcaoEspera);

export const SALAS: Sala[] = [
  // ---- ala oeste ---- Norte
  { id: "recepcao", nome: "Recepção", andar: 0, tipo: "recepcao", x0: -36, x1: -28, z0: -9, z1: -1.6, entrada: [-32, 0, -1.6], piso: "#EFEAE2" },
  { id: "desenvolvimento", nome: "Desenvolvimento", area: "desenvolvimento", andar: 0, tipo: "area", x0: -28, x1: -19, z0: -9, z1: -1.6, entrada: [-23.5, 0, -1.6], piso: "#E4EBFB" },
  { id: "criacao", nome: "Criação", area: "criacao", andar: 0, tipo: "area", x0: -19, x1: -11, z0: -9, z1: -1.6, entrada: [-15, 0, -1.6], piso: "#FBE6EC" },
  { id: "reuniao", nome: "Sala de reunião", andar: 0, tipo: "reuniao", x0: -11, x1: -6, z0: -9, z1: -1.6, entrada: [-8.5, 0, -1.6], piso: "#ECEFF4", vidro: true },
  { id: "ceo", nome: "Sala do CEO", andar: 0, tipo: "ceo", x0: -6, x1: 0, z0: -9, z1: -1.6, entrada: [-3, 0, -1.6], piso: "#F6EEDF", vidro: true },
  // ---- ala oeste ---- Sul
  { id: "vendas", nome: "Vendas", area: "vendas", andar: 0, tipo: "area", x0: -36, x1: -27, z0: 1.6, z1: 9, entrada: [-31.5, 0, 1.6], piso: "#E2F4EA" },
  { id: "atendimento", nome: "Atendimento", area: "atendimento", andar: 0, tipo: "area", x0: -27, x1: -18, z0: 1.6, z1: 9, entrada: [-22.5, 0, 1.6], piso: "#DFF4F0" },
  { id: "diretoria", nome: "Diretoria", area: "diretoria", andar: 0, tipo: "diretoria", x0: -18, x1: -12, z0: 1.6, z1: 9, entrada: [-15, 0, 1.6], piso: "#F6EEDF", vidro: true },
  { id: "copa", nome: "Copa", andar: 0, tipo: "copa", x0: -12, x1: -7, z0: 1.6, z1: 9, entrada: [-9.5, 0, 1.6], piso: "#E9F2E4" },
  { id: "lounge", nome: "Lounge & jogos", andar: 0, tipo: "lounge", x0: -7, x1: 0, z0: 1.6, z1: 9, entrada: [-3.5, 0, 1.6], piso: "#F1E7DC" },
  // ---- ala leste ---- Norte (5 salas de 7,2 m)
  { id: "planejamento", nome: "Planejamento", area: "planejamento", andar: 0, tipo: "area", x0: 0, x1: 7.2, z0: -9, z1: -1.6, entrada: [3.6, 0, -1.6], piso: "#E4E6F7" },
  { id: "social", nome: "Social media", area: "social", andar: 0, tipo: "area", x0: 7.2, x1: 14.4, z0: -9, z1: -1.6, entrada: [10.8, 0, -1.6], piso: "#FDEBDD" },
  { id: "trafego", nome: "Gestão de tráfego", area: "trafego", andar: 0, tipo: "area", x0: 14.4, x1: 21.6, z0: -9, z1: -1.6, entrada: [18, 0, -1.6], piso: "#DFF3F6" },
  { id: "analise", nome: "Análise", area: "analise", andar: 0, tipo: "area", x0: 21.6, x1: 28.8, z0: -9, z1: -1.6, entrada: [25.2, 0, -1.6], piso: "#ECE6FB" },
  { id: "webdesign", nome: "Web design", area: "webdesign", andar: 0, tipo: "area", x0: 28.8, x1: 36, z0: -9, z1: -1.6, entrada: [32.4, 0, -1.6], piso: "#EDE7F6" },
  // ---- ala leste ---- Sul (5 salas de 7,2 m)
  { id: "financeiro", nome: "Financeiro", area: "financeiro", andar: 0, tipo: "area", x0: 0, x1: 7.2, z0: 1.6, z1: 9, entrada: [3.6, 0, 1.6], piso: "#E0F0E1" },
  { id: "rh", nome: "RH & Cultura", area: "rh", andar: 0, tipo: "area", x0: 7.2, x1: 14.4, z0: 1.6, z1: 9, entrada: [10.8, 0, 1.6], piso: "#FBE4EC" },
  { id: "juridico", nome: "Jurídico", area: "juridico", andar: 0, tipo: "area", x0: 14.4, x1: 21.6, z0: 1.6, z1: 9, entrada: [18, 0, 1.6], piso: "#EFE7E3", vidro: true },
  { id: "designgrafico", nome: "Design gráfico", area: "designgrafico", andar: 0, tipo: "area", x0: 21.6, x1: 28.8, z0: 1.6, z1: 9, entrada: [25.2, 0, 1.6], piso: "#FBE9E7" },
  { id: "auditorio", nome: "Auditório", andar: 0, tipo: "auditorio", x0: 28.8, x1: 36, z0: 1.6, z1: 9, entrada: [32.4, 0, 1.6], piso: "#E8E4F0", vidro: true },
];

export const SALA: Record<string, Sala> = Object.fromEntries(SALAS.map((s) => [s.id, s]));

// Mesas de cada área: 2 fileiras de 3 mesas (open space) + mesa do gerente de lado na parede + sala de vidro do sênior no fundo.
function mesasDaArea(s: Sala): Mesa[] {
  const out: Mesa[] = [];
  const norte = s.z1 <= 0; // sala ao norte do corredor
  const y = yDoAndar(s.andar);
  const larg = s.x1 - s.x0;
  const passo = larg >= 8.5 ? 2.4 : 2.1; // salas mais estreitas (1º andar) com mesas mais juntas
  const cx = (s.x0 + s.x1) / 2;
  const fundo = norte ? s.z0 : s.z1; // parede do fundo
  const dir = norte ? 1 : -1; // sentido "em direção ao corredor"
  // open space: 2 fileiras (z) x 3 (x); cadeiras viradas pra parede do fundo (quem olha vê o rosto de quem trabalha)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = cx - passo + c * passo;
    const z = fundo + dir * (2.4 + r * 2.3);
    out.push({ id: `${s.id}-m${r * 3 + c + 1}`, sala: s.id, pos: [x, y, z], rot: norte ? 0 : Math.PI, tipo: "comum" });
  }
  // gerente: a mesa de lado, encostada na parede lateral, de frente pro time (pedido do Brenno, 20/10)
  out.push({ id: `${s.id}-gerente`, sala: s.id, pos: [s.x0 + 1.4, y, fundo + dir * 5.5], rot: Math.PI / 2, tipo: "gerente" });
  // sênior: a sala de vidro no canto do fundo, do lado oposto
  out.push({ id: `${s.id}-senior`, sala: s.id, pos: [s.x1 - 1.7, y, fundo + dir * 1.6], rot: norte ? 0 : Math.PI, tipo: "senior" });
  return out;
}

export const MESAS: Mesa[] = [
  ...SALAS.filter((s) => s.tipo === "area").flatMap(mesasDaArea),
  // diretoria: 4 mesas de diretor
  { id: "diretoria-d1", sala: "diretoria", pos: [-16.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d2", sala: "diretoria", pos: [-13.5, 0, 3.6], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d3", sala: "diretoria", pos: [-16.5, 0, 7], rot: Math.PI, tipo: "diretor" },
  { id: "diretoria-d4", sala: "diretoria", pos: [-13.5, 0, 7], rot: Math.PI, tipo: "diretor" },
  // CEO
  { id: "ceo-mesa", sala: "ceo", pos: [-3, 0, -6.2], rot: 0, tipo: "ceo" },
  // recepção: a recepcionista fica atrás do balcão (o balcão já é desenhado pelo prédio; esta mesa é só o lugar)
  { id: "recepcao-balcao", sala: "recepcao", pos: [-31.5, 0, -7.2], rot: 0, tipo: "balcao" },
];

export const MESA: Record<string, Mesa> = Object.fromEntries(MESAS.map((m) => [m.id, m]));

// Sala de vidro no canto do fundo (hoje do sênior): retângulo dentro da área
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

// Caminho entre dois pontos usando o corredor (evita atravessar paredes). Entre andares, passa pelo elevador:
// anda até a porta do elevador no andar de origem, "sobe/desce" (trecho vertical) e sai pela porta no andar de destino.
export function caminho(de: V3, para: V3): V3[] {
  const aDe = andarDeY(de[1]), aPara = andarDeY(para[1]);
  if (aDe !== aPara) {
    const e1 = elevadorNoAndar(aDe), e2 = elevadorNoAndar(aPara);
    return [...caminhoNoAndar(de, e1), e2, ...caminhoNoAndar(e2, para).slice(1)];
  }
  return caminhoNoAndar(de, para);
}
function caminhoNoAndar(de: V3, para: V3): V3[] {
  const y = yDoAndar(andarDeY(de[1]));
  const salaDe = salaDoPonto(de), salaPara = salaDoPonto(para);
  if (salaDe && salaPara && salaDe.id === salaPara.id) return [de, para];
  const pts: V3[] = [de];
  if (salaDe) pts.push(salaDe.entrada, [salaDe.entrada[0], y, 0]);
  else pts.push([de[0], y, 0]);
  if (salaPara) pts.push([salaPara.entrada[0], y, 0], salaPara.entrada);
  else pts.push([para[0], y, 0]);
  pts.push(para);
  return pts;
}

export function salaDoPonto(p: V3): Sala | undefined {
  const a = andarDeY(p[1]);
  return SALAS.find((s) => s.andar === a && p[0] >= s.x0 && p[0] <= s.x1 && p[2] >= Math.min(s.z0, s.z1) && p[2] <= Math.max(s.z0, s.z1));
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
  if (nivel === "gerente") return [-15, 0, 5.3];
  const g = MESA[`${area}-gerente`];
  if (!g) return undefined;
  // a mesa do gerente fica de lado (virada pro leste): o subordinado para na frente dela
  return [g.pos[0] + 1.1, g.pos[1], g.pos[2]];
}
