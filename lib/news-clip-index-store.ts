import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

export type NewsClipIndexEntry = {
  id: string;
  title: string;
  createdAt: string;
  deleted: boolean;
};

const MAX_ITEMS = 300;
const FILE_PATH = path.join(process.cwd(), "data", "news-clip-index.json");

let pgReady: Promise<void> | null = null;

function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL이 없습니다.");
  return neon(url);
}

async function ensureTable() {
  if (!pgReady) {
    pgReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS news_clip_index (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          deleted BOOLEAN NOT NULL DEFAULT FALSE
        )
      `;
    })().catch((error) => {
      pgReady = null;
      throw error;
    });
  }
  await pgReady;
}

export function sanitizeNewsClipIndexEntry(input: unknown): NewsClipIndexEntry | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const id = String(row.id || "").trim().slice(0, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const title = String(row.title || "").trim().slice(0, 80) || "제목 없음";
  const createdAtMs = Date.parse(String(row.createdAt || ""));
  if (!Number.isFinite(createdAtMs)) return null;
  return {
    id,
    title,
    createdAt: new Date(createdAtMs).toISOString(),
    deleted: row.deleted === true,
  };
}

function readFileItems(): NewsClipIndexEntry[] {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeNewsClipIndexEntry(item))
      .filter((item): item is NewsClipIndexEntry => item !== null);
  } catch {
    return [];
  }
}

function writeFileItems(items: NewsClipIndexEntry[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export async function listNewsClipIndex(): Promise<NewsClipIndexEntry[]> {
  if (databaseUrl()) {
    await ensureTable();
    const sql = getSql();
    const rows = await sql`
      SELECT id, title, created_at, deleted
      FROM news_clip_index
      ORDER BY created_at DESC
      LIMIT 300
    `;
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      createdAt: new Date(String(row.created_at)).toISOString(),
      deleted: Boolean(row.deleted),
    }));
  }
  return readFileItems().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertNewsClipIndex(entries: NewsClipIndexEntry[]): Promise<void> {
  const items = entries.slice(0, 50);
  if (items.length === 0) return;
  if (databaseUrl()) {
    await ensureTable();
    const sql = getSql();
    for (const item of items) {
      await sql`
        INSERT INTO news_clip_index (id, title, created_at, deleted)
        VALUES (${item.id}, ${item.title}, ${item.createdAt}, ${item.deleted})
        ON CONFLICT (id)
        DO UPDATE SET title = EXCLUDED.title, created_at = EXCLUDED.created_at, deleted = EXCLUDED.deleted
      `;
    }
    return;
  }
  const byId = new Map(readFileItems().map((item) => [item.id, item]));
  for (const item of items) byId.set(item.id, item);
  writeFileItems(
    Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}
