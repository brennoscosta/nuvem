// Geração de imagens com a OpenAI (gpt-image-2): texto → imagem, ou edição a partir de imagens de referência (logo, foto).
// Sempre 1 imagem por pedido, qualidade alta (decisão do Brenno, 20/10). Custo registrado em uso_ia por agente.
import fs from "node:fs";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { sql, id } from "./db";
import { EMPRESA_PADRAO, registrarUso } from "./agentes";
import { DIR_UPLOADS, type Arquivo } from "./tarefas";

export const MODELO_IMAGEM = process.env.OPENAI_MODELO_IMAGEM || "gpt-image-2";
export type Formato = "quadrado" | "vertical" | "horizontal";
export const FORMATOS: Record<Formato, { size: "1024x1024" | "1024x1536" | "1536x1024"; nome: string }> = {
  quadrado: { size: "1024x1024", nome: "Quadrado (feed)" },
  vertical: { size: "1024x1536", nome: "Vertical (story / reels)" },
  horizontal: { size: "1536x1024", nome: "Horizontal (capa / banner)" },
};
type Qualidade = "low" | "medium" | "high";
// Preço por imagem em R$ (tabela oficial em US$ × ~5,5): high 1024² US$0,211 · retrato/paisagem US$0,165; medium 0,053/0,041; low 0,006/0,005
const PRECO_IMG_BRL: Record<Qualidade, Record<string, number>> = {
  high: { "1024x1024": 1.16, "1024x1536": 0.91, "1536x1024": 0.91 },
  medium: { "1024x1024": 0.29, "1024x1536": 0.23, "1536x1024": 0.23 },
  low: { "1024x1024": 0.033, "1024x1536": 0.028, "1536x1024": 0.028 },
};
export function custoImagemBRL(formato: Formato, qualidade: Qualidade = "high") { return PRECO_IMG_BRL[qualidade][FORMATOS[formato].size] ?? 1.2; }

export async function gerarImagem(d: { agenteId: string; prompt: string; formato: Formato; qualidade?: Qualidade; referencias?: Arquivo[]; nome?: string }): Promise<{ arquivo: Arquivo; custoBrl: number }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no CapRover");
  const cli = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const qualidade = d.qualidade ?? "high";
  const size = FORMATOS[d.formato].size;
  const refs = (d.referencias ?? []).filter((r) => fs.existsSync(r.caminho));
  let b64: string | undefined;
  if (refs.length) {
    // edição: a(s) imagem(ns) de referência entram junto com o prompt
    const imagens = await Promise.all(refs.map((r) => toFile(fs.createReadStream(r.caminho), r.nome, { type: r.mime })));
    const r = await cli.images.edit({ model: MODELO_IMAGEM, image: imagens, prompt: d.prompt, size, quality: qualidade, n: 1, output_format: "png" });
    b64 = r.data?.[0]?.b64_json;
  } else {
    const r = await cli.images.generate({ model: MODELO_IMAGEM, prompt: d.prompt, size, quality: qualidade, n: 1, output_format: "png" });
    b64 = r.data?.[0]?.b64_json;
  }
  if (!b64) throw new Error("A OpenAI não devolveu a imagem.");
  const custoBrl = custoImagemBRL(d.formato, qualidade);
  await registrarUso({ agenteId: d.agenteId, modelo: MODELO_IMAGEM, tokensIn: 0, tokensOut: 0, custoBrl });
  // salva como arquivo da empresa (mesma tabela dos vídeos; servido em /api/arquivos/<id>/raw)
  fs.mkdirSync(DIR_UPLOADS, { recursive: true });
  const aid = id("arq");
  const caminho = path.join(DIR_UPLOADS, aid + ".png");
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(caminho, buf);
  const nome = (d.nome || "arte").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "arte";
  const [arquivo] = await sql<Arquivo[]>`INSERT INTO arquivo (id, empresa_id, nome, mime, tamanho, caminho) VALUES (${aid}, ${EMPRESA_PADRAO.id}, ${nome + ".png"}, ${"image/png"}, ${buf.length}, ${caminho}) RETURNING id, nome, mime, tamanho, caminho, criado_em`;
  return { arquivo, custoBrl };
}
