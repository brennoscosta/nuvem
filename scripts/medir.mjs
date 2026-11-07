// Mede o peso da cena: draw calls e triângulos por quadro (renderer.info), em várias câmeras.
// Uso: node scripts/medir.mjs <url-base> [esperaMs]
import { chromium } from "playwright";
const [, , base = "http://localhost:3077/?qualidade=alta&medir=1", esperaMs = "20000"] = process.argv;
const CAMS = { nuvem: "8,23,28,0,0,0.5", mundo: "40,70,95,20,0,0", restaurante: "20,22,38,52,0,-2", longe: "0,95,140,0,0,0" };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const out = {};
for (const [nome, cam] of Object.entries(CAMS)) {
  await page.goto(`${base}&cam=${cam}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("canvas", { timeout: 120000 });
  await page.waitForTimeout(+esperaMs);
  out[nome] = await page.evaluate(() => new Promise((res) => {
    const r = window.__cena;
    if (!r) return res({ erro: "renderer não encontrado (use ?medir=1)" });
    requestAnimationFrame(() => requestAnimationFrame(() => res({ calls: r.info.render.calls, triangulos: r.info.render.triangles, geometrias: r.info.memory.geometries, texturas: r.info.memory.textures, programas: r.info.programs?.length })));
  }));
}
console.log(JSON.stringify(out));
await browser.close();
