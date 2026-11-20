// Lista dos cadastros para a equipe do WorkEnd (20/11/2026, frente "cadastro"): objetivo, tipo, área, cidade, o que oferece e
// procura e a data, com filtros. ?formato=csv baixa a planilha (ponto e vírgula, abre direto no Excel em português).
import { listarCadastros, csvCadastros } from "@/server/perfis";
import { ok, erro } from "@/server/http";
import { exigirAdmin, statusDe } from "../_guarda";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await exigirAdmin();
    const p = new URL(req.url).searchParams;
    const f = { objetivo: p.get("objetivo"), tipo: p.get("tipo"), nicho: p.get("nicho"), uf: p.get("uf"), situacao: p.get("situacao"), q: p.get("q"), de: p.get("de"), ate: p.get("ate") };
    if (p.get("formato") === "csv") {
      const rows = await listarCadastros(f, 20000);
      const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      return new Response(csvCadastros(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="cadastros-workend-${dia}.csv"`, "cache-control": "no-store" } });
    }
    return ok(await listarCadastros(f));
  } catch (e) { return erro(e, statusDe(e)); }
}
