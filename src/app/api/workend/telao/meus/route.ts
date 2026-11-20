// Os anúncios da praça do dono logado, os eventos dele que podem ir para o destaque e a data livre do patrocínio.
import { usuarioAtual } from "@/server/usuarios";
import { meusAnuncios } from "@/server/praca";
import { pagamentoLigado } from "@/server/mercadopago";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok({ ...(await meusAnuncios(u)), pagamento: pagamentoLigado() }); }
  catch (e) { return erro(e); }
}
