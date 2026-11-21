// Preferências de e-mail (WE-17, 21/11/2026): aberta pelo link assinado do rodapé dos e-mails de ciclo de vida, sem login.
// Três escolhas (dicas da loja, resumo da semana, unidades de IA) e "parar todos". Os e-mails da conta não passam por aqui.
import { Topo, Rodape } from "../_partes";
import { meta } from "../seo";
import { sql, migrar } from "@/server/db";
import { usuarioDoToken, preferenciasEmail, CATEGORIAS_EMAIL } from "@/server/email";
import { FormPreferencias } from "./_preferencias";

export const metadata = meta({ titulo: "Avisos por e-mail — WorkEnd", caminho: "/emails", indexar: false });
export const dynamic = "force-dynamic";

// só o começo do e-mail, porque o link pode ter sido encaminhado: br****@exemplo.com
const mascarar = (e: string) => { const [n, d] = e.split("@"); return `${n.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, n.length - 2)))}@${d ?? ""}`; };

export default async function Emails({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  await migrar();
  const uid = await usuarioDoToken(t).catch(() => null);
  const [u] = uid ? await sql<{ email: string }[]>`SELECT email FROM usuario WHERE id = ${uid}` : [];
  const prefs = u && uid ? await preferenciasEmail(uid) : null;
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div className="pg-claro">
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Avisos por e-mail</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Escolha quais avisos sobre a sua loja você quer receber. A mudança vale na hora.</p>
          <p className="mt-3 max-w-[48ch] text-[15px] text-[var(--tinta-2)]">Os e-mails da sua conta continuam chegando: boas-vindas, reserva, pagamento, vencimento do lote e troca de senha.</p>
        </div>
        <div className="pg-cartao p-6 shadow-[0_24px_60px_-40px_rgba(16,24,40,.45)] lg:p-8">
          {u && prefs && t ? <FormPreferencias token={t} email={mascarar(u.email)} inicial={prefs} categorias={CATEGORIAS_EMAIL} />
            : <p className="text-[var(--tinta-2)]">Este link não está completo ou não vale mais. Abra de novo o link do rodapé do e-mail que você recebeu.</p>}
        </div>
      </section>
      <Rodape />
    </>
  );
}
