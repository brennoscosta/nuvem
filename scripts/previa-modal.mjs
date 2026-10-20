import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = []; page.on("pageerror", (e) => erros.push(e.message.slice(0,120)));
await page.goto("http://localhost:3077/?cenlocal=1", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 120000 }); await page.waitForTimeout(5000);
// entra como admin
await page.locator("button:has-text('Entrar')").first().click(); await page.waitForTimeout(800);
await page.locator("input[type=password]").first().fill("teste123"); await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
await page.locator("button:has-text('Contratar agente')").first().click(); await page.waitForTimeout(1500);
const modal = await page.locator("text=Contratar agente").count();
await page.screenshot({ path: "/home/claude/escritorio-nuvem/previa-modal.jpg", type: "jpeg", quality: 70 });
console.log(JSON.stringify({ modalAberto: modal > 1, erros: erros.filter(e=>!/modelos|cloudfront/.test(e)) }));
await browser.close();
