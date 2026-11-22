import './style.css';
import { Particles, SCRATCH, Sfx, playables } from '@jack-games/kit';
import { LEVELS, type ColorTool, type Level, type ToolKind } from './levels';
import { PAGES } from './pages';
import {
  INK,
  LINE_W,
  clipTo,
  drawGuides,
  drawPartial,
  fillRegion,
  makeThumb,
  pointAt,
  prepare,
  strokeLines,
  strokePageLines,
  type Prepared,
} from './art';
import { PEN_ANGLE, drawMascot, drawTool, drawToolShadow, makeToolIcon } from './tools';

const SAVE_KEY = 'jack-games.coloring.v1';
const TRACE_SPEED = 150; // art units per second
const TRACE_STEP = 2; // must match art.ts sampling step
const FILL_DONE = 0.95; // fraction of a section that must be covered before the done button shows
const LINE_PAUSE = 1.1; // seconds of celebration before the next line can be drawn
const PRAISE = ['Great!', 'Nice!', 'Yay!', 'Super!', 'Wow!', 'Cool!'];
/** Brush radius in screen-ish units (art units of a 400-wide picture at zoom 1). */
const BRUSH: Record<ToolKind, number> = { fineliner: 4, marker: 17, crayon: 16, paintstick: 21 };
const COLOR_TOOLS: ColorTool[] = ['marker', 'crayon', 'paintstick'];
const EMPTY_INK = '#e3e7ec';
const CONFETTI = ['#ff5a5f', '#ffd23f', '#5bc236', '#3a86ff', '#ff8fc7', '#9b5de5'];
const SIDE_LAYOUT = window.matchMedia('(orientation: landscape) and (max-height: 560px)');
const MAX_ZOOM = 2.5;
const PAINT_PX = 2400; // max paint layer side in pixels

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
/** Paint + finished fills, in art space at a fixed resolution. */
const paintLayer = document.createElement('canvas');
const pctx = paintLayer.getContext('2d')!;
/** Pre-rendered outlines for layered pages. */
const lineLayer = document.createElement('canvas');
const lctx = lineLayer.getContext('2d')!;
/** "Color here" hint for the current section, erased as it gets painted. */
const hintLayer = document.createElement('canvas');
const hctx = hintLayer.getContext('2d')!;
const ui = {
  hud: $('hud'),
  label: $('level-label'),
  bubbleText: $('bubble-text'),
  bubbleThumb: $('bubble-thumb'),
  restart: $('btn-restart'),
  bottom: $('bottom'),
  palette: $('palette'),
  tools: $('tools'),
  check: $('check'),
  done: $('btn-done'),
  praise: $('praise'),
  complete: $('complete'),
  completeArt: $('complete-art'),
  levels: $('levels'),
  grid: $('level-grid'),
  pageGrid: $('page-grid'),
};

const sfx = new Sfx();
const fx = new Particles();

type Phase = 'trace' | 'color' | 'done';
type Mode = 'level' | 'page';

interface RegionState {
  covered: Uint8Array;
  hits: number;
  color: string | null;
  done: boolean;
  /** 0..1 white flash after finishing. */
  flash: number;
}

interface Stroke {
  region: number;
  color: string;
  tool: ColorTool;
  r: number;
  pts: number[];
}

const state = {
  mode: 'level' as Mode,
  index: 0,
  def: LEVELS[0] as Level,
  prep: null as unknown as Prepared,
  phase: 'trace' as Phase,
  lineIdx: 0,
  progress: 0,
  /** Seconds left in the "line done!" pause. */
  linePause: 0,
  /** Glow on the line just finished: index + strength 0..1. */
  flash: { line: -1, t: 0 },
  regions: [] as RegionState[],
  regionIdx: 0,
  /** Colors offered for the current section. */
  palette: [] as string[],
  /** Current section is colored enough; waiting for the done button. */
  ready: false,
  color: null as string | null,
  tool: 'marker' as ColorTool,
  current: null as Stroke | null,
  timers: [] as { at: number; fn: () => void }[],
  clock: 0,
  idle: 0,
  swap: { from: 'fineliner' as ToolKind, t: 1, speed: 2 },
};

const progress = {
  completed: [] as number[],
  current: 0,
  /** Coloring pages: page id → region id → color. */
  pages: {} as Record<string, Record<string, string>>,
};
const pointer = { x: 0, y: 0, down: false, type: '', moved: 0 };
const pen = { x: 0, y: 0, speed: 0 };
/** Available drawing area (CSS px) and current art→screen transform. */
const view = { W: 0, H: 0, dpr: 1, left: 0, top: 0, right: 0, bottom: 0, ax: 0, ay: 0, k: 1 };
/** Camera in art space: center + zoom (1 = whole picture fits). */
const cam = { x: 200, y: 200, z: 1, tx: 200, ty: 200, tz: 1 };
let paused = false;

// ---- coordinates -------------------------------------------------------------

const toArt = (x: number, y: number) => ({ x: (x - view.ax) / view.k, y: (y - view.ay) / view.k });
const toScreen = (x: number, y: number) => ({ x: view.ax + x * view.k, y: view.ay + y * view.k });

function after(sec: number, fn: () => void) {
  state.timers.push({ at: state.clock + sec, fn });
}

// ---- layout + camera -----------------------------------------------------------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const hud = ui.hud.getBoundingClientRect();
  const bot = ui.bottom.getBoundingClientRect();
  const side = SIDE_LAYOUT.matches;
  Object.assign(view, {
    W,
    H,
    dpr,
    left: 16,
    top: hud.bottom + 12,
    right: side ? bot.left - 12 : W - 16,
    bottom: side ? H - 16 : bot.top - 6,
  });
  updateView();
}

/** Scale at which the whole picture fits the drawing area. */
function fitK() {
  const { w, h } = state.prep;
  const k = Math.min((view.right - view.left) / w, (view.bottom - view.top) / h);
  return state.prep.page ? k : Math.min(k, 620 / w);
}

function updateView() {
  if (!state.prep) return;
  view.k = Math.max(0.2, fitK() * cam.z);
  view.ax = (view.left + view.right) / 2 - cam.x * view.k;
  view.ay = (view.top + view.bottom) / 2 - cam.y * view.k;
}

/** Where the camera should look: the current section on pages, else everything. */
function cameraTarget() {
  const { w, h, page, samples } = state.prep;
  let x = w / 2, y = h / 2, z = 1;
  if (page && state.phase === 'color' && state.regionIdx < state.regions.length) {
    const b = samples[state.regionIdx];
    const pad = 60;
    const fit = fitK();
    z = Math.min(
      MAX_ZOOM,
      Math.max(1, Math.min((view.right - view.left) / ((b.x1 - b.x0 + pad * 2) * fit), (view.bottom - view.top) / ((b.y1 - b.y0 + pad * 2) * fit))),
    );
    // Keep the view inside the page.
    const halfW = (view.right - view.left) / (2 * fit * z);
    const halfH = (view.bottom - view.top) / (2 * fit * z);
    x = halfW * 2 >= w ? w / 2 : Math.min(w - halfW, Math.max(halfW, (b.x0 + b.x1) / 2));
    y = halfH * 2 >= h ? h / 2 : Math.min(h - halfH, Math.max(halfH, (b.y0 + b.y1) / 2));
  }
  Object.assign(cam, { tx: x, ty: y, tz: z });
}

function snapCamera() {
  cameraTarget();
  Object.assign(cam, { x: cam.tx, y: cam.ty, z: cam.tz });
  updateView();
}

// ---- painting ----------------------------------------------------------------

function hash(x: number, y: number, k: number) {
  let h = Math.imul((x * 64) | 0, 374761393) ^ Math.imul((y * 64) | 0, 668265263) ^ Math.imul(k + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function stamp(tool: ColorTool, x: number, y: number, r: number) {
  pctx.beginPath();
  pctx.arc(x, y, r, 0, Math.PI * 2);
  if (tool !== 'crayon') {
    pctx.fill();
    return;
  }
  // Crayon: soft base plus waxy specks for texture.
  pctx.globalAlpha = 0.45;
  pctx.fill();
  pctx.globalAlpha = 0.9;
  const s0 = r / 16;
  for (let i = 0; i < 6; i++) {
    const a = hash(x, y, i) * Math.PI * 2;
    const d = Math.sqrt(hash(y, x, i)) * r;
    const s = (1.5 + hash(x + i, y - i, 3) * 2.5) * s0;
    pctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s);
  }
  pctx.globalAlpha = 1;
}

const paintScale = () => paintLayer.width / state.prep.w;

/** Paint stroke points [from..end] into the paint layer, clipped to its region. */
function paintStroke(s: Stroke, from: number) {
  const scale = paintScale();
  pctx.setTransform(scale, 0, 0, scale, 0, 0);
  pctx.save();
  clipTo(pctx, state.prep.regions[s.region]);
  pctx.fillStyle = s.color;
  // Erase the hint wherever the brush goes.
  hctx.setTransform(scale, 0, 0, scale, 0, 0);
  hctx.save();
  hctx.globalCompositeOperation = 'destination-out';
  for (let i = Math.max(0, from); i < s.pts.length; i += 2) {
    const x1 = s.pts[i];
    const y1 = s.pts[i + 1];
    const x0 = i ? s.pts[i - 2] : x1;
    const y0 = i ? s.pts[i - 1] : y1;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (s.r * 0.3)));
    for (let j = i ? 1 : 0; j <= steps; j++) {
      const x = x0 + ((x1 - x0) * j) / steps;
      const y = y0 + ((y1 - y0) * j) / steps;
      stamp(s.tool, x, y, s.r);
      cover(s.region, x, y, s.r);
      hctx.beginPath();
      hctx.arc(x, y, s.r, 0, Math.PI * 2);
      hctx.fill();
    }
  }
  pctx.restore();
  hctx.restore();
}

function commitFill(i: number, color: string) {
  const scale = paintScale();
  pctx.setTransform(scale, 0, 0, scale, 0, 0);
  fillRegion(pctx, state.prep, i, color);
}

function cover(region: number, x: number, y: number, r: number) {
  const smp = state.prep.samples[region];
  const rs = state.regions[region];
  const r2 = r * r;
  for (let i = 0; i < smp.xs.length; i++) {
    if (rs.covered[i]) continue;
    const dx = smp.xs[i] - x;
    if (dx > r || dx < -r) continue;
    const dy = smp.ys[i] - y;
    if (dx * dx + dy * dy <= r2) {
      rs.covered[i] = 1;
      rs.hits++;
    }
  }
}

function addPaintPoint() {
  const s = state.current;
  if (!s) return;
  const p = toArt(pointer.x, pointer.y);
  const n = s.pts.length;
  if (n && Math.hypot(p.x - s.pts[n - 2], p.y - s.pts[n - 1]) < s.r * 0.08) return;
  s.pts.push(p.x, p.y);
  paintStroke(s, n);
  const rs = state.regions[s.region];
  const total = state.prep.samples[s.region].xs.length;
  if (!state.ready && (total === 0 || rs.hits / total >= FILL_DONE)) markReady();
}

// ---- game flow ----------------------------------------------------------------

const pageSave = () => (progress.pages[state.def.id!] ??= {});

function load(mode: Mode, i: number) {
  state.mode = mode;
  state.index = i;
  state.def = mode === 'page' ? PAGES[i] : LEVELS[i];
  state.prep = prepare(state.def);
  const { prep } = state;
  state.lineIdx = 0;
  state.progress = 0;
  state.linePause = 0;
  state.flash = { line: -1, t: 0 };
  state.regions = prep.samples.map((s) => ({ covered: new Uint8Array(s.xs.length), hits: 0, color: null, done: false, flash: 0 }));
  state.regionIdx = 0;
  state.color = null;
  state.ready = false;
  state.tool = state.def.tool;
  state.current = null;
  state.timers = [];
  state.idle = 0;
  state.swap = { from: mode === 'page' ? state.def.tool : 'fineliner', t: 1, speed: 2 };
  fx.clear();

  const scale = Math.min(3, PAINT_PX / Math.max(prep.w, prep.h));
  paintLayer.width = lineLayer.width = hintLayer.width = Math.round(prep.w * scale);
  paintLayer.height = lineLayer.height = hintLayer.height = Math.round(prep.h * scale);
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, paintLayer.width, paintLayer.height);
  if (prep.page) {
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, paintLayer.width, paintLayer.height);
    lctx.setTransform(scale, 0, 0, scale, 0, 0);
    lctx.clearRect(0, 0, prep.w, prep.h);
    strokePageLines(lctx, prep);
  }

  ui.check.classList.remove('pop');
  ui.praise.classList.remove('show');
  ui.complete.classList.add('hidden');
  ui.levels.classList.add('hidden');
  ui.restart.style.visibility = mode === 'page' ? 'hidden' : '';
  ui.bubbleThumb.replaceChildren(makeThumb(state.def, state.def.regions.map((r) => r.color), mode === 'page' ? 54 : 40, 0.02));
  setReadyUI(false);

  if (mode === 'page') {
    ui.label.textContent = state.def.name.toUpperCase();
    // Restore finished sections.
    const saved = pageSave();
    state.def.regions.forEach((r, j) => {
      const c = saved[r.id!];
      if (!c) return;
      Object.assign(state.regions[j], { color: c, done: true });
      commitFill(j, c);
    });
    state.phase = 'color';
    canvas.style.cursor = '';
    state.regionIdx = nextUndone(0);
    if (state.regionIdx >= state.regions.length) {
      state.phase = 'done';
      ui.bottom.classList.remove('show');
      ui.bubbleText.textContent = 'All done!';
      snapCamera();
      return;
    }
    ui.bubbleText.textContent = 'Color it!';
    ui.bottom.classList.add('show');
    beginRegion();
    snapCamera();
    return;
  }

  state.phase = 'trace';
  ui.label.textContent = `LEVEL ${i + 1}`;
  ui.bubbleText.textContent = 'Draw it!';
  ui.bottom.classList.remove('show');
  snapCamera();

  // The pen waits next to the starting X until the player presses.
  const l = prep.lines[0];
  const s = toScreen(l.xs[0], l.ys[0]);
  pen.x = s.x + 30 * view.k;
  pen.y = s.y + 50 * view.k;
  if (pointer.type !== 'mouse') {
    pointer.x = pen.x;
    pointer.y = pen.y;
  }
  canvas.style.cursor = 'pointer';

  if (progress.current !== i) {
    progress.current = i;
    void playables.save(SAVE_KEY, progress);
  }
}

const loadLevel = (i: number) => load('level', i);

function nextUndone(from: number) {
  let i = from;
  while (i < state.regions.length && state.regions[i].done) i++;
  return i;
}

/** Feedback for finishing one line: glow, sparkles along it, sound, praise word. */
function celebrateLine(idx: number) {
  const line = state.prep.lines[idx];
  state.flash = { line: idx, t: 1 };
  const every = Math.max(1, Math.floor(line.n / 8));
  for (let i = 0; i < line.n; i += every) {
    const p = toScreen(line.xs[i], line.ys[i]);
    fx.burst(p.x, p.y, { count: 4, colors: ['#ffd23f', '#ffffff', '#ffb703'], speed: 160, size: 11, life: 0.7 });
  }
  sfx.sparkle(idx);

  ui.praise.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  ui.praise.style.left = `${view.ax + (state.prep.w * view.k) / 2}px`;
  ui.praise.style.top = `${view.ay + state.prep.h * view.k * 0.12}px`;
  ui.praise.classList.remove('show');
  void ui.praise.offsetWidth;
  ui.praise.classList.add('show');
}

function startColoring() {
  state.phase = 'color';
  canvas.style.cursor = '';
  state.regionIdx = 0;
  state.color = null;
  swapTool('fineliner', 2);
  sfx.whoosh();
  ui.bubbleText.textContent = 'Color it!';
  ui.bottom.classList.add('show');
  beginRegion();
}

/** Offer a fresh set of colors for the current section. */
function beginRegion() {
  const suggested = state.def.regions[state.regionIdx].color;
  const shuffle = (a: string[]) => a.sort(() => Math.random() - 0.5);
  const others = shuffle(state.def.palette.filter((c) => c !== suggested)).slice(0, 2);
  state.palette = shuffle([suggested, ...others]);
  state.color = null;
  state.ready = false;
  setReadyUI(false);
  drawHint(state.regionIdx);
  renderPalette();
  renderTools();
}

/** Swap the palette for the big green "done" button (or back). */
function setReadyUI(ready: boolean) {
  ui.palette.classList.toggle('hidden', ready);
  ui.tools.classList.toggle('hidden', ready);
  ui.done.classList.toggle('hidden', !ready);
}

/** Section is colored enough: show the done button. */
function markReady() {
  state.ready = true;
  setReadyUI(true);
  sfx.sparkle(state.regionIdx + 2);
  requestAnimationFrame(() => {
    const r = ui.done.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 14, colors: ['#9be25a', '#ffffff', '#ffd23f'], speed: 220, size: 11 });
  });
}

function swapTool(from: ToolKind, speed: number) {
  state.swap = { from, t: 0, speed };
}

function completeRegion() {
  const i = state.regionIdx;
  const rs = state.regions[i];
  const smp = state.prep.samples[i];
  const color = state.color ?? state.def.regions[i].color;
  Object.assign(rs, { done: true, color, flash: 1 });
  commitFill(i, color);
  state.current = null;
  const c = toScreen(smp.cx, smp.cy);
  fx.burst(c.x, c.y, { count: 22, colors: ['#ffffff', '#ffe066', color], speed: 320, size: 14 });
  sfx.chime();

  if (state.mode === 'page') {
    pageSave()[state.def.regions[i].id!] = color;
    void playables.save(SAVE_KEY, progress);
  }

  state.regionIdx = nextUndone(i + 1);
  state.color = null;
  state.ready = false;
  if (state.regionIdx >= state.regions.length) finishLevel();
  else beginRegion();
}

function finishLevel() {
  state.phase = 'done';
  clearHint();
  ui.bottom.classList.remove('show');
  ui.bubbleText.textContent = 'Yay!';
  after(0.35, () => {
    ui.check.classList.add('pop');
    sfx.fanfare();
    fx.confetti(view.W, view.H, CONFETTI);
  });
  after(state.mode === 'page' ? 2.6 : 1.9, showComplete);

  if (state.mode === 'level') {
    if (!progress.completed.includes(state.index)) progress.completed.push(state.index);
    progress.current = (state.index + 1) % LEVELS.length;
  }
  void playables.save(SAVE_KEY, progress);
  playables.sendScore(progress.completed.length + PAGES.filter((p) => pageDone(p) === p.regions.length).length);
}

function showComplete() {
  const size = Math.min(state.prep.page ? 560 : 380, view.W * 0.85, (view.H * 0.5 * state.prep.w) / state.prep.h);
  ui.completeArt.replaceChildren(makeThumb(state.def, state.regions.map((r) => r.color), size));
  ui.complete.classList.remove('hidden');
  sfx.pop(7);
}

const pageDone = (p: Level) => p.regions.filter((r) => progress.pages[p.id!]?.[r.id!]).length;

// ---- DOM UI -------------------------------------------------------------------

function renderPalette() {
  const suggested = state.def.regions[state.regionIdx]?.color;
  ui.palette.replaceChildren(
    ...state.palette.map((c, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c;
      b.setAttribute('aria-label', `Color ${i + 1}`);
      if (c === state.color) b.classList.add('selected');
      else if (!state.color && c === suggested) b.classList.add('hint');
      b.onclick = () => {
        sfx.unlock();
        if (state.phase !== 'color') return;
        state.color = c;
        sfx.pop([0, 2, 4, 7, 9, 12][i % 6]);
        renderPalette();
        renderTools();
      };
      return b;
    }),
  );
}

function renderTools() {
  ui.tools.replaceChildren(
    ...COLOR_TOOLS.map((kind) => {
      const b = document.createElement('button');
      b.className = 'tool-btn' + (kind === state.tool ? ' selected' : '');
      b.setAttribute('aria-label', kind);
      b.appendChild(makeToolIcon(kind, state.color ?? state.def.regions[state.regionIdx]?.color ?? EMPTY_INK));
      b.onclick = () => {
        sfx.unlock();
        if (kind === state.tool) return;
        swapTool(state.tool, 4);
        state.tool = kind;
        sfx.whoosh();
        renderTools();
      };
      return b;
    }),
  );
}

const DONE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function openLevels() {
  ui.grid.replaceChildren(
    ...LEVELS.map((lv, i) => {
      const done = progress.completed.includes(i);
      const b = document.createElement('button');
      b.className = 'level-card' + (state.mode === 'level' && i === state.index ? ' current' : '');
      b.setAttribute('aria-label', `Picture ${i + 1}`);
      b.appendChild(makeThumb(lv, done ? lv.regions.map((r) => r.color) : [], 110));
      b.insertAdjacentHTML('beforeend', `<span class="num">${i + 1}</span>${done ? `<span class="done">${DONE_ICON}</span>` : ''}`);
      b.onclick = () => {
        sfx.tap();
        load('level', i);
      };
      return b;
    }),
  );
  ui.pageGrid.replaceChildren(
    ...PAGES.map((pg, i) => {
      const saved = progress.pages[pg.id!] ?? {};
      const count = pageDone(pg);
      const b = document.createElement('button');
      b.className = 'level-card page-card' + (state.mode === 'page' && i === state.index ? ' current' : '');
      b.setAttribute('aria-label', pg.name);
      b.appendChild(makeThumb(pg, pg.regions.map((r) => saved[r.id!] ?? null), 260, 0.02));
      const badge = count === pg.regions.length ? `<span class="done">${DONE_ICON}</span>` : `<span class="count">${count}/${pg.regions.length}</span>`;
      b.insertAdjacentHTML('beforeend', badge);
      b.onclick = () => {
        sfx.tap();
        load('page', i);
      };
      return b;
    }),
  );
  ui.levels.classList.remove('hidden');
}

$('btn-levels').onclick = () => {
  sfx.unlock();
  sfx.tap();
  openLevels();
};
ui.done.onclick = () => {
  sfx.unlock();
  if (state.phase !== 'color' || !state.ready) return;
  completeRegion();
};
$('btn-close').onclick = () => {
  sfx.tap();
  ui.levels.classList.add('hidden');
};
ui.restart.onclick = () => {
  sfx.unlock();
  sfx.tap();
  if (state.mode === 'level') load('level', state.index);
};
$('btn-replay').onclick = () => {
  sfx.tap();
  if (state.mode === 'page') {
    // Start the page over with a blank sheet.
    progress.pages[state.def.id!] = {};
    void playables.save(SAVE_KEY, progress);
  }
  load(state.mode, state.index);
};
$('btn-next').onclick = () => {
  sfx.pop(4);
  if (state.mode === 'page') openLevels();
  else load('level', (state.index + 1) % LEVELS.length);
};

// ---- input --------------------------------------------------------------------

canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  sfx.unlock();
  canvas.setPointerCapture(e.pointerId);
  Object.assign(pointer, { x: e.clientX, y: e.clientY, down: true, type: e.pointerType });
  state.idle = 0;

  if (state.phase === 'color') {
    // Section is colored enough: any tap on the picture counts as "done".
    if (state.ready) {
      completeRegion();
      return;
    }
    pen.x = pointer.x;
    pen.y = pointer.y;
    if (!state.color) {
      sfx.boop();
      ui.palette.classList.remove('nudge');
      void ui.palette.offsetWidth;
      ui.palette.classList.add('nudge');
      return;
    }
    // Keep the brush the same size on screen however far we're zoomed in.
    const r = (BRUSH[state.tool] * state.prep.w) / 400 / cam.tz;
    state.current = { region: state.regionIdx, color: state.color, tool: state.tool, r, pts: [] };
    addPaintPoint();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!e.isPrimary) return;
  pointer.moved += Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
  Object.assign(pointer, { x: e.clientX, y: e.clientY, type: e.pointerType });
  if (pointer.down && state.current) addPaintPoint();
});

const release = (e: PointerEvent) => {
  if (!e.isPrimary) return;
  pointer.down = false;
  state.current = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- update -------------------------------------------------------------------

function update(dt: number) {
  state.clock += dt;
  const due = state.timers.filter((t) => t.at <= state.clock);
  state.timers = state.timers.filter((t) => t.at > state.clock);
  due.forEach((t) => t.fn());

  // Camera glides toward the current section.
  cameraTarget();
  const glide = 1 - Math.exp(-dt * 4);
  cam.x += (cam.tx - cam.x) * glide;
  cam.y += (cam.ty - cam.y) * glide;
  cam.z += (cam.tz - cam.z) * glide;
  updateView();

  const { prep } = state;
  const tracing = state.phase === 'trace' && state.lineIdx < prep.lines.length;
  const tracePoint = () => {
    const a = pointAt(prep.lines[state.lineIdx], state.progress);
    return toScreen(a.x, a.y);
  };
  // While tracing, the pen ignores hovering and stays put; it only moves
  // (onto the line) while the player is pressing.
  let tx = state.phase === 'trace' ? pen.x : pointer.x;
  let ty = state.phase === 'trace' ? pen.y : pointer.y;
  let onLine = false;
  let scratch = 0;

  if (state.linePause > 0) state.linePause -= dt;
  if (state.flash.t > 0) state.flash.t = Math.max(0, state.flash.t - dt / LINE_PAUSE);

  if (tracing && pointer.down && state.linePause <= 0) {
    const line = prep.lines[state.lineIdx];
    const here = tracePoint();
    // Glide the pen to the line first; tracing starts once it lands.
    onLine = Math.hypot(here.x - pen.x, here.y - pen.y) < 6;
    if (onLine) {
      state.progress += (TRACE_SPEED * dt) / TRACE_STEP;
      scratch = 0.9;
      if (state.progress >= line.n - 1) {
        state.progress = line.n - 1;
        const end = tracePoint();
        celebrateLine(state.lineIdx);
        state.progress = 0;
        state.lineIdx++;
        state.linePause = LINE_PAUSE;
        state.idle = 0;
        scratch = 0;
        tx = end.x;
        ty = end.y;
        if (state.lineIdx >= prep.lines.length) after(LINE_PAUSE, startColoring);
      }
    }
    if (state.lineIdx < prep.lines.length && state.linePause <= 0) {
      const p = tracePoint();
      tx = p.x;
      ty = p.y;
    }
  }
  if (!pointer.down) state.idle += dt;

  // Pen follows its target: locked on while drawing, eased when moving over.
  const follow = state.current || onLine ? 1 : 1 - Math.exp(-dt * (state.phase === 'trace' ? 12 : 22));
  pen.x += (tx - pen.x) * follow;
  pen.y += (ty - pen.y) * follow;

  // Drawing sound follows hand speed while coloring.
  const speed = pointer.moved / Math.max(dt, 1e-3);
  pointer.moved = 0;
  pen.speed += (speed - pen.speed) * Math.min(1, dt * 12);
  if (state.current) scratch = Math.min(1, pen.speed / 500);
  const tool: ToolKind = state.phase === 'trace' ? 'fineliner' : state.tool;
  if (tool === 'crayon') scratch *= 0.7 + Math.random() * 0.3;
  sfx.setScratch(scratch, SCRATCH[tool]);

  if (state.swap.t < 1) state.swap.t = Math.min(1, state.swap.t + dt * state.swap.speed);
  for (const r of state.regions) if (r.flash > 0) r.flash = Math.max(0, r.flash - dt * 2.5);
  fx.update(dt);
}

// ---- render -------------------------------------------------------------------

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Very light suggestions (white, cream) would vanish on paper; use grey. */
function hatchColor(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
  return lum > 0.8 ? '#9aa4b0' : hex;
}

/**
 * "Color here" hint for the current section: a light tint + stripes on their
 * own layer. Painting erases it, so progress shows even with white paint.
 */
function drawHint(i: number) {
  const { w, h } = state.prep;
  const scale = paintScale();
  cameraTarget();
  const z = cam.tz * (400 / w); // keep stripes a steady size on screen
  const color = hatchColor(state.def.regions[i].color);
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, hintLayer.width, hintLayer.height);
  hctx.setTransform(scale, 0, 0, scale, 0, 0);
  hctx.save();
  clipTo(hctx, state.prep.regions[i]);
  hctx.globalAlpha = color === state.def.regions[i].color ? 0.18 : 0.3;
  hctx.fillStyle = color;
  hctx.fillRect(0, 0, w, h);
  hctx.globalAlpha = 0.7;
  hctx.strokeStyle = color;
  hctx.lineWidth = 3.5 / z;
  hctx.lineCap = 'round';
  hctx.setLineDash([10 / z, 8 / z]);
  hctx.beginPath();
  for (let d = -h; d < w; d += 18 / z) {
    hctx.moveTo(d, h);
    hctx.lineTo(d + h, 0);
  }
  hctx.stroke();
  hctx.restore();
}

function clearHint() {
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, hintLayer.width, hintLayer.height);
}

function drawStartMarker(x: number, y: number, t: number, isStart: boolean) {
  if (state.idle > 1.2) {
    const f = (t * 1.1) % 1;
    ctx.save();
    ctx.globalAlpha = 1 - f;
    ctx.strokeStyle = '#3f86d0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 14 + f * 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  if (isStart) {
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPen() {
  const ts = Math.max(0.55, Math.min(1.15, (Math.min(view.right - view.left, view.bottom - view.top) / 400) * 0.95));
  const current: ToolKind = state.phase === 'trace' ? 'fineliner' : state.tool;
  const { from, t } = state.swap;
  // Swap animation: old tool slides out along its body, new one slides in.
  const out = t < 0.5;
  const kind = out ? from : current;
  const slide = out ? ease(t * 2) : 1 - ease((t - 0.5) * 2);
  const off = slide * 520 * ts;
  const dir = { x: -Math.sin(PEN_ANGLE), y: Math.cos(PEN_ANGLE) };
  const ink = kind === 'fineliner' ? INK : state.color ?? EMPTY_INK;
  const lifted = !pointer.down;

  ctx.save();
  ctx.translate(pen.x + dir.x * off, pen.y + dir.y * off);
  ctx.scale(ts, ts);
  ctx.save();
  ctx.translate(lifted ? 26 : 14, lifted ? 18 : 9);
  ctx.rotate(PEN_ANGLE);
  drawToolShadow(ctx, lifted ? 0.08 : 0.13);
  ctx.restore();
  ctx.rotate(PEN_ANGLE);
  drawTool(ctx, kind, ink);
  ctx.restore();
}

function render(t: number) {
  const { prep, phase } = state;
  const artW = prep.w * view.k;
  const artH = prep.h * view.k;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.W, view.H);

  if (prep.page) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,30,50,0.15)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff';
    ctx.fillRect(view.ax, view.ay, artW, artH);
    ctx.restore();
  }
  ctx.drawImage(paintLayer, view.ax, view.ay, artW, artH);

  ctx.save();
  ctx.translate(view.ax, view.ay);
  ctx.scale(view.k, view.k);

  if (phase === 'color' && state.regionIdx < state.regions.length) {
    ctx.save();
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3);
    ctx.drawImage(hintLayer, 0, 0, prep.w, prep.h);
    ctx.restore();
  }

  state.regions.forEach((r, i) => {
    if (r.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = r.flash * 0.7;
    clipTo(ctx, prep.regions[i]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, prep.w, prep.h);
    ctx.restore();
  });

  if (state.flash.t > 0) {
    ctx.save();
    ctx.globalAlpha = state.flash.t;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = LINE_W + 14 * ease(state.flash.t);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.stroke(prep.linePaths[state.flash.line]);
    ctx.restore();
  }

  if (prep.page) {
    ctx.restore();
    ctx.drawImage(lineLayer, view.ax, view.ay, artW, artH);
  } else {
    if (phase === 'trace') {
      const waiting = state.linePause > 0;
      if (!waiting) drawGuides(ctx, prep.linePaths.slice(state.lineIdx, state.lineIdx + 1));
      strokeLines(ctx, prep.linePaths.slice(0, state.lineIdx));
      const line = waiting ? null : prep.lines[state.lineIdx];
      if (line) {
        if (state.progress > 0) drawPartial(ctx, line, state.progress);
        if (!pointer.down) {
          const p = pointAt(line, state.progress);
          drawStartMarker(p.x, p.y, t, state.progress === 0);
        }
      }
    } else {
      strokeLines(ctx, prep.linePaths);
    }
    ctx.restore();
  }

  drawPen();
  fx.draw(ctx);
}

// ---- boot ---------------------------------------------------------------------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    update(dt);
    render(now / 1000);
  }
  requestAnimationFrame(frame);
}

async function boot() {
  playables.installErrorLogging();
  drawMascot($<HTMLCanvasElement>('avatar'));
  pointer.x = pen.x = window.innerWidth * 0.6;
  pointer.y = pen.y = window.innerHeight * 0.8;
  state.prep = prepare(state.def);
  resize();
  loadLevel(0);
  render(0);
  playables.firstFrameReady();

  sfx.setEnabled(playables.isAudioEnabled());
  playables.onAudioEnabledChange((on) => sfx.setEnabled(on));
  playables.onPause(() => {
    paused = true;
    sfx.pause();
  });
  playables.onResume(() => {
    paused = false;
    last = performance.now();
    sfx.resume();
  });

  Object.assign(progress, await playables.load(SAVE_KEY, progress));
  if (progress.current !== state.index && LEVELS[progress.current]) loadLevel(progress.current);

  window.addEventListener('resize', resize);
  SIDE_LAYOUT.addEventListener('change', resize);
  requestAnimationFrame(frame);
  playables.gameReady();
}

void boot();
