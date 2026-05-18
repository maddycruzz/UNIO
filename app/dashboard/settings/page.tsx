"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Bell,
  Palette,
  HardDrive,
  Info,
  Save,
  RefreshCw,
  Trash2,
  Check,
  Github,
} from "lucide-react";
import { loadProfile, saveProfile, ensureSeeded, type UserProfile } from "@/lib/store";
import { useAuth } from "@/lib/auth";

// ── Preferences (lightweight, localStorage) ──────────────────────
const PREFS_KEY = "unio_prefs_v1";

interface Prefs {
  emailReminders: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: Prefs = {
  emailReminders: true,
  pushNotifications: false,
  weeklyDigest: true,
  reduceMotion: false,
};

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ── Reset helpers ────────────────────────────────────────────────
function clearStore(reseed: boolean) {
  if (typeof window === "undefined") return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith("unio_"))
    .forEach((k) => localStorage.removeItem(k));
  if (reseed) ensureSeeded();
  window.dispatchEvent(new CustomEvent("unio-store-change", { detail: { domain: "all" } }));
}

// ── Toggle ───────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, lineHeight: 1.45 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          flexShrink: 0, width: 38, height: 22, borderRadius: 999, border: "none",
          background: checked ? "#6366F1" : "rgba(255,255,255,0.12)",
          boxShadow: checked ? "0 0 12px rgba(99,102,241,0.45)" : "none",
          cursor: disabled ? "not-allowed" : "pointer", position: "relative",
          transition: "background 0.18s",
        }}
      >
        <div style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 18, height: 18, borderRadius: "50%", background: "white",
          transition: "left 0.18s",
        }} />
      </button>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────
function SectionCard({ icon: Icon, accent, title, children }: {
  icon: React.ElementType; accent: string; title: string; children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        background: "#13151F", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: 22, marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent,
        }}>
          <Icon size={16} />
        </div>
        <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "white", letterSpacing: "-0.1px" }}>{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({ name: "", initials: "" });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"none" | "reset" | "clear">("none");

  useEffect(() => {
    setProfile(loadProfile());
    setPrefs(loadPrefs());
  }, []);

  function showFlash(message: string) {
    setSavedFlash(message);
    setTimeout(() => setSavedFlash(null), 1800);
  }

  function handleSaveProfile() {
    const trimmed = profile.name.trim() || "User";
    const initials = trimmed
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
    const next = { name: trimmed, initials };
    saveProfile(next);
    setProfile(next);
    showFlash("Profile saved");
  }

  function handlePrefChange<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  function handleReset() {
    clearStore(true);
    setProfile(loadProfile());
    showFlash("Data reset to sample");
    setConfirm("none");
  }

  function handleClear() {
    clearStore(false);
    setProfile({ name: "", initials: "" });
    showFlash("All data cleared");
    setConfirm("none");
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>Settings</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.5)" }}>
          Manage your profile, notifications, and local data.
        </p>
      </div>

      {/* Profile */}
      <SectionCard icon={UserIcon} accent="#6366F1" title="Profile">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg,#6366F1,#10B981)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "white", flexShrink: 0,
          }}>
            {profile.initials || "?"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{profile.name || "Unnamed"}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{user?.email ?? "Not signed in"}</div>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Display name
        </label>
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          placeholder="Your name"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "white", fontSize: 13.5, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={handleSaveProfile}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: "linear-gradient(135deg,#6366F1,#818CF8)",
              border: "1px solid rgba(99,102,241,0.5)",
              color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Save size={14} /> Save profile
          </button>
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon={Bell} accent="#F59E0B" title="Notifications">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Toggle
            label="Email reminders"
            description="Get a heads-up the day before each event you organise."
            checked={prefs.emailReminders}
            onChange={(v) => handlePrefChange("emailReminders", v)}
          />
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
          <Toggle
            label="Push notifications"
            description="Browser push for room changes and task updates. Coming soon."
            checked={prefs.pushNotifications}
            onChange={(v) => handlePrefChange("pushNotifications", v)}
            disabled
          />
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
          <Toggle
            label="Weekly digest"
            description="Monday-morning summary of upcoming events and overdue tasks."
            checked={prefs.weeklyDigest}
            onChange={(v) => handlePrefChange("weeklyDigest", v)}
          />
        </div>
      </SectionCard>

      {/* Appearance */}
      <SectionCard icon={Palette} accent="#EC4899" title="Appearance">
        <Toggle
          label="Reduce motion"
          description="Minimise non-essential animations across the dashboard."
          checked={prefs.reduceMotion}
          onChange={(v) => handlePrefChange("reduceMotion", v)}
        />
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", opacity: 0.6 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Theme</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Dark only for now. Light theme planned.</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Dark
          </div>
        </div>
      </SectionCard>

      {/* Data */}
      <SectionCard icon={HardDrive} accent="#10B981" title="Data">
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>
          UNIO currently stores everything in your browser&apos;s local storage. Resetting or clearing affects only this device.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {confirm !== "reset" ? (
            <button
              onClick={() => setConfirm("reset")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 14px", borderRadius: 10,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#A5B4FC", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              <RefreshCw size={13} /> Reset to sample data
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 12px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <span style={{ fontSize: 12.5, color: "#C7D2FE" }}>Replace your data with sample data?</span>
              <button onClick={handleReset} style={{ padding: "6px 12px", borderRadius: 8, background: "#6366F1", border: "none", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Yes, reset</button>
              <button onClick={() => setConfirm("none")} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          )}

          {confirm !== "clear" ? (
            <button
              onClick={() => setConfirm("clear")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 14px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Trash2 size={13} /> Clear all data
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <span style={{ fontSize: 12.5, color: "#fecaca" }}>Permanently delete all UNIO data on this device?</span>
              <button onClick={handleClear} style={{ padding: "6px 12px", borderRadius: 8, background: "#ef4444", border: "none", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Yes, clear</button>
              <button onClick={() => setConfirm("none")} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* About */}
      <SectionCard icon={Info} accent="#14B8A6" title="About">
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 10, fontSize: 13 }}>
          <div style={{ color: "rgba(255,255,255,0.45)" }}>Version</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>0.3.0</div>

          <div style={{ color: "rgba(255,255,255,0.45)" }}>Storage</div>
          <div style={{ color: "rgba(255,255,255,0.85)" }}>Local (this browser only)</div>

          <div style={{ color: "rgba(255,255,255,0.45)" }}>Build</div>
          <div style={{ color: "rgba(255,255,255,0.85)" }}>Next.js 16 · React 19 · Tailwind 4</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Github size={13} /> Source
          </a>
        </div>
      </SectionCard>

      {/* Saved flash */}
      {savedFlash && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 999,
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.35)",
            color: "#6EE7B7", fontSize: 13, fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 200,
          }}
        >
          <Check size={14} /> {savedFlash}
        </motion.div>
      )}
    </div>
  );
}
