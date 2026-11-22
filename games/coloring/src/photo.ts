// "Color your own picture": turn an image picked from the device into a
// coloring page. Dark outlines become the ink layer and each enclosed area
// becomes a section, so it plays exactly like the built-in pages. Nothing is
// uploaded, bundled or saved; the picture only lives in memory.
import { INK, registerPrepared, type Prepared, type RegionSamples } from './art';
import { C, type Level } from './levels';

const ART_PX = 1000; // longest side of the page in art units (= working pixels)
const LINE_DARK = 0.72; // "line" = darker than this fraction of the local average…
const LINE_MAX = 150; // …and darker than this luminance (0..255)
const MIN_SECTION = 0.0012; // smaller areas (eye shines, letter holes) stay white
const SPACING = 6; // coverage sample grid, as on the built-in pages
const COLORS = [C.red, C.orange, C.yellow, C.green, C.sky, C.blue, C.purple, C.pink, C.mint, C.tan, C.gold, C.forest];
const PALETTE = [...COLORS, C.brown, C.navy, C.peach, C.white, C.black];

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that picture'));
    };
    img.src = url;
  });
}

export async function pictureToPage(file: File): Promise<Level> {
  const img = await readImage(file);
  const s = ART_PX / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true })!;
  wctx.fillStyle = '#fff';
  wctx.fillRect(0, 0, w, h);
  wctx.drawImage(img, 0, 0, w, h);
  const src = wctx.getImageData(0, 0, w, h);
  const N = w * h;

  // Luminance + integral image for a local average (copes with phone photos of paper).
  const lum = new Float32Array(N);
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2];
      lum[i] = v;
      row += v;
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
    }
  }
  const R = Math.round(ART_PX / 40);
  const ink = new Uint8Array(N);
  const shade = new Float32Array(N); // 0 = paper, 1 = full ink
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
      const mean = (sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const i = y * w + x;
      const v = lum[i];
      if (v < 60 || (v < LINE_MAX && v < mean * LINE_DARK + 8)) ink[i] = 1;
      // Ink layer: darkness relative to the local paper, stretched so lines read solid.
      shade[i] = Math.min(1, Math.max(0, (Math.max(mean, 200) - v) / 140));
    }
  }
  // Walls: ink thickened by a pixel so small gaps don't join two sections.
  const wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % w;
    if (ink[i] || (x > 0 && ink[i - 1]) || (x < w - 1 && ink[i + 1]) || (i >= w && ink[i - w]) || (i < N - w && ink[i + w])) wall[i] = 1;
  }

  // Label connected areas between the walls.
  const labels = new Int32Array(N);
  const sizes = [0];
  const stack = new Int32Array(N);
  for (let start = 0; start < N; start++) {
    if (wall[start] || labels[start]) continue;
    const id = sizes.length;
    let top = 0, count = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top) {
      const i = stack[--top];
      count++;
      const x = i % w;
      if (x > 0 && !wall[i - 1] && !labels[i - 1]) (labels[i - 1] = id), (stack[top++] = i - 1);
      if (x < w - 1 && !wall[i + 1] && !labels[i + 1]) (labels[i + 1] = id), (stack[top++] = i + 1);
      if (i >= w && !wall[i - w] && !labels[i - w]) (labels[i - w] = id), (stack[top++] = i - w);
      if (i < N - w && !wall[i + w] && !labels[i + w]) (labels[i + w] = id), (stack[top++] = i + w);
    }
    sizes.push(count);
  }

  // Per section: clip path from pixel runs (padded a pixel to tuck under the ink),
  // coverage samples, bounds, and whether it touches the edge (= background).
  interface Acc { runs: string[]; xs: number[]; ys: number[]; x0: number; y0: number; x1: number; y1: number; edge: boolean }
  const minSize = N * MIN_SECTION;
  const acc = new Map<number, Acc>();
  for (let id = 1; id < sizes.length; id++) {
    if (sizes[id] >= minSize) acc.set(id, { runs: [], xs: [], ys: [], x0: w, y0: h, x1: 0, y1: 0, edge: false });
  }
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const id = labels[y * w + x];
      let end = x + 1;
      while (end < w && labels[y * w + end] === id) end++;
      const a = id ? acc.get(id) : undefined;
      if (a) {
        a.runs.push(`M${x - 1} ${y - 1}h${end - x + 2}v3h${-(end - x + 2)}Z`);
        a.x0 = Math.min(a.x0, x);
        a.x1 = Math.max(a.x1, end);
        a.y0 = Math.min(a.y0, y);
        a.y1 = Math.max(a.y1, y + 1);
        if (x === 0 || end === w || y === 0 || y === h - 1) a.edge = true;
        if (y % SPACING === SPACING >> 1) {
          for (let sx = x + ((SPACING - ((x - (SPACING >> 1)) % SPACING)) % SPACING); sx < end; sx += SPACING) {
            a.xs.push(sx + 0.5);
            a.ys.push(y + 0.5);
          }
        }
      }
      x = end;
    }
  }

  // Coloring order: top to bottom, left to right; the background goes last.
  const ids = [...acc.keys()].sort((p, q) => {
    const a = acc.get(p)!, b = acc.get(q)!;
    if (a.edge !== b.edge) return a.edge ? 1 : -1;
    const rowA = Math.floor((a.y0 + a.y1) / 2 / (h / 8)), rowB = Math.floor((b.y0 + b.y1) / 2 / (h / 8));
    return rowA - rowB || a.x0 + a.x1 - (b.x0 + b.x1);
  });
  const samples: RegionSamples[] = ids.map((id) => {
    const a = acc.get(id)!;
    const n = a.xs.length;
    const cx = n ? a.xs.reduce((t, v) => t + v, 0) / n : (a.x0 + a.x1) / 2;
    const cy = n ? a.ys.reduce((t, v) => t + v, 0) / n : (a.y0 + a.y1) / 2;
    return { xs: Float32Array.from(a.xs), ys: Float32Array.from(a.ys), cx, cy, x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1 };
  });

  // Ink layer: the picture's own lines, transparent everywhere else.
  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = w;
  inkCanvas.height = h;
  const ictx = inkCanvas.getContext('2d')!;
  const out = ictx.createImageData(w, h);
  const [ir, ig, ib] = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16));
  for (let i = 0; i < N; i++) {
    out.data[i * 4] = ir;
    out.data[i * 4 + 1] = ig;
    out.data[i * 4 + 2] = ib;
    out.data[i * 4 + 3] = Math.round(shade[i] * 255);
  }
  ictx.putImageData(out, 0, 0);

  const level: Level = {
    name: 'My Picture',
    kind: 'page',
    w,
    h,
    lines: [],
    regions: ids.map((id, i) => ({ d: '', id: `s${id}`, color: COLORS[i % COLORS.length] })),
    palette: PALETTE,
    tool: 'marker',
  };
  const prepared: Prepared = {
    w,
    h,
    page: true,
    lineWidth: 0,
    lines: [],
    linePaths: [],
    regions: ids.map((id) => ({ path: new Path2D(acc.get(id)!.runs.join('')), cuts: [], detail: null })),
    samples,
    ink: inkCanvas,
  };
  registerPrepared(level, prepared);
  return level;
}
