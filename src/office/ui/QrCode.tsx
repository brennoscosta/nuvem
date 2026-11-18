// QR Code desenhado em SVG a partir do texto (gerador próprio em ../data/qrcode.ts, sem biblioteca). Fundo branco e
// margem clara de 4 módulos, como pede a norma: funciona em tema claro e escuro. O tamanho final é sempre um número inteiro de
// pixels por módulo (perto do pedido): módulo de 2,4 px borra em tela comum e o leitor do celular erra.
import { useMemo } from "react";
import { qrMatriz, qrCaminho } from "../data/qrcode";

export function QrCode({ texto, tamanho = 168, titulo = "QR Code", className = "" }: { texto: string; tamanho?: number; titulo?: string; className?: string }) {
  const q = useMemo(() => { try { return qrCaminho(qrMatriz(texto)); } catch { return null; } }, [texto]);
  if (!q) return null;
  const px = Math.max(2, Math.round(tamanho / q.lado)) * q.lado;
  return (
    <svg viewBox={`0 0 ${q.lado} ${q.lado}`} width={px} height={px} role="img" aria-label={titulo} shapeRendering="crispEdges" className={`block rounded-lg ${className}`}>
      <rect width={q.lado} height={q.lado} fill="#fff" />
      <path d={q.d} fill="#0E1013" />
    </svg>
  );
}
