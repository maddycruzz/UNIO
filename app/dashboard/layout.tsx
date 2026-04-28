"use client";

import { useState, useEffect, useMemo } from "react";
import { loadProfile, ensureSeeded } from "@/lib/store";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const NAV_ITEMS = [
  {
    id: "dashboard", label: "Dashboard", href: "/dashboard", accent: "#6366F1",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>),
  },
  {
    id: "events", label: "Events", href: "/dashboard/events", accent: "#818CF8",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 1.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12.5 1.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1.5 7.5H16.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 11H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12.5" cy="12.5" r="1" fill="currentColor"/></svg>),
  },
  {
    id: "tasks", label: "Tasks", href: "/dashboard/tasks", accent: "#10B981",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.5 9L6.5 13L15.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  },
  {
    id: "meetings", label: "Meetings", href: "/dashboard/meetings", accent: "#F59E0B",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="13" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 15.5C1 12.7386 3.46243 11 6.5 11C9.53757 11 12 12.7386 12 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 10.5C15.2091 10.5 17 11.8431 17 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  },
  {
    id: "participants", label: "Participants", href: "/dashboard/participants", accent: "#EC4899",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2.5 16C2.5 12.6863 5.46243 10 9 10C12.5376 10 15.5 12.6863 15.5 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  },
  {
    id: "certificates", label: "Certificates", href: "/dashboard/certificates", accent: "#14B8A6",
    icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 7H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5.5 10H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 13V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M6.5 16.5H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  },
];

const BOTTOM_ITEMS = [
  { id: "settings", label: "Settings", href: "/dashboard/settings", icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.7 3.3L11.6 4.4M4.4 11.6L3.3 12.7M12.7 12.7L11.6 11.6M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>) },
  { id: "help", label: "Help", href: "/dashboard/help", icon: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6.2C6 5.09543 6.89543 4.2 8 4.2C9.10457 4.2 10 5.09543 10 6.2C10 7.30457 9.10457 8.2 8 8.2V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>) },
];

const SIDEBAR_W = 240;
const SIDEBAR_W_COL = 72;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  const sidebarW = collapsed ? SIDEBAR_W_COL : SIDEBAR_W;

  // Seed store on first visit
  useEffect(() => { ensureSeeded(); }, []);

  const profileData = useMemo(() => loadProfile(), []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const getActive = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  const activeItem = NAV_ITEMS.find(i => getActive(i.href));
  const hours = time.getHours();
  const greeting = hours < 12 ? "Morning" : hours < 18 ? "Afternoon" : "Evening";

  const NavLinks = ({ mini }: { mini?: boolean }) => (
    <>
      {NAV_ITEMS.map((item, idx) => {
        const isActive = getActive(item.href);
        const isHov = hoveredItem === item.id;
        return (
          <div key={item.id} style={{ marginBottom: mini ? 4 : 2 }}>
            <Link href={item.href} style={{ textDecoration: "none", display: "block" }}>
              <div
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: mini ? "10px 0" : "9px 12px",
                  justifyContent: mini ? "center" : "flex-start",
                  borderRadius: 10, cursor: "pointer", position: "relative",
                  background: isActive ? `linear-gradient(135deg,${item.accent}20,${item.accent}0a)` : isHov ? "rgba(255,255,255,0.04)" : "transparent",
                  border: isActive ? `1px solid ${item.accent}30` : "1px solid transparent",
                  transition: "background 0.2s,border-color 0.2s",
                }}
              >
                {isActive && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 2, background: item.accent, boxShadow: `0 0 8px ${item.accent}` }} />}
                <div style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: isActive ? item.accent : isHov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)", background: isActive ? `${item.accent}18` : isHov ? "rgba(255,255,255,0.06)" : "transparent", transition: "all 0.2s" }}>
                  {item.icon}
                </div>
                {!mini && <span style={{ fontSize: 13.5, fontWeight: isActive ? 600 : 500, color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)", whiteSpace: "nowrap", transition: "color 0.2s" }}>{item.label}</span>}
                {mini && isHov && (
                  <div style={{ position: "fixed", left: SIDEBAR_W_COL + 8, background: "#1A1D2E", border: `1px solid ${item.accent}40`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "white", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 200, boxShadow: `0 4px 20px rgba(0,0,0,0.5)` }}>{item.label}</div>
                )}
              </div>
            </Link>
          </div>
        );
      })}
    </>
  );

  const SidebarInner = ({ mini = false, onClose }: { mini?: boolean; onClose?: () => void }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
      {/* top glow */}
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.6),transparent)" }} />

      {/* Logo row */}
      <div style={{ padding: mini ? "20px 0" : "20px", display: "flex", alignItems: "center", justifyContent: mini ? "center" : "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", minHeight: 64, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            onClick={mini ? () => setCollapsed(false) : undefined}
            style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6366F1,#818CF8)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "white", flexShrink: 0, boxShadow: "0 0 20px rgba(99,102,241,0.4)", cursor: mini ? "pointer" : "default" }}
            title={mini ? "Expand sidebar" : undefined}
          >U</div>
          {!mini && <div><div style={{ fontSize: 17, fontWeight: 700, color: "white", letterSpacing: "0.04em", lineHeight: 1 }}>UNIO</div><div style={{ fontSize: 9, color: "rgba(99,102,241,0.8)", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>Campus Events</div></div>}
        </div>
        {!mini && onClose && (
          <button onClick={onClose} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}
        {!mini && !onClose && (
          <button onClick={() => setCollapsed(true)} style={{ width: 24, height: 24, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>

      {/* User strip */}
      {!mini && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6366F1,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>{profileData.initials.charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Good {greeting}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profileData.name}</div>
            </div>
            <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px rgba(16,185,129,0.6)", flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Active pill */}
      {!mini && activeItem && (
        <div style={{ margin: "12px 16px 0", padding: "6px 10px", background: `linear-gradient(135deg,${activeItem.accent}15,${activeItem.accent}08)`, border: `1px solid ${activeItem.accent}25`, borderRadius: 8, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: activeItem.accent }} />
          <span style={{ fontSize: 10, color: activeItem.accent, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{activeItem.label}</span>
        </div>
      )}

      {/* Nav label */}
      {!mini && <div style={{ padding: "16px 20px 6px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>Navigation</div>}

      {/* Nav links */}
      <nav style={{ flex: 1, padding: mini ? "12px 0" : "0 10px", overflowY: "auto", overflowX: "hidden" }}>
        <NavLinks mini={mini} />
      </nav>

      {/* Divider */}
      <div style={{ margin: mini ? "8px auto" : "8px 16px", height: 1, background: "rgba(255,255,255,0.06)", width: mini ? 32 : "auto", flexShrink: 0 }} />

      {/* Bottom */}
      <div style={{ padding: mini ? "4px 0 16px" : "4px 10px 16px", flexShrink: 0 }}>
        {BOTTOM_ITEMS.map(item => (
          <Link key={item.id} href={item.href} style={{ textDecoration: "none", display: "block" }}>
            <div onMouseEnter={() => setHoveredItem(item.id)} onMouseLeave={() => setHoveredItem(null)} style={{ display: "flex", alignItems: "center", gap: 10, padding: mini ? "8px 0" : "8px 12px", justifyContent: mini ? "center" : "flex-start", borderRadius: 8, cursor: "pointer", color: hoveredItem === item.id ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)", transition: "color 0.2s", marginBottom: 2 }}>
              {item.icon}
              {!mini && <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          </Link>
        ))}
        {!mini && <div style={{ marginTop: 8, padding: "0 12px", fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>UNIO v0.2.0 — Beta</div>}
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Inline responsive CSS ─── */}
      <style>{`
        .dash-layout { display: flex; min-height: 100vh; background: #0F1117; font-family: 'DM Sans', system-ui, sans-serif; }
        .dash-sidebar-desktop { position: fixed; top: 0; left: 0; height: 100vh; background: linear-gradient(180deg,#0D0F18 0%,#0A0C14 100%); border-right: 1px solid rgba(99,102,241,0.12); z-index: 50; overflow: hidden; transition: width 0.3s cubic-bezier(0.4,0,0.2,1); }
        .dash-main { flex: 1; min-height: 100vh; background: #0F1117; transition: margin-left 0.3s cubic-bezier(0.4,0,0.2,1); overflow-x: hidden; min-width: 0; }
        .dash-mobile-bar { display: none; }
        .dash-content { padding: 24px 28px; width: 100%; box-sizing: border-box; max-width: 1280px; }

        @media (max-width: 767px) {
          .dash-sidebar-desktop { display: none !important; }
          .dash-main { margin-left: 0 !important; }
          .dash-mobile-bar { display: flex; position: sticky; top: 0; z-index: 40; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(13,15,24,0.97); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(99,102,241,0.12); }
          .dash-content { padding: 14px 14px 32px; }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .dash-content { padding: 20px 20px; }
        }
      `}</style>

      <div className="dash-layout">

        {/* ── MOBILE OVERLAY SIDEBAR ── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 60 }} />
              <motion.aside initial={{ x: -264 }} animate={{ x: 0 }} exit={{ x: -264 }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }} style={{ position: "fixed", top: 0, left: 0, height: "100dvh", width: 260, background: "linear-gradient(180deg,#0D0F18 0%,#0A0C14 100%)", borderRight: "1px solid rgba(99,102,241,0.12)", zIndex: 70 }}>
                <SidebarInner onClose={() => setMobileOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── DESKTOP SIDEBAR ── */}
        <div className="dash-sidebar-desktop" style={{ width: sidebarW }}>
          <SidebarInner mini={collapsed} />
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="dash-main" style={{ marginLeft: sidebarW }}>

          {/* Mobile top bar */}
          <div className="dash-mobile-bar">
            <button onClick={() => setMobileOpen(true)} style={{ width: 36, height: 36, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#818CF8", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#6366F1,#818CF8)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white", flexShrink: 0 }}>U</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "white", letterSpacing: "0.04em" }}>UNIO</span>
            </div>
            {activeItem && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: `${activeItem.accent}18`, border: `1px solid ${activeItem.accent}35`, borderRadius: 20, flexShrink: 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: activeItem.accent }} />
                <span style={{ fontSize: 11, color: activeItem.accent, fontWeight: 600 }}>{activeItem.label}</span>
              </div>
            )}
          </div>

          {/* Page content */}
          <div className="dash-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}