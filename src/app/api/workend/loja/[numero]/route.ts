// A loja vista por quem chega (pública): nome, nicho, sobre, contatos, atendente e equipe.
import { lojaPublica, statusDe } from "@/server/equipeCliente";
import { registrarVisita } from "@/server/cidade";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { numero } = await params; const l = await lojaPublica(Number(numero) | 0);
    // missão Explorador: quem está logado e abre a loja de outra empresa conta uma visita
    const u = await usuarioAtual().catch(() => null); if (u && u.id !== l.donoId) void registrarVisita(u.id, l.chave);
    return ok(l);
  }
  catch (e) { return erro(e, statusDe(e)); }
}
