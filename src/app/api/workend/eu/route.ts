import { usuarioAtual } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { return ok(await usuarioAtual()); } catch (e) { return erro(e); } }
