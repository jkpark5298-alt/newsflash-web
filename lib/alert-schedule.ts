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
