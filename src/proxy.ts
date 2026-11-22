// Roteamento por domínio: o mesmo app serve o Escritório (nuvem.nuvemhost.cloud) e o WorkEnd (workend.online).
// No domínio do WorkEnd: "/" é a landing, "/cadastro", "/entrar" e "/app" são do produto e "/admin" é o escritório 3D
// (com a senha de admin de sempre) e "/mundo" é o mapa dos lotes à venda, com o login do próprio WorkEnd. Nos outros domínios nada muda.
import { NextResponse, type NextRequest } from "next/server";
import { ehHostWorkend } from "@/server/hosts";
import { PALAVRAS_RESERVADAS, ENDERECO_SEDES, slugValido } from "@/office/data/slugLoja";

// o mesmo nome de src/server/usuarios.ts (COOKIE); o proxy não importa o módulo do servidor (banco e cripto)
const COOKIE_SESSAO = "workend_sessao";
// a página inicial do visitante (WE-16): sem o cookie de sessão, navegação de verdade (pede text/html) e sem gravar cookie
const paraVisitante = (req: NextRequest) => !req.cookies.has(COOKIE_SESSAO) && (req.headers.get("accept") ?? "").includes("text/html") && !req.nextUrl.searchParams.has("ind");
const CACHE_VISITANTE = "public, max-age=0, s-maxage=60, stale-while-revalidate=86400";

export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!ehHostWorkend(host, req.nextUrl.searchParams)) {
    // WE-16: com HOSTNAME=127.0.0.1 (as cópias de teste; a produção usa 0.0.0.0) o Next repassa a reescrita do "/" como
    // externa: o pedido volta aqui já como /workend e com o x-forwarded-host trocado pelo endereço do servidor. É a mesma
    // página do visitante, então leva o mesmo cabeçalho (senão sai o no-store do Next)
    if (req.nextUrl.pathname === "/workend" && paraVisitante(req)) { const r = NextResponse.next(); r.headers.set("cache-control", CACHE_VISITANTE); return r; }
    return NextResponse.next();
  }
  const r = rotaWorkend(req);
  // "Indique um vizinho" (12/11/2026): ?ind=CODIGO guarda por 30 dias quem indicou; vale no 1º pagamento do lote
  const ind = req.nextUrl.searchParams.get("ind");
  if (ind && /^[A-Z0-9]{4,10}$/i.test(ind)) { r.cookies.set("we_ind", ind.toUpperCase(), { maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", secure: true, path: "/" }); r.headers.delete("cache-control"); } // WE-16: resposta que grava cookie não vai para cache compartilhado
  return r;
}

function rotaWorkend(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const url = req.nextUrl.clone();
  // marca a requisição como do WorkEnd para as páginas lerem (17/11/2026): o mapa e o "não encontrado" são da raiz,
  // compartilhada com o escritório da Nuvem, e o cabeçalho de domínio nem sempre chega igual até a página
  const h = new Headers(req.headers); h.set("x-site", "workend");
  const reescrever = (u: URL) => NextResponse.rewrite(u, { request: { headers: h } });
  const noindex = (r: NextResponse) => { r.headers.set("x-robots-tag", "noindex, nofollow"); return r; };
  if (p === "/admin" || p === "/admin/") { url.pathname = "/"; return noindex(NextResponse.rewrite(url)); }
  if (p === "/mundo" || p === "/mundo/") { url.pathname = "/"; return reescrever(url); }
  if (p === "/app" || p.startsWith("/app/")) { url.pathname = "/workend" + p; return noindex(reescrever(url)); }
  // busca de profissionais e empresas e a página pública de cada loja (11/11/2026)
  // até 5 algarismos: a página grátis (Plano Vitrine, WE-13) tem número a partir de 10001, e /loja/N leva ao endereço dela
  if (p === "/encontrar" || /^\/loja\/\d{1,5}$/.test(p)) { url.pathname = "/workend" + p; return reescrever(url); }
  // perfil público do cadastro (20/11/2026): /perfil/<apelido>
  if (/^\/perfil\/[a-z0-9-]{3,40}\/?$/.test(p)) { url.pathname = "/workend" + p.replace(/\/$/, ""); return reescrever(url); }
  // WE-16 (22/11/2026): "/" sem o cookie de sessão é a mesma página para qualquer visitante (nada de quem vê): pode ir
  // para cache compartilhado (nginx ou CDN na frente) por 60 s, servindo a velha por até 1 dia enquanto busca a nova; o
  // navegador sempre confere de novo (max-age=0). O Next não troca um Cache-Control que já veio na resposta, mas grava o
  // Vary por cima: o cache da frente TEM de ignorar o cache quando houver o cookie workend_sessao (ver o relatório da WE-16).
  // Com o cookie (mesmo vencido) e na navegação interna do Next (RSC: o Next tira o cabeçalho RSC antes do proxy, mas ela
  // não pede text/html), fica o padrão do Next: sem cache.
  if (p === "/" && paraVisitante(req)) {
    url.pathname = "/workend"; const r = reescrever(url);
    r.headers.set("cache-control", CACHE_VISITANTE);
    return r;
  }
  // /emails: preferências dos avisos por e-mail, pelo link assinado do rodapé (WE-17, 21/11/2026); /planos: a escada de planos (WE-19)
  // /status: página pública de status dos serviços (WE-23, 22/11/2026)
  if (p === "/" || p === "/cadastro" || p === "/entrar" || p === "/politicas" || p === "/esqueci" || p === "/redefinir" || p === "/emails" || p === "/planos" || p === "/status") { url.pathname = "/workend" + (p === "/" ? "" : p); return reescrever(url); }
  // página própria da loja (WE-11, 21/11/2026; junção v100: depois de todas as rotas do site, inclusive /emails da WE-17): workend.online/<slug> é a mesma página de /loja/N (data/slugLoja.ts);
  // com letra maiúscula, leva para o endereço em minúsculas. Palavra reservada que não é sede (/sobre, /planos…) não é
  // loja: fica para a rota do site que um dia existir
  const seg = /^\/([A-Za-z0-9-]{3,40})$/.exec(p)?.[1], s = seg?.toLowerCase() ?? "";
  if (seg && slugValido(s) && (!PALAVRAS_RESERVADAS.has(s) || ENDERECO_SEDES.has(s))) {
    if (seg !== s) { url.pathname = "/" + s; return NextResponse.redirect(url, 301); }
    url.pathname = "/workend/loja/" + seg; return reescrever(url);
  }
  return NextResponse.next({ request: { headers: h } });
}

export const config = {
  // só páginas: nada de _next, api, arquivos estáticos (têm extensão)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
