// Roupas e acessórios do personagem: GET → o que comprei e o que estou usando; POST { comprar } → Pix; PUT { usando } → vestir.
import { usuarioAtual } from "@/server/usuarios";
import { meusItens, comprarItem, vestir } from "@/server/cidade";
import { pagamentoLigado } from "@/server/mercadopago";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await usuarioAtual(); if (!u) return ok({ comprados: [], usando: [] }); return ok(await meusItens(u)); } catch (e) { return erro(e); } }
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const { comprar } = await corpo<{ comprar?: string }>(req);
    const url = new URL(req.url); const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? url.host}`;
    return ok(await comprarItem(u, String(comprar ?? ""), base));
  } catch (e) { return erro(e, 400); }
}
export async function PUT(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const { usando } = await corpo<{ usando?: unknown }>(req); return ok({ usando: await vestir(u, usando) }); } catch (e) { return erro(e, 400); }
}
