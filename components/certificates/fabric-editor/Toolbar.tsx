'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Type, Square, Circle, Image as ImageIcon,
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Download, FileJson, Minus, Plus,
} from 'lucide-react';
import { useFabric } from './FabricContext';

export default function EditorToolbar() {
  const {
    addText, addRect, addCircle, addImage,
    undo, redo, canUndo, canRedo,
    exportPNG, exportJSON,
    zoom, zoomIn, zoomOut, resetZoom, fitZoomLevel
  } = useFabric();

  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sep = <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />;

  const btn = (
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
    disabled = false,
    accent = false,
  ) => (
    <motion.button
      id={`toolbar-btn-${label.toLowerCase().replace(/\s+/g, '-')}`}
      whileHover={disabled ? {} : { scale: 1.06 }}
      whileTap={disabled ? {} : { scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 12px', borderRadius: 8,
        background: accent ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${accent ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
        color: disabled ? 'rgba(255,255,255,0.2)' : (accent ? '#818CF8' : 'rgba(255,255,255,0.75)'),
        fontSize: 11, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
    >
      {icon}
      <span style={{ display: 'none' }}>{label}</span>
    </motion.button>
  );

  const addBtn = (
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
  ) => (
    <motion.button
      id={`toolbar-add-${label.toLowerCase()}`}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={`Add ${label}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '7px 14px', borderRadius: 9,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );

  return (
    <div
      id="editor-toolbar"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px',
        background: 'rgba(15,17,23,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'nowrap', overflowX: 'auto',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Add elements group */}
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginRight: 2 }}>Add</span>

      {addBtn(addText, <Type size={16} />, 'Text')}
      {addBtn(addRect, <Square size={16} />, 'Rect')}
      {addBtn(addCircle, <Circle size={16} />, 'Circle')}
      {addBtn(() => imgInputRef.current?.click(), <ImageIcon size={16} />, 'Image')}
      <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      {sep}

      {/* History */}
      {btn(undo, <Undo2 size={14} />, 'Undo', !canUndo)}
      {btn(redo, <Redo2 size={14} />, 'Redo', !canRedo)}

      {sep}

      {/* Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <motion.button
          id="toolbar-zoom-out"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={zoomOut}
          title="Zoom Out"
          style={{
            width: 28, height: 28, borderRadius: '7px 0 0 7px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><Minus size={12} /></motion.button>
        <div style={{
          width: 48, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
        }}>
          {Math.round((zoom / fitZoomLevel) * 100)}%
        </div>
        <motion.button
          id="toolbar-zoom-in"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={zoomIn}
          title="Zoom In"
          style={{
            width: 28, height: 28, borderRadius: '0 7px 7px 0',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><Plus size={12} /></motion.button>
        <motion.button
          id="toolbar-zoom-reset"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={resetZoom}
          title="Reset Zoom"
          style={{
            width: 28, height: 28, marginLeft: 4, borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><Maximize2 size={12} /></motion.button>
      </div>

      {sep}

      {/* Export */}
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginRight: 2 }}>Export</span>

      <motion.button
        id="toolbar-export-png"
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
        onClick={exportPNG}
        title="Export as PNG"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
          borderRadius: 8, background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: '#10B981', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <Download size={13} /> PNG
      </motion.button>

      <motion.button
        id="toolbar-export-json"
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
        onClick={exportJSON}
        title="Export as JSON"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
          borderRadius: 8, background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.3)',
          color: '#818CF8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <FileJson size={13} /> JSON
      </motion.button>

      {/* Hint */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
          Scroll to zoom · Alt+drag to pan
        </span>
      </div>
    </div>
  );
}
