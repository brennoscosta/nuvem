import { adminDesbanir, ADMIN_EMAIL } from "@/server/terrenos";
import { sql } from "@/server/db";
import { criarLinkSenha } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../../_guarda";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await exigirAdmin();
    const { id } = await params;
    const { acao, motivo } = await corpo<{ acao: string; motivo?: string }>(req);
    const [alvo] = await sql<{ email: string }[]>`SELECT email FROM usuario WHERE id = ${id}`;
    if (alvo?.email === ADMIN_EMAIL && (acao === "banir" || acao === "dono")) return erro("A conta do dono do WorkEnd não pode ser suspensa nem perder o admin.", 400);
    if (acao === "link_senha") { if (!alvo) return erro("Conta não encontrada.", 404); return ok({ link: await criarLinkSenha(id, 24) }); }
    if (acao === "desbanir") await adminDesbanir(id);
    else if (acao === "banir") { if (id === admin.id) return erro("Você não pode banir a si mesmo.", 400); await sql`UPDATE usuario SET banido_em = now(), banido_motivo = ${(motivo ?? "").trim().slice(0, 300) || "descumprimento das políticas de uso"} WHERE id = ${id}`; await sql`DELETE FROM terreno WHERE usuario_id = ${id}`; }
    else if (acao === "admin") await sql`UPDATE usuario SET papel = 'admin' WHERE id = ${id}`;
    else if (acao === "dono") { if (id === admin.id) return erro("Você não pode tirar o seu próprio admin.", 400); await sql`UPDATE usuario SET papel = 'dono' WHERE id = ${id}`; }
    else return erro("Ação desconhecida.", 400);
    return ok({ feito: acao });
  } catch (e) { return erro(e, statusDe(e)); }
}
