// A loja vista por quem chega (pública): nome, nicho, sobre, contatos, atendente e equipe.
import { lojaPublica, statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try { const { numero } = await params; return ok(await lojaPublica(Number(numero) | 0)); }
  catch (e) { return erro(e, statusDe(e)); }
}
