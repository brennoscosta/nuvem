// Qual site está sendo servido: o WorkEnd (workend.online) ou o escritório da Nuvem. Usado pelo proxy, robots e sitemap.
export function ehHostWorkend(host: string, busca?: URLSearchParams) {
  const h = host.toLowerCase().split(":")[0];
  return /(^|\.)workend\.online$/.test(h) || /(^|\.)workend\.localhost$/.test(h) || busca?.get("site") === "workend";
}
