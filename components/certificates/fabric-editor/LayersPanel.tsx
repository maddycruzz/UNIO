'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Unlock, Type, Square, Circle, Image as ImageIcon, Plus, Minus } from 'lucide-react';
import { useFabric, LayerItem } from './FabricContext';
import { AccordionSection } from './TemplatesSidebar';

const typeIcon = (type: string) => {
  switch (type) {
    case 'i-text':
    case 'text':
    case 'textbox':
      return <Type size={11} />;
    case 'rect':
      return <Square size={11} />;
    case 'circle':
      return <Circle size={11} />;
    case 'image':
      return <ImageIcon size={11} />;
    default:
      return <Square size={11} />;
  }
};

function LayerRow({ item, isSelected }: { item: LayerItem; isSelected: boolean }) {
  const { canvas, setSelectedObjects, refreshLayers } = useFabric();

  const handleSelect = () => {
    if (!canvas) return;
    canvas.setActiveObject(item.object as any);
    canvas.renderAll();
    setSelectedObjects([item.object]);
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    item.object.set('visible', !item.object.visible);
    canvas.renderAll();
    refreshLayers();
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;
    const locked = !item.object.selectable;
    item.object.set({
      selectable: locked,
      evented: locked,
    } as any);
    canvas.renderAll();
    refreshLayers();
  };

  const isLocked = !item.object.selectable;
  const isVisible = item.object.visible !== false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={handleSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px',
        background: isSelected ? 'rgba(99,102,241,0.2)' : 'transparent',
        cursor: 'pointer', transition: 'all 0.1s',
        opacity: isVisible ? 1 : 0.4,
        borderRadius: 4,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: isSelected ? '#818CF8' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
        {typeIcon(item.type)}
      </span>

      <span style={{
        flex: 1, fontSize: 11, fontWeight: 500,
        color: isSelected ? '#fff' : '#DFE1E5',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.name}
      </span>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={toggleVisibility} style={{ ...actionBtnStyle, color: isVisible ? 'rgba(255,255,255,0.4)' : '#ef4444' }}>
          {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
        <button onClick={toggleLock} style={{ ...actionBtnStyle, color: isLocked ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>
          {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
        </button>
      </div>
    </motion.div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  width: 16, height: 16, borderRadius: 2,
  border: 'none', background: 'transparent',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};

export function LayersList() {
  const { layers, selectedObjects } = useFabric();
  const selectedObj = selectedObjects[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
      <AnimatePresence>
        {layers.length === 0 ? (
          <div style={{ padding: '16px 8px', fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            No objects on canvas
          </div>
        ) : (
          layers.map(item => (
            <LayerRow
              key={item.id}
              item={item}
              isSelected={selectedObj === item.object}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LayersPanel() {
  const { layers, selectedObjects } = useFabric();
  const selectedObj = selectedObjects[0];

  return (
    <AccordionSection title="Layers" 
      extra={<><Plus size={12} color="rgba(255,255,255,0.4)"/><Minus size={12} color="rgba(255,255,255,0.4)"/></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <AnimatePresence>
          {layers.length === 0 ? (
            <div style={{ padding: '8px', fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              No objects
            </div>
          ) : (
            layers.map(item => (
              <LayerRow
                key={item.id}
                item={item}
                isSelected={selectedObj === item.object}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </AccordionSection>
  );
}
