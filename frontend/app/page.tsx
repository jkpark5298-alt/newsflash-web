"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { FlightAlertCard } from "./components/FlightAlertCard";
import { FlightAlertHistoryCard } from "./components/FlightAlertHistoryCard";
import { WeatherCard } from "./components/WeatherCard";
import { ScheduleSummaryCard } from "./components/ScheduleSummaryCard";
import { DailyRecordCard } from "./components/DailyRecordCard";
import { IssueRecordCard } from "./components/IssueRecordCard";
import { PwaNotificationCard } from "./components/PwaNotificationCard";
import {
  buildFlightAlertSnapshot,
  clearFlightAlertHistory,
  createFlightAlertItems,
  loadFlightAlertHistory,
  loadFlightAlertSnapshot,
  saveFlightAlertHistory,
  saveFlightAlertSnapshot,
  type FlightAlertHistoryItem,
  type FlightAlertSnapshot,
} from "./lib/flight-alerts";
import {
  clearDailyNotionRecord,
  clearIssueNotionRecord,
  loadDailyNotionRecord,
  loadImages,
  loadIssueNotionRecord,
  loadNote,
  saveDailyNotionRecord,
  saveImages,
  saveIssueNotionRecord,
  saveNote,
  getLastDailySaveSignature,
  getLastIssueSaveSignature,
  saveLastDailySaveSignature,
  saveLastIssueSaveSignature,
  loadIssueDraft,
  saveIssueDraft,
  clearIssueDraft,
} from "./lib/local-storage";
import {
  deleteDailyRecord,
  deleteIssueRecord,
  getNotionLinks,
  saveDailyRecord,
  saveIssueRecord,
  updateDailyRecord,
  updateIssueRecord,
} from "./lib/notion-api";

const STORAGE_KEY = "cargo_ops_monitor_rooms_v6";

type DailyNotionRecord = {
  pageId: string;
  url?: string;
  savedAt: string;
};

type IssueNotionRecord = DailyNotionRecord;

type BackendScheduleChange = {
  flight?: string;
  route?: string;
  changes?: string[];
};

type BackendScheduleCheckResult = {
  changed?: number;
  sent?: number;
  failed?: number;
  checked?: number;
  changes?: BackendScheduleChange[];
};

type ImageSlotKey =
  | "daily-schedule"
  | "aircraft-check"
  | "inspection-result"
  | "issue";

const IMAGE_SLOTS: Array<{
  key: ImageSlotKey;
  title: string;
  description: string;
}> = [
  {
    key: "daily-schedule",
    title: "1. 업무일정 이미지",
    description: "당일 업무일정, Cargo Plan, 작업 순서 이미지를 저장합니다.",
  },
  {
    key: "aircraft-check",
    title: "2. 화물기 CHECK 사항 이미지",
    description: "화물기 CHECK 대상과 확인 사항 이미지를 저장합니다.",
  },
  {
    key: "inspection-result",
    title: "3. 점검 대상 결과 이미지",
    description: "점검 대상 결과, 확인 완료 화면, 결과 이미지를 저장합니다.",
  },
];

const ISSUE_IMAGE_SLOT: {
  key: ImageSlotKey;
  title: string;
  description: string;
} = {
  key: "issue",
  title: "4. 특이사항 이미지",
  description: "특이사항 발생 시 증빙용 현장 이미지 또는 캡처를 저장합니다.",
};

const IMAGE_SLOT_PROPERTY_NAME: Record<ImageSlotKey, string> = {
  "daily-schedule": "업무일정 이미지",
  "aircraft-check": "화물기 CHECK 이미지",
  "inspection-result": "점검 대상 결과 이미지",
  issue: "이미지",
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://cargo-ops-backend.onrender.com";

type HourlyWeather = {
  time?: string;
  condition?: string;
  temperature?: string;
  icon?: string;
};

type WeatherInfo = {
  success?: boolean;
  location?: string;
  temperature?: string;
  condition?: string;
  feelsLike?: string;
  humidity?: string;
  windSpeed?: string;
  pm10Grade?: string;
  pm25Grade?: string;
  hourly?: HourlyWeather[];
  baseTime?: string;
  icon?: string;
  source?: string;
  message?: string;
};

const DEFAULT_WEATHER: WeatherInfo = {
  success: false,
  location: "인천시 중구 운서동",
  temperature: "19.6",
  condition: "맑음",
  feelsLike: "18.0",
  humidity: "32",
  windSpeed: "3.3",
  pm10Grade: "좋음",
  pm25Grade: "좋음",
  hourly: [
    { time: "18시", condition: "맑음", temperature: "19", icon: "☀️" },
    { time: "21시", condition: "구름많음", temperature: "17", icon: "⛅" },
    { time: "00시", condition: "흐림", temperature: "15", icon: "☁️" },
    { time: "03시", condition: "맑음", temperature: "14", icon: "☀️" },
  ],
  baseTime: "14:00",
  icon: "☀️",
  source: "fallback",
  message: "실시간 날씨 정보를 불러오면 자동으로 갱신됩니다.",
};

export type FlightRow = {
  flightId?: string;
  flightNo?: string;
  departureCode?: string;
  arrivalCode?: string;
  formattedScheduleTime?: string;
  formattedEstimatedTime?: string;
  scheduleDateTime?: string;
  estimatedDateTime?: string;
  gatenumber?: string;
  terminalid?: string;
  remark?: string;
  status?: string;
  delay?: boolean;
  canceled?: boolean;
  gateChanged?: boolean;
};

export type MonitorRoom = {
  id: string;
  name: string;
  flightsInput: string;
  startDateTime: string;
  endDateTime: string;
  fixed: boolean;
  lastFetchedAt: string;
  rows: FlightRow[];
};





type SavedImage = {
  id: string;
  type: ImageSlotKey;
  label: string;
  savedAt: string;
  dataUrl: string;
};

function loadRooms(): MonitorRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRooms(rooms: MonitorRoom[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

function mergeLatestScheduleRoom(rooms: MonitorRoom[], latestRoom: MonitorRoom) {
  return [latestRoom, ...rooms.filter((room) => !room.fixed)];
}

function getLocalLatestScheduleRoom() {
  return loadRooms().find((room) => room.fixed) || null;
}

function getCurrentSyncLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function saveLatestScheduleToServer(room: MonitorRoom) {
  const res = await fetch(`${BACKEND_URL}/flights/latest-schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ room }),
  });
  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.detail || json.message || "Schedule Flight 서버 저장 실패");
  }

  return json.room as MonitorRoom;
}

function getImageBySlot(images: SavedImage[], slotKey: ImageSlotKey) {
  return images.find((image) => image.type === slotKey) || null;
}

function upsertImageBySlot(
  images: SavedImage[],
  nextImage: SavedImage,
): SavedImage[] {
  const filtered = images.filter((image) => image.type !== nextImage.type);
  return [nextImage, ...filtered].slice(0, 8);
}

function removeImageBySlot(images: SavedImage[], slotKey: ImageSlotKey) {
  return images.filter((image) => image.type !== slotKey);
}

function formatDateForTitle(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const weekdays = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];
  return `${yyyy}.${mm}.${dd} ${weekdays[date.getDay()]}`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return value.replace("T", " ");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function getLatestScheduleRoom(rooms: MonitorRoom[]) {
  const scheduleRooms = rooms.filter((room) => room.fixed);
  return scheduleRooms[0] || null;
}

function getFlightSummary(room: MonitorRoom | null) {
  if (!room) return "저장된 Schedule Flight가 없습니다.";

  const inputFlights = room.flightsInput
    .split(",")
    .map((flight) => flight.trim())
    .filter(Boolean);

  const rows = Array.isArray(room.rows) ? room.rows : [];
  const rowFlights = rows.map((row) => getFlightNo(row)).filter(Boolean);
  const uniqueFlights = Array.from(new Set(inputFlights.length > 0 ? inputFlights : rowFlights));

  if (uniqueFlights.length === 0) return "-";

  return uniqueFlights
    .map((flight) => {
      const matchedRow = rows.find((row) => {
        const rowFlight = getFlightNo(row).replace(/\s+/g, "").toUpperCase();
        const targetFlight = flight.replace(/\s+/g, "").toUpperCase();
        return rowFlight === targetFlight || rowFlight.includes(targetFlight);
      });

      const route = getRouteDisplay(matchedRow);
      return route ? `${flight} ${route}` : flight;
    })
    .join(", ");
}

function getFlightNo(row?: FlightRow) {
  if (!row) return "";
  return row.flightId || row.flightNo || "";
}

function getRouteDisplay(row?: FlightRow) {
  if (!row) return "";
  const departure = row.departureCode || "";
  const arrival = row.arrivalCode || "";

  if (!departure && !arrival) return "";
  if (departure && arrival) return `${departure}→${arrival}`;
  if (departure) return `${departure}→-`;
  return `-→${arrival}`;
}

function getRoomRowsCount(room: MonitorRoom | null) {
  if (!room) return 0;
  return Array.isArray(room.rows) ? room.rows.length : 0;
}


function getRouteByFlight(room: MonitorRoom | null, flightInput: string) {
  if (!room || !flightInput.trim()) return "";

  const targetFlight = flightInput.replace(/\s+/g, "").toUpperCase();
  const matchedRow = room.rows?.find((row) => {
    const rowFlight = getFlightNo(row).replace(/\s+/g, "").toUpperCase();
    return rowFlight === targetFlight || rowFlight.includes(targetFlight);
  });

  return getRouteDisplay(matchedRow);
}

function getHlnbrByFlight(room: MonitorRoom | null, flightInput: string) {
  if (!room || !flightInput.trim()) return "";

  const targetFlight = flightInput.replace(/\s+/g, "").toUpperCase();
  const matchedRow = room.rows?.find((row) => {
    const rowFlight = getFlightNo(row).replace(/\s+/g, "").toUpperCase();
    return rowFlight === targetFlight || rowFlight.includes(targetFlight);
  });

  const rowWithMaybeHlnbr = matchedRow as FlightRow & {
    fid?: string;
    aircraftRegNo?: string;
    registrationNo?: string;
    hlnbr?: string;
  };

  return (
    rowWithMaybeHlnbr?.fid ||
    rowWithMaybeHlnbr?.aircraftRegNo ||
    rowWithMaybeHlnbr?.registrationNo ||
    rowWithMaybeHlnbr?.hlnbr ||
    ""
  );
}

function getCurrentTimeText() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getWeatherSummary(weather: WeatherInfo) {
  return `${weather.condition || "-"} ${weather.temperature || "-"}℃ / 습도 ${weather.humidity || "-"}% / 미세먼지 ${weather.pm10Grade || "-"}`;
}


function getCurrentTimeLabel() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function resizeImageDataUrl(dataUrl: string, maxSize = 1280, quality = 0.72): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(dataUrl);
  if (!dataUrl.startsWith("data:image/")) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          resolve(dataUrl);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}


export default function HomePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const dailySavingRef = useRef(false);
  const issueSavingRef = useRef(false);
  const pendingImageSlotRef = useRef<ImageSlotKey>("daily-schedule");
  const lastImmediateApiCheckRef = useRef(0);
  const autoSavedFlightAlertKeysRef = useRef("");
  const [rooms, setRooms] = useState<MonitorRoom[]>([]);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [pwaPermissionLabel, setPwaPermissionLabel] = useState("확인 전");
  const [pwaStatusMessage, setPwaStatusMessage] = useState("");
  const [pwaLoading, setPwaLoading] = useState(false);
  const [pwaTestLoading, setPwaTestLoading] = useState(false);
  const [pwaCheckLoading, setPwaCheckLoading] = useState(false);
  const [autoPushEnabled, setAutoPushEnabled] = useState(false);
  const [autoPushLoading, setAutoPushLoading] = useState(false);
  const [autoPushStatusMessage, setAutoPushStatusMessage] = useState("");
  const [scheduleSyncCheckedAt, setScheduleSyncCheckedAt] = useState("");
  const [scheduleApiSyncStatus, setScheduleApiSyncStatus] = useState("");
  const [scheduleApiSyncLoading, setScheduleApiSyncLoading] = useState(false);
  const [isDailySaving, setIsDailySaving] = useState(false);
  const [isIssueSaving, setIsIssueSaving] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo>(DEFAULT_WEATHER);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [alertCheckedAt, setAlertCheckedAt] = useState("");
  const [flightAlertSnapshot, setFlightAlertSnapshot] =
    useState<FlightAlertSnapshot | null>(null);
  const [flightAlertHistory, setFlightAlertHistory] =
    useState<FlightAlertHistoryItem[]>([]);
  const [dailyStatus, setDailyStatus] = useState<"normal" | "issue">("normal");
  const [author, setAuthor] = useState("jkpark");
  const [issueFlight, setIssueFlight] = useState("");
  const [issueRoute, setIssueRoute] = useState("");
  const [issueHlnbr, setIssueHlnbr] = useState("");
  const [issueText, setIssueText] = useState("");
  const [dailyNotionRecord, setDailyNotionRecord] =
    useState<DailyNotionRecord | null>(null);
  const [issueNotionRecord, setIssueNotionRecord] =
    useState<IssueNotionRecord | null>(null);
  const todayText = useMemo(() => formatDateForTitle(new Date()), []);
  const latestRoom = useMemo(() => getLatestScheduleRoom(rooms), [rooms]);
  const flightAlertItems = useMemo(
    () => createFlightAlertItems(latestRoom, flightAlertSnapshot),
    [latestRoom, flightAlertSnapshot],
  );
  const flightAlertCount = flightAlertItems.length;

  const saveCurrentIssueDraft = (overrides: Partial<{
    flight: string;
    route: string;
    hlnbr: string;
    text: string;
    status: "normal" | "issue";
    author: string;
  }> = {}) => {
    saveIssueDraft({
      flight: overrides.flight ?? issueFlight,
      route: overrides.route ?? issueRoute,
      hlnbr: overrides.hlnbr ?? issueHlnbr,
      text: overrides.text ?? issueText,
      status: overrides.status ?? dailyStatus,
      author: overrides.author ?? author,
    });
  };

  const updateNote = (value: string) => {
    setNote(value);
    saveNote(value);
  };

  const updateDailyStatus = (value: "normal" | "issue") => {
    setDailyStatus(value);
    saveCurrentIssueDraft({ status: value });
  };

  const updateAuthor = (value: string) => {
    setAuthor(value);
    saveCurrentIssueDraft({ author: value });
  };

  const updateIssueFlight = (value: string) => {
    setIssueFlight(value);
    saveCurrentIssueDraft({ flight: value });
  };

  const updateIssueRoute = (value: string) => {
    setIssueRoute(value);
    saveCurrentIssueDraft({ route: value });
  };

  const updateIssueHlnbr = (value: string) => {
    setIssueHlnbr(value);
    saveCurrentIssueDraft({ hlnbr: value });
  };

  const updateIssueText = (value: string) => {
    setIssueText(value);
    saveCurrentIssueDraft({ text: value });
  };

  useEffect(() => {
    setRooms(loadRooms());
    setImages(loadImages());
    setNote(loadNote());

    const savedIssueDraft = loadIssueDraft();
    if (savedIssueDraft) {
      setIssueFlight(savedIssueDraft.flight);
      setIssueRoute(savedIssueDraft.route);
      setIssueHlnbr(savedIssueDraft.hlnbr);
      setIssueText(savedIssueDraft.text);
      setDailyStatus(savedIssueDraft.status);
      setAuthor(savedIssueDraft.author || "jkpark");
    }

    setDailyNotionRecord(loadDailyNotionRecord());
    setIssueNotionRecord(loadIssueNotionRecord());

    const savedSnapshot = loadFlightAlertSnapshot();
    setFlightAlertSnapshot(savedSnapshot);
    setFlightAlertHistory(loadFlightAlertHistory());
    setAlertCheckedAt(savedSnapshot?.savedAt || getCurrentTimeLabel());

    void fetchServerFlightAlertHistory();
    void fetchWeather();
    void checkScheduleApiAndSync(false, true);
    void fetchAutoPushStatus();

    const syncTimer = window.setTimeout(() => {
      void checkScheduleApiAndSync(false);
      void syncPwaPermissionAndSubscription(false);
    }, 1200);

    return () => {
      window.clearTimeout(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void syncPwaPermissionAndSubscription(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshFromResume = () => {
      void checkScheduleApiAndSync(false);
      void fetchServerFlightAlertHistory();
      void syncPwaPermissionAndSubscription(false);
      void fetchAutoPushStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFromResume();
      }
    };

    window.addEventListener("focus", refreshFromResume);
    window.addEventListener("pageshow", refreshFromResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshFromResume);
      window.removeEventListener("pageshow", refreshFromResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!latestRoom) return;
    if (flightAlertSnapshot?.roomId === latestRoom.id) return;

    const nextSnapshot = buildFlightAlertSnapshot(latestRoom);
    if (!nextSnapshot) return;

    setFlightAlertSnapshot(nextSnapshot);
    saveFlightAlertSnapshot(nextSnapshot);
    setAlertCheckedAt(nextSnapshot.savedAt);
  }, [latestRoom?.id, flightAlertSnapshot?.roomId]);

  useEffect(() => {
    if (!latestRoom || flightAlertItems.length === 0) return;

    const snapshot = buildFlightAlertSnapshot(latestRoom);
    if (!snapshot) return;

    const alertKey = flightAlertItems
      .map((item) => `${item.key}:${item.description}`)
      .sort()
      .join("|");

    if (autoSavedFlightAlertKeysRef.current === alertKey) return;
    autoSavedFlightAlertKeysRef.current = alertKey;

    const checkedAt = getCurrentTimeLabel();
    const historyItems = flightAlertItems.map((item) => ({
      ...item,
      checkedAt,
      roomName: latestRoom.name,
    }));

    mergeFlightAlertHistoryItems(historyItems);
    setFlightAlertSnapshot(snapshot);
    saveFlightAlertSnapshot(snapshot);
    setAlertCheckedAt(snapshot.savedAt);
    setNotice("출도착 알림을 이력에 자동 저장하고 현재 알림을 정리했습니다.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRoom?.id, latestRoom?.lastFetchedAt, flightAlertItems.length]);

  useEffect(() => {
    const route = getRouteByFlight(latestRoom, issueFlight);
    const hlnbr = getHlnbrByFlight(latestRoom, issueFlight);

    if (route) {
      setIssueRoute(route);
    }

    if (hlnbr) {
      setIssueHlnbr(hlnbr);
    }
  }, [issueFlight, latestRoom]);

  const handleCheckFlightAlerts = () => {
    const snapshot = buildFlightAlertSnapshot(latestRoom);

    if (!snapshot) {
      setAlertCheckedAt(getCurrentTimeLabel());
      setNotice("저장된 Schedule Flight가 없습니다. 먼저 편명조회를 실행하세요.");
      return;
    }

    if (flightAlertItems.length > 0) {
      const checkedAt = getCurrentTimeLabel();
      const historyItems = flightAlertItems.map((item) => ({
        ...item,
        checkedAt,
        roomName: latestRoom?.name || snapshot.roomName,
      }));
      mergeFlightAlertHistoryItems(historyItems);
    }

    setFlightAlertSnapshot(snapshot);
    saveFlightAlertSnapshot(snapshot);
    setAlertCheckedAt(snapshot.savedAt);
    setNotice(
      flightAlertItems.length > 0
        ? "변경 알림을 이력에 저장하고 현재 결과를 새 기준으로 저장했습니다."
        : "현재 Schedule Flight 결과를 변경 감지 기준으로 저장했습니다.",
    );
  };

  const handleClearFlightAlertHistory = () => {
    const confirmed = window.confirm("앱에 저장된 출도착 알림 이력을 초기화할까요?");
    if (!confirmed) return;

    setFlightAlertHistory([]);
    clearFlightAlertHistory();
    setNotice("출도착 알림 이력을 초기화했습니다.");
  };

  const mergeFlightAlertHistoryItems = (items: FlightAlertHistoryItem[]) => {
    if (!items.length) return;

    setFlightAlertHistory((prevItems) => {
      const merged = [...items, ...prevItems];
      const seen = new Set<string>();
      const deduped: FlightAlertHistoryItem[] = [];

      for (const item of merged) {
        const dedupeKey = `${item.title}|${item.description}|${item.checkedAt}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        deduped.push(item);
      }

      const nextItems = deduped.slice(0, 20);
      saveFlightAlertHistory(nextItems);
      return nextItems;
    });
  };

  const fetchServerFlightAlertHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/flights/notification-history`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || json.success === false || !Array.isArray(json.items)) return;

      const items = json.items
        .map((item: Partial<FlightAlertHistoryItem>) => ({
          key: String(item.key || `server-${Date.now()}-${Math.random()}`),
          title: String(item.title || "Schedule Flight"),
          description: String(item.description || "운항 정보 변경"),
          checkedAt: String(item.checkedAt || getCurrentTimeLabel()),
          roomName: String(item.roomName || "Schedule Flight"),
        }))
        .filter((item: FlightAlertHistoryItem) => item.title && item.description);

      mergeFlightAlertHistoryItems(items);
    } catch {
      // 서버 알림 이력 조회 실패 시 기존 로컬 이력은 유지합니다.
    }
  };

  const appendBackendFlightAlertHistory = (result: BackendScheduleCheckResult, sourceLabel = "API 확인") => {
    const changes = Array.isArray(result.changes) ? result.changes : [];

    if (!changes.length) return;

    const checkedAt = getCurrentTimeLabel();
    const historyItems: FlightAlertHistoryItem[] = changes.slice(0, 10).map((item, index) => {
      const flight = item.flight || "Schedule Flight";
      const route = item.route || "";
      const descriptions = Array.isArray(item.changes) ? item.changes : [];

      return {
        key: `backend-${Date.now()}-${index}-${flight}`,
        title: route ? `${flight} ${route}` : flight,
        description: `${sourceLabel} · ${descriptions.slice(0, 3).join(" · ") || "운항 정보 변경"}`,
        checkedAt,
        roomName: latestRoom?.name || "Schedule Flight",
      };
    });

    mergeFlightAlertHistoryItems(historyItems);
  };

  const openFlights = () => router.push("/flights");

  const openScheduleFlight = () => {
    if (latestRoom) {
      router.push(`/fixed-lite?roomId=${encodeURIComponent(latestRoom.id)}`);
      return;
    }
    router.push("/flights");
  };

  const syncLatestScheduleFromServer = async (showNotice = true) => {
    try {
      const res = await fetch(`${BACKEND_URL}/flights/latest-schedule`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || "Schedule Flight 동기화 실패");
      }

      let serverRoom = json.room as MonitorRoom | null;

      if (!serverRoom) {
        const localRoom = getLocalLatestScheduleRoom();

        if (!localRoom) {
          const checkedAt = getCurrentSyncLabel();
          setScheduleSyncCheckedAt(checkedAt);
          if (showNotice) setNotice(`Schedule Flight 없음 · 확인 ${checkedAt}`);
          await fetchAutoPushStatus();
          return;
        }

        serverRoom = await saveLatestScheduleToServer(localRoom);
        if (showNotice) {
          const checkedAt = getCurrentSyncLabel();
          setScheduleSyncCheckedAt(checkedAt);
          setNotice(`이 기기의 Schedule Flight를 서버에 동기화했습니다. 확인 ${checkedAt}`);
        }
      } else {
        const nextRooms = mergeLatestScheduleRoom(loadRooms(), serverRoom);
        setRooms(nextRooms);
        saveRooms(nextRooms);

        const nextSnapshot = buildFlightAlertSnapshot(serverRoom);
        if (nextSnapshot) {
          setFlightAlertSnapshot(nextSnapshot);
          saveFlightAlertSnapshot(nextSnapshot);
          setAlertCheckedAt(nextSnapshot.savedAt);
        }

        if (showNotice) {
          const checkedAt = getCurrentSyncLabel();
          setScheduleSyncCheckedAt(checkedAt);
          setNotice(`Schedule Flight 동기화 확인 · ${checkedAt}`);
        }
      }

      setFlightAlertHistory([]);
      clearFlightAlertHistory();
      await fetchAutoPushStatus();
    } catch (error) {
      if (showNotice) {
        setNotice(error instanceof Error ? error.message : "Schedule Flight 동기화 중 오류가 발생했습니다.");
      }
    }
  };


  const checkScheduleApiAndSync = async (showNotice = false, force = false) => {
    const now = Date.now();

    if (!force && now - lastImmediateApiCheckRef.current < 60_000) {
      await syncLatestScheduleFromServer(false);
      return;
    }

    lastImmediateApiCheckRef.current = now;

    try {
      const endpoint = showNotice ? "check-schedule-and-push" : "check-schedule";
      const res = await fetch(`${BACKEND_URL}/flights/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || "Schedule Flight API 즉시 확인 실패");
      }

      const result = json as BackendScheduleCheckResult;
      appendBackendFlightAlertHistory(result, "API 즉시 확인");
      await syncLatestScheduleFromServer(false);

      if (showNotice) {
        const changed = result.changed ?? 0;
        const sent = result.sent ?? 0;
        const checkedAt = getCurrentSyncLabel();
        setScheduleSyncCheckedAt(checkedAt);
        const message =
          changed > 0
            ? `API 동기화 완료 · 변경 ${changed}건 · 푸시 ${sent}건 · ${checkedAt}`
            : `API 동기화 완료 · 변경 없음 · ${checkedAt}`;
        setScheduleApiSyncStatus(message);
        setNotice(message);
      }
    } catch (error) {
      await syncLatestScheduleFromServer(false);

      if (showNotice) {
        const checkedAt = getCurrentSyncLabel();
        const rawMessage = error instanceof Error ? error.message : "Schedule Flight API 즉시 확인 중 오류가 발생했습니다.";
        const friendlyMessage = rawMessage.includes("429")
          ? "429 한도 초과 또는 일시 제한"
          : rawMessage;
        const message = `API 동기화 실패 · ${friendlyMessage} · ${checkedAt}`;
        setScheduleApiSyncStatus(message);
        setScheduleSyncCheckedAt(checkedAt);
        setNotice(message);
      }
    }
  };

  const handleRefreshLatestSchedule = async () => {
    if (scheduleApiSyncLoading) return;

    const requestedAt = getCurrentSyncLabel();
    setScheduleApiSyncLoading(true);
    setScheduleSyncCheckedAt(requestedAt);
    setScheduleApiSyncStatus(`API 동기화 요청 중 · ${requestedAt}`);
    setNotice("최근 Schedule Flight API 동기화를 시작했습니다.");

    try {
      await checkScheduleApiAndSync(true);
      await syncLatestScheduleFromServer(false);
      await fetchServerFlightAlertHistory();
    } finally {
      setScheduleApiSyncLoading(false);
    }
  };

  const fetchAutoPushStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/flights/auto-push/status`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok || json.success === false) return;

      setAutoPushEnabled(Boolean(json.enabled));
      const modeText = json.mode === "focus" ? "집중 5분 확인" : "일반 30분 확인";
      const lastRunText = json.lastRunAt ? ` · 마지막 ${String(json.lastRunAt).replace("T", " ").slice(5, 16)}` : "";
      setAutoPushStatusMessage(`${modeText} · ${json.lastMessage || ""}${lastRunText}`);
    } catch {
      // 자동 확인 상태 조회 실패 시 화면만 조용히 유지합니다.
    }
  };

  const savePushSubscription = async (subscription: PushSubscription) => {
    const saveRes = await fetch(`${BACKEND_URL}/flights/push-subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent,
        deviceName: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iPhone/iPad PWA" : "Web browser",
      }),
    });
    const saveJson = await saveRes.json();

    if (!saveRes.ok || saveJson.success === false) {
      throw new Error(saveJson.detail || saveJson.message || "Push 구독 저장 실패");
    }

    return saveJson;
  };

  const getPushPublicKey = async () => {
    const keyRes = await fetch(`${BACKEND_URL}/flights/push-public-key`, {
      cache: "no-store",
    });
    const keyJson = await keyRes.json();

    if (!keyRes.ok || keyJson.success === false) {
      throw new Error(keyJson.detail || keyJson.message || "Push 공개키 확인 실패");
    }

    return keyJson as {
      success?: boolean;
      configured?: boolean;
      publicKey?: string;
      detail?: string;
      message?: string;
    };
  };

  const syncPwaPermissionAndSubscription = async (showMessage = false) => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPwaPermissionLabel("미지원");
      if (showMessage) setPwaStatusMessage("이 브라우저에서는 PWA 푸시 알림을 지원하지 않습니다.");
      return;
    }

    const permission = Notification.permission;
    setPwaPermissionLabel(permission === "granted" ? "허용됨" : permission === "denied" ? "차단됨" : "미설정");

    if (permission !== "granted") {
      if (showMessage) {
        setPwaStatusMessage(
          permission === "denied"
            ? "알림 권한이 차단되어 있습니다. 아이폰 설정에서 알림 허용을 켜 주세요."
            : "알림 권한이 아직 허용되지 않았습니다. 알림 허용 준비를 눌러 주세요.",
        );
      }
      return;
    }

    try {
      const keyJson = await getPushPublicKey();

      if (!keyJson.configured || !keyJson.publicKey) {
        if (showMessage) setPwaStatusMessage("알림 권한은 허용됐지만, 백엔드 WEB_PUSH_PUBLIC_KEY 설정이 없습니다.");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
        });
      }

      await savePushSubscription(subscription);
      setPwaPermissionLabel("허용됨");

      if (showMessage) {
        setPwaStatusMessage("알림 권한과 구독 정보가 정상 연결되어 있습니다.");
      }
    } catch (error) {
      if (showMessage) {
        setPwaStatusMessage(error instanceof Error ? error.message : "PWA 알림 상태 확인 중 오류가 발생했습니다.");
      }
    }
  };

  const handleEnablePwaPush = async () => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPwaPermissionLabel("미지원");
      setPwaStatusMessage("이 브라우저에서는 PWA 푸시 알림을 지원하지 않습니다.");
      return;
    }

    setPwaLoading(true);
    setPwaStatusMessage("");

    try {
      const permission = await Notification.requestPermission();
      setPwaPermissionLabel(permission === "granted" ? "허용됨" : permission === "denied" ? "차단됨" : "미설정");

      if (permission !== "granted") {
        setPwaStatusMessage("알림 권한이 허용되지 않았습니다. 아이폰 설정 또는 Safari 설정에서 알림 권한을 확인하세요.");
        return;
      }

      await syncPwaPermissionAndSubscription(true);
    } catch (error) {
      setPwaStatusMessage(error instanceof Error ? error.message : "PWA 알림 준비 중 오류가 발생했습니다.");
    } finally {
      setPwaLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setPwaTestLoading(true);

    try {
      await syncPwaPermissionAndSubscription(false);

      const res = await fetch(`${BACKEND_URL}/flights/push-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "KJ Cargo Ops 테스트 알림",
          body: "아이폰 PWA 푸시 알림 수신 테스트입니다.",
          url: "/",
        }),
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || "테스트 알림 발송 실패");
      }

      setPwaPermissionLabel("허용됨");
      setPwaStatusMessage(`테스트 알림을 발송했습니다. 성공 ${json.sent ?? 0}건 / 실패 ${json.failed ?? 0}건`);
    } catch (error) {
      setPwaStatusMessage(error instanceof Error ? error.message : "테스트 알림 발송 중 오류가 발생했습니다.");
    } finally {
      setPwaTestLoading(false);
    }
  };

  const handleCheckScheduleAndPush = async () => {
    setPwaCheckLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/flights/check-schedule-and-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.detail || json.message || "Schedule Flight 변경 확인 실패");
      }

      const result = json as BackendScheduleCheckResult;
      appendBackendFlightAlertHistory(result, "수동 변경 확인");

      const changed = result.changed ?? 0;
      const sent = result.sent ?? 0;
      const failed = result.failed ?? 0;
      const checked = result.checked ?? 0;

      if (changed > 0) {
        setPwaStatusMessage(
          `Schedule Flight 변경 ${changed}건 감지. 푸시 발송 성공 ${sent}건 / 실패 ${failed}건`,
        );
        await syncLatestScheduleFromServer(false);
      } else {
        setPwaStatusMessage(`Schedule Flight 변경 없음. 재조회 대상 ${checked}건 확인 완료`);
        await syncLatestScheduleFromServer(false);
      }
    } catch (error) {
      setPwaStatusMessage(error instanceof Error ? error.message : "Schedule Flight 변경 확인 중 오류가 발생했습니다.");
    } finally {
      setPwaCheckLoading(false);
    }
  };

  const handleToggleAutoPush = async () => {
    setAutoPushLoading(true);

    try {
      await fetchAutoPushStatus();
      setPwaStatusMessage("자동 변경 확인 상태를 새로고침했습니다. Schedule Flight 기준으로 자동 적용됩니다.");
    } catch (error) {
      setPwaStatusMessage(error instanceof Error ? error.message : "자동 변경 확인 상태 조회 중 오류가 발생했습니다.");
    } finally {
      setAutoPushLoading(false);
    }
  };


  async function fetchWeather() {
    setWeatherLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/weather/current`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || json?.detail || `날씨 조회 오류 (${res.status})`);
      }

      setWeather({
        ...DEFAULT_WEATHER,
        ...json,
        success: json?.success !== false,
      });
    } catch (error) {
      setWeather({
        ...DEFAULT_WEATHER,
        success: false,
        source: "fallback",
        message: "날씨 API 연결 전이거나 응답이 지연되어 예시값을 표시합니다.",
      });
    } finally {
      setWeatherLoading(false);
    }
  }

  const openNaverWeather = () => {
    window.open(
      "https://search.naver.com/search.naver?query=%EC%A4%91%EA%B5%AC%20%EC%9A%B4%EC%84%9C%EB%8F%99%20%EB%82%A0%EC%94%A8",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openCamera = (slotKey: ImageSlotKey) => {
    pendingImageSlotRef.current = slotKey;
    cameraInputRef.current?.click();
  };

  const openPhotoLibrary = (slotKey: ImageSlotKey) => {
    pendingImageSlotRef.current = slotKey;
    libraryInputRef.current?.click();
  };

  const persistImages = (nextImages: SavedImage[], successMessage: string) => {
    setImages(nextImages);
    const saved = saveImages(nextImages);

    if (saved) {
      setNotice(successMessage);
      return;
    }

    setNotice(
      "이미지를 화면에는 올렸지만, 기기 저장공간 제한으로 재실행 후 복원되지 않을 수 있습니다. 더 작은 사진으로 다시 저장해 주세요.",
    );
  };

  const handleImageSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
    sourceLabel: "카메라 촬영" | "사진첩 선택",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      const originalDataUrl = String(reader.result || "");

      if (!originalDataUrl) return;

      const dataUrl = await resizeImageDataUrl(originalDataUrl, 1280, 0.72);
      const savedAt = new Date().toLocaleString("ko-KR");
      const slotKey = pendingImageSlotRef.current;
      const slotInfo =
        [...IMAGE_SLOTS, ISSUE_IMAGE_SLOT].find((slot) => slot.key === slotKey) ||
        IMAGE_SLOTS[0];
      const label = `${slotInfo.title} · ${sourceLabel}`;
      const nextImages = upsertImageBySlot(images, {
        id: `${Date.now()}`,
        type: slotKey,
        label,
        savedAt,
        dataUrl,
      });

      persistImages(nextImages, `${slotInfo.title}를 기기에 저장했습니다.`);
    };

    reader.onerror = () => {
      setNotice("이미지를 읽는 중 오류가 발생했습니다.");
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteImageSlot = (slotKey: ImageSlotKey) => {
    const image = getImageBySlot(images, slotKey);
    if (!image) return;

    const confirmed = window.confirm("이 이미지를 삭제할까요?");
    if (!confirmed) return;

    const nextImages = removeImageBySlot(images, slotKey);
    persistImages(nextImages, `${image.label}를 삭제했습니다.`);
  };

  const openLatestImage = (image: SavedImage) => {
    const imageWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!imageWindow) {
      setNotice("이미지를 새 창으로 열 수 없습니다. 팝업 차단을 확인하세요.");
      return;
    }

    imageWindow.document.write(`
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${image.label}</title>
          <style>
            body {
              margin: 0;
              background: #020617;
              color: #e5edf7;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              display: flex;
              min-height: 100vh;
              align-items: center;
              justify-content: center;
              padding: 16px;
              box-sizing: border-box;
            }
            img {
              max-width: 100%;
              max-height: 92vh;
              border-radius: 14px;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="${image.dataUrl}" alt="${image.label}" />
        </body>
      </html>
    `);
    imageWindow.document.close();
  };

  const handleSaveNoteLocal = () => {
    saveNote(note);
    setNotice(
      "노트를 임시 저장했습니다. Notion 저장은 다음 단계에서 연결합니다.",
    );
  };

  const handleSaveDailyDraft = () => {
    saveNote(note);
    saveCurrentIssueDraft();

    setNotice(
      dailyStatus === "normal"
        ? "일일 업무 주요 사항을 기기에 임시 저장했습니다. 상태: 이상 없음"
        : "일일 업무 주요 사항과 특이사항 입력 내용을 기기에 임시 저장했습니다.",
    );
  };

  const makeSaveSignature = (payload: unknown) => JSON.stringify(payload);

  const isRecentSameSave = (
    previous: { signature: string; savedAt: number } | null,
    signature: string,
  ) => {
    if (!previous) return false;
    const elapsedMs = Date.now() - previous.savedAt;
    return previous.signature === signature && elapsedMs < 10 * 60 * 1000;
  };


  const buildDailyPayload = () => {
    const dailyImages = IMAGE_SLOTS.map((slot) => {
      const image = getImageBySlot(images, slot.key);
      if (!image) return null;

      return {
        slotKey: slot.key,
        propertyName: IMAGE_SLOT_PROPERTY_NAME[slot.key],
        label: image.label,
        savedAt: image.savedAt,
        dataUrl: image.dataUrl,
      };
    }).filter(Boolean);

    return {
      title: `${todayText} KJ 일일 업무`,
      date: new Date().toISOString(),
      author,
      status: dailyStatus === "normal" ? "이상 없음" : "특이사항 있음",
      memo: note,
      images: dailyImages,
    };
  };

  const handleSaveDailyToNotion = async () => {
    if (dailySavingRef.current) {
      setNotice("Notion 일일 업무 기록 저장 중입니다. 잠시만 기다려 주세요.");
      return;
    }

    if (dailyNotionRecord?.pageId) {
      setNotice("이미 저장된 일일 업무 기록이 있습니다. 새로 만들지 않고 수정 버튼을 사용하세요.");
      return;
    }

    const payload = buildDailyPayload();
    const signature = makeSaveSignature(payload);

    if (isRecentSameSave(getLastDailySaveSignature(), signature)) {
      setNotice("방금 같은 일일 업무 기록을 저장했습니다. 중복 저장을 막았습니다.");
      return;
    }

    dailySavingRef.current = true;
    setIsDailySaving(true);

    try {
      const result = await saveDailyRecord(payload);

      const record = {
        pageId: result.pageId,
        url: result.url,
        savedAt: new Date().toLocaleString("ko-KR"),
      };

      setDailyNotionRecord(record);
      saveDailyNotionRecord(record);
      saveLastDailySaveSignature({ signature, savedAt: Date.now() });
      setNotice("Notion에 일일 업무 기록을 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 저장 중 오류가 발생했습니다.");
    } finally {
      dailySavingRef.current = false;
      setIsDailySaving(false);
    }
  };

  const handleUpdateDailyToNotion = async () => {
    if (!dailyNotionRecord?.pageId) {
      setNotice("수정할 Notion 일일 기록이 없습니다. 먼저 저장하세요.");
      return;
    }

    try {
      const result = await updateDailyRecord(dailyNotionRecord.pageId, buildDailyPayload());

      const nextRecord = {
        ...dailyNotionRecord,
        url: result.url || dailyNotionRecord.url,
        savedAt: new Date().toLocaleString("ko-KR"),
      };

      setDailyNotionRecord(nextRecord);
      saveDailyNotionRecord(nextRecord);
      setNotice("Notion 일일 업무 기록을 수정했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteDailyFromNotion = async () => {
    if (!dailyNotionRecord?.pageId) {
      setNotice("삭제할 Notion 일일 기록이 없습니다.");
      return;
    }

    const confirmed = window.confirm("Notion 일일 업무 기록을 삭제할까요?");
    if (!confirmed) return;

    try {
      await deleteDailyRecord(dailyNotionRecord.pageId);

      clearDailyNotionRecord();
      setDailyNotionRecord(null);
      setNotice("Notion 일일 업무 기록을 삭제했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleResetLocalDraft = () => {
    const confirmed = window.confirm(
      "앱 화면에 남아 있는 사진, 메모, Notion 저장 연결 상태를 초기화합니다.\n\nNotion DB에 이미 저장된 기록은 삭제되지 않습니다.\n초기화 후에는 이 화면에서 해당 Notion 기록을 수정/삭제할 수 없습니다.\n\n계속할까요?",
    );

    if (!confirmed) return;

    setImages([]);
    setNote("");
    setIssueFlight("");
    setIssueRoute("");
    setIssueHlnbr("");
    setIssueText("");
    setDailyStatus("normal");
    setDailyNotionRecord(null);
    setIssueNotionRecord(null);

    saveImages([]);
    saveNote("");
    clearIssueDraft();
    clearDailyNotionRecord();
    clearIssueNotionRecord();

    setNotice("앱 화면만 초기화했습니다. Notion DB 기록은 삭제되지 않았습니다.");
  };

  const openDailyNotionPage = () => {
    if (!dailyNotionRecord?.url) {
      setNotice("열 수 있는 Notion 링크가 없습니다.");
      return;
    }

    window.open(dailyNotionRecord.url, "_blank", "noopener,noreferrer");
  };

  const buildIssuePayload = () => {
    const issueImage = getImageBySlot(images, ISSUE_IMAGE_SLOT.key);

    return {
      title: `${issueFlight.trim().toUpperCase()} ${issueRoute || ""} 특이사항`,
      date: new Date().toISOString(),
      time: getCurrentTimeText(),
      flight: issueFlight.trim().toUpperCase(),
      route: issueRoute,
      hlnbr: issueHlnbr,
      issue: issueText,
      weather: getWeatherSummary(weather),
      author,
      status: "확인 중",
      image: issueImage
        ? {
            slotKey: ISSUE_IMAGE_SLOT.key,
            propertyName: IMAGE_SLOT_PROPERTY_NAME[ISSUE_IMAGE_SLOT.key],
            label: issueImage.label,
            savedAt: issueImage.savedAt,
            dataUrl: issueImage.dataUrl,
          }
        : null,
    };
  };

  const validateIssueForm = () => {
    if (!issueFlight.trim()) {
      setNotice("특이사항 기록을 위해 편명을 입력하세요.");
      return false;
    }

    if (!issueText.trim()) {
      setNotice("특이사항 내용을 입력하세요.");
      return false;
    }

    return true;
  };

  const handleSaveIssueDraft = () => {
    saveCurrentIssueDraft();
    setNotice("특이사항 입력 내용을 기기에 임시 저장했습니다.");
  };

  const handleSaveIssueToNotion = async () => {
    if (issueSavingRef.current) {
      setNotice("Notion 특이사항 기록 저장 중입니다. 잠시만 기다려 주세요.");
      return;
    }

    if (issueNotionRecord?.pageId) {
      setNotice("이미 저장된 특이사항 기록이 있습니다. 새로 만들지 않고 수정 버튼을 사용하세요.");
      return;
    }

    if (!validateIssueForm()) return;

    const payload = buildIssuePayload();
    const signature = makeSaveSignature(payload);

    if (isRecentSameSave(getLastIssueSaveSignature(), signature)) {
      setNotice("방금 같은 특이사항 기록을 저장했습니다. 중복 저장을 막았습니다.");
      return;
    }

    issueSavingRef.current = true;
    setIsIssueSaving(true);

    try {
      const result = await saveIssueRecord(payload);

      const record = {
        pageId: result.pageId,
        url: result.url,
        savedAt: new Date().toLocaleString("ko-KR"),
      };

      setIssueNotionRecord(record);
      saveIssueNotionRecord(record);
      saveLastIssueSaveSignature({ signature, savedAt: Date.now() });
      setNotice("Notion에 특이사항 기록을 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 저장 중 오류가 발생했습니다.");
    } finally {
      issueSavingRef.current = false;
      setIsIssueSaving(false);
    }
  };

  const handleUpdateIssueToNotion = async () => {
    if (!issueNotionRecord?.pageId) {
      setNotice("수정할 Notion 특이사항 기록이 없습니다. 먼저 저장하세요.");
      return;
    }

    if (!validateIssueForm()) return;

    try {
      const result = await updateIssueRecord(issueNotionRecord.pageId, buildIssuePayload());

      const nextRecord = {
        ...issueNotionRecord,
        url: result.url || issueNotionRecord.url,
        savedAt: new Date().toLocaleString("ko-KR"),
      };

      setIssueNotionRecord(nextRecord);
      saveIssueNotionRecord(nextRecord);
      setNotice("Notion 특이사항 기록을 수정했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteIssueFromNotion = async () => {
    if (!issueNotionRecord?.pageId) {
      setNotice("삭제할 Notion 특이사항 기록이 없습니다.");
      return;
    }

    const confirmed = window.confirm("Notion 특이사항 기록을 삭제할까요?");
    if (!confirmed) return;

    try {
      await deleteIssueRecord(issueNotionRecord.pageId);

      clearIssueNotionRecord();
      setIssueNotionRecord(null);
      setNotice("Notion 특이사항 기록을 삭제했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion 삭제 중 오류가 발생했습니다.");
    }
  };

  const openIssueNotionPage = () => {
    if (!issueNotionRecord?.url) {
      setNotice("열 수 있는 Notion 특이사항 링크가 없습니다.");
      return;
    }

    window.open(issueNotionRecord.url, "_blank", "noopener,noreferrer");
  };

  const openNotionDatabase = async (target: "daily" | "issue") => {
    try {
      const result = await getNotionLinks();
      const url = target === "daily" ? result.dailyDbUrl : result.issueDbUrl;

      if (!url) {
        setNotice("열 수 있는 Notion DB 링크가 없습니다.");
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notion DB 링크를 여는 중 오류가 발생했습니다.");
    }
  };

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={eyebrowStyle}>CARGO OPS</div>
        <h1 style={titleStyle}>KJ 화물기 출도착 모니터링</h1>
        <div style={datePillStyle}>{todayText}</div>
        <WeatherCard
          weather={weather}
          weatherLoading={weatherLoading}
          onRefresh={fetchWeather}
          onOpenNaver={openNaverWeather}
        />

        <FlightAlertCard
          alertCount={flightAlertCount}
          alertItems={flightAlertItems}
          checkedAt={alertCheckedAt}
          snapshotName={flightAlertSnapshot?.roomName || null}
          onSaveCurrent={handleCheckFlightAlerts}
        />

        <FlightAlertHistoryCard
          historyItems={flightAlertHistory}
          onClear={handleClearFlightAlertHistory}
        />
      </section>

      <section style={stackStyle}>
        <ScheduleSummaryCard
          latestRoom={latestRoom}
          syncCheckedAt={scheduleSyncCheckedAt}
          apiSyncStatus={scheduleApiSyncStatus}
          apiSyncLoading={scheduleApiSyncLoading}
          onOpenScheduleFlight={openScheduleFlight}
          onRefreshLatestSchedule={handleRefreshLatestSchedule}
        />

        <ActionCard
          label="오늘 KJ 화물기 조회"
          title="오늘 KJ 화물기 조회"
          description="편명 직접 조회는 유지하고, KJ 전체 조회에서 Schedule Flight를 선택 저장합니다."
          buttonLabel="편명조회 열기"
          onClick={openFlights}
          accent="#2563eb"
        />

        <PwaNotificationCard
          permissionLabel={pwaPermissionLabel}
          statusMessage={pwaStatusMessage}
          loading={pwaLoading}
          testLoading={pwaTestLoading}
          checkLoading={pwaCheckLoading}
          autoEnabled={autoPushEnabled}
          autoLoading={autoPushLoading}
          autoStatusMessage={autoPushStatusMessage}
          onEnable={handleEnablePwaPush}
          onSendTest={handleSendTestPush}
          onCheckSchedule={handleCheckScheduleAndPush}
          onToggleAuto={handleToggleAutoPush}
        />

        <DailyRecordCard
          dailyStatus={dailyStatus}
          setDailyStatus={updateDailyStatus}
          images={images}
          imageSlots={IMAGE_SLOTS}
          getImageBySlot={getImageBySlot}
          openCamera={openCamera}
          openPhotoLibrary={openPhotoLibrary}
          openLatestImage={openLatestImage}
          handleDeleteImageSlot={handleDeleteImageSlot}
          cameraInputRef={cameraInputRef}
          libraryInputRef={libraryInputRef}
          handleImageSelected={handleImageSelected}
          author={author}
          setAuthor={updateAuthor}
          note={note}
          setNote={updateNote}
          dailyNotionRecord={dailyNotionRecord}
          isDailySaving={isDailySaving}
          handleSaveDailyDraft={handleSaveDailyDraft}
          handleSaveDailyToNotion={handleSaveDailyToNotion}
          handleUpdateDailyToNotion={handleUpdateDailyToNotion}
          handleDeleteDailyFromNotion={handleDeleteDailyFromNotion}
          openDailyNotionPage={openDailyNotionPage}
          openNotionDatabase={openNotionDatabase}
          handleResetLocalDraft={handleResetLocalDraft}
        />

        {dailyStatus === "issue" && (
          <IssueRecordCard
            issueImageSlot={ISSUE_IMAGE_SLOT}
            issueImage={getImageBySlot(images, ISSUE_IMAGE_SLOT.key)}
            openCamera={() => openCamera(ISSUE_IMAGE_SLOT.key)}
            openPhotoLibrary={() => openPhotoLibrary(ISSUE_IMAGE_SLOT.key)}
            openLatestImage={openLatestImage}
            handleDeleteImageSlot={() => handleDeleteImageSlot(ISSUE_IMAGE_SLOT.key)}
            todayText={todayText}
            currentTimeText={getCurrentTimeText()}
            issueFlight={issueFlight}
            setIssueFlight={updateIssueFlight}
            issueRoute={issueRoute}
            setIssueRoute={updateIssueRoute}
            issueHlnbr={issueHlnbr}
            setIssueHlnbr={updateIssueHlnbr}
            author={author}
            setAuthor={updateAuthor}
            weatherSummary={getWeatherSummary(weather)}
            issueText={issueText}
            setIssueText={updateIssueText}
            issueNotionRecord={issueNotionRecord}
            isIssueSaving={isIssueSaving}
            handleSaveIssueDraft={handleSaveIssueDraft}
            handleSaveIssueToNotion={handleSaveIssueToNotion}
            handleUpdateIssueToNotion={handleUpdateIssueToNotion}
            handleDeleteIssueFromNotion={handleDeleteIssueFromNotion}
            openIssueNotionPage={openIssueNotionPage}
            openNotionDatabase={openNotionDatabase}
            handleResetLocalDraft={handleResetLocalDraft}
          />
        )}

        {notice && <div style={noticeStyle}>{notice}</div>}
      </section>
      <footer style={footerStyle}>by jkpark</footer>
    </main>
  );
}

function getAirTone(value?: string): "good" | "normal" | "bad" | "time" {
  if (!value) return "normal";
  if (value.includes("좋음")) return "good";
  if (value.includes("나쁨") || value.includes("매우")) return "bad";
  return "normal";
}

function getUvTone(value?: string): "good" | "normal" | "bad" | "time" {
  if (!value) return "normal";
  if (value.includes("낮") || value.includes("좋음")) return "good";
  if (value.includes("높") || value.includes("위험")) return "bad";
  return "normal";
}

function ActionCard({
  label,
  title,
  description,
  buttonLabel,
  onClick,
  accent,
}: {
  label: string;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <section style={{ ...cardStyle, borderColor: `${accent}66` }}>
      <div style={cardLabelStyle}>{label}</div>
      <h2 style={cardTitleStyle}>{title}</h2>
      <p style={cardDescriptionStyle}>{description}</p>
      <button
        onClick={onClick}
        style={{ ...primaryButtonStyle, background: accent }}
      >
        {buttonLabel}
      </button>
    </section>
  );
}

function ImageSlotCard({
  slot,
  image,
  onCamera,
  onLibrary,
  onView,
  onDelete,
}: {
  slot: { key: ImageSlotKey; title: string; description: string };
  image: SavedImage | null;
  onCamera: () => void;
  onLibrary: () => void;
  onView: (image: SavedImage) => void;
  onDelete: () => void;
}) {
  return (
    <div style={imageSlotCardStyle}>
      <div>
        <div style={imageSlotTitleStyle}>{slot.title}</div>
        <div style={imageSlotDescStyle}>{slot.description}</div>
      </div>

      {image ? (
        <div style={imageSlotSavedStyle}>
          <button onClick={() => onView(image)} style={imagePreviewButtonStyle}>
            <img src={image.dataUrl} alt={image.label} style={imagePreviewStyle} />
            <span style={imageTextStyle}>
              저장됨
              <small style={imageDateStyle}>{image.savedAt}</small>
            </span>
          </button>
          <div style={imageSlotActionRowStyle}>
            <button onClick={() => onView(image)} style={miniButtonStyle}>
              보기
            </button>
            <button onClick={onCamera} style={miniButtonStyle}>
              촬영 변경
            </button>
            <button onClick={onLibrary} style={miniButtonStyle}>
              사진첩 변경
            </button>
            <button onClick={onDelete} style={miniDangerButtonStyle}>
              삭제
            </button>
          </div>
        </div>
      ) : (
        <div style={imageSlotActionRowStyle}>
          <button onClick={onCamera} style={grayButtonStyle}>
            사진 촬영
          </button>
          <button onClick={onLibrary} style={darkButtonStyle}>
            사진첩에서 가져오기
          </button>
        </div>
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(37, 99, 235, 0.26), transparent 32%), linear-gradient(180deg, #061121 0%, #07152b 52%, #020817 100%)",
  color: "#f8fafc",
  padding:
    "max(22px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom))",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
};
const heroStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  margin: "0 auto",
  padding: "18px 0 12px",
};
const eyebrowStyle: CSSProperties = {
  color: "#9fb3c8",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.22em",
  marginBottom: 14,
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(30px, 9vw, 42px)",
  lineHeight: 1.08,
  letterSpacing: "-0.06em",
  fontWeight: 950,
  wordBreak: "keep-all",
};
const datePillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: 14,
  padding: "9px 14px",
  borderRadius: 999,
  background: "rgba(37, 99, 235, 0.18)",
  border: "1px solid rgba(147, 197, 253, 0.28)",
  color: "#dbeafe",
  fontSize: 15,
  fontWeight: 800,
};
const descriptionStyle: CSSProperties = {
  margin: "18px 0 0",
  color: "#b8c5d8",
  fontSize: 16,
  lineHeight: 1.65,
  wordBreak: "keep-all",
};
const stackStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  margin: "18px auto 0",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const cardStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 18,
  borderRadius: 24,
  background: "rgba(8, 20, 39, 0.84)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
  overflow: "hidden",
};
const cardLabelStyle: CSSProperties = {
  color: "#9fb3c8",
  fontSize: 13,
  letterSpacing: "0.12em",
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 8,
};
const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.25,
  letterSpacing: "-0.04em",
  fontWeight: 900,
  wordBreak: "keep-all",
};
const cardDescriptionStyle: CSSProperties = {
  margin: "12px 0 16px",
  color: "#b8c5d8",
  fontSize: 15,
  lineHeight: 1.6,
  wordBreak: "keep-all",
};
const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  border: "none",
  borderRadius: 16,
  color: "white",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};
const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  marginTop: 16,
  background: "#2563eb",
};
const greenButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#16a34a",
};
const grayButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#334155",
};
const darkButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#111827",
  border: "1px solid rgba(148, 163, 184, 0.22)",
};
const buttonStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const infoListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 14,
};
const infoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "86px 1fr",
  gap: 10,
  alignItems: "start",
  padding: "10px 0",
  borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
};
const infoLabelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 800,
};
const infoValueStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: 15,
  lineHeight: 1.45,
  fontWeight: 800,
  wordBreak: "break-word",
};
const imageListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 14,
};
const imagePreviewButtonStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "76px 1fr",
  gap: 12,
  alignItems: "center",
  width: "100%",
  padding: 10,
  borderRadius: 16,
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  color: "white",
  textAlign: "left",
};
const imagePreviewStyle: CSSProperties = {
  width: 76,
  height: 76,
  objectFit: "cover",
  borderRadius: 12,
  background: "#111827",
};
const imageTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 15,
  fontWeight: 900,
};
const imageDateStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 700,
};
const noteStyle: CSSProperties = {
  width: "100%",
  minHeight: 130,
  boxSizing: "border-box",
  margin: "14px 0 12px",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "#020817",
  color: "white",
  fontSize: 16,
  lineHeight: 1.5,
  resize: "vertical",
};
const imageSlotListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  marginTop: 14,
};

const imageSlotCardStyle: CSSProperties = {
  border: "1px solid #26374f",
  borderRadius: 18,
  background: "#071426",
  padding: 14,
};

const imageSlotTitleStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: 16,
  fontWeight: 950,
  marginBottom: 4,
};

const imageSlotDescStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.45,
  marginBottom: 12,
};

const imageSlotSavedStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const imageSlotActionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const miniButtonStyle: CSSProperties = {
  padding: "10px 8px",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e5edf7",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniDangerButtonStyle: CSSProperties = {
  ...miniButtonStyle,
  background: "#450a0a",
  border: "1px solid #991b1b",
  color: "#fecaca",
};

const statusToggleStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  margin: "12px 0 16px",
};

const statusButtonStyle: CSSProperties = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const statusActiveButtonStyle: CSSProperties = {
  ...statusButtonStyle,
  background: "#14532d",
  border: "1px solid #22c55e",
  color: "#dcfce7",
};

const statusIssueButtonStyle: CSSProperties = {
  ...statusButtonStyle,
  background: "#7c2d12",
  border: "1px solid #fb923c",
  color: "#ffedd5",
};

const fieldBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 12,
};

const fieldLabelStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "#f8fafc",
  fontSize: 15,
  fontWeight: 800,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
};

const orangeButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "none",
  background: "#f97316",
  color: "white",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const notionSavedBoxStyle: CSSProperties = {
  marginTop: 14,
  border: "1px solid #14532d",
  background: "#052e16",
  borderRadius: 16,
  padding: 12,
};

const notionSavedTextStyle: CSSProperties = {
  color: "#bbf7d0",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 10,
};

const resetButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const notionIssueSavedBoxStyle: CSSProperties = {
  marginTop: 14,
  border: "1px solid #9a3412",
  background: "#431407",
  borderRadius: 16,
  padding: 12,
};

const notionIssueSavedTextStyle: CSSProperties = {
  color: "#fed7aa",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 10,
};

const dangerButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const noticeStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "rgba(250, 204, 21, 0.12)",
  border: "1px solid rgba(250, 204, 21, 0.26)",
  color: "#fde68a",
  fontSize: 14,
  lineHeight: 1.5,
};
const footerStyle: CSSProperties = {
  maxWidth: 520,
  margin: "24px auto 0",
  padding: "8px 0",
  color: "#64748b",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 800,
};
