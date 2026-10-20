import { fecharSessao } from "@/server/usuarios";
import { ok } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST() { await fecharSessao(); return ok({ ok: true }); }
