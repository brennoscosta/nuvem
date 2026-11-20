// Cria a cobrança do lote no Mercado Pago (Pix direto, QR no cartão do lote). Sessão do WorkEnd obrigatória.
// GET devolve a cotação (oferta de entrada e crédito de indicação, src/server/ofertas.ts) para o cartão mostrar o preço certo.
import { cookies } from "next/headers";
import { criarCobranca, pagamentoLigado, opcoesDoCorpo } from "@/server/mercadopago";
import { cobrarModelo } from "@/server/modelos";
import { cotacaoLote, registrarIndicacao } from "@/server/ofertas";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { QUIOSQUE_POR_CHAVE } from "@/office/data/quiosques";
// lote da lista ou quiosque (20/11/2026): o número vai na descrição do Pix
const pontoDaChave = (ch: string) => LOTE_POR_CHAVE[ch] ?? QUIOSQUE_POR_CHAVE[ch] ?? null;

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
    if (!pontoDaChave(ch)) return erro("Lote inválido.", 400);
    await ligarIndicacao(u.id);
    const meses = Number(new URL(req.url).searchParams.get("meses")) || 1;
    return ok(await cotacaoLote(u, ch, meses));
  } catch (e) { return erro(e); }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { chave } = await params; const ch = decodeURIComponent(chave);
    const lote = pontoDaChave(ch); if (!lote) return erro("Lote inválido.", 400);
    const b = await corpo<{ meses?: number; tipo?: "lote" | "layout" | "modelo"; modelo?: string; creditos?: boolean; idem?: string }>(req);
    const { meses, tipo, modelo } = b;
    // com créditos dá para pagar mesmo sem o Pix ligado (se o saldo cobrir tudo)
    if (!pagamentoLigado() && !b.creditos) return erro("O pagamento ainda não está ligado. Tente mais tarde.", 503);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "workend.online";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    // modelo de prédio do catálogo (20/11/2026): a conferência e a cobrança ficam em src/server/modelos.ts › cobrarModelo
    if (tipo === "modelo") return ok(await cobrarModelo(u, ch, modelo, `${proto}://${host}`, opcoesDoCorpo(b)));
    await ligarIndicacao(u.id);
    return ok(await criarCobranca(u, ch, lote.numero, `${proto}://${host}`, meses ?? 1, tipo === "layout" ? "layout" : "lote", opcoesDoCorpo(b)));
  } catch (e) { return erro(e, e instanceof Error && /Reserve|suspensa|renova junto|lote|modelo|Modelo|grátis|quiosque/.test(e.message) ? 400 : 500); }
}
