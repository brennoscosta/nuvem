// Aparência de cada agente de IA (17/11/2026): pele, cabelo, penteado, barba, roupa, calça e tênis tirados do id, do nome
// e do cargo (estável e variada). Chefes (CEO, diretoria, gerentes) de blazer; a equipe na cor do departamento. A mesma
// pessoa sai igual na sede 3D (scene/OneStateInterior.tsx) e no retrato da página Minha equipe (ui/RetratoBoneco.tsx).
import type { Boneco as BonecoDef } from "./bonecos";
import type { Membro } from "./escritorio";

const PELES = ["#F3D2B3", "#F1C9A5", "#D9A882", "#C98E68", "#A8714F", "#8D5A3B", "#6B4029"];
const CABELOS = ["#1E1A18", "#2A1E19", "#3B2A22", "#5A3B22", "#8A5A2B", "#B5532D", "#D9B26F", "#9CA3AF"];
// penteados, barbas, roupas e tênis do boneco novo (frente "personagem", 16/11/2026): cada pessoa sai diferente
const ESTILOS: BonecoDef["estiloCabelo"][] = ["curto", "longo", "coque", "cacheado", "rabo", "topete", "careca", "curto", "longo", "cacheado", "moicano"];
const CALCAS = ["#1F2329", "#22252B", "#2F3542", "#3E4450", "#4B3B2E", "#1E3A5F", "#5A6472", "#C8B79A"];
const TENIS = ["#E11D48", "#0A6CFF", "#16A34A", "#D4A63A", "#7C3AED", "#F97316", ""];
const CALCADOS = ["#F4F4F4", "#F4F4F4", "#1F2329", "#E7E2D6", "#9CA3AF"];
const BLAZERS = ["#1E3A5F", "#2B2F36", "#3F3F46", "#6B2737", "#1F2937", "#0F4C5C"];
// equipe: camisa na maioria, mas também moletom, jaqueta e vestido (todos na cor do departamento)
const TRAJES_EQUIPE: NonNullable<BonecoDef["traje"]>[] = ["camisa", "camisa", "moletom", "camisa", "jaqueta", "vestido", "camisa", "moletom"];
const BARBAS: NonNullable<BonecoDef["barba"]>[] = ["nenhuma", "nenhuma", "rala", "nenhuma", "bigode", "rala", "cheia"]; // barba cheia fica pesada: mais rara
export const hash = (s: string) => Math.abs([...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
export function aparenciaAgente(m: Pick<Membro, "id" | "nome" | "cargo" | "nivel" | "camisa">): { def: BonecoDef; camisa: string } {
  const h = hash(m.id + m.nome), h2 = hash(m.nome + m.cargo);
  const chefe = m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente";
  const estilo = ESTILOS[(h >> 6) % ESTILOS.length];
  const curto = estilo === "curto" || estilo === "careca" || estilo === "topete" || estilo === "moicano";
  const traje = chefe ? "blazer" : TRAJES_EQUIPE[h2 % TRAJES_EQUIPE.length];
  const def: BonecoDef = {
    id: `ag-${m.id}`, nome: m.nome, arquivo: null,
    pele: PELES[h % PELES.length], cabelo: CABELOS[(h >> 3) % CABELOS.length], estiloCabelo: estilo,
    calca: CALCAS[(h >> 9) % CALCAS.length], traje: traje === "vestido" && curto ? "camisa" : traje,
    tenis: TENIS[(h >> 12) % TENIS.length] || undefined, calcado: CALCADOS[(h2 >> 3) % CALCADOS.length],
    barba: curto ? BARBAS[(h2 >> 6) % BARBAS.length] : "nenhuma", oculos: (h2 >> 9) % 5 === 0,
  };
  return { def, camisa: chefe ? (m.nivel === "ceo" ? "#14110A" : BLAZERS[(h >> 4) % BLAZERS.length]) : m.camisa };
}
