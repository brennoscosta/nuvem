// Preferências de e-mail pelo link assinado do rodapé (WE-17, 21/11/2026), sem login: { t, dicas?, resumo?, unidades? }.
// Só mexe nos e-mails de ciclo de vida; os da conta (boas-vindas, pagamento, vencimento, senha) continuam saindo.
import { usuarioDoToken, salvarPreferenciasEmail } from "@/server/email";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const d = await corpo<{ t?: string; dicas?: unknown; resumo?: unknown; unidades?: unknown }>(req);
    const uid = await usuarioDoToken(d.t);
    if (!uid) return Response.json({ erro: "Este link não vale mais. Abra de novo o link do rodapé do e-mail." }, { status: 400 });
    return ok({ preferencias: await salvarPreferenciasEmail(uid, { dicas: d.dicas, resumo: d.resumo, unidades: d.unidades }) });
  } catch (e) { return erro(e, 400); }
}
