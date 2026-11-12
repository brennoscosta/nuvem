// Vagas abertas (12/11/2026): GET ?q=&nicho= → todas (público); POST { id?, cargo, descricao, modelo, local, salario, aberta } → cria ou edita a vaga da minha empresa.
import { usuarioAtual } from "@/server/usuarios";
import { vagasAbertas, salvarVaga } from "@/server/cidade";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { const p = new URL(req.url).searchParams; return ok(await vagasAbertas({ q: p.get("q"), nicho: p.get("nicho") })); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await salvarVaga(u, await corpo(req))); } catch (e) { return erro(e, 400); }
}
