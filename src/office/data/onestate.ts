// Sede do OneState RP na cidade (16/11/2026, pedido do dono: "coloque um prédio desse para o OneState, com logo e todas
// as áreas do site"). Ocupa o quarteirão 1,1 (sudeste) inteiro, como a Nuvem e a lanchonete: o último na ordem da planta,
// então nenhum lote mudou de número. Térreo = saguão; do 1º ao 5º andar, cada sala é uma área do site, com o nome
// iluminado na fachada (3 na frente sul e 2 no lado oeste, os lados que a câmera vê). Tocar no prédio abre o cartão com
// todas as áreas (src/office/ui/CartaoOneState.tsx), cada uma levando à página no onestatebr.com.br.
import { centroQuarteirao } from "./mundo";

export const SITE_ONESTATE = "https://onestatebr.com.br";
// a sede é o "lote" de uma conta (o dono): chave fora da lista de lotes à venda, sem número de loja (scripts/sede-onestate.mjs)
export const CHAVE_SEDE = "1,1,0";
export const [OS_X, OS_Z] = centroQuarteirao(1, 1);
// torre: 22 m de frente (x) por 16 m de fundo (z), recuada para o norte (a praça de entrada fica na frente, ao sul)
export const SEDE = { x: OS_X, z: OS_Z - 3, w: 22, d: 16, andar: 4, andares: 6 };
export const ALTURA_SEDE = SEDE.andar * SEDE.andares;
export const POR_ANDAR = 5; // salas com nome por andar: 3 na frente (sul) e 2 no lado (oeste)

export interface AreaOneState { id: string; nome: string; href: string; cor: string }
// as áreas do menu do site, na ordem dele (SiteHeader do onestatebr.com.br), sem o Início
export const AREAS_ONESTATE: AreaOneState[] = [
  { id: "perfilRp", nome: "Perfil RP", href: "/perfil", cor: "#F2C14E" },
  { id: "oneMatch", nome: "OneMatch", href: "/onematch", cor: "#EC4899" },
  { id: "feedRp", nome: "Feed RP", href: "/feed", cor: "#60A5FA" },
  { id: "cenas", nome: "Cenas", href: "/cenas", cor: "#A78BFA" },
  { id: "lives", nome: "Lives", href: "/lives", cor: "#F43F5E" },
  { id: "grupos", nome: "Grupos", href: "/grupos", cor: "#22C55E" },
  { id: "mercado", nome: "Mercado", href: "/mercado", cor: "#F59E0B" },
  { id: "x1", nome: "Desafio X1", href: "/x1", cor: "#EF4444" },
  { id: "noticias", nome: "Notícias", href: "/categoria/noticias", cor: "#E5E7EB" },
  { id: "dinheiro", nome: "Dinheiro", href: "/noticias/guia-dinheiro-onestate-rp", cor: "#34D399" },
  { id: "guias", nome: "Guias", href: "/categoria/guias", cor: "#38BDF8" },
  { id: "criadores", nome: "Criadores", href: "/criadores", cor: "#C084FC" },
  { id: "missoes", nome: "Missões", href: "/missoes", cor: "#FBBF24" },
  { id: "verificado", nome: "Selo verificado", href: "/verificado", cor: "#3B82F6" },
  { id: "moedas", nome: "Moedas", href: "/moedas", cor: "#FACC15" },
  { id: "eventos", nome: "Eventos", href: "/eventos", cor: "#FB923C" },
  { id: "servidores", nome: "Servidores", href: "/servidores", cor: "#94A3B8" },
  { id: "videos", nome: "Vídeos", href: "/categoria/videos", cor: "#F87171" },
  { id: "atualizacoes", nome: "Atualizações", href: "/categoria/atualizacoes", cor: "#2DD4BF" },
  { id: "policia", nome: "Polícia", href: "/categoria/policia", cor: "#2563EB" },
  { id: "anuncie", nome: "Anuncie", href: "/anuncie", cor: "#F472B6" },
  { id: "suporte", nome: "Suporte", href: "/suporte", cor: "#4ADE80" },
  { id: "sobre", nome: "Sobre", href: "/sobre", cor: "#CBD5E1" },
];
// andar de cada área (1º ao 5º) e o lado da fachada: as 3 primeiras de cada andar na frente, as 2 seguintes no oeste
export const andarDaArea = (i: number) => 1 + Math.floor(i / POR_ANDAR);
export const ANDARES_COM_AREAS = Math.ceil(AREAS_ONESTATE.length / POR_ANDAR);
export function areasDoAndar(andar: number) {
  const lista = AREAS_ONESTATE.slice((andar - 1) * POR_ANDAR, andar * POR_ANDAR);
  const cheia = (n: number, a: AreaOneState[]) => [...a, ...Array<AreaOneState | null>(Math.max(0, n - a.length)).fill(null)];
  return { frente: cheia(3, lista.slice(0, 3)), lado: cheia(2, lista.slice(3, 5)) };
}
