// Procedurally drawn art tools. Each is drawn in local space with the tip at
// (0,0) and the body running down the +y axis (~250 units long).
import type { ToolKind } from './levels';

/** Tilt so the body leans down-right from the tip. */
export const PEN_ANGLE = -0.45;

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const v = parseInt(hex.slice(1), 16);
  const ch = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const r = ch(v >> 16), g = ch((v >> 8) & 255), b = ch(v & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Horizontal gradient that makes a flat shape read as a cylinder. */
function cyl(ctx: Ctx, x0: number, x1: number, base: string) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(base, -0.3));
  g.addColorStop(0.3, shade(base, 0.3));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -0.4));
  return g;
}

function ridges(ctx: Ctx, x: number, w: number, y0: number, y1: number, gap: number, color: string) {
  ctx.fillStyle = color;
  for (let y = y0; y < y1; y += gap) ctx.fillRect(x, y, w, 1.6);
}

function fineliner(ctx: Ctx) {
  rr(ctx, -1.8, -1, 3.6, 16, 1.8);
  ctx.fillStyle = '#1c1c1c';
  ctx.fill();
  poly(ctx, [-3.5, 13, 3.5, 13, 11, 36, -11, 36]);
  ctx.fillStyle = cyl(ctx, -11, 11, '#b9c0c8');
  ctx.fill();
  rr(ctx, -12, 35, 24, 42, 4);
  ctx.fillStyle = cyl(ctx, -12, 12, '#34373c');
  ctx.fill();
  ridges(ctx, -12, 24, 41, 74, 6, 'rgba(255,255,255,0.1)');
  rr(ctx, -13, 76, 26, 172, 6);
  ctx.fillStyle = cyl(ctx, -13, 13, '#454a52');
  ctx.fill();
  ctx.fillStyle = cyl(ctx, -13, 13, '#eef1f4');
  ctx.fillRect(-13, 122, 26, 34);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(-13, 130, 26, 5);
  ctx.fillRect(-6, 141, 12, 3);
  rr(ctx, 9.5, 86, 5, 72, 2.5);
  ctx.fillStyle = cyl(ctx, 9.5, 14.5, '#9aa1a9');
  ctx.fill();
  rr(ctx, -11, 244, 22, 10, 4);
  ctx.fillStyle = '#26282c';
  ctx.fill();
}

function marker(ctx: Ctx, ink: string) {
  ctx.beginPath();
  ctx.moveTo(-5.5, 20);
  ctx.lineTo(-5.5, 7);
  ctx.quadraticCurveTo(-5.5, 0, 0, 0);
  ctx.quadraticCurveTo(5.5, 0, 5.5, 7);
  ctx.lineTo(5.5, 20);
  ctx.closePath();
  ctx.fillStyle = cyl(ctx, -5.5, 5.5, ink);
  ctx.fill();
  poly(ctx, [-7, 18, 7, 18, 15, 42, -15, 42]);
  ctx.fillStyle = cyl(ctx, -15, 15, '#dfe4ea');
  ctx.fill();
  rr(ctx, -16, 40, 32, 184, 9);
  ctx.fillStyle = cyl(ctx, -16, 16, '#f7f9fb');
  ctx.fill();
  ctx.fillStyle = cyl(ctx, -16, 16, ink);
  ctx.fillRect(-16, 62, 32, 18);
  rr(ctx, -17.5, 206, 35, 40, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-17.5, 214, 35, 3);
}

function crayon(ctx: Ctx, ink: string) {
  ctx.beginPath();
  ctx.moveTo(-4, 3);
  ctx.quadraticCurveTo(0, -2, 4, 3);
  ctx.lineTo(13.5, 32);
  ctx.lineTo(-13.5, 32);
  ctx.closePath();
  ctx.fillStyle = cyl(ctx, -13.5, 13.5, ink);
  ctx.fill();
  ctx.fillRect(-13.5, 31, 27, 200);
  const wrap = shade(ink, -0.18);
  ctx.fillStyle = cyl(ctx, -14.5, 14.5, wrap);
  ctx.fillRect(-14.5, 52, 29, 166);
  ctx.strokeStyle = shade(ink, -0.45);
  ctx.lineWidth = 2;
  for (const y of [60, 210]) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(-14.5 + i * 4.83, y + (i % 2 ? 2 : -2));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, 136, 8, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(ink, -0.25);
  ctx.fillRect(-2, 118, 4, 36);
}

function paintstick(ctx: Ctx, ink: string) {
  ctx.beginPath();
  ctx.moveTo(-10, 28);
  ctx.lineTo(-10, 11);
  ctx.bezierCurveTo(-10, -3, 10, -3, 10, 11);
  ctx.lineTo(10, 28);
  ctx.closePath();
  ctx.fillStyle = cyl(ctx, -10, 10, ink);
  ctx.fill();
  const gold = '#f2a516';
  rr(ctx, -19, 24, 38, 42, 7);
  ctx.fillStyle = cyl(ctx, -19, 19, gold);
  ctx.fill();
  ridges(ctx, -19, 38, 30, 62, 7, 'rgba(120,60,0,0.35)');
  rr(ctx, -17, 64, 34, 170, 5);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = cyl(ctx, -17, 17, ink);
  ctx.fill();
  ctx.globalAlpha = 1;
  // twisted core inside the clear tube
  ctx.strokeStyle = shade(ink, -0.28);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 72; y <= 226; y += 3) ctx.lineTo(Math.sin(y / 13) * 8, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, -12, 70, 5, 156, 2.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  for (const [x, y, r] of [[6, 96, 3], [-4, 140, 2.2], [8, 176, 2.6], [-2, 206, 1.8]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  rr(ctx, -19, 230, 38, 22, 7);
  ctx.fillStyle = cyl(ctx, -19, 19, gold);
  ctx.fill();
}

export function drawTool(ctx: Ctx, kind: ToolKind, ink: string) {
  ctx.save();
  if (kind === 'fineliner') fineliner(ctx);
  else if (kind === 'marker') marker(ctx, ink);
  else if (kind === 'crayon') crayon(ctx, ink);
  else paintstick(ctx, ink);
  ctx.restore();
}

export function drawToolShadow(ctx: Ctx, alpha: number) {
  ctx.save();
  ctx.fillStyle = `rgba(30,40,60,${alpha})`;
  rr(ctx, -15, 20, 30, 236, 15);
  ctx.fill();
  ctx.restore();
}

/** Small canvas icon for the tool tray. */
export function makeToolIcon(kind: ToolKind, ink: string, cssSize = 44) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(cssSize * dpr);
  c.style.width = c.style.height = `${cssSize}px`;
  const ctx = c.getContext('2d')!;
  const s = (cssSize * dpr) / 300;
  ctx.translate(cssSize * dpr * 0.2, cssSize * dpr * 0.1);
  ctx.scale(s, s);
  ctx.rotate(-0.6);
  drawTool(ctx, kind, ink);
  return c;
}

/** The friendly artist in the request bubble. */
export function drawMascot(c: HTMLCanvasElement, cssSize = 40) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = c.height = Math.round(cssSize * dpr);
  c.style.width = c.style.height = `${cssSize}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale((cssSize * dpr) / 40, (cssSize * dpr) / 40);
  ctx.fillStyle = '#6f7cff';
  ctx.beginPath();
  ctx.arc(20, 20, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5c79e';
  ctx.beginPath();
  ctx.arc(20, 24, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5a5f';
  ctx.beginPath();
  ctx.ellipse(18, 13, 13, 5.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(18, 7.5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1b1f';
  for (const x of [15.5, 24.5]) {
    ctx.beginPath();
    ctx.arc(x, 23, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1f';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(20, 26.5, 4, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.5)';
  for (const x of [12.5, 27.5]) {
    ctx.beginPath();
    ctx.arc(x, 27, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
