// Tira screenshots do escritório rodando no navegador (Chromium headless com WebGL por software).
// Uso: node scripts/previa.mjs <url> <saida.jpg> [esperaMs] [largura] [altura]
import { chromium } from "playwright";
const [, , url = "http://localhost:3077/", out = "previa.jpg", esperaMs = "9000", W = "1440", H = "900"] = process.argv;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") erros.push(m.type() + ": " + m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(+esperaMs);
// mede FPS por 3 s
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res((n / 3).toFixed(1)); }; requestAnimationFrame(tick); }));
await page.screenshot({ path: out, type: "jpeg", quality: 85 });
console.log(JSON.stringify({ out, fps_software: fps, erros: erros.slice(0, 12) }, null, 1));
await browser.close();
