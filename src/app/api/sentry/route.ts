// Sentry do navegador (WE-23, 22/11/2026): src/instrumentation-client.ts pergunta aqui, só depois do primeiro erro da
// página, se o Sentry está ligado. O DSN é lido na hora (não na compilação) e é público por natureza (só serve para
// enviar erros). Sem SENTRY_DSN, devolve dsn nulo e o navegador não baixa nada.
export const dynamic = "force-dynamic";

export function GET() {
  const dsn = process.env.SENTRY_DSN?.trim() || null;
  return Response.json({ dsn, ambiente: process.env.SENTRY_ENVIRONMENT?.trim() || "producao" }, { headers: { "cache-control": "no-store" } });
}
