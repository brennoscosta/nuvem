// Roupas e acessórios do personagem (12/11/2026): comprados um a um no Pix, ficam na conta para sempre; o personagem usa
// um por lugar (cabeça, rosto, costas, pescoço). Preços em R$.
export type LugarAcessorio = "cabeca" | "rosto" | "costas" | "pescoco";
export interface Acessorio { id: string; nome: string; lugar: LugarAcessorio; preco: number; cor: string; icone: string }
export const ACESSORIOS: Acessorio[] = [
  { id: "bone-workend", nome: "Boné WorkEnd", lugar: "cabeca", preco: 2.9, cor: "#0A6CFF", icone: "🧢" },
  { id: "chapeu-palha", nome: "Chapéu de palha", lugar: "cabeca", preco: 2.9, cor: "#E4C27A", icone: "👒" },
  { id: "cartola", nome: "Cartola", lugar: "cabeca", preco: 3.9, cor: "#1F2630", icone: "🎩" },
  { id: "coroa", nome: "Coroa dourada", lugar: "cabeca", preco: 4.9, cor: "#F2C14E", icone: "👑" },
  { id: "fone", nome: "Fone de ouvido", lugar: "cabeca", preco: 2.9, cor: "#E2575B", icone: "🎧" },
  { id: "oculos-sol", nome: "Óculos escuros", lugar: "rosto", preco: 1.9, cor: "#111418", icone: "🕶️" },
  { id: "oculos-redondo", nome: "Óculos redondos", lugar: "rosto", preco: 1.9, cor: "#B07A3A", icone: "👓" },
  { id: "mochila", nome: "Mochila", lugar: "costas", preco: 3.9, cor: "#16A34A", icone: "🎒" },
  { id: "asas", nome: "Asinhas", lugar: "costas", preco: 4.9, cor: "#FFFFFF", icone: "🪽" },
  { id: "cachecol", nome: "Cachecol", lugar: "pescoco", preco: 1.9, cor: "#7C3AED", icone: "🧣" },
  { id: "colar", nome: "Colar de ouro", lugar: "pescoco", preco: 2.9, cor: "#F2C14E", icone: "📿" },
];
export const ACESSORIO_POR_ID: Record<string, Acessorio> = Object.fromEntries(ACESSORIOS.map((a) => [a.id, a]));
// no máximo um por lugar; só ids conhecidos
export function limparEquipados(x: unknown): string[] {
  const lista = Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && !!ACESSORIO_POR_ID[i]) : [];
  const usados = new Set<LugarAcessorio>(); const r: string[] = [];
  for (const i of lista) { const l = ACESSORIO_POR_ID[i].lugar; if (usados.has(l)) continue; usados.add(l); r.push(i); }
  return r;
}
