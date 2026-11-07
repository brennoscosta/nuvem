// Políticas de uso do mundo WorkEnd (texto inicial; o Brenno ajusta quando quiser).
import { Topo, Rodape } from "../_partes";
import { meta } from "../seo";

export const metadata = meta({ titulo: "Políticas de uso — WorkEnd", descricao: "O que pode e o que não pode no mundo WorkEnd.", caminho: "/politicas" });

export default function Politicas() {
  return (
    <>
      <Topo />
      <section className="faixa py-10 lg:py-16">
        <h1 className="text-[2.2rem] lg:text-[2.8rem]">Políticas de uso</h1>
        <p className="mt-5 max-w-[60ch] text-[var(--tinta-2)]">O WorkEnd é um mundo compartilhado. Cada lote é uma vitrine pública: o que você coloca na placa, na fachada e no escritório é visto por todo mundo. Por isso, algumas regras simples.</p>
        <div className="mt-8 max-w-[70ch] space-y-5 text-[1.05rem] leading-relaxed">
          <p><b>1. O chão é seu enquanto estiver pago.</b> A reserva vale 10 minutos. O pagamento (R$ 99 por lote, por mês) ativa o lote por 30 dias. Depois do vencimento há 5 dias de tolerância; sem renovação, o lote volta a ficar à venda e a placa sai do mapa. Não há reembolso de meses já pagos.</p>
          <p><b>2. Nome, logo e conteúdo.</b> Não é permitido usar marcas, nomes ou logotipos de terceiros sem autorização; conteúdo ofensivo, discriminatório, sexual ou violento; nem atividade ilegal, golpe ou promessa enganosa. A empresa precisa ser sua ou você precisa ter autorização para representá-la.</p>
          <p><b>3. Um chão por conta.</b> Nesta fase cada conta pode ter um lote. Reservar outro libera a reserva anterior.</p>
          <p><b>4. Banimento.</b> O administrador do WorkEnd pode retirar do mapa qualquer imóvel que descumpra estas regras e suspender a conta do dono, sem aviso prévio em casos graves. O motivo fica registrado na conta.</p>
          <p><b>5. Dados.</b> Guardamos nome, e-mail, nome da empresa, logo e os registros de pagamento (feitos pelo Mercado Pago; não vemos nem guardamos dados de cartão). Para apagar sua conta, escreva para contato@workend.online.</p>
          <p className="text-[var(--tinta-2)]">Versão de 07/11/2026. Mudanças serão avisadas no painel.</p>
        </div>
      </section>
      <Rodape />
    </>
  );
}
