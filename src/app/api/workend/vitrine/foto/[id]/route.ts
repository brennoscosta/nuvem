// Foto de um produto da vitrine. Com ?v= (a versão que a vitrine manda), fica em cache por um ano: editar o produto
// muda a versão. Produto escondido: só o dono vê, sem cache público.
import { usuarioAtual } from "@/server/usuarios";
import { fotoDoProduto } from "@/server/vitrine";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const u = await usuarioAtual().catch(() => null);
  const f = await fotoDoProduto(id, u).catch(() => null);
  if (!f) return new Response("sem foto", { status: 404 });
  const etag = `"${id}-${f.versao}"`;
  const cache = f.publico ? (new URL(req.url).searchParams.get("v") === String(f.versao) ? "public, max-age=31536000, immutable" : "public, max-age=300") : "private, no-store";
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag, "cache-control": cache } });
  return new Response(new Uint8Array(f.dados), { headers: { "content-type": f.tipo, etag, "cache-control": cache, "x-content-type-options": "nosniff" } });
}
