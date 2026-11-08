// PUT: o dono (ou admin) salva o escritório do lote (layout, setores, equipe). GET: devolve o atual (cria o padrão se faltar).
import { usuarioAtual } from "@/server/usuarios";
import { salvarEscritorio, garantirEscritorio, obterTerreno } from "@/server/terrenos";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try { const { chave } = await params; const ch = decodeURIComponent(chave); const t = await obterTerreno(ch); if (!t || t.status !== "ativo") return erro("Lote sem escritório.", 404); return ok(t.escritorio ?? (await garantirEscritorio(ch))); }
  catch (e) { return erro(e); }
}
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { chave } = await params;
    return ok(await salvarEscritorio(u, decodeURIComponent(chave), await corpo(req)));
  } catch (e) { return erro(e); }
}
