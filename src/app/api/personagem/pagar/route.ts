// Pix do personagem (R$ 5,90/mês). Desde 21/11/2026 o personagem básico é grátis (server/personagens.ts › PERSONAGEM_GRATIS):
// a rota não abre cobrança nova; o código fica para voltar a cobrar, se um dia o dono quiser.
import { usuarioAtual } from "@/server/usuarios";
import { criarCobrancaPersonagem, pagamentoLigado, opcoesDoCorpo } from "@/server/mercadopago";
import { meuPersonagem, PERSONAGEM_GRATIS } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (PERSONAGEM_GRATIS) return erro("O personagem agora é grátis: é só montar o seu e entrar no mapa.", 410);
    const b = await corpo<{ meses?: number; creditos?: boolean; idem?: string }>(req);
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    if (!(await meuPersonagem(u.id))) return erro("Monte seu personagem antes de pagar.", 400);
    const { meses } = b;
    const url = new URL(req.url); const base = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? url.host}`;
    return ok(await criarCobrancaPersonagem(u, base, meses ?? 1, opcoesDoCorpo(b)));
  } catch (e) { return erro(e); }
}
