// Negociações: GET minhas; POST {paraId, titulo, texto, valor} propõe
import { exigirPersonagem, statusDe } from "../_personagem";
import { listarNegociacoes, criarNegociacao } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await exigirPersonagem(); return ok(await listarNegociacoes(u.id)); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request) { try { const u = await exigirPersonagem(); const d = await corpo<{ paraId: string; titulo: string; texto: string; valor: string | number | null }>(req); return ok(await criarNegociacao(u, d.paraId, d)); } catch (e) { return erro(e, statusDe(e)); } }
