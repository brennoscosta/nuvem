// Treino pelo dono: POST { lote, membro, mensagemId, avaliacao (1 | -1 | null), correcao? } — a correção vira regra
// permanente; POST { lote, membro, removerRegra } apaga uma regra.
import { usuarioAtual } from "@/server/usuarios";
import { treinarMembro, statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<{ lote?: string; membro?: string; mensagemId?: string; avaliacao?: 1 | -1 | null; correcao?: string; removerRegra?: string }>(req);
    return ok(await treinarMembro(u, d.lote ?? null, d.membro ?? "", d));
  } catch (e) { return erro(e, statusDe(e)); }
}
