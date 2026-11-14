// Cupons de uma loja (público, 13/11/2026), com o código de quem está logado e já pegou.
import { cuponsDaLoja } from "@/server/cupons";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { numero } = await params; const u = await usuarioAtual().catch(() => null);
    return ok({ ...(await cuponsDaLoja(Number(numero) | 0, u)), logado: !!u });
  } catch (e) { return erro(e); }
}
