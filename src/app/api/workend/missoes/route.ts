// Minhas missões de visitante e os selos conquistados.
import { usuarioAtual } from "@/server/usuarios";
import { minhasMissoes } from "@/server/cidade";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await usuarioAtual(); if (!u) return ok([]); return ok(await minhasMissoes(u)); } catch (e) { return erro(e); } }
