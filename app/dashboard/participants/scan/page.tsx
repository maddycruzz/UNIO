"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  type UnioParticipant,
} from "@/lib/store";
import {
  loadParticipants as dbLoadParticipants,
  loadEvents as dbLoadEvents,
  checkInParticipant as dbCheckIn,
} from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────
type ScanResult = {
  participant: UnioParticipant;
  alreadyCheckedIn: boolean;
};

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "success"; result: ScanResult }
  | { status: "error"; message: string }
  | { status: "no-camera"; message: string };

// ─── QR Scanner Page ────────────────────────────────────────────
export default function QRScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [scanCount, setScanCount] = useState(0);
  const [recentScans, setRecentScans] = useState<{ name: string; time: string }[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualId, setManualId] = useState("");
  const [participants, setParticipants] = useState<UnioParticipant[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  // Load participants and events on mount
  useEffect(() => {
    const fetchData = async () => {
      const [evts, parts] = await Promise.all([
        dbLoadEvents(),
        dbLoadParticipants(),
      ]);
      setEvents(evts.map((e) => ({ id: e.id, name: e.name })));
      setParticipants(parts);
    };
    fetchData();
    // Re-sync when a check-in happens on another page
    const handler = () => fetchData();
    window.addEventListener("unio-store-change", handler);
    return () => window.removeEventListener("unio-store-change", handler);
  }, []);

  // ── Start camera ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanState({ status: "scanning" });
      startDetection();
    } catch {
      setScanState({
        status: "no-camera",
        message: "Camera access denied or unavailable. Use manual check-in below.",
      });
    }
  }, []);

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── QR Detection Loop ──
  const startDetection = useCallback(() => {
    // Use native BarcodeDetector if available, otherwise fall back to manual
    if (!("BarcodeDetector" in window)) {
      // No native API — still show camera but prompt manual
      return;
    }

    const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

    scanIntervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          processQRData(raw);
        }
      } catch {
        // Detection failed this frame, continue
      }
    }, 250); // Scan every 250ms
  }, []);

  // ── Process scanned QR data ──
  const processQRData = useCallback(async (raw: string) => {
    // Pause scanning during result display
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      const data = JSON.parse(raw);
      const participantId = data.id || data.participantId;

      if (!participantId) {
        setScanState({ status: "error", message: "Invalid QR code — no participant ID found." });
        setTimeout(() => { setScanState({ status: "scanning" }); startDetection(); }, 2500);
        return;
      }

      // Scope search to selected event if one is chosen
      const pool = selectedEventId === "all"
        ? participants
        : participants.filter((p) => p.eventId === selectedEventId);
      const participant = pool.find((p) => p.id === participantId);

      if (!participant) {
        setScanState({ status: "error", message: `Participant "${data.name || participantId}" not found in registry.` });
        setTimeout(() => { setScanState({ status: "scanning" }); startDetection(); }, 2500);
        return;
      }

      const alreadyCheckedIn = participant.status === "checked-in";

      if (!alreadyCheckedIn) {
        await dbCheckIn(participant.id);
        setParticipants((prev) =>
          prev.map((p) => p.id === participant.id ? { ...p, status: "checked-in" as const, checkedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) } : p)
        );
      }

      setScanCount((c) => c + 1);
      setRecentScans((prev) => [
        { name: participant.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ...prev.slice(0, 9),
      ]);

      setScanState({ status: "success", result: { participant, alreadyCheckedIn } });

      // Auto-reset after 2s
      setTimeout(() => {
        setScanState({ status: "scanning" });
        startDetection();
      }, 2000);
    } catch {
      setScanState({ status: "error", message: "Could not read QR code data. Please try again." });
      setTimeout(() => { setScanState({ status: "scanning" }); startDetection(); }, 2500);
    }
  }, [startDetection, participants, selectedEventId]);

  // ── Manual check-in ──
  const handleManualCheckIn = useCallback(async () => {
    const query = manualId.trim().toLowerCase();
    if (!query) return;

    const pool = selectedEventId === "all"
      ? participants
      : participants.filter((p) => p.eventId === selectedEventId);
    const match = pool.find(
      (p) =>
        p.id.toLowerCase() === query ||
        p.rollNo.toLowerCase() === query ||
        p.email.toLowerCase() === query ||
        p.name.toLowerCase() === query
    );

    if (!match) {
      setScanState({ status: "error", message: `No participant found for "${manualId.trim()}"` });
      setTimeout(() => setScanState(manualMode ? { status: "idle" } : { status: "scanning" }), 2000);
      return;
    }

    const alreadyCheckedIn = match.status === "checked-in";
    if (!alreadyCheckedIn) {
      await dbCheckIn(match.id);
      setParticipants((prev) =>
        prev.map((p) => p.id === match.id ? { ...p, status: "checked-in" as const, checkedInAt: "Just now" } : p)
      );
    }

    setScanCount((c) => c + 1);
    setRecentScans((prev) => [
      { name: match.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...prev.slice(0, 9),
    ]);
    setScanState({ status: "success", result: { participant: match, alreadyCheckedIn } });
    setManualId("");

    setTimeout(() => setScanState(manualMode ? { status: "idle" } : { status: "scanning" }), 2000);
  }, [manualId, manualMode, participants, selectedEventId]);

  // ── Lifecycle ──
  useEffect(() => {
    if (!manualMode) startCamera();
    return () => stopCamera();
  }, [manualMode, startCamera, stopCamera]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", color: "white", minHeight: "100%", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Link href="/dashboard/participants" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Participants
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>QR Check-in Scanner</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Scan participant QR codes for instant check-in
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ padding: "10px 18px", borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 14, fontWeight: 700, color: "#10B981" }}>
            {scanCount} scanned
          </div>
          <button
            onClick={() => setManualMode((v) => !v)}
            style={{
              padding: "10px 18px", borderRadius: 12,
              background: manualMode ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${manualMode ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: manualMode ? "#818CF8" : "rgba(255,255,255,0.7)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {manualMode ? "📸 Use Camera" : "⌨️ Manual Entry"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, flex: 1, minHeight: 0 }}>

        {/* Scanner area */}
        <div style={{
          position: "relative", borderRadius: 24, overflow: "hidden",
          background: "#0A0C14", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 400,
        }}>
          {!manualMode ? (
            <>
              {/* Camera feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Scan overlay */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                {/* Scan frame */}
                <div style={{
                  width: 220, height: 220, position: "relative",
                  border: "2px solid rgba(99,102,241,0.3)", borderRadius: 24,
                  boxShadow: "0 0 0 4000px rgba(0,0,0,0.4)",
                }}>
                  {/* Corner accents */}
                  {[
                    { top: -2, left: -2, borderTop: "3px solid #6366F1", borderLeft: "3px solid #6366F1", borderRadius: "24px 0 0 0" },
                    { top: -2, right: -2, borderTop: "3px solid #6366F1", borderRight: "3px solid #6366F1", borderRadius: "0 24px 0 0" },
                    { bottom: -2, left: -2, borderBottom: "3px solid #6366F1", borderLeft: "3px solid #6366F1", borderRadius: "0 0 0 24px" },
                    { bottom: -2, right: -2, borderBottom: "3px solid #6366F1", borderRight: "3px solid #6366F1", borderRadius: "0 0 24px 0" },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 40, height: 40, ...s } as React.CSSProperties} />
                  ))}

                  {/* Scanning line animation */}
                  {scanState.status === "scanning" && (
                    <motion.div
                      animate={{ top: ["10%", "85%", "10%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      style={{
                        position: "absolute", left: 8, right: 8, height: 2,
                        background: "linear-gradient(90deg, transparent, #6366F1, transparent)",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Instruction */}
              <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
                <div style={{
                  padding: "8px 20px", borderRadius: 12,
                  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)",
                }}>
                  {scanState.status === "scanning" && "Position QR code within the frame"}
                  {scanState.status === "idle" && "Starting camera..."}
                  {scanState.status === "no-camera" && scanState.message}
                </div>
              </div>
            </>
          ) : (
            /* Manual entry mode */
            <div style={{ padding: 40, textAlign: "center", width: "100%", maxWidth: 400 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px", fontSize: 32,
              }}>
                ⌨️
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Manual Check-in</h3>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                Enter a participant&apos;s roll number, email, or name
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
                  placeholder="e.g. 21CS001 or ayaan@college.edu"
                  autoFocus
                  style={{
                    flex: 1, padding: "12px 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12, color: "white", fontSize: 14,
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleManualCheckIn}
                  style={{
                    padding: "12px 24px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #10B981, #34D399)",
                    color: "white", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                  }}
                >
                  Check In
                </motion.button>
              </div>
            </div>
          )}

          {/* Result overlay */}
          <AnimatePresence>
            {scanState.status === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  position: "absolute", inset: 0,
                  background: scanState.result.alreadyCheckedIn
                    ? "rgba(245,158,11,0.95)"
                    : "rgba(16,185,129,0.95)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(12px)",
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                  style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {scanState.result.alreadyCheckedIn ? (
                    <span style={{ fontSize: 36 }}>⚠️</span>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <path d="M8 18L14 24L28 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </motion.div>
                <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "white" }}>
                  {scanState.result.alreadyCheckedIn ? "Already Checked In" : "Checked In!"}
                </h2>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                  {scanState.result.participant.name}
                </p>
                <p style={{ margin: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {scanState.result.participant.rollNo} · {scanState.result.participant.dept}
                </p>
              </motion.div>
            )}

            {scanState.status === "error" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "rgba(239,68,68,0.95)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 36 }}>
                  ✕
                </div>
                <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "white" }}>Scan Failed</h2>
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.8)", maxWidth: 300, textAlign: "center" }}>
                  {scanState.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Event selector */}
          {events.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: "18px 20px",
            }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Scan For
              </h3>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }}
              >
                <option value="all" style={{ background: "#1a1d27" }}>All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} style={{ background: "#1a1d27" }}>{ev.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Scan stats */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "18px 20px",
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Session Stats
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Scanned", value: scanCount, color: "#10B981" },
                { label: "Total",   value: (selectedEventId === "all" ? participants : participants.filter((p) => p.eventId === selectedEventId)).length, color: "#6366F1" },
                { label: "Checked", value: (selectedEventId === "all" ? participants : participants.filter((p) => p.eventId === selectedEventId)).filter((p) => p.status === "checked-in").length, color: "#F59E0B" },
                { label: "Remaining", value: (selectedEventId === "all" ? participants : participants.filter((p) => p.eventId === selectedEventId)).filter((p) => p.status === "registered").length, color: "#EC4899" },
              ].map((s) => (
                <div key={s.label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent scans */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "18px 20px", flex: 1, minHeight: 0, overflow: "hidden",
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Recent Scans
            </h3>
            {recentScans.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: 0 }}>No scans yet. Start scanning to see results here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <AnimatePresence>
                  {recentScans.map((scan, i) => (
                    <motion.div
                      key={`${scan.name}-${scan.time}-${i}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px", borderRadius: 10,
                        background: i === 0 ? "rgba(16,185,129,0.08)" : "transparent",
                        border: `1px solid ${i === 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)"}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: i === 0 ? "#10B981" : "rgba(255,255,255,0.15)",
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? "white" : "rgba(255,255,255,0.5)" }}>
                          {scan.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{scan.time}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
