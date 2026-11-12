// Clique que leva o visitante para fora da loja (WhatsApp, Instagram, site, e-mail, produto da vitrine): conta no
// painel de resultados do dono. Público; chamado com navigator.sendBeacon, nunca bloqueia o clique.
import { lojaDoNumero, registrarClique, TIPOS_CLIQUE, type TipoClique } from "@/server/resultados";
import { usuarioAtual } from "@/server/usuarios";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const d = (await req.json().catch(() => ({}))) as { numero?: number; tipo?: string; ref?: string };
    const tipo = String(d.tipo ?? "") as TipoClique;
    if (!TIPOS_CLIQUE.includes(tipo)) return new Response(null, { status: 204 });
    const loja = await lojaDoNumero(Number(d.numero) | 0);
    if (loja) { const u = await usuarioAtual().catch(() => null); await registrarClique(req.headers, loja, u?.id ?? null, tipo, typeof d.ref === "string" ? d.ref : null); }
  } catch (e) { console.error("[clique]", (e as Error).message); }
  return new Response(null, { status: 204 });
}
