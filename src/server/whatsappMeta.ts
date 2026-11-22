// WhatsApp da loja (WE-18, 22/11/2026): o lado da Meta, separado da conversa (src/server/whatsapp.ts). Aqui ficam as
// variáveis de ambiente que ligam tudo, a cifra do token e do número, a chamada à Graph API (Cloud API) e o custo da Meta
// por mensagem. DESLIGADO por padrão: sem WHATSAPP_CHAVE o painel não mostra a aba e o webhook não responde.
//
// Variáveis de ambiente (nenhuma vai para o repositório nem para registro):
//  - WHATSAPP_CHAVE: liga o WhatsApp e cifra tokens e números no banco (32 letras ou mais; trocar depois = perder o que
//    está cifrado, e as lojas conectam de novo).
//  - WHATSAPP_VERIFY_TOKEN: token de verificação do webhook do aplicativo da plataforma WorkEnd (hub.verify_token).
//  - META_APP_SECRET: chave secreta do aplicativo da plataforma; confere a assinatura X-Hub-Signature-256 e troca o código
//    do cadastro incorporado pelo token da loja.
//  - META_APP_ID e META_CONFIG_ID: com o segredo acima, ligam o cadastro incorporado da Meta (Embedded Signup) no painel.
//  - WHATSAPP_GRAPH_BASE e WHATSAPP_GRAPH_VERSAO: só para teste (a Graph API falsa) ou para trocar a versão da Graph API.
//  - WHATSAPP_CUSTO_META_BRL: troca o custo da Meta por resposta de serviço (padrão abaixo); 0 = não desconta.
//  - WHATSAPP_META_PROVEDOR_IA=1: usa a tarifa de "provedor de IA" (abaixo) no lugar da de serviço.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export class ErroWhatsApp extends Error { constructor(msg: string, public status = 400) { super(msg); } }

// ---------- ligado? ----------
const base = () => process.env.WHATSAPP_CHAVE?.trim() ?? "";
const subchave = (uso: string) => (base().length >= 32 ? createHash("sha256").update(`workend-whatsapp:${uso}:${base()}`).digest() : null);
export const whatsappLigado = () => base().length >= 32;
export function exigirLigado() { if (!whatsappLigado()) throw new ErroWhatsApp("O WhatsApp ainda não está ligado no WorkEnd.", 404); }
export const segredoDaPlataforma = () => process.env.META_APP_SECRET?.trim() || null;
export const verificacaoDaPlataforma = () => process.env.WHATSAPP_VERIFY_TOKEN?.trim() || null;
export const versaoGraph = () => process.env.WHATSAPP_GRAPH_VERSAO?.trim() || "v24.0";
// cadastro incorporado (Embedded Signup): precisa do aplicativo da plataforma WorkEnd na Meta
export function cadastroIncorporado(): { appId: string; configId: string; versao: string } | null {
  const appId = process.env.META_APP_ID?.trim(), configId = process.env.META_CONFIG_ID?.trim();
  return whatsappLigado() && appId && configId && segredoDaPlataforma() ? { appId, configId, versao: versaoGraph() } : null;
}

// ---------- cifra (AES-256-GCM) e hashes ----------
export function cifrar(texto: string): string {
  const k = subchave("cifra"); if (!k) throw new ErroWhatsApp("O WhatsApp ainda não está ligado no WorkEnd.", 404);
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}
export function decifrar(s: string): string {
  const k = subchave("cifra"); if (!k) throw new ErroWhatsApp("O WhatsApp ainda não está ligado no WorkEnd.", 404);
  const [v, iv, tag, ct] = s.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("cifra desconhecida");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
// HMAC com a chave do WhatsApp: acha a mesma pessoa sem guardar o número aberto
export function hmacWhatsApp(texto: string) {
  const k = subchave("hmac"); if (!k) throw new ErroWhatsApp("O WhatsApp ainda não está ligado no WorkEnd.", 404);
  return createHmac("sha256", k).update(texto).digest("hex");
}
export const hashSimples = (t: string) => createHash("sha256").update(t).digest("hex");
export function iguais(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
// X-Hub-Signature-256: "sha256=" + HMAC-SHA256 do corpo bruto com a chave secreta do aplicativo
export function assinaturaConfere(bruto: Buffer, cabecalho: string | null, segredo: string) {
  const h = (cabecalho ?? "").trim().toLowerCase();
  if (!h.startsWith("sha256=") || !segredo) return false;
  return iguais(h, "sha256=" + createHmac("sha256", segredo).update(bruto).digest("hex"));
}

// ---------- Graph API (Cloud API) ----------
export class ErroGraph extends Error { constructor(msg: string, public codigo: number | null, public http: number) { super(msg); } }
const raiz = () => (process.env.WHATSAPP_GRAPH_BASE?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
// o token vai só no cabeçalho; nada de token, número ou corpo em registro
export async function graph<T = Record<string, unknown>>(metodo: "GET" | "POST" | "DELETE", caminho: string, d: { token?: string; corpo?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const q = d.query ? `?${new URLSearchParams(d.query)}` : "";
  let r: Response;
  try {
    r = await fetch(`${raiz()}/${versaoGraph()}/${caminho}${q}`, {
      method: metodo, cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { ...(d.token ? { authorization: `Bearer ${d.token}` } : {}), ...(d.corpo !== undefined ? { "content-type": "application/json" } : {}) },
      body: d.corpo !== undefined ? JSON.stringify(d.corpo) : undefined,
    });
  } catch (e) { throw new ErroGraph(`A Meta não respondeu agora (${(e as Error).message.slice(0, 80)}).`, null, 0); }
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!r.ok || j.error) throw new ErroGraph(String(j.error?.message ?? `HTTP ${r.status}`).slice(0, 200), j.error?.code ?? null, r.status);
  return j;
}

// ---------- custo da Meta (consumo de unidades de IA, como a própria IA; NÃO é preço de venda) ----------
// Fonte: documentação oficial da Meta, "Pricing on the WhatsApp Business Platform", "Pricing for non-template messages" e
// "New pricing policy for AI Providers" (developers.facebook.com/documentation/business-messaging/whatsapp/pricing,
// .../pricing/non-template-messages e .../pricing/ai-providers), consultadas em 22/11/2026:
//  - cobrança por mensagem ENTREGUE desde 01/07/2025; a mensagem que o cliente manda não custa.
//  - resposta fora de modelo dentro da janela de 24 h ("service"): cobrada por mensagem desde 01/10/2026, com a mesma
//    tarifa de utilidade e autenticação do país. No Brasil a Meta cita US$ 0,0068 (0,68 centavo de dólar) por mensagem.
//    Em reais (tabela BRL, faturada pela Facebook Brasil) a utilidade sai a R$ 0,035: o arquivo oficial em BRL não abriu
//    daqui, o valor veio das cópias da tabela publicadas por parceiros da Meta (ChatMaxima, jul/2026; AiSensy, set/2026).
//    TODO(dono): conferir na tabela oficial em BRL antes de lançar.
//  - a Meta dá 1.000 mensagens de serviço grátis por número por mês. Aqui essa cota NÃO é descontada: ela conta todas as
//    mensagens do número, inclusive as que a loja manda fora do WorkEnd, e o WorkEnd não sabe quantas foram.
//  - modelo de utilidade fora da janela: R$ 0,035; de marketing: US$ 0,0625 (R$ 0,3217 na tabela BRL).
//  - "provedores de IA" (política da Meta de 16/02/2026, que começou pela Itália; no Brasil, +55, vale desde 11/03/2026):
//    quem oferece IA de uso geral pelo WhatsApp paga US$ 0,0625 por mensagem fora de modelo (TechCrunch, 06/03/2026,
//    "After Europe, WhatsApp will let rival AI companies offer chatbots in Brazil"). A atendente de uma loja falando da
//    própria loja é atendimento ao cliente, não IA de uso geral, por isso o padrão é a tarifa de serviço;
//    WHATSAPP_META_PROVEDOR_IA=1 troca para a de provedor de IA se a Meta classificar o WorkEnd assim.
// A conversão em unidades é a de sempre (unidadesIA.ts › unidadesDoCusto: 1 unidade = R$ 0,01, arredondando para cima):
// R$ 0,035 = 4 unidades por mensagem que sai; R$ 0,3217 = 33.
export const CUSTO_META_BRL = { servico: 0.035, utilidade: 0.035, autenticacao: 0.035, marketing: 0.3217, provedorIA: 0.3217 } as const;
export type CategoriaMeta = "servico" | "utilidade" | "autenticacao" | "marketing";
export function custoMeta(c: CategoriaMeta): number {
  if (c !== "servico") return CUSTO_META_BRL[c];
  const env = process.env.WHATSAPP_CUSTO_META_BRL?.trim();
  if (env && Number.isFinite(Number(env)) && Number(env) >= 0) return Number(env);
  return process.env.WHATSAPP_META_PROVEDOR_IA === "1" ? CUSTO_META_BRL.provedorIA : CUSTO_META_BRL.servico;
}

// ---------- texto ----------
// número parcialmente escondido: o dono vê o DDD e os 4 últimos dígitos
export function mascararNumero(waId: string) {
  const d = waId.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${"•".repeat(d.length - 8)}-${d.slice(-4)}`;
  return `+${d.slice(0, 2)} ${"•".repeat(Math.max(2, d.length - 6))}-${d.slice(-4)}`;
}
// o WhatsApp não lê markdown: negrito com um asterisco, sem títulos, link escrito por extenso
export function paraWhatsApp(t: string) {
  return t.replace(/\r/g, "").replace(/^#{1,6}\s*/gm, "").replace(/\*\*([^*\n]+)\*\*/g, "*$1*").replace(/__([^_\n]+)__/g, "_$1_")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}
