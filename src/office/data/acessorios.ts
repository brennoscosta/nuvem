// Roupas e acessórios do personagem (12/11/2026): comprados um a um no Pix, ficam na conta para sempre; o personagem usa
// um por lugar (cabeça, rosto, costas, pescoço). Preços em R$.
// Editor completo (20/11/2026): lugares novos (pulso, pulseira e orelha), acessórios grátis (preço 0, sem compra:
// relógio, pulseira e brincos), acessórios premium e roupas premium (terno de grife, jaqueta de couro e tênis de grife).
// As roupas premium não são "usadas" como acessório: são escolhas do visual (traje ou sapato) que só valem comprando.
// Toda cobrança passa por ITEM_PAGO_POR_ID + comprarItem (src/server/cidade.ts), num lugar só.
export type LugarAcessorio = "cabeca" | "rosto" | "costas" | "pescoco" | "pulso" | "pulseira" | "orelha";
export interface Acessorio { id: string; nome: string; lugar: LugarAcessorio; preco: number; cor: string; icone: string } // icone: nome do ícone próprio (ui/Icone.tsx)
export const PRECO_PREMIUM = 5.9;
export const ACESSORIOS: Acessorio[] = [
  { id: "bone-workend", nome: "Boné WorkEnd", lugar: "cabeca", preco: 2.9, cor: "#0A6CFF", icone: "bone" },
  { id: "chapeu-palha", nome: "Chapéu de palha", lugar: "cabeca", preco: 2.9, cor: "#E4C27A", icone: "chapeu" },
  { id: "cartola", nome: "Cartola", lugar: "cabeca", preco: 3.9, cor: "#1F2630", icone: "cartola" },
  { id: "coroa", nome: "Coroa dourada", lugar: "cabeca", preco: 4.9, cor: "#F2C14E", icone: "coroa" },
  { id: "fone", nome: "Fone de ouvido", lugar: "cabeca", preco: 2.9, cor: "#E2575B", icone: "fone" },
  { id: "oculos-sol", nome: "Óculos escuros", lugar: "rosto", preco: 1.9, cor: "#111418", icone: "oculosSol" },
  { id: "oculos-redondo", nome: "Óculos redondos", lugar: "rosto", preco: 1.9, cor: "#B07A3A", icone: "oculosRedondo" },
  { id: "mochila", nome: "Mochila", lugar: "costas", preco: 3.9, cor: "#16A34A", icone: "mochila" },
  { id: "asas", nome: "Asinhas", lugar: "costas", preco: 4.9, cor: "#FFFFFF", icone: "asas" },
  { id: "cachecol", nome: "Cachecol", lugar: "pescoco", preco: 1.9, cor: "#7C3AED", icone: "cachecol" },
  { id: "colar", nome: "Colar de ouro", lugar: "pescoco", preco: 2.9, cor: "#F2C14E", icone: "colar" },
  // premium (20/11/2026)
  { id: "chapeu-panama", nome: "Chapéu panamá", lugar: "cabeca", preco: PRECO_PREMIUM, cor: "#EFE6CF", icone: "panama" },
  { id: "boina", nome: "Boina", lugar: "cabeca", preco: PRECO_PREMIUM, cor: "#7F1D1D", icone: "boina" },
  { id: "oculos-aviador", nome: "Óculos aviador", lugar: "rosto", preco: PRECO_PREMIUM, cor: "#C9A24A", icone: "aviador" },
  { id: "gravata-borboleta", nome: "Gravata-borboleta", lugar: "pescoco", preco: PRECO_PREMIUM, cor: "#14161A", icone: "gravata" },
  { id: "bolsa-couro", nome: "Bolsa de couro", lugar: "costas", preco: PRECO_PREMIUM, cor: "#7A4A2A", icone: "bolsa" },
  { id: "relogio-ouro", nome: "Relógio de ouro", lugar: "pulso", preco: PRECO_PREMIUM, cor: "#D4A63A", icone: "relogioPulso" },
  // grátis (20/11/2026): sem compra, é só usar
  { id: "relogio", nome: "Relógio", lugar: "pulso", preco: 0, cor: "#2A2D33", icone: "relogioPulso" },
  { id: "pulseira", nome: "Pulseira", lugar: "pulseira", preco: 0, cor: "#E0A458", icone: "pulseira" },
  { id: "brinco-argola", nome: "Brinco de argola", lugar: "orelha", preco: 0, cor: "#D4A63A", icone: "brinco" },
  { id: "brinco-ponto", nome: "Brinco de ponto", lugar: "orelha", preco: 0, cor: "#E5E7EB", icone: "brinco" },
];
export const ACESSORIO_POR_ID: Record<string, Acessorio> = Object.fromEntries(ACESSORIOS.map((a) => [a.id, a]));
export const ehGratis = (id: string) => ACESSORIO_POR_ID[id]?.preco === 0;
// no máximo um por lugar; só ids conhecidos
export function limparEquipados(x: unknown): string[] {
  const lista = Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && !!ACESSORIO_POR_ID[i]) : [];
  const usados = new Set<LugarAcessorio>(); const r: string[] = [];
  for (const i of lista) { const l = ACESSORIO_POR_ID[i].lugar; if (usados.has(l)) continue; usados.add(l); r.push(i); }
  return r;
}

// Roupas premium (20/11/2026): o item comprado libera um valor do visual (traje ou sapato)
export interface RoupaPaga { id: string; nome: string; preco: number; parte: "traje" | "sapato"; valor: string; cor: string }
export const ROUPAS_PAGAS: RoupaPaga[] = [
  { id: "terno-grife", nome: "Terno de grife", preco: PRECO_PREMIUM, parte: "traje", valor: "ternoGrife", cor: "#1E2A44" },
  { id: "jaqueta-couro", nome: "Jaqueta de couro", preco: PRECO_PREMIUM, parte: "traje", valor: "jaquetaCouro", cor: "#2A2320" },
  { id: "tenis-grife", nome: "Tênis de grife", preco: PRECO_PREMIUM, parte: "sapato", valor: "tenisGrife", cor: "#F4F4F4" },
];
export const ROUPA_PAGA_POR_ID: Record<string, RoupaPaga> = Object.fromEntries(ROUPAS_PAGAS.map((r) => [r.id, r]));
// valor do visual → item que libera ("ternoGrife" → "terno-grife")
export const ITEM_DO_TRAJE: Record<string, string> = Object.fromEntries(ROUPAS_PAGAS.filter((r) => r.parte === "traje").map((r) => [r.valor, r.id]));
export const ITEM_DO_SAPATO: Record<string, string> = Object.fromEntries(ROUPAS_PAGAS.filter((r) => r.parte === "sapato").map((r) => [r.valor, r.id]));
// tudo o que se compra (acessórios pagos e roupas premium): id → nome e preço
export const ITEM_PAGO_POR_ID: Record<string, { id: string; nome: string; preco: number }> = Object.fromEntries([...ACESSORIOS.filter((a) => a.preco > 0), ...ROUPAS_PAGAS].map((i) => [i.id, { id: i.id, nome: i.nome, preco: i.preco }]));
// itens pagos que um visual usa (para conferir se a pessoa comprou)
export function itensPagosDoVisual(v: { traje?: string; sapato?: string }): string[] {
  return [v.traje ? ITEM_DO_TRAJE[v.traje] : undefined, v.sapato ? ITEM_DO_SAPATO[v.sapato] : undefined].filter((x): x is string => !!x);
}
