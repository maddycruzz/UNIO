"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div style={{ padding: 32, textAlign: "center", color: "#fff" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          margin: "0 auto 20px",
        }}
      >
        ⚠️
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.4)",
          maxWidth: 400,
          margin: "0 auto 24px",
        }}
      >
        An error occurred while loading this page. Please try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          borderRadius: 999,
          backgroundColor: "#6366F1",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
