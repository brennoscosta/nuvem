// Volta do Google: valida o state, troca o código, abre a sessão e manda pro destino (mapa no lote ou painel)
import { lerState, concluirLogin } from "@/server/google";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? url.host}`;
  const volta = (erro: string) => Response.redirect(`${base}/entrar?erro=${encodeURIComponent(erro)}`, 302);
  const st = lerState(url.searchParams.get("state"));
  if (!st) return volta("Login expirou. Tente de novo.");
  if (url.searchParams.get("error")) return volta("Você cancelou o login com Google.");
  const code = url.searchParams.get("code"); if (!code) return volta("Google não devolveu o código.");
  try { await concluirLogin(base, code); return Response.redirect(`${base}${st.destino}`, 302); }
  catch (e) { return volta((e as Error).message); }
}
