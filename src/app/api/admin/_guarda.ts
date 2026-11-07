// Só o admin do WorkEnd (papel admin no banco ou e-mail em ADMIN_EMAILS) passa daqui.
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
export async function exigirAdmin() {
  const u = await usuarioAtual();
  if (!u || !ehAdmin(u)) throw Object.assign(new Error("Só o admin do WorkEnd."), { status: 403 });
  return u;
}
export const statusDe = (e: unknown) => (e as { status?: number })?.status ?? 500;
