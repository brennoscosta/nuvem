import { usuarioAtual } from "@/server/usuarios";
import { paginaDoUsuario, planoDa } from "@/server/planoVitrine";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
// Plano Vitrine (WE-13): o plano da conta (vitrine, lote, quiosque ou nenhum) e a cor da página grátis (corLoja), para o
// formulário do lote no mapa começar com ela
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return ok(u);
    const [pg, plano] = await Promise.all([paginaDoUsuario(u.id).catch(() => null), planoDa(u.id).catch(() => null)]);
    return ok({ ...u, plano, ...(pg?.publicadaEm ? { corLoja: pg.cor } : {}) });
  } catch (e) { return erro(e); }
}
