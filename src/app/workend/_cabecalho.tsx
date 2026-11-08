// Cabeçalho das páginas logadas (/app, /app/rede, /app/admin): logo + atalhos. No celular os atalhos ficam numa
// linha que rola de lado, o e-mail some e o logo não encolhe.
import Link from "next/link";
import Image from "next/image";
import { BotaoSair } from "./_conta";

export function CabecalhoApp({ atual, email, admin }: { atual: "app" | "rede" | "admin" | "mapa"; email?: string | null; admin?: boolean }) {
  const item = (href: string, rotulo: string, id: string) => <Link key={id} href={href} className={`btn whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4 sm:text-[15px] ${atual === id ? "btn-azul" : "btn-claro"}`}>{rotulo}</Link>;
  return (
    <header className="faixa flex items-center justify-between gap-3 py-4 sm:py-5">
      <Link href="/" aria-label="WorkEnd" className="shrink-0"><Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-8 w-auto sm:h-9" /></Link>
      <div className="sem-barra flex min-w-0 items-center gap-2 overflow-x-auto">
        {item("/mundo", "Mapa", "mapa")}
        {email && item("/app", "Meu escritório", "app")}
        {email && item("/app/rede", "Minha rede", "rede")}
        {admin && item("/app/admin", "Admin", "admin")}
        {email && <span className="hidden whitespace-nowrap text-sm text-[var(--tinta-2)] lg:inline">{email}</span>}
        {email && <span className="shrink-0"><BotaoSair /></span>}
      </div>
    </header>
  );
}
