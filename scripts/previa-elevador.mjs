// Teste do elevador: gerente do 1º andar é chamada pra reunião no térreo; fotografa antes (1º andar) e depois (térreo).
import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = []; page.on("pageerror", (e) => erros.push(e.message.slice(0, 160)));
await page.goto("http://localhost:3077/?cenlocal=1&turbo=6", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 120000 }); await page.waitForTimeout(7000);
// entra como admin pra ver o andar 1 (visitante também vê, mas o menu de reunião é admin)
await page.locator("button:has-text('Entrar')").first().click(); await page.waitForTimeout(600);
await page.locator("input[type=password]").first().fill("teste123"); await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
const info = await page.evaluate(() => { const s = window.__esc.getState(); const a = Object.values(s.agentes).find((x) => x.area === "design"); return a ? { id: a.id, mesa: a.mesaId, status: a.status, sala: a.sala } : null; });
console.log("agente:", JSON.stringify(info));
await page.locator("button:has-text('1º andar')").first().click(); await page.waitForTimeout(6000);
await page.screenshot({ path: "previa-elev1.jpg", type: "jpeg", quality: 70 });
// chama pra reunião (vai descer de elevador)
await page.evaluate((id) => { const s = window.__esc.getState(); s.emitir(id, "reuniao", "Reunião com a diretoria", { assento: 0 }); }, info.id);
await page.waitForTimeout(2500);
const meio = await page.evaluate(() => { const s = window.__esc.getState(); const a = Object.values(s.agentes).find((x) => x.area === "design"); return a.status; });
await page.locator("button:has-text('Térreo')").first().click(); await page.waitForTimeout(9000);
await page.screenshot({ path: "previa-elev2.jpg", type: "jpeg", quality: 70 });
const fim = await page.evaluate(() => { const s = window.__esc.getState(); const a = Object.values(s.agentes).find((x) => x.area === "design"); return a.status; });
console.log(JSON.stringify({ statusMeio: meio, statusFim: fim, erros: erros.filter((e) => !/modelos|cloudfront/.test(e)) }));
await browser.close();
