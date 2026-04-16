/**
 * DebugOverlay — Live pipeline visibility tool
 * Shows SSE status, events, API data, and refresh triggers in real-time.
 *
 * REMOVE BEFORE PRODUCTION DEPLOY.
 * Mount with: <DebugOverlay refreshMap={refreshMap} />
 */
"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// NOTE: App uses "auth_token" key — NOT "token"
const getToken = () => localStorage.getItem("auth_token");

export default function DebugOverlay({ refreshMap }: { refreshMap: any }) {
  const [events, setEvents] = useState<any[]>([]);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [sseStatus, setSseStatus] = useState("disconnected");
  const [isVisible, setIsVisible] = useState(true);

  // ── SSE connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSseStatus("no-token");
      return;
    }

    const url = `${API_BASE}/events/stream?token=${token}`;
    console.log("[DebugOverlay] Opening direct EventSource:", url.split("?")[0]);
    const es = new EventSource(url);

    setSseStatus("connecting");

    es.onopen = () => {
      console.log("[DebugOverlay] SSE CONNECTED");
      setSseStatus("connected");
    };

    es.onerror = () => {
      console.warn("[DebugOverlay] SSE ERROR / disconnected");
      setSseStatus("error");
    };

    const addEvent = (type: string) => (e: any) => {
      try {
        const parsed = JSON.parse(e.data);
        console.log("[DebugOverlay] EVENT received:", type, parsed);
        setLastEvent({ type, data: parsed, at: new Date().toLocaleTimeString() });
        setEvents((prev) => [
          ...prev.slice(-4),
          { type, data: parsed, at: new Date().toLocaleTimeString() },
        ]);
      } catch (err) {
        console.error("[DebugOverlay] Parse error", err);
      }
    };

    es.addEventListener("NEW_VISITOR_REQUEST", addEvent("NEW_VISITOR_REQUEST"));
    es.addEventListener("VISITOR_APPROVED", addEvent("VISITOR_APPROVED"));
    es.addEventListener("visit_request", addEvent("visit_request"));

    return () => {
      console.log("[DebugOverlay] Closing direct EventSource");
      es.close();
    };
  }, []);

  // ── Manual API fetch ──────────────────────────────────────────────────────
  const fetchApprovals = async () => {
    try {
      const token = getToken();
      if (!token) {
        setApiData({ error: "No auth_token in localStorage" });
        return;
      }

      const res = await fetch(`${API_BASE}/visitors/approvals/regular`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      console.log("[DebugOverlay] API /visitors/approvals/regular →", data);
      setApiData({ status: res.status, count: data.length, items: data });
    } catch (e: any) {
      console.error("[DebugOverlay] API error:", e);
      setApiData({ error: e.message });
    }
  };

  // Auto-fetch when approvals scope refreshes
  useEffect(() => {
    fetchApprovals();
  }, [refreshMap?.approvals]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const sseColor =
    {
      connected: "#22c55e",
      connecting: "#f59e0b",
      error: "#ef4444",
      disconnected: "#6b7280",
      "no-token": "#ef4444",
    }[sseStatus] ?? "#6b7280";

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 9999,
          background: "#0f172a",
          color: "#e2e8f0",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        🔬 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        width: 370,
        maxHeight: 520,
        overflow: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: 14,
        borderRadius: 10,
        fontSize: 11,
        zIndex: 9999,
        boxShadow: "0 0 20px rgba(0,0,0,0.6)",
        fontFamily: "monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: 13 }}>🔬 Debug Overlay</span>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>

      {/* SSE Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: sseColor,
            display: "inline-block",
          }}
        />
        <span>
          <b>SSE:</b> {sseStatus}
        </span>
      </div>

      {/* RefreshMap */}
      <div style={{ marginBottom: 8 }}>
        <b>⚡ refreshMap:</b>
        <div style={{ color: "#94a3b8", marginTop: 2 }}>
          {refreshMap
            ? Object.entries(refreshMap).map(([k, v]) => (
                <span key={k} style={{ marginRight: 8 }}>
                  {k}: <span style={{ color: "#f59e0b" }}>{String(v)}</span>
                </span>
              ))
            : "—"}
        </div>
      </div>

      {/* Last Event */}
      <div style={{ marginBottom: 8 }}>
        <b>🔥 Last SSE Event:</b>
        {lastEvent ? (
          <pre
            style={{
              background: "#1e293b",
              padding: 6,
              borderRadius: 4,
              margin: "4px 0 0",
              overflow: "auto",
              maxHeight: 80,
              color: "#86efac",
            }}
          >
            [{lastEvent.at}] {lastEvent.type}
            {"\n"}
            {JSON.stringify(lastEvent.data, null, 2)}
          </pre>
        ) : (
          <span style={{ color: "#475569" }}> none yet</span>
        )}
      </div>

      {/* API Data */}
      <div style={{ marginBottom: 8 }}>
        <b>📡 /visitors/approvals/regular:</b>
        {apiData ? (
          <pre
            style={{
              background: "#1e293b",
              padding: 6,
              borderRadius: 4,
              margin: "4px 0 0",
              overflow: "auto",
              maxHeight: 100,
              color: apiData.error ? "#f87171" : "#93c5fd",
            }}
          >
            {apiData.error
              ? `ERROR: ${apiData.error}`
              : `HTTP ${apiData.status} — ${apiData.count} item(s)\n${JSON.stringify(
                  apiData.items?.map((i: any) => ({
                    name: i.name,
                    status: i.approval_status,
                    id: i._id,
                  })),
                  null,
                  2
                )}`}
          </pre>
        ) : (
          <span style={{ color: "#475569" }}> fetching...</span>
        )}
      </div>

      {/* Event Log */}
      {events.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <b>🧾 Event Log (last 5):</b>
          <div style={{ background: "#1e293b", padding: 6, borderRadius: 4, marginTop: 4 }}>
            {events.map((ev, i) => (
              <div key={i} style={{ color: "#a78bfa" }}>
                [{ev.at}] {ev.type}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          onClick={fetchApprovals}
          style={{
            flex: 1,
            padding: 6,
            background: "#22c55e",
            color: "#000",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🔄 Fetch
        </button>
        <button
          onClick={() => {
            setEvents([]);
            setLastEvent(null);
            setApiData(null);
          }}
          style={{
            flex: 1,
            padding: 6,
            background: "#475569",
            color: "#fff",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          🗑 Clear
        </button>
      </div>
    </div>
  );
}
