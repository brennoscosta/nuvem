// Clima da cidade (12/11/2026): o mesmo para todos os visitantes (src/server/clima.ts). Público, com cache curto.
import { climaAtual } from "@/server/clima";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await climaAtual();
  return Response.json(c, { headers: { "cache-control": "public, max-age=300" } });
}
