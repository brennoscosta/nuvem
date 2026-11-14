// Service worker do WorkEnd (13/11/2026): avisos no celular. O push chega SEM conteúdo; aqui buscamos no servidor o aviso
// mais recente não lido (com a sessão do próprio site) e mostramos a notificação. Tocar abre o link do aviso.
// Não guarda páginas nem intercepta requisições: só cuida das notificações.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  evento.waitUntil((async () => {
    let titulo = "WorkEnd", corpo = "Você tem um aviso novo.", link = "/mundo", tag = "workend";
    try {
      const r = await fetch("/api/workend/avisos", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const a = (j.avisos || []).find((x) => !x.lidoEm);
        if (a) { titulo = a.titulo; corpo = a.texto || "Toque para ver."; link = a.link || "/mundo"; tag = a.id; }
      }
    } catch (e) { /* sem rede: mostra o aviso genérico (o navegador exige mostrar alguma coisa) */ }
    await self.registration.showNotification(titulo, { body: corpo, icon: "/workend/marca/workend-icone-192.png", badge: "/workend/marca/workend-icone-192.png", tag, data: { link }, lang: "pt-BR" });
  })());
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.link) || "/mundo";
  const link = new URL(destino.startsWith("/") ? destino : "/mundo", self.location.origin).href;
  evento.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(link).catch(() => {}); return; }
    }
    await self.clients.openWindow(link);
  })());
});
