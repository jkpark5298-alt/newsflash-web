import { NextResponse } from "next/server";
import { extractArticleHeadline, isPublicArticleUrl } from "../../../lib/article-title";

export const dynamic = "force-dynamic";

const FETCH_MS = 8000;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url")?.trim() || "";
  if (!isPublicArticleUrl(target)) {
    return NextResponse.json({ ok: false, error: "bad-url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 502 });
    }
    const html = (await response.text()).slice(0, 500_000);
    const title = extractArticleHeadline(html);
    if (!title) {
      return NextResponse.json({ ok: false, error: "no-title" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, title });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
