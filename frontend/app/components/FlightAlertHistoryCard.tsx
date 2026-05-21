"use client";

import type { CSSProperties } from "react";
import type { FlightAlertHistoryItem } from "../lib/flight-alerts";

type FlightAlertHistoryCardProps = {
  historyItems: FlightAlertHistoryItem[];
  onClear: () => void;
};

export function FlightAlertHistoryCard({
  historyItems,
  onClear,
}: FlightAlertHistoryCardProps) {
  return (
    <section style={flightAlertHistoryCardStyle}>
      <div style={flightAlertTopStyle}>
        <div>
          <div style={cardLabelStyle}>출도착 알림 이력</div>
          <h2 style={flightAlertTitleStyle}>최근 변경 {historyItems.length}건</h2>
        </div>
        <div style={flightAlertBadgeStyle}>앱 저장</div>
      </div>

      {historyItems.length > 0 ? (
        <div style={flightAlertListStyle}>
          {historyItems.slice(0, 5).map((item, index) => (
            <div key={`${item.key}-${item.checkedAt}-${index}`} style={flightAlertHistoryItemStyle}>
              <div style={flightAlertItemTitleStyle}>{item.title}</div>
              <div style={flightAlertItemDescStyle}>{item.description}</div>
              <div style={flightAlertHistoryMetaStyle}>
                확인 {item.checkedAt} · {item.roomName}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={flightAlertMetaStyle}>아직 저장된 알림 이력이 없습니다.</div>
      )}

      {historyItems.length > 0 && (
        <button onClick={onClear} style={resetButtonStyle}>
          알림 이력 초기화
        </button>
      )}
    </section>
  );
}

const flightAlertHistoryCardStyle: CSSProperties = {
  background: "linear-gradient(145deg, #0b1120, #111827)",
  border: "1px solid #1e3a8a",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
};

const flightAlertTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 12,
};

const cardLabelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 2,
  textTransform: "uppercase",
};

const flightAlertTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#f8fafc",
  fontSize: 22,
  lineHeight: 1.15,
  fontWeight: 950,
};

const flightAlertBadgeStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#1d4ed8",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const flightAlertMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 14,
};

const flightAlertListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const flightAlertHistoryItemStyle: CSSProperties = {
  border: "1px solid rgba(59, 130, 246, 0.22)",
  background: "rgba(30, 64, 175, 0.16)",
  borderRadius: 14,
  padding: "10px 12px",
};

const flightAlertItemTitleStyle: CSSProperties = {
  color: "#fef3c7",
  fontSize: 14,
  fontWeight: 950,
  marginBottom: 4,
};

const flightAlertItemDescStyle: CSSProperties = {
  color: "#fde68a",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
};

const flightAlertHistoryMetaStyle: CSSProperties = {
  color: "#93c5fd",
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: 6,
  fontWeight: 800,
};

const resetButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "1px solid rgba(148, 163, 184, 0.3)",
  borderRadius: 14,
  color: "#e5edf7",
  background: "#1f2937",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
};
