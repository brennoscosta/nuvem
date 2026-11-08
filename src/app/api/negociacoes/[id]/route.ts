// Responder uma negociação: PUT {status: aceita|recusada|cancelada|concluida}
import { exigirPersonagem, statusDe } from "../../_personagem";
import { responderNegociacao } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PUT(req: Request, { params }: Ctx) { try { const u = await exigirPersonagem(); const { id } = await params; const { status } = await corpo<{ status: "aceita" | "recusada" | "cancelada" | "concluida" }>(req); return ok(await responderNegociacao(u, id, status)); } catch (e) { return erro(e, statusDe(e)); } }
