// Instagram: "API com Login do Instagram" (conta profissional, sem precisar de Página do Facebook).
// Variáveis: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. Redirect: <site>/api/conexoes/instagram/callback
// Publicação de Reels: o vídeo precisa estar numa URL pública (servimos em /api/arquivos/<id>/raw).
import { urlCallback as cb, salvarConexao, atualizarTokens, obterConexao, resumoErro, dormir, type Conexao } from "./conexoes";

const ESCOPOS = ["instagram_business_basic", "instagram_business_content_publish"];
const G = "https://graph.instagram.com/v22.0";

export function instagramConfigurado() { return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET); }

export function urlAutorizacao(req: Request, state: string) {
  const p = new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, redirect_uri: cb(req, "instagram"), response_type: "code", scope: ESCOPOS.join(","), state });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

export async function conectarComCodigo(req: Request, code: string) {
  // 1) token curto (1 h)
  const r1 = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!, grant_type: "authorization_code", redirect_uri: cb(req, "instagram"), code }),
  });
  const j1 = await r1.json();
  if (!r1.ok || !j1.access_token) throw new Error(`Instagram recusou o código: ${resumoErro(JSON.stringify(j1))}`);
  // 2) token longo (60 dias, renovável)
  const r2 = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${j1.access_token}`);
  const j2 = await r2.json();
  if (!r2.ok || !j2.access_token) throw new Error(`Não consegui o token de longa duração: ${resumoErro(JSON.stringify(j2))}`);
  const expiraEm = new Date(Date.now() + (j2.expires_in ?? 5184000) * 1000);
  // 3) quem é a conta
  const r3 = await fetch(`${G}/me?fields=id,user_id,username&access_token=${j2.access_token}`);
  const me = await r3.json();
  const nome = me.username ? `@${me.username}` : "", cid = String(me.user_id ?? me.id ?? j1.user_id ?? "");
  await salvarConexao({ provedor: "instagram", contaNome: nome, contaId: cid, accessToken: j2.access_token, expiraEm, escopo: ESCOPOS.join(",") });
  return { nome, id: cid };
}

async function tokenValido(): Promise<Conexao> {
  const c = await obterConexao("instagram");
  if (!c) throw new Error("Instagram não conectado. Conecte a conta na aba Tarefas do CEO.");
  // token longo vale 60 dias; renova quando faltar menos de 15 (o Instagram só renova tokens com mais de 24 h de vida)
  if (c.expiraEm && c.expiraEm.getTime() - Date.now() < 15 * 86400_000) {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.accessToken}`);
    const j = await r.json();
    if (r.ok && j.access_token) { const expiraEm = new Date(Date.now() + (j.expires_in ?? 5184000) * 1000); await atualizarTokens(c.id, { accessToken: j.access_token, expiraEm }); return { ...c, accessToken: j.access_token, expiraEm }; }
    if (c.expiraEm.getTime() < Date.now()) throw new Error("O acesso ao Instagram expirou. Reconecte a conta na aba Tarefas.");
  }
  return c;
}

// Reels: cria o container (o Instagram baixa o vídeo da URL), espera processar, publica, pega o link.
export async function publicarNoInstagram(v: { videoUrl: string; legenda: string; capaMs?: number }) {
  const c = await tokenValido();
  const ini = await fetch(`${G}/me/media`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: v.videoUrl, caption: v.legenda.slice(0, 2200), share_to_feed: true, thumb_offset: v.capaMs ?? 0, access_token: c.accessToken }),
  });
  const j = await ini.json();
  if (!ini.ok || !j.id) throw new Error(`Instagram recusou o vídeo: ${resumoErro(JSON.stringify(j))}`);
  const containerId = j.id as string;
  // processamento: até ~5 min
  let status = "IN_PROGRESS";
  for (let i = 0; i < 60 && status === "IN_PROGRESS"; i++) {
    await dormir(5000);
    const r = await fetch(`${G}/${containerId}?fields=status_code,status&access_token=${c.accessToken}`);
    const s = await r.json();
    status = s.status_code ?? "IN_PROGRESS";
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Instagram não conseguiu processar o vídeo: ${s.status ?? status}. Confira formato (mp4 H.264/AAC), proporção (9:16 ideal) e duração (3 s a 15 min).`);
  }
  if (status !== "FINISHED") throw new Error("Instagram demorou demais pra processar o vídeo. Tente de novo em alguns minutos.");
  const pub = await fetch(`${G}/me/media_publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creation_id: containerId, access_token: c.accessToken }) });
  const p = await pub.json();
  if (!pub.ok || !p.id) throw new Error(`Falha ao publicar no Instagram: ${resumoErro(JSON.stringify(p))}`);
  const info = await fetch(`${G}/${p.id}?fields=permalink,shortcode&access_token=${c.accessToken}`).then((r) => r.json()).catch(() => ({}));
  const url = info.permalink ?? (info.shortcode ? `https://www.instagram.com/reel/${info.shortcode}/` : `https://www.instagram.com/${c.contaNome.replace("@", "")}/`);
  return { mediaId: p.id as string, url, conta: c.contaNome };
}
