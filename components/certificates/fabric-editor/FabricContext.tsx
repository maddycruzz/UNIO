'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { Canvas, Object as FabricObject } from 'fabric';

export const CERT_WIDTH = 1123;
export const CERT_HEIGHT = 794;

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  object: FabricObject;
}

interface FabricContextValue {
  canvas: Canvas | null;
  setCanvas: (c: Canvas | null) => void;
  selectedObjects: FabricObject[];
  setSelectedObjects: (objs: FabricObject[]) => void;
  layers: LayerItem[];
  refreshLayers: () => void;
  addText: () => void;
  addRect: () => void;
  addCircle: () => void;
  addImage: (dataURL: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportPNG: () => void;
  exportJSON: () => void;
  loadJSON: (json: object) => void;
  pushHistory: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitZoomLevel: number;
  setFitZoomLevel: (z: number) => void;
  deleteSelected: () => void;
}

const FabricContext = createContext<FabricContextValue | null>(null);

export function FabricProvider({ children }: { children: React.ReactNode }) {
  const [canvas, setCanvasState] = useState<Canvas | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<FabricObject[]>([]);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [zoom, setZoomState] = useState(1);
  const [fitZoomLevel, setFitZoomLevel] = useState(1);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isPushingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const objectNamesRef = useRef<Map<FabricObject, string>>(new Map());
  const objectCountsRef = useRef<Record<string, number>>({});

  const setCanvas = useCallback((c: Canvas | null) => {
    setCanvasState(c);
  }, []);

  const refreshLayers = useCallback(() => {
    if (!canvas) return;
    const objs = canvas.getObjects();
    const items: LayerItem[] = objs.map((obj, i) => {
      let name = objectNamesRef.current.get(obj);
      if (!name) {
        const type = (obj.type || 'object');
        objectCountsRef.current[type] = (objectCountsRef.current[type] || 0) + 1;
        name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${objectCountsRef.current[type]}`;
        objectNamesRef.current.set(obj, name);
      }
      return {
        id: (obj as any).__uid || `obj-${i}`,
        name,
        type: obj.type || 'object',
        visible: obj.visible !== false,
        locked: !obj.selectable,
        object: obj,
      };
    }).reverse(); // top layer first
    setLayers(items);
  }, [canvas]);

  const pushHistory = useCallback(() => {
    if (!canvas || isPushingRef.current) return;
    const json = JSON.stringify((canvas as any).toJSON(['__uid', 'name']));
    // Truncate forward history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, [canvas]);

  const undo = useCallback(async () => {
    if (!canvas || historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    isPushingRef.current = true;
    const json = historyRef.current[historyIndexRef.current];
    await canvas.loadFromJSON(JSON.parse(json));
    canvas.renderAll();
    isPushingRef.current = false;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const redo = useCallback(async () => {
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isPushingRef.current = true;
    const json = historyRef.current[historyIndexRef.current];
    await canvas.loadFromJSON(JSON.parse(json));
    canvas.renderAll();
    isPushingRef.current = false;
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const deleteSelected = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  }, [canvas, pushHistory, refreshLayers]);

  const addText = useCallback(() => {
    if (!canvas) return;
    import('fabric').then(({ IText }) => {
      const text = new IText('Double-click to edit', {
        left: CERT_WIDTH / 2,
        top: CERT_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 32,
        fontFamily: "'DM Sans', sans-serif",
        fill: '#1E1B4B',
        fontWeight: '400',
      } as any);
      (text as any).__uid = `text_${Date.now()}`;
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
      pushHistory();
      refreshLayers();
    });
  }, [canvas, pushHistory, refreshLayers]);

  const addRect = useCallback(() => {
    if (!canvas) return;
    import('fabric').then(({ Rect }) => {
      const rect = new Rect({
        left: CERT_WIDTH / 2,
        top: CERT_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        width: 200,
        height: 120,
        fill: '#6366F1',
        opacity: 0.85,
        rx: 8,
        ry: 8,
      } as any);
      (rect as any).__uid = `rect_${Date.now()}`;
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
      pushHistory();
      refreshLayers();
    });
  }, [canvas, pushHistory, refreshLayers]);

  const addCircle = useCallback(() => {
    if (!canvas) return;
    import('fabric').then(({ Circle }) => {
      const circle = new Circle({
        left: CERT_WIDTH / 2,
        top: CERT_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        radius: 60,
        fill: '#10B981',
        opacity: 0.85,
      } as any);
      (circle as any).__uid = `circle_${Date.now()}`;
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.renderAll();
      pushHistory();
      refreshLayers();
    });
  }, [canvas, pushHistory, refreshLayers]);

  const addImage = useCallback((dataURL: string) => {
    if (!canvas) return;
    import('fabric').then(({ Image: FabImage }) => {
      const imgEl = new window.Image();
      imgEl.onload = () => {
        const img = new FabImage(imgEl, {
          left: CERT_WIDTH / 2,
          top: CERT_HEIGHT / 2,
          originX: 'center',
          originY: 'center',
        } as any);
        const maxW = CERT_WIDTH * 0.4;
        if (img.width && img.width > maxW) {
          img.scaleToWidth(maxW);
        }
        (img as any).__uid = `image_${Date.now()}`;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        pushHistory();
        refreshLayers();
      };
      imgEl.src = dataURL;
    });
  }, [canvas, pushHistory, refreshLayers]);

  const exportPNG = useCallback(() => {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 } as any);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'certificate-design.png';
    a.click();
  }, [canvas]);

  const exportJSON = useCallback(() => {
    if (!canvas) return;
    const json = JSON.stringify((canvas as any).toJSON(['__uid', 'name']), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'certificate-design.json';
    a.click();
  }, [canvas]);

  const loadJSON = useCallback(async (json: object) => {
    if (!canvas) return;
    objectNamesRef.current.clear();
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    pushHistory();
    refreshLayers();
  }, [canvas, pushHistory, refreshLayers]);

  const zoomIn = useCallback(() => {
    if (!canvas) return;
    const newZoom = Math.min(zoom * 1.2, 5);
    const center = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
    canvas.zoomToPoint(center as any, newZoom);
    setZoomState(newZoom);
  }, [canvas, zoom]);

  const zoomOut = useCallback(() => {
    if (!canvas) return;
    const newZoom = Math.max(zoom / 1.2, 0.1);
    const center = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
    canvas.zoomToPoint(center as any, newZoom);
    setZoomState(newZoom);
  }, [canvas, zoom]);

  const resetZoom = useCallback(() => {
    if (!canvas) return;
    const center = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
    canvas.zoomToPoint(center as any, fitZoomLevel);
    canvas.absolutePan({ x: 0, y: 0 } as any);
    setZoomState(fitZoomLevel);
    canvas.renderAll();
  }, [canvas, fitZoomLevel]);

  const setZoom = useCallback((z: number) => {
    if (!canvas) return;
    const center = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
    canvas.zoomToPoint(center as any, z);
    setZoomState(z);
  }, [canvas]);

  return (
    <FabricContext.Provider value={{
      canvas, setCanvas,
      selectedObjects, setSelectedObjects,
      layers, refreshLayers,
      addText, addRect, addCircle, addImage,
      undo, redo, canUndo, canRedo,
      exportPNG, exportJSON, loadJSON,
      pushHistory,
      zoom, setZoom, zoomIn, zoomOut, resetZoom,
      fitZoomLevel, setFitZoomLevel,
      deleteSelected,
    }}>
      {children}
    </FabricContext.Provider>
  );
}

export function useFabric() {
  const ctx = useContext(FabricContext);
  if (!ctx) throw new Error('useFabric must be used inside FabricProvider');
  return ctx;
}
