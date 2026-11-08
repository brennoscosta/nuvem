// Um pedido de amizade: PUT {aceitar: true|false}; DELETE desfaz a amizade com o usuário [id]
import { exigirPersonagem, statusDe } from "../../_personagem";
import { responderAmizade, desfazerAmizade } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PUT(req: Request, { params }: Ctx) { try { const u = await exigirPersonagem(); const { id } = await params; const { aceitar } = await corpo<{ aceitar: boolean }>(req); return ok(await responderAmizade(u, id, !!aceitar)); } catch (e) { return erro(e, statusDe(e)); } }
export async function DELETE(_: Request, { params }: Ctx) { try { const u = await exigirPersonagem(); const { id } = await params; await desfazerAmizade(u, id); return ok({ feito: true }); } catch (e) { return erro(e, statusDe(e)); } }
