// GET: manda o admin pro consentimento do Google. DELETE: desconecta o canal.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { urlAutorizacao, desconectar, youtubeConfigurado } from "@/server/youtube";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  if (!youtubeConfigurado()) return erro("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados no CapRover.", 400);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(urlAutorizacao(req, state));
  res.cookies.set("nuvem_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
export async function DELETE() {
  if (!(await ehAdmin())) return naoAutorizado();
  try { await desconectar("youtube"); return ok({ ok: true }); } catch (e) { return erro(e); }
}
