// Serve o arquivo enviado (público, id impossível de adivinhar). O Instagram busca o vídeo por aqui. Suporta Range.
import fs from "node:fs";
import { obterArquivo } from "@/server/tarefas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const a = await obterArquivo(id);
  if (!a || !fs.existsSync(a.caminho)) return new Response("não encontrado", { status: 404 });
  const total = fs.statSync(a.caminho).size;
  const range = req.headers.get("range");
  let inicio = 0, fim = total - 1, status = 200;
  if (range) { const m = /bytes=(\d*)-(\d*)/.exec(range); if (m) { if (m[1]) inicio = Number(m[1]); if (m[2]) fim = Number(m[2]); if (!m[1] && m[2]) { inicio = Math.max(0, total - Number(m[2])); fim = total - 1; } status = 206; } }
  fim = Math.min(fim, total - 1);
  const stream = fs.createReadStream(a.caminho, { start: inicio, end: fim });
  const body = new ReadableStream({ start(ctl) { stream.on("data", (c) => ctl.enqueue(new Uint8Array(c as Buffer))); stream.on("end", () => ctl.close()); stream.on("error", (e) => ctl.error(e)); }, cancel() { stream.destroy(); } });
  return new Response(body, { status, headers: { "content-type": a.mime, "content-length": String(fim - inicio + 1), "accept-ranges": "bytes", ...(status === 206 ? { "content-range": `bytes ${inicio}-${fim}/${total}` } : {}), "cache-control": "private, max-age=3600" } });
}
