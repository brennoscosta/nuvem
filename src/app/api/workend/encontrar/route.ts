// Busca pública de profissionais e empresas (11/11/2026). GET ?tipo=profissionais|empresas&q=&nicho=&disponivel=1&online=1
import { buscarProfissionais } from "@/server/personagens";
import { buscarEmpresas } from "@/server/equipeCliente";
import { NICHOS } from "@/office/data/mundo";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const nicho = NICHOS.some((n) => n.id === p.get("nicho")) ? p.get("nicho") : null;
    const q = p.get("q");
    if (p.get("tipo") === "empresas") return ok(await buscarEmpresas({ q, nicho }));
    return ok(await buscarProfissionais({ q, nicho, disponivel: p.get("disponivel") === "1", online: p.get("online") === "1" }));
  } catch (e) { return erro(e); }
}
