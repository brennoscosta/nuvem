// Desenho dos itens pagos e da casa no telão da Praça de Eventos (20/11/2026). Só canvas 2D (sem three): o mesmo desenho
// vai para a textura do telão na cena 3D, para a prévia em /app/divulgar e para a fila do admin.
import { CASA, type Casa, type Patrocinio } from "./data/telao";
import { PRECO_BARRACA } from "./data/praca";
const PRECO_BARRACA_TEXTO = `R$ ${PRECO_BARRACA.toFixed(2).replace(".", ",")}`;

const F = (tam: number, peso = 800) => `${peso} ${Math.round(tam)}px Inter, Arial, sans-serif`;
const TZ = { timeZone: "America/Sao_Paulo" } as const;
export function caber(g: CanvasRenderingContext2D, texto: string, max: number, tam: number, peso = 900, min = 28) {
  g.font = F(tam, peso);
  while (g.measureText(texto).width > max && tam > min) { tam -= 4; g.font = F(tam, peso); }
  return tam;
}
export function quebrar(g: CanvasRenderingContext2D, texto: string, larg: number, max = 2) {
  const linhas: string[] = []; let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) { const t = atual ? `${atual} ${p}` : p; if (g.measureText(t).width > larg && atual) { linhas.push(atual); atual = p; } else atual = t; }
  if (atual) linhas.push(atual);
  if (linhas.length > max) { linhas.length = max; linhas[max - 1] = linhas[max - 1].replace(/\s*\S*$/, "…"); }
  return linhas;
}
export function cobrir(g: CanvasRenderingContext2D, im: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const iw = (im as HTMLVideoElement).videoWidth || (im as HTMLImageElement).naturalWidth || im.width, ih = (im as HTMLVideoElement).videoHeight || (im as HTMLImageElement).naturalHeight || im.height;
  if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
  g.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
// imagens (logos e anúncios): carregam uma vez; quando chegam, quem pediu redesenha
const CACHE = new Map<string, HTMLImageElement>();
export function imagemPronta(url: string | null | undefined, aoCarregar?: () => void): HTMLImageElement | null {
  if (!url || typeof Image === "undefined") return null;
  let im = CACHE.get(url);
  if (!im) { im = new Image(); im.onload = () => aoCarregar?.(); im.src = url; CACHE.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}
function fundo(g: CanvasRenderingContext2D, W: number, H: number, cor: string) {
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#0B1220"); gr.addColorStop(1, cor); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const luz = g.createRadialGradient(W * 0.82, -40, 10, W * 0.82, -40, W * 0.55); luz.addColorStop(0, "rgba(255,255,255,.26)"); luz.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = luz; g.fillRect(0, 0, W, H);
}
function marca(g: CanvasRenderingContext2D, x: number, y: number, lado: number, cor: string, nome: string, logo: HTMLImageElement | null) {
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(x, y, lado, lado, lado * 0.16); g.fill();
  if (logo) { const k = Math.min((lado * 0.84) / logo.naturalWidth, (lado * 0.84) / logo.naturalHeight); g.drawImage(logo, x + lado / 2 - (logo.naturalWidth * k) / 2, y + lado / 2 - (logo.naturalHeight * k) / 2, logo.naturalWidth * k, logo.naturalHeight * k); }
  else { g.fillStyle = cor; g.font = F(lado * 0.42, 900); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(nome.trim().slice(0, 2).toUpperCase(), x + lado / 2, y + lado / 2 + 2); g.textAlign = "left"; }
}
function etiqueta(g: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, fundoCor: string, cor: string, direita = false) {
  g.font = F(tam, 800); const w = g.measureText(texto).width + tam * 1.2, h = tam * 1.7, x0 = direita ? x - w : x;
  g.fillStyle = fundoCor; g.beginPath(); g.roundRect(x0, y, w, h, h / 2); g.fill();
  g.fillStyle = cor; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(texto, x0 + tam * 0.6, y + h / 2 + 1);
}
export function rodapeTelao(g: CanvasRenderingContext2D, W: number, H: number, texto: string, alto = 92) {
  g.fillStyle = "rgba(0,0,0,.38)"; g.fillRect(0, H - alto, W, alto);
  g.fillStyle = "#FFD24A"; g.font = F(alto * 0.37, 800); g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(texto, 60, H - alto / 2, W - 120);
}

export interface DadosAnuncio { nome: string; cor: string; frase: string; numero: number | null; formato: string; titulo?: string }
// anúncio pago: imagem (cobre o telão, com uma faixa com o nome) ou modelo pronto (logo, nome e frase na cor da marca)
export function desenharAnuncio(g: CanvasRenderingContext2D, W: number, H: number, d: DadosAnuncio, logo: HTMLImageElement | null, imagem: HTMLImageElement | null) {
  g.textBaseline = "alphabetic"; g.textAlign = "left";
  if (d.formato === "imagem" && imagem) {
    g.fillStyle = "#0B1220"; g.fillRect(0, 0, W, H); cobrir(g, imagem, 0, 0, W, H);
    const v = g.createLinearGradient(0, H * 0.62, 0, H); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.72)"); g.fillStyle = v; g.fillRect(0, H * 0.62, W, H * 0.38);
    g.fillStyle = "#FFFFFF"; caber(g, d.nome, W * 0.6, H * 0.075, 800, 20); g.textBaseline = "middle"; g.fillText(d.nome, W * 0.05, H * 0.9);
    if (d.numero) { g.font = F(H * 0.045, 700); g.fillStyle = "rgba(255,255,255,.85)"; g.textAlign = "right"; g.fillText(`workend.online/loja/${d.numero}`, W * 0.95, H * 0.9); g.textAlign = "left"; }
  } else {
    fundo(g, W, H, d.cor);
    const L = H * 0.36; marca(g, W * 0.06, H * 0.2, L, d.cor, d.nome, logo);
    const x = W * 0.06 + L + W * 0.045, larg = W - x - W * 0.06;
    g.fillStyle = "#FFFFFF"; const tam = caber(g, d.nome, larg, H * 0.15, 900, 26); g.textBaseline = "alphabetic"; g.fillText(d.nome, x, H * 0.2 + tam * 0.95, larg);
    g.font = F(H * 0.062, 600); g.fillStyle = "rgba(255,255,255,.9)";
    quebrar(g, d.frase || "Visite a nossa loja no WorkEnd", larg, 3).forEach((l, i) => g.fillText(l, x, H * 0.2 + tam * 0.95 + H * 0.1 + i * H * 0.078));
    g.font = F(H * 0.048, 700); g.fillStyle = "rgba(255,255,255,.75)";
    g.fillText(d.numero ? `workend.online/loja/${d.numero} · clique no balão da loja` : "procure a loja no mapa", W * 0.06, H * 0.76, W * 0.88);
  }
  etiqueta(g, "Publicidade", W - W * 0.04, H * 0.05, H * 0.032, "rgba(0,0,0,.45)", "rgba(255,255,255,.9)", true);
}

const hhmm = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { ...TZ, hour: "2-digit", minute: "2-digit" });
const dia = (s: string) => new Date(s).toLocaleDateString("pt-BR", { ...TZ, weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
// evento em destaque (pago): chamada grande com dia e hora; ao vivo, a faixa vermelha
export function desenharEventoDestaque(g: CanvasRenderingContext2D, W: number, H: number, d: { titulo: string; nome: string; cor: string; frase: string; inicio: string; fim: string }, logo: HTMLImageElement | null, agora = Date.now()) {
  fundo(g, W, H, d.cor);
  const vivo = new Date(d.inicio).getTime() <= agora && new Date(d.fim).getTime() > agora;
  g.textAlign = "left";
  if (vivo) etiqueta(g, "AO VIVO AGORA NA PRAÇA", W * 0.06, H * 0.1, H * 0.052, "#E11D48", "#FFFFFF");
  else etiqueta(g, "EVENTO EM DESTAQUE", W * 0.06, H * 0.1, H * 0.052, "#F59E0B", "#3B2A00");
  let x = W * 0.06; if (logo) { marca(g, x, H * 0.3, H * 0.27, d.cor, d.nome, logo); x += H * 0.27 + W * 0.035; }
  g.fillStyle = "#FFFFFF"; const tam = caber(g, d.titulo, W - x - W * 0.06, H * 0.13, 900, 26); g.textBaseline = "alphabetic"; g.fillText(d.titulo, x, H * 0.3 + tam, W - x - W * 0.06);
  g.font = F(H * 0.065, 600); g.fillStyle = "rgba(255,255,255,.88)"; g.fillText(`por ${d.nome}`, x, H * 0.3 + tam + H * 0.1, W - x - W * 0.06);
  g.font = F(H * 0.06, 800); g.fillStyle = "#FFD24A"; g.fillText(vivo ? `até as ${hhmm(d.fim)} · clique na praça para assistir` : `${dia(d.inicio)} · ${hhmm(d.inicio)} às ${hhmm(d.fim)}`, W * 0.06, H * 0.72, W * 0.88);
  if (d.frase) { g.font = F(H * 0.05, 500); g.fillStyle = "rgba(255,255,255,.78)"; g.fillText(d.frase, W * 0.06, H * 0.8, W * 0.88); }
}

// patrocínio da praça: no Natal (1º/12 a 6/1) vira "Natal na Praça, oferecimento ..."
export function desenharPatrocinio(g: CanvasRenderingContext2D, W: number, H: number, p: Patrocinio, logo: HTMLImageElement | null, natal: boolean) {
  if (natal) {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#7F1D1D"); gr.addColorStop(1, "#14532D"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + ((i * 37) % 10) / 30})`; g.beginPath(); g.arc((i * 97) % W, (i * 53) % (H * 0.7), 2 + (i % 3), 0, Math.PI * 2); g.fill(); }
  } else fundo(g, W, H, p.cor);
  g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#FFFFFF";
  caber(g, natal ? "Natal na Praça" : "Praça de Eventos", W * 0.86, H * 0.13, 900, 30); g.fillText(natal ? "Natal na Praça" : "Praça de Eventos", W / 2, H * 0.22);
  g.font = F(H * 0.05, 700); g.fillStyle = "rgba(255,255,255,.82)"; g.fillText(natal ? "um oferecimento de" : "com o patrocínio de", W / 2, H * 0.33);
  const L = H * 0.24; marca(g, W / 2 - L / 2, H * 0.38, L, p.cor, p.nome, logo);
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; caber(g, p.nome, W * 0.86, H * 0.1, 900, 24); g.textBaseline = "alphabetic"; g.fillText(p.nome, W / 2, H * 0.76, W * 0.86);
  if (p.frase) { g.font = F(H * 0.048, 500); g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(p.frase, W / 2, H * 0.84, W * 0.86); }
  g.textAlign = "left";
}

// propaganda do próprio WorkEnd
export function desenharCasa(g: CanvasRenderingContext2D, W: number, H: number, c: Casa) {
  fundo(g, W, H, c.cor);
  g.strokeStyle = "rgba(91,157,255,.14)"; g.lineWidth = 2; for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.textAlign = "left"; etiqueta(g, c.rotulo, W * 0.06, H * 0.1, H * 0.045, "rgba(255,255,255,.16)", "#FFFFFF");
  g.fillStyle = "#FFFFFF"; const tam = caber(g, c.titulo, W * 0.88, H * 0.14, 900, 28); g.textBaseline = "alphabetic"; g.fillText(c.titulo, W * 0.06, H * 0.3 + tam);
  g.font = F(H * 0.062, 600); g.fillStyle = "rgba(255,255,255,.88)"; quebrar(g, c.sub, W * 0.88, 2).forEach((l, i) => g.fillText(l, W * 0.06, H * 0.3 + tam + H * 0.11 + i * H * 0.08));
  g.font = F(H * 0.058, 800); g.fillStyle = "#5B9DFF"; g.fillText(c.chamada, W * 0.06, H * 0.76, W * 0.88);
}
export const casaPorId = (id: string) => CASA.find((c) => c.id === id) ?? CASA[0];

// chamada da feira de sábado
export function desenharFeira(g: CanvasRenderingContext2D, W: number, H: number, d: { dia: string; pagas: number; aberta: boolean }) {
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#78350F"); gr.addColorStop(1, "#B45309"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,.9)" : "#E2575B"; g.fillRect((i * W) / 12, 0, W / 12, H * 0.08); }
  g.textAlign = "left"; g.fillStyle = "#FFFFFF"; g.textBaseline = "alphabetic";
  caber(g, d.aberta ? "Feira aberta agora" : "Feira de sábado", W * 0.88, H * 0.14, 900, 28); g.fillText(d.aberta ? "Feira aberta agora" : "Feira de sábado", W * 0.06, H * 0.36);
  const [, m, dd] = d.dia.split("-");
  g.font = F(H * 0.07, 700); g.fillStyle = "rgba(255,255,255,.92)"; g.fillText(d.aberta ? `${d.pagas} barraca${d.pagas === 1 ? "" : "s"} na praça, até as 18h` : `Sábado, ${dd}/${m}, das 8h às 18h, aqui na praça`, W * 0.06, H * 0.5, W * 0.88);
  g.font = F(H * 0.062, 800); g.fillStyle = "#FFE7A3"; g.fillText(`Ainda sem lote? Barraca por ${PRECO_BARRACA_TEXTO}: clique na praça`, W * 0.06, H * 0.66, W * 0.88);
}

// placa física da praça (totem na entrada): o nome do patrocinador, ou a vaga à venda
export function desenharPlaca(g: CanvasRenderingContext2D, W: number, H: number, p: Patrocinio | null, logo: HTMLImageElement | null, preco: string) {
  g.fillStyle = "#F7F4EE"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#0F766E"; g.fillRect(0, 0, W, H * 0.34);
  g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle"; caber(g, "PRAÇA DE EVENTOS", W * 0.9, H * 0.2, 900, 18); g.fillText("PRAÇA DE EVENTOS", W / 2, H * 0.18);
  if (p) {
    g.fillStyle = "#5B6472"; g.font = F(H * 0.09, 700); g.fillText("patrocínio", W / 2, H * 0.44);
    const L = H * 0.4; marca(g, W * 0.06, H * 0.52, L, p.cor, p.nome, logo);
    g.fillStyle = "#1D2128"; g.textAlign = "left"; caber(g, p.nome, W * 0.88 - L - W * 0.04, H * 0.17, 900, 16); g.fillText(p.nome, W * 0.06 + L + W * 0.04, H * 0.72, W * 0.88 - L - W * 0.04);
  } else {
    g.fillStyle = "#1D2128"; caber(g, "Patrocine esta praça", W * 0.9, H * 0.14, 900, 16); g.fillText("Patrocine esta praça", W / 2, H * 0.54);
    g.fillStyle = "#5B6472"; g.font = F(H * 0.085, 700); g.fillText(`${preco} por 30 dias · Painel da loja → Divulgar`, W / 2, H * 0.76, W * 0.9);
  }
  g.textAlign = "left";
}
