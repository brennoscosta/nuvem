// Lotes reservados no mundo (público): a cena desenha a placa e o tapume de cada um. Também diz qual é o lote do usuário logado.
import { listarTerrenos, terrenoDoUsuario } from "@/server/terrenos";
import { usuarioAtual } from "@/server/usuarios";
import { temBanco } from "@/server/db";
import { ok, erro } from "@/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!temBanco()) return ok({ terrenos: [], meu: null });
    const u = await usuarioAtual().catch(() => null);
    const [terrenos, meu] = await Promise.all([listarTerrenos(), u ? terrenoDoUsuario(u.id) : null]);
    return ok({ terrenos, meu: meu?.chave ?? null });
  } catch (e) { return erro(e); }
}
