// A cena 3D consulta aqui os eventos novos (polling leve; vira WebSocket depois).
import { garantirEmpresa, eventosDesde } from "@/server/agentes";
import { ok, erro } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const emp = await garantirEmpresa();
    const desde = new URL(req.url).searchParams.get("desde");
    const d = desde ? new Date(desde) : new Date(Date.now() - 60_000);
    const evs = await eventosDesde(emp, d);
    return ok({ eventos: evs, agora: new Date().toISOString() });
  } catch (e) { return erro(e); }
}
