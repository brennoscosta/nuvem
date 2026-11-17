// Catálogo de bonecos.
// - Bonecos com `arquivo` usam o modelo 3D gerado no Higgsfield (já com esqueleto, ver scripts/bonecos).
// - Bonecos sem arquivo usam o boneco provisório desenhado em código (mesmo esqueleto e mesmas animações).

// estilos de cabelo (16/11/2026: + cacheado, rabo de cavalo, topete e moicano)
export type Cabelo = "curto" | "coque" | "longo" | "careca" | "cacheado" | "rabo" | "topete" | "moicano";
export type Barba = "nenhuma" | "rala" | "cheia" | "bigode";

// roupas: camisa (padrão), blazer, moletom, jaqueta, regata e vestido; semCamisa/biquini/saida = gente de praia
export type Traje = "camisa" | "semCamisa" | "biquini" | "saida" | "blazer" | "moletom" | "jaqueta" | "regata" | "vestido";
export interface Boneco {
  id: string;
  nome: string;
  arquivo: string | null;
  pele: string;
  cabelo: string;
  estiloCabelo: Cabelo;
  calca: string; // calça, bermuda ou short
  oculos?: boolean;
  traje?: Traje; // padrão: camisa (cor vem de fora). semCamisa/biquini/saida = gente de praia
  prancha?: string; // cor da prancha de surf debaixo do braço
  chapeu?: string; // chapéu de praia
  tenis?: string; // cor de destaque do tênis (sola escura e listra nessa cor); sem isso, tênis branco liso
  calcado?: string; // cor do tênis (a parte de cima); padrão branco
  barba?: Barba; // padrão: nenhuma (a cor é a do cabelo)
}

export const BONECOS: Boneco[] = [
  { id: "suporte-1", nome: "Atendente com headset", arquivo: null, pele: "#F1C9A5", cabelo: "#3B2A22", estiloCabelo: "curto", calca: "#3E4450" },
  { id: "classico", nome: "Clássico", arquivo: null, pele: "#F3D2B3", cabelo: "#2E2620", estiloCabelo: "curto", calca: "#2F3542" },
  { id: "coque", nome: "Coque", arquivo: null, pele: "#C98E68", cabelo: "#2A1E19", estiloCabelo: "coque", calca: "#3B3F4A" },
  { id: "longo", nome: "Cabelo longo", arquivo: null, pele: "#F5D6BC", cabelo: "#8A5A35", estiloCabelo: "longo", calca: "#2C3E50" },
  { id: "oculos", nome: "De óculos", arquivo: null, pele: "#8D5B3E", cabelo: "#1E1A18", estiloCabelo: "curto", calca: "#454B57", oculos: true },
  { id: "ruivo", nome: "Ruivo", arquivo: null, pele: "#F7DCC6", cabelo: "#B5532D", estiloCabelo: "curto", calca: "#394150" },
  { id: "careca", nome: "Careca", arquivo: null, pele: "#D9A882", cabelo: "#000000", estiloCabelo: "careca", calca: "#30343C", oculos: true },
];

export const BONECO: Record<string, Boneco> = Object.fromEntries(BONECOS.map((b) => [b.id, b]));

// Gente de praia que passeia pela cidade (o horizonte sul/leste é praia): surfistas sem camisa com prancha e
// mulheres com visual California beach. Também são opções de avatar.
export const BONECOS_PRAIA: Boneco[] = [
  { id: "surfista-1", nome: "Surfista loiro", arquivo: null, pele: "#D9A072", cabelo: "#E8C77A", estiloCabelo: "longo", calca: "#1D8CF0", traje: "semCamisa", prancha: "#F6C343" },
  { id: "surfista-2", nome: "Surfista moreno", arquivo: null, pele: "#8D5B3E", cabelo: "#1E1A18", estiloCabelo: "curto", calca: "#E2575B", traje: "semCamisa", prancha: "#4CC3A8" },
  { id: "surfista-3", nome: "Surfista de óculos", arquivo: null, pele: "#F1C9A5", cabelo: "#5A3B22", estiloCabelo: "curto", calca: "#22A86B", traje: "semCamisa", prancha: "#FFFFFF", oculos: true },
  { id: "praia-1", nome: "California · biquíni rosa", arquivo: null, pele: "#E7B48C", cabelo: "#F0C27A", estiloCabelo: "longo", calca: "#FFFFFF", traje: "biquini", oculos: true, chapeu: "#F3E2B8" },
  { id: "praia-2", nome: "California · saída amarela", arquivo: null, pele: "#C98E68", cabelo: "#3B2A22", estiloCabelo: "longo", calca: "#FFD166", traje: "saida", chapeu: "#FFFFFF" },
  { id: "praia-3", nome: "California · biquíni verde", arquivo: null, pele: "#F5D6BC", cabelo: "#B5532D", estiloCabelo: "coque", calca: "#1F2937", traje: "biquini", oculos: true },
  { id: "praia-4", nome: "Surfista com prancha", arquivo: null, pele: "#D9A882", cabelo: "#2A1E19", estiloCabelo: "longo", calca: "#DB2777", traje: "biquini", prancha: "#8B6CF0" },
];
// Blazer moderno (16/11/2026, pedido do dono): blazer aberto com camiseta por baixo, calça escura e tênis com listra.
// A cor do blazer é a roupa do tipo de avatar.
export const BONECOS_ESTILO: Boneco[] = [
  { id: "blazer-1", nome: "Blazer moderno", arquivo: null, pele: "#C98E68", cabelo: "#1E1A18", estiloCabelo: "curto", calca: "#1F2329", traje: "blazer", tenis: "#E11D48" },
  { id: "blazer-2", nome: "Blazer moderno · coque", arquivo: null, pele: "#F1C9A5", cabelo: "#3B2A22", estiloCabelo: "coque", calca: "#22252B", traje: "blazer", tenis: "#0A6CFF" },
  { id: "blazer-3", nome: "Blazer moderno · cabelo longo", arquivo: null, pele: "#8D5A3B", cabelo: "#1E1A18", estiloCabelo: "longo", calca: "#1F2329", traje: "blazer", tenis: "#D4A63A" },
];
export const TODOS_BONECOS: Record<string, Boneco> = Object.fromEntries([...BONECOS, ...BONECOS_PRAIA, ...BONECOS_ESTILO].map((b) => [b.id, b]));

// Tipos de avatar oferecidos a quem compra um personagem (R$ 5,99/mês): gênero + estilo. Cada tipo aponta pra um
// boneco e uma cor de roupa; a lista cresce com os modelos do Higgsfield.
export type Genero = "feminino" | "masculino" | "neutro";
export interface TipoAvatar { id: string; nome: string; genero: Genero; estilo: "executivo" | "casual" | "praia" | "esportivo" | "criativo"; boneco: string; roupa: string }
export const TIPOS_AVATAR: TipoAvatar[] = [
  { id: "exec-f", nome: "Executiva", genero: "feminino", estilo: "executivo", boneco: "coque", roupa: "#1F2937" },
  { id: "exec-m", nome: "Executivo", genero: "masculino", estilo: "executivo", boneco: "classico", roupa: "#1F2937" },
  { id: "blazer-1", nome: "Blazer moderno", genero: "masculino", estilo: "executivo", boneco: "blazer-1", roupa: "#1E3A5F" },
  { id: "blazer-2", nome: "Blazer moderno", genero: "feminino", estilo: "executivo", boneco: "blazer-2", roupa: "#2B2F36" },
  { id: "blazer-3", nome: "Blazer vinho", genero: "feminino", estilo: "executivo", boneco: "blazer-3", roupa: "#6B2737" },
  { id: "casual-f", nome: "Casual", genero: "feminino", estilo: "casual", boneco: "longo", roupa: "#DB2777" },
  { id: "casual-m", nome: "Casual", genero: "masculino", estilo: "casual", boneco: "ruivo", roupa: "#0EA5A4" },
  { id: "criativo-f", nome: "Criativa", genero: "feminino", estilo: "criativo", boneco: "praia-3", roupa: "#7C3AED" },
  { id: "criativo-m", nome: "Criativo de óculos", genero: "masculino", estilo: "criativo", boneco: "oculos", roupa: "#7C3AED" },
  { id: "esporte-m", nome: "Esportivo", genero: "masculino", estilo: "esportivo", boneco: "careca", roupa: "#16A34A" },
  { id: "praia-f1", nome: "California · biquíni", genero: "feminino", estilo: "praia", boneco: "praia-1", roupa: "#FF4FA3" },
  { id: "praia-f2", nome: "California · saída de praia", genero: "feminino", estilo: "praia", boneco: "praia-2", roupa: "#FFD166" },
  { id: "praia-m1", nome: "Surfista", genero: "masculino", estilo: "praia", boneco: "surfista-1", roupa: "#1D8CF0" },
  { id: "praia-m2", nome: "Surfista moreno", genero: "masculino", estilo: "praia", boneco: "surfista-2", roupa: "#E2575B" },
  { id: "neutro-1", nome: "Neutro", genero: "neutro", estilo: "casual", boneco: "suporte-1", roupa: "#64748B" },
];

// ---------- personagem personalizável (16/11/2026) ----------
// O visual escolhido no painel (pele, cabelo, roupa, calça, tênis, barba) vira um "id de boneco" codificado, v1:…,
// gravado na coluna boneco do personagem. Assim ele chega a todo lugar que já recebe o boneco (mapa, amigos, busca,
// conversas, avisos) sem mudar nenhuma rota. A coluna personagem.visual guarda o mesmo visual em JSON (fonte do painel).
export interface Visual { pele?: string; cabelo?: string; estiloCabelo?: Cabelo; barba?: Barba; traje?: Traje; roupa?: string; calca?: string; calcado?: string; tenis?: string; oculos?: boolean }
export const ESTILOS_CABELO: { id: Cabelo; nome: string }[] = [
  { id: "curto", nome: "Curto com franja" }, { id: "topete", nome: "Topete" }, { id: "moicano", nome: "Moicano" }, { id: "cacheado", nome: "Cacheado" },
  { id: "coque", nome: "Coque" }, { id: "rabo", nome: "Rabo de cavalo" }, { id: "longo", nome: "Longo" }, { id: "careca", nome: "Raspado" },
];
export const BARBAS: { id: Barba; nome: string }[] = [{ id: "nenhuma", nome: "Sem barba" }, { id: "rala", nome: "Rala" }, { id: "cheia", nome: "Cheia" }, { id: "bigode", nome: "Bigode" }];
export const TRAJES_ESCOLHA: { id: Traje; nome: string }[] = [
  { id: "camisa", nome: "Camiseta" }, { id: "blazer", nome: "Blazer" }, { id: "jaqueta", nome: "Jaqueta" },
  { id: "moletom", nome: "Moletom" }, { id: "regata", nome: "Regata" }, { id: "vestido", nome: "Vestido" },
];
export const PELES = ["#FBE3D0", "#F5D6BC", "#F1C9A5", "#E7B48C", "#D9A072", "#C98E68", "#A86E4A", "#8D5B3E", "#6E4329", "#4A2C1C"];
export const CORES_CABELO = ["#14110F", "#2A1E19", "#4A3121", "#7A4E2D", "#B5532D", "#D9A45B", "#EBD08B", "#9A9A9A", "#E8E8E8", "#3B5BDB", "#D6336C", "#7C3AED"];
export const CORES_ROUPA = ["#F4F4F0", "#1F2329", "#1E3A5F", "#2563EB", "#0EA5A4", "#16A34A", "#84CC16", "#FACC15", "#F59E0B", "#E11D48", "#DB2777", "#7C3AED", "#6B2737", "#8B5E3C", "#64748B"];
export const CORES_CALCA = ["#1F2329", "#2C3E50", "#3B5B8C", "#5B7DB1", "#6B7280", "#C8B79A", "#8B5E3C", "#F4F4F0", "#14532D", "#7F1D1D"];
export const CORES_CALCADO = ["#F4F4F4", "#1F2227", "#9CA3AF", "#E11D48", "#2563EB", "#16A34A", "#FACC15", "#F59E0B", "#7C3AED", "#8B5E3C"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ESTILOS_OK = new Set<string>(ESTILOS_CABELO.map((e) => e.id));
const BARBAS_OK = new Set<string>(BARBAS.map((b) => b.id));
const TRAJES_OK = new Set<string>(["camisa", "blazer", "moletom", "jaqueta", "regata", "vestido", "semCamisa", "biquini", "saida"]);
// limpa o que veio de fora (cliente, banco): só cores #RRGGBB e opções conhecidas
export function limparVisual(x: unknown): Visual {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const cor = (k: string) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string).toUpperCase() : undefined);
  const v: Visual = { pele: cor("pele"), cabelo: cor("cabelo"), roupa: cor("roupa"), calca: cor("calca"), calcado: cor("calcado"), tenis: o.tenis === "" ? "" : cor("tenis") }; // tenis "" = tênis liso, sem listra
  if (typeof o.estiloCabelo === "string" && ESTILOS_OK.has(o.estiloCabelo)) v.estiloCabelo = o.estiloCabelo as Cabelo;
  if (typeof o.barba === "string" && BARBAS_OK.has(o.barba)) v.barba = o.barba as Barba;
  if (typeof o.traje === "string" && TRAJES_OK.has(o.traje)) v.traje = o.traje as Traje;
  if (typeof o.oculos === "boolean") v.oculos = o.oculos;
  for (const k of Object.keys(v) as (keyof Visual)[]) if (v[k] === undefined) delete v[k];
  return v;
}
// visual completo a partir de um boneco base (o tipo pronto) e do que a pessoa trocou
export function visualCompleto(base: Boneco, roupa: string, v: Visual): Required<Omit<Visual, "tenis">> & { tenis: string } {
  return { pele: v.pele ?? base.pele, cabelo: v.cabelo ?? base.cabelo, estiloCabelo: v.estiloCabelo ?? base.estiloCabelo, barba: v.barba ?? base.barba ?? "nenhuma",
    traje: v.traje ?? base.traje ?? "camisa", roupa: v.roupa ?? roupa, calca: v.calca ?? base.calca, calcado: v.calcado ?? base.calcado ?? "#F4F4F4", tenis: v.tenis ?? base.tenis ?? "", oculos: v.oculos ?? !!base.oculos };
}
const semCerquilha = (c: string) => c.replace("#", "");
// id do boneco com o visual dentro (a roupa vai na coluna roupa, como sempre). O boneco base (opcional) entra no fim
// só para manter os extras dele que não são escolha do painel (prancha e chapéu de praia).
export function codificarVisual(v: ReturnType<typeof visualCompleto>, baseId = "") {
  return "v1:" + [semCerquilha(v.pele), semCerquilha(v.cabelo), v.estiloCabelo, v.barba, v.traje, semCerquilha(v.calca), semCerquilha(v.calcado), semCerquilha(v.tenis), v.oculos ? "o" : "", TODOS_BONECOS[baseId] ? baseId : ""].join("~");
}
const decodificados = new Map<string, Boneco>();
function decodificar(id: string): Boneco | null {
  const pronto = decodificados.get(id); if (pronto) return pronto;
  const p = id.slice(3).split("~"); if (p.length < 8) return null;
  const c = (x: string) => (/^[0-9a-fA-F]{6}$/.test(x) ? "#" + x.toUpperCase() : null);
  const pele = c(p[0]), cabelo = c(p[1]), calca = c(p[5]), calcado = c(p[6]);
  if (!pele || !cabelo || !calca || !calcado || !ESTILOS_OK.has(p[2]) || !BARBAS_OK.has(p[3]) || !TRAJES_OK.has(p[4])) return null;
  const base = p[9] ? TODOS_BONECOS[p[9]] : undefined;
  const b: Boneco = { id, nome: "Personalizado", arquivo: null, pele, cabelo, estiloCabelo: p[2] as Cabelo, barba: p[3] as Barba, traje: p[4] as Traje, calca, calcado, tenis: c(p[7]) ?? undefined,
    oculos: p[8] === "o", prancha: base?.prancha, chapeu: base?.chapeu };
  decodificados.set(id, b); return b;
}
// o boneco de um id: os do catálogo ou um visual codificado (v1:…). Sempre devolve um boneco válido.
// Para um agente ou figurante com visual próprio: codificarVisual(visualCompleto(BONECO.classico, camisa, { pele, ... })).
export function bonecoDe(id: string | null | undefined, padrao: Boneco = BONECOS[1]): Boneco {
  if (!id) return padrao;
  return TODOS_BONECOS[id] ?? (id.startsWith("v1:") ? decodificar(id) : null) ?? padrao;
}
