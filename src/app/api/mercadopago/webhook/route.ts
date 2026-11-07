// Webhook do Mercado Pago. Vem como ?type=payment&data.id=... (ou ?topic=payment&id=...) e/ou no corpo.
// Nunca confiamos no conteúdo: buscamos o pagamento na API com o nosso token e só então ativamos o chão.
import { tratarWebhook } from "@/server/mercadopago";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const corpo = await req.json().catch(() => ({})) as { type?: string; topic?: string; action?: string; data?: { id?: string | number }; id?: string | number };
  const tipo = (url.searchParams.get("type") ?? url.searchParams.get("topic") ?? corpo.type ?? corpo.topic ?? "").toString();
  const id = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? corpo.data?.id ?? corpo.id ?? null;
  try { await tratarWebhook(tipo.startsWith("payment") ? "payment" : tipo, id != null ? String(id) : null); }
  catch (e) { console.error("[mercadopago] webhook:", e instanceof Error ? e.message : e); }
  return Response.json({ ok: true }); // sempre 200: o Mercado Pago reenvia se não for 2xx
}
export async function GET() { return Response.json({ ok: true }); }
