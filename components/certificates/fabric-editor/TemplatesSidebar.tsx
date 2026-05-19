'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronDown, Upload, Square, Circle,
  Triangle, Type,
} from 'lucide-react';
import { useFabric, CERT_WIDTH, CERT_HEIGHT } from './FabricContext';
import { CERT_TEMPLATES, TemplateData } from './templates-data';
import LayersPanel from './LayersPanel';
import { useToast } from '@/components/ui/Toast';

export function AccordionSection({ 
  title, 
  defaultExpanded = true, 
  children, 
  extra 
}: { 
  title: string; 
  defaultExpanded?: boolean; 
  children: React.ReactNode; 
  extra?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '6px 8px', display: 'flex', alignItems: 'center', 
          cursor: 'pointer', background: 'rgba(255,255,255,0.015)' 
        }}
      >
        <span style={{ width: 16, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.4)' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{title}</span>
        {extra && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini SVG preview of a template
function TemplateMiniPreview({ t }: { t: TemplateData }) {
  const { bg, border, heading, sub } = t.preview;
  return (
    <svg width="100%" viewBox="0 0 160 110" fill="none" style={{ display: 'block' }}>
      <rect width="160" height="110" fill={bg} />
      <rect x="4" y="4" width="152" height="102" stroke={border} strokeWidth="4" />
      <rect x="8" y="8" width="144" height="94" stroke={border} strokeOpacity="0.25" strokeWidth="0.8" />
      <rect x="4" y="4" width="152" height="18" fill={t.accent} fillOpacity="0.08" />
      <text x="12" y="18" fontFamily="sans-serif" fontWeight="800" fontSize="9" fill={t.accent}>UNIO</text>
      <text x="80" y="35" textAnchor="middle" fontFamily="sans-serif" fontSize="5.5"
        fontWeight="700" fill={t.accent} letterSpacing="1.5">CERTIFICATE OF PARTICIPATION</text>
      <line x1="44" y1="38" x2="116" y2="38" stroke={t.accent} strokeOpacity="0.4" strokeWidth="0.8" />
      <text x="80" y="60" textAnchor="middle" fontFamily="serif" fontSize="12"
        fontWeight="700" fill={heading}>Recipient Name</text>
      <circle cx="80" cy="88" r="9" stroke={t.accent} strokeOpacity="0.5" strokeWidth="1"
        fill={t.accent} fillOpacity="0.06" />
      <line x1="32" y1="100" x2="72" y2="100" stroke={t.accent} strokeOpacity="0.4" strokeWidth="0.7" />
      <line x1="88" y1="100" x2="128" y2="100" stroke={sub} strokeOpacity="0.4" strokeWidth="0.7" />
    </svg>
  );
}

export default function TemplatesSidebar() {
  const { loadJSON, addRect, addCircle, addText, canvas, pushHistory, refreshLayers } = useFabric();
  const toast = useToast();

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;

    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      toast.error("PDFs aren't supported yet. Please upload a JPEG or PNG.", { duration: 6000 });
      e.target.value = '';
      return;
    }

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          import('fabric').then(({ Image: FabImage }) => {
            const imgEl = new window.Image();
            imgEl.onload = () => {
               // Make it exactly fit the full certificate layout
              canvas.backgroundImage = new FabImage(imgEl, {
                scaleX: CERT_WIDTH / imgEl.width,
                scaleY: CERT_HEIGHT / imgEl.height,
              } as any) as any;
              canvas.renderAll();
              pushHistory();
              refreshLayers();
            };
            imgEl.src = reader.result as string;
          });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        loadJSON(json);
      } catch (err) {
        console.error("Invalid JSON template file", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTemplateClick = async (t: TemplateData) => {
    await loadJSON(t.fabricJSON);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;
    const reader = new FileReader();
    reader.onload = () => {
      import('fabric').then(({ Image: FabImage }) => {
        const imgEl = new window.Image();
        imgEl.onload = () => {
          canvas.backgroundImage = new FabImage(imgEl, {
            scaleX: CERT_WIDTH / imgEl.width,
            scaleY: CERT_HEIGHT / imgEl.height,
          } as any) as any;
          canvas.renderAll();
          pushHistory();
          refreshLayers();
        };
        imgEl.src = reader.result as string;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addTriangle = () => {
    if (!canvas) return;
    import('fabric').then(({ Triangle: FabTriangle }) => {
      const tri = new (FabTriangle as any)({
        left: CERT_WIDTH / 2,
        top: CERT_HEIGHT / 2,
        originX: 'center', originY: 'center',
        width: 120, height: 100,
        fill: '#F59E0B', opacity: 0.85,
      });
      (tri as any).__uid = `triangle_${Date.now()}`;
      canvas.add(tri);
      canvas.setActiveObject(tri);
      canvas.renderAll();
      pushHistory();
      refreshLayers();
    });
  };

  const shapeBtns = [
    { icon: <Square size={16} />, label: 'Rect', action: addRect, color: '#6366F1' },
    { icon: <Circle size={16} />, label: 'Circle', action: addCircle, color: '#10B981' },
    { icon: <Triangle size={16} />, label: 'Triangle', action: addTriangle, color: '#F59E0B' },
    { icon: <Type size={16} />, label: 'Text', action: addText, color: '#818CF8' },
  ];

  return (
    <div
      id="templates-sidebar"
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden',
        color: '#DFE1E5',
      }}
    >
      {/* ── Pinned upload bar — always visible ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {/* Template upload — label wrapping input is the reliable way */}
        <label style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(99,102,241,0.1)',
          border: '1px dashed rgba(99,102,241,0.35)',
          color: '#818CF8', fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
          userSelect: 'none',
        }}>
          <Upload size={11} /> Template
          <input
            type="file"
            accept=".json,application/json,image/jpeg,image/png,image/jpg"
            onChange={handleTemplateUpload}
            style={{ display: 'none' }}
          />
        </label>

        {/* Background image upload */}
        <label style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(236,72,153,0.06)',
          border: '1px dashed rgba(236,72,153,0.35)',
          color: '#EC4899', fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
          userSelect: 'none',
        }}>
          <Upload size={11} /> Bg Image
          <input
            type="file"
            accept="image/*"
            onChange={handleBgUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AccordionSection title="Templates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CERT_TEMPLATES.map(t => (
              <motion.button
                key={t.id}
                id={`template-${t.id}`}
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.setData('fabric/template', JSON.stringify(t.fabricJSON));
                }}
                whileHover={{ y: -1, boxShadow: `0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px ${t.accent}40` }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTemplateClick(t)}
                style={{
                  background: 'none',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: 6, padding: 0, cursor: 'pointer',
                  overflow: 'hidden', textAlign: 'left',
                  transition: 'all 0.1s',
                }}
              >
                <TemplateMiniPreview t={t} />
                <div style={{
                  padding: '6px 8px',
                  background: 'rgba(0,0,0,0.4)',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{t.name}</div>
                  </div>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: t.accent, flexShrink: 0,
                  }} />
                </div>
              </motion.button>
            ))}
          </div>
        </AccordionSection>


        <AccordionSection title="Quick Add">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {shapeBtns.map(b => (
              <motion.button
                key={b.label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={b.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: b.color, fontSize: 10, fontWeight: 500,
                  transition: 'all 0.1s',
                }}
              >
                {b.icon}
                <span style={{ color: '#DFE1E5' }}>{b.label}</span>
              </motion.button>
            ))}
          </div>
        </AccordionSection>

        {/* Use accordion for Layers here too, remove it from bottom layout! */}
        <LayersPanel />
      </div>
    </div>
  );
}
