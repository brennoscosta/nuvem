// Reservar (POST) ou desistir (DELETE) de um lote. Precisa da sessão do WorkEnd (cookie workend_sessao).
import { reservarTerreno, liberarTerreno } from "@/server/terrenos";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd pra reservar um chão.", 401);
    const { chave } = await params;
    const d = await corpo<{ empresaNome: string; cor?: string; logoBase64?: string | null; logoTipo?: string | null; manterLogo?: boolean }>(req);
    return ok(await reservarTerreno(u, decodeURIComponent(chave), d));
  } catch (e) { return erro(e, e instanceof Error && /não está à venda|outra empresa|nome|Logo|suspensa|já tem um chão/.test(e.message) ? 400 : 500); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { chave } = await params;
    return ok({ liberado: await liberarTerreno(u.id, decodeURIComponent(chave)) });
  } catch (e) { return erro(e); }
}
