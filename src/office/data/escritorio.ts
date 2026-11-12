// O escritório do cliente num lote pago. O dono escolhe o layout (jeito do prédio), os setores e a equipe; todo
// escritório nasce com uma atendente e um CEO. Tudo é editável no painel "Montar escritório" e a cena desenha ao vivo.
// Compartilhado por servidor (validação) e cliente (painel e cena). Unidade: metros, no sistema local do lote
// (origem no centro do lote, frente = -z; a cena gira pela rua mais próxima).
import { BONECOS } from "./bonecos";

// Prédios gerados no Higgsfield (imagem → 3D), em public/modelos/escritorio-*.glb. Todos têm um quadro escuro em
// branco acima da entrada: é onde entra o letreiro com o nome e a logo da empresa (posição em `letreiro`).
export type LayoutId = "vidro" | "moderno" | "sobrado" | "loja" | "galpao" | "container";
export interface LayoutInfo { id: LayoutId; nome: string; descricao: string; altura: number; andares: 1 | 2; modelo: string; letreiro: { y: number; z: number; largura: number } }
export const LAYOUTS: LayoutInfo[] = [
  // altura = escala do GLB (normalizado com altura 1); letreiro fica sobre o quadro em branco de cada prédio (medido nas imagens;
  // moderno, loja, galpão e contêiner reajustados em 11/11/2026 com fotos de frente: estavam 1 a 2 m abaixo do quadro)
  { id: "vidro", nome: "Cubo de vidro", descricao: "Dois andares todos de vidro, com jardim no terraço. Dá pra ver a equipe trabalhando de fora.", altura: 13, andares: 2, modelo: "escritorioVidro", letreiro: { y: 4.7, z: -5.85, largura: 4.6 } },
  { id: "moderno", nome: "Térreo moderno", descricao: "Caixa branca com vitrine de vidro e parede de ripas de madeira.", altura: 7.8, andares: 1, modelo: "escritorioModerno", letreiro: { y: 7.3, z: -6.85, largura: 5.6 } },
  { id: "sobrado", nome: "Sobrado comercial", descricao: "Loja de vidro embaixo, varanda e janelas em fita em cima.", altura: 11.5, andares: 2, modelo: "escritorioSobrado", letreiro: { y: 5.75, z: -6.45, largura: 5 } },
  { id: "loja", nome: "Loja de rua", descricao: "Telhadinho de barro, vitrine com toldo listrado e vaso na porta.", altura: 11, andares: 1, modelo: "escritorioLoja", letreiro: { y: 7.85, z: -5.4, largura: 4.5 } },
  { id: "galpao", nome: "Galpão de tijolinho", descricao: "Antigo galpão industrial com janelas em arco e claraboias. Cara de estúdio criativo.", altura: 10.5, andares: 1, modelo: "escritorioGalpao", letreiro: { y: 7.95, z: -7.1, largura: 4.6 } },
  { id: "container", nome: "Contêineres", descricao: "Três contêineres empilhados com frente de vidro, deck de madeira e escada externa.", altura: 9.2, andares: 2, modelo: "escritorioContainer", letreiro: { y: 4.9, z: -5.35, largura: 4 } },
];
// Profissionais prontos pra contratar (vêm com cargo e treino); o dono também pode criar do zero
export interface Pronto { id: string; nome: string; cargo: string; setor: string; boneco: string; camisa: string; treino: Treino }
export const CATALOGO_PROFISSIONAIS: Pronto[] = [
  { id: "vendedor", nome: "Rodrigo", cargo: "Vendedor", setor: "Vendas", boneco: "classico", camisa: "#1D4ED8", treino: { descricao: "Apresenta os produtos e serviços, entende o que o cliente precisa, monta orçamento e fecha a venda. Anota nome, telefone e e-mail de quem tem interesse.", saudacao: "Oi! Posso te ajudar a escolher? Me conta o que você procura." } },
  { id: "suporte", nome: "Tainá", cargo: "Suporte ao cliente", setor: "Suporte", boneco: "suporte-1", camisa: "#16A34A", treino: { descricao: "Resolve dúvidas e problemas de quem já é cliente, com calma e passo a passo. Quando não resolve, registra o caso pro dono responder.", saudacao: "Olá! Conta o que aconteceu que eu te ajudo a resolver." } },
  { id: "social", nome: "Vini", cargo: "Social media", setor: "Marketing", boneco: "ruivo", camisa: "#DB2777", treino: { descricao: "Cuida das redes sociais: ideias de post, legendas, calendário de conteúdo e respostas a comentários no tom da marca.", saudacao: "E aí! Bora fazer a sua marca aparecer?" } },
  { id: "financeiro", nome: "Helena", cargo: "Financeiro", setor: "Financeiro", boneco: "oculos", camisa: "#1F2937", treino: { descricao: "Explica preços, formas de pagamento, prazos e emite segunda via de cobrança. Organiza contas a pagar e a receber.", saudacao: "Olá. Precisa de ajuda com pagamento ou cobrança?" } },
  { id: "designer", nome: "Luna", cargo: "Designer", setor: "Design", boneco: "longo", camisa: "#7C3AED", treino: { descricao: "Cria artes, posts, banners e identidade visual a partir de um briefing. Pergunta formato, texto e referência antes de começar.", saudacao: "Oi! Me passa o briefing que eu desenho." } },
  { id: "agendamento", nome: "Caio", cargo: "Agendamentos", setor: "Atendimento", boneco: "careca", camisa: "#0EA5A4", treino: { descricao: "Marca, remarca e confirma horários e visitas. Pede nome, telefone e o melhor dia/horário e confirma por mensagem.", saudacao: "Olá! Quer marcar um horário? Me diz o melhor dia pra você." } },
  { id: "orcamentos", nome: "Marina", cargo: "Orçamentos", setor: "Orçamentos", boneco: "coque", camisa: "#D97706", treino: { descricao: "Levanta o que o cliente precisa (medidas, quantidade, prazo) e monta o orçamento. Quando falta informação, pergunta antes de dar preço.", saudacao: "Oi! Me conta o que você precisa que eu monto o orçamento." } },
  { id: "juridico", nome: "Otávio", cargo: "Jurídico", setor: "Jurídico", boneco: "oculos", camisa: "#374151", treino: { descricao: "Tira dúvidas iniciais sobre contratos, prazos e documentos da empresa, sempre orientando a confirmar com o responsável.", saudacao: "Boa tarde. Em que posso orientar?" } },
];
export const LAYOUT: Record<LayoutId, LayoutInfo> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l])) as Record<LayoutId, LayoutInfo>;

export interface Setor { id: string; nome: string; cor: string; mesas: number } // mesas: 1..4
export type PapelMembro = "atendente" | "ceo" | "profissional";
export interface Treino { descricao: string; saudacao: string } // o que a pessoa sabe/faz e como cumprimenta (base do atendimento)
// catalogoId: de qual agente do catálogo veio ("esp-<id>" = especialista de IA, com habilidades); vazio = criado do zero
export interface Membro { id: string; nome: string; cargo: string; papel: PapelMembro; setorId: string | null; boneco: string; camisa: string; treino?: Treino; catalogoId?: string }
export interface Escritorio { layout: LayoutId; setores: Setor[]; equipe: Membro[]; trocasLayout?: number; creditosLayout?: number; decor?: Decoracao }

// ---- Decoração do lote (11/11/2026: "novas formas de personalização de prédios" e "girar para outras posições") ----
// giro: quartos de volta a partir da frente para a rua (0 = rua principal). Tudo opcional; o padrão é o lote de sempre.
export type EstiloLetreiro = "painel" | "neon" | "madeira" | "metal";
export type PisoLote = "grama" | "deck" | "pedra" | "concreto";
export type CercaLote = "nenhuma" | "viva" | "madeira" | "muro";
export type ExtraLote = "bancos" | "mesas" | "vasos" | "totem" | "bandeiras" | "luzes" | "bicicletario" | "placa" | "natal";
// Interior personalizável (12/11/2026): cor das paredes, piso, acabamento dos móveis e quadros com a logo da empresa
export type PisoInterior = "salas" | "madeira" | "porcelanato" | "carpete" | "cimento";
export type MovelInterior = "branco" | "madeira" | "preto";
export interface Interior { parede: string; piso: PisoInterior; moveis: MovelInterior; quadros: boolean; plantas: boolean }
export const INTERIOR_PADRAO: Interior = { parede: "#F4F1EB", piso: "salas", moveis: "branco", quadros: false, plantas: true };
export const CORES_PAREDE = ["#F4F1EB", "#E6EDF5", "#F7E3D3", "#DDEFE2", "#EAE3F5", "#FFF1C9", "#3A414D"];
export const PISOS_INTERIOR: { id: PisoInterior; nome: string; cor: string | null }[] = [
  { id: "salas", nome: "Uma cor por sala", cor: null }, { id: "madeira", nome: "Taco de madeira", cor: "#B98A5A" }, { id: "porcelanato", nome: "Porcelanato claro", cor: "#E9E5DE" },
  { id: "carpete", nome: "Carpete grafite", cor: "#596574" }, { id: "cimento", nome: "Cimento queimado", cor: "#BFC3C6" },
];
export const MOVEIS_INTERIOR: { id: MovelInterior; nome: string; tampo: string }[] = [{ id: "branco", nome: "Branco", tampo: "#F7F7F5" }, { id: "madeira", nome: "Madeira", tampo: "#A0703C" }, { id: "preto", nome: "Preto fosco", tampo: "#2B2F36" }];
export function limparInterior(x: unknown, base: Interior = INTERIOR_PADRAO): Interior {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Interior, unknown>>;
  const parede = typeof o.parede === "string" && /^#[0-9a-fA-F]{6}$/.test(o.parede) ? o.parede.toUpperCase() : base.parede;
  const piso = PISOS_INTERIOR.some((p) => p.id === o.piso) ? (o.piso as PisoInterior) : base.piso;
  const moveis = MOVEIS_INTERIOR.some((m) => m.id === o.moveis) ? (o.moveis as MovelInterior) : base.moveis;
  return { parede, piso, moveis, quadros: typeof o.quadros === "boolean" ? o.quadros : base.quadros, plantas: typeof o.plantas === "boolean" ? o.plantas : base.plantas };
}
export interface Decoracao { giro: 0 | 1 | 2 | 3; letreiro: EstiloLetreiro; toldo: string | null; piso: PisoLote; cerca: CercaLote; arvores: number; extras: ExtraLote[]; interior?: Interior }
export const DECOR_PADRAO: Decoracao = { giro: 0, letreiro: "painel", toldo: null, piso: "grama", cerca: "nenhuma", arvores: 0, extras: [] };
export const ESTILOS_LETREIRO: { id: EstiloLetreiro; nome: string; desc: string }[] = [
  { id: "painel", nome: "Painel", desc: "Painel escuro com faixa na cor da marca" },
  { id: "neon", nome: "Neon", desc: "Letras e borda acesas na cor da marca" },
  { id: "madeira", nome: "Madeira", desc: "Placa de madeira com letras claras" },
  { id: "metal", nome: "Metal", desc: "Chapa escovada com letras escuras" },
];
export const PISOS: { id: PisoLote; nome: string; cor: string }[] = [
  { id: "grama", nome: "Grama", cor: "#79B968" }, { id: "deck", nome: "Deck de madeira", cor: "#B98A5A" },
  { id: "pedra", nome: "Pedra portuguesa", cor: "#D9D2C3" }, { id: "concreto", nome: "Concreto", cor: "#BFC3C7" },
];
export const CERCAS: { id: CercaLote; nome: string }[] = [{ id: "nenhuma", nome: "Sem cerca" }, { id: "viva", nome: "Cerca viva" }, { id: "madeira", nome: "Cerca de madeira" }, { id: "muro", nome: "Muro baixo" }];
export const EXTRAS: { id: ExtraLote; nome: string; icone: string }[] = [
  { id: "bancos", nome: "Bancos", icone: "🪑" }, { id: "mesas", nome: "Mesas com guarda-sol", icone: "⛱️" }, { id: "vasos", nome: "Vasos na entrada", icone: "🪴" },
  { id: "totem", nome: "Totem com a logo", icone: "🪧" }, { id: "bandeiras", nome: "Bandeiras da marca", icone: "🚩" }, { id: "luzes", nome: "Varal de luzinhas", icone: "✨" },
  { id: "bicicletario", nome: "Bicicletário", icone: "🚲" },
  // todo lote 2×2 é de esquina: a placa fica na ponta do cruzamento e se lê das duas ruas
  { id: "placa", nome: "Placa de esquina", icone: "📍" },
  // só aparece na aba e no mapa de 1º/12 a 6/1 (scene/Natal.tsx)
  { id: "natal", nome: "Decoração de Natal", icone: "🎄" },
];
export const CORES_TOLDO = ["#E2575B", "#F59E0B", "#16A34A", "#1D4ED8", "#7C3AED", "#1F2630"];
export function limparDecor(x: unknown, base: Decoracao = DECOR_PADRAO): Decoracao {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Decoracao, unknown>>;
  const giro = [0, 1, 2, 3].includes(Number(o.giro)) ? (Number(o.giro) as Decoracao["giro"]) : base.giro;
  const um = <T extends string>(v: unknown, lista: { id: T }[], padrao: T) => (lista.some((l) => l.id === v) ? (v as T) : padrao);
  const toldo = o.toldo === null ? null : typeof o.toldo === "string" && /^#[0-9a-fA-F]{6}$/.test(o.toldo) ? o.toldo : o.toldo === undefined ? base.toldo : null;
  const extras = Array.isArray(o.extras) ? [...new Set(o.extras.filter((e): e is ExtraLote => EXTRAS.some((x) => x.id === e)))] : base.extras;
  return { giro, letreiro: um(o.letreiro, ESTILOS_LETREIRO, base.letreiro), toldo, piso: um(o.piso, PISOS, base.piso), cerca: um(o.cerca, CERCAS, base.cerca), arvores: Math.max(0, Math.min(4, Math.round(Number(o.arvores ?? base.arvores)) || 0)), extras, interior: limparInterior(o.interior, base.interior ?? INTERIOR_PADRAO) };
}
export const TROCAS_LAYOUT_GRATIS = 3;
export const PRECO_TROCA_LAYOUT = 9.9;
export const trocasRestantes = (e: Escritorio) => Math.max(0, TROCAS_LAYOUT_GRATIS - (e.trocasLayout ?? 0)) + (e.creditosLayout ?? 0);

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
    equipe.push({ id, nome: texto(r.nome, 24, papel === "ceo" ? "CEO" : papel === "atendente" ? "Ana" : "Novo"), cargo: texto(r.cargo, 40, papel === "ceo" ? "CEO" : papel === "atendente" ? "Atendente" : "Profissional"), papel, setorId, boneco: bonecoOk(r.boneco), camisa: corOk(r.camisa, papel === "ceo" ? "#1F2630" : "#1D4ED8"), treino: { descricao: texto(tr.descricao, 600), saudacao: texto(tr.saudacao, 160) }, ...(papel === "profissional" && typeof r.catalogoId === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(r.catalogoId) ? { catalogoId: r.catalogoId } : {}) });
  }
  // a atendente e o CEO são obrigatórios: se sumiram, voltam os do padrão
  for (const p of ["atendente", "ceo"] as const) if (!equipe.some((e) => e.papel === p)) equipe.unshift(base.equipe.find((e) => e.papel === p) ?? escritorioPadrao("Empresa", "#1D4ED8").equipe.find((e) => e.papel === p)!);
  equipe.sort((a, b) => ordem(a.papel) - ordem(b.papel));
  // contadores de troca de layout são do servidor: o cliente não mexe neles
  return { layout, setores, equipe, trocasLayout: base.trocasLayout ?? 0, creditosLayout: base.creditosLayout ?? 0, decor: limparDecor(o.decor, base.decor ?? DECOR_PADRAO) };
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
