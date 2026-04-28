'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BringToFront, SendToBack, ChevronUp, ChevronDown, Trash2,
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic,
  Layers, Settings2, Square, Type,
} from 'lucide-react';
import { useFabric } from './FabricContext';
import { FONT_OPTIONS } from '../types';
import { AccordionSection } from './TemplatesSidebar';

interface ObjProps {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  width: number;
  height: number;
  left: number;
  top: number;
  // text props
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  type?: string;
}

export default function PropertiesPanel() {
  const { canvas, selectedObjects, refreshLayers, pushHistory } = useFabric();
  const [props, setProps] = useState<ObjProps | null>(null);

  const readProps = useCallback(() => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) { setProps(null); return; }
    const p: ObjProps = {
      fill: (obj.fill as string) || '#000000',
      stroke: (obj.stroke as string) || '#000000',
      strokeWidth: (obj.strokeWidth as number) || 0,
      opacity: Math.round(((obj.opacity as number) ?? 1) * 100),
      width: Math.round(obj.getScaledWidth ? obj.getScaledWidth() : (obj as any).width || 0),
      height: Math.round(obj.getScaledHeight ? obj.getScaledHeight() : (obj as any).height || 0),
      left: Math.round((obj as any).left || 0),
      top: Math.round((obj as any).top || 0),
      type: obj.type,
    };
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      const t = obj as any;
      p.text = t.text || '';
      p.fontSize = t.fontSize || 32;
      p.fontFamily = t.fontFamily || 'sans-serif';
      p.fontWeight = t.fontWeight || '400';
      p.fontStyle = t.fontStyle || 'normal';
      p.textAlign = t.textAlign || 'left';
    }
    setProps(p);
  }, [canvas, selectedObjects]);

  useEffect(() => {
    readProps();
  }, [readProps, selectedObjects]);

  // Listen to canvas object:modified to refresh
  useEffect(() => {
    if (!canvas) return;
    const handler = () => readProps();
    canvas.on('object:modified', handler);
    canvas.on('object:scaling', handler);
    canvas.on('object:moving', handler);
    return () => {
      canvas.off('object:modified', handler);
      canvas.off('object:scaling', handler);
      canvas.off('object:moving', handler);
    };
  }, [canvas, readProps]);

  const applyProp = (key: string, value: any) => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    
    let actualValue = value;
    if (key === 'opacity') actualValue = value / 100;
    
    (obj as any).set(key, actualValue);
    canvas.renderAll();
    
    setProps(prev => prev ? { ...prev, [key === 'opacity' ? 'opacity' : key]: key === 'opacity' ? value : value } : null);
  };

  const applyDimension = (dim: 'width' | 'height', value: number) => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    if (dim === 'width') obj.scaleToWidth(value);
    else obj.scaleToHeight(value);
    canvas.renderAll();
    setProps(prev => prev ? { ...prev, [dim]: value } : null);
  };

  const applyPosition = (axis: 'left' | 'top', value: number) => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    (obj as any).set(axis, value);
    obj.setCoords();
    canvas.renderAll();
    setProps(prev => prev ? { ...prev, [axis]: value } : null);
  };

  const deleteSelected = () => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  };

  const bringForward = () => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    canvas.bringObjectForward(obj as any);
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  };

  const sendBackward = () => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    canvas.sendObjectBackwards(obj as any);
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  };

  const bringToFront = () => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    canvas.bringObjectToFront(obj as any);
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  };

  const sendToBack = () => {
    const obj = selectedObjects[0];
    if (!obj || !canvas) return;
    canvas.sendObjectToBack(obj as any);
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  };

  const isText = props?.type === 'i-text' || props?.type === 'text' || props?.type === 'textbox';

  const label = (t: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t}</div>
  );

  const numInput = (val: number, onChange: (v: number) => void, min = 0, max = 9999) => (
    <input
      type="number" value={val} min={min} max={max}
      onChange={e => onChange(Number(e.target.value))}
      onBlur={() => pushHistory()}
      style={{
        width: '100%', padding: '4px 6px', borderRadius: 4,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        color: '#DFE1E5', fontSize: 11, outline: 'none',
      }}
    />
  );

  const colorInput = (val: string, onChange: (v: string) => void) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={val?.startsWith('#') ? val : '#6366f1'}
        onChange={e => onChange(e.target.value)}
        onBlur={() => pushHistory()}
        style={{
          width: 24, height: 24, borderRadius: 4, border: 'none',
          cursor: 'pointer', padding: 0,
          background: 'transparent',
        }}
      />
      <input
        type="text"
        value={val?.startsWith('#') ? val : '#6366f1'}
        onChange={e => onChange(e.target.value)}
        onBlur={() => pushHistory()}
        style={{
          flex: 1, padding: '4px 6px', borderRadius: 4,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#DFE1E5', fontSize: 11, fontFamily: 'monospace', outline: 'none',
        }}
      />
    </div>
  );

  const row2 = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
  );

  return (
    <div
      id="properties-panel"
      style={{
        flex: 1,
        background: '#2B2D30',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
        color: '#DFE1E5',
      }}
    >
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Settings2 size={13} color="#818CF8" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Attributes
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!props ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: 24,
            }}
          >
            <Layers size={28} color="rgba(255,255,255,0.1)" />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
              Select an object to inspect
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="props"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}
          >
            {/* Object type badge */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
               <span style={{ color: 'rgba(255,255,255,0.4)' }}>{props.type === 'i-text' ? <Type size={12}/> : <Square size={12}/>}</span>
               <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                 {props.type === 'i-text' ? 'Text' : props.type}
               </span>
            </div>

            <AccordionSection title="Layout" defaultExpanded>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {row2(
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 24 }}>W</span>
                      {numInput(props.width, v => applyDimension('width', v), 1)}
                    </div>
                  )}
                  {row2(
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 24 }}>H</span>
                      {numInput(props.height, v => applyDimension('height', v), 1)}
                    </div>
                  )}
               </div>
            </AccordionSection>

            <AccordionSection title="Transforms" defaultExpanded>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {row2(
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 24 }}>X</span>
                      {numInput(props.left, v => applyPosition('left', v))}
                    </div>
                  )}
                  {row2(
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 24 }}>Y</span>
                      {numInput(props.top, v => applyPosition('top', v))}
                    </div>
                  )}
               </div>
            </AccordionSection>

            <AccordionSection title="Appearance" defaultExpanded>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  {label('Fill Color')}
                  {colorInput(props.fill, v => applyProp('fill', v))}
                </div>
                <div>
                  {label('Stroke Color')}
                  {colorInput(props.stroke, v => applyProp('stroke', v))}
                </div>
                <div>
                  {label(`Stroke Width: ${props.strokeWidth}px`)}
                  <input
                    type="range" min={0} max={20} value={props.strokeWidth}
                    onChange={e => { applyProp('strokeWidth', Number(e.target.value)); setProps(p => p ? { ...p, strokeWidth: Number(e.target.value) } : null); }}
                    onMouseUp={() => pushHistory()}
                    style={{ width: '100%', accentColor: '#818CF8' }}
                  />
                </div>
                <div>
                  {label(`Opacity: ${props.opacity}%`)}
                  <input
                    type="range" min={0} max={100} value={props.opacity}
                    onChange={e => { applyProp('opacity', Number(e.target.value)); setProps(p => p ? { ...p, opacity: Number(e.target.value) } : null); }}
                    onMouseUp={() => pushHistory()}
                    style={{ width: '100%', accentColor: '#818CF8' }}
                  />
                </div>
              </div>
            </AccordionSection>

            {isText && (
              <AccordionSection title="Typography" defaultExpanded>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select
                    value={props.fontFamily}
                    onChange={e => { applyProp('fontFamily', e.target.value); setProps(p => p ? { ...p, fontFamily: e.target.value } : null); pushHistory(); }}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#DFE1E5', fontSize: 11, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.value} value={f.value} style={{ background: '#2B2D30' }}>{f.label}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 32 }}>Size</span>
                    <button
                      onClick={() => { const s = (props.fontSize || 32) - 1; applyProp('fontSize', s); setProps(p => p ? { ...p, fontSize: s } : null); }}
                      style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#DFE1E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >−</button>
                    <input
                      type="number" value={props.fontSize || 32}
                      onChange={e => { const s = Number(e.target.value); applyProp('fontSize', s); setProps(p => p ? { ...p, fontSize: s } : null); }}
                      onBlur={() => pushHistory()}
                      style={{ flex: 1, textAlign: 'center', padding: '4px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#DFE1E5', fontSize: 11, outline: 'none' }}
                    />
                    <button
                      onClick={() => { const s = (props.fontSize || 32) + 1; applyProp('fontSize', s); setProps(p => p ? { ...p, fontSize: s } : null); }}
                      style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#DFE1E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  </div>

                  {row2(
                    <>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { icon: <Bold size={11} />, label: 'Bold', active: String(props.fontWeight) === '700' || props.fontWeight === 'bold', action: () => { const v = String(props.fontWeight) === '700' ? '400' : '700'; applyProp('fontWeight', v); setProps(p => p ? { ...p, fontWeight: v } : null); pushHistory(); } },
                          { icon: <Italic size={11} />, label: 'Italic', active: props.fontStyle === 'italic', action: () => { const v = props.fontStyle === 'italic' ? 'normal' : 'italic'; applyProp('fontStyle', v); setProps(p => p ? { ...p, fontStyle: v } : null); pushHistory(); } },
                        ].map(btn => (
                          <button
                            key={btn.label} onClick={btn.action} title={btn.label}
                            style={{
                              flex: 1, height: 24, borderRadius: 4, cursor: 'pointer',
                              background: btn.active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${btn.active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.05)'}`,
                              color: btn.active ? '#818CF8' : 'rgba(255,255,255,0.6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >{btn.icon}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { icon: <AlignLeft size={11} />, val: 'left' },
                          { icon: <AlignCenter size={11} />, val: 'center' },
                          { icon: <AlignRight size={11} />, val: 'right' },
                        ].map(a => (
                          <button
                            key={a.val} onClick={() => { applyProp('textAlign', a.val); setProps(p => p ? { ...p, textAlign: a.val } : null); pushHistory(); }}
                            title={`Align ${a.val}`}
                            style={{
                              flex: 1, height: 24, borderRadius: 4, cursor: 'pointer',
                              background: props.textAlign === a.val ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${props.textAlign === a.val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.05)'}`,
                              color: props.textAlign === a.val ? '#818CF8' : 'rgba(255,255,255,0.6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >{a.icon}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AccordionSection>
            )}

            <AccordionSection title="Object Stack">
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { icon: <BringToFront size={11} />, label: 'To Front', action: bringToFront },
                    { icon: <ChevronUp size={11} />, label: 'Forward', action: bringForward },
                    { icon: <ChevronDown size={11} />, label: 'Backward', action: sendBackward },
                    { icon: <SendToBack size={11} />, label: 'To Back', action: sendToBack },
                  ].map(b => (
                    <button
                      key={b.label} onClick={b.action} title={b.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '6px 4px', borderRadius: 4, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 500,
                      }}
                    >
                      {b.icon} {b.label}
                    </button>
                  ))}
               </div>
            </AccordionSection>

            {/* Delete button doesn't need to be in an accordion */}
            <div style={{ padding: 12 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={deleteSelected}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', fontSize: 11, fontWeight: 600,
                }}
              >
                <Trash2 size={12} /> Delete Object
              </motion.button>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
