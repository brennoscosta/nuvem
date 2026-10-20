import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escritório Nuvem",
  description: "Escritório virtual 3D com agentes de IA em hierarquia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
