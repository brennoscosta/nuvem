// Avisos no celular (web push, 13/11/2026) sem pacote novo: o push vai SEM conteúdo (sem criptografar mensagem) e o service
// worker (public/sw.js) busca o aviso mais recente em /api/workend/avisos. Só precisamos do cabeçalho VAPID: um JWT ES256
// assinado com o crypto do Node. O par de chaves (P-256) é criado na primeira vez e fica no banco (config_sistema "vapid");
// a chave privada nunca sai do servidor nem aparece em registro.
import { createPrivateKey, generateKeyPairSync, sign, type KeyObject, type JsonWebKey } from "node:crypto";
import { sql, migrar } from "./db";
import { bloqueio, contar } from "./limite";

const ASSUNTO = "mailto:contato@workend.online";
const b64url = (b: Buffer) => b.toString("base64url");

declare global {
  var __workendVapid: { publica: string; privada: KeyObject } | undefined;
}

// chave pública em formato "bruto" (0x04 || x || y, 65 bytes, base64url): é o que o navegador pede no subscribe()
async function chaves() {
  if (globalThis.__workendVapid) return globalThis.__workendVapid;
  await migrar();
  const [r] = await sql<{ valor: { jwk: JsonWebKey } }[]>`SELECT valor FROM config_sistema WHERE nome = 'vapid'`;
  let jwk = r?.valor?.jwk;
  if (!jwk?.d || !jwk.x || !jwk.y) {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const novo = privateKey.export({ format: "jwk" }) as JsonWebKey;
    // se dois processos criarem ao mesmo tempo, fica a primeira gravada
    await sql`INSERT INTO config_sistema (nome, valor) VALUES ('vapid', ${sql.json({ jwk: novo } as never)}) ON CONFLICT (nome) DO NOTHING`;
    const [de] = await sql<{ valor: { jwk: JsonWebKey } }[]>`SELECT valor FROM config_sistema WHERE nome = 'vapid'`;
    jwk = de.valor.jwk;
  }
  const publica = b64url(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, "base64url"), Buffer.from(jwk.y!, "base64url")]));
  const privada = createPrivateKey({ key: jwk, format: "jwk" });
  return (globalThis.__workendVapid = { publica, privada });
}
export async function chavePublicaPush() { return (await chaves()).publica; }

// JWT VAPID (RFC 8292): {aud: origem do serviço de push, exp, sub}, assinado ES256 (r||s, 64 bytes)
export async function cabecalhoVapid(endpoint: string, agora = Date.now()) {
  const { publica, privada } = await chaves();
  const aud = new URL(endpoint).origin;
  const cab = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(Buffer.from(JSON.stringify({ aud, exp: Math.floor(agora / 1000) + 12 * 3600, sub: ASSUNTO })));
  const assinatura = sign("sha256", Buffer.from(`${cab}.${corpo}`), { key: privada, dsaEncoding: "ieee-p1363" });
  return { Authorization: `vapid t=${cab}.${corpo}.${b64url(assinatura)}, k=${publica}`, jwt: `${cab}.${corpo}.${b64url(assinatura)}`, publica };
}

const endpointValido = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === "https:" && String(u).length < 1000; } catch { return false; } };

export async function salvarInscricao(usuarioId: string, d: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, aparelho = "") {
  if (!endpointValido(d.endpoint)) throw new Error("Inscrição inválida.");
  await migrar();
  const ep = String(d.endpoint);
  const p256dh = typeof d.keys?.p256dh === "string" ? d.keys.p256dh.slice(0, 200) : "", auth = typeof d.keys?.auth === "string" ? d.keys.auth.slice(0, 100) : "";
  // no máximo 10 aparelhos por conta: o mais antigo sai
  await sql`INSERT INTO push_inscricao (endpoint, usuario_id, p256dh, auth, aparelho) VALUES (${ep}, ${usuarioId}, ${p256dh}, ${auth}, ${aparelho.slice(0, 120)})
    ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, falhas = 0`;
  await sql`DELETE FROM push_inscricao WHERE usuario_id = ${usuarioId} AND endpoint NOT IN (SELECT endpoint FROM push_inscricao WHERE usuario_id = ${usuarioId} ORDER BY criado_em DESC LIMIT 10)`;
}
export async function removerInscricao(usuarioId: string, endpoint: unknown) {
  await migrar();
  await sql`DELETE FROM push_inscricao WHERE usuario_id = ${usuarioId} AND endpoint = ${String(endpoint ?? "")}`;
}
export async function temInscricao(usuarioId: string, endpoint?: string | null) {
  await migrar();
  const [r] = endpoint
    ? await sql`SELECT 1 FROM push_inscricao WHERE usuario_id = ${usuarioId} AND endpoint = ${endpoint}`
    : await sql`SELECT 1 FROM push_inscricao WHERE usuario_id = ${usuarioId} LIMIT 1`;
  return !!r;
}

// Um envio para um aparelho. 201/202 = entregue ao serviço; 404/410 = inscrição morta (sai do banco).
export async function enviarParaInscricao(endpoint: string) {
  const v = await cabecalhoVapid(endpoint);
  const r = await fetch(endpoint, { method: "POST", headers: { Authorization: v.Authorization, TTL: "86400", Urgency: "normal", "Content-Length": "0" }, signal: AbortSignal.timeout(6000) });
  if (r.status === 404 || r.status === 410) await sql`DELETE FROM push_inscricao WHERE endpoint = ${endpoint}`;
  else if (r.ok) await sql`UPDATE push_inscricao SET ultimo_ok = now(), falhas = 0 WHERE endpoint = ${endpoint}`;
  else await sql`UPDATE push_inscricao SET falhas = falhas + 1 WHERE endpoint = ${endpoint}`;
  return r.status;
}

// Chamado pelo avisar(): nunca lança nem segura quem chamou. Até 6 envios por conta por minuto (o aparelho mostra o aviso
// mais recente, então avisos em rajada viram uma notificação só).
export function avisarNoCelular(usuarioId: string) {
  const k = `push:${usuarioId}`;
  if (bloqueio(k, 6)) return;
  contar(k, 1);
  void (async () => {
    try {
      const lista = await sql<{ endpoint: string }[]>`SELECT endpoint FROM push_inscricao WHERE usuario_id = ${usuarioId} AND falhas < 20 LIMIT 10`;
      await Promise.all(lista.map((x) => enviarParaInscricao(x.endpoint).catch((e) => console.error("[push]", (e as Error).message))));
    } catch (e) { console.error("[push]", (e as Error).message); }
  })();
}
