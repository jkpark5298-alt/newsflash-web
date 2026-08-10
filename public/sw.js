// public/sw.js

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "알림 타이틀",
    body: "알림 내용을 확인하세요.",
    url: "/?view=alerts#recent-scheduled-alerts",
    view: "alerts",
    focus: undefined,
    articles: undefined,
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      data.body = event.data.text();
    }
  }

  const targetUrl =
    data.url ||
    (data.focus === "stock"
      ? "/?view=alerts&focus=stock#recent-scheduled-alerts"
      : data.focus === "news"
        ? "/?view=alerts&focus=news#recent-scheduled-alerts"
        : "/?view=alerts#recent-scheduled-alerts");

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        url: targetUrl,
        view: data.view || "alerts",
        focus: data.focus,
        title: data.title,
        body: data.body,
        articles: data.articles,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const payload = event.notification.data || {};
  const relativeUrl =
    payload.url || "/?view=alerts#recent-scheduled-alerts";
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  const message = {
    type: "OPEN_ALERT_BOARD",
    focus: payload.focus || "news",
    title: payload.title || event.notification.title,
    body: payload.body || event.notification.body,
    articles: payload.articles || [],
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              if ("navigate" in client) {
                await client.navigate(targetUrl);
              }
            } catch (error) {
              // navigate may fail on some iOS PWA builds; postMessage still opens the board
            }
            client.postMessage(message);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          const opened = await self.clients.openWindow(targetUrl);
          if (opened) {
            // Give the new page a moment, then ask it to open the alert board.
            setTimeout(() => {
              opened.postMessage(message);
            }, 800);
          }
          return opened;
        }
      }),
  );
});
