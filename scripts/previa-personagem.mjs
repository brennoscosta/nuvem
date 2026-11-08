// Prévia dos personagens: dois navegadores (admin "Brenno" e visitante "Bia"), cada um monta seu personagem,
// o admin libera dias pra Bia via /api/admin/personagens, os dois entram no mapa, andam, se veem com o balãozinho
// do nome, clicam um no outro (ficha com as 4 opções), conversam ao vivo e trocam redes.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
const ctxA = await b.newContext({ viewport: { width: 1440, height: 900 } }); const A = await ctxA.newPage();
const ctxB = await b.newContext({ viewport: { width: 1440, height: 900 } }); const B = await ctxB.newPage();
const erros = []; for (const p of [A, B]) p.on("pageerror", (e) => erros.push(e.message));
const foto = async (p, n) => { await p.screenshot({ path: `.higgs/pers-${n}.jpg`, type: "jpeg", quality: 80 }); console.log("foto", n); };
const api = (p, url, body, method = body ? "POST" : "GET") => p.evaluate(async ({ url, body, method }) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; }, { url, body, method });

// A = admin (senha), B = conta nova "Bia"
await A.goto(`${base}/app`, { waitUntil: "domcontentloaded" }); await B.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
console.log("admin:", (await api(A, "/api/workend/admin-senha", { senha: "teste" })).status);
const email = `bia${Date.now()}@teste.com`;
console.log("cadastro Bia:", (await api(B, "/api/workend/cadastro", { email, senha: "senha123", nome: "Bia Souza", empresaNome: "" })).status);

// Visitante sem personagem: GET /api/personagem mostra preço
const semP = await api(B, "/api/personagem"); console.log("GET personagem (Bia, sem):", semP.json);
// Os dois montam o personagem
console.log("PUT admin:", (await api(A, "/api/personagem", { nome: "Brenno", tipo: "exec-m", bio: "Fundador do WorkEnd", redes: { instagram: "brenno", site: "workend.online" }, mostrarRedes: true }, "PUT")).json?.ativo);
const putB = await api(B, "/api/personagem", { nome: "Bia", tipo: "praia-f1", bio: "Loja de roupas em Aracaju", redes: { instagram: "bia.souza", whatsapp: "79999990000" }, mostrarRedes: false }, "PUT");
console.log("PUT Bia:", putB.status, "ativo?", putB.json?.ativo, "tipo", putB.json?.personagem?.tipo);
// Bia sem pagar não manda mensagem
const meuA = (await api(A, "/api/personagem")).json.personagem;
console.log("Bia tenta mandar sem pagar:", (await api(B, `/api/mensagens/${meuA.usuarioId}`, { tipo: "chat", texto: "oi" })).status);
// admin libera 30 dias pra Bia
const lista = (await api(A, "/api/admin/personagens")).json.personagens; const bia = lista.find((p) => p.email === email);
console.log("admin dá dias:", (await api(A, "/api/admin/personagens", { usuarioId: bia.usuarioId, dias: 30 })).status);
console.log("Bia ativa agora?", (await api(B, "/api/personagem")).json.ativo);

// Os dois no mapa, bem perto um do outro (calçada do centro)
const cam = "cam=6,9,34,0,0.8,24";
for (const p of [A, B]) { await p.goto(`${base}/mundo?qualidade=alta&${cam}`, { waitUntil: "domcontentloaded" }); await p.waitForSelector("canvas"); }
await A.waitForTimeout(9000); await B.waitForTimeout(3000);
await A.evaluate(() => window.__personagem.setState({ posicao: [-2, 24, 0] })); await B.evaluate(() => window.__personagem.setState({ posicao: [1.5, 24, Math.PI] }));
await A.evaluate(() => window.__personagem.getState().batida()); await B.evaluate(() => window.__personagem.getState().batida()); await A.evaluate(() => window.__personagem.getState().batida());
await A.waitForTimeout(3500);
console.log("A vê:", await A.evaluate(() => window.__personagem.getState().outros.map((o) => o.nome)), "| B vê:", await B.evaluate(() => window.__personagem.getState().outros.map((o) => o.nome)));
await foto(A, "1-mapa-dois");
// Bia anda (clique no chão): irPara
await B.evaluate(() => window.__personagem.getState().irPara(4, 26)); await B.waitForTimeout(2500); await A.waitForTimeout(3500);
await foto(A, "2-bia-andou");
// Brenno clica na Bia → ficha
await A.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outros.find((o) => o.nome === "Bia")); }); await A.waitForTimeout(1200);
await foto(A, "3-ficha-bia");
// Chat ao vivo
await A.getByRole("button", { name: /Chat ao vivo/ }).click(); await A.waitForTimeout(800);
await A.locator("input[placeholder='Escreva…']").fill("Oi Bia! Vi que você tem loja de roupas, bora conversar?"); await A.keyboard.press("Enter"); await A.waitForTimeout(800);
await A.getByRole("button", { name: /Proposta de negócio/ }).click(); await A.locator("input[placeholder='Descreva a proposta…']").fill("Posso te indicar fornecedores em troca de 5% das vendas."); await A.keyboard.press("Enter"); await A.waitForTimeout(800);
await foto(A, "4-chat-brenno");
// Bia vê a notificação, abre a caixa e responde + pede redes
await B.evaluate(() => window.__personagem.getState().batida()); await B.waitForTimeout(500);
console.log("Bia não lidas:", await B.evaluate(() => window.__personagem.getState().naoLidas));
await B.getByRole("button", { name: /Conversas/ }).click(); await B.waitForTimeout(1200); await foto(B, "5-caixa-bia");
await B.getByRole("button", { name: /Brenno/ }).first().click(); await B.waitForTimeout(1500);
await B.locator("input[placeholder='Escreva…']").fill("Oi Brenno! Topo, me passa seu contato?"); await B.keyboard.press("Enter"); await B.waitForTimeout(600);
await foto(B, "6-chat-bia");
// Brenno pede as redes da Bia (ficha → Trocar redes), Bia aceita
await A.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outroSelecionado); }); await A.waitForTimeout(600);
await A.getByRole("button", { name: /Trocar redes/ }).click(); await A.waitForTimeout(800); await foto(A, "7-pediu-redes");
await B.evaluate(() => window.__personagem.getState().atualizarChat()); await B.waitForTimeout(600);
await B.getByRole("button", { name: /Aceitar e liberar/ }).click(); await B.waitForTimeout(800);
await A.evaluate(() => { const s = window.__personagem.getState(); s.selecionarOutro(s.outroSelecionado); }); await A.waitForTimeout(1200);
await foto(A, "8-redes-liberadas");
console.log("ficha pública Bia pra Brenno:", (await api(A, `/api/personagens/${bia.usuarioId}`)).json?.redes);
// painel montar (Bia edita)
await B.getByTitle("Editar personagem").click(); await B.waitForTimeout(800); await foto(B, "9-montar");
// Visitante deslogado vê o botão de criar
const V = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await V.goto(`${base}/mundo?qualidade=alta&${cam}`, { waitUntil: "domcontentloaded" }); await V.waitForSelector("canvas"); await V.waitForTimeout(6000);
await V.getByRole("button", { name: /Criar personagem/ }).click(); await V.waitForTimeout(600); await foto(V, "10-visitante");
console.log("erros:", erros);
await b.close();
