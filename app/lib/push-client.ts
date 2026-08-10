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
