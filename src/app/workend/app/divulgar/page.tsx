// Divulgar a loja (13/11/2026): imagem pronta para Stories e adesivo "Estamos no WorkEnd", os dois com QR Code que leva
// para a página da loja com o código de indicação do dono (quem chega e abre uma loja dá desconto para ele).
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { meuCodigo } from "@/server/ofertas";
import { LOTE_POR_CHAVE, nomeNicho } from "@/office/data/mundo";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { Divulgar } from "./_divulgar";
import { AnunciarNaPraca } from "./_anunciar";
import { numeroDaLoja, temNumero } from "@/office/data/numeroLoja";
import { Icone } from "@/office/ui/Icone";

export const metadata = meta({ titulo: "Divulgar a loja — WorkEnd", caminho: "/app/divulgar", indexar: false });
export const dynamic = "force-dynamic";

// promoção que ainda vale (fora do componente: ler o relógio no render quebra a regra do React)
function promocaoValendo(p: { texto: string; ate: string } | null) { return p && new Date(p.ate).getTime() > Date.now() ? p.texto : null; }

export default async function PaginaDivulgar() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/divulgar");
  const t = await terrenoDoUsuario(u.id).catch(() => null);
  const numero = t?.status === "ativo" ? numeroDaLoja(t) : null; // 0 = a sede da Social RP
  const codigo = temNumero(numero) ? await meuCodigo(u).catch(() => null) : null;
  const promo = promocaoValendo(t?.promocao ?? null);
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="pg-topo" style={t ? ({ "--marca": t.cor } as React.CSSProperties) : undefined}>
        <span className="pg-rotulo"><Icone nome="placa" tamanho={15} />Divulgar a loja</span>
        <h1>Leve gente para a sua loja</h1>
        <p className="pg-sub">Poste a imagem nos Stories e cole o adesivo no balcão. O QR Code abre a página da sua loja; cada visita entra nos seus resultados, e quem abrir uma loja pelo seu código dá desconto na sua mensalidade.</p>
        {t?.status === "ativo" && <p className="mt-2 text-[15px]"><a href="#praca" className="font-semibold text-[var(--azul)] underline">Anunciar na cidade</a>: telão da praça, evento em destaque, patrocínio da praça e outdoors.</p>}
        </div>
      </section>
      {t && temNumero(numero) && codigo ? (
        <Divulgar dados={{ numero, empresa: t.empresaNome, cor: t.cor, nicho: nomeNicho(t.nicho), logo: t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null, predio: `/workend/predios/${t.escritorio?.layout ?? "moderno"}.webp`, promo, link: `https://workend.online/loja/${numero}?ind=${codigo}`, endereco: `workend.online/loja/${numero}` }} />
      ) : (
        <section className="faixa mt-8"><p className="max-w-[60ch] rounded-2xl bg-[#FFF4DB] px-4 py-3 text-[#7A5200]">O material de divulgação aparece quando a sua loja estiver aberta no mapa. <Link prefetch={false} href="/mundo" className="font-semibold underline">Escolher meu lote</Link></p></section>
      )}
      {t?.status === "ativo" && <AnunciarNaPraca marca={{ empresa: t.empresaNome, cor: t.cor, logo: t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? null }} />}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
