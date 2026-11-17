// Endereço que não existe (17/11/2026). No domínio do WorkEnd, a página com a marca e caminhos de volta; no escritório da
// Nuvem, um aviso simples em português (antes era a tela branca do Next, em inglês).
import { headers } from "next/headers";
import Link from "next/link";
import "./workend/workend.css";
import { ehHostWorkend } from "@/server/hosts";
import { NaoEncontrada } from "./workend/_nao-encontrada";

export default async function NaoEncontrado() {
  const h = await headers();
  if (h.get("x-site") === "workend" || ehHostWorkend(h.get("x-forwarded-host") ?? h.get("host") ?? "")) return <div className="we"><NaoEncontrada /></div>;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#161C25", color: "#fff", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Esta página não existe</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>O endereço pode ter mudado.</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, color: "#5B9DFF" }}>Voltar ao início</Link>
      </div>
    </main>
  );
}
