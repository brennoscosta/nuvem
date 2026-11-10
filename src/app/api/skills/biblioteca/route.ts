// Biblioteca de skills do escritório com a versão que vale hoje (as que evoluíram substituem as do código)
import { SKILLS_PRONTAS } from "@/office/data/skillsProntas";
import { versoesAtivas } from "@/server/evolucao";
import { ehAdmin, naoAutorizado } from "@/server/auth";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const m = await versoesAtivas();
    return ok({ skills: SKILLS_PRONTAS.map((p) => { const v = p.especialistaId ? m.get(`${p.especialistaId}::${p.nome}`) : undefined; return v ? { ...p, quandoUsar: v.quandoUsar, passos: v.passos, versao: v.versao } : p; }) });
  } catch (e) { return erro(e); }
}
