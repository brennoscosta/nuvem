// Entrar com Google (OAuth 2.0, fluxo de servidor). Usa GOOGLE_CLIENT_ID/SECRET do CapRover; redirect
// https://workend.online/api/workend/google/volta (cadastrado no cliente "nuvem escritório" do console do Google).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql, id, migrar } from "./db";
import { abrirSessao, type Usuario } from "./usuarios";
import { registrar } from "./eventos";
import { enviarEmail } from "./email";

export const googleLigado = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
const segredo = () => process.env.GOOGLE_CLIENT_SECRET ?? process.env.ADMIN_SENHA ?? "workend";
const CAMPOS = () => sql`id, email, nome, empresa_nome, interesse_em, criado_em, ultimo_acesso, papel, banido_em, banido_motivo`;

// state assinado: carrega o destino (?lote=…) e um nonce; validado na volta (sem precisar de sessão antes do login)
export function criarState(destino: string) {
  const corpo = Buffer.from(JSON.stringify({ d: destino.slice(0, 200), n: randomBytes(8).toString("hex"), t: Date.now() })).toString("base64url");
  const ass = createHmac("sha256", segredo()).update(corpo).digest("base64url");
  return `${corpo}.${ass}`;
}
export function lerState(state: string | null): { destino: string } | null {
  if (!state || !state.includes(".")) return null;
  const [corpo, ass] = state.split(".");
  const esperado = createHmac("sha256", segredo()).update(corpo).digest("base64url");
  if (ass.length !== esperado.length || !timingSafeEqual(Buffer.from(ass), Buffer.from(esperado))) return null;
  try { const j = JSON.parse(Buffer.from(corpo, "base64url").toString()) as { d: string; t: number }; if (Date.now() - j.t > 15 * 60 * 1000) return null; return { destino: j.d.startsWith("/") ? j.d : "/app" }; } catch { return null; }
}

export function urlDeLogin(base: string, destino: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${base}/api/workend/google/volta`, response_type: "code",
    scope: "openid email profile", access_type: "online", prompt: "select_account", state: criarState(destino),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// Troca o código pelo perfil (id_token via endpoint userinfo), acha/cria o usuário e abre a sessão
export async function concluirLogin(base: string, code: string): Promise<Usuario> {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${base}/api/workend/google/volta`, grant_type: "authorization_code" }) });
  const tok = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!r.ok || !tok.access_token) throw new Error(`Google não aceitou o login (${tok.error_description ?? tok.error ?? r.status}).`);
  const ri = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } });
  const perfil = (await ri.json().catch(() => ({}))) as { email?: string; email_verified?: boolean; name?: string; sub?: string };
  if (!perfil.email || perfil.email_verified === false) throw new Error("O Google não confirmou seu e-mail.");
  await migrar();
  const email = perfil.email.toLowerCase();
  let [u] = await sql<Usuario[]>`SELECT ${CAMPOS()} FROM usuario WHERE email = ${email}`;
  if (!u) {
    // conta nova: sem senha local (hash impossível de bater); ela pode criar uma depois em "Esqueci a senha"
    const nome = (perfil.name ?? email.split("@")[0]).trim().slice(0, 80);
    [u] = await sql<Usuario[]>`INSERT INTO usuario (id, email, nome, empresa_nome, senha_hash) VALUES (${id("usr")}, ${email}, ${nome}, '', ${"google:" + (perfil.sub ?? randomBytes(8).toString("hex"))}) RETURNING ${CAMPOS()}`;
    void registrar("cadastro", `${nome} criou conta com o Google`, { usuarioId: u.id });
    void enviarEmail("cadastro", u.email, { nome: u.nome, email: u.email, empresa: "", link_mapa: "https://workend.online/mundo" });
  }
  if (u.banidoEm) throw new Error("Sua conta está suspensa por descumprir as políticas de uso.");
  await abrirSessao(u.id);
  return u;
}
