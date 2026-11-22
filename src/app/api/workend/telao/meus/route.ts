// Os anúncios da praça do dono logado, os eventos dele que podem ir para o destaque e a data livre do patrocínio.
import { usuarioAtual } from "@/server/usuarios";
import { dadosAnuncios } from "@/server/telasIniciais";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
// WE-16 (22/11/2026): a resposta sai de server/telasIniciais.ts, a mesma conta da página /app/divulgar
export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await dadosAnuncios(u)); }
  catch (e) { return erro(e); }
}
