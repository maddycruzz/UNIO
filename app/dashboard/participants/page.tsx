'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type UnioParticipant,
  type UnioEvent,
  type ParticipantStatus,
} from '@/lib/store';
import {
  loadParticipants as dbLoadParticipants,
  loadEvents as dbLoadEvents,
  addParticipant as dbAddParticipant,
  updateParticipant as dbUpdateParticipant,
  deleteParticipant as dbDeleteParticipant,
  checkInParticipant as dbCheckIn,
} from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { PermissionGate } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  Search, Plus, Download, Upload, QrCode, CheckCircle2, Clock,
  Filter, X, ChevronDown, Users, UserCheck,
  MoreHorizontal, Mail, Phone, Trash2, Eye, FileText,
  Table, RotateCcw, Hourglass, XCircle, Award, AlertCircle
} from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import Link from 'next/link';

// ── Import types & parser ─────────────────────────────────────────
type NewParticipantRow = {
  name: string;
  email: string;
  phone?: string;
  rollNo?: string;
  dept?: string;
};

type ImportPreview = {
  fileName: string;
  valid: NewParticipantRow[];
  skippedDupes: NewParticipantRow[];
  invalid: { row: NewParticipantRow; reason: string }[];
};

const HEADER_ALIASES: Record<keyof NewParticipantRow, string[]> = {
  name:   ['name', 'full name', 'fullname', 'participant name', 'participant', 'student name'],
  email:  ['email', 'e-mail', 'mail', 'email address', 'email id', 'emailid'],
  phone:  ['phone', 'mobile', 'contact', 'phone number', 'mobile number', 'contact number'],
  rollNo: ['rollno', 'roll no', 'roll number', 'roll', 'reg no', 'regno', 'registration no', 'registration number', 'student id', 'studentid'],
  dept:   ['dept', 'department', 'branch', 'stream'],
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[_\s.-]+/g, ' ');

function mapRow(raw: unknown): NewParticipantRow {
  const lookup: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v == null) continue;
      if (typeof v === 'object') continue; // skip nested objects/arrays
      lookup[normalize(k)] = String(v).trim();
    }
  }
  const pick = (field: keyof NewParticipantRow): string => {
    for (const alias of HEADER_ALIASES[field]) {
      const key = normalize(alias);
      if (lookup[key]) return lookup[key];
    }
    return '';
  };
  return {
    name:   pick('name'),
    email:  pick('email'),
    phone:  pick('phone'),
    rollNo: pick('rollNo'),
    dept:   pick('dept'),
  };
}

const isRowEmpty = (r: NewParticipantRow) =>
  !r.name && !r.email && !r.phone && !r.rollNo && !r.dept;

async function parseParticipantFile(file: File): Promise<NewParticipantRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    let arr: unknown[] = [];
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && typeof parsed === 'object') {
      // Look for the first array-valued property (participants, data, rows, items, …)
      for (const v of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) { arr = v; break; }
      }
    }
    return arr.map(mapRow).filter(r => !isRowEmpty(r));
  }
  // CSV / XLSX / XLS / ODS — handled by SheetJS
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  // raw: false → coerce numbers/dates to formatted strings so phones/roll-nos
  // don't get mangled into scientific notation or date serials.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return rows.map(mapRow).filter(r => !isRowEmpty(r));
}

// ── Constants ──────────────────────────────────────────────────────
const DEPTS = ['All', 'CS', 'ECE', 'IT', 'MECH', 'CIVIL'];

const STATUS_CONFIG: Record<ParticipantStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'checked-in': { label: 'Checked In',  color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
  'registered':  { label: 'Registered', color: '#6366F1', bg: 'rgba(99,102,241,0.12)', icon: Clock },
  'waitlisted':  { label: 'Waitlisted', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: Hourglass },
  'attended':    { label: 'Attended',   color: '#14B8A6', bg: 'rgba(20,184,166,0.12)', icon: Award },
  'cancelled':   { label: 'Cancelled',  color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: XCircle },
};

// ── Main Page ──────────────────────────────────────────────────────
export default function ParticipantsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [participants, setParticipants] = useState<UnioParticipant[]>([]);
  const [events, setEvents] = useState<UnioEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<UnioEvent | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ParticipantStatus | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<UnioParticipant | null>(null);
  const [showQR, setShowQR] = useState<UnioParticipant | null>(null);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [evts, parts] = await Promise.all([
        dbLoadEvents(),
        dbLoadParticipants(),
      ]);
      setEvents(evts);
      setSelectedEvent(evts[0] || null);
      setParticipants(parts);
    };
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('unio-store-change', handler);
    return () => window.removeEventListener('unio-store-change', handler);
  }, []);

  // Filter participants by selected event, then apply search/status/dept filters
  const eventParticipants = selectedEvent
    ? participants.filter(p => p.eventId === selectedEvent.id)
    : participants;

  const isFull = selectedEvent?.capacity != null
    ? eventParticipants.length >= selectedEvent.capacity
    : false;

  const filtered = eventParticipants.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.rollNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchDept = deptFilter === 'All' || p.dept === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const stats = {
    total:      eventParticipants.length,
    checkedIn:  eventParticipants.filter(p => p.status === 'checked-in').length,
    registered: eventParticipants.filter(p => p.status === 'registered').length,
    waitlisted: eventParticipants.filter(p => p.status === 'waitlisted').length,
    capacity:   selectedEvent?.capacity ?? null,
  };
  const capacityLabel = stats.capacity ?? '∞';
  const checkInProgress = stats.capacity != null
    ? Math.min((stats.checkedIn / stats.capacity) * 100, 100)
    : (stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0);

  const handleCheckIn = async (id: string) => {
    const prev = participants;
    setParticipants((p) =>
      p.map((x) => x.id === id ? { ...x, status: 'checked-in' as const, checkedInAt: 'Just now' } : x)
    );
    try {
      await dbCheckIn(id);
    } catch (e) {
      setParticipants(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't check in.");
    }
  };

  const handleRevertToRegistered = async (id: string) => {
    setMenuOpen(null);
    const prev = participants;
    setParticipants((p) =>
      p.map((x) => x.id === id ? { ...x, status: 'registered' as const, checkedInAt: undefined } : x)
    );
    try {
      await dbUpdateParticipant(id, { status: 'registered', checkedInAt: undefined });
    } catch (e) {
      setParticipants(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't revert status.");
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpen(null);
    const target = participants.find((p) => p.id === id);
    const ok = await confirm({
      title: "Remove participant?",
      message: target?.name
        ? `${target.name} will be removed from this event. They can re-register if needed.`
        : "This participant will be removed from the event.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    const prev = participants;
    setParticipants((p) => p.filter((x) => x.id !== id));
    try {
      await dbDeleteParticipant(id);
      toast.success("Participant removed.");
    } catch (e) {
      setParticipants(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't remove participant.");
    }
  };

  type NewParticipantInput = Omit<UnioParticipant, 'id' | 'status' | 'registeredAt' | 'eventId'>;
  const handleAdd = async (data: NewParticipantInput) => {
    if (isFull || !selectedEvent) return;
    const newP: UnioParticipant = {
      ...data,
      id: `p${Date.now()}`,
      status: 'registered',
      registeredAt: 'Just now',
      eventId: selectedEvent.id,
    };
    await dbAddParticipant(newP);
    setParticipants((prev) => [newP, ...prev]);
    setShowAddModal(false);
  };

  // ── Import (CSV / XLSX / XLS / JSON) ──
  const openFilePicker = () => fileInputRef.current?.click();

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file again re-triggers
    if (!file) return;
    if (!selectedEvent) {
      toast.error('Select an event first.');
      return;
    }
    try {
      const rows = await parseParticipantFile(file);
      if (rows.length === 0) {
        toast.error('No rows found in that file.');
        return;
      }
      const existingEmails = new Set(
        eventParticipants.map(p => p.email.trim().toLowerCase()).filter(Boolean)
      );
      const valid: NewParticipantRow[] = [];
      const skippedDupes: NewParticipantRow[] = [];
      const invalid: { row: NewParticipantRow; reason: string }[] = [];
      const seenInFile = new Set<string>();

      for (const row of rows) {
        if (!row.name || !row.email) {
          invalid.push({ row, reason: 'Missing name or email' });
          continue;
        }
        const emailKey = row.email.trim().toLowerCase();
        if (seenInFile.has(emailKey)) {
          skippedDupes.push(row);
          continue;
        }
        seenInFile.add(emailKey);
        if (existingEmails.has(emailKey)) {
          skippedDupes.push(row);
          continue;
        }
        valid.push(row);
      }

      setImportPreview({ fileName: file.name, valid, skippedDupes, invalid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file.');
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview || !selectedEvent) return;
    setIsImporting(true);
    const remainingCapacity = selectedEvent.capacity != null
      ? Math.max(0, selectedEvent.capacity - eventParticipants.length)
      : Infinity;
    const toInsert = importPreview.valid.slice(0, remainingCapacity);
    const capped = importPreview.valid.length - toInsert.length;

    const inserted: UnioParticipant[] = [];
    const failed: string[] = [];
    for (const [i, row] of toInsert.entries()) {
      const newP: UnioParticipant = {
        id: `p${Date.now()}_${i}`,
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        rollNo: row.rollNo || '',
        dept: row.dept || '',
        status: 'registered',
        registeredAt: 'Just now',
        eventId: selectedEvent.id,
      };
      try {
        await dbAddParticipant(newP);
        inserted.push(newP);
      } catch (err) {
        failed.push(row.email);
      }
    }
    if (inserted.length) setParticipants(prev => [...inserted, ...prev]);
    setIsImporting(false);
    setImportPreview(null);

    const parts = [`${inserted.length} imported`];
    if (importPreview.skippedDupes.length) parts.push(`${importPreview.skippedDupes.length} duplicate(s) skipped`);
    if (importPreview.invalid.length) parts.push(`${importPreview.invalid.length} invalid skipped`);
    if (capped > 0) parts.push(`${capped} skipped (capacity)`);
    if (failed.length) parts.push(`${failed.length} failed`);
    if (inserted.length > 0) toast.success(parts.join(' · '));
    else toast.error(parts.join(' · '));
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Roll No', 'Department', 'Status', 'Registered At', 'Checked In At'];
    const rows = filtered.map(p => [p.name, p.email, p.phone, p.rollNo, p.dept, p.status, p.registeredAt, p.checkedInAt || '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedEvent?.name || 'participants').replace(/\s+/g, '-')}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // ── Export Excel (as CSV with .xlsx extension via Blob, proper xlsx needs sheetjs) ──
  const exportExcel = () => {
    // Build a simple HTML table that Excel can open
    const headers = ['Name', 'Email', 'Phone', 'Roll No', 'Department', 'Status', 'Registered At', 'Checked In At'];
    const rows = filtered.map(p => [p.name, p.email, p.phone, p.rollNo, p.dept, p.status, p.registeredAt, p.checkedInAt || '']);
    const tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body><table>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </table></body></html>`;
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedEvent?.name || 'participants').replace(/\s+/g, '-')}-participants.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // ── Export PDF (print dialog) ──
  const exportPDF = () => {
    const headers = ['Name', 'Email', 'Roll No', 'Dept', 'Status', 'Registered At'];
    const rows = filtered.map(p => [p.name, p.email, p.rollNo, p.dept, p.status, p.registeredAt]);
    const html = `
      <html>
      <head>
        <title>${selectedEvent?.name || 'Event'} — Participants</title>
        <style>
          body { font-family: sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { color: #666; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
          tr:last-child td { border-bottom: none; }
          .checked { color: #10B981; font-weight: 700; }
          .registered { color: #6366F1; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${selectedEvent?.name || 'Event'}</h1>
        <p>${selectedEvent?.date || ''} · ${filtered.length} participants</p>
        <table>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          ${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i === 4 ? c : ''}">${c}</td>`).join('')}</tr>`).join('')}
        </table>
      </body>
      </html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
    setShowExportMenu(false);
  };

  return (
    <div style={{ color: '#fff', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', margin: '0 0 6px' }}>Participants</p>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowEventDropdown(!showEventDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>{selectedEvent?.name || 'Participants'}</h1>
                <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
              </button>
              <AnimatePresence>
                {showEventDropdown && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    style={{ position: 'absolute', top: '110%', left: 0, backgroundColor: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', zIndex: 50, minWidth: 280, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                    {events.map(ev => (
                      <button key={ev.id} onClick={() => { setSelectedEvent(ev); setShowEventDropdown(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: ev.id === selectedEvent?.id ? 'rgba(99,102,241,0.12)' : 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, textAlign: 'left' }}>
                        <span>{ev.name}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{ev.date}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Capacity badge */}
            <div style={{ padding: '8px 14px', borderRadius: 10, backgroundColor: isFull ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isFull ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, fontSize: 12, fontWeight: 700, color: isFull ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
              {isFull ? '🔒 Full' : `${stats.total} / ${capacityLabel}`}
            </div>

            {/* Import button */}
            <PermissionGate action="participants.create_walkin">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.ods,.json,text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFilePicked}
                style={{ display: 'none' }}
              />
              <button onClick={openFilePicker} disabled={isFull || !selectedEvent}
                title={!selectedEvent ? 'Select an event first' : isFull ? 'Event is at capacity' : 'Import participants from CSV / Excel / JSON'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: (isFull || !selectedEvent) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: (isFull || !selectedEvent) ? 'not-allowed' : 'pointer' }}>
                <Upload size={14} /> Import
              </button>
            </PermissionGate>

            {/* Export dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={14} /> Export <ChevronDown size={12} />
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    style={{ position: 'absolute', top: '110%', right: 0, backgroundColor: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', zIndex: 100, minWidth: 180, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                    {[
                      { icon: FileText, label: 'Export as PDF',   action: exportPDF,   color: '#f87171' },
                      { icon: Table,    label: 'Export as Excel',  action: exportExcel, color: '#34d399' },
                      { icon: Download, label: 'Export as CSV',    action: exportCSV,   color: '#818cf8' },
                    ].map(({ icon: Icon, label, action, color }) => (
                      <button key={label} onClick={action}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Icon size={14} color={color} />
                        {label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scan QR */}
            <Link href="/dashboard/participants/scan" style={{ textDecoration: 'none' }}>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <QrCode size={14} /> Scan QR
              </button>
            </Link>

            <PermissionGate action="participants.create_walkin">
              <button
                onClick={() => !isFull && setShowAddModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, backgroundColor: isFull ? 'rgba(255,255,255,0.04)' : '#6366F1', border: isFull ? '1px solid rgba(255,255,255,0.1)' : 'none', color: isFull ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: 13, fontWeight: 700, cursor: isFull ? 'not-allowed' : 'pointer', boxShadow: isFull ? 'none' : '0 4px 16px rgba(99,102,241,0.3)' }}>
                <Plus size={14} /> {isFull ? 'Event Full' : 'Add Participant'}
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Full banner */}
        {isFull && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#f87171' }}>
            🔒 This event has reached its maximum capacity of {selectedEvent?.capacity ?? 0} participants. No more registrations can be added.
          </motion.div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total',      value: `${stats.total}/${capacityLabel}`, color: '#ffffff', icon: Users },
            { label: 'Checked In', value: stats.checkedIn,                    color: '#10B981', icon: UserCheck },
            { label: 'Registered', value: stats.registered,                   color: '#6366F1', icon: Clock },
            { label: 'Waitlisted', value: stats.waitlisted,                   color: '#F59E0B', icon: Hourglass },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
                <s.icon size={14} color={s.color} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0, letterSpacing: '-0.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 6, marginBottom: 24, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${checkInProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ height: '100%', backgroundColor: '#10B981', borderRadius: 999 }}
          />
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, roll no..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {(['all', 'checked-in', 'registered', 'waitlisted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
                backgroundColor: statusFilter === s ? (s === 'all' ? '#6366F1' : STATUS_CONFIG[s as ParticipantStatus]?.color || '#6366F1') : 'rgba(255,255,255,0.04)',
                borderColor: statusFilter === s ? 'transparent' : 'rgba(255,255,255,0.1)',
                color: statusFilter === s ? '#fff' : 'rgba(255,255,255,0.5)',
              }}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s as ParticipantStatus].label}
            </button>
          ))}

          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', outline: 'none' }}>
            {DEPTS.map(d => <option key={d} value={d} style={{ backgroundColor: '#1a1d27' }}>{d === 'All' ? 'All Depts' : d}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden', minWidth: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 80px', gap: 0, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            {['Participant', 'Contact', 'Roll No', 'Dept', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>{h}</span>
            ))}
          </div>

          <AnimatePresence>
            {filtered.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No participants found</div>
            ) : (
              filtered.map((p, i) => {
                const cfg = STATUS_CONFIG[p.status];
                const StatusIcon = cfg.icon;
                return (
                  <motion.div key={p.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 80px', gap: 0, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => setSelectedParticipant(p)}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.registeredAt}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{p.email}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.phone}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{p.rollNo}</p>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: 'fit-content' }}>{p.dept}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: cfg.bg, borderRadius: 8, padding: '5px 10px', width: 'fit-content', cursor: p.status !== 'checked-in' ? 'pointer' : 'default' }}
                      onClick={e => { e.stopPropagation(); if (p.status !== 'checked-in') handleCheckIn(p.id); }}>
                      <StatusIcon size={12} color={cfg.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setShowQR(p)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode size={13} color="rgba(255,255,255,0.5)" />
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MoreHorizontal size={13} color="rgba(255,255,255,0.5)" />
                        </button>
                        <AnimatePresence>
                          {menuOpen === p.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                              style={{ position: 'fixed', zIndex: 100, backgroundColor: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.6)', minWidth: 160 }}
                              ref={el => {
                                if (el) {
                                  const btn = el.previousElementSibling as HTMLElement;
                                  if (btn) {
                                    const r = btn.getBoundingClientRect();
                                    el.style.top = `${r.bottom + 4}px`;
                                    el.style.right = `${window.innerWidth - r.right}px`;
                                  }
                                }
                              }}>
                              <button onClick={() => { setSelectedParticipant(p); setMenuOpen(null); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                                <Eye size={13} /> View Details
                              </button>
                              {p.status !== 'checked-in' ? (
                                <button onClick={() => { handleCheckIn(p.id); setMenuOpen(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', fontSize: 13 }}>
                                  <CheckCircle2 size={13} /> Mark Checked In
                                </button>
                              ) : (
                                <button onClick={() => handleRevertToRegistered(p.id)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: 13 }}>
                                  <RotateCcw size={13} /> Revert to Registered
                                </button>
                              )}
                              <PermissionGate action="participants.delete">
                                <button onClick={() => handleDelete(p.id)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                                  <Trash2 size={13} /> Remove
                                </button>
                              </PermissionGate>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
        </div>{/* end overflow wrapper */}

        <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
          Showing {filtered.length} of {participants.length} participants · Capacity {capacityLabel}
        </p>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddModal && <AddModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />}
      </AnimatePresence>
      <AnimatePresence>
        {selectedParticipant && (
          <ParticipantDrawer
            participant={selectedParticipant}
            onClose={() => setSelectedParticipant(null)}
            onCheckIn={() => { handleCheckIn(selectedParticipant.id); setSelectedParticipant(p => p ? { ...p, status: 'checked-in', checkedInAt: 'Just now' } : null); }}
            onRevert={() => { handleRevertToRegistered(selectedParticipant.id); setSelectedParticipant(p => p ? { ...p, status: 'registered', checkedInAt: undefined } : null); }}
            onShowQR={() => { setShowQR(selectedParticipant); setSelectedParticipant(null); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showQR && <QRModal participant={showQR} onClose={() => setShowQR(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {importPreview && (
          <ImportModal
            preview={importPreview}
            isImporting={isImporting}
            onCancel={() => setImportPreview(null)}
            onConfirm={handleImportConfirm}
          />
        )}
      </AnimatePresence>

      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(null)} />}
      {showEventDropdown && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowEventDropdown(false)} />}
      {showExportMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowExportMenu(false)} />}
    </div>
  );
}

// ── Add Modal ─────────────────────────────────────────────────────
function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: any) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', rollNo: '', dept: 'CS' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => { 
    if (!form.name || !form.email) return; 
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAdd(form);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add participant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#161922', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Participant</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name',   label: 'Full Name',  placeholder: 'e.g. Ayaan Nizam',       type: 'text' },
            { key: 'email',  label: 'Email',       placeholder: 'e.g. ayaan@college.edu', type: 'email' },
            { key: 'phone',  label: 'Phone',       placeholder: '10-digit number',         type: 'text' },
            { key: 'rollNo', label: 'Roll Number', placeholder: 'e.g. 21CS001',            type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Department</label>
            <select value={form.dept} onChange={e => setForm(prev => ({ ...prev, dept: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }}>
              {['CS', 'ECE', 'IT', 'MECH', 'CIVIL'].map(d => <option key={d} value={d} style={{ backgroundColor: '#1a1d27' }}>{d}</option>)}
            </select>
          </div>
        </div>
        {errorMsg && <div style={{ marginTop: 16, fontSize: 13, color: '#EF4444', textAlign: 'center' }}>{errorMsg}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} disabled={isSubmitting} style={{ flex: 1, padding: '11px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 1, padding: '11px', borderRadius: 10, backgroundColor: '#6366F1', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}>
            {isSubmitting ? 'Adding...' : 'Add Participant'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Participant Drawer ─────────────────────────────────────────────
function ParticipantDrawer({ participant: p, onClose, onCheckIn, onRevert, onShowQR }: {
  participant: UnioParticipant; onClose: () => void; onCheckIn: () => void; onRevert: () => void; onShowQR: () => void;
}) {
  const cfg = STATUS_CONFIG[p.status];
  const StatusIcon = cfg.icon;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, backgroundColor: '#161922', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Participant Details</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            {p.name.charAt(0)}
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{p.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: cfg.bg, borderRadius: 8, padding: '4px 12px' }}>
            <StatusIcon size={12} color={cfg.color} />
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {[
            { icon: Mail,        label: 'Email',      value: p.email },
            { icon: Phone,       label: 'Phone',      value: p.phone },
            { icon: Users,       label: 'Roll No',    value: p.rollNo },
            { icon: Filter,      label: 'Department', value: p.dept },
            { icon: Clock,       label: 'Registered', value: p.registeredAt },
            ...(p.checkedInAt ? [{ icon: CheckCircle2, label: 'Checked In', value: p.checkedInAt }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <row.icon size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>{row.label}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#fff' }}>{row.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onShowQR} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <QrCode size={15} /> Show QR Code
          </button>
          {p.status !== 'checked-in' ? (
            <button onClick={onCheckIn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, backgroundColor: '#10B981', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <CheckCircle2 size={15} /> Mark as Checked In
            </button>
          ) : (
            <button onClick={onRevert} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <RotateCcw size={15} /> Revert to Registered
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── QR Modal ──────────────────────────────────────────────────────
function QRModal({ participant: p, onClose }: { participant: UnioParticipant; onClose: () => void }) {
  const qrValue = JSON.stringify({ id: p.id, name: p.name, rollNo: p.rollNo, email: p.email });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 32, textAlign: 'center', maxWidth: 320, width: '100%' }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#6366F1' }}>UNIO Check-in</p>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: '#0F1117' }}>{p.name}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <QRCode value={qrValue} size={200} fgColor="#0F1117" bgColor="#ffffff" level="H" />
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#0F1117' }}>{p.rollNo}</p>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280' }}>{p.dept} · {p.email}</p>
        <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 10, backgroundColor: '#0F1117', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────
function ImportModal({ preview, isImporting, onCancel, onConfirm }: {
  preview: ImportPreview;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { fileName, valid, skippedDupes, invalid } = preview;
  const sample = valid.slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={isImporting ? undefined : onCancel}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#161922', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>Import preview</h2>
          <button onClick={onCancel} disabled={isImporting} style={{ background: 'none', border: 'none', cursor: isImporting ? 'not-allowed' : 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{fileName}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <Stat label="Ready to import" value={valid.length} color="#10B981" />
          <Stat label="Duplicates skipped" value={skippedDupes.length} color="#F59E0B" />
          <Stat label="Invalid skipped" value={invalid.length} color="#EF4444" />
        </div>

        {valid.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 13, marginBottom: 16 }}>
            <AlertCircle size={16} /> No valid rows. Make sure your file has <strong style={{ margin: '0 4px' }}>Name</strong> and <strong style={{ marginLeft: 4 }}>Email</strong> columns.
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 18, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
          {sample.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                  {['Name', 'Email', 'Phone', 'Roll No', 'Dept'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>
                    <td style={{ padding: '8px 12px' }}>{r.name}</td>
                    <td style={{ padding: '8px 12px' }}>{r.email}</td>
                    <td style={{ padding: '8px 12px' }}>{r.phone || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.rollNo || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.dept || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {valid.length > sample.length && (
            <p style={{ margin: 0, padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              + {valid.length - sample.length} more rows…
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={isImporting}
            style={{ flex: 1, padding: '11px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: isImporting ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isImporting || valid.length === 0}
            style={{ flex: 1, padding: '11px', borderRadius: 10, backgroundColor: valid.length === 0 ? 'rgba(99,102,241,0.3)' : '#6366F1', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isImporting || valid.length === 0 ? 'not-allowed' : 'pointer', opacity: isImporting ? 0.6 : 1 }}>
            {isImporting ? 'Importing…' : `Import ${valid.length}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}