// Catálogo de bonecos.
// - Bonecos com `arquivo` usam o modelo 3D gerado no Higgsfield (já com esqueleto, ver scripts/bonecos).
// - Bonecos sem arquivo usam o boneco provisório desenhado em código (mesmo esqueleto e mesmas animações).

export type Cabelo = "curto" | "coque" | "longo" | "careca";

export interface Boneco {
  id: string;
  nome: string;
  arquivo: string | null;
  pele: string;
  cabelo: string;
  estiloCabelo: Cabelo;
  calca: string;
  oculos?: boolean;
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
