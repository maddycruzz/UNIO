"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Lightbulb,
  BookOpen,
  Mail,
  Github,
  ChevronDown,
  Keyboard,
  MessageCircle,
} from "lucide-react";

// ── FAQ data ─────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: "Where is my data stored?",
    a: "Currently in your browser's local storage. That means events, tasks, meetings, and participants you create live on this device only — switching browsers or clearing site data will reset everything. A cloud-backed version with multi-device sync is on the roadmap.",
  },
  {
    q: "Can teammates see what I create?",
    a: "Not yet. Multi-user collaboration requires a real backend, which is the next big step. Until then, share events by exporting CSV or sending a screenshot.",
  },
  {
    q: "How do I check participants in?",
    a: "Open an event's participant list, then either toggle a participant's status manually or open the QR scanner (Participants → Scan) to use your device camera. Each registered participant has a QR code generated for them automatically.",
  },
  {
    q: "Can I export attendance data?",
    a: "Yes. The Participants page has an export menu in the top-right with CSV download. The certificates page can also generate PDFs in bulk.",
  },
  {
    q: "What does the certificate generator do?",
    a: "It opens a Fabric.js editor where you place text fields (name, event, date) onto a template you upload. Once you save the template, you can generate one certificate per participant in a single batch.",
  },
  {
    q: "How do I reset everything?",
    a: "Settings → Data → Reset to sample data. That wipes all UNIO data on this device and re-seeds the demo events. Use 'Clear all data' instead if you want a truly empty workspace.",
  },
];

// ── Shortcut data ────────────────────────────────────────────────
const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘", "K"], description: "Open command palette (coming soon)" },
  { keys: ["G", "D"], description: "Go to Dashboard" },
  { keys: ["G", "E"], description: "Go to Events" },
  { keys: ["G", "T"], description: "Go to Tasks" },
  { keys: ["Esc"], description: "Close any open modal" },
];

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

// ── FAQ row ──────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <button
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, width: "100%", padding: "14px 0",
          background: "none", border: "none", color: "white",
          fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
          textAlign: "left", cursor: "pointer",
        }}
      >
        <span>{q}</span>
        <ChevronDown
          size={16}
          style={{
            color: "rgba(255,255,255,0.4)",
            transform: open ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingBottom: 14, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.65)" }}>
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function HelpPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>Help &amp; Support</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.5)" }}>
          Quick answers, shortcuts, and ways to reach us.
        </p>
      </div>

      {/* Quick start */}
      <SectionCard icon={Lightbulb} accent="#F59E0B" title="Quick start">
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.7)" }}>
          <li>Create an event from <strong style={{ color: "white" }}>Events &rarr; New event</strong>.</li>
          <li>Add tasks for it on the <strong style={{ color: "white" }}>Tasks</strong> page and assign them to your team.</li>
          <li>As registrations come in, manage them on <strong style={{ color: "white" }}>Participants</strong>.</li>
          <li>On the day, open <strong style={{ color: "white" }}>Participants &rarr; Scan</strong> to check people in with QR codes.</li>
          <li>After the event, generate certificates from the <strong style={{ color: "white" }}>Certificates</strong> editor.</li>
        </ol>
      </SectionCard>

      {/* FAQ */}
      <SectionCard icon={HelpCircle} accent="#6366F1" title="Frequently asked">
        <div>
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </SectionCard>

      {/* Shortcuts */}
      <SectionCard icon={Keyboard} accent="#10B981" title="Keyboard shortcuts">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {SHORTCUTS.map((s, i) => (
            <div
              key={s.description}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16, padding: "11px 0",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{s.description}</span>
              <div style={{ display: "flex", gap: 5 }}>
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      fontSize: 11, fontWeight: 600,
                      padding: "3px 8px", borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.85)",
                      minWidth: 22, textAlign: "center",
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>
          Most shortcuts ship in an upcoming release.
        </p>
      </SectionCard>

      {/* Resources */}
      <SectionCard icon={BookOpen} accent="#EC4899" title="Resources">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {[
            { icon: Github, label: "Source on GitHub", href: "https://github.com", desc: "Code, issues, and roadmap." },
            { icon: BookOpen, label: "Documentation", href: "#", desc: "Guides and reference (coming soon)." },
          ].map((r) => (
            <a
              key={r.label}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                textDecoration: "none", color: "white",
                transition: "background 0.18s, border-color 0.18s",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#A5B4FC", flexShrink: 0,
              }}>
                <r.icon size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{r.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </SectionCard>

      {/* Contact */}
      <SectionCard icon={MessageCircle} accent="#14B8A6" title="Contact">
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
          Found a bug or have a feature idea? We&apos;d love to hear from you.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <a
            href="mailto:hello@unio.campus"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 14px", borderRadius: 10,
              background: "linear-gradient(135deg,#6366F1,#818CF8)",
              border: "1px solid rgba(99,102,241,0.5)",
              color: "white", fontSize: 12.5, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Mail size={13} /> Email us
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Github size={13} /> Open an issue
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
