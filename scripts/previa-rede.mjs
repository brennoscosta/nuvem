// Prévia da rede: admin (Brenno) e visitante nova (Bia). Visitante sem personagem clica num NPC → painel de criar.
// Depois: amizade (pedido → aceite → redes), negociação (proposta → aceita → concluída), call (WebRTC com câmera falsa),
// e o painel /app/rede dos dois.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
const novo = async () => { const c = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] }); return c.newPage(); };
const A = await novo(), B = await novo();
const erros = []; for (const p of [A, B]) p.on("pageerror", (e) => erros.push(e.message));
const foto = async (p, n) => { await p.screenshot({ path: `.higgs/rede-${n}.jpg`, type: "jpeg", quality: 80 }); console.log("foto", n); };
const api = (p, url, body, method = body ? "POST" : "GET") => p.evaluate(async ({ url, body, method }) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; }, { url, body, method });
const st = (p) => p.evaluate(() => { const s = window.__personagem.getState(); return { painel: s.painel, ativo: s.ativo, pedidos: s.pedidos, naoLidas: s.naoLidas }; });

await A.goto(`${base}/app`, { waitUntil: "domcontentloaded" }); await B.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
console.log("admin:", (await api(A, "/api/workend/admin-senha", { senha: "teste" })).status);
const email = `bia${Date.now()}@teste.com`;
console.log("cadastro Bia:", (await api(B, "/api/workend/cadastro", { email, senha: "senha123", nome: "Bia Souza", empresaNome: "" })).status);
await api(A, "/api/personagem", { nome: "Brenno", tipo: "exec-m", bio: "Fundador do WorkEnd", redes: { instagram: "brenno", site: "workend.online" }, mostrarRedes: false }, "PUT");

// 1) Bia (logada, sem personagem) entra no mapa e clica num NPC da Nuvem → painel de criar personagem
const cam = "cam=6,9,34,0,0.8,24";
await B.goto(`${base}/mundo?qualidade=alta&cam=0,10,20,0,1,0`, { waitUntil: "domcontentloaded" }); await B.waitForSelector("canvas"); await B.waitForTimeout(9000);
await B.evaluate(() => { const st = window.__cena?.(); }); // só garante que a cena montou
// clica no NPC via a store da Nuvem (equivalente ao clique no boneco): chamamos o mesmo caminho do clique
const gate = await B.evaluate(() => { const s = window.__personagem.getState(); if (!s.ativo) { s.abrir("montar"); return "gate"; } return "livre"; });
console.log("Bia clica em NPC sem personagem →", gate, (await st(B)).painel);
await B.waitForTimeout(800); await foto(B, "1-npc-gate");
// Bia monta e o admin libera
await api(B, "/api/personagem", { nome: "Bia", tipo: "praia-f1", bio: "Loja de roupas em Aracaju", redes: { instagram: "bia.souza", whatsapp: "79999990000" }, mostrarRedes: false }, "PUT");
const bia = (await api(A, "/api/admin/personagens")).json.personagens.find((p) => p.email === email);
await api(A, "/api/admin/personagens", { usuarioId: bia.usuarioId, dias: 30 });
console.log("amigos sem personagem (deve dar 402 antes da liberação? já liberado →)", (await api(B, "/api/amigos")).status);

// 2) Os dois no mapa, perto
for (const p of [A, B]) { await p.goto(`${base}/mundo?qualidade=alta&${cam}`, { waitUntil: "domcontentloaded" }); await p.waitForSelector("canvas"); }
await A.waitForTimeout(9000); await B.waitForTimeout(2000);
await A.evaluate(() => window.__personagem.setState({ posicao: [-2, 21.3, 0] })); await B.evaluate(() => window.__personagem.setState({ posicao: [1.5, 21.3, Math.PI] }));
for (const p of [A, B, A]) await p.evaluate(() => window.__personagem.getState().batida());
await A.waitForTimeout(3000);
await foto(A, "2-mapa");
// 3) Brenno clica na Bia → ficha nova (Conversar / Negociar / Call / Amizade) e pede amizade
await A.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outros.find((o) => o.nome === "Bia")); }); await A.waitForTimeout(1500);
await foto(A, "3-ficha");
await A.getByRole("button", { name: /Amizade$/ }).click(); await A.waitForTimeout(1200); await foto(A, "4-pedido-enviado");
// Bia vê o pedido na batida e aceita pela ficha
await B.evaluate(() => window.__personagem.getState().batida()); await B.waitForTimeout(500);
console.log("Bia pedidos:", (await st(B)).pedidos);
await B.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outros.find((o) => o.nome === "Brenno")); }); await B.waitForTimeout(1500);
await B.getByRole("button", { name: /Aceitar amizade/ }).click(); await B.waitForTimeout(1500); await foto(B, "5-aceitou-redes");
// Brenno reabre a ficha: amigos + redes da Bia
await A.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outroSelecionado); }); await A.waitForTimeout(1500); await foto(A, "6-amigos");
// 4) Negociar: Brenno propõe, Bia aceita no chat, Brenno conclui
await A.getByRole("button", { name: /Negociar$/ }).click(); await A.waitForTimeout(400);
await A.locator("input[placeholder^='O que você propõe']").fill("Parceria de fornecimento"); await A.locator("textarea").fill("Eu indico 3 fornecedores de Aracaju; você me passa 5% do que fechar."); await A.locator("input[placeholder^='Valor']").fill("1500");
await A.getByRole("button", { name: "Enviar proposta" }).click(); await A.waitForTimeout(1200); await foto(A, "7-proposta");
await B.evaluate(() => { const s = window.__personagem.getState(); s.abrirChat(s.outros.find((o) => o.nome === "Brenno")); }); await B.waitForTimeout(1500); await foto(B, "8-chat-proposta");
await B.getByRole("button", { name: "Aceitar" }).click(); await B.waitForTimeout(1200);
await A.evaluate(() => { const s = window.__personagem.getState(); s.abrirChat(s.outroSelecionado); }); await A.waitForTimeout(1500); await foto(A, "9-aceita");
await A.getByRole("button", { name: /Marcar como concluído/ }).click(); await A.waitForTimeout(1000);
console.log("negociações A:", (await api(A, "/api/negociacoes")).json.map((n) => [n.titulo, n.status, n.valor]));
// 5) Call: Brenno liga pela conversa, Bia atende, espera conectar
await A.getByRole("button", { name: /📹 Call/ }).click(); await A.waitForTimeout(2500); await foto(A, "10-chamando");
await B.evaluate(() => window.__personagem.getState().batida()); await B.waitForTimeout(1500); await foto(B, "11-tocando");
await B.getByRole("button", { name: "Atender" }).click();
for (let i = 0; i < 12; i++) { await A.waitForTimeout(1000); const f = await A.evaluate(() => (window.__chamada ? window.__chamada.getState().fase : "?")); if (f === "ativa") break; }
console.log("fase A:", await A.evaluate(() => window.__chamada?.getState().fase), "| fase B:", await B.evaluate(() => window.__chamada?.getState().fase), "| pc A:", await A.evaluate(() => window.__chamada?.getState().erro));
await A.waitForTimeout(1500); await foto(A, "12-call-a"); await foto(B, "12-call-b");
await A.getByRole("button", { name: "Desligar" }).click(); await B.waitForTimeout(2500);
console.log("B depois de desligar:", await B.evaluate(() => [window.__chamada?.getState().fase, window.__chamada?.getState().fim]));
// 6) Painel Minha rede
await B.goto(`${base}/app/rede`, { waitUntil: "networkidle" }); await B.waitForTimeout(2500); await foto(B, "13-rede-bia");
await B.getByRole("button", { name: /Negociações/ }).click(); await B.waitForTimeout(500); await foto(B, "14-rede-negociacoes");
await B.getByRole("button", { name: /Conversas/ }).click(); await B.waitForTimeout(400); await B.getByRole("button", { name: /Brenno/ }).first().click(); await B.waitForTimeout(1500); await foto(B, "15-rede-chat");
// 7) Visitante deslogado: clicar num NPC → painel com preço e cadastro
const V = await novo(); await V.goto(`${base}/mundo?qualidade=alta&${cam}`, { waitUntil: "domcontentloaded" }); await V.waitForSelector("canvas"); await V.waitForTimeout(7000);
await V.evaluate(() => window.__personagem.getState().abrir("montar")); await V.waitForTimeout(800); await foto(V, "16-visitante");
console.log("erros:", erros);
await b.close();
