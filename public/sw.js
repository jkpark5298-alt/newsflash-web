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

function isExternalUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

/** 받은 알림 기록 1건을 만든다. (id는 알림을 눌렀을 때 앱 안에서 이 카드를 찾는 데 쓴다) */
function buildReceivedAlert(data) {
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
    // 카드의 "기사 보기" 링크. 예전 서버는 기사 주소를 url에 담아 보냈다.
    url: data.link || (isExternalUrl(data.url) ? data.url : undefined),
    source: data.source || undefined,
    receivedAt,
    articles: Array.isArray(data.articles)
      ? data.articles.slice(0, 5).map((article) => ({
          title: article.title || "제목 없음",
          link: article.link || "",
          source: article.source || undefined,
        }))
      : undefined,
  };
  return alert;
}

/**
 * 알림을 누르면 열 주소.
 * - 키워드 속보: 언론사 기사 원문으로 바로 간다.
 * - 정기 뉴스·증시 등: 앱 알림 안내판의 그 알림 카드로 간다.
 */
function notificationTargetUrl(alert) {
  if (alert.kind === "keyword" && isExternalUrl(alert.url)) return alert.url;
  return alertBoardUrl(alert);
}

function alertBoardUrl(alert) {
  const params = new URLSearchParams({ view: "alerts" });
  if (alert.kind === "news" || alert.kind === "stock") params.set("focus", alert.kind);
  params.set("alert", alert.id);
  return `/?${params.toString()}#received-alerts`;
}

function rememberPushAlert(alert) {
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

  const alert = buildReceivedAlert(data);
  const targetUrl = notificationTargetUrl(alert);

  event.waitUntil(
    rememberPushAlert(alert)
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
            alertId: alert.id,
            view: data.view || "alerts",
            focus: alert.kind,
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
  const relativeUrl = payload.url || "/?view=alerts#received-alerts";
  const targetUrl = new URL(relativeUrl, self.location.origin).href;
  // 키워드 속보는 언론사 기사로 바로 가므로, 앱에 알림 안내판을 열라고 보내지 않는다.
  const opensArticle = isExternalUrl(payload.url);

  const message = {
    type: "OPEN_ALERT_BOARD",
    alertId: payload.alertId,
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
            if (!opensArticle) client.postMessage(message);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          const opened = await self.clients.openWindow(targetUrl);
          if (opened && !opensArticle) {
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
