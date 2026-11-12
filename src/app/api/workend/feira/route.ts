// Barraca na feira de sábado: POST { vaga, nome, descricao, cor, tipo, whatsapp, instagram } → reserva e devolve o Pix.
import { usuarioAtual } from "@/server/usuarios";
import { alugarBarraca } from "@/server/cidade";
import { pagamentoLigado } from "@/server/mercadopago";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const url = new URL(req.url); const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? url.host}`;
    return ok(await alugarBarraca(u, await corpo(req), base));
  } catch (e) { return erro(e, 400); }
}
