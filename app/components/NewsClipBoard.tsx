"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyClipFormat,
  clipHasImage,
  clipPlainText,
  compressClipHtml,
  createClipExpiry,
  deleteNewsClip,
  deriveClipTitle,
  extractUrls,
  imageFileToDataUrl,
  importNewsClipFile,
  insertClipHtml,
  loadNewsClips,
  normalizeClipUrl,
  publishNewsClipIndex,
  readClipboardImages,
  remainingDays,
  sanitizeClipHtml,
  saveNewsClip,
  saveNewsClipFile,
  textToClipHtml,
  type NewsClip,
} from "../lib/news-clips";

type BoardMode = "edit" | "index";

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

  const visibleClips = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clips.filter((clip) => {
      if (starOnly && !clip.permanent) return false;
      if (!needle) return true;
      const haystack = `${clip.title}\n${clip.url}\n${clipPlainText(clip.html)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [clips, query, starOnly]);

  async function refresh(showExpiryNotice = false) {
    const result = await loadNewsClips();
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
    if (showExpiryNotice && result.removedCount > 0) {
      setNotice(`30일이 지난 ${result.removedCount}건을 삭제했습니다.`);
    }
    return result.clips;
  }

  useEffect(() => {
    let cancelled = false;
    loadNewsClips()
      .then((result) => {
        if (cancelled) return;
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
      window.setTimeout(() => {
        document.getElementById(`news-clip-${focusClipId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
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
    if (mode !== "edit") return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = pendingHtmlRef.current;
  }, [editKey, mode]);

  function beginEdit(clip?: NewsClip) {
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
      if (!url.trim()) {
        const urls = extractUrls(html, text);
        if (urls.length === 1) setUrl(urls[0]);
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

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor) return;
    const normalizedUrl = normalizeClipUrl(url);
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

      const existing = clips.find((clip) => clip.id === editingId);
      const createdAt = existing?.createdAt ?? new Date().toISOString();
      const clip: NewsClip = {
        id: editingId ?? crypto.randomUUID(),
        title: title.trim() || deriveClipTitle(plain),
        url: normalizedUrl,
        html,
        createdAt,
        expiresAt: existing?.expiresAt ?? createClipExpiry(createdAt),
        permanent,
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
    const nextPermanent = !clip.permanent;
    const expiresAt =
      !nextPermanent && new Date(clip.expiresAt).getTime() <= Date.now()
        ? createClipExpiry(new Date().toISOString())
        : clip.expiresAt;
    await saveNewsClip({ ...clip, permanent: nextPermanent, expiresAt });
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

  async function handleExport() {
    const latest = await refresh(false);
    if (latest.length === 0) {
      setNotice("내보낼 저장 글이 없습니다.");
      return;
    }
    await saveNewsClipFile(latest);
    setNotice("앱 파일로 저장했습니다. 같은 파일로 다시 불러올 수 있습니다.");
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
            네이버 등에서 복사한 글과 이미지를 함께 붙여 넣습니다. 별표를 누르면 영구 보관되고, 그 외에는 30일 후 삭제됩니다.
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
              placeholder="비워 두면 본문 앞부분을 제목으로 씁니다."
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
            읽기 모드에서 복사한 글과 이미지를 아래에 함께 붙여 넣으세요. 저장할 때는 노란 형광, 굵게, 빨간 글자만 남깁니다.
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
                ? `별표한 영구 보관 ${visibleClips.length}건입니다. URL을 누르면 해당 기사로 이동합니다.`
                : `저장한 내용 ${visibleClips.length}건입니다. URL을 누르면 해당 기사로 이동합니다. 별표한 글은 계속 보관되고, 나머지는 30일 후 삭제됩니다.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleExport()}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
              >
                앱 파일로 저장
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
              아직 저장된 뉴스가 없습니다. 작성 화면에서 붙여 넣은 뒤 인덱스에 저장하세요.
            </div>
          ) : visibleClips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              {starOnly && !query.trim()
                ? "영구 보관으로 별표한 글이 없습니다."
                : "찾는 제목이나 내용이 없습니다."}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleClips.map((clip) => (
                <article
                  key={clip.id}
                  id={`news-clip-${clip.id}`}
                  className="rounded-2xl border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => void handleTogglePermanent(clip)}
                          aria-pressed={Boolean(clip.permanent)}
                          aria-label={clip.permanent ? "영구 보관 해제" : "영구 보관"}
                          title={clip.permanent ? "영구 보관 중" : "별표를 누르면 영구 보관됩니다"}
                          className={`mt-0.5 text-2xl leading-none ${
                            clip.permanent ? "text-amber-500" : "text-gray-300 hover:text-amber-400"
                          }`}
                        >
                          {clip.permanent ? "★" : "☆"}
                        </button>
                        <h3 className="text-lg font-bold text-gray-900">{clip.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(clip.createdAt).toLocaleString("ko-KR")}
                        {" · "}
                        {clip.permanent ? (
                          <span className="font-bold text-amber-600">영구 보관</span>
                        ) : (
                          <span>{remainingDays(clip.expiresAt)}일 후 삭제</span>
                        )}
                      </p>
                      {clip.url && (
                        <a
                          href={clip.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block max-w-full truncate text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {clip.url}
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(clip)}
                        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(clip.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {clip.html && (
                    <ClipHtml
                      html={clip.html}
                      className="mt-3 max-h-96 overflow-y-auto text-sm leading-relaxed text-gray-800"
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
