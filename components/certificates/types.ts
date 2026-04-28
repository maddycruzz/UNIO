// ── Shared Types & Constants for Certificate Generator ──

export interface Participant {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  dept: string;
}

export interface EventInfo {
  id: string;
  title: string;
  date: string;
  type: string;
}

export interface Signatory {
  id: string;
  name: string;
  title: string;
  sigImage?: string;      // dataURL of uploaded digital signature
  sigImageScale?: number; // 0.5–3, default 1
  x?: number;             // % from left
  y?: number;             // % from top
  scale?: number;         // overall scale of this signatory block
}

export interface TextElement {
  id: string;
  key: string;        // e.g. 'recipientName', 'eventName', etc.
  label: string;
  text: string;
  x: number;          // % from left (0-100)
  y: number;          // % from top (0-100)
  fontSize: number;   // px at scale=1
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface CertConfig {
  templateId: string;
  customBg?: string;        // dataURL of uploaded background
  sealImage?: string;       // dataURL of uploaded seal
  showLogo: boolean;
  logoX?: number;           // % from left
  logoY?: number;           // % from top
  logoScale?: number;       // overall scale
  showSeal: boolean;
  sealX: number;            // % from left (0-100)
  sealY: number;            // % from top  (0-100)
  sealScale?: number;       // seal size multiplier
  signatories: Signatory[];
  textElements: TextElement[];
}

export interface CertTemplate {
  id: string;
  name: string;
  description: string;
  accent: string;
}

// ── Colour palettes per template ──
export const PALETTE: Record<string, {
  bg: string; border: string; accent: string; accentLight: string;
  heading: string; body: string; sub: string;
}> = {
  classic: {
    bg: '#FAFAF8', border: '#6366F1', accent: '#6366F1',
    accentLight: '#EEF2FF', heading: '#1E1B4B', body: '#374151', sub: '#6B7280',
  },
  emerald: {
    bg: '#F0FDF4', border: '#10B981', accent: '#10B981',
    accentLight: '#D1FAE5', heading: '#064E3B', body: '#1F2937', sub: '#6B7280',
  },
  aurora: {
    bg: '#FFFBEB', border: '#D97706', accent: '#F59E0B',
    accentLight: '#FEF3C7', heading: '#78350F', body: '#374151', sub: '#6B7280',
  },
  midnight: {
    bg: '#F8F9FF', border: '#4338CA', accent: '#818CF8',
    accentLight: '#E0E7FF', heading: '#1E1B4B', body: '#374151', sub: '#6B7280',
  },
  custom: {
    bg: '#FFFFFF', border: '#6366F1', accent: '#6366F1',
    accentLight: '#EEF2FF', heading: '#1E1B4B', body: '#374151', sub: '#6B7280',
  },
};

export const TEMPLATES: CertTemplate[] = [
  { id: 'classic',  name: 'Classic Indigo',    description: 'Elegant dark border with gold accents',     accent: '#6366F1' },
  { id: 'emerald',  name: 'Emerald Prestige',  description: 'Modern green with clean typography',        accent: '#10B981' },
  { id: 'aurora',   name: 'Aurora Gold',        description: 'Premium gold gradient, ornate border',     accent: '#F59E0B' },
  { id: 'midnight', name: 'Midnight Navy',      description: 'Deep navy with platinum — most formal',    accent: '#818CF8' },
  { id: 'custom',   name: 'Custom Upload',      description: 'Upload your own Canva / custom design',    accent: '#EC4899' },
];

export const FONT_OPTIONS = [
  { label: 'DM Sans',   value: "'DM Sans', system-ui, sans-serif" },
  { label: 'Georgia',   value: 'Georgia, serif' },
  { label: 'Inter',     value: "'Inter', sans-serif" },
  { label: 'Playfair',  value: "'Playfair Display', serif" },
  { label: 'Monospace', value: "'Courier New', monospace" },
];

export const MOCK_EVENTS: EventInfo[] = [
  { id: 'e1', title: 'Spring Fest Night Market', date: 'Mar 22, 2025', type: 'Cultural' },
  { id: 'e2', title: 'Founders Pitch Night',     date: 'Mar 25, 2025', type: 'Tech' },
  { id: 'e3', title: 'AI & Society Panel',        date: 'Apr 1, 2025',  type: 'Conference' },
];

export const MOCK_PARTICIPANTS: Participant[] = [
  { id: 'p1', name: 'Ayaan Nizam',    email: 'ayaan@college.edu',   rollNo: '21CS001', dept: 'CS'   },
  { id: 'p2', name: 'Priya Sharma',   email: 'priya@college.edu',   rollNo: '21CS042', dept: 'CS'   },
  { id: 'p3', name: 'Rohan Mehta',    email: 'rohan@college.edu',   rollNo: '21EC015', dept: 'ECE'  },
  { id: 'p4', name: 'Sneha Iyer',     email: 'sneha@college.edu',   rollNo: '21ME033', dept: 'MECH' },
  { id: 'p5', name: 'Karthik Raja',   email: 'karthik@college.edu', rollNo: '21CS078', dept: 'CS'   },
  { id: 'p6', name: 'Divya Krishnan', email: 'divya@college.edu',   rollNo: '21IT022', dept: 'IT'   },
  { id: 'p7', name: 'Arun Balaji',    email: 'arun@college.edu',    rollNo: '21CS090', dept: 'CS'   },
  { id: 'p8', name: 'Meera Nair',     email: 'meera@college.edu',   rollNo: '21EC044', dept: 'ECE'  },
];

// ── Default text elements for a new certificate ──
export function createDefaultTextElements(eventName: string, eventDate: string): TextElement[] {
  return [
    {
      id: 'heading', key: 'heading', label: 'Certificate Heading',
      text: 'CERTIFICATE OF PARTICIPATION',
      x: 50, y: 14, fontSize: 11, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 700, fontStyle: 'normal', color: '__accent__', textAlign: 'center', visible: true,
    },
    {
      id: 'recipientLabel', key: 'recipientLabel', label: 'Intro Phrase',
      text: 'This certifies that',
      x: 50, y: 19, fontSize: 15, fontFamily: 'Georgia, serif',
      fontWeight: 400, fontStyle: 'italic', color: '__sub__', textAlign: 'center', visible: true,
    },
    {
      id: 'recipientName', key: 'recipientName', label: 'Recipient Name',
      text: '{{name}}',
      x: 50, y: 26, fontSize: 46, fontFamily: 'Georgia, serif',
      fontWeight: 700, fontStyle: 'normal', color: '__heading__', textAlign: 'center', visible: true,
    },
    {
      id: 'bodyText', key: 'bodyText', label: 'Body Text',
      text: 'has successfully participated in and contributed to the event',
      x: 50, y: 34, fontSize: 14, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 400, fontStyle: 'normal', color: '__body__', textAlign: 'center', visible: true,
    },
    {
      id: 'eventName', key: 'eventName', label: 'Event Name',
      text: `"${eventName}"`,
      x: 50, y: 39, fontSize: 18, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 700, fontStyle: 'normal', color: '__accent__', textAlign: 'center', visible: true,
    },
    {
      id: 'eventDate', key: 'eventDate', label: 'Event Date',
      text: `Held on ${eventDate}`,
      x: 50, y: 43, fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 400, fontStyle: 'normal', color: '__sub__', textAlign: 'center', visible: true,
    },
    {
      id: 'footer', key: 'footer', label: 'Footer',
      text: 'Generated by UNIO Campus · unio.app',
      x: 50, y: 95, fontSize: 9, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 400, fontStyle: 'normal', color: '__sub__', textAlign: 'center', visible: true,
    },
  ];
}

export function createDefaultConfig(eventName: string, eventDate: string): CertConfig {
  return {
    templateId: 'classic',
    showLogo: true,
    showSeal: true,
    sealX: 50,
    sealY: 58,
    signatories: [
      { id: 's1', name: 'Dr. A. Rajan', title: 'Dean — Student Affairs' },
      { id: 's2', name: 'Prof. K. Sharma', title: 'Event Coordinator' },
    ],
    textElements: createDefaultTextElements(eventName, eventDate),
  };
}
