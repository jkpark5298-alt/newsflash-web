// public/sw.js

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const RECEIVED_ALERTS_DB = "newsflash-alerts";
const RECEIVED_ALERTS_STORE = "received";
const RECEIVED_ALERTS_LIMIT = 30;

function openReceivedAlertsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECEIVED_ALERTS_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(RECEIVED_ALERTS_STORE)) {
        db.createObjectStore(RECEIVED_ALERTS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rememberPushAlert(data) {
  const receivedAt = new Date().toISOString();
  const title = data.title || "알림";
  const kind =
    data.focus === "keyword" || data.focus === "news" || data.focus === "stock"
      ? data.focus
      : title.includes("속보 알림")
        ? "keyword"
        : title.includes("정기 뉴스")
          ? "news"
          : title.includes("증시")
            ? "stock"
            : "other";
  const alert = {
    id: data.recordId || `${kind}:${title}:${receivedAt.slice(0, 16)}`,
    kind,
    title,
    body: data.body || "",
    url: data.url,
    receivedAt,
    articles: Array.isArray(data.articles)
      ? data.articles.slice(0, 5).map((article) => ({
          title: article.title || "제목 없음",
          link: article.link || "",
        }))
      : undefined,
  };

  return openReceivedAlertsDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(RECEIVED_ALERTS_STORE, "readwrite");
        const store = tx.objectStore(RECEIVED_ALERTS_STORE);
        store.put(alert);

        const existing = store.getAll();
        existing.onsuccess = () => {
          const items = (existing.result || []).sort((left, right) =>
            right.receivedAt.localeCompare(left.receivedAt),
          );

          for (const item of items.slice(RECEIVED_ALERTS_LIMIT)) {
            store.delete(item.id);
          }
        };

        tx.oncomplete = () => {
          db.close();
          resolve(alert);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

self.addEventListener("push", (event) => {
  let data = {
    title: "알림 타이틀",
    body: "알림 내용을 확인하세요.",
    url: "/?view=alerts#recent-scheduled-alerts",
    view: "alerts",
    focus: undefined,
    articles: undefined,
    recordId: undefined,
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
    rememberPushAlert(data)
      .catch((error) => {
        console.error("받은 알림 저장 실패:", error);
      })
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }),
      )
      .then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: "ALERT_RECEIVED" });
        }

        return self.registration.showNotification(data.title, {
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
            recordId: data.recordId,
          },
        });
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
