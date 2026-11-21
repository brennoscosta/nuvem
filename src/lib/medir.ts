// Medição do WorkEnd (WE-01, 21/11/2026): o único lugar que manda eventos para o Google (dataLayer do Tag Manager e
// gtag do GA4) e para o Meta Pixel. Sem consentimento não faz nada. Os scripts só carregam depois do aceite
// (src/app/workend/_cookies.tsx); até lá, e enquanto eles não estão prontos, os eventos ficam numa fila na memória.
// Os nomes dos eventos são os do brief, exatamente assim, mais cartao_iniciado e cartao_pago do pagamento automático no
// cartão (WE-09, junção v98: ui/Assinatura.tsx), que não usam o pix_pago.
export const EVENTOS = ["ver_preco", "clicar_cta_principal", "cadastro_iniciado", "cadastro_concluido", "abrir_reserva", "reserva_confirmada", "pix_gerado", "pix_pago", "loja_publicada", "checklist_completo", "cartao_iniciado", "cartao_pago"] as const;
export type Evento = (typeof EVENTOS)[number];
export type Parametros = Record<string, string | number | boolean | undefined>;
export const ehEvento = (v: unknown): v is Evento => typeof v === "string" && (EVENTOS as readonly string[]).includes(v);

// Escolha da pessoa no aviso de cookies: cookie de primeira parte (essencial), lido só no navegador.
// Formato "v1.a1.m0": versão, análise (Google Analytics, Tag Manager e Clarity) e anúncios (Meta Pixel).
export interface Consentimento { analise: boolean; anuncios: boolean }
export const COOKIE_CONSENTIMENTO = "we_cookies";
const VALIDADE_DIAS = 180;

export function lerConsentimento(): Consentimento | null {
  if (typeof document === "undefined") return null;
  try {
    const m = /(?:^|;\s*)we_cookies=v1\.a([01])\.m([01])(?:;|$)/.exec(document.cookie);
    return m ? { analise: m[1] === "1", anuncios: m[2] === "1" } : null;
  } catch { return null; }
}

export function gravarConsentimento(c: Consentimento) {
  try {
    const seguro = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_CONSENTIMENTO}=v1.a${c.analise ? 1 : 0}.m${c.anuncios ? 1 : 0}; Max-Age=${VALIDADE_DIAS * 86400}; Path=/; SameSite=Lax${seguro}`;
  } catch { /* navegador sem cookies: o aviso volta na próxima página */ }
}

type Janela = Window & {
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
  fbq?: (...a: unknown[]) => void;
};

// fila até os scripts estarem prontos (_cookies.tsx chama ligarEnvio depois do consentimento)
let ligado = false;
const fila: [Evento, Parametros][] = [];

function enviar(evento: Evento, p: Parametros) {
  const c = lerConsentimento(); if (!c) return;
  const w = window as Janela;
  const limpo: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined) limpo[k] = v;
  if (c.analise) {
    (w.dataLayer ??= []).push({ event: evento, ...limpo }); // gatilhos do Tag Manager
    w.gtag?.("event", evento, limpo); // GA4 direto (NEXT_PUBLIC_GA_ID)
  }
  if (c.anuncios) w.fbq?.("trackCustom", evento, limpo);
}

// Manda um evento. Devolve false quando não há consentimento (e nada sai do navegador).
export function medir(evento: Evento, p: Parametros = {}): boolean {
  if (typeof window === "undefined" || !ehEvento(evento)) return false;
  const c = lerConsentimento();
  if (!c || (!c.analise && !c.anuncios)) return false;
  if (!ligado) { if (fila.length < 50) fila.push([evento, p]); return true; }
  enviar(evento, p);
  return true;
}

// Uma vez só por navegador para a mesma chave (pagamento, loja, cadastro): recarregar a página não conta de novo
const enviados = new Set<string>();
export function medirUmaVez(chave: string, evento: Evento, p: Parametros = {}): boolean {
  const k = `we_medido:${chave}`;
  if (enviados.has(k)) return false;
  try { if (localStorage.getItem(k)) { enviados.add(k); return false; } } catch { /* sem armazenamento: vale a memória */ }
  if (!medir(evento, p)) return false;
  enviados.add(k);
  try { localStorage.setItem(k, String(Date.now())); } catch { /* idem */ }
  return true;
}

// Evento disparado logo antes de sair da página (o login com Google): guardado na aba e enviado na página seguinte
const PENDENTES = "we_medir_pendentes";
export function medirDepois(evento: Evento, p: Parametros = {}) {
  if (typeof window === "undefined" || !lerConsentimento()) return;
  try {
    const l = JSON.parse(sessionStorage.getItem(PENDENTES) ?? "[]") as [Evento, Parametros][];
    l.push([evento, p]); sessionStorage.setItem(PENDENTES, JSON.stringify(l.slice(-10)));
  } catch { medir(evento, p); }
}

// Chamado por _cookies.tsx quando o consentimento está dado e as filas do Google e do Meta já existem
export function ligarEnvio() {
  ligado = true;
  try {
    const l = JSON.parse(sessionStorage.getItem(PENDENTES) ?? "[]") as [Evento, Parametros][];
    sessionStorage.removeItem(PENDENTES);
    fila.unshift(...l.filter(([e]) => ehEvento(e)).map(([e, p]): [Evento, Parametros] => [e, p ?? {}]));
  } catch { /* nada pendente */ }
  for (const [e, p] of fila.splice(0)) enviar(e, p);
}
export function desligarEnvio() { ligado = false; fila.length = 0; }
