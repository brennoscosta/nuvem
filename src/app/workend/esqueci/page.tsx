// Esqueci minha senha. Com o e-mail configurado no servidor (SENDGRID_API_KEY e EMAIL_REMETENTE), manda o link para
// criar uma senha nova (vale 1 hora). Sem ele (17/11/2026, revisão geral: a página prometia um e-mail que não saía),
// mostra caminhos reais: entrar com o Google (quem criou a conta assim) e pedir o acesso ao atendimento do WorkEnd.
import { Topo, Rodape } from "../_partes";
import { FormPedirSenha, BotaoGoogle } from "../_conta";
import { emailLigado } from "@/server/email";
import { meta } from "../seo";

export const metadata = meta({ titulo: "Esqueci minha senha — WorkEnd", caminho: "/esqueci", indexar: false });
export const dynamic = "force-dynamic";

const ASSUNTO = encodeURIComponent("Recuperar o acesso à minha conta do WorkEnd");
const CORPO = encodeURIComponent("Olá! Esqueci a senha da minha conta do WorkEnd.\n\nE-mail da conta: \nNome da empresa (se tiver lote): \n\nObrigado!");

export default function Esqueci() {
  const ligado = emailLigado();
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div className="pg-claro">
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">{ligado ? "Esqueceu a senha?" : "Vamos recuperar o seu acesso"}</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">
            {ligado ? "Informe o e-mail da conta e enviamos um link para criar uma nova senha. O link vale 1 hora." : "Escolha o jeito que combina com a sua conta. Em poucos minutos você volta para o seu escritório."}
          </p>
        </div>
        <div className="pg-cartao p-6 shadow-[0_24px_60px_-40px_rgba(16,24,40,.45)] lg:p-8">
          {ligado ? <FormPedirSenha /> : (
            <div className="space-y-6">
              <div>
                <h2 className="text-[1.15rem]">Criou a conta com o Google?</h2>
                <p className="mt-1.5 text-[15px] text-[var(--tinta-2)]">Não precisa de senha: entre com o mesmo Google.</p>
                <div className="mt-3"><BotaoGoogle texto="Entrar com Google" /></div>
              </div>
              <div className="border-t border-[var(--linha)] pt-6">
                <h2 className="text-[1.15rem]">Criou com e-mail e senha?</h2>
                <p className="mt-1.5 text-[15px] text-[var(--tinta-2)]">Escreva para o atendimento do WorkEnd a partir do e-mail da conta. A gente confere que é você e libera uma senha nova, normalmente no mesmo dia.</p>
                <a href={`mailto:contato@workend.online?subject=${ASSUNTO}&body=${CORPO}`} className="btn btn-azul mt-3">Pedir uma senha nova</a>
                <p className="mt-2 text-[13px] text-[var(--tinta-2)]">contato@workend.online</p>
              </div>
            </div>
          )}
        </div>
      </section>
      <Rodape />
    </>
  );
}
