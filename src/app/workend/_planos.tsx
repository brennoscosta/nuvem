// Escada de planos (WE-19, 22/11/2026, decisão do dono "Escada 0 → 47 → 97"): Vitrine grátis, Quiosque, Loja, Equipe (só
// com o WhatsApp da atendente ligado) e Sede sob consulta, a âncora da agência de IA e os avulsos. Vai na seção #preco da
// página inicial e em /planos. Desenho: os degraus são prédios que crescem lado a lado sobre a mesma calçada (no celular,
// uma barra à esquerda de cada degrau mostra a altura). Números vêm das constantes (precosTerreno.ts, planos.ts, unidades).
import Link from "next/link";
import { LAYOUTS, MAX_SETORES } from "@/office/data/escritorio";
import { ESPECIALISTAS_IA } from "@/office/data/especialistas";
import { PRECO_LOTE, PRECO_QUIOSQUE, PRECO_LOTE_EXTRA, precoCurto } from "@/office/data/precosTerreno";
import { PRECO_EQUIPE, ANCORA_AGENCIA, EQUIPE_ITENS } from "@/office/data/planos";
import { PRECO_MODELO } from "@/office/data/modelos";
import { PRECO_AGENTE } from "@/server/agentesVenda";
import { UNIDADES_MES_LOTE, UNIDADES_MES_QUIOSQUE, UNIDADES_MES_VITRINE, RESPOSTAS_MES_VITRINE } from "@/server/unidadesIA";
import { MAX_PRODUTOS } from "@/server/vitrine";
import { PRODUTOS_VITRINE_GRATIS } from "@/server/planoVitrine";
import { FUNDADOR } from "@/server/ofertas";
import { brl } from "@/server/email";
import { FaleComAGente } from "./_planos-contato";
import "./planos.css";

export interface PropsEscada {
  logado: boolean;
  ctaLoja: { href: string; texto: string };
  restamFundador: number;
  equipe: boolean; // planoEquipeLigado()
  cartao: boolean; // pagamento automático no cartão ligado (WE-09)
  origem: "inicio" | "planos";
}
interface Degrau { id: string; nome: string; valor: string; unidade: string; frase: string; mais: string | null; itens: string[]; extra?: React.ReactNode; acao: React.ReactNode }

const mil = (n: number) => n.toLocaleString("pt-BR");
// respostas de IA por mês pela mesma conta da página grátis (200 unidades ≈ 100 respostas)
const respostas = (unidades: number) => mil(Math.round((unidades * RESPOSTAS_MES_VITRINE) / UNIDADES_MES_VITRINE / 10) * 10);

export function EscadaPlanos({ logado, ctaLoja, restamFundador, equipe, cartao, origem }: PropsEscada) {
  const local = origem === "inicio" ? "preco" : "planos";
  const degraus: Degrau[] = [
    {
      id: "vitrine", nome: "Vitrine", valor: "Grátis", unidade: "para sempre", frase: "Para a loja aparecer hoje, sem pagar nada.", mais: null,
      itens: ["Página própria da loja, com endereço seu", `${PRODUTOS_VITRINE_GRATIS} produtos na vitrine`, "Botão de pedir pelo WhatsApp", `Atendente de IA com cerca de ${RESPOSTAS_MES_VITRINE} respostas por mês`],
      acao: <Link href={logado ? "/app" : "/cadastro"} className="wi-btn wi-btn-linha" data-medir={logado ? undefined : "clicar_cta_principal"} data-medir-local={logado ? undefined : `${local}-vitrine`}>{logado ? "Abrir minha página" : "Criar minha página grátis"}</Link>,
    },
    {
      id: "quiosque", nome: "Quiosque", valor: precoCurto(PRECO_QUIOSQUE), unidade: "por mês", frase: "Um ponto na rua da orla, onde o movimento passa.", mais: "Tudo da Vitrine, mais:",
      itens: ["Quiosque na cidade com a sua logo e as suas cores", `Vitrine com até ${MAX_PRODUTOS} produtos`, `Atendente de IA no balcão, com cerca de ${respostas(UNIDADES_MES_QUIOSQUE)} respostas por mês`],
      acao: <Link prefetch={false} href="/mundo" className="wi-btn wi-btn-linha">Ver os quiosques no mapa</Link>,
    },
    {
      id: "loja", nome: "Loja", valor: precoCurto(PRECO_LOTE), unidade: "por mês", frase: "O prédio com a sua marca na fachada e a equipe de IA.", mais: "Tudo do Quiosque, mais:",
      itens: [
        "Lote na cidade com prédio, placa e fachada da sua marca",
        `${LAYOUTS.length} tipos de prédio e 3 trocas grátis`,
        "CEO e atendente de IA, e especialistas para contratar",
        `Até ${MAX_SETORES} setores, cupons e agenda de horários`,
        `Cerca de ${respostas(UNIDADES_MES_LOTE)} respostas de IA por mês`,
        cartao ? "Pix no mapa ou cartão, todo mês" : "Pagamento por Pix, direto no mapa",
        "Desistiu em até 7 dias? O valor volta",
      ],
      extra: restamFundador > 0 ? <p className="wi-fundador"><b>Preço de fundador:</b> 1º mês por {brl(FUNDADOR.valor)} para as {FUNDADOR.vagas} primeiras empresas · <b>restam {restamFundador}</b></p> : null,
      acao: <Link href={ctaLoja.href} className="wi-btn wi-btn-azul" data-medir="clicar_cta_principal" data-medir-local={local}>{ctaLoja.texto}<span aria-hidden>→</span></Link>,
    },
  ];
  // Equipe: só com o WhatsApp da atendente ligado (WE-18). A cobrança ainda não existe: o botão grava o interesse.
  if (equipe) degraus.push({
    id: "equipe", nome: "Equipe", valor: precoCurto(PRECO_EQUIPE), unidade: "por mês", frase: "A atendente também no seu WhatsApp, com a equipe maior.", mais: "Tudo da Loja, mais:",
    itens: ["Atendente de IA respondendo no seu WhatsApp", `${EQUIPE_ITENS.especialistas} especialistas de IA nos ${EQUIPE_ITENS.setores} setores`, `${mil(EQUIPE_ITENS.unidades)} unidades de IA por mês, cerca de ${respostas(EQUIPE_ITENS.unidades)} respostas`, "Relatório semanal da equipe"],
    acao: <FaleComAGente plano="equipe" origem={local} rotulo="Quero o plano Equipe" />,
  });
  degraus.push({
    id: "sede", nome: "Sede", valor: "Sob consulta", unidade: "", frase: "Para redes, franquias e empresas com vários times.", mais: equipe ? "Tudo do Equipe, mais:" : "Tudo da Loja, mais:",
    itens: ["Prédio de sede com departamentos", `Todos os ${ESPECIALISTAS_IA.length} especialistas de IA`, "Várias pessoas da empresa com acesso", "Unidades de IA sob medida"],
    acao: <FaleComAGente plano="sede" origem={local} rotulo="Fale com a gente" />,
  });

  const agente = Math.min(...Object.values(PRECO_AGENTE));
  const modelo = Math.min(...Object.values(PRECO_MODELO).filter((v) => v > 0));
  const comparado = equipe ? { nome: "WorkEnd Equipe", valor: PRECO_EQUIPE } : { nome: "WorkEnd Loja", valor: PRECO_LOTE };
  const barras = [
    { nome: "Agência de IA", texto: `${precoCurto(ANCORA_AGENCIA.de)} a ${precoCurto(ANCORA_AGENCIA.ate)} por mês`, de: ANCORA_AGENCIA.de, ate: ANCORA_AGENCIA.ate, nossa: false },
    ...(equipe ? [{ nome: comparado.nome, texto: `${precoCurto(PRECO_EQUIPE)} por mês`, de: 0, ate: PRECO_EQUIPE, nossa: true }] : []),
    { nome: "WorkEnd Loja", texto: `${precoCurto(PRECO_LOTE)} por mês`, de: 0, ate: PRECO_LOTE, nossa: true },
  ];
  const anoCabe = comparado.valor * 12 < ANCORA_AGENCIA.de; // a frase do ano só aparece se continuar verdadeira

  return (
    <div className="wpl" style={{ ["--qtd" as string]: degraus.length }}>
      <ol className="wpl-escada" aria-label="Planos do WorkEnd, do grátis ao maior">
        {degraus.map((d, i) => (
          <li key={d.id} className={`wpl-degrau wpl-${d.id}`} style={{ ["--n" as string]: i }} data-plano={d.id}>
            <div className="wpl-cab">
              <h3>{d.nome}</h3>
              <p className="wpl-valor"><b>{d.valor}</b>{d.unidade && <span>{d.unidade}</span>}</p>
              <p className="wpl-frase">{d.frase}</p>
            </div>
            {d.extra}
            <div className="wpl-corpo">
              {d.mais && <p className="wpl-mais">{d.mais}</p>}
              <ul className="wi-lista">{d.itens.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="wpl-acao">{d.acao}</div>
          </li>
        ))}
      </ol>

      <div className="wpl-ancora">
        <div className="wpl-ancora-texto">
          <h3>{anoCabe ? <>Uma agência de IA cobra num mês <em>mais do que a {comparado.nome.replace("WorkEnd ", "")} custa num ano.</em></> : <>Atendente de IA <em>sem preço de agência.</em></>}</h3>
          <p>Agências que montam atendimento com IA para pequenos negócios cobram de {precoCurto(ANCORA_AGENCIA.de)} a {precoCurto(ANCORA_AGENCIA.ate)} por mês. No WorkEnd, a atendente já vem com a loja.</p>
        </div>
        <div className="wpl-barras" role="list" aria-label="Preço por mês">
          {barras.map((b) => (
            <div key={b.nome} role="listitem" className={`wpl-barra ${b.nossa ? "nossa" : ""}`} style={{ ["--ini" as string]: b.de / ANCORA_AGENCIA.ate, ["--fim" as string]: b.ate / ANCORA_AGENCIA.ate }}>
              <span className="wpl-barra-nome">{b.nome}</span>
              <span className="wpl-trilho" aria-hidden><i /></span>
              <b>{b.texto}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="wpl-avulsos">
        <h3>Avulsos, quando precisar</h3>
        <ul>
          <li><b>Especialistas de IA</b> a partir de {precoCurto(agente)}, pagos uma vez</li>
          <li><b>Modelos de prédio</b> a partir de {precoCurto(modelo)}, pagos uma vez</li>
          <li><b>Unidades de IA</b> em pacotes, com os créditos da conta</li>
          <li><b>Lote extra</b> ao lado do seu, por {precoCurto(PRECO_LOTE_EXTRA)} por mês</li>
        </ul>
        <p>Personagem <b>grátis</b> para toda conta. Do grátis para um ponto na cidade, a mesma loja vai junto: endereço, vitrine e atendente, sem novo cadastro.</p>
      </div>
    </div>
  );
}
