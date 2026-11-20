// Admin dos créditos e das unidades de IA: GET → carteiras, totais, pacotes vendidos e consumo de IA de todas as
// empresas; GET ?usuario= → extrato de uma pessoa (e as devoluções possíveis);
// POST { acao: "ajuste", usuario|email, valor, motivo } | { acao: "devolucao", pagamento, motivo, foraDoPrazo }.
import { sql } from "@/server/db";
import { carteirasAdmin, extratoDe, saldoDe, ajustarCreditos, marcarDevolucao, calcularDevolucao } from "@/server/creditos";
import { consumoIAAdmin } from "@/server/unidadesIA";
import { registrar } from "@/server/eventos";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await exigirAdmin();
    const uid = new URL(req.url).searchParams.get("usuario");
    if (uid) {
      const pacotes = await sql<{ id: string }[]>`SELECT id FROM pagamento WHERE usuario_id = ${uid} AND tipo = 'creditos' AND status = 'aprovado' ORDER BY criado_em DESC LIMIT 20`;
      const devolucoes = []; for (const p of pacotes) devolucoes.push(await calcularDevolucao(p.id).catch(() => null));
      return ok({ saldo: await saldoDe(uid), extrato: await extratoDe(uid, 200), devolucoes: devolucoes.filter(Boolean) });
    }
    const [c, ia] = await Promise.all([carteirasAdmin(), consumoIAAdmin()]);
    return ok({ ...c, ia });
  } catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request) {
  try {
    const admin = await exigirAdmin();
    const b = await corpo<{ acao?: string; usuario?: string; email?: string; valor?: number; motivo?: string; pagamento?: string; foraDoPrazo?: boolean }>(req);
    if (b.acao === "ajuste") {
      let uid = String(b.usuario ?? "");
      if (!uid && b.email) { const [x] = await sql<{ id: string }[]>`SELECT id FROM usuario WHERE email = ${String(b.email).trim().toLowerCase()}`; uid = x?.id ?? ""; }
      if (!uid) return erro("Diga de quem é a carteira (e-mail).", 400);
      await ajustarCreditos(admin.id, uid, Number(b.valor), String(b.motivo ?? ""));
      void registrar("pagamento", `Ajuste de créditos (${Number(b.valor) > 0 ? "+" : ""}${Number(b.valor).toFixed(2).replace(".", ",")})`, { usuarioId: uid, dados: { detalhes: `Motivo: ${String(b.motivo ?? "").slice(0, 200)}` } });
      return ok({ saldo: await saldoDe(uid) });
    }
    if (b.acao === "devolucao") {
      const d = await marcarDevolucao(admin.id, String(b.pagamento ?? ""), String(b.motivo ?? ""), b.foraDoPrazo === true);
      void registrar("pagamento", `Devolução de créditos marcada (R$ ${d.valorReais.toFixed(2).replace(".", ",")} a estornar no Mercado Pago)`, { dados: { detalhes: `Pagamento ${d.pagamentoId}: ${d.restante} créditos saíram da carteira.` } });
      return ok(d);
    }
    return erro("Ação desconhecida.", 400);
  } catch (e) { return erro(e, 400); }
}
