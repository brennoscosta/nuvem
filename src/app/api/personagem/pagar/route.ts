// Pix do personagem (R$ 5,90/mês)
import { usuarioAtual } from "@/server/usuarios";
import { criarCobrancaPersonagem, pagamentoLigado } from "@/server/mercadopago";
import { meuPersonagem } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    if (!(await meuPersonagem(u.id))) return erro("Monte seu personagem antes de pagar.", 400);
    const { meses } = await corpo<{ meses?: number }>(req);
    const url = new URL(req.url); const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? url.host}`;
    return ok(await criarCobrancaPersonagem(u, base, meses ?? 1));
  } catch (e) { return erro(e); }
}
