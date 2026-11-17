// Página "não encontrada" do WorkEnd (17/11/2026, revisão geral: o endereço errado e a loja que fechou caíam na tela
// branca do Next em inglês). Em português, com a marca e caminhos de volta. Usada pelo not-found do WorkEnd, pelo
// not-found da raiz (no domínio do WorkEnd) e pela página /loja/N quando a loja não está aberta ou o endereço está livre.
import Link from "next/link";
import { Topo, Rodape } from "./_partes";

export function NaoEncontrada({ titulo = "Esta página não existe", texto = "O endereço pode ter mudado ou ter sido digitado errado. Daqui você volta para a cidade.", chaveLote = null, livre = false }: { titulo?: string; texto?: string; chaveLote?: string | null; livre?: boolean }) {
  return (
    <>
      <Topo />
      <main className="faixa py-10 lg:py-16">
        <section className="relative overflow-hidden rounded-[22px] bg-[var(--night)] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, #0A6CFF, transparent 70%)" }} />
          <p className="relative text-[14px] font-semibold text-white/60">{livre ? "Endereço livre na cidade" : "WorkEnd"}</p>
          <h1 className="relative mt-2 max-w-[22ch] text-[2rem] sm:text-[2.6rem]" style={{ color: "#fff" }}>{titulo}</h1>
          <p className="relative mt-3 max-w-[56ch] text-[16px] text-white/75">{texto}</p>
          <div className="relative mt-7 flex flex-wrap gap-2">
            {chaveLote
              ? <Link prefetch={false} href={`/mundo?lote=${encodeURIComponent(chaveLote)}`} className="btn btn-azul">{livre ? "Reservar este endereço" : "Ver no mapa"}</Link>
              : <Link prefetch={false} href="/mundo" className="btn btn-azul">Ver o mapa da cidade</Link>}
            <Link href="/encontrar" className="btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>Encontrar empresas</Link>
            <Link href="/" className="btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>Início</Link>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
