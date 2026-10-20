// Conexões com redes sociais da empresa. Só admin.
import { listarConexoes } from "@/server/conexoes";
import { REDES } from "@/server/redes";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const configurado = Object.fromEntries(Object.entries(REDES).map(([k, r]) => [k, r.configurado()]));
    return ok({ configurado, conexoes: await listarConexoes() });
  } catch (e) { return erro(e); }
}
