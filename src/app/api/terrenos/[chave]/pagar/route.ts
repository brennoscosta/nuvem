// Cria a cobrança do lote no Mercado Pago (Pix direto, QR no cartão do lote). Sessão do WorkEnd obrigatória.
// GET devolve a cotação (oferta de entrada e crédito de indicação, src/server/ofertas.ts) para o cartão mostrar o preço certo.
import { cookies } from "next/headers";
import { criarCobranca, pagamentoLigado } from "@/server/mercadopago";
import { cotacaoLote, registrarIndicacao } from "@/server/ofertas";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };

// quem chegou pelo link de indicação (cookie we_ind, gravado pelo src/proxy.ts) fica ligado a quem indicou antes da cotação
async function ligarIndicacao(uid: string) {
  const c = (await cookies()).get("we_ind")?.value;
  if (c) await registrarIndicacao(uid, c).catch(() => null);
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { chave } = await params; const ch = decodeURIComponent(chave);
    if (!LOTE_POR_CHAVE[ch]) return erro("Lote inválido.", 400);
    await ligarIndicacao(u.id);
    const meses = Number(new URL(req.url).searchParams.get("meses")) || 1;
    return ok(await cotacaoLote(u, ch, meses));
  } catch (e) { return erro(e); }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    if (!pagamentoLigado()) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const { chave } = await params; const ch = decodeURIComponent(chave);
    const lote = LOTE_POR_CHAVE[ch]; if (!lote) return erro("Lote inválido.", 400);
    const { meses, tipo } = await corpo<{ meses?: number; tipo?: "lote" | "layout" }>(req);
    await ligarIndicacao(u.id);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "workend.online";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return ok(await criarCobranca(u, ch, lote.numero, `${proto}://${host}`, meses ?? 1, tipo === "layout" ? "layout" : "lote"));
  } catch (e) { return erro(e, e instanceof Error && /Reserve|suspensa/.test(e.message) ? 400 : 500); }
}
