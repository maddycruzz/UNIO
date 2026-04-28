'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Upload, X, User } from 'lucide-react';
import { CertConfig, Signatory } from './types';

export default function SignatoriesPanel({ config, onChange, selectedSignatoryId }: {
  config: CertConfig;
  onChange: (partial: Partial<CertConfig>) => void;
  selectedSignatoryId?: string | null;
}) {
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const updateSig = (id: string, patch: Partial<Signatory>) => {
    onChange({
      signatories: config.signatories.map(s =>
        s.id === id ? { ...s, ...patch } : s
      ),
    });
  };

  const addSignatory = () => {
    if (config.signatories.length >= 4) return;
    const newSig: Signatory = {
      id: `s${Date.now()}`,
      name: '',
      title: '',
    };
    onChange({ signatories: [...config.signatories, newSig] });
  };

  const removeSignatory = () => {
    if (config.signatories.length <= 1) return;
    onChange({ signatories: config.signatories.slice(0, -1) });
  };

  const handleSigImageUpload = (sigId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSig(sigId, { sigImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Header with +/- controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>
          Signatories ({config.signatories.length})
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={removeSignatory}
            disabled={config.signatories.length <= 1}
            style={{
              width: 26, height: 26, borderRadius: 7, cursor: config.signatories.length <= 1 ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: config.signatories.length <= 1 ? 'transparent' : 'rgba(239,68,68,0.1)',
              color: config.signatories.length <= 1 ? 'rgba(255,255,255,0.15)' : '#f87171',
            }}>
            <Minus size={13} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={addSignatory}
            disabled={config.signatories.length >= 4}
            style={{
              width: 26, height: 26, borderRadius: 7, cursor: config.signatories.length >= 4 ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: config.signatories.length >= 4 ? 'transparent' : 'rgba(16,185,129,0.1)',
              color: config.signatories.length >= 4 ? 'rgba(255,255,255,0.15)' : '#34d399',
            }}>
            <Plus size={13} />
          </motion.button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
        Min 1, max 4. Upload optional digital signature image for each.
      </p>

      {/* Signatory cards */}
      {config.signatories.map((sig, i) => {
        const isSel = selectedSignatoryId === sig.id;
        return (
        <div key={sig.id} style={{ background: isSel ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isSel ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 12, padding: 14,
          boxShadow: isSel ? '0 0 16px rgba(99,102,241,0.15)' : 'none',
          transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6,
              background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center',
              justifyContent: 'center' }}>
              <User size={12} color="#818CF8" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
              Signatory {i + 1}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input value={sig.name} placeholder="Dr. A. Rajan"
                onChange={e => updateSig(sig.id, { name: e.target.value })}
                style={inputStyle} />
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Title / Designation</label>
              <input value={sig.title} placeholder="Dean — Student Affairs"
                onChange={e => updateSig(sig.id, { title: e.target.value })}
                style={inputStyle} />
            </div>

            {/* Overall Size */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                  Overall Scale
                </label>
                <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 600 }}>
                  {(sig.scale ?? 1).toFixed(1)}x
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => updateSig(sig.id, { scale: Math.max(0.5, (sig.scale ?? 1) - 0.1) })}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  −
                </button>
                <input type="range" min={0.5} max={3} step={0.1}
                  value={sig.scale ?? 1}
                  onChange={e => updateSig(sig.id, { scale: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: '#6366F1', height: 4 }} />
                <button onClick={() => updateSig(sig.id, { scale: Math.min(3, (sig.scale ?? 1) + 0.1) })}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  +
                </button>
              </div>
            </div>

            {/* Digital signature upload */}
            <div>
              <label style={labelStyle}>Digital Signature (optional)</label>
              {sig.sigImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={sig.sigImage} alt="Signature"
                      style={{ height: 32, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.9)', padding: '2px 8px' }} />
                    <button onClick={() => updateSig(sig.id, { sigImage: undefined, sigImageScale: 1 })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                        color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={11} /> Remove
                    </button>
                  </div>
                  {/* Size slider */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                        Size
                      </label>
                      <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 600 }}>
                        {(sig.sigImageScale ?? 1).toFixed(1)}x
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => updateSig(sig.id, { sigImageScale: Math.max(0.5, (sig.sigImageScale ?? 1) - 0.1) })}
                        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                        −
                      </button>
                      <input type="range" min={0.5} max={3} step={0.1}
                        value={sig.sigImageScale ?? 1}
                        onChange={e => updateSig(sig.id, { sigImageScale: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: '#6366F1', height: 4 }} />
                      <button onClick={() => updateSig(sig.id, { sigImageScale: Math.min(3, (sig.sigImageScale ?? 1) + 0.1) })}
                        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const input = fileInputRefs.current.get(sig.id);
                    if (input) input.click();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                    borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 4 }}>
                  <Upload size={11} /> Upload signature image
                </button>
              )}
              <input
                ref={el => { if (el) fileInputRefs.current.set(sig.id, el); }}
                type="file" accept="image/*"
                onChange={e => handleSigImageUpload(sig.id, e)}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
        );
      })}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)',
  display: 'block', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
