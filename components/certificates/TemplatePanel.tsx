'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Upload, ImageIcon, Award, X } from 'lucide-react';
import { CertConfig, CertTemplate, TEMPLATES, PALETTE } from './types';

function MiniPreview({ template, selected, onClick }: {
  template: CertTemplate; selected: boolean; onClick: () => void;
}) {
  const p = PALETTE[template.id];
  const isCustom = template.id === 'custom';

  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{ background: 'none', border: `2px solid ${selected ? template.accent : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14, padding: 0, cursor: 'pointer', overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.2s', boxShadow: selected ? `0 0 20px ${template.accent}40` : 'none' }}>
      {isCustom ? (
        <div style={{ width: 160, height: 110, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'rgba(236,72,153,0.06)' }}>
          <Upload size={24} color="#EC4899" />
          <span style={{ fontSize: 10, color: '#EC4899', fontWeight: 600 }}>Upload Design</span>
        </div>
      ) : (
        <svg width="160" height="110" viewBox="0 0 160 110" fill="none">
          <rect width="160" height="110" fill={p.bg} />
          <rect x="4" y="4" width="152" height="102" stroke={p.border} strokeWidth="4" />
          <rect x="8" y="8" width="144" height="94" stroke={p.border} strokeOpacity="0.25" strokeWidth="0.8" />
          <rect x="4" y="4" width="152" height="18" fill={p.accent} fillOpacity="0.08" />
          <text x="12" y="18" fontFamily="sans-serif" fontWeight="800" fontSize="9" fill={p.accent}>UNIO</text>
          <text x="80" y="32" textAnchor="middle" fontFamily="sans-serif" fontSize="5.5" fontWeight="700" fill={p.accent} letterSpacing="1.5">CERTIFICATE OF PARTICIPATION</text>
          <line x1="44" y1="35" x2="116" y2="35" stroke={p.accent} strokeOpacity="0.4" strokeWidth="0.8" />
          <text x="80" y="57" textAnchor="middle" fontFamily="serif" fontSize="12" fontWeight="700" fill={p.heading}>Recipient Name</text>
          <circle cx="80" cy="91" r="9" stroke={p.accent} strokeOpacity="0.5" strokeWidth="1" fill={p.accent} fillOpacity="0.06" />
        </svg>
      )}
      <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.85)',
        borderTop: `1px solid ${selected ? template.accent : 'rgba(255,255,255,0.06)'}30` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: selected ? template.accent : 'rgba(255,255,255,0.8)' }}>
          {template.name}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{template.description}</div>
      </div>
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20,
          borderRadius: '50%', background: template.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={11} color="#fff" />
        </div>
      )}
    </motion.button>
  );
}

export default function TemplatePanel({ config, onChange }: {
  config: CertConfig;
  onChange: (partial: Partial<CertConfig>) => void;
}) {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ customBg: reader.result as string, templateId: 'custom' });
    reader.readAsDataURL(file);
  };

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ sealImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  const selectTemplate = (id: string) => {
    if (id === 'custom') {
      bgInputRef.current?.click();
    } else {
      onChange({ templateId: id });
    }
  };

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>Choose Template</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {TEMPLATES.map(t => (
          <MiniPreview key={t.id} template={t}
            selected={config.templateId === t.id} onClick={() => selectTemplate(t.id)} />
        ))}
      </div>

      {/* Custom bg preview */}
      {config.customBg && config.templateId === 'custom' && (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(236,72,153,0.3)' }}>
          <img src={config.customBg} alt="Custom BG" style={{ width: '100%', height: 80, objectFit: 'cover' }} />
          <button onClick={() => onChange({ customBg: undefined, templateId: 'classic' })}
            style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22,
              borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={12} color="#fff" />
          </button>
        </div>
      )}

      <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload}
        style={{ display: 'none' }} />

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16,
        display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Options</div>

        {/* Show Logo toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            <ImageIcon size={13} />Show UNIO Logo
          </span>
          <ToggleSwitch on={config.showLogo} onToggle={() => onChange({ showLogo: !config.showLogo })} />
        </div>

        {/* Show Seal toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            <Award size={13} />Show Official Seal
          </span>
          <ToggleSwitch on={config.showSeal} onToggle={() => onChange({ showSeal: !config.showSeal })} />
        </div>

        {/* Upload Seal */}
        {config.showSeal && (
          <div>
            <button onClick={() => sealInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              <Upload size={12} />
              {config.sealImage ? 'Replace Custom Seal' : 'Upload Custom Seal'}
            </button>
            {config.sealImage && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={config.sealImage} alt="Seal"
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid rgba(99,102,241,0.3)' }} />
                <button onClick={() => onChange({ sealImage: undefined })}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none',
                    border: 'none', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            )}
            <input ref={sealInputRef} type="file" accept="image/*" onChange={handleSealUpload}
              style={{ display: 'none' }} />
          </div>
        )}
      </div>
    </>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: on ? '#6366F1' : 'rgba(255,255,255,0.1)', position: 'relative',
        transition: 'background 0.2s' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 18 : 3,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}
