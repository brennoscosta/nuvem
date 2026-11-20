// POST { creditos?, idem? } → cobra um anúncio da praça pelo caminho único (créditos, Pix ou os dois; frente creditos).
// A cobrança fica em cobrarAnuncioPraca (src/server/praca.ts), tipo "praca" em mercadopago.ts › PRODUTOS.
import { usuarioAtual } from "@/server/usuarios";
import { cobrarAnuncioPraca } from "@/server/praca";
import { pagamentoLigado, opcoesDoCorpo } from "@/server/mercadopago";
import { baseDe } from "@/server/cobrancaProdutos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const b = await corpo<{ creditos?: boolean; idem?: string }>(req);
    // com créditos dá para pagar mesmo sem o Pix ligado (se o saldo cobrir tudo)
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const { id } = await params;
    return ok(await cobrarAnuncioPraca(u, baseDe(req), id, opcoesDoCorpo(b)));
  } catch (e) { return erro(e, 400); }
}
