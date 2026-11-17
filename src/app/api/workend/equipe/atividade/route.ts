// Atividade da equipe para a cena 3D (16/11/2026): as últimas ~30 trocas internas, da mais antiga à mais nova.
// GET ?chave=<lote> (ou ?lote=) → { trocas: [{ de: membroId, para: membroId, texto (até 120), em: ISO, tipo: "pedido" | "resposta" }] }
// Só o dono do lote ou o admin (o conteúdo é interno da empresa).
import { usuarioAtual } from "@/server/usuarios";
import { atividadeDoDono, statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = new URL(req.url).searchParams;
    return ok(await atividadeDoDono(u, p.get("chave") ?? p.get("lote")));
  } catch (e) { return erro(e, statusDe(e)); }
}
