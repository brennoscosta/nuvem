// Seguir uma loja (13/11/2026). GET ?numero=N → { seguindo, seguidores, meu }; POST { numero } liga/desliga (precisa de conta).
import { usuarioAtual } from "@/server/usuarios";
import { estadoSeguir, alternarSeguir } from "@/server/seguir";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const numero = Number(new URL(req.url).searchParams.get("numero")) | 0;
    const u = await usuarioAtual().catch(() => null);
    const e = await estadoSeguir(u?.id ?? null, numero);
    return e ? ok({ ...e, logado: !!u }) : erro("Esta loja não está aberta agora.", 404);
  } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta para seguir a loja.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const k = `seguir:${u.id}:${ipDe(req)}`; const espera = bloqueio(k, 30); if (espera) return demais(espera); contar(k, 10);
    const { numero } = await corpo<{ numero?: number }>(req);
    return ok(await alternarSeguir(u.id, Number(numero) | 0));
  } catch (e) { return erro(e, 400); }
}
