// Upload de arquivo (vídeo) pelo dono. multipart/form-data com campo "arquivo". Só admin.
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
    if (!f.type.startsWith("video/")) return erro("Por enquanto só vídeos (mp4, mov, webm).", 400);
    return ok(await salvarArquivo(f));
  } catch (e) { return erro(e); }
}
