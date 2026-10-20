// TikTok: Login Kit + Content Posting API (direct post por upload em partes).
// Variáveis: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET. Redirect: <site>/api/conexoes/tiktok/callback
// Enquanto o app não passa na auditoria do TikTok, os posts saem como "somente eu" (SELF_ONLY): o dono muda pra público no app.
import fs from "node:fs";
import { urlCallback as cb, salvarConexao, atualizarTokens, obterConexao, resumoErro, dormir, type Conexao, env } from "./conexoes";

const ESCOPOS = ["user.info.basic", "video.publish"];
const API = "https://open.tiktokapis.com/v2";

export function tiktokConfigurado() { return !!(env("TIKTOK_CLIENT_KEY") && env("TIKTOK_CLIENT_SECRET")); }

export function urlAutorizacao(req: Request, state: string) {
  const p = new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), scope: ESCOPOS.join(","), response_type: "code", redirect_uri: cb(req, "tiktok"), state });
  return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
}

async function token(body: Record<string, string>) {
  const r = await fetch(`${API}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY"), client_secret: env("TIKTOK_CLIENT_SECRET"), ...body }) });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`TikTok recusou: ${j.error_description ?? j.error ?? resumoErro(JSON.stringify(j))}`);
  return j as { access_token: string; refresh_token: string; expires_in: number; open_id: string; scope: string };
}

export async function conectarComCodigo(req: Request, code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: cb(req, "tiktok") });
  const me = await fetch(`${API}/user/info/?fields=open_id,display_name,username`, { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
  const u = me.data?.user ?? {};
  const nome = u.username ? `@${u.username}` : (u.display_name ?? "");
  await salvarConexao({ provedor: "tiktok", contaNome: nome, contaId: t.open_id, accessToken: t.access_token, refreshToken: t.refresh_token, expiraEm: new Date(Date.now() + (t.expires_in - 60) * 1000), escopo: t.scope });
  return { nome, id: t.open_id };
}

async function tokenValido(): Promise<Conexao> {
  const c = await obterConexao("tiktok");
  if (!c) throw new Error("TikTok não conectado. Conecte a conta na aba Tarefas do CEO.");
  if (c.expiraEm && c.expiraEm.getTime() > Date.now() + 60_000) return c;
  const t = await token({ grant_type: "refresh_token", refresh_token: c.refreshToken });
  const expiraEm = new Date(Date.now() + (t.expires_in - 60) * 1000);
  await atualizarTokens(c.id, { accessToken: t.access_token, refreshToken: t.refresh_token, expiraEm });
  return { ...c, accessToken: t.access_token, refreshToken: t.refresh_token, expiraEm };
}

async function post(path: string, tk: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { authorization: `Bearer ${tk}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.error && j.error.code && j.error.code !== "ok")) throw new Error(`TikTok (${path.split("/").filter(Boolean).slice(-2).join("/")}): ${j.error?.message ?? j.error?.code ?? r.status}`);
  return j;
}

export async function publicarNoTikTok(v: { caminho: string; tamanho: number; titulo: string; publico: boolean }) {
  const c = await tokenValido();
  // 1) o que a conta pode fazer (níveis de privacidade liberados; apps sem auditoria só têm SELF_ONLY)
  const info = await post("/post/publish/creator_info/query/", c.accessToken, {});
  const niveis: string[] = info.data?.privacy_level_options ?? ["SELF_ONLY"];
  const privacidade = v.publico && niveis.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : niveis.includes("SELF_ONLY") ? "SELF_ONLY" : niveis[0];
  // 2) inicia o upload em partes (cada parte entre 5 MB e 64 MB; a última pode ser maior)
  const MB = 1024 * 1024;
  const chunk = v.tamanho <= 64 * MB ? v.tamanho : 20 * MB;
  const partes = Math.max(1, Math.floor(v.tamanho / chunk));
  const ini = await post("/post/publish/video/init/", c.accessToken, {
    post_info: { title: v.titulo.slice(0, 2200), privacy_level: privacidade, disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
    source_info: { source: "FILE_UPLOAD", video_size: v.tamanho, chunk_size: chunk, total_chunk_count: partes },
  });
  const publishId = ini.data?.publish_id as string, uploadUrl = ini.data?.upload_url as string;
  if (!publishId || !uploadUrl) throw new Error("TikTok não devolveu a URL de upload.");
  // 3) manda as partes
  const fd = fs.openSync(v.caminho, "r");
  try {
    for (let i = 0; i < partes; i++) {
      const inicio = i * chunk;
      const fim = i === partes - 1 ? v.tamanho - 1 : inicio + chunk - 1;
      const buf = Buffer.alloc(fim - inicio + 1);
      fs.readSync(fd, buf, 0, buf.length, inicio);
      const r = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(buf.length), "content-range": `bytes ${inicio}-${fim}/${v.tamanho}` }, body: buf });
      if (!r.ok && r.status !== 206) throw new Error(`Upload pro TikTok falhou na parte ${i + 1}/${partes} (${r.status}): ${resumoErro(await r.text())}`);
    }
  } finally { fs.closeSync(fd); }
  // 4) espera o TikTok processar e publicar
  let status = "PROCESSING_UPLOAD", ids: string[] = [], motivo = "";
  for (let i = 0; i < 48 && !["PUBLISH_COMPLETE", "FAILED"].includes(status); i++) {
    await dormir(5000);
    const s = await post("/post/publish/status/fetch/", c.accessToken, { publish_id: publishId });
    status = s.data?.status ?? status; ids = s.data?.publicaly_available_post_id ?? s.data?.publicly_available_post_id ?? ids; motivo = s.data?.fail_reason ?? "";
  }
  if (status === "FAILED") throw new Error(`TikTok rejeitou o vídeo: ${motivo || "sem detalhe"}`);
  if (status !== "PUBLISH_COMPLETE") throw new Error("TikTok ainda está processando o vídeo; confira no app em alguns minutos.");
  const usuario = c.contaNome.replace("@", "");
  const url = ids[0] && usuario ? `https://www.tiktok.com/@${usuario}/video/${ids[0]}` : usuario ? `https://www.tiktok.com/@${usuario}` : "https://www.tiktok.com/";
  return { publishId, postId: ids[0] ?? null, url, conta: c.contaNome, privacidade, aviso: privacidade === "SELF_ONLY" ? "Publicado como 'somente eu' (app ainda não auditado pelo TikTok). Mude pra público no app do TikTok." : undefined };
}
