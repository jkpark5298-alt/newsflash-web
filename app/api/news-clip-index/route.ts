import { NextResponse } from "next/server";
import {
  listNewsClipIndex,
  sanitizeNewsClipIndexEntry,
  upsertNewsClipIndex,
} from "../../../lib/news-clip-index-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listNewsClipIndex();
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json(
      { ok: false, items: [], error: "index-unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const source = Array.isArray((body as { items?: unknown })?.items)
    ? (body as { items: unknown[] }).items
    : [body];
  const items = source
    .map((item) => sanitizeNewsClipIndexEntry(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  try {
    await upsertNewsClipIndex(items);
    return NextResponse.json({ ok: true, count: items.length });
  } catch {
    return NextResponse.json({ ok: false, error: "save-failed" }, { status: 500 });
  }
}
