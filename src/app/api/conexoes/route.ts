// Conexões com serviços externos da empresa (YouTube hoje). Só admin.
import { listarConexoes, youtubeConfigurado } from "@/server/youtube";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const lista = await listarConexoes();
    return ok({ configurado: { youtube: youtubeConfigurado() }, conexoes: lista });
  } catch (e) { return erro(e); }
}
