export function serializePushSubscription(subscription: PushSubscription) {
  if (typeof subscription.toJSON === "function") {
    return subscription.toJSON();
  }

  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("푸시 구독 키 정보가 없습니다.");
  }

  const encodeKey = (buffer: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: encodeKey(p256dh),
      auth: encodeKey(auth),
    },
  };
}

export async function syncExistingPushPreferences(settings: {
  alertEnabled?: boolean;
  alertKeywords?: string[];
  scheduledAlertEnabled?: boolean;
  scheduledNewsHours?: string[];
}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return false;
  }

  const serialized = serializePushSubscription(subscription);

  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
    return false;
  }

  const response = await fetch("/api/push-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: serialized.endpoint,
      keys: serialized.keys,
      ...settings,
    }),
  });

  return response.ok;
}
