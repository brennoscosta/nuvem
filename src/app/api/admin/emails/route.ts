// Modelos de e-mail (admin): listar (com padrão/editado), salvar, restaurar; últimos envios; status do SendGrid.
import { listarModelos, salvarModelo, restaurarModelo, ultimosEnvios, emailLigado, REMETENTE, EXEMPLO, type ChaveEmail } from "@/server/email";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await exigirAdmin(); return ok({ modelos: await listarModelos(), envios: await ultimosEnvios(50), ligado: emailLigado(), remetente: REMETENTE(), exemplo: EXEMPLO }); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request) {
  try {
    await exigirAdmin();
    const { acao, chave, assunto, html } = await corpo<{ acao: string; chave: ChaveEmail; assunto?: string; html?: string }>(req);
    if (acao === "salvar") await salvarModelo(chave, assunto ?? "", html ?? "");
    else if (acao === "restaurar") await restaurarModelo(chave);
    else return erro("Ação desconhecida.", 400);
    return ok({ feito: acao });
  } catch (e) { return erro(e, statusDe(e)); }
}
