// Sedes de empresas na cidade (17/11/2026, pedido do dono: "coloque o prédio do bday, AppZone e NUVCAM. Faça da mesma
// forma e organização que criou o do OneState"). Cada sede ocupa um quarteirão inteiro com a mesma torre (logo no alto,
// áreas do site iluminadas na fachada, pórtico, praça e totem), o mesmo interior (departamentos com a equipe de IA,
// recepção que atende quem entra) e o mesmo cartão. A torre e o interior são desenhados em volta do centro da Social RP
// (data/onestate.ts) e deslocados para o centro de cada quarteirão (deslocamento()).
// A equipe de cada uma é gravada no terreno `chave` (scripts/sedes.mjs). A Social RP é só do Layon; as outras três são
// divididas (titular + sócio, terreno.socios, migração 0037).
import { centroQuarteirao } from "./mundo";
import { AREAS_ONESTATE, CHAVE_SEDE, OS_X, OS_Z, SITE_ONESTATE, SEDE, type AreaOneState } from "./onestate";

export type AreaSede = AreaOneState;
// prédio de cada sede (17/11/2026, pedido do dono: "quero prédios diferentes, visuais; estão todos iguais"): a planta
// térrea e a porta são as mesmas (interior, caminhos e entrada dependem delas); muda a casca (scene/SedeEstilos.tsx)
export type EstiloSede = "classica" | "tech" | "festa" | "estudio";
export interface Sede {
  id: string; nome: string; chave: string; i: number; j: number; x: number; z: number;
  cor: string; // destaque (frisos, pórtico, coroa, placas)
  corClara: string; // texto das placas da fachada e brilhos
  escura: string; // fundo do balão e do cartão
  logo: string; icone: string; propLogo: number; // logo clara (fundo escuro): altura / largura
  site: string; dominio: string; areas: AreaSede[]; tipo: string; // "roleplay", "aplicativo"…
  resumo: string; numeroLoja: number; // número usado pela recepção para o atendimento do visitante (ui/Recepcao.tsx)
  nicho: string;
  estilo: EstiloSede; andares: number; // casca do prédio e número de andares, com o térreo (SEDE.andar = 3,4 m cada)
}

const a = (id: string, nome: string, href: string, cor: string): AreaSede => ({ id, nome, href, cor });

export const SEDES: Sede[] = [
  {
    id: "socialrp", nome: "Social RP", chave: CHAVE_SEDE, i: 1, j: 1, x: OS_X, z: OS_Z,
    cor: "#D4A63A", corClara: "#F7E7B4", escura: "#14110A", logo: "/socialrp/logo.png", icone: "/socialrp/icone.png", propLogo: 240 / 809,
    site: SITE_ONESTATE, dominio: "onestatebr.com.br", areas: AREAS_ONESTATE, tipo: "roleplay",
    resumo: "A sede da Social RP na cidade. Lá dentro, cada departamento trabalha com a sua equipe de agentes de IA.", numeroLoja: 0, nicho: "conteudo", estilo: "classica", andares: 4,
  },
  {
    id: "appzone", nome: "AppZone", chave: "-1,-1,0", i: -1, j: -1, ...xz(-1, -1),
    cor: "#F59E0B", corClara: "#FFE2B0", escura: "#16181C", logo: "/sedes/appzone/logo.png", icone: "/sedes/appzone/icone.png", propLogo: 297 / 900,
    site: "https://appzone.com.br", dominio: "appzone.com.br", tipo: "aplicativo",
    areas: [
      a("mapa", "Mapa", "/", "#38BDF8"), a("atividades", "Atividades", "/activities", "#F59E0B"), a("grupos", "Grupos", "/groups", "#22C55E"),
      a("chat", "Chat", "/", "#A78BFA"), a("loja", "Loja", "/", "#F472B6"), a("membros", "Membros", "/users", "#60A5FA"),
      a("categorias", "Categorias", "/", "#FB923C"), a("perfil", "Perfil", "/profile", "#E5E7EB"), a("regras", "Regras", "/", "#94A3B8"),
      a("denuncias", "Denúncias", "/report", "#EF4444"), a("privacidade", "Privacidade", "/privacidade", "#CBD5E1"),
    ],
    resumo: "A sede da AppZone na cidade. Lá dentro, engenharia, produto e atendimento trabalham com a equipe de agentes de IA.", numeroLoja: 901, nicho: "tecnologia", estilo: "tech", andares: 4,
  },
  {
    id: "bday", nome: "bday.fm", chave: "-1,1,0", i: -1, j: 1, ...xz(-1, 1),
    cor: "#8B5CF6", corClara: "#E4D7FF", escura: "#170E2B", logo: "/sedes/bday/logo.png", icone: "/sedes/bday/icone.png", propLogo: 263 / 900,
    site: "https://bday.fm", dominio: "bday.fm", tipo: "presentes",
    areas: [
      a("presentes", "Presentes", "/presentes", "#A78BFA"), a("lives", "Lives", "/lives", "#F43F5E"), a("feed", "Feed", "/feed", "#60A5FA"),
      a("explorar", "Explorar", "/explorar", "#22C55E"), a("carteira", "Carteira", "/carteira", "#FACC15"), a("parceiros", "Parceiros", "/parceiro", "#FB923C"),
      a("como", "Como funciona", "/#como-funciona", "#38BDF8"), a("sobre", "Sobre", "/sobre", "#E5E7EB"), a("termos", "Termos de uso", "/termos", "#94A3B8"),
      a("privacidade", "Privacidade", "/privacidade", "#CBD5E1"),
    ],
    resumo: "A sede do bday.fm na cidade. Lá dentro, presentes, lives e parceiros trabalham com a equipe de agentes de IA.", numeroLoja: 902, nicho: "conteudo", estilo: "festa", andares: 3,
  },
  {
    id: "nuvcam", nome: "NUVCAM", chave: "1,-1,0", i: 1, j: -1, ...xz(1, -1),
    cor: "#EF4444", corClara: "#FFD3D3", escura: "#1C0A0C", logo: "/sedes/nuvcam/logo.png", icone: "/sedes/nuvcam/icone.png", propLogo: 212 / 900,
    site: "https://nuvcam.tv", dominio: "nuvcam.tv", tipo: "vídeo ao vivo",
    areas: [
      a("chamadas", "Chamadas de vídeo", "/home", "#F87171"), a("lives", "Lives", "/live", "#F43F5E"), a("traducao", "Tradução de voz", "/home", "#38BDF8"),
      a("perfil", "Perfil", "/home", "#E5E7EB"), a("seguranca", "Segurança", "/termos", "#22C55E"), a("moderacao", "Moderação", "/termos", "#FACC15"),
      a("suporte", "Suporte", "/", "#60A5FA"), a("termos", "Termos de uso", "/termos", "#94A3B8"), a("privacidade", "Privacidade", "/privacidade", "#CBD5E1"),
    ],
    resumo: "A sede do NUVCAM na cidade. Lá dentro, vídeo ao vivo, segurança e atendimento trabalham com a equipe de agentes de IA.", numeroLoja: 903, nicho: "tecnologia", estilo: "estudio", andares: 4,
  },
];
function xz(i: number, j: number) { const [x, z] = centroQuarteirao(i, j); return { x, z }; }

export const SEDE_SOCIALRP = SEDES[0];
export const SEDE_POR_CHAVE: Record<string, Sede> = Object.fromEntries(SEDES.map((s) => [s.chave, s]));
export const SEDE_POR_ID: Record<string, Sede> = Object.fromEntries(SEDES.map((s) => [s.id, s]));
export const SEDE_POR_NUMERO: Record<number, Sede> = Object.fromEntries(SEDES.map((s) => [s.numeroLoja, s]));
export const ehSede = (chave: string | null | undefined) => !!chave && !!SEDE_POR_CHAVE[chave];
export const sedeDe = (chave: string | null | undefined): Sede | null => (chave ? SEDE_POR_CHAVE[chave] ?? null : null);
// ?sede=1 (link antigo) = Social RP; ?sede=<id> ou a chave
export const sedeDoParametro = (v: string | null | undefined): Sede | null => (!v ? null : v === "1" ? SEDE_SOCIALRP : SEDE_POR_ID[v] ?? SEDE_POR_CHAVE[v] ?? null);
// tudo da torre e do interior é desenhado em volta do centro da Social RP; cada sede desloca para o seu quarteirão
export const deslocamento = (s: Sede): [number, number] => [s.x - OS_X, s.z - OS_Z];
// torre: o centro dela fica um pouco ao norte do centro do quarteirão (data/onestate.ts › SEDE)
export const centroTorre = (s: Sede): [number, number] => [s.x + (SEDE.x - OS_X), s.z + (SEDE.z - OS_Z)];
// altura da torre de cada sede (até a laje do terraço; balão, logos e mini-mapa seguem esta altura)
export const alturaSede = (s: Sede) => SEDE.andar * s.andares;
// NUVCAM: os andares de cima recuam em degraus (dois degraus a partir de 7 andares, um abaixo disso)
export const degrausEstudio = (n: number) => (n >= 7 ? 2 : 1);

// ---------- fachada: as áreas do site nas salas com nome, do 1º andar para cima ----------
// 18/11/2026, pedido do dono ("reduza o tamanho dos prédios das empresas"): 7 salas com nome por andar (4 na frente sul e
// 3 no lado oeste, antes 3 + 2). Mais tarde, no mesmo dia ("os prédios podem ser menores ainda"): andares de 3,4 m e menos
// andares; quando a frente e o oeste não bastam, as salas do leste (3) e do fundo norte (4) também ganham nome. Nenhuma
// área fica de fora: a frente e o oeste enchem primeiro (andar por andar, os lados que a câmera vê ao abrir o mapa),
// depois o leste e por último o norte.
export type FaceSede = "sul" | "oeste" | "leste" | "norte";
export const SALAS_NA_FACE: Record<FaceSede, number> = { sul: 4, oeste: 3, leste: 3, norte: 4 };
export const FRENTE_SEDE = SALAS_NA_FACE.sul, LADO_SEDE = SALAS_NA_FACE.oeste, SALAS_POR_ANDAR = FRENTE_SEDE + LADO_SEDE;
// andares que podem ter salas com nome: todos menos o térreo; no NUVCAM, menos o do telão e os degraus do topo
export const andaresLivres = (s: Sede) => Math.max(1, s.andares - 1 - (s.estilo === "estudio" ? degrausEstudio(s.andares) + 1 : 0));
// andares com áreas: os que a frente e o oeste pedem, sem passar dos livres (aí o leste e o norte entram); se nem as
// quatro faces bastarem, sobe mais um andar (área nenhuma some)
const SALAS_NAS_4 = SALAS_NA_FACE.sul + SALAS_NA_FACE.oeste + SALAS_NA_FACE.leste + SALAS_NA_FACE.norte;
export const andaresComAreas = (s: Sede) => Math.max(Math.min(andaresLivres(s), Math.ceil(s.areas.length / SALAS_POR_ANDAR)), Math.ceil(s.areas.length / SALAS_NAS_4));
export type SalasDoAndar = Record<FaceSede, (AreaSede | null)[]>;
const FACHADAS_SEDE = new Map<string, SalasDoAndar[]>();
function fachadasDe(s: Sede): SalasDoAndar[] {
  let f = FACHADAS_SEDE.get(s.id);
  if (f) return f;
  const n = andaresComAreas(s), fila = [...s.areas];
  f = Array.from({ length: n }, () => ({ sul: [], oeste: [], leste: [], norte: [] }) as SalasDoAndar);
  // bday.fm: o letreiro de lâmpadas da entrada fica na frente das salas do 1º andar (sul) e as esconde de quem olha de
  // cima; essas vagas ficam por último (com 10 áreas, nem chegam a ser usadas)
  const atras = (andar: number, face: FaceSede) => s.estilo === "festa" && andar === 0 && face === "sul";
  const vagas: [number, FaceSede][] = [];
  const encher = (faces: FaceSede[]) => { f!.forEach((_, i) => { for (const face of faces) if (!atras(i, face)) vagas.push([i, face]); }); };
  encher(["sul", "oeste"]); encher(["leste"]); encher(["norte"]);
  f.forEach((_, i) => { if (atras(i, "sul")) vagas.push([i, "sul"]); });
  for (const [i, face] of vagas) for (let k = 0; k < SALAS_NA_FACE[face]; k++) f[i][face].push(fila.shift() ?? null);
  FACHADAS_SEDE.set(s.id, f);
  return f;
}
const VAZIO_ANDAR: SalasDoAndar = { sul: Array(SALAS_NA_FACE.sul).fill(null), oeste: Array(SALAS_NA_FACE.oeste).fill(null), leste: Array(SALAS_NA_FACE.leste).fill(null), norte: Array(SALAS_NA_FACE.norte).fill(null) };
// salas de um andar (1 = primeiro andar acima do térreo), face por face; andar sem área: todas vazias
export const areasDoAndarDe = (s: Sede, andar: number): SalasDoAndar => fachadasDe(s)[andar - 1] ?? VAZIO_ANDAR;
// conferência: quantas áreas aparecem na fachada (tem que ser todas)
export const areasNaFachada = (s: Sede) => fachadasDe(s).reduce((t, a) => t + Object.values(a).flat().filter(Boolean).length, 0);
