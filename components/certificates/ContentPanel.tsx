'use client';

import { useRef, useEffect } from 'react';
import { CertConfig, TextElement, FONT_OPTIONS } from './types';

export default function ContentPanel({ config, onChange, selectedElementId }: {
  config: CertConfig;
  onChange: (partial: Partial<CertConfig>) => void;
  selectedElementId?: string | null;
}) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedElementId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedElementId]);
  const updateElement = (id: string, patch: Partial<TextElement>) => {
    onChange({
      textElements: config.textElements.map(el =>
        el.id === id ? { ...el, ...patch } : el
      ),
    });
  };

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>
        Certificate Text
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
        Click an element to edit. Use {'{{name}}'} for the recipient&apos;s name.
      </p>

      {config.textElements.map(el => {
        const isSelected = selectedElementId === el.id;
        return (
        <div key={el.id}
          ref={isSelected ? selectedRef : undefined}
          style={{ background: isSelected ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 12, padding: 14,
          boxShadow: isSelected ? '0 0 16px rgba(99,102,241,0.15)' : 'none',
          transition: 'all 0.2s' }}>

          {/* Label + visibility toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>{el.label}</span>
            <button onClick={() => updateElement(el.id, { visible: !el.visible })}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                background: el.visible ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${el.visible ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: el.visible ? '#818CF8' : 'rgba(255,255,255,0.3)' }}>
              {el.visible ? 'Visible' : 'Hidden'}
            </button>
          </div>

          {/* Text input */}
          {el.key === 'bodyText' ? (
            <textarea value={el.text} rows={2}
              onChange={e => updateElement(el.id, { text: e.target.value })}
              style={inputStyle} />
          ) : (
            <input value={el.text}
              onChange={e => updateElement(el.id, { text: e.target.value })}
              style={{ ...inputStyle, resize: undefined }} />
          )}

          {/* Controls row */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {/* Font family */}
            <select value={el.fontFamily}
              onChange={e => updateElement(el.id, { fontFamily: e.target.value })}
              style={selectStyle}>
              {FONT_OPTIONS.map(f => (
                <option key={f.value} value={f.value} style={{ backgroundColor: '#1a1d27' }}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => updateElement(el.id, { fontSize: Math.max(6, el.fontSize - 1) })}
                style={btnStyle}>−</button>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 24, textAlign: 'center' }}>
                {el.fontSize}
              </span>
              <button onClick={() => updateElement(el.id, { fontSize: Math.min(80, el.fontSize + 1) })}
                style={btnStyle}>+</button>
            </div>

            {/* Bold */}
            <button onClick={() => updateElement(el.id, { fontWeight: el.fontWeight === 700 ? 400 : 700 })}
              style={{ ...btnStyle, fontWeight: 800, color: el.fontWeight === 700 ? '#818CF8' : 'rgba(255,255,255,0.3)',
                background: el.fontWeight === 700 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)' }}>
              B
            </button>

            {/* Italic */}
            <button onClick={() => updateElement(el.id, { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}
              style={{ ...btnStyle, fontStyle: 'italic', color: el.fontStyle === 'italic' ? '#818CF8' : 'rgba(255,255,255,0.3)',
                background: el.fontStyle === 'italic' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)' }}>
              I
            </button>

            {/* Align */}
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} onClick={() => updateElement(el.id, { textAlign: a })}
                style={{ ...btnStyle, fontSize: 9, textTransform: 'capitalize',
                  color: el.textAlign === a ? '#818CF8' : 'rgba(255,255,255,0.3)',
                  background: el.textAlign === a ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)' }}>
                {a === 'left' ? '⇤' : a === 'right' ? '⇥' : '⇔'}
              </button>
            ))}
          </div>

          {/* Position (X / Y as %) */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={tinyLabel}>X Position (%)</label>
              <input type="range" min={0} max={100} value={el.x}
                onChange={e => updateElement(el.id, { x: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#6366F1' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={tinyLabel}>Y Position (%)</label>
              <input type="range" min={0} max={100} value={el.y}
                onChange={e => updateElement(el.id, { y: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#6366F1' }} />
            </div>
          </div>
        </div>
        );
      })}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box' as const, resize: 'none' as const,
};

const selectStyle: React.CSSProperties = {
  padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)', outline: 'none', cursor: 'pointer',
};

const btnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, fontWeight: 600,
};

const tinyLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 3,
};
