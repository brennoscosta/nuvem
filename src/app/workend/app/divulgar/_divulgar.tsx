"use client";
// Desenha o material no navegador (canvas) e baixa em PNG: Stories 1080×1920 e adesivo quadrado de 15 cm (1772 px, 300 dpi).
import { useEffect, useRef, useState } from "react";
import { gerarQR, desenharQR } from "@/lib/qr";

export type DadosDivulgar = { numero: number; empresa: string; cor: string; nicho: string; logo: string | null; predio: string; promo: string | null; link: string; endereco: string };

const carregar = (src: string | null) => new Promise<HTMLImageElement | null>((ok) => { if (!src) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
function quebrar(g: CanvasRenderingContext2D, texto: string, larg: number, max = 2) {
  const palavras = texto.split(/\s+/), linhas: string[] = []; let atual = "";
  for (const p of palavras) { const t = atual ? `${atual} ${p}` : p; if (g.measureText(t).width > larg && atual) { linhas.push(atual); atual = p; } else atual = t; }
  if (atual) linhas.push(atual);
  if (linhas.length > max) { linhas.length = max; linhas[max - 1] = linhas[max - 1].replace(/\s*\S*$/, "…"); }
  return linhas;
}
function retanguloRedondo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function cobrir(g: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / k, sh = h / k;
  g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
function logoQuadrado(g: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, lado: number, cor: string, empresa: string) {
  g.save(); g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 24; g.fillStyle = "#FFFFFF"; retanguloRedondo(g, x, y, lado, lado, lado * 0.22); g.fill(); g.restore();
  if (logo) { const k = Math.min((lado * 0.8) / logo.naturalWidth, (lado * 0.8) / logo.naturalHeight); g.drawImage(logo, x + lado / 2 - (logo.naturalWidth * k) / 2, y + lado / 2 - (logo.naturalHeight * k) / 2, logo.naturalWidth * k, logo.naturalHeight * k); }
  else { g.fillStyle = cor; g.font = `900 ${lado * 0.42}px Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(empresa.slice(0, 2).toUpperCase(), x + lado / 2, y + lado / 2 + 4); }
}

// Sem foto do dono (13/11/2026): a foto de catálogo do tipo de prédio tem a placa "Sua marca aqui", que não serve para
// divulgar. No lugar: cor da marca em degradê, silhueta de cidade embaixo e a logo grande no meio.
function fundoSemFoto(g: CanvasRenderingContext2D, d: DadosDivulgar, logo: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
  const dg = g.createLinearGradient(x, y, x, y + h); dg.addColorStop(0, d.cor); dg.addColorStop(1, "#0E1420"); g.fillStyle = dg; g.fillRect(x, y, w, h);
  // prédios em silhueta (alturas fixas pela posição, sem sorteio: a imagem sai igual toda vez)
  g.fillStyle = "rgba(255,255,255,.10)"; let px = x;
  for (let i = 0; px < x + w; i++) { const lw = 60 + ((i * 37) % 70), lh = 120 + ((i * 53) % 230); g.fillRect(px, y + h - lh, lw - 8, lh); px += lw; }
  g.fillStyle = "rgba(255,255,255,.18)"; px = x + 30;
  for (let i = 0; px < x + w; i++) { const lw = 80 + ((i * 29) % 60), lh = 70 + ((i * 41) % 150); g.fillRect(px, y + h - lh, lw - 10, lh); px += lw + 20; }
  logoQuadrado(g, logo, x + w / 2 - 150, y + h / 2 - 190, 300, d.cor, d.empresa);
}
function desenharStories(c: HTMLCanvasElement, d: DadosDivulgar, predio: HTMLImageElement | null, logo: HTMLImageElement | null, qr: boolean[][]) {
  const g = c.getContext("2d")!; const W = 1080, H = 1920; c.width = W; c.height = H;
  const fundo = g.createLinearGradient(0, 0, 0, H); fundo.addColorStop(0, d.cor); fundo.addColorStop(0.55, "#121826"); fundo.addColorStop(1, "#0B0F18"); g.fillStyle = fundo; g.fillRect(0, 0, W, H);
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#FFFFFF"; g.font = "300 54px Inter, Arial, sans-serif"; g.fillText("Work", 80, 140); const lw = g.measureText("Work").width; g.font = "800 54px Inter, Arial, sans-serif"; g.fillText("End", 80 + lw, 140);
  g.font = "500 30px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.75)"; g.fillText("A cidade 3D das empresas", 80, 186);
  // o prédio, num cartão com sombra
  g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 50; g.shadowOffsetY = 20; g.fillStyle = "#1D2128"; retanguloRedondo(g, 80, 250, W - 160, 640, 44); g.fill(); g.restore();
  g.save(); retanguloRedondo(g, 80, 250, W - 160, 640, 44); g.clip(); if (predio) cobrir(g, predio, 80, 250, W - 160, 640); else fundoSemFoto(g, d, logo, 80, 250, W - 160, 640); const vel = g.createLinearGradient(0, 700, 0, 890); vel.addColorStop(0, "rgba(0,0,0,0)"); vel.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = vel; g.fillRect(80, 700, W - 160, 190); g.restore();
  if (predio) logoQuadrado(g, logo, 120, 800, 180, d.cor, d.empresa); // sem foto, a logo já está grande no quadro
  g.fillStyle = "#FFFFFF"; g.font = "900 92px Inter, Arial, sans-serif";
  const linhas = quebrar(g, d.empresa, W - 160); linhas.forEach((l, i) => g.fillText(l, 80, 1100 + i * 100));
  let y = 1100 + linhas.length * 100 - 30;
  g.font = "600 40px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(`${d.nicho} · Lote ${d.numero}`, 80, y + 20); y += 40;
  if (d.promo) { g.font = "900 44px Inter, Arial, sans-serif"; const tw = g.measureText(`🏷️ ${d.promo}`).width + 64; g.fillStyle = "#E11D48"; retanguloRedondo(g, 80, y + 26, tw, 80, 40); g.fill(); g.fillStyle = "#FFFFFF"; g.fillText(`🏷️ ${d.promo}`, 112, y + 82); }
  // QR num cartão branco embaixo
  const qy = 1440; g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 40; g.fillStyle = "#FFFFFF"; retanguloRedondo(g, 80, qy, W - 160, 380, 40); g.fill(); g.restore();
  desenharQR(g, qr, 110, qy + 30, 320);
  g.fillStyle = "#1D2128"; g.font = "800 44px Inter, Arial, sans-serif"; g.fillText("Visite a nossa loja", 470, qy + 120);
  g.font = "500 32px Inter, Arial, sans-serif"; g.fillStyle = "#5B6472"; g.fillText("Aponte a câmera do celular", 470, qy + 172);
  g.font = "700 34px Inter, Arial, sans-serif"; g.fillStyle = d.cor; g.fillText(d.endereco, 470, qy + 250, W - 160 - 410);
}

function desenharAdesivo(c: HTMLCanvasElement, d: DadosDivulgar, logo: HTMLImageElement | null, qr: boolean[][]) {
  const g = c.getContext("2d")!; const L = 1772; c.width = L; c.height = L; // 15 cm × 15 cm a 300 dpi
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, L, L);
  g.fillStyle = d.cor; retanguloRedondo(g, 0, 0, L, 360, 0); g.fill();
  g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#FFFFFF";
  g.font = "900 120px Inter, Arial, sans-serif"; g.fillText("Estamos no WorkEnd", L / 2, 210, L - 160);
  g.font = "500 54px Inter, Arial, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText("a cidade 3D das empresas", L / 2, 296);
  logoQuadrado(g, logo, 120, 450, 220, d.cor, d.empresa);
  g.textAlign = "left"; g.fillStyle = "#1D2128"; g.font = "900 100px Inter, Arial, sans-serif"; quebrar(g, d.empresa, L - 520, 1).forEach((l) => g.fillText(l, 390, 560, L - 520));
  g.font = "600 56px Inter, Arial, sans-serif"; g.fillStyle = "#5B6472"; g.fillText(`${d.nicho} · Lote ${d.numero}`, 390, 640, L - 520);
  desenharQR(g, qr, (L - 860) / 2, 740, 860);
  g.textAlign = "center"; g.fillStyle = "#1D2128"; g.font = "700 64px Inter, Arial, sans-serif"; g.fillText("Aponte a câmera do celular", L / 2, 1680, L - 160);
  g.font = "700 56px Inter, Arial, sans-serif"; g.fillStyle = d.cor; g.fillText(d.endereco, L / 2, 1748 - 8, L - 160);
}

function baixar(c: HTMLCanvasElement | null, nome: string) {
  if (!c) return;
  c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
}

export function Divulgar({ dados }: { dados: DadosDivulgar }) {
  const stories = useRef<HTMLCanvasElement>(null), adesivo = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [foto, setFoto] = useState<string | null>(null); // foto escolhida pelo dono (endereço local do arquivo)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [predio, logo] = await Promise.all([carregar(foto), carregar(dados.logo)]);
      try { await document.fonts.ready; } catch { /* sem fontes: usa a do sistema */ }
      if (!vivo) return;
      const qr = gerarQR(dados.link);
      if (stories.current) desenharStories(stories.current, dados, predio, logo, qr);
      if (adesivo.current) desenharAdesivo(adesivo.current, dados, logo, qr);
      setPronto(true);
    })();
    return () => { vivo = false; };
  }, [dados, foto]);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto); }, [foto]);
  const nomeArq = dados.empresa.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loja";
  const copiar = async () => { try { await navigator.clipboard.writeText(dados.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie o link da sua loja:", dados.link); } };
  return (
    <section className="faixa mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-[var(--linha)] p-5">
        <h2 className="!text-[1.3rem]">Imagem para Stories</h2>
        <p className="mt-1 text-[14px] text-[var(--tinta-2)]">1080 × 1920, para Instagram e WhatsApp.</p>
        <canvas ref={stories} className="mx-auto mt-4 block h-auto w-full max-w-[300px] rounded-2xl shadow-lg" aria-label={`Imagem para Stories da ${dados.empresa}`} />
        <label className="btn btn-claro mt-4 w-full cursor-pointer !py-2.5 text-center">
          {foto ? "Trocar a foto" : "Usar a foto do meu prédio"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; if (a) setFoto(URL.createObjectURL(a)); e.target.value = ""; }} />
        </label>
        <p className="mt-1.5 text-[13px] text-[var(--tinta-2)]">Dica: no mapa, abra o cartão da sua loja e toque em “📸 Foto do meu prédio”. A foto sai com o seu nome na placa; depois é só escolher aqui. Também vale uma foto de verdade da loja.</p>
        <button type="button" onClick={() => baixar(stories.current, `${nomeArq}-stories.png`)} disabled={!pronto} className="btn btn-azul mt-3 w-full !py-2.5 disabled:opacity-50">Baixar imagem para Stories</button>
      </div>
      <div className="rounded-2xl border border-[var(--linha)] p-5">
        <h2 className="!text-[1.3rem]">Adesivo para a loja</h2>
        <p className="mt-1 text-[14px] text-[var(--tinta-2)]">Quadrado de 15 cm, pronto para imprimir (300 dpi). Cole no balcão, na vitrine ou na porta.</p>
        <canvas ref={adesivo} className="mx-auto mt-4 block h-auto w-full max-w-[300px] rounded-xl border border-[var(--linha)]" aria-label={`Adesivo Estamos no WorkEnd da ${dados.empresa}`} />
        <button type="button" onClick={() => baixar(adesivo.current, `${nomeArq}-adesivo-15cm.png`)} disabled={!pronto} className="btn btn-tinta mt-4 w-full !py-2.5 disabled:opacity-50">Baixar adesivo (PNG, 15 × 15 cm)</button>
      </div>
      <div className="lg:col-span-2 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--cinza)] px-5 py-4">
        <span className="text-[14px] text-[var(--tinta-2)]">O QR Code leva para</span>
        <code className="min-w-0 max-w-full truncate rounded-lg bg-white px-2 py-1 text-[14px]">{dados.link}</code>
        <button type="button" onClick={copiar} className="btn btn-claro !px-3 !py-1.5 text-sm">{copiado ? "Copiado ✓" : "Copiar link"}</button>
      </div>
    </section>
  );
}
