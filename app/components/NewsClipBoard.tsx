"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyClipFormat,
  clipHasImage,
  clipPlainText,
  clipTextLines,
  compressClipHtml,
  createClipExpiry,
  deleteNewsClip,
  extractUrls,
  legacyAutoTitle,
  lookupArticleTitle,
  imageFileToDataUrl,
  importNewsClipFile,
  insertClipHtml,
  loadNewsClips,
  normalizeClipUrl,
  publishNewsClipIndex,
  readClipboardImages,
  remainingDays,
  resolveClipTitle,
  sanitizeClipHtml,
  saveNewsClip,
  saveNewsClipFile,
  textToClipHtml,
  type NewsClip,
} from "../lib/news-clips";

type BoardMode = "edit" | "index";

const MAX_SUMMARY_LENGTH = 4000;

function clipDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function clipShareText(clip: NewsClip): string {
  const head = [clip.title.trim(), clipDateLabel(clip.createdAt), clip.url.trim()]
    .filter(Boolean)
    .join("\n");
  const summary = clip.summary?.trim() ?? "";
  const body = clipTextLines(clip.html).join("\n");
  return [head, summary, body].filter(Boolean).join("\n\n");
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Some browsers reject the async clipboard API even after a click.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

function ClipHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={`clip-content ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeClipHtml(html) }}
    />
  );
}

export default function NewsClipBoard({
  active,
  openSession,
  focusClipId,
  onClose,
}: {
  active: boolean;
  openSession: number;
  focusClipId?: string | null;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingHtmlRef = useRef("");
  const openSessionRef = useRef(0);
  const indexSyncedRef = useRef(false);
  const [clipsReady, setClipsReady] = useState(false);
  const [mode, setMode] = useState<BoardMode>("edit");
  const [clips, setClips] = useState<NewsClip[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [notice, setNotice] = useState("");
  const [editKey, setEditKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [starOnly, setStarOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryEditorId, setSummaryEditorId] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryStatus, setSummaryStatus] = useState("");
  const [summaryOpenIds, setSummaryOpenIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const repairGateRef = useRef<Promise<void> | null>(null);
  const clipsRef = useRef<NewsClip[]>([]);
  const summaryTimerRef = useRef<number | null>(null);
  const summaryEditorIdRef = useRef<string | null>(null);
  const summarySaveRef = useRef<Promise<void>>(Promise.resolve());
  const summaryInputRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const visibleClips = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clips.filter((clip) => {
      if (starOnly && !clip.permanent) return false;
      if (!needle) return true;
      const haystack = `${clip.title}\n${clip.url}\n${clipPlainText(clip.html)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [clips, query, starOnly]);

  function ensureLegacyTitleRepair(): Promise<void> {
    if (!repairGateRef.current) {
      repairGateRef.current = (async () => {
        const result = await loadNewsClips();
        const repaired: NewsClip[] = [];
        for (const clip of result.clips) {
          if (!clip.url) continue;
          if (clip.title !== legacyAutoTitle(clipPlainText(clip.html))) continue;
          const headline = await lookupArticleTitle(clip.url);
          if (!headline || headline === clip.title) continue;
          const updated = { ...clip, title: headline };
          await saveNewsClip(updated);
          repaired.push(updated);
        }
        if (repaired.length > 0) {
          await publishNewsClipIndex(
            repaired.map((clip) => ({
              id: clip.id,
              title: clip.title,
              createdAt: clip.createdAt,
              deleted: false,
            })),
          );
        }
      })().catch(() => {
        repairGateRef.current = null;
      });
    }
    return repairGateRef.current;
  }

  async function refresh(showExpiryNotice = false) {
    await flushSummaryDraft();
    await ensureLegacyTitleRepair();
    const result = await loadNewsClips();
    const editingSummaryId = summaryEditorIdRef.current;
    let nextClips = result.clips;
    if (editingSummaryId) {
      const draftClip = clipsRef.current.find((item) => item.id === editingSummaryId);
      if (draftClip) {
        nextClips = result.clips.map((item) =>
          item.id === editingSummaryId ? { ...item, summary: draftClip.summary ?? "" } : item,
        );
      }
    }
    clipsRef.current = nextClips;
    setClips(nextClips);
    setClipsReady(true);
    if (!indexSyncedRef.current) {
      indexSyncedRef.current = true;
      void publishNewsClipIndex(
        result.clips.map((clip) => ({
          id: clip.id,
          title: clip.title,
          createdAt: clip.createdAt,
          deleted: false,
        })),
      );
    }
    if (showExpiryNotice && result.removedCount > 0) {
      setNotice(`30일이 지난 ${result.removedCount}건을 삭제했습니다.`);
    }
    return nextClips;
  }

  useEffect(() => {
    let cancelled = false;
    ensureLegacyTitleRepair()
      .then(() => loadNewsClips())
      .then((result) => {
        if (cancelled) return;
        clipsRef.current = result.clips;
        setClips(result.clips);
        setClipsReady(true);
        if (!indexSyncedRef.current) {
          indexSyncedRef.current = true;
          void publishNewsClipIndex(
            result.clips.map((clip) => ({
              id: clip.id,
              title: clip.title,
              createdAt: clip.createdAt,
              deleted: false,
            })),
          );
        }
        if (result.removedCount > 0) {
          setNotice(`30일이 지난 ${result.removedCount}건을 삭제했습니다.`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice("저장된 뉴스를 불러오지 못했습니다.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh(true).catch(() => {
      setNotice("저장된 뉴스를 불러오지 못했습니다.");
    });
  }, [active]);

  useEffect(() => {
    if (!openSession || openSessionRef.current === openSession) return;
    openSessionRef.current = openSession;
    setMode("edit");
  }, [openSession]);

  useEffect(() => {
    if (!focusClipId || !clipsReady) return;
    setMode("index");
    const found = clips.some((clip) => clip.id === focusClipId);
    if (found) {
      setViewingId(focusClipId);
      return;
    }
    let cancelled = false;
    fetch("/api/news-clip-index", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: { id?: string; deleted?: boolean }[] }) => {
        if (cancelled) return;
        const row = (data.items || []).find((item) => item.id === focusClipId);
        setNotice(
          row?.deleted
            ? "일기장에서 연 이 뉴스는 삭제되어 본문이 없습니다."
            : "이 기기에서 해당 뉴스 본문을 찾지 못했습니다.",
        );
      })
      .catch(() => {
        if (!cancelled) setNotice("이 기기에서 해당 뉴스 본문을 찾지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [clips, clipsReady, focusClipId]);

  useEffect(() => {
    const normalized = normalizeClipUrl(url);
    if (!normalized || title.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void lookupArticleTitle(normalized).then((headline) => {
        if (cancelled || !headline) return;
        setTitle((current) => current.trim() || headline);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [title, url]);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    summaryEditorIdRef.current = summaryEditorId;
  }, [summaryEditorId]);

  useEffect(() => {
    if (!summaryEditorId) return;
    summaryInputRef.current?.focus();
  }, [summaryEditorId]);

  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) window.clearTimeout(summaryTimerRef.current);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      const id = summaryEditorIdRef.current;
      const clip = id ? clipsRef.current.find((item) => item.id === id) : null;
      if (clip) void saveNewsClip(clip);
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit") return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = pendingHtmlRef.current;
  }, [editKey, mode]);

  function beginEdit(clip?: NewsClip) {
    void closeSummaryEditor();
    setViewingId(null);
    setEditingId(clip?.id ?? null);
    setTitle(clip?.title && clip.title !== "제목 없음" ? clip.title : "");
    setUrl(clip?.url ?? "");
    setPermanent(Boolean(clip?.permanent));
    pendingHtmlRef.current = clip?.html ?? "";
    setMode("edit");
    setEditKey((current) => current + 1);
    setNotice("");
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    const data = event.clipboardData;
    const html = data.getData("text/html");
    const text = data.getData("text/plain");
    const files = readClipboardImages(data);
    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null;

    setBusy(true);
    try {
      let fragment = html.trim()
        ? sanitizeClipHtml(html)
        : text
          ? textToClipHtml(text)
          : "";
      if (!clipHasImage(fragment) && files.length > 0) {
        const sources = await Promise.all(files.map((file) => imageFileToDataUrl(file)));
        fragment += sources
          .map((src) => `<img src="${src}" alt="" referrerpolicy="no-referrer">`)
          .join("");
        fragment = sanitizeClipHtml(fragment);
      }
      fragment = await compressClipHtml(fragment);
      if (!fragment) {
        setNotice("붙여 넣을 글이나 이미지를 찾지 못했습니다.");
        return;
      }
      insertClipHtml(editor, fragment, range);
      let nextUrl = url.trim();
      if (!nextUrl) {
        const urls = extractUrls(html, text);
        if (urls.length === 1) {
          nextUrl = urls[0];
          setUrl(nextUrl);
        }
      }
      if (!editingId) {
        await handleSave({ urlValue: nextUrl, titleValue: title });
      }
    } catch {
      setNotice("붙여 넣기에 실패했습니다. 글과 이미지를 다시 복사해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function insertImageFiles(files: File[]) {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;
    setBusy(true);
    try {
      const sources = await Promise.all(files.map((file) => imageFileToDataUrl(file)));
      const html = sanitizeClipHtml(
        sources
          .map((src) => `<img src="${src}" alt="" referrerpolicy="no-referrer">`)
          .join(""),
      );
      insertClipHtml(editor, html, null);
    } catch {
      setNotice("이미지를 넣지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(overrides?: { urlValue?: string; titleValue?: string }) {
    const editor = editorRef.current;
    if (!editor) return;
    const normalizedUrl = normalizeClipUrl(overrides?.urlValue ?? url);
    const typedTitle = overrides?.titleValue ?? title;
    if (normalizedUrl === null) {
      setNotice("URL은 http 또는 https 주소로 입력해 주세요.");
      return;
    }

    setBusy(true);
    try {
      const html = await compressClipHtml(editor.innerHTML);
      const plain = clipPlainText(html);
      if (!plain && !clipHasImage(html) && !normalizedUrl) {
        setNotice("글, 이미지, URL 중 하나는 입력해 주세요.");
        return;
      }

      const existing =
        clipsRef.current.find((clip) => clip.id === editingId) ??
        clips.find((clip) => clip.id === editingId);
      const createdAt = existing?.createdAt ?? new Date().toISOString();
      const clip: NewsClip = {
        id: editingId ?? crypto.randomUUID(),
        title: await resolveClipTitle({ typed: typedTitle, url: normalizedUrl, html }),
        url: normalizedUrl,
        html,
        createdAt,
        expiresAt: existing?.expiresAt ?? createClipExpiry(createdAt),
        permanent,
        summary: existing?.summary ?? "",
      };
      await saveNewsClip(clip);
      const sent = await publishNewsClipIndex([
        {
          id: clip.id,
          title: clip.title,
          createdAt: clip.createdAt,
          deleted: false,
        },
      ]);
      await refresh(false);
      pendingHtmlRef.current = "";
      setEditingId(null);
      setTitle("");
      setUrl("");
      setPermanent(false);
      setMode("index");
      const diaryNote = sent
        ? "일기장 정보 인덱스에는 일자, 제목, NEWS로 보냈습니다."
        : "일기장 정보 인덱스에는 보내지 못했습니다.";
      setNotice(
        permanent
          ? `별표로 영구 보관했습니다. 목록에 계속 남습니다. ${diaryNote}`
          : `이 기기에 저장했습니다. 30일 후 자동으로 삭제됩니다. ${diaryNote}`,
      );
    } catch {
      setNotice("저장에 실패했습니다. 이미지 용량을 줄여 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePermanent(clip: NewsClip) {
    await flushSummaryDraft();
    const latest = clipsRef.current.find((item) => item.id === clip.id) ?? clip;
    const nextPermanent = !latest.permanent;
    const expiresAt =
      !nextPermanent && new Date(latest.expiresAt).getTime() <= Date.now()
        ? createClipExpiry(new Date().toISOString())
        : latest.expiresAt;
    await saveNewsClip({ ...latest, permanent: nextPermanent, expiresAt });
    await refresh(false);
    setNotice(
      nextPermanent
        ? "별표 표시로 영구 보관합니다. 목록에 계속 남습니다."
        : "영구 보관을 해제했습니다. 30일 후 자동으로 삭제됩니다.",
    );
  }

  async function handleDelete(id: string) {
    const clip = clips.find((item) => item.id === id);
    const confirmed = window.confirm("이 저장 글을 삭제할까요? 일기장에는 삭제됨으로 남습니다.");
    if (!confirmed) return;
    await deleteNewsClip(id);
    if (viewingId === id) setViewingId(null);
    const sent = clip
      ? await publishNewsClipIndex([
          {
            id: clip.id,
            title: clip.title,
            createdAt: clip.createdAt,
            deleted: true,
          },
        ])
      : false;
    await refresh(false);
    setNotice(
      sent
        ? "본문을 삭제했습니다. 일기장 정보 인덱스에는 삭제됨으로 표시됩니다."
        : "이 앱에서는 삭제했습니다. 일기장 삭제 표시는 보내지 못했습니다.",
    );
  }

  async function writeClipNow(id: string) {
    const clip = clipsRef.current.find((item) => item.id === id);
    if (!clip) return;
    try {
      await saveNewsClip(clip);
      if (summaryEditorIdRef.current === id) {
        setSummaryStatus(clip.summary?.trim() ? "저장됨" : "");
      }
    } catch {
      if (summaryEditorIdRef.current === id) setSummaryStatus("저장 실패");
    }
  }

  async function flushSummaryDraft() {
    if (summaryTimerRef.current) {
      window.clearTimeout(summaryTimerRef.current);
      summaryTimerRef.current = null;
      const id = summaryEditorIdRef.current;
      if (id) {
        const pending = writeClipNow(id);
        summarySaveRef.current = summarySaveRef.current.then(() => pending);
      }
    }
    await summarySaveRef.current;
  }

  function onSummaryDraft(id: string, value: string) {
    const summary = value.slice(0, MAX_SUMMARY_LENGTH);
    setSummaryDraft(summary);
    setClips((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, summary } : item));
      clipsRef.current = next;
      return next;
    });
    setSummaryStatus("저장 중");
    if (summaryTimerRef.current) window.clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = window.setTimeout(() => {
      summaryTimerRef.current = null;
      const pending = writeClipNow(id);
      summarySaveRef.current = summarySaveRef.current.then(() => pending);
    }, 500);
  }

  function openSummaryEditor(clip: NewsClip) {
    summaryEditorIdRef.current = clip.id;
    setSummaryEditorId(clip.id);
    setSummaryDraft(clip.summary ?? "");
    setSummaryStatus(clip.summary?.trim() ? "저장됨" : "");
  }

  async function closeSummaryEditor() {
    await flushSummaryDraft();
    summaryEditorIdRef.current = null;
    setSummaryEditorId(null);
    setSummaryStatus("");
  }

  function toggleSummaryOpen(id: string) {
    setSummaryOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyLabel(id: string) {
    if (copiedId === id) return "복사함";
    if (copiedId === `fail:${id}`) return "복사 실패";
    return "전체 복사";
  }

  async function copyClip(clip: NewsClip) {
    await flushSummaryDraft();
    const latest = clipsRef.current.find((item) => item.id === clip.id) ?? clip;
    const copied = await writeClipboard(clipShareText(latest));
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    setCopiedId(copied ? clip.id : `fail:${clip.id}`);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedId((current) => (current === clip.id || current === `fail:${clip.id}` ? null : current));
    }, 1600);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    const latest = await refresh(false);
    const chosen = latest.filter((clip) => selectedIds.has(clip.id));
    if (chosen.length === 0) {
      setNotice("앱 파일로 저장할 뉴스를 체크해 주세요.");
      return;
    }
    await saveNewsClipFile(chosen);
    setNotice(`체크한 ${chosen.length}건을 앱 파일로 저장했습니다. 같은 파일로 다시 불러올 수 있습니다.`);
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const result = await importNewsClipFile(file);
      await refresh(false);
      setMode("index");
      setNotice(
        `파일에서 ${result.imported}건을 불러왔습니다.${
          result.skipped > 0 ? ` 기간이 지난 ${result.skipped}건은 제외했습니다.` : ""
        }`,
      );
    } catch {
      setNotice("파일을 불러오지 못했습니다. 이 앱에서 저장한 파일인지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">📝</span>
            <h2 className="text-3xl font-bold text-gray-800">뉴스 저장</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            글을 붙여 넣으면 이 기기에 저장되고 인덱스로 보내집니다. 일기장 정보 인덱스에는 일자, 제목, 발생처 NEWS만 전달되고, 수정과 본문 보기는 이 앱에서 합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (editorRef.current) {
                pendingHtmlRef.current = editorRef.current.innerHTML;
              }
              setMode("edit");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              mode === "edit" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            작성
          </button>
          <button
            type="button"
            onClick={() => beginEdit()}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            새 글
          </button>
          <button
            type="button"
            onClick={() => {
              if (editorRef.current) {
                pendingHtmlRef.current = editorRef.current.innerHTML;
              }
              setMode("index");
              setNotice("");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              mode === "index" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            일기 인덱스 {clips.length}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            접기
          </button>
        </div>
      </div>

      {notice && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {notice}
        </p>
      )}

      {mode === "edit" ? (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="비워 두면 기사 맨 위 제목을 사용합니다."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">기사 URL</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              inputMode="url"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-400"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editorRef.current && applyClipFormat(editorRef.current, "highlight")}
              className="rounded-full bg-yellow-200 px-4 py-2 text-sm font-bold text-gray-900"
            >
              노란 형광
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editorRef.current && applyClipFormat(editorRef.current, "bold")}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-900"
            >
              굵게
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editorRef.current && applyClipFormat(editorRef.current, "red")}
              className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
            >
              빨간 글자
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              이미지 추가
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void insertImageFiles(files);
              }}
            />
          </div>

          <p className="text-xs text-gray-500">
            읽기 모드에서 복사한 글과 이미지를 아래에 붙여 넣으면 저장되고 인덱스로 이동합니다. 제목은 기사 주소의 맨 위 제목을 사용합니다.
          </p>

          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label="뉴스 내용"
            contentEditable
            suppressContentEditableWarning
            onPaste={handlePaste}
            className="clip-editor min-h-56 rounded-2xl border border-gray-200 px-4 py-3 text-base leading-relaxed text-gray-900 outline-none focus:border-blue-400"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPermanent((current) => !current)}
              aria-pressed={permanent}
              className={`rounded-full px-4 py-2.5 text-sm font-bold ${
                permanent ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {permanent ? "★ 영구 보관" : "☆ 영구 보관"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "저장 중..." : "저장하고 인덱스로 보내기"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (editorRef.current) {
                  pendingHtmlRef.current = editorRef.current.innerHTML;
                }
                setMode("index");
              }}
              className="rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700"
            >
              인덱스로 이동
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">제목, 내용, URL 검색</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="제목, 내용, URL로 찾기"
                  aria-label="제목, 내용, URL 검색"
                  className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
                />
              </label>
              <button
                type="button"
                onClick={() => setStarOnly((current) => !current)}
                aria-pressed={starOnly}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  starOnly ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {starOnly ? "★ 영구 보관만" : "☆ 영구 보관만"}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {starOnly
                ? `별표한 영구 보관 ${visibleClips.length}건입니다. 항목을 누르면 전체 내용을 봅니다.`
                : `저장한 내용 ${visibleClips.length}건입니다. 체크한 뉴스만 앱 파일로 저장되고, 항목을 누르면 전체 내용을 봅니다.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleExport()}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {selectedIds.size > 0 ? `앱 파일로 저장 (${selectedIds.size})` : "앱 파일로 저장"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                파일 불러오기
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleImport(file);
                }}
              />
            </div>
            </div>
          </div>

          {clips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              아직 저장된 뉴스가 없습니다. 작성 화면에 붙여 넣으면 저장되고 인덱스로 이동합니다.
            </div>
          ) : visibleClips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              {starOnly && !query.trim()
                ? "영구 보관으로 별표한 글이 없습니다."
                : "찾는 제목이나 내용이 없습니다."}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleClips.map((clip) => (
                <article
                  key={clip.id}
                  id={`news-clip-${clip.id}`}
                  className="rounded-2xl border border-gray-100 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(clip.id)}
                      onChange={() => toggleSelected(clip.id)}
                      aria-label={`${clip.title} 앱 파일로 선택`}
                      className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => void handleTogglePermanent(clip)}
                      aria-pressed={Boolean(clip.permanent)}
                      aria-label={clip.permanent ? "영구 보관 해제" : "영구 보관"}
                      title={clip.permanent ? "영구 보관 중" : "별표를 누르면 영구 보관됩니다"}
                      className={`mt-0.5 text-xl leading-none ${
                        clip.permanent ? "text-amber-500" : "text-gray-300 hover:text-amber-400"
                      }`}
                    >
                      {clip.permanent ? "★" : "☆"}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setViewingId(clip.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <h3 className="text-base font-bold text-gray-900">{clip.title}</h3>
                          <p className="mt-1 text-xs text-gray-500">
                            {clipDateLabel(clip.createdAt)}
                            {" · "}
                            {clip.permanent ? (
                              <span className="font-bold text-amber-600">영구 보관</span>
                            ) : (
                              <span>{remainingDays(clip.expiresAt)}일 후 삭제</span>
                            )}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-3 pt-0.5">
                          {clip.summary?.trim() ? (
                            <button
                              type="button"
                              onClick={() => toggleSummaryOpen(clip.id)}
                              aria-expanded={summaryOpenIds.has(clip.id)}
                              className="text-sm font-bold text-yellow-600"
                            >
                              요약
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void copyClip(clip)}
                            className="text-sm font-bold text-blue-600"
                          >
                            {copyLabel(clip.id)}
                          </button>
                        </div>
                      </div>
                      {summaryOpenIds.has(clip.id) && clip.summary?.trim() ? (
                        <div className="mt-2 rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                          {clip.summary.trim()}
                        </div>
                      ) : null}
                      {clip.url && (
                        <a
                          href={clip.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block max-w-full truncate text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {clip.url}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
      {(() => {
        const viewing = clips.find((clip) => clip.id === viewingId);
        if (!viewing) return null;
        return (
          <div className="fixed inset-0 z-[80] flex flex-col bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <p className="text-sm font-bold text-gray-500">저장된 뉴스</p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (summaryEditorId === viewing.id) void closeSummaryEditor();
                    else openSummaryEditor(viewing);
                  }}
                  aria-expanded={summaryEditorId === viewing.id}
                  className="px-2 py-2 text-sm font-bold text-yellow-600"
                >
                  요약
                </button>
                <button
                  type="button"
                  onClick={() => void copyClip(viewing)}
                  className="px-2 py-2 text-sm font-bold text-blue-600"
                >
                  {copyLabel(viewing.id)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void closeSummaryEditor();
                    setViewingId(null);
                  }}
                  className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTogglePermanent(viewing)}
                    aria-pressed={Boolean(viewing.permanent)}
                    aria-label={viewing.permanent ? "영구 보관 해제" : "영구 보관"}
                    className={`mt-1 text-2xl leading-none ${
                      viewing.permanent ? "text-amber-500" : "text-gray-300"
                    }`}
                  >
                    {viewing.permanent ? "★" : "☆"}
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">{viewing.title}</h2>
                </div>
                {summaryEditorId === viewing.id ? (
                  <div className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3">
                    <textarea
                      ref={summaryInputRef}
                      value={summaryDraft}
                      onChange={(event) => onSummaryDraft(viewing.id, event.target.value)}
                      onBlur={() => {
                        void flushSummaryDraft();
                      }}
                      rows={4}
                      maxLength={MAX_SUMMARY_LENGTH}
                      placeholder="요약을 입력하면 자동으로 저장됩니다."
                      aria-label="뉴스 요약"
                      className="w-full resize-y bg-transparent text-sm leading-relaxed text-gray-900 outline-none"
                    />
                    {summaryStatus ? (
                      <p className="mt-2 text-xs font-semibold text-yellow-700">{summaryStatus}</p>
                    ) : null}
                  </div>
                ) : viewing.summary?.trim() ? (
                  <div className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                    {viewing.summary.trim()}
                  </div>
                ) : null}
                <p className="mt-2 text-sm text-gray-500">
                  {clipDateLabel(viewing.createdAt)}
                  {" · "}
                  {viewing.permanent
                    ? "영구 보관"
                    : `${remainingDays(viewing.expiresAt)}일 후 삭제`}
                </p>
                {viewing.url && (
                  <a
                    href={viewing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block break-all text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {viewing.url}
                  </a>
                )}
                {viewing.html && (
                  <ClipHtml
                    html={viewing.html}
                    className="mt-6 text-base leading-relaxed text-gray-800"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => beginEdit(viewing)}
                className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(viewing.id)}
                className="rounded-full px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
