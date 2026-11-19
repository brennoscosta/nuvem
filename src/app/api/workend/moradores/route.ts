// Moradores da cidade (19/11/2026): o que cada morador lembra do visitante logado, para o cumprimento pelo nome quando
// ele passa perto (sem IA). Sem login: lista vazia.
import { usuarioAtual } from "@/server/usuarios";
import { relacoesDoUsuario } from "@/server/moradores";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual(); if (!u || u.banidoEm) return ok({ logado: !!u, relacoes: [] }); return ok({ logado: true, relacoes: await relacoesDoUsuario(u) }); }
  catch (e) { return erro(e); }
}
