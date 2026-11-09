import { ehAdmin, entrar, sair, temSenhaConfigurada } from "@/server/auth";
import { ok, erro, corpo } from "@/server/http";
import { bloqueioAdmin, contarAdmin, demais } from "@/server/limite";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ admin: await ehAdmin(), senhaConfigurada: temSenhaConfigurada() });
}
export async function POST(req: Request) {
  const { senha } = await corpo<{ senha: string }>(req);
  if (!temSenhaConfigurada()) return erro("ADMIN_SENHA não configurada no CapRover.", 503);
  const espera = bloqueioAdmin(req);
  if (espera) return demais(espera);
  if (!(await entrar(senha ?? ""))) { contarAdmin(req); return erro("Senha incorreta.", 401); }
  return ok({ admin: true });
}
export async function DELETE() { await sair(); return ok({ admin: false }); }
