// Equipe de IA do cliente (11/11/2026, src/server/equipeCliente.ts). GET ?lote= → painel (equipe, gasto do mês,
// sobre, contatos, visitantes). PUT { lote, sobre?, contatos? } → salva o "Sobre a empresa" e os contatos públicos.
import { usuarioAtual } from "@/server/usuarios";
import { painelEquipe, salvarPerfilEmpresa, statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await painelEquipe(u, new URL(req.url).searchParams.get("lote"))); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function PUT(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<{ lote?: string; sobre?: unknown; contatos?: unknown }>(req);
    return ok(await salvarPerfilEmpresa(u, d.lote ?? null, d));
  } catch (e) { return erro(e, statusDe(e)); }
}
