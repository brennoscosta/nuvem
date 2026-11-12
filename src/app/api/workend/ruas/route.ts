// Ruas com nome (12/11/2026). GET (público): os nomes das 8 ruas e, para quem está logado, se pode dar nome a uma.
// POST { rua, nome }: a empresa fundadora dá nome a uma rua livre. DELETE ?rua= (admin): volta ao nome padrão.
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { listarRuas, minhaSituacao, nomearRua, limparRua, ruasAdmin } from "@/server/ruas";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual().catch(() => null);
    const admin = ehAdmin(u) && new URL(req.url).searchParams.has("admin");
    return ok({ ruas: await listarRuas(), eu: await minhaSituacao(u), ...(admin ? { admin: await ruasAdmin() } : {}) });
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const k = `rua:${u.id}:${ipDe(req)}`; const espera = bloqueio(k, 10); if (espera) return demais(espera); contar(k, 60);
    const d = await corpo<{ rua?: string; nome?: string }>(req);
    return ok(await nomearRua(u, d.rua, d.nome));
  } catch (e) { return erro(e, 400); }
}
export async function DELETE(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u || !ehAdmin(u)) return erro("Só o admin.", 403);
    const rua = new URL(req.url).searchParams.get("rua"); if (!rua) return erro("Diga a rua.", 400);
    await limparRua(rua); return ok({ ok: true });
  } catch (e) { return erro(e); }
}
