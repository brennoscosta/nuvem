// sitemap.xml do WorkEnd (só as páginas públicas). No domínio da Nuvem devolve só a raiz.
import { ehHostWorkend } from "@/server/hosts";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = ehHostWorkend(host)
    ? [["https://workend.online/", "weekly", "1.0"], ["https://workend.online/cadastro", "monthly", "0.8"], ["https://workend.online/entrar", "monthly", "0.3"]]
    : [["https://nuvem.nuvemhost.cloud/", "weekly", "1.0"]];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, f, p]) => `  <url><loc>${u}</loc><lastmod>${hoje}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
