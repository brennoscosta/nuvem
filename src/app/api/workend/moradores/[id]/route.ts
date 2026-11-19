// Conversa com um morador da cidade (19/11/2026). GET → ficha (fala de abertura, relação, última conversa);
// POST { acao?, texto?, nova? } → as duas falas e a relação atualizada. Conversar exige estar logado (igual à loja).
import { usuarioAtual } from "@/server/usuarios";
import { fichaMorador, falarComMorador } from "@/server/moradores";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); const { id } = await params; return ok(await fichaMorador(u && !u.banidoEm ? u : null, id, new URL(req.url).searchParams.get("seg"))); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para conversar com os moradores.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const { id } = await params; const d = await corpo<{ acao?: string; texto?: string; nova?: boolean; seg?: number }>(req);
    return ok(await falarComMorador(u, id, { acao: typeof d.acao === "string" ? d.acao : undefined, texto: typeof d.texto === "string" ? d.texto : undefined, nova: d.nova === true, seg: d.seg }));
  } catch (e) { return erro(e, statusDe(e)); }
}
