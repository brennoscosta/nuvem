// Manda um e-mail de teste do modelo (com as variáveis de exemplo) pro próprio admin, ou devolve a prévia em HTML.
import { enviarEmail, obterModelo, preencher, moldura, linkPreferencias, EXEMPLO, CICLO_DE_VIDA, type ChaveEmail } from "@/server/email";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../../_guarda";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const admin = await exigirAdmin();
    const { chave, assunto, html, enviar } = await corpo<{ chave: ChaveEmail; assunto?: string; html?: string; enviar?: boolean }>(req);
    if (enviar) return ok(await enviarEmail(chave, admin.email, EXEMPLO, { usuarioId: admin.id })); // ciclo de vida: com o link de preferências do próprio admin
    const m = await obterModelo(chave);
    return ok({ assunto: preencher(assunto ?? m.assunto, EXEMPLO, false), html: moldura(preencher(html ?? m.html, EXEMPLO), { preferencias: CICLO_DE_VIDA[chave] ? linkPreferencias("exemplo") : null }) });
  } catch (e) { return erro(e, statusDe(e)); }
}
