// Pagamento automático do lote e do quiosque (WE-09, src/server/assinaturas.ts). Sessão do WorkEnd obrigatória.
// GET ?chave= → chaves ligadas (cartão, Pix Automático), a assinatura do lote e a cotação (1ª cobrança e mensalidade).
// POST { acao: "contratar", chave, meio, token, idem } | { acao: "cancelar", chave } | { acao: "cartao", chave, token }.
// O cartão nunca chega aqui: só o token gerado pelos campos seguros do Mercado Pago no navegador.
import { usuarioAtual } from "@/server/usuarios";
import { minhaAssinatura, contratar, cancelar, trocarCartao } from "@/server/assinaturas";
import { ok, erro, corpo } from "@/server/http";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { QUIOSQUE_POR_CHAVE } from "@/office/data/quiosques";

export const dynamic = "force-dynamic";
const valida = (ch: unknown) => (typeof ch === "string" && (LOTE_POR_CHAVE[ch] || QUIOSQUE_POR_CHAVE[ch]) ? ch : null);

export async function GET(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const ch = valida(new URL(req.url).searchParams.get("chave")); if (!ch) return erro("Lote inválido.", 400);
    return ok(await minhaAssinatura(u, ch));
  } catch (e) { return erro(e); }
}

export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const b = await corpo<{ acao?: string; chave?: string; meio?: string; token?: string; idem?: string }>(req);
    const ch = valida(b.chave); if (!ch) return erro("Lote inválido.", 400);
    if (b.acao === "cancelar") return ok(await cancelar(u, ch));
    if (b.acao === "cartao") return ok(await trocarCartao(u, ch, b.token));
    if (b.acao !== "contratar") return erro("Ação inválida.", 400);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "workend.online";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return ok(await contratar(u, ch, b, `${proto}://${host}`));
  } catch (e) { return erro(e, e instanceof Error && /Reserve|suspensa|renova junto|ligado|disponível|cartão|Lote/.test(e.message) ? 400 : 500); }
}
