// Level data. All art lives in a 400×400 box as SVG path strings.
// `lines` are traced in order with the fineliner; `regions` are colored in order.

export type ToolKind = 'fineliner' | 'marker' | 'crayon' | 'paintstick';
export type ColorTool = Exclude<ToolKind, 'fineliner'>;

export interface Region {
  d: string;
  /** Stable id (used for saving page progress). */
  id?: string;
  /** Stacking order for layered pages; higher hides lower. */
  z?: number;
  /** Extra decorative strokes that belong to this region. */
  detail?: string;
  /** Suggested color (shown in the preview + hatch hint). */
  color: string;
  /** Shapes cut out of this region (e.g. a door in a wall). */
  minus?: string[];
}

export interface Level {
  name: string;
  /** 'trace' (default): draw the lines first. 'page': outlines given, color only. */
  kind?: 'trace' | 'page';
  /** Stable id for saves (pages). */
  id?: string;
  /** Art box size (default 400×400). */
  w?: number;
  h?: number;
  lineWidth?: number;
  /** Auto-hide parts of a region covered by higher-z regions. */
  layered?: boolean;
  lines: string[];
  regions: Region[];
  palette: string[];
  tool: ColorTool;
}

export const C = {
  red: '#ff5a5f',
  orange: '#ff9f1c',
  yellow: '#ffd23f',
  green: '#5bc236',
  mint: '#7ee0b5',
  sky: '#6cc8f5',
  blue: '#3a86ff',
  purple: '#9b5de5',
  pink: '#ff8fc7',
  tan: '#f2b66d',
  brown: '#a0673b',
  wood: '#c98b55',
  cream: '#f6dcae',
  peach: '#f7c59f',
  gold: '#ffc53d',
  navy: '#2b3a67',
  forest: '#2d8a4e',
  white: '#ffffff',
  black: '#3a3d42',
};

export const n = (v: number) => +v.toFixed(1);
export const circle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
export const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y} H${x + w} V${y + h} H${x} Z`;

// 1. Sun
const sun = circle(200, 200, 78);
const sunRays = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const p = (r: number) => `${n(200 + Math.cos(a) * r)} ${n(200 + Math.sin(a) * r)}`;
  return `M${p(108)} L${p(142)}`;
}).join(' ');
const sunFace = 'M174 180 V196 M226 180 V196 M166 218 Q200 250 234 218';

// 2. Apple
const apple = 'M200 128 C170 104 96 106 96 200 C96 290 152 338 200 318 C248 338 304 290 304 200 C304 106 230 104 200 128 Z';
const appleStem = 'M200 128 C199 106 203 88 212 72';
const appleLeaf = 'M214 96 C226 62 262 52 288 60 C280 90 246 104 214 96 Z';

// 3. Ice cream
const scoop =
  'M128 206 C124 146 164 106 200 106 C236 106 276 146 272 206 C258 222 242 200 228 214 C214 228 186 228 172 214 C158 200 142 222 128 206 Z';
const cone = 'M146 210 L254 210 L200 352 Z';
const waffle = 'M166 236 L218 288 M234 236 L182 288';
const cherry = circle(200, 80, 18);
const cherryStem = 'M204 63 C208 48 216 40 230 36';

// 4. House
const roof = 'M104 202 L200 112 L296 202 Z';
const wall = rect(122, 202, 156, 128);
const door = rect(182, 262, 38, 68);
const win = rect(138, 226, 34, 34);
const winCross = 'M155 226 V260 M138 243 H172';

// 5. Rocket
const rocket = 'M200 82 C244 116 258 184 250 284 H150 C142 184 156 116 200 82 Z';
const porthole = circle(200, 182, 26);
const fins = 'M152 226 L112 300 L156 292 Z M248 226 L288 300 L244 292 Z';
const flame = 'M168 284 C172 318 188 330 200 354 C212 330 228 318 232 284 Z';

export const LEVELS: Level[] = [
  {
    name: 'Sun',
    lines: [sun, sunRays, sunFace],
    regions: [{ d: sun, color: C.yellow }],
    palette: [C.yellow, C.orange, C.red, C.pink, C.sky, C.mint],
    tool: 'marker',
  },
  {
    name: 'Apple',
    lines: [apple, appleStem, appleLeaf],
    regions: [
      { d: apple, color: C.red },
      { d: appleLeaf, color: C.green },
    ],
    palette: [C.red, C.green, C.yellow, C.orange, C.pink, C.purple, C.mint],
    tool: 'crayon',
  },
  {
    name: 'Ice Cream',
    lines: [scoop, cone, waffle, cherry, cherryStem],
    regions: [
      { d: scoop, color: C.pink },
      { d: cone, color: C.tan, minus: [scoop] },
      { d: cherry, color: C.red },
    ],
    palette: [C.pink, C.tan, C.red, C.mint, C.brown, C.purple, C.yellow],
    tool: 'paintstick',
  },
  {
    name: 'House',
    lines: [roof, wall, door, win, winCross],
    regions: [
      { d: roof, color: C.red },
      { d: wall, color: C.yellow, minus: [door, win] },
      { d: door, color: C.brown },
      { d: win, color: C.sky },
    ],
    palette: [C.red, C.yellow, C.brown, C.sky, C.green, C.blue, C.orange],
    tool: 'marker',
  },
  {
    name: 'Rocket',
    lines: [rocket, porthole, fins, flame],
    regions: [
      { d: rocket, color: C.red, minus: [porthole] },
      { d: porthole, color: C.sky },
      { d: fins, color: C.yellow, minus: [rocket] },
      { d: flame, color: C.orange },
    ],
    palette: [C.red, C.sky, C.yellow, C.orange, C.purple, C.green, C.pink],
    tool: 'crayon',
  },
];
