// Amizade: GET lista amigos + pedidos; POST {paraId} pede amizade (ou aceita se ele já tinha pedido)
import { exigirPersonagem, statusDe } from "../_personagem";
import { listarAmigos, listarPedidos, pedirAmizade } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await exigirPersonagem(); const [amigos, pedidos] = await Promise.all([listarAmigos(u.id), listarPedidos(u.id)]); return ok({ amigos, pedidos }); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) { try { const u = await exigirPersonagem(); const { paraId } = await corpo<{ paraId: string }>(req); return ok(await pedirAmizade(u, paraId)); } catch (e) { return erro(e, statusDe(e)); } }
