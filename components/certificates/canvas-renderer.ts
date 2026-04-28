// ── Canvas Renderer — Draws the certificate on a canvas ──

import { CertConfig, PALETTE, TextElement } from './types';

// Hit region for click detection
export interface HitRegion {
  id: string;
  type: 'text' | 'seal' | 'signatory' | 'logo';
  x: number; y: number; w: number; h: number;
}

// Resolve colour tokens like __accent__ to actual palette colours
function resolveColor(color: string, p: typeof PALETTE.classic): string {
  if (color === '__accent__')  return p.accent;
  if (color === '__heading__') return p.heading;
  if (color === '__body__')    return p.body;
  if (color === '__sub__')     return p.sub;
  return color;
}

// Load an image from a dataURL — returns a promise
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderCertificate(
  canvas: HTMLCanvasElement,
  recipientName: string,
  config: CertConfig,
  scale = 1,
  selectedIds: string[] = [],
  activeGuides: { axis: 'x'|'y', pos: number }[] = [],
  selectionBox: {startX: number, startY: number, currX: number, currY: number} | null = null,
): Promise<HitRegion[]> {
  const W = 1123 * scale;
  const H = 794  * scale;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const p   = PALETTE[config.templateId] ?? PALETTE.classic;
  const s   = scale;
  const hitRegions: HitRegion[] = [];

  // ── Custom background or default template ──
  if (config.customBg && config.templateId === 'custom') {
    try {
      const bgImg = await loadImage(config.customBg);
      ctx.drawImage(bgImg, 0, 0, W, H);
    } catch {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    const bw = 14 * s;
    ctx.strokeStyle = p.border;
    ctx.lineWidth = bw;
    ctx.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 1.5 * s;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(26 * s, 26 * s, W - 52 * s, H - 52 * s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(14 * s, 14 * s, W - 28 * s, 70 * s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(14 * s, H - 14 * s - 32 * s, W - 28 * s, 32 * s);
    ctx.globalAlpha = 1;
  }

  // ── UNIO Logo ──
  if (config.showLogo && config.templateId !== 'custom') {
    const lScale = config.logoScale ?? 1;
    const lx = ((config.logoX ?? 4.63) / 100) * W;
    const ly = ((config.logoY ?? 7.05) / 100) * H;
    
    ctx.font = `800 ${22 * s * lScale}px 'DM Sans', system-ui, sans-serif`;
    ctx.fillStyle = p.accent;
    ctx.textAlign = 'left';
    ctx.fillText('UNIO', lx, ly);
    const logoW = ctx.measureText('UNIO').width;
    ctx.font = `400 ${11 * s * lScale}px 'DM Sans', system-ui, sans-serif`;
    ctx.fillStyle = p.sub;
    ctx.fillText('Campus Events', lx + logoW + 8 * s * lScale, ly);

    const totalW = logoW + 8 * s * lScale + ctx.measureText('Campus Events').width;
    hitRegions.push({ id: 'logo', type: 'logo', x: lx, y: ly - 22 * s * lScale, w: totalW, h: 28 * s * lScale });

    if (selectedIds.includes('logo')) {
      ctx.save();
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 4 * s]);
      ctx.strokeRect(lx - 4 * s, ly - 26 * s * lScale, totalW + 8 * s, 34 * s * lScale);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── Text elements ──
  for (const el of config.textElements) {
    if (!el.visible) continue;
    const color = resolveColor(el.color, p);
    const text = el.text.replace('{{name}}', recipientName);
    const px = (el.x / 100) * W;
    const py = (el.y / 100) * H;

    ctx.font = `${el.fontWeight} ${el.fontStyle === 'italic' ? 'italic ' : ''}${el.fontSize * s}px ${el.fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = el.textAlign;
    ctx.fillText(text, px, py);

    // Compute hit region
    const tw = ctx.measureText(text).width;
    const th = el.fontSize * s;
    let rx = px;
    if (el.textAlign === 'center') rx = px - tw / 2;
    else if (el.textAlign === 'right') rx = px - tw;
    hitRegions.push({ id: el.id, type: 'text', x: rx, y: py - th, w: tw, h: th * 1.4 });

    // Draw selection highlight
    if (selectedIds.includes(el.id)) {
      ctx.save();
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 4 * s]);
      ctx.strokeRect(rx - 4 * s, py - th - 2 * s, tw + 8 * s, th * 1.4 + 4 * s);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Underline for recipient name
    if (el.key === 'recipientName') {
      ctx.strokeStyle = resolveColor('__accent__', p);
      ctx.lineWidth = 2 * s;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(px - tw / 2, py + 10 * s);
      ctx.lineTo(px + tw / 2, py + 10 * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Decorative line under heading
    if (el.key === 'heading') {
      ctx.strokeStyle = resolveColor('__accent__', p);
      ctx.lineWidth = 1.5 * s;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(px - 120 * s, py + 10 * s);
      ctx.lineTo(px + 120 * s, py + 10 * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── Seal ──
  if (config.showSeal) {
    const cx = ((config.sealX ?? 50) / 100) * W;
    const cy = ((config.sealY ?? 58) / 100) * H;
    const r = 38 * s * (config.sealScale ?? 1);
    hitRegions.push({ id: 'seal', type: 'seal', x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
    if (config.sealImage) {
      try {
        const sealImg = await loadImage(config.sealImage);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(sealImg, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2.5 * s;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } catch {
        drawDefaultSeal(ctx, cx, cy, r, s, p);
      }
    } else {
      drawDefaultSeal(ctx, cx, cy, r, s, p);
    }

    // Draw selection ring
    if (selectedIds.includes('seal')) {
      ctx.save();
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 4 * s]);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── Signatories ──
  const sigs = config.signatories;
  const defaultSigY = H * 0.72;
  const spacing = W / (sigs.length + 1);

  for (let i = 0; i < sigs.length; i++) {
    const sig = sigs[i];
    const x = sig.x !== undefined ? (sig.x / 100) * W : spacing * (i + 1);
    const y = sig.y !== undefined ? (sig.y / 100) * H : defaultSigY;
    const oScale = sig.scale ?? 1; // overall scale
    const sigScale = sig.sigImageScale ?? 1;

    // Digital signature image (with custom scale)
    if (sig.sigImage) {
      try {
        const sigImg = await loadImage(sig.sigImage);
        const baseH = 30 * s * sigScale * oScale;
        const imgW = (sigImg.width / sigImg.height) * baseH;
        ctx.drawImage(sigImg, x - imgW / 2, y - baseH - 6 * s * oScale, imgW, baseH);
      } catch { /* skip */ }
    }

    // Signature line
    ctx.strokeStyle = i === 0 ? p.accent : p.sub;
    ctx.lineWidth = 1 * s * oScale;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 80 * s * oScale, y);
    ctx.lineTo(x + 80 * s * oScale, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Name & title
    ctx.font = `700 ${12 * s * oScale}px 'DM Sans', system-ui, sans-serif`;
    ctx.fillStyle = p.heading;
    ctx.textAlign = 'center';
    ctx.fillText(sig.name, x, y + 18 * s * oScale);
    ctx.font = `400 ${10 * s * oScale}px 'DM Sans', system-ui, sans-serif`;
    ctx.fillStyle = p.sub;
    ctx.fillText(sig.title, x, y + 31 * s * oScale);

    const hitW = 160 * s * oScale;
    const hitH = 85 * s * oScale;
    hitRegions.push({ id: sig.id, type: 'signatory', x: x - hitW/2, y: y - 50 * s * oScale, w: hitW, h: hitH });

    // Draw selection highlight for signatory
    if (selectedIds.includes(sig.id)) {
      ctx.save();
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 4 * s]);
      ctx.strokeRect(x - hitW/2 - 4 * s, y - 50 * s * oScale - 4 * s, hitW + 8 * s, hitH + 12 * s);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── Snap Guides ──
  if (activeGuides.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#EC4899'; // Pink snapping lines
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([8 * s, 6 * s]);
    for (const guide of activeGuides) {
      if (guide.axis === 'x') {
        const gx = (guide.pos / 100) * W;
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      } else {
        const gy = (guide.pos / 100) * H;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Marquee Selection ──
  if (selectionBox) {
    ctx.save();
    const x = Math.min(selectionBox.startX, selectionBox.currX);
    const y = Math.min(selectionBox.startY, selectionBox.currY);
    const w = Math.abs(selectionBox.currX - selectionBox.startX);
    const h = Math.abs(selectionBox.currY - selectionBox.startY);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; 
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  return hitRegions;
}

// Test if a point hits any region
export function hitTest(regions: HitRegion[], px: number, py: number): HitRegion | null {
  // Reverse so top-drawn elements are checked first
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
  }
  return null;
}

function drawDefaultSeal(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  s: number, p: typeof PALETTE.classic,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2.5 * s;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `800 ${10 * s}px 'DM Sans', system-ui, sans-serif`;
  ctx.fillStyle = p.accent;
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL', cx, cy - 4 * s);
  ctx.fillText('SEAL', cx, cy + 9 * s);
}
