// Vitrine do dono (12/11/2026, src/server/vitrine.ts). GET → produtos (inclusive os escondidos), lote e WhatsApp.
// POST { id?, nome, preco, descricao, ativo, foto? (base64), removerFoto? } → cria ou edita. PUT { ordem: [ids] } → reordena.
import { usuarioAtual } from "@/server/usuarios";
import { vitrineDoDono, salvarProduto, ordenarProdutos } from "@/server/vitrine";
import { statusDe } from "@/server/equipeCliente";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await vitrineDoDono(u)); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await salvarProduto(u, await corpo(req))); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function PUT(req: Request) {
  try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); const d = await corpo<{ ordem?: unknown }>(req); return ok(await ordenarProdutos(u, d.ordem)); }
  catch (e) { return erro(e, statusDe(e)); }
}
