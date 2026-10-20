import { ehAdmin, entrar, sair, temSenhaConfigurada } from "@/server/auth";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ admin: await ehAdmin(), senhaConfigurada: temSenhaConfigurada() });
}
export async function POST(req: Request) {
  const { senha } = await corpo<{ senha: string }>(req);
  if (!temSenhaConfigurada()) return erro("ADMIN_SENHA não configurada no CapRover.", 503);
  if (!(await entrar(senha ?? ""))) return erro("Senha incorreta.", 401);
  return ok({ admin: true });
}
export async function DELETE() { await sair(); return ok({ admin: false }); }
