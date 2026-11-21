// Cartão da imagem pedida à equipe (21/11/2026, src/server/imagemEquipe.ts).
// POST { lote, id, acao: "gerar" | "cancelar" | "vitrine", formato?, logo?, produto?, vitrine?: { produto?, nome? } } → { imagem, aviso }
import { usuarioAtual } from "@/server/usuarios";
import { imagemDoDono, statusDe } from "@/server/equipeCliente";
import { ErroImagem, type AcaoImagem } from "@/server/imagemEquipe";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<AcaoImagem & { lote?: string }>(req);
    return ok(await imagemDoDono(u, d.lote ?? null, d));
  } catch (e) { return erro(e, e instanceof ErroImagem ? e.status : statusDe(e)); }
}
