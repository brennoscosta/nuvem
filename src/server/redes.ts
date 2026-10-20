// Registro dos provedores de rede social: configuração, URL de autorização e troca do código. Usado pelas rotas /api/conexoes/[provedor].
import * as yt from "./youtube";
import * as ig from "./instagram";
import * as tt from "./tiktok";
import type { Provedor } from "./conexoes";

export const REDES: Record<Provedor, { nome: string; configurado: () => boolean; urlAutorizacao: (req: Request, state: string) => string; conectar: (req: Request, code: string) => Promise<{ nome: string; id: string }>; variaveis: string }> = {
  youtube: { nome: "YouTube", configurado: yt.youtubeConfigurado, urlAutorizacao: yt.urlAutorizacao, conectar: yt.conectarComCodigo, variaveis: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" },
  instagram: { nome: "Instagram", configurado: ig.instagramConfigurado, urlAutorizacao: ig.urlAutorizacao, conectar: ig.conectarComCodigo, variaveis: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET" },
  tiktok: { nome: "TikTok", configurado: tt.tiktokConfigurado, urlAutorizacao: tt.urlAutorizacao, conectar: tt.conectarComCodigo, variaveis: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET" },
};
export function ehProvedor(p: string): p is Provedor { return p in REDES; }
