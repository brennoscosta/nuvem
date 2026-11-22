// Webhook da WhatsApp Business Platform (WE-18, 22/11/2026, src/server/whatsapp.ts).
//  - GET: a Meta confere o endereço (hub.mode=subscribe, hub.verify_token e hub.challenge).
//  - POST: mensagens recebidas e situações de entrega, com a assinatura X-Hub-Signature-256 conferida sobre o corpo bruto.
//    Responde 200 na hora e trabalha depois (after), como a Meta pede; mensagem repetida é ignorada pelo hash do id.
// Desligado (sem WHATSAPP_CHAVE): GET 403 e POST 404.
import { after } from "next/server";
import { verificarWebhook, receberWebhook } from "@/server/whatsapp";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_BYTES = 1_000_000;
export async function GET(req: Request) {
  const desafio = await verificarWebhook(new URL(req.url).searchParams).catch(() => null);
  return desafio ? new Response(desafio, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }) : new Response("recusado", { status: 403 });
}
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return new Response("grande demais", { status: 413 });
  const bruto = Buffer.from(await req.arrayBuffer());
  if (bruto.length > MAX_BYTES) return new Response("grande demais", { status: 413 });
  try {
    const r = await receberWebhook(bruto, req.headers.get("x-hub-signature-256"));
    if (r.depois) after(r.depois);
    return new Response(r.status === 200 ? "ok" : "recusado", { status: r.status });
  } catch (e) {
    // banco fora do ar: 500 faz a Meta tentar de novo mais tarde
    console.error("[whatsapp] webhook:", (e as Error).message);
    return new Response("erro", { status: 500 });
  }
}
