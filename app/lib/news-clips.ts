export const CLIP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CLIP_FILE_VERSION = 1;

const DB_NAME = "newsflash-clips";
const STORE = "clips";
const DB_VERSION = 1;
const MAX_IMAGE_WIDTH = 1280;
const MAX_IMPORT_CLIPS = 100;
const MAX_HTML_LENGTH = 2_000_000;

export type ClipFormat = "bold" | "highlight" | "red";

export type NewsClip = {
  id: string;
  title: string;
  url: string;
  html: string;
  createdAt: string;
  expiresAt: string;
  permanent?: boolean;
};

export type NewsClipFile = {
  version: number;
  exportedAt: string;
  clips: NewsClip[];
};

type Marks = {
  bold: boolean;
  highlight: boolean;
  red: boolean;
};

const EMPTY_MARKS: Marks = { bold: false, highlight: false, red: false };

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TR",
  "BLOCKQUOTE",
  "SECTION",
  "ARTICLE",
  "UL",
  "OL",
  "TABLE",
  "HEADER",
  "FOOTER",
  "FIGCAPTION",
  "PRE",
]);

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "SVG",
  "META",
  "LINK",
  "HEAD",
]);

const NAMED_COLORS: Record<string, [number, number, number]> = {
  yellow: [255, 255, 0],
  gold: [255, 215, 0],
  red: [255, 0, 0],
  crimson: [220, 20, 60],
  firebrick: [178, 34, 34],
  darkred: [139, 0, 0],
  orangered: [255, 69, 0],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function parseColor(input: string): { r: number; g: number; b: number } | null {
  const value = input.trim().toLowerCase().replace(/!important/g, "").trim();
  if (NAMED_COLORS[value]) {
    const [r, g, b] = NAMED_COLORS[value];
    return { r, g, b };
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((char) => char + char)
        .join("");
    }
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = value.match(
    /^rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/i,
  );
  if (!rgb) return null;
  return {
    r: Number(rgb[1]),
    g: Number(rgb[2]),
    b: Number(rgb[3]),
  };
}

function isYellowish(color: { r: number; g: number; b: number }): boolean {
  return (
    color.r >= 230 &&
    color.g >= 190 &&
    color.b <= 210 &&
    color.r - color.b >= 30 &&
    color.g - color.b >= 20
  );
}

function isReddish(color: { r: number; g: number; b: number }): boolean {
  return (
    color.r >= 140 &&
    color.g <= 100 &&
    color.b <= 100 &&
    color.r > color.g * 2 &&
    color.r > color.b * 2
  );
}

function styleValue(style: string, prop: string): string | null {
  const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return match ? match[1].trim() : null;
}

function firstColor(value: string | null): { r: number; g: number; b: number } | null {
  if (!value) return null;
  const token = value.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}\b|[a-z]+/i);
  if (!token) return null;
  return parseColor(token[0]);
}

function isBold(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") return true;
  const weight = styleValue(el.getAttribute("style") || "", "font-weight");
  if (!weight) return false;
  if (weight === "bold" || weight === "bolder") return true;
  const numeric = Number.parseInt(weight, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

function isHighlight(el: HTMLElement): boolean {
  if (el.tagName === "MARK") return true;
  const style = el.getAttribute("style") || "";
  const background =
    firstColor(styleValue(style, "background-color")) ||
    firstColor(styleValue(style, "background"));
  return background ? isYellowish(background) : false;
}

function isRed(el: HTMLElement): boolean {
  if (el.classList.contains("clip-red")) return true;
  const style = el.getAttribute("style") || "";
  const color =
    firstColor(styleValue(style, "color")) ||
    firstColor(el.getAttribute("color"));
  return color ? isReddish(color) : false;
}

function isSafeImageSrc(src: string): boolean {
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) return true;
  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function wrapText(text: string, marks: Marks): string {
  return text
    .split("\n")
    .map((part) => {
      if (!part) return "";
      const escaped = escapeHtml(part);
      if (!part.trim()) return escaped;
      let out = escaped;
      if (marks.red) out = `<span class="clip-red">${out}</span>`;
      if (marks.highlight) out = `<mark>${out}</mark>`;
      if (marks.bold) out = `<strong>${out}</strong>`;
      return out;
    })
    .join("<br>");
}

function renderNode(node: Node, marks: Marks): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return wrapText(node.textContent ?? "", marks);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return "";
  if (tag === "BR") return "<br>";

  if (tag === "IMG") {
    const src = el.getAttribute("src")?.trim() ?? "";
    if (!isSafeImageSrc(src)) return "";
    const alt = escapeAttr(el.getAttribute("alt") ?? "");
    return `<img src="${escapeAttr(src)}" alt="${alt}" referrerpolicy="no-referrer">`;
  }

  const next: Marks = {
    bold: marks.bold || isBold(el),
    highlight: marks.highlight || isHighlight(el),
    red: marks.red || isRed(el),
  };

  let inner = "";
  el.childNodes.forEach((child) => {
    inner += renderNode(child, next);
  });

  if (!inner) return "";
  if (BLOCK_TAGS.has(tag)) return `${inner}<br>`;
  return inner;
}

export function sanitizeClipHtml(html: string): string {
  if (!html.trim() || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  let rendered = "";
  doc.body.childNodes.forEach((child) => {
    rendered += renderNode(child, EMPTY_MARKS);
  });
  return rendered
    .replace(/(?:<br>\s*){3,}/g, "<br><br>")
    .replace(/^(?:<br>\s*)+/, "")
    .replace(/(?:<br>\s*)+$/, "")
    .trim();
}

export function clipPlainText(html: string): string {
  if (!html.trim() || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function clipHasImage(html: string): boolean {
  return /<img\b/i.test(html);
}

export function deriveClipTitle(plain: string): string {
  const title = plain.replace(/\s+/g, " ").trim().slice(0, 40);
  return title || "제목 없음";
}

export function normalizeClipUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractUrls(html: string, text: string): string[] {
  const urls: string[] = [];
  const push = (value: string) => {
    const normalized = normalizeClipUrl(value.replace(/[),.\]]+$/, ""));
    if (normalized) urls.push(normalized);
  };

  if (html && typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("a[href]").forEach((anchor) => {
      push(anchor.getAttribute("href") || "");
    });
  }

  for (const match of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    push(match);
  }
  return [...new Set(urls)];
}

export function textToClipHtml(text: string): string {
  return sanitizeClipHtml(
    text
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join(""),
  );
}

export function remainingDays(expiresAt: string, now = Date.now()): number {
  const diff = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function createClipExpiry(createdAt: string): string {
  const created = new Date(createdAt);
  const base = Number.isNaN(created.getTime()) ? Date.now() : created.getTime();
  return new Date(base + CLIP_RETENTION_MS).toISOString();
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNewsClips(): Promise<{
  clips: NewsClip[];
  removedCount: number;
}> {
  const db = await openDb();
  try {
    const clips: NewsClip[] = [];
    let removedCount = 0;
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const now = Date.now();

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const value = cursor.value as NewsClip;
        if (!value.permanent && new Date(value.expiresAt).getTime() <= now) {
          cursor.delete();
          removedCount += 1;
        } else {
          clips.push(value);
        }
        cursor.continue();
      };
    });

    await txComplete(tx);
    clips.sort((a, b) => {
      const permanentOrder = Number(Boolean(b.permanent)) - Number(Boolean(a.permanent));
      if (permanentOrder !== 0) return permanentOrder;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return { clips, removedCount };
  } finally {
    db.close();
  }
}

export async function saveNewsClip(clip: NewsClip): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(clip);
    await txComplete(tx);
  } finally {
    db.close();
  }
}

export async function deleteNewsClip(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txComplete(tx);
  } finally {
    db.close();
  }
}

export type NewsClipIndexPayload = {
  id: string;
  title: string;
  createdAt: string;
  deleted: boolean;
};

export async function publishNewsClipIndex(items: NewsClipIndexPayload[]): Promise<boolean> {
  if (items.length === 0) return true;
  try {
    const response = await fetch("/api/news-clip-index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function saveNewsClipFile(clips: NewsClip[]): Promise<void> {
  const payload: NewsClipFile = {
    version: CLIP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    clips,
  };
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `newsflash-clips-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function importNewsClipFile(
  file: File,
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  const source = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.clips)
      ? parsed.clips
      : null;
  if (!source) {
    throw new Error("뉴스 저장 파일 형식이 아닙니다.");
  }

  const now = Date.now();
  let imported = 0;
  let skipped = 0;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);

    for (const item of source.slice(0, MAX_IMPORT_CLIPS)) {
      if (!isRecord(item) || typeof item.html !== "string") {
        skipped += 1;
        continue;
      }
      const createdAt =
        typeof item.createdAt === "string" && !Number.isNaN(new Date(item.createdAt).getTime())
          ? item.createdAt
          : new Date().toISOString();
      const permanent = item.permanent === true;
      const expiresAt =
        typeof item.expiresAt === "string" && !Number.isNaN(new Date(item.expiresAt).getTime())
          ? item.expiresAt
          : createClipExpiry(createdAt);
      if (!permanent && new Date(expiresAt).getTime() <= now) {
        skipped += 1;
        continue;
      }
      const html = sanitizeClipHtml(item.html).slice(0, MAX_HTML_LENGTH);
      const rawUrl = typeof item.url === "string" ? item.url : "";
      if (!html && !rawUrl.trim()) {
        skipped += 1;
        continue;
      }
      const clip: NewsClip = {
        id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
        title:
          typeof item.title === "string" && item.title.trim()
            ? item.title.trim().slice(0, 80)
            : deriveClipTitle(clipPlainText(html)),
        url: normalizeClipUrl(rawUrl) ?? "",
        html,
        createdAt,
        expiresAt,
        permanent,
      };
      store.put(clip);
      imported += 1;
    }

    if (source.length > MAX_IMPORT_CLIPS) {
      skipped += source.length - MAX_IMPORT_CLIPS;
    }
    await txComplete(tx);
    return { imported, skipped };
  } finally {
    db.close();
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function imageFileToDataUrl(file: Blob): Promise<string> {
  if (file.type === "image/gif" && file.size < 1_500_000) {
    return readAsDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_IMAGE_WIDTH / Math.max(bitmap.width, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return readAsDataUrl(file);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      bitmap.close();
    }
  } catch {
    return readAsDataUrl(file);
  }
}

export async function compressClipHtml(html: string): Promise<string> {
  const sanitized = sanitizeClipHtml(html);
  if (!sanitized || typeof DOMParser === "undefined") return sanitized;
  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const images = Array.from(doc.querySelectorAll("img"));
  for (const image of images) {
    const src = image.getAttribute("src") || "";
    if (!src.startsWith("data:image") || src.length < 350_000) continue;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const smaller = await imageFileToDataUrl(blob);
      if (isSafeImageSrc(smaller)) image.setAttribute("src", smaller);
    } catch {
      // Keep the original image if compression fails.
    }
  }
  return sanitizeClipHtml(doc.body.innerHTML);
}

export function readClipboardImages(data: DataTransfer): File[] {
  const seen = new Set<string>();
  const files: File[] = [];
  const add = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const key = `${file.type}:${file.size}:${file.name}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };
  Array.from(data.files).forEach(add);
  Array.from(data.items).forEach((item) => {
    if (item.kind === "file") add(item.getAsFile());
  });
  return files;
}

export function insertClipHtml(
  editor: HTMLElement,
  html: string,
  range: Range | null,
): void {
  editor.focus();
  const selection = window.getSelection();
  if (
    range &&
    selection &&
    editor.contains(range.commonAncestorContainer) &&
    range.startContainer.isConnected
  ) {
    selection.removeAllRanges();
    selection.addRange(range);
    range.deleteContents();
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last?.isConnected) {
      range.setStartAfter(last);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return;
  }
  editor.insertAdjacentHTML("beforeend", html);
}

function formatAncestor(
  node: Node | null,
  editor: HTMLElement,
  kind: ClipFormat,
): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      if (kind === "bold" && (current.tagName === "STRONG" || current.tagName === "B")) {
        return current;
      }
      if (kind === "highlight" && current.tagName === "MARK") return current;
      if (kind === "red" && current.classList.contains("clip-red")) return current;
    }
    current = current.parentNode;
  }
  return null;
}

function unwrap(element: HTMLElement): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

export function applyClipFormat(editor: HTMLElement, kind: ClipFormat): void {
  editor.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const ancestor = formatAncestor(range.commonAncestorContainer, editor, kind);
  const selectedText = range.toString();
  const ancestorText = ancestor?.textContent ?? "";
  if (
    ancestor &&
    selectedText &&
    ancestorText &&
    selectedText.length >= ancestorText.length
  ) {
    unwrap(ancestor);
    return;
  }

  if (range.collapsed) {
    document.execCommand("styleWithCSS", false, "true");
    if (kind === "bold") document.execCommand("bold");
    if (kind === "highlight") document.execCommand("hiliteColor", false, "#fff176");
    if (kind === "red") document.execCommand("foreColor", false, "#d32f2f");
    return;
  }

  const wrapper = document.createElement(
    kind === "bold" ? "strong" : kind === "highlight" ? "mark" : "span",
  );
  if (kind === "red") wrapper.className = "clip-red";
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  selection.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(wrapper);
  selection.addRange(next);
}
