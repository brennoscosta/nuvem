// Avisos no celular (13/11/2026). GET → { chave } (chave pública VAPID para o subscribe); POST { endpoint, keys } inscreve
// (sem efeito se já estava: o aparelho regrava ao abrir o sino); DELETE { endpoint } desliga. O endpoint nunca vai na URL.
import { usuarioAtual } from "@/server/usuarios";
import { chavePublicaPush, salvarInscricao, removerInscricao } from "@/server/push";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual().catch(() => null);
    return ok({ chave: await chavePublicaPush(), logado: !!u });
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const d = await corpo<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>(req);
    await salvarInscricao(u.id, d, req.headers.get("user-agent") ?? "");
    return ok({ ok: true });
  } catch (e) { return erro(e, 400); }
}
export async function DELETE(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const { endpoint } = await corpo<{ endpoint?: string }>(req);
    await removerInscricao(u.id, endpoint);
    return ok({ ok: true });
  } catch (e) { return erro(e, 400); }
}
