// API v1: GET /api/v1/equipe → as pessoas da equipe (id, nome, cargo, departamento, nível, chefe, quem comanda).
import { autenticar, equipeApi } from "@/server/apiV1";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return ok(await equipeApi(await autenticar(req))); } catch (e) { return erro(e, statusDe(e)); }
}
