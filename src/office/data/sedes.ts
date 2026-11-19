// Sedes de empresas na cidade (17/11/2026, pedido do dono: "coloque o prédio do bday, AppZone e NUVCAM. Faça da mesma
// forma e organização que criou o do OneState"). Cada sede tem a mesma torre (logo no alto, áreas do site iluminadas na
// fachada, pórtico), o mesmo interior (departamentos com a equipe de IA, recepção que atende quem entra) e o mesmo cartão.
// 19/11/2026 (pedido do dono): cada sede ocupa só 1 lote, o de esquina virado para o centro da cidade (data/mundo.ts ›
// cantoParaOCentro), com um jardim pequeno na frente; a praça, o totem e os canteiros do quarteirão saíram e os outros 3
// lotes voltaram a ser pontos à venda. A torre e o interior são desenhados em coordenadas do lote (origem no centro, frente
// para +z) e cada sede leva o desenho para o seu lote, girado para a rua da frente (paraMundoSede, rot = frenteDoLote).
// A equipe de cada uma é gravada no terreno `chave` (scripts/sedes.mjs), que NÃO muda com o lote novo (data/mundo.ts ›
// chaveDoLote). A Social RP é só do Layon; as outras três são divididas (titular + sócio, terreno.socios, migração 0037).
import { cantoParaOCentro, centroLote, frenteDoLote, kDaSede } from "./mundo";
import { AREAS_ONESTATE, CHAVE_SEDE, SITE_ONESTATE, SEDE, Z_FRENTE_SEDE, type AreaOneState } from "./onestate";

export type AreaSede = AreaOneState;
// prédio de cada sede (17/11/2026, pedido do dono: "quero prédios diferentes, visuais; estão todos iguais"): a planta
// térrea e a porta são as mesmas (interior, caminhos e entrada dependem delas); muda a casca (scene/SedeEstilos.tsx)
export type EstiloSede = "classica" | "tech" | "festa" | "estudio";
export interface Sede {
  id: string; nome: string; chave: string; i: number; j: number;
  k: number; x: number; z: number; rot: number; // lote físico (centroLote), centro dele e giro do desenho (frente local +z → rua)
  lado: LadoSede; // face lateral (local) virada para a rua do lado da esquina: é ela que leva as áreas junto com a frente
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
    id: "socialrp", nome: "Social RP", chave: CHAVE_SEDE, i: 1, j: 1, ...noLote(1, 1),
    cor: "#D4A63A", corClara: "#F7E7B4", escura: "#14110A", logo: "/socialrp/logo.png", icone: "/socialrp/icone.png", propLogo: 240 / 809,
    site: SITE_ONESTATE, dominio: "onestatebr.com.br", areas: AREAS_ONESTATE, tipo: "roleplay",
    resumo: "A sede da Social RP na cidade. Lá dentro, cada departamento trabalha com a sua equipe de agentes de IA.", numeroLoja: 0, nicho: "conteudo", estilo: "classica", andares: 4,
  },
  {
    id: "appzone", nome: "AppZone", chave: "-1,-1,0", i: -1, j: -1, ...noLote(-1, -1),
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
    id: "bday", nome: "bday.fm", chave: "-1,1,0", i: -1, j: 1, ...noLote(-1, 1),
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
    id: "nuvcam", nome: "NUVCAM", chave: "1,-1,0", i: 1, j: -1, ...noLote(1, -1),
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
// o lote da sede no quarteirão (data/mundo.ts: o `null` da lista de lotes), o centro dele e o giro para a rua da frente.
// A regra do dono (19/11/2026) é o lote de esquina virado para o centro da cidade: a lista de lotes tem de bater com ela
function noLote(i: number, j: number) {
  const k = kDaSede(i, j);
  if (k == null || k !== cantoParaOCentro(i, j)) throw new Error(`O lote da sede no quarteirão ${i},${j} não é o de esquina virado para o centro (data/mundo.ts)`);
  const [x, z] = centroLote(i, j, k), rot = frenteDoLote(k);
  // 19/11/2026 (pedido do dono: "deixe a entrada do prédio sempre voltada para a rua"): a frente (com a porta) olha para a
  // rua do norte ou do sul, como os outros lotes (frenteDoLote); o lote é de esquina, então um dos lados também dá para a
  // rua (oeste nos lotes k 0 e 2, leste nos k 1 e 3). Girado o desenho, esse lado do mundo vira o "oeste" ou o "leste" local
  const ladoMundo = k % 2 === 0 ? -1 : 1; // -1 = a rua do lado fica a oeste (-x) do lote; +1 = a leste
  const lado: LadoSede = ladoMundo * Math.round(Math.cos(rot)) < 0 ? "oeste" : "leste";
  return { k, x, z, rot, lado };
}

export const SEDE_SOCIALRP = SEDES[0];
export const SEDE_POR_CHAVE: Record<string, Sede> = Object.fromEntries(SEDES.map((s) => [s.chave, s]));
export const SEDE_POR_ID: Record<string, Sede> = Object.fromEntries(SEDES.map((s) => [s.id, s]));
export const SEDE_POR_NUMERO: Record<number, Sede> = Object.fromEntries(SEDES.map((s) => [s.numeroLoja, s]));
export const ehSede = (chave: string | null | undefined) => !!chave && !!SEDE_POR_CHAVE[chave];
export const sedeDe = (chave: string | null | undefined): Sede | null => (chave ? SEDE_POR_CHAVE[chave] ?? null : null);
// ?sede=1 (link antigo) = Social RP; ?sede=<id> ou a chave
export const sedeDoParametro = (v: string | null | undefined): Sede | null => (!v ? null : v === "1" ? SEDE_SOCIALRP : SEDE_POR_ID[v] ?? SEDE_POR_CHAVE[v] ?? null);
// Tudo da torre e do interior é desenhado em coordenadas do lote (origem no centro, frente para +z); local → mundo gira por
// rot e soma o centro, como o <group position rotation> da cena (o mesmo cálculo de data/plantaInterna.ts › paraMundo)
export const paraMundoSede = (s: Pick<Sede, "x" | "z" | "rot">, lx: number, lz: number): [number, number] => [s.x + lx * Math.cos(s.rot) + lz * Math.sin(s.rot), s.z - lx * Math.sin(s.rot) + lz * Math.cos(s.rot)];
export const paraLocalSede = (s: Pick<Sede, "x" | "z" | "rot">, x: number, z: number): [number, number] => { const dx = x - s.x, dz = z - s.z; return [dx * Math.cos(s.rot) - dz * Math.sin(s.rot), dx * Math.sin(s.rot) + dz * Math.cos(s.rot)]; };
// centro da torre no mundo (data/onestate.ts › SEDE)
export const centroTorre = (s: Sede): [number, number] => paraMundoSede(s, SEDE.x, SEDE.z);
// ponto na frente da porta, a `d` metros da fachada (para a câmera olhar a sede de frente)
export const frenteDaSede = (s: Sede, d = 6): [number, number] => paraMundoSede(s, 0, Z_FRENTE_SEDE + d);
// a sede no ponto (x, z) do mundo? (dentro do lote dela)
export const sedeNoPonto = (x: number, z: number): Sede | null => SEDES.find((s) => Math.abs(x - s.x) < 10 && Math.abs(z - s.z) < 10) ?? null;
// altura da torre de cada sede (até a laje do terraço; balão, logos e mini-mapa seguem esta altura)
export const alturaSede = (s: Sede) => SEDE.andar * s.andares;
// NUVCAM: os andares de cima recuam em degraus (dois degraus a partir de 7 andares, um abaixo disso)
export const degrausEstudio = (n: number) => (n >= 7 ? 2 : 1);

// ---------- fachada: as áreas do site nas salas com nome, do 1º andar para cima ----------
// 18/11/2026, pedido do dono ("reduza o tamanho dos prédios das empresas"): 7 salas com nome por andar (4 na frente e 3 no
// lado). Mais tarde, no mesmo dia ("os prédios podem ser menores ainda"): andares de 3,4 m e menos andares.
// 19/11/2026 (sede num lote de esquina; pedido do dono: "deixe a entrada do prédio sempre voltada para a rua"): as áreas
// ficam só nas duas faces que dão para a rua, a frente (sul local, a da porta) e o lado da esquina (sede.lado); as faces
// viradas para os lotes vizinhos ficam com janelas sem nome. Quando os andares livres não bastam, o lado ganha uma sala
// (4 em vez de 3) e depois a frente (5 em vez de 4). Só se nem assim couber, as faces de dentro entram, para área nenhuma
// sumir (com as áreas de hoje isso não acontece).
export type FaceSede = "sul" | "oeste" | "leste" | "norte";
export type LadoSede = "oeste" | "leste";
export const outroLado = (l: LadoSede): LadoSede => (l === "oeste" ? "leste" : "oeste");
// andares que podem ter salas com nome: todos menos o térreo; no NUVCAM, menos o do telão e os degraus do topo
export const andaresLivres = (s: Sede) => Math.max(1, s.andares - 1 - (s.estilo === "estudio" ? degrausEstudio(s.andares) + 1 : 0));
// bday.fm: o letreiro de lâmpadas da entrada fica na frente das salas do 1º andar (sul) e as esconde de quem olha de
// cima; essas vagas ficam por último
const atras = (s: Sede, andar: number, face: FaceSede) => s.estilo === "festa" && andar === 0 && face === "sul";
// salas com nome por face, da mais folgada para a mais apertada (os dois lados com o mesmo ritmo; o fundo como a frente)
const SALAS_POR_FACE = [{ frente: 4, lado: 3 }, { frente: 4, lado: 4 }, { frente: 5, lado: 4 }, { frente: 5, lado: 5 }];
function salasDaSede(s: Sede): Record<FaceSede, number> {
  const livres = andaresLivres(s);
  const cabe = (c: { frente: number; lado: number }) => {
    let n = 0; for (let i = 0; i < livres; i++) { if (!atras(s, i, "sul")) n += c.frente; n += c.lado; }
    return n >= s.areas.length;
  };
  const c = SALAS_POR_FACE.find(cabe) ?? SALAS_POR_FACE[SALAS_POR_FACE.length - 1];
  return { sul: c.frente, norte: c.frente, oeste: c.lado, leste: c.lado };
}
const SALAS_SEDE = new Map<string, Record<FaceSede, number>>();
export const salasNaFace = (s: Sede) => { let r = SALAS_SEDE.get(s.id); if (!r) { r = salasDaSede(s); SALAS_SEDE.set(s.id, r); } return r; };
export type SalasDoAndar = Record<FaceSede, (AreaSede | null)[]>;
const FACHADAS_SEDE = new Map<string, SalasDoAndar[]>();
function fachadasDe(s: Sede): SalasDoAndar[] {
  let f = FACHADAS_SEDE.get(s.id);
  if (f) return f;
  const por = salasNaFace(s), fila = [...s.areas];
  // andares: os livres; se nem as quatro faces bastarem, mais um andar de cada vez (área nenhuma some)
  let n = andaresLivres(s);
  while (n * (por.sul + por.oeste + por.leste + por.norte) < fila.length) n++;
  f = Array.from({ length: n }, () => ({ sul: [], oeste: [], leste: [], norte: [] }) as SalasDoAndar);
  const vagas: [number, FaceSede][] = [];
  const encher = (faces: FaceSede[]) => { f!.forEach((_, i) => { for (const face of faces) if (!atras(s, i, face)) vagas.push([i, face]); }); };
  // primeiro as faces da rua (andar por andar), depois o outro lado, o fundo e as salas atrás do letreiro
  encher(["sul", s.lado]); encher([outroLado(s.lado)]); encher(["norte"]);
  f.forEach((_, i) => { if (atras(s, i, "sul")) vagas.push([i, "sul"]); });
  for (const [i, face] of vagas) for (let k = 0; k < por[face]; k++) f[i][face].push(fila.shift() ?? null);
  // só os andares que têm alguma área (os de cima ficam com as janelas sem nome)
  while (f.length > 1 && !Object.values(f[f.length - 1]).flat().some(Boolean)) f.pop();
  FACHADAS_SEDE.set(s.id, f);
  return f;
}
// andares com áreas (do 1º para cima)
export const andaresComAreas = (s: Sede) => fachadasDe(s).length;
// andar sem área: as salas de cada face, todas sem nome (o mesmo ritmo de janelas)
export const salasVazias = (s: Sede): SalasDoAndar => { const p = salasNaFace(s); return { sul: Array(p.sul).fill(null), oeste: Array(p.oeste).fill(null), leste: Array(p.leste).fill(null), norte: Array(p.norte).fill(null) }; };
// salas de um andar (1 = primeiro andar acima do térreo), face por face; andar sem área: todas vazias
export const areasDoAndarDe = (s: Sede, andar: number): SalasDoAndar => fachadasDe(s)[andar - 1] ?? salasVazias(s);
// faces que dão para a rua (a frente e o lado da esquina): conferência de que as áreas ficam só nelas
export const facesDaRua = (s: Sede): FaceSede[] => ["sul", s.lado];
// conferência: quantas áreas aparecem na fachada (tem que ser todas)
export const areasNaFachada = (s: Sede) => fachadasDe(s).reduce((t, a) => t + Object.values(a).flat().filter(Boolean).length, 0);
