// As vagas da minha empresa com as candidaturas recebidas.
import { usuarioAtual } from "@/server/usuarios";
import { vagasDoDono } from "@/server/cidade";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401); return ok(await vagasDoDono(u)); } catch (e) { return erro(e); } }
