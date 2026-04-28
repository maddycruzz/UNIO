// Pre-built Fabric.js certificate templates
// Each entry is a fabric.Canvas.toJSON()-compatible object

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  accent: string;
  preview: {
    bg: string;
    border: string;
    heading: string;
    sub: string;
  };
  fabricJSON: object;
}

// ── Template builder helpers ──────────────────────────────────────
const W = 1123;
const H = 794;

function certTextObjects(
  accent: string,
  heading: string,
  body: string,
  sub: string,
  bg: string,
) {
  return [
    {
      type: 'rect',
      version: '6.0.0',
      left: 0, top: 0, width: W, height: H,
      fill: bg, selectable: false, evented: false,
      rx: 0, ry: 0, strokeWidth: 0,
      __uid: 'bg_rect',
    },
    // Border outer
    {
      type: 'rect',
      version: '6.0.0',
      left: 7, top: 7, width: W - 14, height: H - 14,
      fill: 'transparent',
      stroke: accent, strokeWidth: 14,
      selectable: false, evented: false,
      __uid: 'border_outer',
    },
    // Border inner
    {
      type: 'rect',
      version: '6.0.0',
      left: 26, top: 26, width: W - 52, height: H - 52,
      fill: 'transparent',
      stroke: accent, strokeWidth: 1.5, opacity: 0.45,
      selectable: false, evented: false,
      __uid: 'border_inner',
    },
    // Header band
    {
      type: 'rect',
      version: '6.0.0',
      left: 14, top: 14, width: W - 28, height: 70,
      fill: accent, opacity: 0.08,
      selectable: false, evented: false,
      __uid: 'header_band',
    },
    // UNIO Logo text
    {
      type: 'i-text',
      version: '6.0.0',
      left: 52, top: 46,
      text: 'UNIO',
      fontSize: 22, fontWeight: '800',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: accent,
      originX: 'left', originY: 'center',
      selectable: true, evented: true,
      __uid: 'logo_text',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: 110, top: 46,
      text: 'Campus Events',
      fontSize: 11, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: sub,
      originX: 'left', originY: 'center',
      selectable: true, evented: true,
      __uid: 'logo_sub',
    },
    // Certificate heading
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 110,
      text: 'CERTIFICATE OF PARTICIPATION',
      fontSize: 13, fontWeight: '700', letterSpacing: 3,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: accent, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'cert_heading',
    },
    // Intro phrase
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 150,
      text: 'This certifies that',
      fontSize: 15, fontWeight: '400', fontStyle: 'italic',
      fontFamily: 'Georgia, serif',
      fill: sub, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'intro_phrase',
    },
    // Recipient name
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 215,
      text: 'Recipient Name',
      fontSize: 52, fontWeight: '700',
      fontFamily: 'Georgia, serif',
      fill: heading, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'recipient_name',
    },
    // Body text
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 280,
      text: 'has successfully participated in and contributed to the event',
      fontSize: 14, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: body, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'body_text',
    },
    // Event name
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 320,
      text: '"Spring Fest Night Market"',
      fontSize: 20, fontWeight: '700',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: accent, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'event_name',
    },
    // Event date
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 354,
      text: 'Held on March 22, 2025',
      fontSize: 12, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: sub, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'event_date',
    },
    // Seal placeholder circle
    {
      type: 'circle',
      version: '6.0.0',
      left: W / 2, top: 480,
      radius: 42,
      fill: 'transparent',
      stroke: accent, strokeWidth: 2, opacity: 0.55,
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'seal_circle',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: 476,
      text: 'OFFICIAL\nSEAL',
      fontSize: 11, fontWeight: '800',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: accent, textAlign: 'center',
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'seal_text',
    },
    // Signature line 1
    {
      type: 'line',
      version: '6.0.0',
      left: W * 0.28, top: 590,
      x1: -80, y1: 0, x2: 80, y2: 0,
      stroke: accent, strokeWidth: 1, opacity: 0.5,
      selectable: true, evented: true,
      __uid: 'sig_line_1',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: W * 0.28, top: 610,
      text: 'Dr. A. Rajan',
      fontSize: 12, fontWeight: '700',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: heading, textAlign: 'center',
      originX: 'center', originY: 'top',
      selectable: true, evented: true,
      __uid: 'sig1_name',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: W * 0.28, top: 628,
      text: 'Dean — Student Affairs',
      fontSize: 10, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: sub, textAlign: 'center',
      originX: 'center', originY: 'top',
      selectable: true, evented: true,
      __uid: 'sig1_title',
    },
    // Signature line 2
    {
      type: 'line',
      version: '6.0.0',
      left: W * 0.72, top: 590,
      x1: -80, y1: 0, x2: 80, y2: 0,
      stroke: sub, strokeWidth: 1, opacity: 0.5,
      selectable: true, evented: true,
      __uid: 'sig_line_2',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: W * 0.72, top: 610,
      text: 'Prof. K. Sharma',
      fontSize: 12, fontWeight: '700',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: heading, textAlign: 'center',
      originX: 'center', originY: 'top',
      selectable: true, evented: true,
      __uid: 'sig2_name',
    },
    {
      type: 'i-text',
      version: '6.0.0',
      left: W * 0.72, top: 628,
      text: 'Event Coordinator',
      fontSize: 10, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: sub, textAlign: 'center',
      originX: 'center', originY: 'top',
      selectable: true, evented: true,
      __uid: 'sig2_title',
    },
    // Footer
    {
      type: 'i-text',
      version: '6.0.0',
      left: W / 2, top: H - 32,
      text: 'Generated by UNIO Campus · unio.app',
      fontSize: 9, fontWeight: '400',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fill: sub, textAlign: 'center', opacity: 0.6,
      originX: 'center', originY: 'center',
      selectable: true, evented: true,
      __uid: 'footer',
    },
  ];
}

function makeTemplate(
  id: string, name: string, description: string,
  accent: string, bg: string, border: string, heading: string, body: string, sub: string,
): TemplateData {
  return {
    id, name, description, accent,
    preview: { bg, border, heading, sub },
    fabricJSON: {
      version: '6.0.0',
      objects: certTextObjects(accent, heading, body, sub, bg),
      background: bg,
    },
  };
}

export const CERT_TEMPLATES: TemplateData[] = [
  makeTemplate(
    'classic', 'Classic Indigo', 'Elegant indigo border with refined typography',
    '#6366F1', '#FAFAF8', '#6366F1', '#1E1B4B', '#374151', '#6B7280',
  ),
  makeTemplate(
    'emerald', 'Emerald Prestige', 'Modern green with clean lines',
    '#10B981', '#F0FDF4', '#10B981', '#064E3B', '#1F2937', '#6B7280',
  ),
  makeTemplate(
    'aurora', 'Aurora Gold', 'Premium gold gradient, ornate style',
    '#D97706', '#FFFBEB', '#D97706', '#78350F', '#374151', '#6B7280',
  ),
  makeTemplate(
    'midnight', 'Midnight Navy', 'Deep navy with platinum — most formal',
    '#818CF8', '#F8F9FF', '#4338CA', '#1E1B4B', '#374151', '#6B7280',
  ),
  makeTemplate(
    'rose', 'Rose Prestige', 'Elegant pink rose gold with soft tones',
    '#F43F5E', '#FFF1F2', '#F43F5E', '#881337', '#374151', '#9F1239',
  ),
  makeTemplate(
    'slate', 'Dark Prestige', 'High-contrast dark theme certificate',
    '#94A3B8', '#0F172A', '#334155', '#F1F5F9', '#CBD5E1', '#94A3B8',
  ),
];
