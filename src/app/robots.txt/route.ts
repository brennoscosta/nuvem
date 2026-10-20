// robots.txt por domínio: o WorkEnd é indexável (menos app/admin/api); o escritório da Nuvem é vitrine pública, só sem /api.
import { ehHostWorkend } from "@/server/hosts";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const corpo = ehHostWorkend(host)
    ? `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://workend.online/sitemap.xml\n`
    : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /workend/\n`;
  return new Response(corpo, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
