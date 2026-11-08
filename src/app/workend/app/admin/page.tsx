// Painel do admin do WorkEnd: lotes (reservas e chãos pagos), pagamentos e usuários, com liberar/banir/ativar/editar.
// Entra quem é admin (a conta souzacostabrenno@gmail.com ou quem ela promoveu) — ou quem digita a senha única
// (ADMIN_SENHA), que abre a sessão da conta do dono.
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin, ADMIN_EMAIL, PRECO_LOTE, MINUTOS_RESERVA, DIAS_MES, DIAS_TOLERANCIA, precoPara } from "@/server/terrenos";
import { pagamentoLigado } from "@/server/mercadopago";
import { temSenhaConfigurada } from "@/server/auth";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { PainelAdmin, EntrarAdmin } from "./_painel";
import { EmailsAdmin } from "./_emails";
import { CatalogoAdmin, AtividadeAdmin } from "./_catalogo";
import { PersonagensAdmin } from "./_personagens";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Admin — WorkEnd", caminho: "/app/admin", indexar: false });
export const dynamic = "force-dynamic";

export default async function Admin() {
  const u = await usuarioAtual().catch(() => null);
  const admin = !!u && ehAdmin(u);
  return (
    <>
      <CabecalhoApp atual="admin" email={u?.email} admin={admin} />
      {!admin ? (
        <section className="faixa pt-4">
          <h1 className="text-[2rem] lg:text-[2.4rem]">Admin do WorkEnd</h1>
          <p className="mt-2 max-w-[60ch] text-[var(--tinta-2)]">{u ? <>Você está como <b>{u.email}</b>, que não é admin. </> : null}Entre com a senha do admin: ela abre a conta <b>{ADMIN_EMAIL}</b>.</p>
          <EntrarAdmin temSenha={temSenhaConfigurada()} />
        </section>
      ) : (
        <>
          <section className="faixa pt-4">
            <h1 className="text-[2rem] lg:text-[2.4rem]">Admin do WorkEnd</h1>
            <p className="mt-2 max-w-[70ch] text-[var(--tinta-2)]">Logado como <b>{u!.email}</b>. Tudo que acontece no mundo: lotes reservados e pagos, pagamentos do Mercado Pago e usuários. Clique no número do lote pra abrir o mapa nele.</p>
          </section>
          <PainelAdmin config={{ preco: PRECO_LOTE, precoAdmin: precoPara(u), minutosReserva: MINUTOS_RESERVA, diasMes: DIAS_MES, diasTolerancia: DIAS_TOLERANCIA, pagamento: pagamentoLigado(), adminEmail: ADMIN_EMAIL, eu: u!.email }} />
          <AtividadeAdmin />
          <CatalogoAdmin />
          <PersonagensAdmin />
          <EmailsAdmin />
        </>
      )}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
