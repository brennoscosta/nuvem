// Ficha pública de um personagem (redes só se ele mostra pra todos ou se somos amigos) + a relação comigo
import { usuarioAtual } from "@/server/usuarios";
import { personagemPublico } from "@/server/personagens";
import { relacao } from "@/server/rede";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await usuarioAtual(); const { id } = await params; const p = await personagemPublico(id, u?.id ?? null);
    if (!p) return erro("Personagem não encontrado.", 404);
    const rel = u && u.id !== id ? await relacao(u.id, id) : { status: "nenhuma", id: null };
    return ok({ ...p, relacao: rel });
  } catch (e) { return erro(e); }
}
