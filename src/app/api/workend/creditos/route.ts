// Carteira de créditos do usuário: GET → saldo, extrato, pacotes, regras e o que ainda pode ser devolvido;
// POST { pacote, idem } → Pix do pacote (o pacote não se paga com créditos).
import { usuarioAtual } from "@/server/usuarios";
import { cobrar, pagamentoLigado, liberarReservasVencidas } from "@/server/mercadopago";
import { produtoPacoteCreditos, baseDe } from "@/server/cobrancaProdutos";
import { dadosCreditos } from "@/server/telasIniciais";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    await liberarReservasVencidas(u.id).catch((e) => console.error("[creditos] reservas:", (e as Error).message));
    return ok(await dadosCreditos(u)); // WE-16: a mesma conta da página /app/creditos (server/telasIniciais.ts)
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const b = await corpo<{ pacote?: string; idem?: string }>(req);
    return ok(await cobrar(u, baseDe(req), produtoPacoteCreditos(u, b.pacote), { idem: b.idem }));
  } catch (e) { return erro(e, 400); }
}
