"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, AtSign, Megaphone, Clock4, Check } from "lucide-react";
import {
  loadNotifications,
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/db";
import type { UnioNotification, NotificationType } from "@/lib/store";
import { formatRelativeTime } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

function iconFor(type: NotificationType) {
  switch (type) {
    case "mention":      return <AtSign size={13} />;
    case "announcement": return <Megaphone size={13} />;
    case "due_soon":     return <Clock4 size={13} />;
    case "assignment":   return <Check size={13} />;
    case "comment_reply":return <AtSign size={13} />;
  }
}

function colorFor(type: NotificationType): string {
  switch (type) {
    case "mention":      return "#A78BFA";
    case "announcement": return "#F472B6";
    case "due_soon":     return "#F59E0B";
    case "assignment":   return "#10B981";
    case "comment_reply":return "#818CF8";
  }
}

function describe(n: UnioNotification): string {
  const p = n.payload || {};
  switch (n.type) {
    case "mention":      return `mentioned you in a ${String(p.parent_type || "comment")}`;
    case "announcement": return `New announcement: ${String(p.title || "")}`;
    case "due_soon":     return `Task due soon: ${String(p.title || "")}`;
    case "assignment":   return `You were assigned: ${String(p.title || "")}`;
    case "comment_reply":return `Replied to your comment`;
  }
}

function hrefFor(n: UnioNotification): string | null {
  const p = n.payload || {};
  if (n.type === "announcement") return "/dashboard/announcements";
  if (n.type === "mention" || n.type === "comment_reply") {
    if (p.parent_type === "event" && p.parent_id) return `/dashboard/events/${p.parent_id}`;
    if (p.parent_type === "task")  return `/dashboard/tasks`;
    if (p.parent_type === "meeting") return `/dashboard/meetings`;
  }
  if (n.type === "due_soon") return "/dashboard/tasks";
  return null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UnioNotification[]>([]);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setItems(await loadNotifications());
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const unsub = subscribeNotifications(user.id, refresh);
    const onLocal = () => refresh();
    window.addEventListener("unio-store-change", onLocal);
    return () => {
      unsub();
      window.removeEventListener("unio-store-change", onLocal);
    };
  }, [user, refresh]);

  // Click-outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  const onClickItem = async (n: UnioNotification) => {
    if (!n.readAt) await markNotificationRead(n.id).catch(console.warn);
    setOpen(false);
    const href = hrefFor(n);
    if (href) router.push(href);
    await refresh();
  };

  if (!user) return null;

  return (
    <div ref={popupRef} style={{ position: "fixed", top: 14, right: 18, zIndex: 75 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: open ? "rgba(99,102,241,0.18)" : "rgba(13,15,24,0.85)",
          color: open ? "#818CF8" : "rgba(255,255,255,0.7)",
          border: "1px solid rgba(99,102,241,0.22)",
          backdropFilter: "blur(8px)",
          cursor: "pointer", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 9, background: "#EF4444", color: "white",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #0F1117",
          }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{
              position: "absolute", top: 46, right: 0, width: "min(360px, 90vw)",
              background: "#11131C", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 12,
              boxShadow: "0 16px 60px rgba(0,0,0,0.6)",
              overflow: "hidden",
              color: "white", fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead().then(refresh)}
                  style={{ fontSize: 11, color: "#818CF8", background: "transparent", border: "none", cursor: "pointer" }}
                >Mark all read</button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {items.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  No notifications yet.
                </div>
              ) : items.map((n) => {
                const color = colorFor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => onClickItem(n)}
                    style={{
                      display: "flex", gap: 10, alignItems: "flex-start", width: "100%",
                      padding: "10px 14px",
                      background: !n.readAt ? "rgba(99,102,241,0.07)" : "transparent",
                      border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      color: "white", textAlign: "left", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = !n.readAt ? "rgba(99,102,241,0.07)" : "transparent")}
                  >
                    <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 7, background: `${color}24`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {iconFor(n.type)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.92)", marginBottom: 2 }}>
                        {describe(n)}
                      </span>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>
                        {formatRelativeTime(new Date(n.createdAt).getTime())}
                      </span>
                    </span>
                    {!n.readAt && <span style={{ width: 6, height: 6, borderRadius: 3, background: "#818CF8", marginTop: 6, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
