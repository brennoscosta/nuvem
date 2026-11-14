// Loja destaque da semana (13/11/2026): a loja com mais visitantes únicos na semana anterior (segunda a domingo, horário
// de Brasília, tabela visita_dia). Empate: quem teve mais conversas com a atendente. Calculada na segunda e guardada em
// destaque_semana (a dona recebe o aviso uma vez); o resultado fica em memória por 1 hora. Contas admin e de teste e
// lojas que não estão mais abertas ficam de fora. Sem visitas na semana, não há destaque.
import { sql, migrar } from "./db";
import { diaBR } from "./resultados";
import { ADMIN_EMAIL } from "./terrenos";
import { avisar } from "./avisos";
import { LOTE_POR_CHAVE, nomeNicho } from "@/office/data/mundo";

export interface Destaque { semana: string; chave: string; numero: number; empresa: string; nicho: string; cor: string; logo: string | null; visitas: number }
declare global { var __workendDestaque: { em: number; semana: string; valor: Destaque | null } | undefined }

const somaDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
// segunda-feira da semana de um dia (AAAA-MM-DD)
function segundaDe(dia: string) { const d = new Date(`${dia}T12:00:00Z`).getUTCDay(); return somaDias(dia, -((d + 6) % 7)); }

export async function lojaDestaque(): Promise<Destaque | null> {
  const semana = somaDias(segundaDe(diaBR()), -7); // a semana premiada é a anterior inteira
  const c = globalThis.__workendDestaque;
  if (c && c.semana === semana && Date.now() - c.em < 3600_000) return c.valor;
  let valor: Destaque | null = null;
  try { valor = await calcular(semana); } catch (e) { console.error("[destaque]", (e as Error).message); }
  globalThis.__workendDestaque = { em: Date.now(), semana, valor };
  return valor;
}

async function calcular(semana: string): Promise<Destaque | null> {
  await migrar();
  let [g] = await sql<{ donoId: string; visitas: number }[]>`SELECT dono_id, visitas FROM destaque_semana WHERE semana = ${semana}::date`;
  if (!g) {
    const fim = somaDias(semana, 6), TZ = "America/Sao_Paulo";
    const [v] = await sql<{ donoId: string; visitas: number; conversas: number; chave: string }[]>`
      WITH vis AS (
        SELECT v.dono_id, count(DISTINCT v.visitante)::int AS visitas FROM visita_dia v
        WHERE v.dia BETWEEN ${semana}::date AND ${fim}::date GROUP BY v.dono_id
      ), conv AS (
        SELECT e.usuario_id AS dono_id, count(DISTINCT m.visitante_id)::int AS conversas
        FROM mensagem m JOIN agente a ON a.id = m.agente_id JOIN empresa e ON e.id = a.empresa_id
        WHERE m.visitante_id IS NOT NULL AND m.papel = 'user' AND (m.criado_em AT TIME ZONE ${TZ})::date BETWEEN ${semana}::date AND ${fim}::date
        GROUP BY e.usuario_id
      )
      SELECT vis.dono_id, vis.visitas, COALESCE(conv.conversas, 0)::int AS conversas, t.chave
      FROM vis JOIN usuario u ON u.id = vis.dono_id
        JOIN LATERAL (SELECT x.chave FROM terreno x WHERE x.usuario_id = vis.dono_id AND x.status = 'ativo' AND x.anexo_de IS NULL ORDER BY x.reservado_em LIMIT 1) t ON true
        LEFT JOIN conv ON conv.dono_id = vis.dono_id
      WHERE u.banido_em IS NULL AND u.papel <> 'admin' AND u.email <> ${ADMIN_EMAIL}
        AND u.email NOT LIKE '%@workend.test' AND u.email NOT LIKE 'teste-claude%'
        AND vis.visitas > 0
      ORDER BY vis.visitas DESC, conversas DESC, vis.dono_id LIMIT 1`;
    if (!v) return null;
    const ins = await sql`INSERT INTO destaque_semana (semana, dono_id, terreno_chave, visitas, conversas) VALUES (${semana}::date, ${v.donoId}, ${v.chave}, ${v.visitas}, ${v.conversas}) ON CONFLICT (semana) DO NOTHING`;
    if (ins.count) void avisar(v.donoId, { tipo: "sistema", ref: `destaque:${semana}`, titulo: "A sua loja é o destaque da semana! ⭐", texto: `${v.visitas} visitantes na semana passada. Ela aparece no telão da praça e na página inicial até domingo.`, link: "/app/resultados" });
    g = { donoId: v.donoId, visitas: v.visitas };
  }
  // a loja precisa continuar aberta (dados atuais: nome, cor e logo podem ter mudado)
  const [t] = await sql<{ chave: string; empresaNome: string; cor: string; nicho: string; temLogo: boolean }[]>`
    SELECT chave, empresa_nome, cor, nicho, (logo IS NOT NULL) AS tem_logo FROM terreno WHERE usuario_id = ${g.donoId} AND status = 'ativo' AND anexo_de IS NULL ORDER BY reservado_em LIMIT 1`;
  if (!t) return null;
  const numero = LOTE_POR_CHAVE[t.chave]?.numero; if (!numero) return null;
  return { semana, chave: t.chave, numero, empresa: t.empresaNome, nicho: nomeNicho(t.nicho), cor: t.cor, logo: t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null, visitas: g.visitas };
}
