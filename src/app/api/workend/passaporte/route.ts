// Passaporte da cidade (20/11/2026, frente "visitante"): os meus carimbos, marcos, insígnias, pedidos de hoje e a caça
// de Natal. Sem conta: { logado: false }.
import { usuarioAtual } from "@/server/usuarios";
import { meuPassaporte, ErroPassaporte } from "@/server/passaporte";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual(); if (!u || u.banidoEm) return ok({ logado: false }); return ok({ logado: true, ...(await meuPassaporte(u)) }); }
  catch (e) { return erro(e, e instanceof ErroPassaporte ? e.status : 500); }
}
