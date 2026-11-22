// Planos do WorkEnd (WE-19, 22/11/2026): workend.online/planos, a mesma escada da seção #preco da página inicial
// (../_planos.tsx), com o evento ver_preco da WE-01 e as perguntas sobre preço.
import Link from "next/link";
import { usuarioAtual } from "@/server/usuarios";
import { temBanco } from "@/server/db";
import { vagasFundador } from "@/server/ofertas";
import { planoEquipeLigado } from "@/server/planos";
import { cartaoLigado } from "@/server/assinaturas";
import { PRECO_LOTE, PRECO_QUIOSQUE, precoCurto } from "@/office/data/precosTerreno";
import { Topo, Rodape } from "../_partes";
import { EscadaPlanos } from "../_planos";
import { meta } from "../seo";
import "../inicio.css";

export const dynamic = "force-dynamic";
export const metadata = meta({
  titulo: "Planos e preços — WorkEnd",
  descricao: `Página da loja grátis, quiosque por ${precoCurto(PRECO_QUIOSQUE)} e loja com prédio e equipe de IA por ${precoCurto(PRECO_LOTE)} por mês. Sem fidelidade.`,
  caminho: "/planos",
});

const PERGUNTAS: [string, string][] = [
  ["Posso começar grátis e mudar depois?", "Pode. Publique a página grátis e, quando quiser, reserve um quiosque ou um lote no mapa. A mesma loja vai junto: o endereço, a vitrine, a logo e a atendente, sem novo cadastro."],
  ["Como funciona o pagamento?", "Por Pix, direto no mapa, e a confirmação chega sozinha. Onde o cartão estiver ligado, você pode deixar a renovação automática. A reserva segura o lote por 1 hora enquanto você paga."],
  ["E se eu não renovar?", "Depois do vencimento há 5 dias de tolerância. Sem renovação, o lote volta a ficar à venda, mas a sua marca e a sua equipe ficam guardadas na conta e voltam se você reservar outro lote."],
  ["Posso desistir da compra?", "Pode. Em até 7 dias depois da compra você recebe o valor de volta."],
];

export default async function Planos() {
  const u = await usuarioAtual().catch(() => null);
  const restamFundador = temBanco() ? await vagasFundador().catch(() => 0) : 0;
  const ctaLoja = u ? { href: "/mundo", texto: "Escolher meu lote no mapa" } : { href: "/cadastro", texto: "Reservar meu lote" };
  return (
    <div className="wi">
      <Topo logado={!!u} nome={u?.nome} />
      <main>
        <section id="planos" className="ws wpl-pagina" data-medir-ver="ver_preco">
          <div className="faixa ws-cab"><h1 className="wpl-titulo">Comece grátis. <em>Suba um degrau quando a loja pedir.</em></h1><p>A página da loja não custa nada. Quando quiser um ponto na cidade, escolha o tamanho. Sem fidelidade e sem letra miúda.</p></div>
          <div className="faixa">
            <EscadaPlanos logado={!!u} ctaLoja={ctaLoja} restamFundador={restamFundador} equipe={planoEquipeLigado()} cartao={cartaoLigado()} origem="planos" />
            <div className="wi-perguntas">
              <h3>Perguntas sobre preço</h3>
              {PERGUNTAS.map(([p, r]) => <details key={p}><summary>{p}</summary><p>{r}</p></details>)}
              <p className="wpl-volta"><Link href="/" className="wi-seta">Conhecer o WorkEnd<span aria-hidden>↗</span></Link></p>
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </div>
  );
}
