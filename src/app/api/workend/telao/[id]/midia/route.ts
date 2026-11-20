// A imagem ou o vídeo de um anúncio da praça: público depois de aprovado; antes, só o dono e o admin.
import { usuarioAtual } from "@/server/usuarios";
import { midiaAnuncio } from "@/server/praca";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const u = await usuarioAtual().catch(() => null);
  const m = await midiaAnuncio(id, u).catch(() => null);
  if (!m) return new Response("sem mídia", { status: 404 });
  return new Response(new Uint8Array(m.dados), { headers: { "content-type": m.tipo, "cache-control": m.publico ? "public, max-age=3600" : "private, no-store", "x-content-type-options": "nosniff" } });
}
