// Catálogo de bonecos.
// - Bonecos com `arquivo` usam o modelo 3D gerado no Higgsfield (já com esqueleto, ver scripts/bonecos).
// - Bonecos sem arquivo usam o boneco provisório desenhado em código (mesmo esqueleto e mesmas animações).

export type Cabelo = "curto" | "coque" | "longo" | "careca";

export type Traje = "camisa" | "semCamisa" | "biquini" | "saida";
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
export const TODOS_BONECOS: Record<string, Boneco> = Object.fromEntries([...BONECOS, ...BONECOS_PRAIA].map((b) => [b.id, b]));

// Tipos de avatar oferecidos a quem compra um personagem (R$ 5,99/mês): gênero + estilo. Cada tipo aponta pra um
// boneco e uma cor de roupa; a lista cresce com os modelos do Higgsfield.
export type Genero = "feminino" | "masculino" | "neutro";
export interface TipoAvatar { id: string; nome: string; genero: Genero; estilo: "executivo" | "casual" | "praia" | "esportivo" | "criativo"; boneco: string; roupa: string }
export const TIPOS_AVATAR: TipoAvatar[] = [
  { id: "exec-f", nome: "Executiva", genero: "feminino", estilo: "executivo", boneco: "coque", roupa: "#1F2937" },
  { id: "exec-m", nome: "Executivo", genero: "masculino", estilo: "executivo", boneco: "classico", roupa: "#1F2937" },
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
