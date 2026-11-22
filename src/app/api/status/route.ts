// Estado do servidor. Usado pelo escritório 3D (src/office/store.ts lê banco, ia, admin e senhaConfigurada) e, desde a
// WE-23 (22/11/2026), pronto para um monitor de fora (UptimeRobot ou Better Stack, de graça):
//  - responde 200 com "ok": true quando o servidor e o banco respondem; 503 com "ok": false quando o banco não responde
//    (o monitor que olha só o código HTTP já percebe);
//  - pergunta ao banco de verdade (SELECT 1, até 5 s), não só se as migrações já rodaram uma vez;
//  - nunca fica guardado em cache; HEAD também funciona (o Next responde HEAD com o GET).
import { temBanco, migrar, sql } from "@/server/db";
import { temIA } from "@/server/motor";
import { ehAdmin, temSenhaConfigurada } from "@/server/auth";

export const dynamic = "force-dynamic";

const PRAZO_BANCO_MS = 5000;

export async function GET() {
  let banco: "ok" | "sem_url" | "erro" = "sem_url"; let detalhe = "";
  if (temBanco()) {
    let prazo: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([(async () => { await migrar(); await sql`SELECT 1`; })(), new Promise<never>((_, rej) => { prazo = setTimeout(() => rej(new Error("O banco não respondeu em 5 s.")), PRAZO_BANCO_MS); })]);
      banco = "ok";
    } catch (e) { banco = "erro"; detalhe = e instanceof Error ? e.message : String(e); } finally { clearTimeout(prazo); }
  }
  const corpo = { ok: banco === "ok", banco, detalhe, ia: temIA() ? "ok" : "sem_chave", admin: await ehAdmin().catch(() => false), senhaConfigurada: temSenhaConfigurada(), hora: new Date().toISOString() };
  return Response.json(corpo, { status: banco === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
