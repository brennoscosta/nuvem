// Sedes de empresas na cidade (17/11/2026, pedido do dono: "coloque o prédio do bday, AppZone e NUVCAM. Faça da mesma
// forma e organização que criou o do OneState"). Cada sede ocupa um quarteirão inteiro com a mesma torre (logo no alto,
// áreas do site iluminadas na fachada, pórtico, praça e totem), o mesmo interior (departamentos com a equipe de IA,
// recepção que atende quem entra) e o mesmo cartão. A torre e o interior são desenhados em volta do centro da Social RP
// (data/onestate.ts) e deslocados para o centro de cada quarteirão (deslocamento()).
// A equipe de cada uma é gravada no terreno `chave` (scripts/sedes.mjs). A Social RP é só do Layon; as outras três são
// divididas (titular + sócio, terreno.socios, migração 0037).
import { centroQuarteirao } from "./mundo";
import { AREAS_ONESTATE, CHAVE_SEDE, OS_X, OS_Z, SITE_ONESTATE, POR_ANDAR, type AreaOneState } from "./onestate";

export type AreaSede = AreaOneState;
export interface Sede {
  id: string; nome: string; chave: string; i: number; j: number; x: number; z: number;
  cor: string; // destaque (frisos, pórtico, coroa, placas)
  corClara: string; // texto das placas da fachada e brilhos
  escura: string; // fundo do balão e do cartão
  logo: string; icone: string; propLogo: number; // logo clara (fundo escuro): altura / largura
  site: string; dominio: string; areas: AreaSede[]; tipo: string; // "roleplay", "aplicativo"…
  resumo: string; numeroLoja: number; // número usado pela recepção para o atendimento do visitante (ui/Recepcao.tsx)
  nicho: string;
}

const a = (id: string, nome: string, href: string, cor: string): AreaSede => ({ id, nome, href, cor });

export const SEDES: Sede[] = [
  {
    id: "socialrp", nome: "Social RP", chave: CHAVE_SEDE, i: 1, j: 1, x: OS_X, z: OS_Z,
    cor: "#D4A63A", corClara: "#F7E7B4", escura: "#14110A", logo: "/socialrp/logo.png", icone: "/socialrp/icone.png", propLogo: 240 / 809,
    site: SITE_ONESTATE, dominio: "onestatebr.com.br", areas: AREAS_ONESTATE, tipo: "roleplay",
    resumo: "A sede da Social RP na cidade. Lá dentro, cada departamento trabalha com a sua equipe de agentes de IA.", numeroLoja: 0, nicho: "conteudo",
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
    resumo: "A sede da AppZone na cidade. Lá dentro, engenharia, produto e atendimento trabalham com a equipe de agentes de IA.", numeroLoja: 901, nicho: "tecnologia",
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
    resumo: "A sede do bday.fm na cidade. Lá dentro, presentes, lives e parceiros trabalham com a equipe de agentes de IA.", numeroLoja: 902, nicho: "conteudo",
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
    resumo: "A sede do NUVCAM na cidade. Lá dentro, vídeo ao vivo, segurança e atendimento trabalham com a equipe de agentes de IA.", numeroLoja: 903, nicho: "tecnologia",
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
// torre: o centro dela fica 3 m ao norte do centro do quarteirão (data/onestate.ts › SEDE)
export const centroTorre = (s: Sede): [number, number] => [s.x, s.z - 3];
// fachada: 5 áreas por andar (3 na frente sul, 2 no lado oeste), do 1º andar para cima
export const andaresComAreas = (s: Sede) => Math.ceil(s.areas.length / POR_ANDAR);
export function areasDoAndarDe(s: Sede, andar: number) {
  const lista = s.areas.slice((andar - 1) * POR_ANDAR, andar * POR_ANDAR);
  const cheia = (n: number, x: AreaSede[]) => [...x, ...Array<AreaSede | null>(Math.max(0, n - x.length)).fill(null)];
  return { frente: cheia(3, lista.slice(0, 3)), lado: cheia(2, lista.slice(3, 5)) };
}
