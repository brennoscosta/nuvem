// Cabeçalho das páginas logadas (/app e as outras áreas). Desde 16/11/2026 a barra é ./_barra.tsx: vidro fixo no topo,
// ícones próprios, destaque que desliza, menu da conta e menu de telas menores.
import { BarraApp, type AtualApp } from "./_barra";

export function CabecalhoApp({ atual, email, admin }: { atual: AtualApp; email?: string | null; admin?: boolean }) {
  return <BarraApp atual={atual} email={email} admin={admin} />;
}
