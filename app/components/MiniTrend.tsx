"use client";

export default function MiniTrend({
  tone = "neutral",
}: {
  tone?: "up" | "down" | "neutral";
}) {
  const strokeColor =
    tone === "down" ? "#2563eb" : tone === "up" ? "#ef4444" : "#94a3b8";
  const fillColor =
    tone === "down" ? "#eff6ff" : tone === "up" ? "#fef2f2" : "#f8fafc";
  const points =
    tone === "down"
      ? "4,12 18,10 32,13 46,18 60,22 74,25"
      : tone === "up"
        ? "4,26 18,22 32,20 46,15 60,11 74,6"
        : "4,17 18,17 32,17 46,17 60,17 74,17";

  return (
    <div className="flex h-[76px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2">
      <svg viewBox="0 0 78 32" className="h-11 w-full" aria-label="추이 그래프">
        <rect x="0" y="0" width="78" height="32" rx="8" fill={fillColor} />
        <path
          d="M4 26 H74"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="74" cy={tone === "down" ? "25" : tone === "up" ? "6" : "17"} r="3" fill={strokeColor} />
      </svg>
    </div>
  );
}
