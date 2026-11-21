// sitemap.xml do WorkEnd: as páginas públicas e, desde a WE-12 (21/11/2026), uma entrada por loja no ar, no endereço próprio
// dela (workend.online/<slug>, src/server/enderecoLoja.ts › lojasNoAr), gerado do banco a cada pedido (guardado 1 hora).
// No domínio da Nuvem devolve só a raiz.
import { ehHostWorkend } from "@/server/hosts";
import { lojasNoAr } from "@/server/enderecoLoja";
export const dynamic = "force-dynamic";
const SITE = "https://workend.online";
export async function GET(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hoje = new Date().toISOString().slice(0, 10);
  type Url = { loc: string; freq: string; prio: string; mod: string };
  let urls: Url[];
  if (ehHostWorkend(host)) {
    const fixas: Url[] = [["/", "weekly", "1.0"], ["/cadastro", "monthly", "0.8"], ["/entrar", "monthly", "0.3"], ["/encontrar", "daily", "0.7"]]
      .map(([c, freq, prio]) => ({ loc: `${SITE}${c}`, freq, prio, mod: hoje }));
    const lojas = await lojasNoAr().catch((e: Error) => { console.error("[sitemap]", e.message); return []; });
    urls = [...fixas, ...lojas.map((l) => ({ loc: `${SITE}/${l.slug}`, freq: "weekly", prio: "0.6", mod: l.atualizadoEm }))];
  } else urls = [{ loc: "https://nuvem.nuvemhost.cloud/", freq: "weekly", prio: "1.0", mod: hoje }];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.mod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
