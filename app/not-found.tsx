import Link from "next/link";

export default function NotFound() {
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
          width: 80,
          height: 80,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.1))",
          border: "1px solid rgba(99,102,241,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          marginBottom: 24,
        }}
      >
        🔍
      </div>
      <h1
        style={{
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          background: "linear-gradient(to right, #818cf8, #34d399)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 8,
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Page not found
      </p>
      <p
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.4)",
          maxWidth: 400,
          marginBottom: 32,
          lineHeight: 1.6,
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link
          href="/dashboard"
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            backgroundColor: "#6366F1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            textDecoration: "none",
            boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
          }}
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
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
          Home
        </Link>
      </div>
    </div>
  );
}
