"use client";
// Aviso depois de excluir a conta (21/11/2026, LGPD): a exclusão manda para "/?conta=excluida" e aqui aparece o aviso; o
// parâmetro sai do endereço (recarregar não mostra de novo). Fica no layout do WorkEnd para não mexer na página inicial.
import { useEffect, useState } from "react";

export function AvisoContaExcluida() {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("conta") !== "excluida") return;
    u.searchParams.delete("conta");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    const t = setTimeout(() => setVer(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ver) return null;
  return (
    <div role="status" data-aviso="conta-excluida" style={{ position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 1000, width: "min(560px, calc(100% - 32px))", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px 14px 18px", borderRadius: 14, background: "var(--night)", color: "#fff", boxShadow: "0 18px 40px -18px rgba(0,0,0,.6)", fontSize: 15, lineHeight: 1.4 }}>
      <span style={{ flex: 1, minWidth: 0 }}><b>Sua conta foi excluída.</b> Os seus dados pessoais foram apagados do WorkEnd.</span>
      <button type="button" className="btn" onClick={() => setVer(false)} style={{ padding: ".55rem .85rem", background: "rgba(255,255,255,.14)", color: "#fff" }}>Fechar</button>
    </div>
  );
}
