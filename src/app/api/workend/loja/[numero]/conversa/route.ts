// Conversa do visitante com a atendente da loja (precisa estar logado). GET → as minhas mensagens; POST { texto }.
import { usuarioAtual } from "@/server/usuarios";
import { conversaNaLoja, falarNaLoja, statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return ok([]); const { numero } = await params; return ok(await conversaNaLoja(u, Number(numero) | 0)); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para conversar com a loja.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const { numero } = await params; const d = await corpo<{ texto?: string }>(req);
    return ok(await falarNaLoja(u, Number(numero) | 0, d.texto ?? ""));
  } catch (e) { return erro(e, statusDe(e)); }
}
