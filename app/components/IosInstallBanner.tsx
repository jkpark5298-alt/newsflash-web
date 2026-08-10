"use client";

type Props = {
  onOpenAlerts: () => void;
};

export default function IosInstallBanner({ onOpenAlerts }: Props) {
  const isIos =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari legacy
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  if (!isIos || isStandalone) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-950">
          iPhone에서 푸시를 받으려면 Safari{" "}
          <b>공유 → 홈 화면에 추가</b> 후, 홈 화면 앱에서 알림을 연결하세요.
        </p>
        <button
          type="button"
          onClick={onOpenAlerts}
          className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
        >
          알림 안내 보기
        </button>
      </div>
    </div>
  );
}
