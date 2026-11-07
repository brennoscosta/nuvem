// Confere um pagamento na API do Mercado Pago (quando o usuário volta do checkout). Só o dono do pagamento ou o admin.
import { conferirPagamento } from "@/server/mercadopago";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { ok, erro } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { id } = await params;
    const p = await conferirPagamento(id);
    if (!p) return erro("Pagamento não encontrado.", 404);
    if (p.usuarioId !== u.id && !ehAdmin(u)) return erro("Esse pagamento não é seu.", 403);
    return ok(p);
  } catch (e) { return erro(e); }
}
