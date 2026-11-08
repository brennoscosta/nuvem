// Cria a cobrança do lote no Mercado Pago e devolve o link do checkout. Sessão do WorkEnd obrigatória.
import { criarCobranca, pagamentoLigado } from "@/server/mercadopago";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const { chave } = await params; const ch = decodeURIComponent(chave);
    const lote = LOTE_POR_CHAVE[ch]; if (!lote) return erro("Lote inválido.", 400);
    const { meses, tipo } = await corpo<{ meses?: number; tipo?: "lote" | "layout" }>(req);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "workend.online";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return ok(await criarCobranca(u, ch, lote.numero, `${proto}://${host}`, meses ?? 1, tipo === "layout" ? "layout" : "lote"));
  } catch (e) { return erro(e, e instanceof Error && /Reserve|suspensa/.test(e.message) ? 400 : 500); }
}
