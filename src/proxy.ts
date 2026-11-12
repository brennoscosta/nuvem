// Roteamento por domínio: o mesmo app serve o Escritório (nuvem.nuvemhost.cloud) e o WorkEnd (workend.online).
// No domínio do WorkEnd: "/" é a landing, "/cadastro", "/entrar" e "/app" são do produto e "/admin" é o escritório 3D
// (com a senha de admin de sempre) e "/mundo" é o mapa dos lotes à venda, com o login do próprio WorkEnd. Nos outros domínios nada muda.
import { NextResponse, type NextRequest } from "next/server";
import { ehHostWorkend } from "@/server/hosts";

export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!ehHostWorkend(host, req.nextUrl.searchParams)) return NextResponse.next();
  const r = rotaWorkend(req);
  // "Indique um vizinho" (12/11/2026): ?ind=CODIGO guarda por 30 dias quem indicou; vale no 1º pagamento do lote
  const ind = req.nextUrl.searchParams.get("ind");
  if (ind && /^[A-Z0-9]{4,10}$/i.test(ind)) r.cookies.set("we_ind", ind.toUpperCase(), { maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return r;
}

function rotaWorkend(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const url = req.nextUrl.clone();
  const noindex = (r: NextResponse) => { r.headers.set("x-robots-tag", "noindex, nofollow"); return r; };
  if (p === "/admin" || p === "/admin/") { url.pathname = "/"; return noindex(NextResponse.rewrite(url)); }
  if (p === "/mundo" || p === "/mundo/") { url.pathname = "/"; return NextResponse.rewrite(url); }
  if (p === "/app" || p.startsWith("/app/")) { url.pathname = "/workend" + p; return noindex(NextResponse.rewrite(url)); }
  // busca de profissionais e empresas e a página pública de cada loja (11/11/2026)
  if (p === "/encontrar" || /^\/loja\/\d{1,4}$/.test(p)) { url.pathname = "/workend" + p; return NextResponse.rewrite(url); }
  if (p === "/" || p === "/cadastro" || p === "/entrar" || p === "/politicas" || p === "/esqueci" || p === "/redefinir") { url.pathname = "/workend" + (p === "/" ? "" : p); return NextResponse.rewrite(url); }
  return NextResponse.next();
}

export const config = {
  // só páginas: nada de _next, api, arquivos estáticos (têm extensão)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
