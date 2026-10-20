// Upload de arquivo (vídeo ou imagem de referência) pelo dono. multipart/form-data com campo "arquivo". Só admin.
import { salvarArquivo } from "@/server/tarefas";
import { ok, erro } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const MAX_MB = 512;

export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const form = await req.formData();
    const f = form.get("arquivo");
    if (!(f instanceof File)) return erro("campo 'arquivo' ausente", 400);
    if (f.size > MAX_MB * 1024 * 1024) return erro(`Arquivo maior que ${MAX_MB} MB`, 413);
    const imagem = f.type.startsWith("image/");
    if (!f.type.startsWith("video/") && !imagem) return erro("Só vídeos (mp4, mov, webm) ou imagens (png, jpg, webp).", 400);
    if (imagem && f.size > 25 * 1024 * 1024) return erro("Imagem maior que 25 MB", 413);
    return ok(await salvarArquivo(f));
  } catch (e) { return erro(e); }
}
