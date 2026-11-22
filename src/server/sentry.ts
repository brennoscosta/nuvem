// Erros do servidor no Sentry (WE-23, 22/11/2026). Só é carregado quando SENTRY_DSN existe (src/instrumentation.ts lê a
// variável na hora em que o servidor sobe, não na compilação): sem ela, nada do Sentry entra na memória e nada muda.
// Pega o que o Next entrega em onRequestError (rotas, páginas e server components que estouram) e as rotas que devolvem
// erro 500 pelo http.ts (o erro é tratado lá e não chega ao Next). Antes de sair, tudo passa por src/lib/sentryLimpar.ts.
// Sem rastreamento de desempenho (tracesSampleRate ausente): só erros, para caber no plano grátis.
import * as Sentry from "@sentry/nextjs";
import { limparEvento, limparMigalha } from "@/lib/sentryLimpar";
import { COLETA_SENTRY } from "@/lib/sentryColeta";

declare global {
  var __workendSentry: boolean | undefined;
  var __workendAvisarErro: ((e: unknown) => void) | undefined;
}

export function ligarSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || globalThis.__workendSentry) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || "producao",
    dataCollection: COLETA_SENTRY,
    maxBreadcrumbs: 30,
    // sem a integração de HTTP do Sentry: ela põe ouvintes de fechamento em cada resposta (sessões, escopo por pedido) e,
    // somados aos do próprio Next, o Node avisava de possível vazamento de memória a cada página. Os erros continuam
    // chegando com a rota e o pedido pelo onRequestError e pelo http.ts; sai só o escopo separado por pedido.
    integrations: (padrao) => padrao.filter((i) => i.name !== "Http"),
    beforeSend: (ev) => limparEvento(ev),
    beforeBreadcrumb: (b) => limparMigalha(b),
  });
  globalThis.__workendSentry = true;
  globalThis.__workendAvisarErro = (e) => { Sentry.captureException(e); };
  console.log("[sentry] erros do servidor ligados");
}

export function erroDaRequisicao(...args: Parameters<typeof Sentry.captureRequestError>) {
  if (globalThis.__workendSentry) Sentry.captureRequestError(...args);
}
