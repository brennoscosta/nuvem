// Perfil de cadastro da própria conta (20/11/2026, frente "cadastro"). GET: o perfil, a sugestão para preencher e o resumo
// (etapas que faltam). POST { etapa, dados }: salva uma etapa ("tudo" no editor do painel); POST { pular: true }: deixa
// para depois (o painel lembra). Regras em src/server/perfis.ts.
import { usuarioAtual } from "@/server/usuarios";
import { meuPerfil, sugestaoInicial, salvarPerfil, pularPerfil, resumoPerfil, ErroPerfil } from "@/server/perfis";
import { ehEtapa } from "@/office/data/cadastro";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const [perfil, sugestao, resumo] = await Promise.all([meuPerfil(u.id), sugestaoInicial(u), resumoPerfil(u.id)]);
    return ok({ perfil, sugestao, resumo });
  } catch (e) { return erro(e); }
}

export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const d = await corpo<{ etapa?: unknown; dados?: Record<string, unknown>; pular?: boolean }>(req);
    if (d.pular === true) { await pularPerfil(u); return ok({ resumo: await resumoPerfil(u.id) }); }
    const etapa = d.etapa === "tudo" ? "tudo" : ehEtapa(d.etapa) ? d.etapa : null;
    if (!etapa) return erro("Etapa desconhecida.", 400);
    const perfil = await salvarPerfil(u, etapa, d.dados && typeof d.dados === "object" ? d.dados : {});
    return ok({ perfil, resumo: await resumoPerfil(u.id) });
  } catch (e) { return erro(e, e instanceof ErroPerfil ? e.status : 500); }
}
