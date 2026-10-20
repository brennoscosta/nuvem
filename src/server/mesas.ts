// Mesas: o servidor é a fonte da verdade de onde cada agente senta.
// Regra: a mesa tem que existir na planta, estar na sala do agente (CEO → sala do CEO, diretor → diretoria,
// demais → sala da própria área) e não estar ocupada por outro. O que não cumprir isso é realocado e gravado.
import { sql } from "./db";
import type { AgenteDB } from "./agentes";
import { MESA, MESAS, mesaParaNivel, salaDoNivel } from "@/office/data/layout";
import { AREAS, FUNCOES, type AreaId, type Nivel } from "@/office/data/org";

// Área coerente com o cargo e com a função. Se a função é de outro setor (ex.: "Social media" cadastrado em Criação
// por herança dos setores antigos), o agente vai pro setor da função.
export function areaCorreta(a: Pick<AgenteDB, "area" | "nivel" | "funcao">): AreaId {
  if (a.nivel === "ceo") return "diretoria";
  const funcao = (a.funcao ?? "").trim().toLowerCase();
  if (funcao && a.nivel !== "diretor") {
    const daFuncao = (Object.keys(FUNCOES) as AreaId[]).find((ar) => FUNCOES[ar].some((f) => f.toLowerCase() === funcao));
    if (daFuncao) return daFuncao;
  }
  if (AREAS[a.area as AreaId] && (a.area !== "diretoria" || a.nivel === "diretor")) return a.area as AreaId;
  return "planejamento";
}

// Mesa certa: existe, está livre, fica na sala do agente e é do tipo do cargo (sênior na mesa de sênior, gerente na
// sala de vidro...). Uma mesa comum só vale pra sênior/gerente se a mesa própria dele já estiver ocupada por outro.
export function mesaValida(a: Pick<AgenteDB, "mesaId" | "area" | "nivel">, ocupadas: Set<string>) {
  const m = a.mesaId ? MESA[a.mesaId] : undefined;
  if (!m || ocupadas.has(m.id) || m.sala !== salaDoNivel(a.area as AreaId, a.nivel as Nivel)) return false;
  const esperado = a.nivel === "ceo" ? "ceo" : a.nivel === "diretor" ? "diretor" : a.nivel === "gerente" ? "gerente" : a.nivel === "senior" ? "senior" : "comum";
  if (m.tipo === esperado) return true;
  if (m.tipo !== "comum") return false;
  const propria = MESAS.find((x) => x.sala === m.sala && x.tipo === esperado);
  return !propria || ocupadas.has(propria.id);
}

// Confere todo mundo da empresa e grava as correções. Devolve a lista já arrumada.
export async function arrumarMesas(empresaId: string): Promise<AgenteDB[]> {
  const lista = await sql<AgenteDB[]>`SELECT * FROM agente WHERE empresa_id = ${empresaId} AND ativo = true ORDER BY criado_em`;
  const ocupadas = new Set<string>();
  const out: AgenteDB[] = [];
  // 1ª passada: quem já está certo mantém a mesa (prioridade por ordem de contratação)
  const certos = new Set<string>();
  for (const a of lista) {
    const area = areaCorreta(a);
    if (area === a.area && mesaValida(a, ocupadas)) { ocupadas.add(a.mesaId!); certos.add(a.id); }
  }
  // 2ª passada: realoca o resto
  for (const a of lista) {
    if (certos.has(a.id)) { out.push(a); continue; }
    const area = areaCorreta(a);
    const mesa = mesaParaNivel(area, a.nivel as Nivel, ocupadas);
    const mesaId = mesa?.id ?? null;
    if (mesaId) ocupadas.add(mesaId);
    if (area !== a.area || mesaId !== a.mesaId) {
      const [novo] = await sql<AgenteDB[]>`UPDATE agente SET area = ${area}, mesa_id = ${mesaId}, atualizado_em = now() WHERE id = ${a.id} RETURNING *`;
      out.push(novo);
    } else out.push(a);
  }
  return out;
}
