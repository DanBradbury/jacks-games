// Geometry helpers: sampling paths for tracing, sampling regions for fill
// coverage, and drawing finished artwork.
import type { Level } from './levels';

export const ART = 400;
export const INK = '#1b1b1f';
export const LINE_W = 9;
const STEP = 2;

export interface LinePts {
  xs: Float32Array;
  ys: Float32Array;
  /** 1 where the path jumps to a new subpath (moveTo). */
  jump: Uint8Array;
  n: number;
}

export interface RegionShape {
  path: Path2D;
  /** Even-odd "everything except X" paths: cut-outs and anything stacked on top. */
  cuts: Path2D[];
  detail: Path2D | null;
}

export interface RegionSamples {
  xs: Float32Array;
  ys: Float32Array;
  cx: number;
  cy: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Prepared {
  w: number;
  h: number;
  page: boolean;
  lineWidth: number;
  lines: LinePts[];
  linePaths: Path2D[];
  regions: RegionShape[];
  samples: RegionSamples[];
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let probe: SVGPathElement | null = null;
function getProbe() {
  if (!probe) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    probe = document.createElementNS(ns, 'path');
    svg.appendChild(probe);
    document.body.appendChild(svg);
  }
  return probe;
}

function bbox(d: string): Box {
  const p = getProbe();
  p.setAttribute('d', d);
  const b = p.getBBox();
  return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
}

const overlaps = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const subpaths = (d: string) => d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean);

export function sampleLine(d: string): LinePts {
  const p = getProbe();
  p.setAttribute('d', d);
  const total = p.getTotalLength();
  const n = Math.max(2, Math.ceil(total / STEP) + 1);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const jump = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const pt = p.getPointAtLength(Math.min(total, i * STEP));
    xs[i] = pt.x;
    ys[i] = pt.y;
    if (i > 0 && Math.hypot(pt.x - xs[i - 1], pt.y - ys[i - 1]) > STEP * 3) jump[i] = 1;
  }
  return { xs, ys, jump, n };
}

const tester = document.createElement('canvas').getContext('2d')!;

export function clipTo(ctx: CanvasRenderingContext2D, s: RegionShape) {
  ctx.clip(s.path);
  for (const c of s.cuts) ctx.clip(c, 'evenodd');
}

/**
 * Coverage samples: each grid point belongs to the top-most region containing
 * it (respecting explicit cut-outs), so hidden parts never need coloring.
 */
function sampleRegions(level: Level, boxes: Box[], zs: number[], w: number, h: number, spacing: number): RegionSamples[] {
  const paths = level.regions.map((r) => new Path2D(r.d));
  const minus = level.regions.map((r) => (r.minus ?? []).map((d) => new Path2D(d)));
  const top = zs.map((_, i) => i).sort((a, b) => zs[b] - zs[a]);
  const acc = level.regions.map(() => ({ xs: [] as number[], ys: [] as number[] }));
  for (let y = spacing / 2; y < h; y += spacing) {
    for (let x = spacing / 2; x < w; x += spacing) {
      for (const i of top) {
        const b = boxes[i];
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
        if (!tester.isPointInPath(paths[i], x, y)) continue;
        if (minus[i].some((m) => tester.isPointInPath(m, x, y))) continue;
        acc[i].xs.push(x);
        acc[i].ys.push(y);
        break;
      }
    }
  }
  return acc.map(({ xs, ys }, i) => {
    if (!xs.length) {
      const b = boxes[i];
      return { xs: new Float32Array(), ys: new Float32Array(), cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, ...b };
    }
    let x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0, sy = 0;
    xs.forEach((x, j) => {
      const y = ys[j];
      sx += x;
      sy += y;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    });
    return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), cx: sx / xs.length, cy: sy / xs.length, x0, y0, x1, y1 };
  });
}

export const dims = (level: Level) => ({ w: level.w ?? ART, h: level.h ?? ART });

const cache = new Map<Level, Prepared>();
export function prepare(level: Level): Prepared {
  let p = cache.get(level);
  if (p) return p;
  const { w, h } = dims(level);
  const bounds = `M-20 -20 H${w + 20} V${h + 20} H-20 Z`;
  const cutsOf = (d: string) => subpaths(d).map((s) => new Path2D(`${bounds} ${s}`));
  const boxes = level.regions.map((r) => bbox(r.d));
  const zs = level.regions.map((r, i) => r.z ?? i);
  const regions = level.regions.map((r, i) => {
    const cuts = (r.minus ?? []).flatMap(cutsOf);
    if (level.layered) {
      level.regions.forEach((o, j) => {
        if (zs[j] > zs[i] && overlaps(boxes[i], boxes[j])) cuts.push(...cutsOf(o.d));
      });
    }
    return { path: new Path2D(r.d), cuts, detail: r.detail ? new Path2D(r.detail) : null };
  });
  const page = level.kind === 'page';
  p = {
    w,
    h,
    page,
    lineWidth: level.lineWidth ?? LINE_W,
    lines: level.lines.map(sampleLine),
    linePaths: level.lines.map((d) => new Path2D(d)),
    regions,
    samples: sampleRegions(level, boxes, zs, w, h, page ? 6 : 5),
  };
  cache.set(level, p);
  return p;
}

export function pointAt(l: LinePts, progress: number) {
  const i = Math.min(l.n - 1, Math.floor(progress));
  const f = progress - i;
  if (i >= l.n - 1 || l.jump[i + 1]) return { x: l.xs[i], y: l.ys[i] };
  return { x: l.xs[i] + (l.xs[i + 1] - l.xs[i]) * f, y: l.ys[i] + (l.ys[i + 1] - l.ys[i]) * f };
}

function inkStyle(ctx: CanvasRenderingContext2D, width = LINE_W) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
}

export function strokeLines(ctx: CanvasRenderingContext2D, paths: Path2D[]) {
  ctx.save();
  inkStyle(ctx);
  for (const p of paths) ctx.stroke(p);
  ctx.restore();
}

/** Outlines for a layered page: each region's edge, hidden where covered. */
export function strokePageLines(ctx: CanvasRenderingContext2D, p: Prepared) {
  for (const r of p.regions) {
    ctx.save();
    for (const c of r.cuts) ctx.clip(c, 'evenodd');
    inkStyle(ctx, p.lineWidth);
    ctx.stroke(r.path);
    if (r.detail) {
      ctx.lineWidth = p.lineWidth * 0.8;
      ctx.stroke(r.detail);
    }
    ctx.restore();
  }
}

export function drawPartial(ctx: CanvasRenderingContext2D, l: LinePts, progress: number) {
  const end = Math.min(l.n - 1, Math.floor(progress));
  ctx.save();
  inkStyle(ctx);
  ctx.beginPath();
  ctx.moveTo(l.xs[0], l.ys[0]);
  for (let i = 1; i <= end; i++) {
    if (l.jump[i]) ctx.moveTo(l.xs[i], l.ys[i]);
    else ctx.lineTo(l.xs[i], l.ys[i]);
  }
  const tip = pointAt(l, progress);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.restore();
}

/** Dotted guide lines for the parts still to trace. */
export function drawGuides(ctx: CanvasRenderingContext2D, paths: Path2D[]) {
  ctx.save();
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#b9c0c8';
  ctx.setLineDash([0.1, 12]);
  for (const p of paths) ctx.stroke(p);
  ctx.restore();
}

/** Little shine streak so finished sections look glossy. */
export function drawGloss(ctx: CanvasRenderingContext2D, s: RegionShape, b: RegionSamples, alpha: number) {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < 20 || h < 20) return;
  ctx.save();
  clipTo(ctx, s);
  ctx.globalAlpha = 0.6 * alpha;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, Math.min(w, h, 160) * 0.06);
  ctx.beginPath();
  ctx.moveTo(b.x0 + w * 0.16, b.y0 + h * 0.42);
  ctx.quadraticCurveTo(b.x0 + w * 0.17, b.y0 + h * 0.2, b.x0 + w * 0.36, b.y0 + h * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(b.x0 + w * 0.15, b.y0 + h * 0.54, ctx.lineWidth * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

/** Solid fill (+ shine) for one finished region, in art space. */
export function fillRegion(ctx: CanvasRenderingContext2D, p: Prepared, i: number, color: string, gloss = true) {
  ctx.save();
  clipTo(ctx, p.regions[i]);
  ctx.fillStyle = color;
  ctx.fillRect(-20, -20, p.w + 40, p.h + 40);
  ctx.restore();
  if (gloss && !p.page) drawGloss(ctx, p.regions[i], p.samples[i], 1);
}

/** Clean finished artwork (flat fills + outlines) in art space. */
export function drawArtwork(ctx: CanvasRenderingContext2D, level: Level, colors: (string | null)[]) {
  const p = prepare(level);
  if (p.page) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, p.w, p.h);
  }
  colors.forEach((c, i) => c && fillRegion(ctx, p, i, c));
  if (p.page) strokePageLines(ctx, p);
  else strokeLines(ctx, p.linePaths);
}

export function makeThumb(level: Level, colors: (string | null)[], cssW: number, pad = 0.06) {
  const { w, h } = dims(level);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssH = (cssW * h) / w;
  const c = document.createElement('canvas');
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const ctx = c.getContext('2d')!;
  const k = (cssW * dpr * (1 - pad * 2)) / w;
  ctx.translate(cssW * dpr * pad, cssH * dpr * pad);
  ctx.scale(k, k);
  drawArtwork(ctx, level, colors);
  return c;
}
