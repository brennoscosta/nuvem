// Caixa de entrada do personagem
import { usuarioAtual } from "@/server/usuarios";
import { caixaDeEntrada } from "@/server/personagens";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401); return ok(await caixaDeEntrada(u.id)); } catch (e) { return erro(e); } }
