// Horário de funcionamento da loja (12/11/2026): o letreiro de LED mostra "aberto agora" ou "fechado" pelo horário da
// agenda, quando a loja tem agenda ligada. Público; só os horários da semana (nada de clientes ou horários marcados).
import { lojaDoNumero } from "@/server/resultados";
import { sql, migrar } from "@/server/db";
import { limparConfig } from "@/office/data/agenda";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { numero } = await params;
    const loja = await lojaDoNumero(Number(numero) | 0);
    if (!loja) return Response.json({ fonte: null });
    await migrar();
    const [r] = await sql<{ ligada: boolean; servicos: unknown; horarios: unknown; passo: number; antecedenciaMin: number; diasFrente: number }[]>`SELECT ligada, servicos, horarios, passo, antecedencia_min, dias_frente FROM agenda_loja WHERE dono_id = ${loja.donoId}`.catch(() => []);
    if (!r?.ligada) return Response.json({ fonte: null }, { headers: { "cache-control": "public, max-age=60" } });
    const c = limparConfig(r);
    return Response.json({ fonte: "agenda", horarios: c.horarios }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) { console.error("[horario]", (e as Error).message); return Response.json({ fonte: null }); }
}
