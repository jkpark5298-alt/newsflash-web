// public/sw.js

// 1. 서비스 워커 설치 및 활성화 즉시 제어권 획득
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. 푸시 메시지 수신 이벤트 처리
self.addEventListener("push", (event) => {
  let data = {
    title: "알림 타이틀",
    body: "알림 내용을 확인하세요.",
    url: "/",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png", // 알림 아이콘 경로
      badge: "/icons/icon-192.png", // 상태바 아이콘 경로
      data: {
        url: data.url, // 클릭 시 이동할 URL 저장
      },
    })
  );
});

// 3. 알림 클릭 시 특정 URL로 창 열기 또는 포커스 이동
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); // 알림 닫기
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 해당 사이트 창이 있다면 포커스
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 열려 있는 창이 없다면 새로 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
