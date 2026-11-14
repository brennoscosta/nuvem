// Loja destaque da semana (público, 13/11/2026): telão da praça, selo no balão e página inicial.
import { lojaDestaque } from "@/server/destaque";
import { temBanco } from "@/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json({ destaque: temBanco() ? await lojaDestaque() : null }, { headers: { "cache-control": "public, max-age=300" } }); }
  catch { return Response.json({ destaque: null }); }
}
