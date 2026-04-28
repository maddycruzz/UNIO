'use client';

import { CertConfig, TextElement, FONT_OPTIONS } from './types';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus, Eye, EyeOff, Trash2 } from 'lucide-react';

export default function FloatingToolbar({ config, elementId, onChange, style }: {
  config: CertConfig;
  elementId: string;
  onChange: (partial: Partial<CertConfig>) => void;
  style?: React.CSSProperties;
}) {
  const el = config.textElements.find(e => e.id === elementId);
  if (!el) return null;

  const update = (patch: Partial<TextElement>) => {
    onChange({ textElements: config.textElements.map(e => e.id === elementId ? { ...e, ...patch } : e) });
  };

  const btn = (active: boolean, onClick: () => void, children: React.ReactNode, title: string) => (
    <button title={title} onClick={onClick} style={{
      width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
      color: active ? '#818CF8' : 'rgba(255,255,255,0.7)',
      transition: 'all 0.15s',
    }}>{children}</button>
  );

  const sep = <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
      background: 'rgba(15,17,23,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
      ...style,
    }}>
      {/* Label */}
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: '#818CF8', marginRight: 4, whiteSpace: 'nowrap' }}>
        {el.label}
      </span>

      {sep}

      {/* Font family */}
      <select value={el.fontFamily} onChange={e => update({ fontFamily: e.target.value })}
        style={{ padding: '4px 6px', borderRadius: 5, fontSize: 11, fontWeight: 600,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)', outline: 'none', cursor: 'pointer', maxWidth: 90 }}>
        {FONT_OPTIONS.map(f => (
          <option key={f.value} value={f.value} style={{ backgroundColor: '#1a1d27' }}>{f.label}</option>
        ))}
      </select>

      {sep}

      {/* Font size */}
      <button onClick={() => update({ fontSize: Math.max(6, el.fontSize - 1) })}
        style={{ ...sBtn, borderRadius: '5px 0 0 5px' }}><Minus size={11} /></button>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', minWidth: 24, textAlign: 'center',
        background: 'rgba(255,255,255,0.06)', padding: '4px 2px', lineHeight: '22px' }}>{el.fontSize}</span>
      <button onClick={() => update({ fontSize: Math.min(80, el.fontSize + 1) })}
        style={{ ...sBtn, borderRadius: '0 5px 5px 0' }}><Plus size={11} /></button>

      {sep}

      {/* Bold / Italic */}
      {btn(el.fontWeight === 700, () => update({ fontWeight: el.fontWeight === 700 ? 400 : 700 }),
        <Bold size={13} />, 'Bold')}
      {btn(el.fontStyle === 'italic', () => update({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' }),
        <Italic size={13} />, 'Italic')}

      {sep}

      {/* Align */}
      {btn(el.textAlign === 'left', () => update({ textAlign: 'left' }), <AlignLeft size={13} />, 'Align Left')}
      {btn(el.textAlign === 'center', () => update({ textAlign: 'center' }), <AlignCenter size={13} />, 'Align Center')}
      {btn(el.textAlign === 'right', () => update({ textAlign: 'right' }), <AlignRight size={13} />, 'Align Right')}

      {sep}

      {/* Visibility */}
      {btn(!el.visible, () => update({ visible: !el.visible }),
        el.visible ? <Eye size={13} /> : <EyeOff size={13} />, 'Toggle Visibility')}

      {sep}

      {/* Color picker */}
      <div style={{ position: 'relative' }}>
        <input type="color"
          value={el.color.startsWith('__') ? '#6366F1' : el.color}
          onChange={e => update({ color: e.target.value })}
          style={{ width: 26, height: 26, border: 'none', borderRadius: 5,
            cursor: 'pointer', background: 'transparent', padding: 0 }}
          title="Text Color" />
      </div>
    </div>
  );
}

const sBtn: React.CSSProperties = {
  width: 26, height: 30, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
