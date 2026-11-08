// Conversa com um personagem: GET lista (com ?desde= pra pegar só as novas), POST envia {tipo, texto}
import { usuarioAtual } from "@/server/usuarios";
import { conversa, enviarMensagem, meuPersonagem, personagemAtivo } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ outro: string }> };
export async function GET(req: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); const { outro } = await params; return ok(await conversa(u.id, outro, new URL(req.url).searchParams.get("desde"))); }
  catch (e) { return erro(e); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    if (!personagemAtivo(await meuPersonagem(u.id), u)) return erro("Ative seu personagem pra conversar com outras pessoas.", 402);
    const { outro } = await params; const d = await corpo<{ tipo?: string; texto?: string }>(req);
    return ok(await enviarMensagem(u, outro, d.tipo ?? "chat", d.texto ?? ""));
  } catch (e) { return erro(e); }
}
