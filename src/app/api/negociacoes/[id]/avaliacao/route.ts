// Avaliar o outro lado de um negócio concluído: POST { nota (1 a 5), texto? } (11/11/2026)
import { exigirPersonagem, statusDe } from "../../../_personagem";
import { avaliarNegociacao } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try { const u = await exigirPersonagem(); const { id } = await params; return ok(await avaliarNegociacao(u, id, await corpo(req))); }
  catch (e) { return erro(e, statusDe(e)); }
}
