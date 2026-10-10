export const RECEIVED_ALERTS_DB = "newsflash-alerts";
export const RECEIVED_ALERTS_STORE = "received";
export const RECEIVED_ALERTS_LIMIT = 30;

export type ReceivedAlertKind = "keyword" | "news" | "stock" | "other";

export type ReceivedAlert = {
  id: string;
  kind: ReceivedAlertKind;
  title: string;
  body: string;
  url?: string;
  receivedAt: string;
  articles?: Array<{ title: string; link: string }>;
};

function openReceivedAlertsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
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

function readAll(db: IDBDatabase) {
  return new Promise<ReceivedAlert[]>((resolve, reject) => {
    const tx = db.transaction(RECEIVED_ALERTS_STORE, "readonly");
    const request = tx.objectStore(RECEIVED_ALERTS_STORE).getAll();

    request.onsuccess = () => {
      const items = Array.isArray(request.result) ? request.result : [];
      resolve(
        items.sort((left, right) =>
          right.receivedAt.localeCompare(left.receivedAt),
        ),
      );
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadReceivedAlerts() {
  const db = await openReceivedAlertsDb();

  try {
    return (await readAll(db)).slice(0, RECEIVED_ALERTS_LIMIT);
  } finally {
    db.close();
  }
}

export async function saveReceivedAlert(alert: ReceivedAlert) {
  const db = await openReceivedAlertsDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIVED_ALERTS_STORE, "readwrite");
      tx.objectStore(RECEIVED_ALERTS_STORE).put(alert);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const sorted = await readAll(db);
    const extra = sorted.slice(RECEIVED_ALERTS_LIMIT);

    if (extra.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(RECEIVED_ALERTS_STORE, "readwrite");
        const store = tx.objectStore(RECEIVED_ALERTS_STORE);

        for (const item of extra) {
          store.delete(item.id);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    return sorted.slice(0, RECEIVED_ALERTS_LIMIT);
  } finally {
    db.close();
  }
}

export async function deleteReceivedAlert(id: string) {
  const db = await openReceivedAlertsDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIVED_ALERTS_STORE, "readwrite");
      tx.objectStore(RECEIVED_ALERTS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return (await readAll(db)).slice(0, RECEIVED_ALERTS_LIMIT);
  } finally {
    db.close();
  }
}
