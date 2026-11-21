// Logo da empresa que reservou o lote (público, usado na placa do lote e no cartão).
import { logoDoTerreno } from "@/server/terrenos";
import { logoDaPagina, ehChaveDePagina } from "@/server/planoVitrine";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { chave } = await params;
  const ch = decodeURIComponent(chave);
  // página grátis (Plano Vitrine, WE-13): a logo fica na página
  const l = await (ehChaveDePagina(ch) ? logoDaPagina(ch) : logoDoTerreno(ch)).catch(() => null);
  if (!l) return new Response("sem logo", { status: 404 });
  return new Response(new Uint8Array(l.dados), { headers: { "content-type": l.tipo, "cache-control": "public, max-age=60" } });
}
