'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useFabric } from './FabricContext';

interface FabricCanvasProps {
  width?: number;
  height?: number;
}

export default function FabricCanvas({ width = 1123, height = 794 }: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<any>(null);
  const dragStartObjRef = useRef<any>(null);
  const dragStartPosRef = useRef<{ left: number, top: number } | null>(null);
  const { setCanvas, setSelectedObjects, refreshLayers, pushHistory, zoom, setZoom, deleteSelected, undo, redo, loadJSON, addImage, addText, addRect, addCircle, setFitZoomLevel } = useFabric();
  const fabricCanvasRef = useRef<any>(null);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasElRef.current || fabricCanvasRef.current) return;

    let fabricInstance: any = null;

    import('fabric').then(({ Canvas, util }) => {
      fabricInstance = new Canvas(canvasElRef.current!, {
        width,
        height,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
      });

      fabricCanvasRef.current = fabricInstance;
      setCanvas(fabricInstance);

      // ── Selection events ──
      fabricInstance.on('selection:created', (e: any) => {
        const selected = e.selected || (fabricInstance.getActiveObject() ? [fabricInstance.getActiveObject()] : []);
        setSelectedObjects(selected);
      });
      fabricInstance.on('selection:updated', (e: any) => {
        const selected = e.selected || (fabricInstance.getActiveObject() ? [fabricInstance.getActiveObject()] : []);
        setSelectedObjects(selected);
      });
      fabricInstance.on('selection:cleared', () => {
        setSelectedObjects([]);
      });

      // ── Object modified → push history ──
      fabricInstance.on('object:modified', () => {
        pushHistory();
        refreshLayers();
      });
      fabricInstance.on('object:added', () => {
        refreshLayers();
      });
      fabricInstance.on('object:removed', () => {
        refreshLayers();
      });

      // ── Mouse wheel zoom ──
      fabricInstance.on('mouse:wheel', (opt: any) => {
        if (opt.e.ctrlKey || opt.e.metaKey) {
          const delta = opt.e.deltaY;
          let currentZoom = fabricInstance.getZoom();
          currentZoom *= 0.999 ** delta;
          currentZoom = Math.max(0.1, Math.min(5, currentZoom));
          // fabricInstance.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
          fabricInstance.setZoom(currentZoom);
          setZoom(currentZoom);
          opt.e.preventDefault();
          opt.e.stopPropagation();
        }
      });

      // ── Middle-mouse / Alt+Pan and Alt+Drag ──
      fabricInstance.on('mouse:down', (opt: any) => {
        const evt = opt.e as MouseEvent;
        if (evt.button === 1 || (evt.altKey && !opt.target)) {
          // Pan empty space
          isPanningRef.current = true;
          fabricInstance.selection = false;
          lastPosRef.current = { x: evt.clientX, y: evt.clientY };
          (fabricInstance.getElement() as HTMLElement).style.cursor = 'grabbing';
        } else if (evt.altKey && opt.target) {
          // Alt+Drag duplication
          dragStartObjRef.current = opt.target;
          dragStartPosRef.current = { left: opt.target.left, top: opt.target.top };
        }
      });
      fabricInstance.on('mouse:move', (opt: any) => {
        if (!isPanningRef.current) return;
        const evt = opt.e as MouseEvent;
        const vpt = fabricInstance.viewportTransform as number[];
        vpt[4] += evt.clientX - lastPosRef.current.x;
        vpt[5] += evt.clientY - lastPosRef.current.y;
        fabricInstance.requestRenderAll();
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
      });
      fabricInstance.on('mouse:up', (opt: any) => {
        if (isPanningRef.current) {
          isPanningRef.current = false;
          fabricInstance.selection = true;
          (fabricInstance.getElement() as HTMLElement).style.cursor = 'default';
        }
        if (dragStartObjRef.current && opt.e.altKey && dragStartPosRef.current) {
          const currentLeft = dragStartObjRef.current.left;
          const currentTop = dragStartObjRef.current.top;

          dragStartObjRef.current.set({ left: dragStartPosRef.current.left, top: dragStartPosRef.current.top });
          dragStartObjRef.current.setCoords();

          dragStartObjRef.current.clone().then((cloned: any) => {
            cloned.set({ left: currentLeft, top: currentTop });
            fabricInstance.add(cloned);
            fabricInstance.setActiveObject(cloned);
            fabricInstance.requestRenderAll();
            pushHistory();
            refreshLayers();
          });
        }
        dragStartObjRef.current = null;
        dragStartPosRef.current = null;
      });

      // Push initial history state
      setTimeout(() => pushHistory(), 100);
    });

    return () => {
      if (fabricInstance) {
        fabricInstance.dispose();
        fabricCanvasRef.current = null;
        setCanvas(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update DOM container when zoom changes
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setDimensions({
        width: width * zoom,
        height: height * zoom,
      });
      fabricCanvasRef.current.setZoom(zoom);
    }
  }, [zoom, width, height]);

  // Fit to screen — re-runs whenever container resizes (handles collapsible sidebars)
  const applyFit = useCallback(() => {
    if (!containerRef.current || !fabricCanvasRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;
    const padding = 80;
    const fitZoom = Math.min(
      (clientWidth - padding) / width,
      (clientHeight - padding) / height,
      1,
    );
    fabricCanvasRef.current.setDimensions({ width: width * fitZoom, height: height * fitZoom });
    fabricCanvasRef.current.setZoom(fitZoom);
    setFitZoomLevel(fitZoom);
    setZoom(fitZoom);
  }, [width, height, setFitZoomLevel, setZoom]);

  useEffect(() => {
    const timer = setTimeout(applyFit, 50);
    const observer = new ResizeObserver(applyFit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Keyboard shortcuts and Clipboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or actively editing text
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (fabricCanvasRef.current && fabricCanvasRef.current.getActiveObject()?.isEditing) return;

      const mod = e.ctrlKey || e.metaKey;

      if (!mod && e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Group / Ungroup
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const activeItem = canvas.getActiveObject();
        if (e.shiftKey) { // Ungroup
          if (activeItem && activeItem.type === 'group') {
            activeItem.toActiveSelection();
            canvas.requestRenderAll();
            pushHistory(); refreshLayers();
          }
        } else { // Group
          if (activeItem && activeItem.type === 'activeSelection') {
            activeItem.toGroup();
            canvas.requestRenderAll();
            pushHistory(); refreshLayers();
          }
        }
        return;
      }

      // Lock / Unlock
      // Ctrl+L (Lock) / Ctrl+Alt+L (Unlock All)
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (e.altKey) {
          canvas.getObjects().forEach((o: any) => o.set({ selectable: true, evented: true }));
          canvas.requestRenderAll();
        } else {
          const actives = canvas.getActiveObjects();
          if (actives.length > 0) {
            actives.forEach((o: any) => o.set({ selectable: false, evented: false }));
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
        pushHistory(); refreshLayers();
        return;
      }

      // Select All (Ctrl+A)
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        canvas.discardActiveObject();
        import('fabric').then(({ ActiveSelection }) => {
          const sel = new ActiveSelection(canvas.getObjects().filter((o: any) => o.selectable), { canvas });
          canvas.setActiveObject(sel);
          canvas.requestRenderAll();
        });
        return;
      }

      // Duplicate (Ctrl+D)
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          activeObj.clone().then((cloned: any) => {
            canvas.discardActiveObject();
            cloned.set({ left: cloned.left + 15, top: cloned.top + 15, evented: true });
            if (cloned.type === 'activeSelection') {
              cloned.canvas = canvas;
              cloned.forEachObject((obj: any) => canvas.add(obj));
              cloned.setCoords();
            } else { canvas.add(cloned); }
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
            pushHistory(); refreshLayers();
          });
        }
        return;
      }

      // Paste (Ctrl+V)
      if (mod && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current) {
          e.preventDefault();
          clipboardRef.current.clone().then((clonedObj: any) => {
            canvas.discardActiveObject();
            clonedObj.set({ left: clonedObj.left + 15, top: clonedObj.top + 15, evented: true });
            if (clonedObj.type === 'activeSelection') {
              clonedObj.canvas = canvas;
              clonedObj.forEachObject((obj: any) => canvas.add(obj));
              clonedObj.setCoords();
            } else { canvas.add(clonedObj); }
            clipboardRef.current.top += 15;
            clipboardRef.current.left += 15;
            canvas.setActiveObject(clonedObj);
            canvas.requestRenderAll();
            pushHistory(); refreshLayers();
          });
        }
        return;
      }

      // Copy (Ctrl+C)
      if (mod && e.key.toLowerCase() === 'c') {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          activeObj.clone().then((cloned: any) => { clipboardRef.current = cloned; });
        }
        return;
      }

      // Undo / Redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom Controls (Ctrl++, Ctrl+-, Ctrl+0)
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(Math.min(5, zoom + 0.1)); return; }
      if (mod && e.key === '-') { e.preventDefault(); setZoom(Math.max(0.1, zoom - 0.1)); return; }
      if (mod && e.key === '0') {
        e.preventDefault();
        if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          setZoom(Math.min((clientWidth - 80) / width, (clientHeight - 80) / height, 1));
          canvas.absolutePan({ x: 0, y: 0 } as any);
        }
        return;
      }

      // Text Formatting (Ctrl+B, Ctrl+I, Ctrl+U)
      if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
        const actives = canvas.getActiveObjects();
        if (actives.length > 0 && actives.some((o: any) => o.type.includes('text'))) {
          e.preventDefault();
          actives.forEach((o: any) => {
            if (o.type.includes('text')) {
              if (e.key.toLowerCase() === 'b') o.set('fontWeight', String(o.fontWeight) === '700' ? '400' : '700');
              if (e.key.toLowerCase() === 'i') o.set('fontStyle', String(o.fontStyle) === 'italic' ? 'normal' : 'italic');
              if (e.key.toLowerCase() === 'u') o.set('underline', !o.underline);
            }
          });
          canvas.requestRenderAll();
          pushHistory();
        }
        return;
      }

      // Text Resizing (Ctrl+Shift+> / <)
      if (mod && e.shiftKey && (e.key === '>' || e.key === '<' || e.key === '.' || e.key === ',')) {
        const actives = canvas.getActiveObjects();
        if (actives.length > 0 && actives.some((o: any) => o.type.includes('text'))) {
          e.preventDefault();
          actives.forEach((o: any) => {
            if (o.type.includes('text')) {
              const shift = (e.key === '>' || e.key === '.') ? 2 : -2;
              o.set('fontSize', Math.max(8, (o.fontSize || 32) + shift));
            }
          });
          canvas.requestRenderAll();
          pushHistory();
        }
        return;
      }

      // Quick Elements (T, R, C, L)
      if (!mod && e.key.length === 1 && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 't') { addText(); return; }
        if (k === 'r') { addRect(); return; }
        if (k === 'c') { addCircle(); return; }
        if (k === 'l') {
          import('fabric').then(({ Line }) => {
            const line = new Line([0, 0, 200, 0], {
              left: 1123 / 2, top: 794 / 2,
              stroke: '#6366F1', strokeWidth: 4, originX: 'center', originY: 'center'
            } as any);
            (line as any).__uid = `line_${Date.now()}`;
            canvas.add(line); canvas.setActiveObject(line);
            canvas.requestRenderAll(); pushHistory(); refreshLayers();
          });
          return;
        }
      }

      // Arrow Key Nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowUp') activeObj.set('top', (activeObj.top || 0) - step);
          if (e.key === 'ArrowDown') activeObj.set('top', (activeObj.top || 0) + step);
          if (e.key === 'ArrowLeft') activeObj.set('left', (activeObj.left || 0) - step);
          if (e.key === 'ArrowRight') activeObj.set('left', (activeObj.left || 0) + step);
          activeObj.setCoords();
          canvas.requestRenderAll();
          // Don't push history rapidly on every keydown bounce, just render.
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo, pushHistory, refreshLayers]);

  // Handle external image pasting
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => addImage(ev.target?.result as string);
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addImage]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!fabricCanvasRef.current) return;

    // Check for internal template drag
    const templateData = e.dataTransfer.getData('fabric/template');
    if (templateData) {
      try {
        const json = JSON.parse(templateData);
        loadJSON(json);
      } catch (err) {
        console.error("Invalid dropped template data", err);
      }
      return;
    }

    // Default File drops
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(data);
          loadJSON(json);
        } catch (err) {
          console.error("Invalid JSON file");
        }
      } else if (file.type.startsWith('image/')) {
        addImage(data);
      }
    };

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        background: 'repeating-conic-gradient(rgba(255,255,255,0.015) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px',
        position: 'relative',
        minHeight: 0,
      }}
    >
      <div
        style={{
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
          borderRadius: 4,
          overflow: 'hidden',
          flexShrink: 0,
          background: '#fff',
          width: width * zoom,
          height: height * zoom,
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
