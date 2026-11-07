import { listarPagamentosAdmin } from "@/server/mercadopago";
import { ok, erro } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok(await listarPagamentosAdmin()); } catch (e) { return erro(e, statusDe(e)); } }
