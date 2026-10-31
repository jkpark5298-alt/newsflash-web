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
  /** 기사 출처(언론사). 키워드 알림처럼 기사 1건짜리 알림에 쓴다. */
  source?: string;
  receivedAt: string;
  articles?: Array<{ title: string; link: string; source?: string }>;
};

export const RECEIVED_ALERT_GROUPS: ReadonlyArray<{
  kind: ReceivedAlertKind;
  label: string;
}> = [
  { kind: "keyword", label: "키워드 알림" },
  { kind: "news", label: "정기 뉴스" },
  { kind: "stock", label: "정기 증시" },
  { kind: "other", label: "기타 알림" },
];

/** 알림 종류별로 묶고, 각 묶음 안에서는 최신순으로 보여준다. */
export function groupReceivedAlerts(alerts: ReceivedAlert[]) {
  return RECEIVED_ALERT_GROUPS.map((group) => ({
    ...group,
    items: alerts
      .filter((alert) => alert.kind === group.kind)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)),
  })).filter((group) => group.items.length > 0);
}

/** "제목 (출처)" 형태로 만든다. 이미 출처가 붙어 있으면 그대로 둔다. */
export function titleWithSource(title: string, source?: string) {
  const name = source?.trim();
  if (!name || title.includes(`(${name})`)) return title;
  return `${title} (${name})`;
}

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

export async function clearReceivedAlerts() {
  const db = await openReceivedAlertsDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIVED_ALERTS_STORE, "readwrite");
      tx.objectStore(RECEIVED_ALERTS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return [] as ReceivedAlert[];
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
