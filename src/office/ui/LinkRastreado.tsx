"use client";
// Link de contato que conta no painel de resultados do dono (12/11/2026): WhatsApp, Instagram, site, e-mail ou produto.
// sendBeacon não segura a navegação; se falhar, o clique segue normal.
import type { AnchorHTMLAttributes } from "react";
export type TipoClique = "whatsapp" | "instagram" | "site" | "email" | "produto";
export function avisarClique(numero: number, tipo: TipoClique, ref?: string | null) {
  try { navigator.sendBeacon?.("/api/workend/clique", JSON.stringify({ numero, tipo, ref: ref ?? null })); } catch { /* sem beacon, sem contagem */ }
  // a cena escuta: pedido pelo WhatsApp (produto ou contato) faz sair um motoboy da loja (12/11/2026)
  if (tipo === "produto" || tipo === "whatsapp") try { window.dispatchEvent(new CustomEvent("workend:pedido", { detail: { numero, tipo } })); } catch { /* sem eventos */ }
}
export function LinkRastreado({ numero, tipo, refItem, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { numero: number; tipo: TipoClique; refItem?: string }) {
  return <a {...props} onClick={(e) => { avisarClique(numero, tipo, refItem); props.onClick?.(e); }} />;
}
