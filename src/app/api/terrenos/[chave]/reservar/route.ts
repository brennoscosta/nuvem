// Reservar (POST) ou desistir (DELETE) de um lote. Precisa da sessão do WorkEnd (cookie workend_sessao).
import { reservarTerreno, liberarTerreno, obterTerreno, MINUTOS_RESERVA, precoPara } from "@/server/terrenos";
import { enviarEmail, brl } from "@/server/email";
import { LOTE_POR_CHAVE, descricaoLote } from "@/office/data/mundo";
import { usuarioAtual } from "@/server/usuarios";
import { ok, erro, corpo } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd pra reservar um chão.", 401);
    const { chave } = await params;
    const d = await corpo<{ empresaNome: string; cor?: string; logoBase64?: string | null; logoTipo?: string | null; manterLogo?: boolean }>(req);
    const ch = decodeURIComponent(chave);
    const jaTinha = await obterTerreno(ch).then((t) => !!t && t.usuarioId === u.id).catch(() => false);
    const t = await reservarTerreno(u, ch, d);
    // e-mail só na reserva nova (editar a placa não manda de novo)
    if (!jaTinha && t.status === "reservado") {
      const info = LOTE_POR_CHAVE[ch];
      void enviarEmail("reserva", u.email, { nome: u.nome, empresa: t.empresaNome, lote: `Lote ${info?.numero ?? "?"}`, descricao: info ? descricaoLote(info) : "", valor: brl(precoPara(u)), prazo: MINUTOS_RESERVA >= 60 ? `${MINUTOS_RESERVA / 60} hora${MINUTOS_RESERVA >= 120 ? "s" : ""}` : `${MINUTOS_RESERVA} minutos`, link_pagar: `https://workend.online/mundo?lote=${encodeURIComponent(ch)}` });
    }
    return ok(t);
  } catch (e) { return erro(e, e instanceof Error && /não está à venda|outra empresa|nome|Logo|suspensa|já tem um chão/.test(e.message) ? 400 : 500); }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const { chave } = await params;
    return ok({ liberado: await liberarTerreno(u.id, decodeURIComponent(chave)) });
  } catch (e) { return erro(e); }
}
