// Vitrine pública da loja (12/11/2026): produtos à mostra, nome da empresa, WhatsApp e atendente. Usada no cartão do
// lote no mapa e na página /loja/N.
import { vitrinePublica } from "@/server/vitrine";
import { statusDe } from "@/server/equipeCliente";
import { erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try { const { numero } = await params; return Response.json(await vitrinePublica(Number(numero) | 0), { headers: { "cache-control": "public, max-age=15" } }); }
  catch (e) { return erro(e, statusDe(e)); }
}
