// Medição (WE-01 e WE-02, 21/11/2026): lê os IDs no servidor a cada requisição e entrega ao aviso de cookies.
// Vai no layout do site (src/app/workend/layout.tsx) e no mapa do WorkEnd (src/app/page.tsx, lugar="mapa").
import { configMedicao } from "@/server/medicao";
import { MedicaoCliente } from "./_cookies";

export async function Medicao({ lugar = "site" }: { lugar?: "site" | "mapa" }) {
  const cfg = await configMedicao();
  return <MedicaoCliente cfg={cfg} lugar={lugar} />;
}
