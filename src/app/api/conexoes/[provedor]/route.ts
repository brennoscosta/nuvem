// GET: manda o admin pra tela de autorização da rede. DELETE: desconecta.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { REDES, ehProvedor } from "@/server/redes";
import { desconectar } from "@/server/conexoes";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ provedor: string }> };

export async function GET(req: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  const { provedor } = await params;
  if (!ehProvedor(provedor)) return erro("provedor desconhecido", 404);
  const r = REDES[provedor];
  if (!r.configurado()) return erro(`${r.variaveis} não configurados no CapRover.`, 400);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(r.urlAutorizacao(req, state));
  res.cookies.set("nuvem_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  const { provedor } = await params;
  if (!ehProvedor(provedor)) return erro("provedor desconhecido", 404);
  try { await desconectar(provedor); return ok({ ok: true }); } catch (e) { return erro(e); }
}
