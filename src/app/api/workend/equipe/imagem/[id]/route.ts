// A imagem que a equipe gerou (21/11/2026), lida do banco: só o dono (ou sócio) do lote vê. ?baixar=1 baixa o arquivo.
import { usuarioAtual } from "@/server/usuarios";
import { arquivoDaImagem, statusDe } from "@/server/equipeCliente";
import { erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { id } = await params;
    const q = new URL(req.url).searchParams;
    const a = await arquivoDaImagem(u, q.get("lote"), decodeURIComponent(id));
    if (!a) return erro("Imagem não encontrada.", 404);
    const h: Record<string, string> = { "content-type": a.mime, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" };
    if (q.get("baixar")) h["content-disposition"] = `attachment; filename="${a.nome}"`;
    return new Response(new Uint8Array(a.dados), { headers: h });
  } catch (e) { return erro(e, statusDe(e)); }
}
