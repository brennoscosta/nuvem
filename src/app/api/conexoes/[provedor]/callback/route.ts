// Volta da rede social: troca o código por tokens, guarda a conexão e volta pro painel do CEO.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REDES, ehProvedor } from "@/server/redes";
import { raizEscritorio, base } from "@/server/conexoes";
import { ehAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ provedor: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { provedor } = await params;
  const u = new URL(req.url);
  const volta = (msg: string, okFlag: boolean) => NextResponse.redirect(`${raizEscritorio(req)}/?conexao=${provedor}&${okFlag ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
  if (!ehProvedor(provedor)) return volta("provedor desconhecido", false);
  if (!(await ehAdmin())) return volta("Entre como admin antes de conectar.", false);
  const jar = await cookies();
  const esperado = jar.get("nuvem_oauth_state")?.value;
  const errParam = u.searchParams.get("error") ?? u.searchParams.get("error_reason");
  if (errParam) return volta(`${REDES[provedor].nome}: ${u.searchParams.get("error_description") ?? errParam}`, false);
  if (!esperado || esperado !== u.searchParams.get("state")) return volta("Estado inválido — tente conectar de novo.", false);
  const code = u.searchParams.get("code");
  if (!code) return volta("Sem código de autorização.", false);
  try {
    const conta = await REDES[provedor].conectar(req, code);
    const res = volta(conta.nome || "conta conectada", true);
    res.cookies.delete("nuvem_oauth_state");
    return res;
  } catch (e) { return volta((e as Error).message, false); }
}
