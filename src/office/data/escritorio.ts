// O escritório do cliente num lote pago. O dono escolhe o layout (jeito do prédio), os setores e a equipe; todo
// escritório nasce com uma atendente e um CEO. Tudo é editável no painel "Montar escritório" e a cena desenha ao vivo.
// Compartilhado por servidor (validação) e cliente (painel e cena). Unidade: metros, no sistema local do lote
// (origem no centro do lote, frente = -z; a cena gira pela rua mais próxima).
import { BONECOS } from "./bonecos";

export type LayoutId = "moderno" | "sobrado" | "loja";
export interface LayoutInfo { id: LayoutId; nome: string; descricao: string; altura: number; andares: 1 | 2 }
export const LAYOUTS: LayoutInfo[] = [
  { id: "moderno", nome: "Térreo moderno", descricao: "Caixa branca com vitrine de vidro, faixa na sua cor e laje plana.", altura: 4.2, andares: 1 },
  { id: "sobrado", nome: "Sobrado comercial", descricao: "Dois andares, janelas em fita e letreiro no alto. Parece maior.", altura: 7.4, andares: 2 },
  { id: "loja", nome: "Loja de rua", descricao: "Fachada com toldo listrado na sua cor e porta de vidro bem na calçada.", altura: 4.6, andares: 1 },
];
export const LAYOUT: Record<LayoutId, LayoutInfo> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l])) as Record<LayoutId, LayoutInfo>;

export interface Setor { id: string; nome: string; cor: string; mesas: number } // mesas: 1..4
export type PapelMembro = "atendente" | "ceo" | "profissional";
export interface Treino { descricao: string; saudacao: string } // o que a pessoa sabe/faz e como cumprimenta (base do atendimento)
export interface Membro { id: string; nome: string; cargo: string; papel: PapelMembro; setorId: string | null; boneco: string; camisa: string; treino?: Treino }
export interface Escritorio { layout: LayoutId; setores: Setor[]; equipe: Membro[] }

export const MAX_SETORES = 4; // cabe num lote de 20 × 20 (prédio de 16 × 14)
export const MAX_MESAS_SETOR = 4;
export const CORES_SETOR = ["#DFF3F6", "#FBE6EC", "#EDE7F6", "#F6EEDF", "#E3F6EA", "#FFF4D6"];
export const CARGOS_SUGERIDOS = ["Atendimento", "Vendas", "Marketing", "Financeiro", "Suporte", "Design", "Jurídico", "Logística", "Orçamentos", "Agendamentos"];

const novoId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
// Nomes neutros quando o dono ainda não escolheu (variam por empresa, pra não ser todo mundo igual)
const NOMES_CEO = ["Marcos", "Júlia", "Rafael", "Camila", "Lucas", "Beatriz", "Felipe", "Larissa"];
const NOMES_ATENDENTE = ["Ana", "Paula", "Bruno", "Carla", "Diego", "Lívia"];
const BONECOS_CEO = ["classico", "oculos", "careca", "ruivo"];
const BONECOS_ATENDENTE = ["coque", "longo", "suporte-1", "classico"];
const hash = (s: string) => Math.abs([...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));

// O que todo escritório tem ao nascer: 1 setor de atendimento, a atendente e o CEO. Os nomes vêm do que o dono
// escolheu ao montar a empresa; se não escolheu, entram nomes neutros que ele troca no painel.
export function escritorioPadrao(empresaNome: string, cor: string, nomes: { ceo?: string | null; atendente?: string | null } = {}): Escritorio {
  const h = hash(empresaNome + cor);
  const ceo = (nomes.ceo ?? "").trim().slice(0, 24) || NOMES_CEO[h % NOMES_CEO.length];
  const atendente = (nomes.atendente ?? "").trim().slice(0, 24) || NOMES_ATENDENTE[(h >> 3) % NOMES_ATENDENTE.length];
  return {
    layout: "moderno",
    setores: [{ id: "atendimento", nome: "Atendimento", cor: CORES_SETOR[0], mesas: 2 }],
    equipe: [
      { id: "atendente", nome: atendente, cargo: "Atendente", papel: "atendente", setorId: null, boneco: BONECOS_ATENDENTE[(h >> 5) % BONECOS_ATENDENTE.length], camisa: cor, treino: { descricao: `Atende quem chega na ${empresaNome}: explica o que a empresa faz, tira dúvidas e anota o contato de quem quer orçamento.`, saudacao: `Olá! Bem-vindo à ${empresaNome}. Em que posso ajudar?` } },
      { id: "ceo", nome: ceo, cargo: `CEO da ${empresaNome}`.slice(0, 40), papel: "ceo", setorId: null, boneco: BONECOS_CEO[(h >> 7) % BONECOS_CEO.length], camisa: "#1F2630", treino: { descricao: `Comanda a ${empresaNome}: decide prioridades, fecha negócios maiores e cuida da equipe.`, saudacao: "" } },
    ],
  };
}

const bonecoOk = (id: unknown) => (typeof id === "string" && BONECOS.some((b) => b.id === id) ? id : "classico");
const corOk = (c: unknown, padrao: string) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : padrao);
const texto = (t: unknown, max: number, padrao = "") => (typeof t === "string" ? t.trim().slice(0, max) : padrao) || padrao;

// Limpa o que veio do cliente: tamanhos, limites e referências. Nunca lança; devolve algo válido.
export function normalizarEscritorio(x: unknown, base: Escritorio): Escritorio {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Escritorio, unknown>>;
  const layout = (LAYOUTS.some((l) => l.id === o.layout) ? o.layout : base.layout) as LayoutId;
  const setoresIn = Array.isArray(o.setores) ? (o.setores as unknown[]) : base.setores;
  const setores: Setor[] = [];
  for (const s of setoresIn.slice(0, MAX_SETORES)) {
    const r = (s && typeof s === "object" ? s : {}) as Partial<Record<keyof Setor, unknown>>;
    const id = texto(r.id, 24, novoId("set")).replace(/[^a-zA-Z0-9_-]/g, "") || novoId("set");
    if (setores.some((t) => t.id === id)) continue;
    const mesas = Math.max(1, Math.min(MAX_MESAS_SETOR, Number(r.mesas) || 2));
    setores.push({ id, nome: texto(r.nome, 28, "Setor"), cor: corOk(r.cor, CORES_SETOR[setores.length % CORES_SETOR.length]), mesas });
  }
  if (setores.length === 0) setores.push({ id: "atendimento", nome: "Atendimento", cor: CORES_SETOR[0], mesas: 2 });
  const equipeIn = Array.isArray(o.equipe) ? (o.equipe as unknown[]) : base.equipe;
  const equipe: Membro[] = [];
  const vagas: Record<string, number> = Object.fromEntries(setores.map((s) => [s.id, s.mesas]));
  for (const m of equipeIn.slice(0, 2 + MAX_SETORES * MAX_MESAS_SETOR)) {
    const r = (m && typeof m === "object" ? m : {}) as Partial<Record<keyof Membro, unknown>>;
    const papel: PapelMembro = r.papel === "atendente" || r.papel === "ceo" ? r.papel : "profissional";
    if ((papel === "atendente" || papel === "ceo") && equipe.some((e) => e.papel === papel)) continue; // só um de cada
    let setorId: string | null = null;
    if (papel === "profissional") {
      setorId = typeof r.setorId === "string" && vagas[r.setorId] > 0 ? r.setorId : setores.find((s) => vagas[s.id] > 0)?.id ?? null;
      if (!setorId) continue; // sem mesa, sem profissional
      vagas[setorId]--;
    }
    const id = texto(r.id, 24, papel === "profissional" ? novoId("mem") : papel).replace(/[^a-zA-Z0-9_-]/g, "") || novoId("mem");
    if (equipe.some((e) => e.id === id)) continue;
    const tr = (r.treino && typeof r.treino === "object" ? r.treino : {}) as Partial<Record<keyof Treino, unknown>>;
    equipe.push({ id, nome: texto(r.nome, 24, papel === "ceo" ? "CEO" : papel === "atendente" ? "Ana" : "Novo"), cargo: texto(r.cargo, 40, papel === "ceo" ? "CEO" : papel === "atendente" ? "Atendente" : "Profissional"), papel, setorId, boneco: bonecoOk(r.boneco), camisa: corOk(r.camisa, papel === "ceo" ? "#1F2630" : "#1D4ED8"), treino: { descricao: texto(tr.descricao, 600), saudacao: texto(tr.saudacao, 160) } });
  }
  // a atendente e o CEO são obrigatórios: se sumiram, voltam os do padrão
  for (const p of ["atendente", "ceo"] as const) if (!equipe.some((e) => e.papel === p)) equipe.unshift(base.equipe.find((e) => e.papel === p) ?? escritorioPadrao("Empresa", "#1D4ED8").equipe.find((e) => e.papel === p)!);
  equipe.sort((a, b) => ordem(a.papel) - ordem(b.papel));
  return { layout, setores, equipe };
}
const ordem = (p: PapelMembro) => (p === "atendente" ? 0 : p === "ceo" ? 1 : 2);

// ---- Planta (igual pra todo layout; o layout muda o lado de fora) ----
// Prédio de 16 (x) × 14 (z). Frente em z = -7 (rua). Faixa da frente: Recepção à esquerda, hall no meio, Sala do CEO à
// direita. Fundo: os setores em 1, 2, 3 ou 4 salas. Mesa: rot 0 = quem senta fica em -z olhando pra +z (convenção de layout.ts).
export const PREDIO_CLIENTE = { x0: -8, x1: 8, z0: -7, z1: 7 };
export const ALT_PAREDE_CLIENTE = 1.15; // paredes baixas (cutaway) na vista por dentro
export interface MesaCliente { pos: [number, number, number]; rot: number; tipo: "comum" | "ceo" }
export interface SalaCliente { id: string; nome: string; tipo: "recepcao" | "hall" | "ceo" | "setor"; cor: string; x0: number; x1: number; z0: number; z1: number; mesas: MesaCliente[]; setor?: Setor }
export interface Lugar { pos: [number, number, number]; rot: number; sala: string; emPe?: boolean }
export interface PlantaCliente { salas: SalaCliente[]; porta: [number, number]; balcao: [number, number]; lugares: Record<string, Lugar> }

const cadeiraDe = (m: MesaCliente): { pos: [number, number, number]; rot: number } => ({ pos: [m.pos[0] - Math.sin(m.rot) * 0.62, 0, m.pos[2] - Math.cos(m.rot) * 0.62], rot: m.rot });

export function plantaCliente(e: Escritorio): PlantaCliente {
  const { x0, x1, z0, z1 } = PREDIO_CLIENTE;
  const zMeio = -1.5; // divisa entre a faixa da frente e o fundo
  const mesaCeo: MesaCliente = { pos: [5.4, 0, -3.6], rot: Math.PI, tipo: "ceo" }; // CEO sentado atrás, olhando pra rua
  const salas: SalaCliente[] = [
    { id: "recepcao", nome: "Recepção", tipo: "recepcao", cor: "#EFEAE2", x0, x1: -2.2, z0, z1: zMeio, mesas: [] },
    { id: "hall", nome: "Hall", tipo: "hall", cor: "#E9E6E0", x0: -2.2, x1: 2.2, z0, z1: zMeio, mesas: [] },
    { id: "ceo", nome: "Sala do CEO", tipo: "ceo", cor: "#F6EEDF", x0: 2.2, x1, z0, z1: zMeio, mesas: [mesaCeo] },
  ];
  const n = Math.max(1, Math.min(MAX_SETORES, e.setores.length));
  const caixas: [number, number, number, number][] = n === 1 ? [[x0, x1, zMeio, z1]] : n === 2 ? [[x0, 0, zMeio, z1], [0, x1, zMeio, z1]] : n === 3 ? [[x0, 0, zMeio, z1], [0, x1, zMeio, 2.75], [0, x1, 2.75, z1]] : [[x0, 0, zMeio, 2.75], [0, x1, zMeio, 2.75], [x0, 0, 2.75, z1], [0, x1, 2.75, z1]];
  e.setores.slice(0, n).forEach((s, i) => {
    const [sx0, sx1, sz0, sz1] = caixas[i];
    const cx = (sx0 + sx1) / 2, cz = (sz0 + sz1) / 2, larg = sx1 - sx0, prof = sz1 - sz0;
    const mesas: MesaCliente[] = [];
    const passoX = Math.min(2.3, larg / 2.2), passoZ = Math.min(2.2, prof / 2.2);
    for (let k = 0; k < s.mesas; k++) {
      const col = k % 2, lin = Math.floor(k / 2);
      const px = s.mesas === 1 ? cx : cx + (col ? 1 : -1) * passoX / 2;
      const pz = s.mesas <= 2 ? cz + 0.3 : cz + (lin ? 1 : -1) * passoZ / 2 + 0.3;
      mesas.push({ pos: [px, 0, pz], rot: 0, tipo: "comum" }); // todos olhando pro fundo da sala
    }
    salas.push({ id: s.id, nome: s.nome, tipo: "setor", cor: s.cor, x0: sx0, x1: sx1, z0: sz0, z1: sz1, mesas, setor: s });
  });
  const porta: [number, number] = [0, z0];
  const balcao: [number, number] = [-5.2, -4.8];
  const lugares: PlantaCliente["lugares"] = {};
  const usadas: Record<string, number> = {};
  for (const m of e.equipe) {
    if (m.papel === "atendente") lugares[m.id] = { pos: [balcao[0], 0, balcao[1] + 0.8], rot: Math.PI, sala: "recepcao", emPe: true }; // atrás do balcão, de frente pra porta
    else if (m.papel === "ceo") lugares[m.id] = { ...cadeiraDe(mesaCeo), sala: "ceo" };
    else if (m.setorId) {
      const sala = salas.find((s) => s.id === m.setorId); if (!sala) continue;
      const k = usadas[sala.id] ?? 0; usadas[sala.id] = k + 1;
      const mesa = sala.mesas[k] ?? sala.mesas[sala.mesas.length - 1]; if (!mesa) continue;
      lugares[m.id] = { ...cadeiraDe(mesa), sala: sala.id };
    }
  }
  return { salas, porta, balcao, lugares };
}

export const vagasLivres = (e: Escritorio) => e.setores.reduce((n, s) => n + s.mesas, 0) - e.equipe.filter((m) => m.papel === "profissional").length;
