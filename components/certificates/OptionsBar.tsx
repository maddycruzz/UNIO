'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Award, Upload, X, Layers, Palette } from 'lucide-react';
import { CertConfig, TEMPLATES, PALETTE } from './types';

export default function OptionsBar({ config, onChange }: {
  config: CertConfig;
  onChange: (partial: Partial<CertConfig>) => void;
}) {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ customBg: reader.result as string, templateId: 'custom' });
    reader.readAsDataURL(file);
  };

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ sealImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  const chip = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`,
        background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
        color: active ? '#818CF8' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.15s',
      }}>
      {children}
    </motion.button>
  );

  const sep = <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, flexWrap: 'wrap',
    }}>
      {/* Template chips */}
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginRight: 4 }}>
        <Palette size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
        Template
      </span>
      {TEMPLATES.filter(t => t.id !== 'custom').map(t => (
        <motion.button key={t.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => onChange({ templateId: t.id })}
          style={{
            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
            background: PALETTE[t.id].accent,
            border: config.templateId === t.id ? '2px solid #fff' : '2px solid transparent',
            boxShadow: config.templateId === t.id ? `0 0 10px ${t.accent}80` : 'none',
            transition: 'all 0.15s',
          }}
          title={t.name}
        />
      ))}
      {/* Custom upload */}
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => bgInputRef.current?.click()}
        style={{
          width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
          background: config.templateId === 'custom' ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.08)',
          border: config.templateId === 'custom' ? '2px solid #EC4899' : '2px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
        }}
        title="Upload custom background">
        <Upload size={10} />
      </motion.button>
      {config.customBg && (
        <button onClick={() => onChange({ customBg: undefined, templateId: 'classic' })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 10,
            display: 'flex', alignItems: 'center', gap: 2 }}>
          <X size={10} /> Remove
        </button>
      )}

      {sep}

      {/* Logo toggle */}
      {chip(config.showLogo, () => onChange({ showLogo: !config.showLogo }),
        <><ImageIcon size={12} /> Logo</>
      )}

      {/* Seal toggle */}
      {chip(config.showSeal, () => onChange({ showSeal: !config.showSeal }),
        <><Award size={12} /> Seal</>
      )}

      {/* Upload seal */}
      {config.showSeal && (
        <>
          <button onClick={() => sealInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
              borderRadius: 7, background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={10} />
            {config.sealImage ? 'Replace Seal' : 'Upload Seal'}
          </button>
          {config.sealImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src={config.sealImage} alt="Seal" style={{ width: 20, height: 20,
                borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(99,102,241,0.3)' }} />
              <button onClick={() => onChange({ sealImage: undefined })}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ef4444', fontSize: 10 }}><X size={10} /></button>
            </div>
          )}
        </>
      )}

      {/* Hidden inputs */}
      <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
      <input ref={sealInputRef} type="file" accept="image/*" onChange={handleSealUpload} style={{ display: 'none' }} />
    </div>
  );
}
