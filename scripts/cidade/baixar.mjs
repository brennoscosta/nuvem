// Baixa os modelos 3D da cidade (gerados no Higgsfield e otimizados por otimizar.mjs) pra public/modelos.
// Roda no build (Dockerfile) e pode rodar local: node scripts/cidade/baixar.mjs
// Se o arquivo já existe com o tamanho certo, não baixa de novo.
import fs from "node:fs";
import path from "node:path";

const BASE = "https://d2ol7oe51mr4n9.cloudfront.net/user_3G8dEWeMTBjKBPczsWg5GO9dSEE/";
export const MODELOS = {
  "predio-escritorio.glb": ["796266ed-aad5-42f6-87cf-fa80815e3ca1", 287412],
  "predio-residencial.glb": ["4b9233ee-8860-4a47-ada6-baf2869f93d7", 533420],
  "carro.glb": ["dced1945-3777-4ee6-895c-faaa94503c0f", 280248],
  "arvore.glb": ["e37e291f-6f3b-48c9-bef2-8f0ece9e7da7", 548980],
  "palmeira.glb": ["63e32fe5-433a-4bc9-936d-319de646fb80", 283428],
  "banco.glb": ["dacc39aa-7e92-4e78-9d28-adc044c3998e", 274832],
  "poste.glb": ["7cac00c6-3423-4bc3-af08-037d1687003b", 127076],
};

const dir = path.resolve(process.cwd(), "public/modelos");
fs.mkdirSync(dir, { recursive: true });
let falhas = 0;
for (const [nome, [id, tamanho]] of Object.entries(MODELOS)) {
  const destino = path.join(dir, nome);
  if (fs.existsSync(destino) && fs.statSync(destino).size === tamanho) { console.log("ok  ", nome); continue; }
  try {
    const r = await fetch(BASE + id + ".glb");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(destino, buf);
    console.log("baixado", nome, buf.length, "bytes");
  } catch (e) {
    falhas++; console.error("FALHOU", nome, e.message);
  }
}
if (falhas) { console.error(`${falhas} modelo(s) não baixados — a cena usa o fallback procedural pra eles.`); }
