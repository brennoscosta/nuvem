// Prévia do painel do agente: abre, clica no primeiro agente da barra e fotografa cada aba.
import { chromium } from "playwright";
const [, , url = "http://localhost:3077/", prefixo = "/home/claude/previas/painel"] = process.argv;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(6000);
const chip = page.locator("button:has-text('BrenoNuvem')").first();
await chip.click();
await page.waitForTimeout(2500);
for (const aba of ["Conversar", "Perfil", "Conhecimento", "Skills", "Regras"]) {
  await page.locator(`button:has-text("${aba}")`).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${prefixo}-${aba.toLowerCase()}.jpg`, type: "jpeg", quality: 82 });
}
console.log(JSON.stringify({ erros }));
await browser.close();
