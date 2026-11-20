// Formulário do perfil logo depois de criar a conta (20/11/2026, frente "cadastro"): etapas curtas com barra de progresso.
// ?depois= é para onde a pessoa ia (o painel ou o mapa num lote); ?etapa= abre numa etapa (o painel manda para a que falta).
// Também é o destino de quem entra pelo Google pela primeira vez (src/app/api/workend/google/volta).
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { meuPerfil, sugestaoInicial } from "@/server/perfis";
import { ETAPAS, PERFIL_VAZIO, ehEtapa, ordemEtapas, type EtapaId } from "@/office/data/cadastro";
import { Etapas, type Rascunho } from "../_form";
import { meta } from "../../../seo";
import "../../../perfil/perfil.css";

export const metadata = meta({ titulo: "Seu perfil — WorkEnd", caminho: "/app/perfil/comecar", indexar: false });
export const dynamic = "force-dynamic";

const destinoSeguro = (d: string | undefined) => (d && d.startsWith("/") && !d.startsWith("//") && !d.startsWith("/\\") ? d.slice(0, 300) : "/app");

export default async function Comecar({ searchParams }: { searchParams: Promise<{ depois?: string; etapa?: string }> }) {
  const sp = await searchParams;
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect(`/entrar?destino=${encodeURIComponent("/app/perfil/comecar")}`);
  const [perfil, sugestao] = await Promise.all([meuPerfil(u.id).catch(() => null), perfilVazio(u)]);
  const inicial: Rascunho = perfil ?? { ...PERFIL_VAZIO, ...sugestao };
  const ordem = ordemEtapas(inicial.objetivo);
  const falta = ordem.find((e) => !inicial.etapas.includes(e));
  if (!falta && !ehEtapa(sp.etapa)) redirect("/app/perfil");
  const comecarEm: EtapaId = ehEtapa(sp.etapa) ? sp.etapa : (falta ?? ETAPAS[0].id);
  return <Etapas inicial={inicial} comecarEm={comecarEm} depois={destinoSeguro(sp.depois)} nomeConta={u.empresaNome || u.nome} emailConta={u.email} />;
}
async function perfilVazio(u: NonNullable<Awaited<ReturnType<typeof usuarioAtual>>>) { return sugestaoInicial(u).catch(() => ({})); }
