// Começa o login com Google: manda pro consentimento do Google e volta em /api/workend/google/volta
import { googleLigado, urlDeLogin } from "@/server/google";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? url.host}`;
  if (!googleLigado()) return Response.redirect(`${base}/entrar?erro=${encodeURIComponent("Login com Google ainda não está configurado.")}`, 302);
  const lote = url.searchParams.get("lote");
  const destino = lote ? `/mundo?lote=${encodeURIComponent(lote)}` : url.searchParams.get("destino") || "/app";
  return Response.redirect(urlDeLogin(base, destino), 302);
}
