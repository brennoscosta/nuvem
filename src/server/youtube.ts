// YouTube: conexão OAuth da conta do dono + upload de vídeo (resumable). Sem SDK, só fetch.
// Variáveis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (CapRover). Redirect: <site>/api/conexoes/youtube/callback
import fs from "node:fs";
import { sql, id, migrar } from "./db";
import { EMPRESA_PADRAO } from "./agentes";

const ESCOPOS = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

export interface Conexao { id: string; provedor: string; contaNome: string; contaId: string; accessToken: string; refreshToken: string; expiraEm: Date | null; escopo: string; criadoEm: Date }

export function youtubeConfigurado() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }

export function base(req: Request) {
  // atrás do proxy do CapRover o host vem no header
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
export function urlCallback(req: Request) { return `${base(req)}/api/conexoes/youtube/callback`; }

export function urlAutorizacao(req: Request, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: urlCallback(req), response_type: "code",
    scope: ESCOPOS.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function trocarCodigo(req: Request, code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: urlCallback(req), grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google recusou o código: ${j.error_description ?? j.error ?? r.status}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

async function renovar(c: Conexao) {
  if (!c.refreshToken) throw new Error("Conexão sem refresh token — desconecte e conecte o YouTube de novo.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: c.refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Não consegui renovar o acesso ao YouTube (${j.error_description ?? j.error ?? r.status}). Reconecte a conta.`);
  const expiraEm = new Date(Date.now() + (j.expires_in - 60) * 1000);
  await sql`UPDATE conexao SET access_token = ${j.access_token}, expira_em = ${expiraEm}, atualizado_em = now() WHERE id = ${c.id}`;
  return { ...c, accessToken: j.access_token as string, expiraEm };
}

async function canal(accessToken: string) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${accessToken}` } });
  const j = await r.json();
  const c = j.items?.[0];
  return { id: c?.id ?? "", nome: c?.snippet?.title ?? "" };
}

export async function conectarComCodigo(req: Request, code: string) {
  await migrar();
  const t = await trocarCodigo(req, code);
  const ch = await canal(t.access_token);
  const expiraEm = new Date(Date.now() + (t.expires_in - 60) * 1000);
  await sql`INSERT INTO conexao (id, empresa_id, provedor, conta_nome, conta_id, access_token, refresh_token, expira_em, escopo)
    VALUES (${id("cx")}, ${EMPRESA_PADRAO.id}, 'youtube', ${ch.nome}, ${ch.id}, ${t.access_token}, ${t.refresh_token ?? ""}, ${expiraEm}, ${t.scope})
    ON CONFLICT (empresa_id, provedor) DO UPDATE SET conta_nome = EXCLUDED.conta_nome, conta_id = EXCLUDED.conta_id, access_token = EXCLUDED.access_token,
      refresh_token = CASE WHEN EXCLUDED.refresh_token = '' THEN conexao.refresh_token ELSE EXCLUDED.refresh_token END, expira_em = EXCLUDED.expira_em, escopo = EXCLUDED.escopo, atualizado_em = now()`;
  return ch;
}

export async function obterConexao(provedor = "youtube"): Promise<Conexao | null> {
  await migrar();
  const [c] = await sql<Conexao[]>`SELECT id, provedor, conta_nome, conta_id, access_token, refresh_token, expira_em, escopo, criado_em FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id} AND provedor = ${provedor}`;
  return c ?? null;
}
export async function listarConexoes() {
  await migrar();
  const rows = await sql<{ provedor: string; contaNome: string; contaId: string; criadoEm: Date }[]>`SELECT provedor, conta_nome, conta_id, criado_em FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id}`;
  return rows;
}
export async function desconectar(provedor: string) {
  await sql`DELETE FROM conexao WHERE empresa_id = ${EMPRESA_PADRAO.id} AND provedor = ${provedor}`;
}

async function tokenValido(): Promise<Conexao> {
  const c = await obterConexao("youtube");
  if (!c) throw new Error("YouTube não conectado. Conecte a conta na aba Tarefas do CEO.");
  if (!c.expiraEm || c.expiraEm.getTime() < Date.now() + 30_000) return renovar(c);
  return c;
}

export interface VideoParaPublicar { caminho: string; mime: string; tamanho: number; titulo: string; descricao: string; tags?: string[]; privacidade?: "public" | "unlisted" | "private"; categoriaId?: string }

// Upload resumable: 1) cria a sessão com os metadados 2) manda os bytes 3) recebe o id do vídeo.
export async function publicarNoYouTube(v: VideoParaPublicar) {
  const c = await tokenValido();
  const meta = {
    snippet: { title: v.titulo.slice(0, 100), description: v.descricao.slice(0, 5000), tags: (v.tags ?? []).slice(0, 30), categoryId: v.categoriaId ?? "22" },
    status: { privacyStatus: v.privacidade ?? "public", selfDeclaredMadeForKids: false },
  };
  const ini = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { authorization: `Bearer ${c.accessToken}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": v.mime, "x-upload-content-length": String(v.tamanho) },
    body: JSON.stringify(meta),
  });
  if (!ini.ok) { const t = await ini.text(); throw new Error(`YouTube recusou o início do upload (${ini.status}): ${resumoErro(t)}`); }
  const sessao = ini.headers.get("location");
  if (!sessao) throw new Error("YouTube não devolveu a URL da sessão de upload.");
  const bytes = fs.readFileSync(v.caminho);
  const up = await fetch(sessao, { method: "PUT", headers: { authorization: `Bearer ${c.accessToken}`, "content-type": v.mime, "content-length": String(bytes.length) }, body: bytes });
  const j = await up.json().catch(() => ({}));
  if (!up.ok) throw new Error(`Upload falhou (${up.status}): ${resumoErro(JSON.stringify(j))}`);
  const videoId = j.id as string;
  return { videoId, url: `https://youtu.be/${videoId}`, canal: c.contaNome, privacidade: meta.status.privacyStatus };
}

function resumoErro(t: string) {
  try { const j = JSON.parse(t); return j.error?.message ?? j.error?.errors?.[0]?.reason ?? t.slice(0, 200); } catch { return t.slice(0, 200); }
}
