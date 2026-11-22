// Erros do navegador no Sentry (WE-23, 22/11/2026), sob demanda: a página não traz nada do Sentry. Este arquivo só escuta
// os erros sem tratamento ("error" e "unhandledrejection"). No primeiro, pergunta ao servidor se o Sentry está ligado
// (/api/sentry, que lê SENTRY_DSN na hora) e, se estiver, baixa o pacote, envia o que ficou na fila e sai do caminho (dali
// em diante o próprio Sentry escuta). Sem SENTRY_DSN, para de escutar e nada mais é baixado.
// Tudo passa por src/lib/sentryLimpar.ts antes de sair; no máximo 10 envios por página aberta.
import { limparEvento, limparMigalha } from "@/lib/sentryLimpar";
import { COLETA_SENTRY } from "@/lib/sentryColeta";

const IGNORAR = [/ResizeObserver loop/i, /^Script error\.?$/i]; // ruído do navegador e de scripts de fora, sem detalhe
const MAX_ENVIOS = 10;
let fase: "parado" | "ligando" | "pronto" | "desligado" = "parado";
let envios = 0;
const fila: unknown[] = [];

const erroDe = (ev: Event): unknown => ("reason" in ev ? (ev as PromiseRejectionEvent).reason : (ev as ErrorEvent).error ?? (ev as ErrorEvent).message);
const ignorar = (x: unknown) => { const m = x instanceof Error ? x.message : String(x ?? ""); return !m || IGNORAR.some((r) => r.test(m)); };
function parar() { window.removeEventListener("error", escutar); window.removeEventListener("unhandledrejection", escutar); }

function escutar(ev: Event) {
  if (fase === "pronto" || fase === "desligado") return;
  const x = erroDe(ev);
  if (ignorar(x)) return;
  if (fila.length < MAX_ENVIOS) fila.push(x);
  if (fase === "parado") void ligar();
}

async function ligar() {
  fase = "ligando";
  try {
    const r = await fetch("/api/sentry", { cache: "no-store" });
    const { dsn, ambiente } = (await r.json()) as { dsn?: string | null; ambiente?: string };
    if (!dsn) { fase = "desligado"; parar(); fila.length = 0; return; }
    const Sentry = await import("@/lib/sentryNavegador");
    Sentry.init({
      dsn, environment: ambiente || "producao", dataCollection: COLETA_SENTRY, maxBreadcrumbs: 30, ignoreErrors: IGNORAR,
      beforeSend: (e) => (++envios > MAX_ENVIOS ? null : limparEvento(e)),
      beforeBreadcrumb: (b) => limparMigalha(b),
    });
    fase = "pronto"; parar();
    for (const x of fila.splice(0)) Sentry.captureException(x);
  } catch { fase = "desligado"; parar(); fila.length = 0; }
}

if (typeof window !== "undefined") { window.addEventListener("error", escutar); window.addEventListener("unhandledrejection", escutar); }
