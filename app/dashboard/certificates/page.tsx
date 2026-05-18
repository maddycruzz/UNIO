'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronLeft, ChevronRight, Search, Check,
  Download, Sparkles, Loader2, CheckCircle2,
  Users, FolderUp, Settings2, Layers, LayoutTemplate, PanelLeftClose, PanelRightClose,
} from 'lucide-react';
import JSZip from 'jszip';
import { EventInfo, Participant } from '@/components/certificates/types';
import {
  loadEvents,
  loadParticipants,
  type UnioEvent,
  type UnioParticipant,
} from '@/lib/store';

const EMPTY_EVENT: EventInfo = { id: '', title: 'No events yet', date: '—', type: 'Other' };

function toEventInfo(e: UnioEvent): EventInfo {
  return { id: e.id, title: e.name, date: e.date, type: e.type };
}

function toCertParticipant(p: UnioParticipant): Participant {
  return { id: p.id, name: p.name, email: p.email, rollNo: p.rollNo, dept: p.dept };
}
import { FabricProvider, useFabric } from '@/components/certificates/fabric-editor';
import FabricCanvas from '@/components/certificates/fabric-editor/FabricCanvas';
import EditorToolbar from '@/components/certificates/fabric-editor/Toolbar';
import PropertiesPanel from '@/components/certificates/fabric-editor/PropertiesPanel';
import TemplatesSidebar from '@/components/certificates/fabric-editor/TemplatesSidebar';
import LayersPanelOnly from '@/components/certificates/fabric-editor/LayersPanel';

// ──────────────────────────────────────────────────────────────────────────────
// Android-Studio-style collapsible side panel
// When `collapsed`, renders a thin vertical strip with rotated tab labels
// ──────────────────────────────────────────────────────────────────────────────
interface SidePanelProps {
  side: 'left' | 'right';
  tabs: { id: string; label: string; icon: React.ReactNode; content: React.ReactNode }[];
  defaultWidth?: number;
}

function SidePanel({ side, tabs, defaultWidth = 280 }: SidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  const stripWidth = 28;

  return (
    <div style={{
      display: 'flex',
      flexDirection: side === 'left' ? 'row' : 'row-reverse',
      height: '100%',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Vertical Tab Strip — always visible */}
      <div style={{
        width: stripWidth,
        background: '#1E2028',
        borderRight: side === 'left' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        borderLeft: side === 'right' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 0,
        flexShrink: 0,
      }}>
        {/* Collapse toggle at top */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
          style={{
            width: 22, height: 22, borderRadius: 5,
            border: 'none', background: 'transparent',
            color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 6, transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#818CF8')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          {side === 'left'
            ? (collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />)
            : (collapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />)
          }
        </button>

        {/* Tab buttons — rotated labels */}
        {tabs.map(tab => {
          const isActive = tab.id === activeTab && !collapsed;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (collapsed) {
                  // Always expand and switch to clicked tab
                  setCollapsed(false);
                  setActiveTab(tab.id);
                } else if (tab.id === activeTab) {
                  // Clicking the active tab collapses the panel
                  setCollapsed(true);
                } else {
                  // Switch to the clicked tab (staying expanded)
                  setActiveTab(tab.id);
                }
              }}
              title={tab.label}
              style={{
                width: '100%',
                padding: '10px 0',
                border: 'none',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderRight: side === 'left' && isActive ? '2px solid #818CF8' : undefined,
                borderLeft: side === 'right' && isActive ? '2px solid #818CF8' : undefined,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Icon */}
              <span style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.4)', display: 'flex' }}>
                {tab.icon}
              </span>
              {/* Rotated label */}
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isActive ? '#818CF8' : 'rgba(255,255,255,0.35)',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: side === 'left' ? 'rotate(180deg)' : 'rotate(0deg)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expandable Panel Content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="panel-content"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: defaultWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{
              overflow: 'hidden',
              background: '#2B2D30',
              borderRight: side === 'left' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderLeft: side === 'right' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div style={{ width: defaultWidth, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {activeContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main content
// ──────────────────────────────────────────────────────────────────────────────
function CertificatesContent() {
  const [allEvents, setAllEvents] = useState<UnioEvent[]>([]);
  const [allParticipants, setAllParticipants] = useState<UnioParticipant[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventInfo>(EMPTY_EVENT);
  const [showEventDD, setShowEventDD] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { canvas, loadJSON, pushHistory, refreshLayers } = useFabric();
  const hiddenCanvasElRef = useRef<HTMLCanvasElement>(null);

  // Load default template
  useEffect(() => {
    if (!canvas) return;
    import('@/components/certificates/fabric-editor/templates-data').then(({ CERT_TEMPLATES }) => {
      loadJSON(CERT_TEMPLATES[0].fabricJSON);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  // Live store wiring: events + participants come from lib/store and
  // refresh automatically when other pages change data.
  useEffect(() => {
    const refresh = () => {
      const events = loadEvents();
      setAllEvents(events);
      setAllParticipants(loadParticipants());
      setSelectedEvent((prev) => {
        // Keep current selection if it still exists; otherwise default
        // to the first event (or the empty placeholder).
        const found = events.find((e) => e.id === prev.id);
        if (found) return toEventInfo(found);
        return events[0] ? toEventInfo(events[0]) : EMPTY_EVENT;
      });
    };
    refresh();
    window.addEventListener('unio-store-change', refresh);
    return () => window.removeEventListener('unio-store-change', refresh);
  }, []);

  const events = useMemo(() => allEvents.map(toEventInfo), [allEvents]);
  const participants = useMemo(
    () => allParticipants
      .filter((p) => !selectedEvent.id || p.eventId === selectedEvent.id)
      .map(toCertParticipant),
    [allParticipants, selectedEvent.id],
  );

  const filtered = participants.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.rollNo.toLowerCase().includes(search.toLowerCase()) ||
    p.dept.toLowerCase().includes(search.toLowerCase()),
  );
  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const previewP = filtered[previewIndex] ?? participants[0];

  const selectEvent = (ev: EventInfo) => {
    setSelectedEvent(ev);
    setShowEventDD(false);
    if (canvas) {
      canvas.getObjects().forEach((obj: any) => {
        if (obj.__uid === 'event_name') obj.set('text', `"${ev.title}"`);
        if (obj.__uid === 'event_date') obj.set('text', `Held on ${ev.date}`);
      });
      canvas.renderAll();
      pushHistory();
      refreshLayers();
    }
  };

  const getExportCanvas = async () => {
    if (!canvas || !hiddenCanvasElRef.current) return null;
    const { Canvas } = await import('fabric');
    const exportCanvas = new Canvas(hiddenCanvasElRef.current, { width: 1123, height: 794 });
    const json = (canvas as any).toJSON(['__uid', 'name']);
    await exportCanvas.loadFromJSON(json);
    return exportCanvas;
  };

  const downloadSingle = async (p: Participant) => {
    const exportCanvas = await getExportCanvas();
    if (!exportCanvas) return;
    exportCanvas.getObjects().forEach((obj: any) => {
      if (obj.__uid === 'recipient_name' || obj.text?.includes('Recipient Name')) {
        obj.set('text', p.name);
      }
    });
    exportCanvas.renderAll();
    const dataURL = exportCanvas.toDataURL({ format: 'png', multiplier: 2 });
    const link = document.createElement('a');
    link.download = `${p.name.replace(/\s+/g, '-')}-certificate.png`;
    link.href = dataURL;
    link.click();
    exportCanvas.dispose();
  };

  const downloadAllZip = async () => {
    if (selected.size === 0) return;
    setDownloadingAll(true);
    const zip = new JSZip();
    const targets = participants.filter(p => selected.has(p.id));
    const exportCanvas = await getExportCanvas();
    if (!exportCanvas) { setDownloadingAll(false); return; }
    for (const p of targets) {
      exportCanvas.getObjects().forEach((obj: any) => {
        if (obj.__uid === 'recipient_name' || obj.text?.includes('Recipient Name'))
          obj.set('text', p.name);
      });
      exportCanvas.renderAll();
      const base64 = exportCanvas.toDataURL({ format: 'png', multiplier: 2 }).split(',')[1];
      zip.file(`${p.name.replace(/\s+/g, '-')}-certificate.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedEvent.title.replace(/\s+/g, '-')}-certificates.zip`;
    a.click();
    exportCanvas.dispose();
    setDownloadingAll(false);
  };

  const generateBulk = async () => {
    if (selected.size === 0) return;
    setGenerating(true); setGenerated([]);
    const targets = participants.filter(p => selected.has(p.id));
    for (const t of targets) {
      await new Promise(r => setTimeout(r, 250));
      setGenerated(prev => [...prev, t.id]);
    }
    setGenerating(false); setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3500);
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(p => p.id)));

  useEffect(() => {
    if (canvas && previewP) {
      canvas.getObjects().forEach((obj: any) => {
        if (obj.__uid === 'recipient_name') {
          if (obj.text !== previewP.name && obj.text !== 'Recipient Name') {
            obj.set('text', previewP.name);
          }
        }
      });
      canvas.renderAll();
    }
  }, [previewP, canvas]);

  // Left panel tabs
  const leftTabs = [
    {
      id: 'attributes',
      label: 'Attributes',
      icon: <Settings2 size={13} />,
      content: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <PropertiesPanel />
        </div>
      ),
    },
    {
      id: 'participants',
      label: 'Participants',
      icon: <Users size={13} />,
      content: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{
            padding: '10px 12px 6px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Participants
            </span>
            <button onClick={toggleAll}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                background: allSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${allSelected ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}`,
                color: allSelected ? '#818CF8' : 'rgba(255,255,255,0.4)', cursor: 'pointer',
              }}>
              {allSelected ? 'Deselect' : 'Select All'}
            </button>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={12} color="rgba(255,255,255,0.25)"
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants…"
                style={{
                  paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 4, color: '#fff', fontSize: 11, outline: 'none', width: '100%',
                  boxSizing: 'border-box',
                }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 600 }}>
              {selected.size} SELECTED
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filtered.map((p, i) => {
                const isSel = selected.has(p.id);
                const isDone = generated.includes(p.id);
                return (
                  <div key={p.id}
                    onClick={() => { toggleSelect(p.id); setPreviewIndex(i); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      cursor: 'pointer', borderRadius: 6,
                      background: isSel ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${isSel ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'}`,
                    }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                      border: `1px solid ${isSel ? '#818CF8' : 'rgba(255,255,255,0.2)'}`,
                      background: isSel ? '#818CF8' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSel && <Check size={8} color="#1E1E2E" strokeWidth={3} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: isSel ? '#fff' : 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{p.rollNo}</span>
                    </div>
                    {isDone && <CheckCircle2 size={12} color="#10B981" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Right panel tabs
  const rightTabs = [
    {
      id: 'templates',
      label: 'Templates',
      icon: <LayoutTemplate size={13} />,
      content: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <TemplatesSidebar />
        </div>
      ),
    },
    {
      id: 'layers',
      label: 'Layers',
      icon: <Layers size={13} />,
      content: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{
            padding: '10px 12px 6px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Layers
            </span>
          </div>
          <div style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
            <LayersPanelOnly />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{
      height: '100vh', overflow: 'hidden', backgroundColor: '#0F1117', color: '#fff',
      fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowEventDD(!showEventDD)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
              }}>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>{selectedEvent.title}</h1>
              <ChevronDown size={15} color="rgba(255,255,255,0.4)" />
            </button>
            <AnimatePresence>
              {showEventDD && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  style={{
                    position: 'absolute', top: '110%', left: 0, backgroundColor: '#1a1d27',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden',
                    zIndex: 50, minWidth: 260, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                  }}>
                  {events.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      No events yet. Create one from the Events page.
                    </div>
                  ) : events.map(ev => (
                    <button key={ev.id} onClick={() => selectEvent(ev)}
                      style={{
                        width: '100%', display: 'flex',
                        padding: '10px 14px', background: ev.id === selectedEvent.id ? 'rgba(99,102,241,0.12)' : 'none',
                        border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, textAlign: 'left',
                        justifyContent: 'space-between',
                      }}>
                      <span style={{ fontWeight: 600 }}>{ev.title}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{ev.date}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>Fabric.js Editor</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '7px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {selected.size > 0 ? <><span style={{ color: '#818CF8', fontWeight: 700 }}>{selected.size}</span> sel</> : '—'}
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={downloadAllZip} disabled={selected.size === 0 || downloadingAll}
            style={actionBtn(selected.size > 0, '#10B981')}>
            {downloadingAll ? <Loader2 size={13} className="spin" /> : <Download size={13} />} ZIP
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => alert('Google Drive stub')}
            style={actionBtn(false, '#60a5fa')}>
            <FolderUp size={13} /> Drive
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={generateBulk} disabled={selected.size === 0 || generating}
            style={{
              ...actionBtn(selected.size > 0, '#6366F1'),
              background: selected.size > 0 ? 'linear-gradient(135deg,#6366F1,#818CF8)' : undefined,
              color: selected.size > 0 ? '#fff' : undefined,
            }}>
            {generating ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Generate
          </motion.button>
        </div>
      </div>

      {showSuccess && (
        <div style={{
          padding: '10px 24px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#34d399', flexShrink: 0,
        }}>
          <CheckCircle2 size={14} /> {selected.size} certificates generated!
        </div>
      )}

      {/* ── EDITOR AREA — 3 Columns ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left Panel — Attributes + Participants */}
        <SidePanel side="left" tabs={leftTabs} defaultWidth={268} />

        {/* Center Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <EditorToolbar />
          <FabricCanvas width={1123} height={794} />

          {/* Bottom nav bar */}
          <div style={{
            padding: '7px 16px', background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} disabled={previewIndex === 0}
                style={navBtn(previewIndex === 0)}><ChevronLeft size={12} /></button>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 60, textAlign: 'center', fontWeight: 600 }}>
                {previewIndex + 1}/{Math.max(filtered.length, 1)}</span>
              <button onClick={() => setPreviewIndex(i => Math.min(filtered.length - 1, i + 1))}
                disabled={previewIndex >= filtered.length - 1}
                style={navBtn(previewIndex >= filtered.length - 1)}><ChevronRight size={12} /></button>
            </div>
            {previewP && (
              <button onClick={() => downloadSingle(previewP)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                  borderRadius: 6, background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                <Download size={11} /> Download PNG
              </button>
            )}
          </div>
        </div>

        {/* Right Panel — Templates + Layers */}
        <SidePanel side="right" tabs={rightTabs} defaultWidth={268} />

      </div>

      <canvas ref={hiddenCanvasElRef} style={{ display: 'none' }} />
      {showEventDD && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowEventDD(false)} />}
      <style>{`
        @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function actionBtn(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed',
    background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
    color: active ? color : 'rgba(255,255,255,0.3)',
  };
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: disabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
  };
}

export default function CertificatesPage() {
  return (
    <FabricProvider>
      <CertificatesContent />
    </FabricProvider>
  );
}
