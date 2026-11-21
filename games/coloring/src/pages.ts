// Full coloring pages: bigger scenes with no drawing step. Parts are listed
// back-to-front (later parts hide earlier ones); `order` is the coloring order.
import { C, circle, n, rect, type ColorTool, type Level } from './levels';

interface Part {
  id: string;
  d: string;
  color: string;
  detail?: string;
}

const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
  `H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

/** Move/scale/flip a path made only of M/L/Q/C/Z (all absolute x,y pairs). */
function tf(d: string, ox: number, oy: number, s: number, fx: number) {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => String(n(i++ % 2 === 0 ? ox + +m * s * fx : oy + +m * s)));
}

function page(
  id: string,
  name: string,
  w: number,
  h: number,
  parts: Part[],
  order: string[],
  palette: string[],
  tool: ColorTool,
): Level {
  const missing = parts.filter((p) => !order.includes(p.id)).map((p) => p.id);
  if (missing.length || order.length !== parts.length) throw new Error(`page ${id}: order mismatch ${missing}`);
  const regions = order.map((oid) => {
    const z = parts.findIndex((p) => p.id === oid);
    const { d, color, detail } = parts[z];
    return { id: oid, d, color, detail, z };
  });
  return { id, name, kind: 'page', w, h, lineWidth: 5, layered: true, lines: [], regions, palette, tool };
}

/** A walking elf. (ox, oy) = feet, fx = 1 faces right, -1 faces left. */
function elf(p: string, ox: number, oy: number, s: number, fx: number, extra: 'gift' | 'wave'): Part[] {
  const T = (d: string) => tf(d, ox, oy, s, fx);
  const O = (x: number, y: number, r: number) => circle(n(ox + x * s * fx), n(oy + y * s), n(r * s));
  const body = T('M-19 -72 L19 -72 L30 -28 L-30 -28 Z');
  const arm = T('M-14 -70 L-36 -96 L-29 -102 L-8 -76 Z');
  const parts: Part[] = [
    { id: `${p}-body`, d: extra === 'wave' ? `${body} ${arm}` : body, color: C.green },
    { id: `${p}-belt`, d: T('M-26 -46 L26 -46 L28 -38 L-28 -38 Z'), color: C.black },
    { id: `${p}-legs`, d: T('M-14 -28 L-24 -2 L-14 -2 L-4 -28 Z M4 -28 L14 -2 L24 -2 L14 -28 Z'), color: C.red },
    { id: `${p}-shoes`, d: T('M-30 -6 L-8 -6 L-8 3 L-36 3 Q-42 -10 -30 -6 Z M10 -6 L32 -6 Q46 -12 42 3 L10 3 Z'), color: C.brown },
    {
      id: `${p}-skin`,
      d: [O(0, -92, 20), T('M-19 -97 L-34 -110 L-17 -85 Z'), T('M19 -97 L34 -110 L17 -85 Z'), extra === 'wave' ? O(-34, -104, 6) : '']
        .filter(Boolean)
        .join(' '),
      color: C.peach,
      detail: T('M-7 -94 L-7 -92 M7 -94 L7 -92 M-6 -82 Q0 -77 6 -82'),
    },
    { id: `${p}-hat`, d: T('M-22 -112 Q-6 -170 46 -154 Q18 -142 22 -112 Z'), color: C.red },
    { id: `${p}-brim`, d: `${T('M-25 -118 L25 -118 L25 -106 L-25 -106 Z')} ${O(46, -154, 7)}`, color: C.white },
  ];
  if (extra === 'gift') {
    parts.push({
      id: `${p}-gift`,
      d: T('M-6 -70 L44 -70 L44 -38 L-6 -38 Z'),
      color: C.blue,
      detail: T('M19 -70 L19 -38 M-6 -54 L44 -54'),
    });
  }
  return parts;
}

// Bunting flags hang along a curve: y = 20 + 60t(1 - t), x = 250 + 300t.
const flag = (t: number) => {
  const x = 250 + 300 * t;
  const y = n(20 + 60 * t * (1 - t));
  return `M${x - 20} ${y} L${x + 20} ${y} L${x} ${n(y + 44)} Z`;
};

const workshopParts: Part[] = [
  // Room
  { id: 'wall', d: rect(0, 0, 800, 430), color: C.cream, detail: 'M160 0 V430 M320 0 V430 M480 0 V430 M640 0 V430' },
  { id: 'floor', d: rect(0, 430, 800, 170), color: C.tan, detail: 'M0 490 H800 M0 545 H800 M120 430 V490 M420 430 V490 M260 490 V545 M600 490 V545 M90 545 V600 M500 545 V600' },
  { id: 'flags-a', d: [0.1, 0.467, 0.833].map(flag).join(' '), color: C.red, detail: 'M250 20 Q400 80 550 20' },
  { id: 'flags-b', d: [0.283, 0.65].map(flag).join(' '), color: C.green },
  { id: 'frame', d: rrect(60, 60, 170, 150, 10), color: C.wood },
  { id: 'sky', d: rect(76, 76, 138, 118), color: C.navy, detail: 'M145 76 V194 M76 135 H214' },
  { id: 'moon', d: circle(180, 106, 18), color: C.yellow },
  { id: 'shelf', d: rect(560, 150, 210, 14), color: C.wood },
  { id: 'ball', d: circle(600, 126, 24), color: C.red, detail: 'M576 126 Q600 110 624 126' },
  { id: 'block-a', d: rrect(640, 104, 46, 46, 5), color: C.blue, detail: 'M651 141 L663 114 L675 141 M656 131 H670' },
  { id: 'block-b', d: rrect(696, 116, 34, 34, 5), color: C.yellow },
  // Elves in the background
  ...elf('elf-a', 130, 440, 1.05, 1, 'gift'),
  ...elf('elf-b', 742, 446, 1, -1, 'wave'),
  // Santa
  { id: 'pants', d: `${rect(312, 500, 44, 40)} ${rect(374, 500, 44, 40)}`, color: C.red },
  { id: 'boots', d: 'M300 532 L358 532 L358 562 L290 562 Q288 544 300 532 Z M372 532 L430 532 Q442 544 440 562 L372 562 Z', color: C.black },
  {
    id: 'coat',
    d:
      'M300 330 C288 380 284 450 292 500 L438 500 C446 450 442 380 430 330 C408 312 322 312 300 330 Z ' +
      'M302 336 C268 352 252 400 258 442 L288 446 C288 408 298 384 312 364 Z ' +
      'M428 336 C462 352 478 400 472 442 L442 446 C442 408 432 384 418 364 Z',
    color: C.red,
  },
  { id: 'trim', d: `${rrect(286, 488, 158, 26, 12)} ${rect(356, 336, 18, 152)} ${rrect(250, 430, 44, 18, 8)} ${rrect(436, 430, 44, 18, 8)}`, color: C.white },
  { id: 'belt', d: rect(292, 420, 146, 26), color: C.black },
  { id: 'buckle', d: rrect(345, 414, 40, 38, 5), color: C.gold, detail: 'M355 424 H375 V442 H355 Z' },
  { id: 'mittens', d: `${circle(272, 458, 16)} ${circle(458, 458, 16)}`, color: C.forest },
  { id: 'face', d: circle(365, 262, 40), color: C.peach, detail: 'M350 250 L350 253 M380 250 L380 253' },
  { id: 'beard', d: 'M326 268 C322 330 346 362 365 364 C384 362 408 330 404 268 C390 290 340 290 326 268 Z', color: C.white },
  { id: 'mustache', d: 'M365 276 C350 264 330 268 328 282 C342 292 358 288 365 280 C372 288 388 292 402 282 C400 268 380 264 365 276 Z', color: C.white },
  { id: 'nose', d: circle(365, 266, 9), color: C.pink },
  { id: 'hat', d: 'M322 236 Q345 160 412 166 Q446 176 458 214 L420 230 L408 236 Z', color: C.red },
  { id: 'hat-trim', d: `${rrect(314, 222, 104, 26, 13)} ${circle(458, 214, 15)}`, color: C.white },
  // Workbench and toys
  { id: 'bench', d: `${rrect(480, 404, 280, 24, 4)} ${rect(496, 428, 20, 132)} ${rect(724, 428, 20, 132)}`, color: C.wood },
  { id: 'present', d: `${rect(500, 344, 74, 60)} ${rect(494, 332, 86, 12)}`, color: C.green },
  { id: 'ribbon', d: `${rect(530, 332, 14, 72)} M537 332 C520 308 504 324 522 332 Z M537 332 C554 308 570 324 552 332 Z`, color: C.red },
  { id: 'bear-body', d: `${circle(626, 370, 32)} ${circle(608, 304, 9)} ${circle(644, 304, 9)}`, color: C.brown },
  { id: 'bear-head', d: circle(626, 322, 22), color: C.brown, detail: 'M618 316 L618 318 M634 316 L634 318 M622 328 Q626 332 630 328' },
  // Toy blocks in front
  { id: 'block-c', d: rrect(40, 500, 64, 64, 6), color: C.red, detail: 'M60 515 V549 M60 515 Q84 515 82 524 Q80 532 60 532 Q86 532 84 541 Q82 549 60 549' },
  { id: 'block-d', d: rrect(110, 518, 46, 46, 6), color: C.yellow },
  { id: 'block-e', d: rrect(52, 448, 48, 52, 6), color: C.sky },
];

const workshopOrder = [
  'hat', 'hat-trim', 'face', 'nose', 'beard', 'mustache', 'coat', 'trim', 'belt', 'buckle', 'mittens', 'pants', 'boots',
  'present', 'ribbon', 'bear-body', 'bear-head', 'bench',
  'elf-a-hat', 'elf-a-brim', 'elf-a-skin', 'elf-a-body', 'elf-a-belt', 'elf-a-legs', 'elf-a-shoes', 'elf-a-gift',
  'elf-b-hat', 'elf-b-brim', 'elf-b-skin', 'elf-b-body', 'elf-b-belt', 'elf-b-legs', 'elf-b-shoes',
  'frame', 'sky', 'moon', 'flags-a', 'flags-b', 'shelf', 'ball', 'block-a', 'block-b',
  'block-c', 'block-d', 'block-e', 'floor', 'wall',
];

export const PAGES: Level[] = [
  page(
    'santa-workshop',
    "Santa's Workshop",
    800,
    600,
    workshopParts,
    workshopOrder,
    [C.red, C.green, C.white, C.yellow, C.gold, C.blue, C.sky, C.navy, C.brown, C.wood, C.tan, C.cream, C.peach, C.pink, C.purple, C.orange, C.forest, C.black],
    'marker',
  ),
];
