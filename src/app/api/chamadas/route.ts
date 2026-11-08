// Chamadas: GET a minha chamada aberta; POST {paraId, video} liga
import { exigirPersonagem, statusDe } from "../_personagem";
import { minhaChamada, iniciarChamada } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await exigirPersonagem(); return ok(await minhaChamada(u.id)); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) { try { const u = await exigirPersonagem(); const d = await corpo<{ paraId: string; video?: boolean }>(req); return ok(await iniciarChamada(u, d.paraId, d.video !== false)); } catch (e) { return erro(e, statusDe(e)); } }
