// Políticas de uso do mundo WorkEnd (texto inicial; o Brenno ajusta quando quiser).
// 21/11/2026 (WE-06, confiança): itens 6 a 8, com quem cuida dos dados (a controladora), os direitos pela LGPD e como pedir
// a exclusão. Dados da empresa em ../_empresa.ts: o que ainda falta (endereço, e-mail, encarregado) não aparece na tela.
// Sem cláusula de foro, por decisão do dono (21/11/2026).
// 21/11/2026 (WE-01): item 9, cookies e ferramentas de análise, junto com o aviso de cookies (../_cookies.tsx).
import { Topo, Rodape } from "../_partes";
import { EMPRESA } from "../_empresa";
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
          <p><b>1. O chão é seu enquanto estiver pago.</b> A reserva vale 1 hora. O pagamento (R$ 99 por lote, por mês) ativa o lote por 30 dias. Depois do vencimento há 5 dias de tolerância; sem renovação, o lote volta a ficar à venda e a placa sai do mapa; sua marca e sua equipe ficam guardadas na conta e voltam se você reservar outro lote. Você pode desistir da compra em até 7 dias e receber o valor de volta. Depois desse prazo, os meses já pagos não são reembolsados.</p>
          <p><b>2. Nome, logo e conteúdo.</b> Não é permitido usar marcas, nomes ou logotipos de terceiros sem autorização; conteúdo ofensivo, discriminatório, sexual ou violento; nem atividade ilegal, golpe ou promessa enganosa. A empresa precisa ser sua ou você precisa ter autorização para representá-la.</p>
          <p><b>3. Um chão por conta.</b> Nesta fase cada conta pode ter um lote. Reservar outro libera a reserva anterior.</p>
          <p><b>4. Banimento.</b> O administrador do WorkEnd pode retirar do mapa qualquer imóvel que descumpra estas regras e suspender a conta do dono, sem aviso prévio em casos graves. O motivo fica registrado na conta.</p>
          <p><b>5. Dados.</b> Guardamos nome, e-mail, nome da empresa, logo e os registros de pagamento (feitos pelo Mercado Pago; não vemos nem guardamos dados de cartão). Nos itens 6 a 8 estão quem cuida dos seus dados, os seus direitos e como pedir a exclusão.</p>
          <p><b>6. Quem cuida dos seus dados.</b> O WorkEnd é oferecido pela {EMPRESA.razaoSocial}, inscrita no CNPJ sob o nº {EMPRESA.cnpj}. Ela é a controladora dos dados pessoais tratados no WorkEnd, ou seja, quem decide como eles são usados, nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018).{EMPRESA.endereco && <> Endereço: {EMPRESA.endereco}.</>}{EMPRESA.encarregado && <> Encarregado pelo tratamento de dados pessoais: {EMPRESA.encarregado}.</>}</p>
          <div>
            <p><b>7. Seus direitos.</b> Pela LGPD (art. 18), você pode pedir, a qualquer momento:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>a confirmação de que tratamos os seus dados e o acesso a eles;</li>
              <li>a correção de dados incompletos, errados ou desatualizados;</li>
              <li>a anonimização, o bloqueio ou a eliminação de dados desnecessários, em excesso ou tratados em desacordo com a lei;</li>
              <li>a portabilidade dos dados para outro fornecedor;</li>
              <li>a eliminação dos dados tratados com o seu consentimento;</li>
              <li>a informação sobre com quem compartilhamos os seus dados;</li>
              <li>a informação sobre a possibilidade de não dar o consentimento e o que acontece se você não der;</li>
              <li>a revogação do consentimento.</li>
            </ul>
            <p className="mt-3">Você também pode se opor a um tratamento feito sem o seu consentimento quando ele descumprir a lei, pedir a revisão de decisões tomadas só de forma automática que afetem os seus interesses (art. 20) e reclamar na Autoridade Nacional de Proteção de Dados (ANPD), pelo site <a href="https://www.gov.br/anpd" className="font-semibold text-[var(--blue-dark)] underline underline-offset-2">gov.br/anpd</a>.</p>
          </div>
          {/* 21/11/2026 (LGPD, art. 18): a exclusão tem botão em Meu perfil › Excluir minha conta (src/server/exclusao.ts).
              TODO(dono): ainda falta um canal para os outros direitos do item 7, porque o contato@workend.online não recebe
              mensagens (o domínio não tem e-mail). Quando EMPRESA.email for preenchido, a frase do pedido por e-mail aparece. */}
          <p><b>8. Como pedir a exclusão.</b> Você pode pedir a exclusão da sua conta e dos seus dados pessoais. Para isso, entre na sua conta e use <b>Excluir minha conta</b>, em Meu perfil. A exclusão é imediata: apaga os seus dados pessoais e encerra a sua loja, se houver; os registros de pagamento e os extratos de créditos ficam guardados sem identificar você, pelo prazo que a lei exige.{EMPRESA.email
            && <> Para esse pedido, ou para exercer qualquer dos direitos do item 7, você também pode escrever para <a href={`mailto:${EMPRESA.email}`} className="font-semibold text-[var(--blue-dark)] underline underline-offset-2">{EMPRESA.email}</a> a partir do e-mail da sua conta.</>}</p>
          <div id="cookies" className="scroll-mt-6">
            <p><b>9. Cookies e ferramentas de análise.</b> Para o site funcionar, usamos cookies essenciais: o que mantém você na sua conta, o que guarda por 30 dias o código de quem indicou o WorkEnd para você e o que guarda a sua escolha sobre cookies. Eles não dependem do seu consentimento. Com o seu consentimento, podemos usar também:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li><b>Google Analytics e Google Tag Manager</b> (Google), para análise: contam as visitas e mostram quais páginas e botões são usados, para melhorarmos o site;</li>
              <li><b>Meta Pixel</b> (Meta), para anúncios: mede se os anúncios no Facebook e no Instagram trazem visitas, cadastros e pagamentos.</li>
            </ul>
            <p className="mt-3">Essas ferramentas só são carregadas depois que você aceita, no aviso de cookies. Você pode aceitar tudo, recusar tudo ou escolher por tipo (análise e anúncios). Se recusar, nenhuma delas é carregada e o site funciona do mesmo jeito. A sua escolha fica guardada por 6 meses e pode ser mudada a qualquer momento pelo link <b>Cookies</b>, no rodapé do site. Os dados que essas ferramentas coletam também são tratados pelas empresas que as oferecem, conforme a política de privacidade de cada uma, e podem ser guardados fora do Brasil.</p>
          </div>
          <p className="text-[var(--tinta-2)]">Versão de 21/11/2026. Mudanças serão avisadas no painel.</p>
        </div>
      </section>
      <Rodape />
    </>
  );
}
