// Utilidades das rotas: JSON e tratamento de erro padronizados.
export function ok(data: unknown, status = 200) { return Response.json(data, { status }); }
export function erro(e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  return Response.json({ erro: msg }, { status });
}
export async function corpo<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
