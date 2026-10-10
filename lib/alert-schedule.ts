/** Hours users may select for scheduled news (KST). */
export const SELECTABLE_NEWS_HOURS: string[] = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 7;
  return `${String(hour).padStart(2, "0")}:00`;
});

/** Default scheduled news push slots (KST). */
export const DEFAULT_NEWS_HOURS: string[] = ["07:00", "12:00", "18:00", "22:00"];

/** @deprecated use DEFAULT_NEWS_HOURS — kept for existing imports */
export const NEWS_HOURS = DEFAULT_NEWS_HOURS;

/** Scheduled stock push slots (KST). */
export const STOCK_HOURS: string[] = ["07:00", "12:00", "16:00"];

export const STOCK_HOURS_LABEL = "07:00 · 12:00 · 16:00";

export function normalizeScheduledNewsHours(
  hours?: string[] | null,
): string[] {
  const allowed = new Set(SELECTABLE_NEWS_HOURS);
  const cleaned = (hours || [])
    .map((h) => String(h).trim())
    .filter((h) => allowed.has(h));

  const unique = Array.from(new Set(cleaned)).sort();
  return unique.length > 0 ? unique : [...DEFAULT_NEWS_HOURS];
}

export function formatNewsHoursLabel(hours: string[]): string {
  return normalizeScheduledNewsHours(hours)
    .map((h) => h.slice(0, 2))
    .join(" · ");
}

export type ScheduledPushSlot = {
  dateStr: string;
  hours: number;
  hourSlot: string;
};

function kstSlot(date: Date): ScheduledPushSlot {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
  return {
    dateStr,
    hours,
    hourSlot: `${String(hours).padStart(2, "0")}:00`,
  };
}

/** Current KST hour, plus the previous hour so a missed slot is sent on the next call. */
export function slotsForScheduledPush(now: Date): ScheduledPushSlot[] {
  const current = kstSlot(now);
  const previous = kstSlot(new Date(now.getTime() - 60 * 60 * 1000));
  if (
    previous.dateStr === current.dateStr &&
    previous.hourSlot === current.hourSlot
  ) {
    return [current];
  }
  return [previous, current];
}

export function isCronCheckStale(
  checkedAt: string | null | undefined,
  now = new Date(),
  staleAfterMs = 10 * 60 * 1000,
): boolean {
  if (!checkedAt) return true;
  const checkedMs = new Date(checkedAt).getTime();
  if (Number.isNaN(checkedMs)) return true;
  return now.getTime() - checkedMs > staleAfterMs;
}
