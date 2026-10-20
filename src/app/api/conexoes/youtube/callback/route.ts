// Volta do Google: troca o código por tokens, guarda a conexão e volta pro painel.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { conectarComCodigo, base } from "@/server/youtube";
import { ehAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const volta = (msg: string, okFlag: boolean) => NextResponse.redirect(`${base(req)}/?conexao=youtube&${okFlag ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
  if (!(await ehAdmin())) return volta("Entre como admin antes de conectar o YouTube.", false);
  const jar = await cookies();
  const esperado = jar.get("nuvem_oauth_state")?.value;
  if (u.searchParams.get("error")) return volta(`Google: ${u.searchParams.get("error")}`, false);
  if (!esperado || esperado !== u.searchParams.get("state")) return volta("Estado inválido — tente conectar de novo.", false);
  const code = u.searchParams.get("code");
  if (!code) return volta("Sem código do Google.", false);
  try {
    const ch = await conectarComCodigo(req, code);
    const res = volta(ch.nome || "canal conectado", true);
    res.cookies.delete("nuvem_oauth_state");
    return res;
  } catch (e) { return volta((e as Error).message, false); }
}
