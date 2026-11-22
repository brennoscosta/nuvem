// Unidades de IA da empresa de um lote: GET ?chave= → medidor (saldo, consumo do mês, estimativa em respostas, extrato
// por agente e por tipo); POST { chave, pacote, creditos, idem } → compra de unidades (créditos ou Pix).
import { usuarioAtual } from "@/server/usuarios";
import { cobrar, opcoesDoCorpo, pagamentoLigado } from "@/server/mercadopago";
import { produtoUnidades, baseDe } from "@/server/cobrancaProdutos";
import { dadosUnidades } from "@/server/telasIniciais";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    return ok(await dadosUnidades(u, new URL(req.url).searchParams.get("chave"))); // WE-16: a mesma conta da página /app/creditos
  } catch (e) { return erro(e, 400); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const b = await corpo<{ chave?: string; pacote?: string; creditos?: boolean; idem?: string }>(req);
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    return ok(await cobrar(u, baseDe(req), await produtoUnidades(u, String(b.chave ?? ""), b.pacote), opcoesDoCorpo(b)));
  } catch (e) { return erro(e, 400); }
}
