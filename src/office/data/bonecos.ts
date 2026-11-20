// Catálogo de bonecos.
// - Bonecos com `arquivo` usam o modelo 3D gerado no Higgsfield (já com esqueleto, ver scripts/bonecos).
// - Bonecos sem arquivo usam o boneco provisório desenhado em código (mesmo esqueleto e mesmas animações).

// estilos de cabelo (16/11/2026: + cacheado, rabo de cavalo, topete e moicano; 20/11/2026: + crespo, black power,
// tranças e raspado — "careca" continua sendo a cabeça lisa)
export type Cabelo = "curto" | "coque" | "longo" | "careca" | "cacheado" | "rabo" | "topete" | "moicano" | "crespo" | "blackpower" | "trancas" | "raspado";
export type Barba = "nenhuma" | "rala" | "cheia" | "bigode" | "cavanhaque";

// roupas: camisa (padrão), blazer, moletom, jaqueta, regata e vestido; semCamisa/biquini/saida = gente de praia.
// 20/11/2026 (editor completo): camisa social, polo, blusa e terno; ternoGrife e jaquetaCouro são itens pagos
export type Traje = "camisa" | "semCamisa" | "biquini" | "saida" | "blazer" | "moletom" | "jaqueta" | "regata" | "vestido" | "social" | "polo" | "blusa" | "terno" | "ternoGrife" | "jaquetaCouro";
// editor completo (20/11/2026): corpo, rosto, parte de baixo e sapatos. Sem o campo, o boneco sai como sempre saiu.
export type Altura = "baixa" | "media" | "alta";
export type Biotipo = "magro" | "medio" | "forte";
export type Olhos = "redondos" | "amendoados" | "grandes" | "sonolentos" | "felizes";
export type Sobrancelha = "normal" | "finas" | "grossas" | "arqueadas";
export type Boca = "sorriso" | "risada" | "neutra" | "deLado";
export type Marcas = "nenhuma" | "sardas" | "pinta" | "rosadas";
export type ModeloOculos = "redondo" | "quadrado" | "gatinho";
export type Baixo = "calca" | "jeans" | "bermuda" | "saia"; // o vestido é o traje "vestido" (cobre a parte de cima também)
export type Sapato = "tenis" | "social" | "sandalia" | "tenisGrife"; // tenisGrife é item pago
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
  // editor completo (20/11/2026); sem o campo vale o padrão de sempre (média, médio, redondos…)
  altura?: Altura; biotipo?: Biotipo;
  olhos?: Olhos; corOlhos?: string; sobrancelha?: Sobrancelha; boca?: Boca; marcas?: Marcas; oculosModelo?: ModeloOculos;
  baixo?: Baixo; sapato?: Sapato;
  uniforme?: string; // chave do lote da empresa: a logo dela vai no peito
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

// ---------- personagem personalizável (16/11/2026; editor completo em 20/11/2026) ----------
// O visual escolhido no painel vira um "id de boneco" codificado, v1:…, gravado na coluna boneco do personagem. Assim ele
// chega a todo lugar que já recebe o boneco (mapa, amigos, busca, conversas, avisos) sem mudar nenhuma rota. A coluna
// personagem.visual guarda o mesmo visual em JSON (fonte do painel).
// Editor completo (20/11/2026): corpo, rosto, parte de baixo, sapatos e uniforme vão num 11º pedaço do código
// ("al=alta;ol=felizes;…"), só com o que foge do padrão. Quem nunca mexeu nisso continua com o mesmo código de antes,
// letra por letra (os moradores e os personagens antigos não mudam).
export interface Visual {
  pele?: string; cabelo?: string; estiloCabelo?: Cabelo; barba?: Barba; traje?: Traje; roupa?: string; calca?: string; calcado?: string; tenis?: string; oculos?: boolean;
  altura?: Altura; biotipo?: Biotipo; olhos?: Olhos; corOlhos?: string; sobrancelha?: Sobrancelha; boca?: Boca; marcas?: Marcas; oculosModelo?: ModeloOculos;
  baixo?: Baixo; sapato?: Sapato; uniforme?: string;
}
export const ESTILOS_CABELO: { id: Cabelo; nome: string }[] = [
  { id: "curto", nome: "Curto" }, { id: "topete", nome: "Topete" }, { id: "moicano", nome: "Moicano" }, { id: "raspado", nome: "Raspado" },
  { id: "careca", nome: "Careca" }, { id: "crespo", nome: "Crespo" }, { id: "blackpower", nome: "Black power" }, { id: "cacheado", nome: "Cacheado" },
  { id: "coque", nome: "Coque" }, { id: "rabo", nome: "Rabo de cavalo" }, { id: "trancas", nome: "Tranças" }, { id: "longo", nome: "Longo" },
];
export const BARBAS: { id: Barba; nome: string }[] = [{ id: "nenhuma", nome: "Sem barba" }, { id: "rala", nome: "Rala" }, { id: "cheia", nome: "Cheia" }, { id: "cavanhaque", nome: "Cavanhaque" }, { id: "bigode", nome: "Bigode" }];
// parte de cima (o vestido fica na lista da parte de baixo, porque cobre as duas)
export const TRAJES_CIMA: { id: Traje; nome: string }[] = [
  { id: "camisa", nome: "Camiseta" }, { id: "social", nome: "Camisa social" }, { id: "polo", nome: "Polo" }, { id: "blusa", nome: "Blusa" },
  { id: "regata", nome: "Regata" }, { id: "moletom", nome: "Moletom" }, { id: "jaqueta", nome: "Jaqueta" }, { id: "blazer", nome: "Blazer" },
  { id: "terno", nome: "Terno" }, { id: "jaquetaCouro", nome: "Jaqueta de couro" }, { id: "ternoGrife", nome: "Terno de grife" },
];
export const TRAJES_ESCOLHA = TRAJES_CIMA; // nome antigo
export const BAIXOS: { id: Baixo | "vestido"; nome: string }[] = [{ id: "calca", nome: "Calça" }, { id: "jeans", nome: "Jeans" }, { id: "bermuda", nome: "Bermuda" }, { id: "saia", nome: "Saia" }, { id: "vestido", nome: "Vestido" }];
export const SAPATOS: { id: Sapato; nome: string }[] = [{ id: "tenis", nome: "Tênis" }, { id: "social", nome: "Sapato social" }, { id: "sandalia", nome: "Sandália" }, { id: "tenisGrife", nome: "Tênis de grife" }];
export const ALTURAS: { id: Altura; nome: string }[] = [{ id: "baixa", nome: "Baixa" }, { id: "media", nome: "Média" }, { id: "alta", nome: "Alta" }];
export const BIOTIPOS: { id: Biotipo; nome: string }[] = [{ id: "magro", nome: "Magro" }, { id: "medio", nome: "Médio" }, { id: "forte", nome: "Forte" }];
export const OLHOS: { id: Olhos; nome: string }[] = [{ id: "redondos", nome: "Redondos" }, { id: "amendoados", nome: "Amendoados" }, { id: "grandes", nome: "Grandes" }, { id: "sonolentos", nome: "Sonolentos" }, { id: "felizes", nome: "Sorrindo" }];
export const SOBRANCELHAS: { id: Sobrancelha; nome: string }[] = [{ id: "normal", nome: "Natural" }, { id: "finas", nome: "Finas" }, { id: "grossas", nome: "Grossas" }, { id: "arqueadas", nome: "Arqueadas" }];
export const BOCAS: { id: Boca; nome: string }[] = [{ id: "sorriso", nome: "Sorriso" }, { id: "risada", nome: "Risada" }, { id: "neutra", nome: "Séria" }, { id: "deLado", nome: "De lado" }];
export const MARCAS: { id: Marcas; nome: string }[] = [{ id: "nenhuma", nome: "Nenhuma" }, { id: "sardas", nome: "Sardas" }, { id: "pinta", nome: "Pinta" }, { id: "rosadas", nome: "Bochecha rosada" }];
export const MODELOS_OCULOS: { id: ModeloOculos; nome: string }[] = [{ id: "redondo", nome: "Redondo" }, { id: "quadrado", nome: "Quadrado" }, { id: "gatinho", nome: "Gatinho" }];
export const PELES = ["#FBE3D0", "#F5D6BC", "#F1C9A5", "#E7B48C", "#D9A072", "#C98E68", "#A86E4A", "#8D5B3E", "#6E4329", "#4A2C1C"];
export const CORES_CABELO = ["#14110F", "#2A1E19", "#4A3121", "#7A4E2D", "#B5532D", "#D9A45B", "#EBD08B", "#9A9A9A", "#E8E8E8", "#3B5BDB", "#D6336C", "#7C3AED"];
export const CORES_OLHOS = ["#2B1D16", "#14110F", "#6B4423", "#A0742E", "#3F7D4E", "#3A6EA5", "#6B7280"];
export const CORES_ROUPA = ["#F4F4F0", "#1F2329", "#1E3A5F", "#2563EB", "#0EA5A4", "#16A34A", "#84CC16", "#FACC15", "#F59E0B", "#E11D48", "#DB2777", "#7C3AED", "#6B2737", "#8B5E3C", "#64748B"];
export const CORES_CALCA = ["#1F2329", "#2C3E50", "#3B5B8C", "#5B7DB1", "#6B7280", "#C8B79A", "#8B5E3C", "#F4F4F0", "#14532D", "#7F1D1D"];
export const CORES_CALCADO = ["#F4F4F4", "#1F2227", "#9CA3AF", "#E11D48", "#2563EB", "#16A34A", "#FACC15", "#F59E0B", "#7C3AED", "#8B5E3C"];
export const COR_JEANS = "#3B5B8C";
const HEX = /^#[0-9a-fA-F]{6}$/;
const CHAVE_LOTE = /^-?\d{1,3},-?\d{1,3},-?\d{1,3}$/;
const conjunto = (l: { id: string }[]) => new Set<string>(l.map((x) => x.id));
const ESTILOS_OK = conjunto(ESTILOS_CABELO), BARBAS_OK = conjunto(BARBAS);
const TRAJES_OK = new Set<string>([...TRAJES_CIMA.map((t) => t.id), "vestido", "semCamisa", "biquini", "saida"]);
const EXTRAS_OK: Record<string, Set<string>> = { altura: conjunto(ALTURAS), biotipo: conjunto(BIOTIPOS), olhos: conjunto(OLHOS), sobrancelha: conjunto(SOBRANCELHAS), boca: conjunto(BOCAS), marcas: conjunto(MARCAS), oculosModelo: conjunto(MODELOS_OCULOS), baixo: new Set(["calca", "jeans", "bermuda", "saia"]), sapato: conjunto(SAPATOS) };
// limpa o que veio de fora (cliente, banco): só cores #RRGGBB e opções conhecidas
export function limparVisual(x: unknown): Visual {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const cor = (k: string) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string).toUpperCase() : undefined);
  const v: Visual = { pele: cor("pele"), cabelo: cor("cabelo"), roupa: cor("roupa"), calca: cor("calca"), calcado: cor("calcado"), tenis: o.tenis === "" ? "" : cor("tenis"), corOlhos: cor("corOlhos") }; // tenis "" = tênis liso, sem listra
  if (typeof o.estiloCabelo === "string" && ESTILOS_OK.has(o.estiloCabelo)) v.estiloCabelo = o.estiloCabelo as Cabelo;
  if (typeof o.barba === "string" && BARBAS_OK.has(o.barba)) v.barba = o.barba as Barba;
  if (typeof o.traje === "string" && TRAJES_OK.has(o.traje)) v.traje = o.traje as Traje;
  if (typeof o.oculos === "boolean") v.oculos = o.oculos;
  for (const [k, ok] of Object.entries(EXTRAS_OK)) if (typeof o[k] === "string" && ok.has(o[k] as string)) (v as Record<string, unknown>)[k] = o[k];
  if (typeof o.uniforme === "string" && CHAVE_LOTE.test(o.uniforme)) v.uniforme = o.uniforme;
  for (const k of Object.keys(v) as (keyof Visual)[]) if (v[k] === undefined) delete v[k];
  return v;
}
export interface VisualCompleto {
  pele: string; cabelo: string; estiloCabelo: Cabelo; barba: Barba; traje: Traje; roupa: string; calca: string; calcado: string; tenis: string; oculos: boolean;
  altura: Altura; biotipo: Biotipo; olhos: Olhos; corOlhos: string; sobrancelha: Sobrancelha; boca: Boca; marcas: Marcas; oculosModelo: ModeloOculos; baixo: Baixo; sapato: Sapato; uniforme: string;
}
// o padrão de cada campo novo: é como o boneco sempre foi desenhado
export const PADRAO_EXTRA = { altura: "media", biotipo: "medio", olhos: "redondos", corOlhos: "#2B1D16", sobrancelha: "normal", boca: "sorriso", marcas: "nenhuma", oculosModelo: "redondo", baixo: "calca", sapato: "tenis", uniforme: "" } as const;
// visual completo a partir de um boneco base (o tipo pronto) e do que a pessoa trocou
export function visualCompleto(base: Boneco, roupa: string, v: Visual): VisualCompleto {
  return { pele: v.pele ?? base.pele, cabelo: v.cabelo ?? base.cabelo, estiloCabelo: v.estiloCabelo ?? base.estiloCabelo, barba: v.barba ?? base.barba ?? "nenhuma",
    traje: v.traje ?? base.traje ?? "camisa", roupa: v.roupa ?? roupa, calca: v.calca ?? base.calca, calcado: v.calcado ?? base.calcado ?? "#F4F4F4", tenis: v.tenis ?? base.tenis ?? "", oculos: v.oculos ?? !!base.oculos,
    altura: v.altura ?? base.altura ?? PADRAO_EXTRA.altura, biotipo: v.biotipo ?? base.biotipo ?? PADRAO_EXTRA.biotipo, olhos: v.olhos ?? base.olhos ?? PADRAO_EXTRA.olhos,
    corOlhos: v.corOlhos ?? base.corOlhos ?? PADRAO_EXTRA.corOlhos, sobrancelha: v.sobrancelha ?? base.sobrancelha ?? PADRAO_EXTRA.sobrancelha, boca: v.boca ?? base.boca ?? PADRAO_EXTRA.boca,
    marcas: v.marcas ?? base.marcas ?? PADRAO_EXTRA.marcas, oculosModelo: v.oculosModelo ?? base.oculosModelo ?? PADRAO_EXTRA.oculosModelo, baixo: v.baixo ?? base.baixo ?? PADRAO_EXTRA.baixo,
    sapato: v.sapato ?? base.sapato ?? PADRAO_EXTRA.sapato, uniforme: v.uniforme ?? base.uniforme ?? PADRAO_EXTRA.uniforme };
}
const semCerquilha = (c: string) => c.replace("#", "");
// os campos novos no 11º pedaço do código: chave curta = valor (cor sem #, lote com _ no lugar da vírgula)
const EXTRAS: [keyof typeof PADRAO_EXTRA, string][] = [["altura", "al"], ["biotipo", "bi"], ["olhos", "ol"], ["corOlhos", "co"], ["sobrancelha", "so"], ["boca", "bo"], ["marcas", "ma"], ["oculosModelo", "om"], ["baixo", "ba"], ["sapato", "sa"], ["uniforme", "un"]];
const CURTA_PARA_CAMPO = Object.fromEntries(EXTRAS.map(([c, k]) => [k, c])) as Record<string, keyof typeof PADRAO_EXTRA>;
// id do boneco com o visual dentro (a roupa vai na coluna roupa, como sempre). O boneco base (opcional) entra no fim
// só para manter os extras dele que não são escolha do painel (prancha e chapéu de praia).
export function codificarVisual(v: VisualCompleto, baseId = "") {
  const partes = [semCerquilha(v.pele), semCerquilha(v.cabelo), v.estiloCabelo, v.barba, v.traje, semCerquilha(v.calca), semCerquilha(v.calcado), semCerquilha(v.tenis), v.oculos ? "o" : "", TODOS_BONECOS[baseId] ? baseId : ""];
  const extras = EXTRAS.filter(([c]) => (v[c] ?? PADRAO_EXTRA[c]).toString().toUpperCase() !== PADRAO_EXTRA[c].toUpperCase())
    .map(([c, k]) => `${k}=${c === "corOlhos" ? semCerquilha(v[c]) : c === "uniforme" ? v[c].replace(/,/g, "_") : v[c]}`);
  if (extras.length) partes.push(extras.join(";"));
  return "v1:" + partes.join("~");
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
  // campos do editor completo (o que não vier, ou vier estranho, fica no padrão)
  for (const par of (p[10] ?? "").split(";")) {
    const [k, val] = par.split("="); const campo = CURTA_PARA_CAMPO[k]; if (!campo || !val) continue;
    if (campo === "corOlhos") { const cc = c(val); if (cc) b.corOlhos = cc; }
    else if (campo === "uniforme") { const ch = val.replace(/_/g, ","); if (CHAVE_LOTE.test(ch)) b.uniforme = ch; }
    else if (EXTRAS_OK[campo]?.has(val)) (b as unknown as Record<string, string>)[campo] = val;
  }
  decodificados.set(id, b); return b;
}
// o boneco de um id: os do catálogo ou um visual codificado (v1:…). Sempre devolve um boneco válido.
// Para um agente ou figurante com visual próprio: codificarVisual(visualCompleto(BONECO.classico, camisa, { pele, ... })).
export function bonecoDe(id: string | null | undefined, padrao: Boneco = BONECOS[1]): Boneco {
  if (!id) return padrao;
  return TODOS_BONECOS[id] ?? (id.startsWith("v1:") ? decodificar(id) : null) ?? padrao;
}
// escala do boneco inteiro pela altura (o esqueleto e as animações são os mesmos; a bicicleta acompanha)
export const ESCALA_ALTURA: Record<Altura, number> = { baixa: 0.93, media: 1, alta: 1.07 };
export const escalaDoBoneco = (b: Pick<Boneco, "altura">) => ESCALA_ALTURA[b.altura ?? "media"] ?? 1;

// O que um morador repara quando você passa com o visual diferente da última vez que ele te viu (sem IA)
const DO_TRAJE: Partial<Record<Traje, string>> = { social: "da camisa social", polo: "da polo", blusa: "da blusa", moletom: "do moletom", jaqueta: "da jaqueta", blazer: "do blazer", terno: "do terno", ternoGrife: "do terno de grife", jaquetaCouro: "da jaqueta de couro", vestido: "do vestido", regata: "da regata", camisa: "da camiseta" };
export function novidadeNoVisual(antes: Boneco, agora: Boneco, extra: { roupaAntes: string; roupaAgora: string; acessoriosAntes: string[]; acessoriosAgora: string[]; nomeAcessorio: (id: string) => string | null }): string | null {
  if (!antes.uniforme && agora.uniforme) return "De uniforme da empresa! Ficou bonito.";
  const novo = extra.acessoriosAgora.find((a) => !extra.acessoriosAntes.includes(a)); const nomeNovo = novo ? extra.nomeAcessorio(novo) : null;
  if (nomeNovo) return `Gostei do visual! ${nomeNovo} é novidade?`;
  if (antes.estiloCabelo !== agora.estiloCabelo) return "Mudou o cabelo? Ficou ótimo!";
  const tr = agora.traje ?? "camisa";
  if ((antes.traje ?? "camisa") !== tr) return DO_TRAJE[tr] ? `Gostei ${DO_TRAJE[tr]}!` : "Roupa nova? Ficou bem em você!";
  if ((antes.barba ?? "nenhuma") !== (agora.barba ?? "nenhuma")) return "Mudou a barba, hein? Ficou bom.";
  if (antes.cabelo !== agora.cabelo) return "Pintou o cabelo? Ficou lindo!";
  if (extra.roupaAntes !== extra.roupaAgora || antes.calca !== agora.calca || (antes.sapato ?? "tenis") !== (agora.sapato ?? "tenis")) return "Roupa nova? Ficou bem em você!";
  return null;
}
