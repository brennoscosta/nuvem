import { temBanco, migrar } from "@/server/db";
import { temIA } from "@/server/motor";
import { ok } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  let banco: "ok" | "sem_url" | "erro" = "sem_url"; let detalhe = "";
  if (temBanco()) { try { await migrar(); banco = "ok"; } catch (e) { banco = "erro"; detalhe = e instanceof Error ? e.message : String(e); } }
  return ok({ banco, detalhe, ia: temIA() ? "ok" : "sem_chave" });
}
