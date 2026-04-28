"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0F1117",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
          border: "1px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          marginBottom: 24,
        }}
      >
        ⚠️
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", maxWidth: 400, marginBottom: 32, lineHeight: 1.6 }}>
        An unexpected error occurred. This has been logged. You can try again or head back to the dashboard.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            backgroundColor: "#6366F1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
          }}
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.12)",
            textDecoration: "none",
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
