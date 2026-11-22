// Limpeza dos eventos do Sentry (WE-23, 22/11/2026): nenhum dado pessoal sai do WorkEnd. Vale para o servidor
// (src/server/sentry.ts) e para o navegador (src/instrumentation-client.ts), antes de qualquer envio.
//  - sai a pessoa inteira (id, e-mail, nome, IP), os cookies, os cabeçalhos, o corpo das requisições e as variáveis locais;
//  - sai a parte "?..." e "#..." dos endereços (os links de senha, de e-mail e de pagamento levam código nela);
//  - nos textos que sobram (mensagem do erro, migalhas, extras), e-mail, código Pix (copia e cola) e CPF/CNPJ viram
//    marcadores, e campos com nome de dado pessoal (e-mail, nome, telefone, chave Pix, senha, token...) são apagados.
// Sem dependência do Sentry: só funções puras, para o navegador não carregar nada a mais.
type Obj = Record<string, unknown>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const PIX = /000201[\s\S]*?6304[0-9A-F]{4}/gi; // BR Code: começa em 000201 e termina no CRC (6304 + 4 dígitos)
const PIX_SOLTO = /br\.gov\.bcb\.pix\S*/gi; // pedaço de BR Code que sobrou cortado
const DOCUMENTO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g; // CPF e CNPJ formatados
const CAMPO_PESSOAL = /e-?mail|^nome|_nome$|nome_|^name$|username|full_?name|first_?name|last_?name|telefone|phone|whats|celular|contato|endere[cç]o|address|cpf|cnpj|pix|qr_?code|senha|password|passwd|token|secret|segredo|authorization|cookie|sess(ao|ion)|ip_address/i;

export function limparTexto(s: string): string {
  return s.replace(PIX, "[pix removido]").replace(PIX_SOLTO, "[pix removido]").replace(EMAIL, "[e-mail removido]").replace(DOCUMENTO, "[documento removido]");
}
// endereço sem a busca nem a âncora
export function limparEndereco(u: string): string {
  const i = u.search(/[?#]/);
  return limparTexto(i >= 0 ? u.slice(0, i) : u);
}
function limparValor(v: unknown, prof = 0): unknown {
  if (typeof v === "string") return limparTexto(v);
  if (v === null || typeof v !== "object") return v;
  if (prof > 6) return "[removido]";
  if (Array.isArray(v)) return v.map((x) => limparValor(x, prof + 1));
  const o: Obj = {};
  for (const [k, x] of Object.entries(v as Obj)) o[k] = CAMPO_PESSOAL.test(k) ? "[removido]" : k === "url" && typeof x === "string" ? limparEndereco(x) : limparValor(x, prof + 1);
  return o;
}

interface Quadro { vars?: unknown; [k: string]: unknown }
interface EventoSolto {
  user?: unknown; request?: { url?: unknown; cookies?: unknown; data?: unknown; headers?: unknown; query_string?: unknown; env?: unknown };
  message?: unknown; logentry?: { message?: unknown; params?: unknown };
  exception?: { values?: { value?: unknown; stacktrace?: { frames?: Quadro[] } }[] };
  breadcrumbs?: unknown[]; extra?: unknown; tags?: unknown; transaction?: unknown;
}

export function limparMigalha<B extends object>(b: B): B {
  const m = b as { message?: unknown; data?: unknown };
  if (typeof m.message === "string") m.message = limparTexto(m.message);
  if (m.data !== undefined) m.data = limparValor(m.data);
  return b;
}

export function limparEvento<E extends object>(ev: E): E {
  const e = ev as EventoSolto;
  delete e.user;
  if (e.request) {
    delete e.request.cookies; delete e.request.data; delete e.request.headers; delete e.request.query_string; delete e.request.env;
    if (typeof e.request.url === "string") e.request.url = limparEndereco(e.request.url);
  }
  if (typeof e.message === "string") e.message = limparTexto(e.message);
  if (e.logentry) { if (typeof e.logentry.message === "string") e.logentry.message = limparTexto(e.logentry.message); if (e.logentry.params !== undefined) e.logentry.params = limparValor(e.logentry.params); }
  if (typeof e.transaction === "string") e.transaction = limparEndereco(e.transaction);
  for (const x of e.exception?.values ?? []) {
    if (typeof x.value === "string") x.value = limparTexto(x.value);
    for (const q of x.stacktrace?.frames ?? []) delete q.vars;
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map((b) => (b && typeof b === "object" ? limparMigalha(b) : b));
  if (e.extra !== undefined) e.extra = limparValor(e.extra);
  if (e.tags !== undefined) e.tags = limparValor(e.tags);
  return ev;
}
