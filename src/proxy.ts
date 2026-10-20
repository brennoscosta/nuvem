// Roteamento por domínio: o mesmo app serve o Escritório (nuvem.nuvemhost.cloud) e o WorkEnd (workend.online).
// No domínio do WorkEnd: "/" é a landing, "/cadastro", "/entrar" e "/app" são do produto e "/admin" é o escritório 3D
// (com a senha de admin de sempre). Nos outros domínios nada muda.
import { NextResponse, type NextRequest } from "next/server";
import { ehHostWorkend } from "@/server/hosts";

export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!ehHostWorkend(host, req.nextUrl.searchParams)) return NextResponse.next();
  const p = req.nextUrl.pathname;
  const url = req.nextUrl.clone();
  const noindex = (r: NextResponse) => { r.headers.set("x-robots-tag", "noindex, nofollow"); return r; };
  if (p === "/admin" || p === "/admin/") { url.pathname = "/"; return noindex(NextResponse.rewrite(url)); }
  if (p === "/app" || p.startsWith("/app/")) { url.pathname = "/workend" + p; return noindex(NextResponse.rewrite(url)); }
  if (p === "/" || p === "/cadastro" || p === "/entrar") { url.pathname = "/workend" + (p === "/" ? "" : p); return NextResponse.rewrite(url); }
  return NextResponse.next();
}

export const config = {
  // só páginas: nada de _next, api, arquivos estáticos (têm extensão)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
