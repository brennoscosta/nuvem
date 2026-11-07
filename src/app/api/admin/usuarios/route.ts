import { listarUsuarios } from "@/server/usuarios";
import { ok, erro } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() { try { await exigirAdmin(); return ok(await listarUsuarios()); } catch (e) { return erro(e, statusDe(e)); } }
