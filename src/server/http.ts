// Utilidades das rotas: JSON e tratamento de erro padronizados.
export function ok(data: unknown, status = 200) { return Response.json(data, { status }); }
export function erro(e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  // WE-23 (22/11/2026): o erro 500 tratado aqui não chega ao onRequestError do Next; com o Sentry ligado
  // (src/server/sentry.ts), ele vai para lá. Erro 4xx é aviso para quem usa (dado faltando, sem permissão): não vai.
  if (status >= 500) globalThis.__workendAvisarErro?.(e);
  return Response.json({ erro: msg }, { status });
}
export async function corpo<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
// WE-16 (22/11/2026): dados para a página já sair pronta do servidor, no mesmo formato que a tela recebe da API (passa
// por JSON: datas viram texto). Se der erro, null: a tela abre em "Carregando…" e busca a API, como antes.
export async function jsonInicial<T>(p: Promise<unknown>): Promise<T | null> {
  try { return JSON.parse(JSON.stringify(await p)) as T; } catch { return null; }
}
