import { Topo, Rodape } from "../_partes";
import { FormPedirSenha } from "../_conta";
import { emailLigado } from "@/server/email";
import { meta } from "../seo";

export const metadata = meta({ titulo: "Esqueci minha senha — WorkEnd", caminho: "/esqueci", indexar: false });
export const dynamic = "force-dynamic";

export default function Esqueci() {
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div>
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Esqueceu a senha?</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Informe o e-mail da conta e enviamos um link para criar uma nova senha. O link vale 1 hora.</p>
        </div>
        <div className="rounded-2xl bg-[var(--cinza)] p-6 lg:p-8">
          {emailLigado() ? <FormPedirSenha /> : <p className="text-[var(--tinta-2)]">O envio por e-mail ainda não está disponível. Se você criou a conta com o Google, use o botão “Entrar com Google”.</p>}
        </div>
      </section>
      <Rodape />
    </>
  );
}
