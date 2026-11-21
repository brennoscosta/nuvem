// Imagem de compartilhamento da loja (WE-11, 21/11/2026): a fachada da loja numa imagem estática de 1200 × 630, para a
// prévia do link no WhatsApp, Instagram e Google (og:image de workend.online/<slug>). Nunca a cena 3D: a arte do prédio
// da loja (public/workend/predios/<prédio>.webp) num fundo noturno com o brilho na cor da marca, como o topo das páginas
// (.pg-topo), o balão com a logomarca e o nome por cima, como no painel (.pn-balao), e a logomarca do WorkEnd.
// Quiosque ganha um quiosque desenhado (não tem prédio). Fica guardada em memória por versão (nome, cor, prédio, logo e
// endereço: enderecoLoja.ts › versaoFachada) e sai em JPEG, leve para a prévia do WhatsApp.
import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { lojaPublica } from "@/server/equipeCliente";
import { logoDoTerreno } from "@/server/terrenos";
import { enderecoDaLoja, versaoFachada } from "@/server/enderecoLoja";
import { SEDE_POR_NUMERO } from "@/office/data/sedes";
import { QUIOSQUE_POR_NUMERO } from "@/office/data/quiosques";
import { MODELO } from "@/office/data/modelos";
import { rotuloLoja } from "@/office/data/numeroLoja";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ numero: string }> };
const W = 1200, H = 630;
const NOITE = "#161C25";

declare global { var __weFachadas: Map<string, { img: Buffer; tipo: string }> | undefined }
const guardadas = (globalThis.__weFachadas ??= new Map());
const publico = (...p: string[]) => path.join(process.cwd(), "public", ...p);
let fontes: { name: string; data: Buffer; weight: 600 | 700; style: "normal" }[] | null = null;
const lerFontes = () => (fontes ??= [
  { name: "Inter", data: fs.readFileSync(publico("fonts", "inter-600.woff")), weight: 600, style: "normal" },
  { name: "Inter", data: fs.readFileSync(publico("fonts", "inter-700.woff")), weight: 700, style: "normal" },
]);

async function sharpDe() { try { return (await import("sharp")).default; } catch { return null; } }
// imagem → PNG em data URI, no tamanho em que entra na arte (o satori não lê WebP)
async function paraPng(dados: Buffer, lado: number, quadrado = false): Promise<string | null> {
  const sharp = await sharpDe(); if (!sharp) return null;
  try {
    const b = await sharp(dados, { density: 300 }).resize(quadrado ? { width: lado, height: lado, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } } : { width: lado, height: lado, fit: "inside" }).png().toBuffer();
    return `data:image/png;base64,${b.toString("base64")}`;
  } catch { return null; }
}
const lerPublico = (rel: string) => { try { return fs.readFileSync(publico(...rel.replace(/^\/+/, "").split("/"))); } catch { return null; } };
const resumo = (t: string, max: number) => { const s = t.replace(/\s+/g, " ").trim(); return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s; };
const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
const tamanhoNome = (n: string) => (n.length <= 14 ? 78 : n.length <= 22 ? 66 : n.length <= 32 ? 54 : 46);

export async function GET(_req: Request, { params }: Ctx) {
  const { numero } = await params;
  const n = Number(numero) | 0;
  const l = await lojaPublica(n).catch(() => null);
  if (!l) return Response.redirect(new URL("/workend/marca/og-workend.jpg", "https://workend.online"), 302);
  const slug = await enderecoDaLoja(l).catch(() => null);
  const chave = `${l.numero}:${versaoFachada({ ...l, slug })}`;
  const ja = guardadas.get(chave);
  if (ja) return resposta(ja);
  try {
    const feita = await desenhar(l, slug);
    guardadas.set(chave, feita);
    if (guardadas.size > 300) guardadas.delete(guardadas.keys().next().value!);
    return resposta(feita);
  } catch (e) {
    console.error("[fachada]", (e as Error).message);
    return Response.redirect(new URL("/workend/marca/og-workend.jpg", "https://workend.online"), 302);
  }
}
function resposta(f: { img: Buffer; tipo: string }) {
  return new Response(new Uint8Array(f.img), { headers: { "content-type": f.tipo, "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } });
}

type Loja = NonNullable<Awaited<ReturnType<typeof lojaPublica>>>;
async function desenhar(l: Loja, slug: string | null): Promise<{ img: Buffer; tipo: string }> {
  const sede = SEDE_POR_NUMERO[l.numero] ?? null;
  const quiosque = QUIOSQUE_POR_NUMERO[l.numero] ?? null;
  const cor = /^#[0-9a-fA-F]{6}$/.test(sede?.cor ?? l.cor) ? (sede?.cor ?? l.cor) : "#0A6CFF";
  // o prédio: o da sede vem do modelo dela; o da loja, do escritório (o mesmo desenho do painel Meu escritório)
  const predioId = sede?.modelo ? MODELO[sede.modelo].base : l.predio ?? "moderno";
  const arte = quiosque ? null : lerPublico(`workend/predios/${predioId}.webp`) ?? lerPublico("workend/predios/moderno.webp");
  const predio = arte ? await paraPng(arte, 500) : null;
  const logoBruta = sede ? lerPublico(sede.icone) : l.temLogo ? (await logoDoTerreno(l.chave).catch(() => null))?.dados ?? null : null;
  const logo = logoBruta ? await paraPng(logoBruta, 112, true) : null;
  const marcaWE = await paraPng(lerPublico("workend/marca/workend-logotipo-branco.svg") ?? Buffer.from(""), 210);
  const nome = resumo(l.nome, 44);
  const rotulo = sede ? `Sede · ${sede.tipo.charAt(0).toUpperCase()}${sede.tipo.slice(1)}` : `${rotuloLoja(l.numero)} · ${l.nicho}`;
  const texto = resumo(l.sobre || (sede ? sede.resumo : `${l.atendente ? `${l.atendente.nome} atende na hora. ` : ""}Veja a vitrine, os cupons e fale direto com a loja.`), 118);
  const endereco = `workend.online/${slug ?? `loja/${l.numero}`}`;
  const letra = l.nome.slice(0, 1).toUpperCase();

  const balao = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 20, padding: "10px 22px 10px 10px", boxShadow: "0 22px 44px -16px rgba(0,0,0,.7)", maxWidth: 470 }}>
      {logo ? <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 14 }} />
        : <div style={{ width: 56, height: 56, borderRadius: 14, background: cor, color: "#fff", fontSize: 30, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{letra}</div>}
      <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: "#1D2128", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 370 }}>{resumo(l.nome, 26)}</div>
    </div>
  );

  const img = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: NOITE, fontFamily: "Inter", overflow: "hidden" }}>
        {/* brilho na cor da marca, no alto à direita, e o chão da rua */}
        <div style={{ position: "absolute", right: -260, top: -380, width: 1100, height: 1100, borderRadius: 550, background: `radial-gradient(circle, ${rgba(cor, 0.55)} 0%, ${rgba(cor, 0.18)} 38%, ${rgba(cor, 0)} 66%)` }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "linear-gradient(180deg, rgba(22,28,37,0) 0%, rgba(10,13,18,.75) 100%)" }} />
        <div style={{ position: "absolute", right: 40, bottom: 34, width: 560, height: 64, borderRadius: 280, background: "radial-gradient(ellipse, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 70%)" }} />

        {/* a fachada: o prédio da loja, ou o quiosque desenhado */}
        {predio ? <img src={predio} alt="" width={500} height={500} style={{ position: "absolute", right: 70, bottom: 44 }} /> : (
          <div style={{ position: "absolute", right: 110, bottom: 62, width: 420, height: 330, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 420, height: 78, display: "flex", borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden", boxShadow: "0 16px 30px -12px rgba(0,0,0,.6)" }}>
              {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ flex: 1, background: i % 2 ? "#F2F5F8" : cor }} />)}
            </div>
            <div style={{ width: 360, height: 130, display: "flex", justifyContent: "space-between" }}>
              <div style={{ width: 12, height: 130, background: "#A9B4C2" }} /><div style={{ width: 12, height: 130, background: "#A9B4C2" }} />
            </div>
            <div style={{ width: 400, height: 122, borderRadius: 16, background: "#D6DDE6", display: "flex", alignItems: "flex-end", justifyContent: "center", boxShadow: "0 18px 34px -14px rgba(0,0,0,.65)" }}>
              <div style={{ width: 400, height: 22, background: cor, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }} />
            </div>
          </div>
        )}
        {/* o balão da loja por cima da fachada, preso por um fio */}
        <div style={{ position: "absolute", left: 640, right: 60, top: quiosque ? 130 : 78, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {balao}
          <div style={{ width: 3, height: quiosque ? 40 : 34, background: "rgba(255,255,255,.55)" }} />
        </div>

        {/* o texto, à esquerda */}
        <div style={{ position: "absolute", left: 72, top: 62, bottom: 60, width: 560, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {marcaWE ? <img src={marcaWE} alt="WorkEnd" width={196} height={37} /> : <div style={{ display: "flex", color: "#fff", fontSize: 34, fontWeight: 700 }}>WorkEnd</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "rgba(255,255,255,.62)", fontSize: 24, fontWeight: 600 }}>{rotulo}</div>
            <div style={{ display: "flex", color: "#fff", fontSize: tamanhoNome(nome), fontWeight: 700, lineHeight: 1.04, marginTop: 14, letterSpacing: -1.5 }}>{nome}</div>
            <div style={{ display: "flex", color: "rgba(255,255,255,.78)", fontSize: 25, fontWeight: 600, lineHeight: 1.38, marginTop: 20 }}>{texto}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, alignSelf: "flex-start", borderRadius: 999, padding: "10px 20px", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#3DDC84" }} />
            <div style={{ display: "flex", color: "#fff", fontSize: 24, fontWeight: 600 }}>{endereco}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: lerFontes() },
  );
  const png = Buffer.from(await img.arrayBuffer());
  const sharp = await sharpDe();
  if (!sharp) return { img: png, tipo: "image/png" };
  return { img: await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer(), tipo: "image/jpeg" };
}
