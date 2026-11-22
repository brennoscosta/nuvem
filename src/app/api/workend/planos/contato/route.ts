// "Fale com a gente" da página de planos (WE-19, 22/11/2026): Sede sob consulta e o interesse no Equipe. Aberto a quem não
// tem conta; limite por IP (3 a cada 30 minutos) e um campo escondido que só robô preenche.
import { usuarioAtual } from "@/server/usuarios";
import { registrarContatoPlano } from "@/server/planos";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const chave = `plano-contato:${ipDe(req)}`, espera = Math.max(bloqueio(chave, 3), bloqueio("plano-contato:total", 60));
    if (espera) return demais(espera);
    const b = await corpo(req);
    if (typeof b.site === "string" && b.site.trim()) return ok({ ok: true }); // campo escondido: robô
    const u = await usuarioAtual().catch(() => null);
    const r = await registrarContatoPlano(b, u);
    contar(chave, 30); contar("plano-contato:total", 60);
    return ok(r);
  } catch (e) { return erro(e, 400); }
}
