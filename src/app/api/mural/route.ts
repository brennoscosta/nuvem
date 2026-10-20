// Mural da fachada: GET público (visitante vê versão pública), POST só autenticado (hoje: admin/CEO).
import { listarMural, falarNoMural } from "@/server/mural";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try { return ok(await listarMural(await ehAdmin())); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const { texto, para } = await corpo<{ texto: string; para?: string }>(req);
    if (!texto?.trim()) return erro("texto vazio", 400);
    return ok(await falarNoMural(texto.trim().slice(0, 2000), "CEO", para));
  } catch (e) { return erro(e); }
}
