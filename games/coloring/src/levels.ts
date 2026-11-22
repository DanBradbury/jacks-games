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
  gray: '#a9b3bd',
};

export const n = (v: number) => +v.toFixed(1);
export const circle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
export const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx} ${cy - ry} A${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A${rx} ${ry} 0 1 1 ${cx} ${cy - ry} Z`;
export const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
  `H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

/** Circle (cx, cy, r) minus the circle (hx, hy, hr) it overlaps: ears on a head, a crescent moon. */
function bump(cx: number, cy: number, r: number, hx: number, hy: number, hr: number) {
  const d = Math.hypot(hx - cx, hy - cy);
  const phi = Math.atan2(hy - cy, hx - cx);
  const a = Math.acos((d * d + r * r - hr * hr) / (2 * d * r));
  const p = (t: number) => `${n(cx + Math.cos(t) * r)} ${n(cy + Math.sin(t) * r)}`;
  return `M${p(phi + a)} A${r} ${r} 0 ${a < Math.PI / 2 ? 1 : 0} 1 ${p(phi - a)} A${hr} ${hr} 0 0 0 ${p(phi + a)} Z`;
}

/** Puffy outline (cloud, wool, petals): k bumps around an ellipse. */
function fluffy(cx: number, cy: number, rx: number, ry: number, k: number, start = -90) {
  const pts = Array.from({ length: k }, (_, i) => {
    const t = ((start + (i * 360) / k) * Math.PI) / 180;
    return [n(cx + Math.cos(t) * rx), n(cy + Math.sin(t) * ry)];
  });
  return `M${pts[0].join(' ')} ` + pts.map((_, i) => {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % k];
    const r = n(Math.hypot(x1 - x0, y1 - y0) * 0.6);
    return `A${r} ${r} 0 0 1 ${x1} ${y1}`;
  }).join(' ') + ' Z';
}

function star(cx: number, cy: number, R: number, r: number, k = 5) {
  return Array.from({ length: k * 2 }, (_, i) => {
    const t = -Math.PI / 2 + (i * Math.PI) / k;
    const rr = i % 2 ? r : R;
    return `${i ? 'L' : 'M'}${n(cx + Math.cos(t) * rr)} ${n(cy + Math.sin(t) * rr)}`;
  }).join(' ') + ' Z';
}

/** Polar outline: radius R wobbling by amp, k waves around. */
function wavy(cx: number, cy: number, R: number, amp: number, k: number) {
  return Array.from({ length: 96 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const rr = R + amp * Math.sin(k * t);
    return `${i ? 'L' : 'M'}${n(cx + Math.cos(t) * rr)} ${n(cy + Math.sin(t) * rr)}`;
  }).join(' ') + ' Z';
}

function spiral(cx: number, cy: number, R: number, turns: number) {
  return Array.from({ length: 90 }, (_, i) => {
    const f = i / 89;
    const t = f * turns * Math.PI * 2;
    return `${i ? 'L' : 'M'}${n(cx + Math.cos(t) * R * f)} ${n(cy + Math.sin(t) * R * f)}`;
  }).join(' ');
}

const heart = (cx: number, cy: number, s: number) => {
  const P = (x: number, y: number) => `${n(cx + x * s)} ${n(cy + y * s)}`;
  return `M${P(0, 110)} C${P(-140, 20)} ${P(-130, -100)} ${P(-60, -105)} Q${P(-15, -108)} ${P(0, -60)} ` +
    `Q${P(15, -108)} ${P(60, -105)} C${P(130, -100)} ${P(140, 20)} ${P(0, 110)} Z`;
};

/** Criss-cross lines kept inside an ellipse (pineapple skin). */
function hatch(cx: number, cy: number, rx: number, ry: number, gap: number) {
  const out: string[] = [];
  for (const s of [1, -1]) {
    for (let c = -rx * 2; c <= rx * 2; c += gap) {
      // Points (cx + t + c/2, cy + s(t - c/2)) along a 45° line.
      const ox = c / 2, oy = -s * c / 2;
      const A = 1 / rx ** 2 + 1 / ry ** 2;
      const B = 2 * (ox / rx ** 2 + s * oy / ry ** 2);
      const D = B * B - 4 * A * (ox ** 2 / rx ** 2 + oy ** 2 / ry ** 2 - 0.85);
      if (D <= 0) continue;
      const [t0, t1] = [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)];
      if (t1 - t0 < 20) continue;
      out.push(`M${n(cx + ox + t0)} ${n(cy + oy + s * t0)} L${n(cx + ox + t1)} ${n(cy + oy + s * t1)}`);
    }
  }
  return out.join(' ');
}

/** Bottom edge of a vehicle body, running right to left, arching over a wheel at x = cx. */
const arch = (cx: number, y: number, r: number) => `H${cx + r} A${r} ${r} 0 0 0 ${cx - r} ${y}`;
const wheels = (y: number, r: number, ...xs: number[]) => xs.map((x) => circle(x, y, r)).join(' ');

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

// Shapes shared by more than one object.
const carBody = `M70 270 V220 Q70 205 85 205 H315 Q330 205 330 220 V270 ${arch(255, 270, 35)} ${arch(145, 270, 35)} Z`;
const carCab = 'M115 205 L150 145 H250 L290 205 Z';
const carWindows = 'M138 198 L160 158 H195 V198 Z M205 158 H243 L267 198 H205 Z';
const carWheels = wheels(272, 27, 145, 255);
const drips = 'Q112 252 134 222 Q156 252 178 222 Q200 252 222 222 Q244 252 266 222 Q288 252 310 222';
const dripsBack = 'Q288 252 266 222 Q244 252 222 222 Q200 252 178 222 Q156 252 134 222 Q112 252 90 222';
const donutHole = circle(200, 205, 42);
const sprinkles = Array.from({ length: 12 }, (_, i) => {
  const a = ((i * 30 + 12) * Math.PI) / 180;
  const r = i % 2 ? 62 : 86;
  const t = a + 1.2;
  return `M${n(200 + Math.cos(a) * r)} ${n(205 + Math.sin(a) * r)} l${n(Math.cos(t) * 12)} ${n(Math.sin(t) * 12)}`;
}).join(' ');
const candleFlame = (x: number) => `M${x} 105 Q${x + 13} 125 ${x} 135 Q${x - 13} 125 ${x} 105 Z`;
const drop = (x: number, y: number) => `M${x} ${y} Q${x + 16} ${y + 27} ${x} ${y + 37} Q${x - 16} ${y + 27} ${x} ${y} Z`;

// Each colored shape also supplies its trace outline. Extra strokes add details
// such as a balloon string or the veins of a leaf.
function objectLevel(name: string, tool: ColorTool, regions: Region[], ...details: string[]): Level {
  return {
    name,
    tool,
    regions,
    layered: true,
    lines: [...regions.map(region => region.d), ...details],
    palette: [...new Set([...regions.map(region => region.color), C.red, C.yellow, C.green, C.sky, C.purple, C.pink])],
  };
}

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
  objectLevel('Balloon', 'marker', [
    { d: 'M200 260 C168 244 116 211 116 155 C116 45 284 45 284 155 C284 211 232 244 200 260 Z', color: C.red },
    { d: 'M200 260 L185 283 H215 Z', color: C.pink },
  ], 'M200 283 C232 310 166 322 195 357'),
  objectLevel('Sailboat', 'crayon', [
    { d: 'M73 251 H327 L285 306 H119 Z', color: C.blue },
    { d: 'M192 83 V233 H86 Z', color: C.cream },
    { d: 'M211 112 L303 232 H211 Z', color: C.orange },
  ], 'M202 78 V249'),
  objectLevel('Carrot', 'paintstick', [
    { d: 'M128 323 Q100 320 156 181 Q184 115 224 153 Q267 184 214 231 Q150 309 128 323 Z', color: C.orange },
    { d: 'M218 149 Q204 105 226 78 Q245 92 238 126 Q261 76 288 83 Q287 110 255 136 Q282 115 300 129 Q279 159 236 165 Z', color: C.green },
  ], 'M160 179 L181 189 M188 238 L170 229'),
  objectLevel('Mushroom', 'crayon', [
    { d: 'M169 204 H230 L249 305 Q204 330 152 305 Z', color: C.cream },
    { d: 'M72 204 Q120 79 200 82 Q282 77 328 204 Q205 245 72 204 Z', color: C.red },
    { d: circle(190, 139, 23), color: C.white },
    { d: circle(258, 171, 17), color: C.yellow },
  ]),
  objectLevel('Kite', 'marker', [
    { d: 'M200 60 L297 160 H200 Z', color: C.yellow },
    { d: 'M200 60 V160 H103 Z', color: C.red },
    { d: 'M103 160 H200 V276 Z', color: C.blue },
    { d: 'M200 160 H297 L200 276 Z', color: C.green },
  ], 'M200 276 C204 303 252 292 247 324 Q244 349 219 346'),
  objectLevel('Fish', 'paintstick', [
    { d: 'M145 202 L75 141 Q90 198 75 259 Z', color: C.orange },
    { d: 'M138 202 Q197 90 318 194 Q248 304 138 202 Z', color: C.sky },
    { d: circle(268, 185, 14), color: C.navy },
  ], 'M245 166 Q221 201 246 227'),
  objectLevel('Cupcake', 'crayon', [
    { d: 'M112 218 H288 L261 317 H139 Z', color: C.purple },
    { d: 'M100 214 Q83 177 127 159 Q123 126 165 120 Q184 117 190 82 Q240 92 244 132 Q279 134 278 166 Q319 180 299 214 Q280 239 253 216 Q227 240 200 218 Q169 243 145 216 Q117 237 100 214 Z', color: C.pink },
  ], 'M151 249 L161 290 M200 249 V294 M249 249 L239 290'),
  objectLevel('Pencil', 'marker', [
    { d: 'M100 257 L247 110 L288 151 L141 298 Z', color: C.yellow },
    { d: 'M247 110 L266 91 Q275 82 286 93 L305 112 Q317 124 307 132 L288 151 Z', color: C.pink },
    { d: 'M100 257 L141 298 L77 321 Z', color: C.tan },
    { d: 'M88 291 L107 310 L77 321 Z', color: C.black },
  ]),
  objectLevel('Tulip', 'paintstick', [
    { d: 'M140 94 L173 126 L200 77 L227 126 L260 94 V159 Q259 215 200 219 Q141 215 140 159 Z', color: C.pink },
    { d: 'M199 322 Q136 322 119 254 Q185 262 199 322 Z', color: C.green },
    { d: 'M201 302 Q216 237 279 229 Q268 285 201 302 Z', color: C.mint },
  ], 'M200 219 V334'),
  objectLevel('Ladybug', 'crayon', [
    { d: 'M148 135 C139 58 261 58 252 135 Q200 109 148 135 Z', color: C.black },
    { d: 'M200 122 C87 122 84 313 200 322 C316 313 313 122 200 122 Z', color: C.red },
    { d: circle(158, 200, 18), color: C.black },
    { d: circle(244, 233, 21), color: C.black },
  ], 'M200 124 V319', 'M167 90 Q144 70 148 55 M233 90 Q256 70 252 55'),
  objectLevel('Rainbow', 'marker', [
    { d: 'M59 271 A141 141 0 0 1 341 271 H307 A107 107 0 0 0 93 271 Z', color: C.red },
    { d: 'M93 271 A107 107 0 0 1 307 271 H274 A74 74 0 0 0 126 271 Z', color: C.yellow },
    { d: 'M126 271 A74 74 0 0 1 274 271 H241 A41 41 0 0 0 159 271 Z', color: C.green },
  ]),
  objectLevel('Leaf', 'crayon', [
    { d: 'M113 281 Q71 112 304 75 Q325 267 113 281 Z', color: C.green },
  ], 'M83 318 L277 105', 'M171 220 L155 163 M202 188 L260 176'),
  objectLevel('Umbrella', 'paintstick', [
    { d: 'M64 212 Q86 105 200 92 Q314 105 336 212 Q302 187 266 212 Q231 184 200 211 Q166 185 132 212 Q98 187 64 212 Z', color: C.sky },
  ], 'M132 211 Q141 140 200 94 Q253 140 266 211', 'M200 212 V286 C200 331 144 332 144 293'),
  objectLevel('Watermelon', 'marker', [
    { d: 'M59 144 H341 C319 335 81 335 59 144 Z', color: C.green },
    { d: 'M82 144 H318 C294 302 106 302 82 144 Z', color: C.red },
  ], 'M144 177 L150 189 M201 206 V220 M256 177 L250 189'),
  objectLevel('Christmas Tree', 'crayon', [
    { d: rect(174, 269, 52, 67), color: C.wood },
    { d: 'M200 60 L267 154 H240 L291 219 H262 L321 283 H79 L138 219 H109 L160 154 H133 Z', color: C.forest },
    { d: circle(174, 185, 16), color: C.red },
    { d: circle(224, 245, 18), color: C.gold },
  ]),
  objectLevel('Mitten', 'paintstick', [
    { d: 'M147 264 L97 186 Q81 152 108 142 Q127 135 151 168 L147 128 C140 55 244 45 262 113 Q285 173 247 264 Z', color: C.red },
    { d: rect(143, 264, 107, 48), color: C.cream },
  ], 'M165 276 V301 M194 276 V301 M226 276 V301'),
  objectLevel('Ornament', 'marker', [
    { d: circle(200, 222, 99), color: C.blue },
    { d: rect(174, 94, 52, 33), color: C.gold },
    { d: 'M113 209 Q155 239 201 214 T288 208 L289 232 Q249 209 202 239 T112 233 Z', color: C.mint },
  ], 'M184 94 C159 43 238 41 216 94'),
  objectLevel('Present', 'crayon', [
    { d: rect(97, 185, 206, 125), color: C.green },
    { d: rect(84, 149, 232, 41), color: C.red },
    { d: rect(180, 149, 40, 161), color: C.yellow },
    { d: 'M200 149 C90 149 117 48 169 95 Q188 112 200 149 Z', color: C.gold },
    { d: 'M200 149 C310 149 283 48 231 95 Q212 112 200 149 Z', color: C.gold },
  ]),
  objectLevel('Bell', 'paintstick', [
    { d: circle(200, 277, 28), color: C.orange },
    { d: 'M89 265 Q124 235 130 169 Q132 107 200 99 Q268 107 270 169 Q276 235 311 265 Q200 300 89 265 Z', color: C.gold },
  ], 'M178 104 C170 66 230 66 222 104', 'M121 250 Q200 271 279 250'),
  objectLevel('Stocking', 'marker', [
    { d: 'M169 145 H267 V247 Q267 278 237 291 L160 324 Q105 346 89 304 Q74 265 118 246 L169 225 Z', color: C.red },
    { d: 'M151 102 Q151 89 166 89 H271 Q285 89 285 103 V143 Q285 157 271 157 H166 Q151 157 151 143 Z', color: C.cream },
  ], 'M97 263 Q137 266 145 324', 'M264 238 Q227 240 222 297'),
  objectLevel('Car', 'marker', [
    { d: carBody, color: C.red },
    { d: carCab, color: C.red },
    { d: carWindows, color: C.sky },
    { d: carWheels, color: C.black },
  ], 'M200 212 V250'),
  objectLevel('Cat', 'crayon', [
    { d: 'M110 250 Q100 150 130 120 L125 60 L180 105 Q200 100 220 105 L275 60 L270 120 Q300 150 290 250 Q280 320 200 320 Q120 320 110 250 Z', color: C.orange },
    { d: 'M137 110 L135 80 L165 103 Z M263 110 L265 80 L235 103 Z', color: C.pink },
    { d: wheels(200, 14, 165, 235), color: C.green },
    { d: 'M188 232 H212 L200 247 Z', color: C.pink },
  ], 'M200 247 Q192 266 176 260 M200 247 Q208 266 224 260', 'M150 245 H100 M150 258 L104 272 M250 245 H300 M250 258 L296 272'),
  objectLevel('Star', 'paintstick', [
    { d: star(200, 210, 150, 62), color: C.yellow },
    { d: wheels(195, 10, 178, 222), color: C.black },
  ], 'M180 228 Q200 245 220 228'),
  objectLevel('Banana', 'marker', [
    { d: 'M95 140 Q100 300 310 270 Q330 265 325 250 Q180 265 128 135 Z', color: C.yellow },
    { d: 'M95 140 L128 135 L120 100 H100 Z', color: C.brown },
  ], 'M112 180 Q132 255 230 268'),
  objectLevel('Fire Truck', 'crayon', [
    { d: `M50 280 V190 H250 V145 H310 L350 200 V280 ${arch(285, 280, 30)} ${arch(115, 280, 30)} Z`, color: C.red },
    { d: 'M262 158 H303 L333 200 H262 Z', color: C.sky },
    { d: rect(60, 162, 175, 18), color: C.gray },
    { d: 'M268 145 V132 Q280 118 292 132 V145 Z', color: C.blue },
    { d: wheels(282, 25, 115, 285), color: C.black },
  ], 'M90 162 V180 M120 162 V180 M150 162 V180 M180 162 V180 M210 162 V180 M100 180 V190 M200 180 V190'),
  objectLevel('Dog', 'paintstick', [
    { d: ellipse(200, 210, 95, 90), color: C.tan },
    {
      d: 'M133 146 Q70 130 72 240 Q95 270 102 228 Q100 210 106.5 194 A95 90 0 0 1 133 146 Z ' +
        'M267 146 Q330 130 328 240 Q305 270 298 228 Q300 210 293.5 194 A95 90 0 0 0 267 146 Z',
      color: C.brown,
    },
    { d: ellipse(200, 250, 45, 35), color: C.cream },
    { d: ellipse(200, 232, 16, 11), color: C.black },
    { d: wheels(190, 12, 165, 235), color: C.black },
  ], 'M200 243 V262 M182 268 Q200 280 218 268'),
  objectLevel('Heart', 'marker', [
    { d: heart(200, 220, 1), color: C.red },
    { d: heart(200, 212, 0.45), color: C.pink },
  ]),
  objectLevel('Strawberry', 'crayon', [
    { d: 'M140 125 Q200 140 260 125 Q305 140 300 200 Q290 280 200 330 Q110 280 100 200 Q95 140 140 125 Z', color: C.red },
    { d: 'M140 125 L150 95 L178 112 L200 80 L222 112 L250 95 L260 125 Q200 140 140 125 Z', color: C.green },
  ], 'M200 80 Q198 65 208 55', 'M160 180 l5 9 M215 175 l5 9 M255 195 l5 9 M135 215 l5 9 M190 225 l5 9 M240 245 l5 9 M165 270 l5 9 M210 290 l5 9'),
  objectLevel('Airplane', 'paintstick', [
    { d: 'M50 210 Q50 180 90 180 H300 Q350 182 355 205 Q350 228 300 230 H90 Q50 230 50 210 Z', color: C.sky },
    { d: 'M75 184 L58 110 H98 L135 180 Z', color: C.red },
    { d: 'M170 230 H250 L195 305 H160 Z', color: C.red },
    { d: wheels(204, 11, 190, 225, 260), color: C.yellow },
    { d: 'M305 186 Q335 190 343 200 H305 Z', color: C.navy },
  ]),
  objectLevel('Bunny', 'marker', [
    { d: circle(200, 250, 80), color: C.white },
    { d: 'M166.2 177.5 C120 60 190 40 193 170.3 A80 80 0 0 0 166.2 177.5 Z M233.8 177.5 C280 60 210 40 207 170.3 A80 80 0 0 1 233.8 177.5 Z', color: C.white },
    { d: `${ellipse(165, 118, 11, 35)} ${ellipse(235, 118, 11, 35)}`, color: C.pink },
    { d: wheels(235, 9, 172, 228), color: C.black },
    { d: 'M192 258 H208 L200 267 Z', color: C.pink },
    { d: rect(191, 280, 18, 15), color: C.white },
  ], 'M200 267 V280 M182 276 Q191 282 200 280 Q209 282 218 276'),
  objectLevel('Robot', 'crayon', [
    { d: rrect(130, 80, 140, 100, 20), color: C.gray },
    { d: wheels(130, 16, 170, 230), color: C.yellow },
    { d: circle(200, 42, 12), color: C.red },
    { d: rrect(110, 195, 180, 130, 20), color: C.blue },
    { d: rrect(160, 225, 80, 60, 10), color: C.mint },
    { d: `${rrect(70, 210, 30, 90, 15)} ${rrect(300, 210, 30, 90, 15)} ${rect(140, 325, 40, 35)} ${rect(220, 325, 40, 35)}`, color: C.gray },
  ], 'M200 80 V54 M185 180 V195 M215 180 V195', 'M175 160 H225'),
  objectLevel('Pizza', 'paintstick', [
    { d: 'M70 110 Q200 70 330 110 L315 140 Q200 105 85 140 Z', color: C.tan },
    { d: 'M85 140 Q200 105 315 140 L200 340 Z', color: C.yellow },
    { d: `${circle(165, 170, 20)} ${circle(238, 178, 18)} ${circle(200, 245, 18)}`, color: C.red },
  ]),
  objectLevel('Dump Truck', 'marker', [
    { d: `M55 275 V225 H250 V140 H310 L345 190 V275 ${arch(280, 275, 30)} ${arch(120, 275, 30)} Z`, color: C.yellow },
    { d: 'M45 225 L60 120 H235 V225 Z', color: C.orange },
    { d: 'M265 155 H303 L330 190 H265 Z', color: C.sky },
    { d: wheels(277, 25, 120, 280), color: C.black },
  ], 'M100 140 V205 M145 140 V205 M190 140 V205'),
  objectLevel('Pig', 'crayon', [
    { d: circle(200, 215, 100), color: C.pink },
    { d: 'M135.7 138.4 L115 82 L174.1 118.4 A100 100 0 0 0 135.7 138.4 Z M264.3 138.4 L285 82 L225.9 118.4 A100 100 0 0 1 264.3 138.4 Z', color: C.pink },
    { d: ellipse(200, 245, 48, 34), color: C.peach },
    { d: `${ellipse(184, 245, 7, 12)} ${ellipse(216, 245, 7, 12)}`, color: C.black },
    { d: wheels(190, 11, 160, 240), color: C.black },
  ], 'M175 292 Q200 305 225 292'),
  objectLevel('Moon', 'paintstick', [
    { d: bump(190, 205, 130, 255, 165, 110), color: C.gold },
    { d: star(330, 95, 32, 13), color: C.yellow },
  ], 'M102 195 Q114 205 126 195', 'M95 245 Q110 257 128 250'),
  objectLevel('Donut', 'marker', [
    { d: circle(200, 205, 130), color: C.tan, minus: [donutHole] },
    { d: wavy(200, 205, 108, 9, 10), color: C.pink, minus: [donutHole] },
  ], donutHole, sprinkles),
  objectLevel('Train', 'crayon', [
    { d: 'M70 255 V190 H230 V110 H335 V255 Z', color: C.blue },
    { d: rect(220, 92, 125, 18), color: C.red },
    { d: 'M100 190 L92 145 H138 L130 190 Z', color: C.black },
    { d: rect(255, 130, 55, 50), color: C.yellow },
    { d: 'M70 215 L38 255 H70 Z', color: C.red },
    { d: wheels(282, 25, 110, 180, 285), color: C.black },
    { d: fluffy(132, 100, 30, 20, 6), color: C.gray },
  ]),
  objectLevel('Duck', 'paintstick', [
    { d: bump(185, 255, 95, 270, 165, 55), color: C.yellow },
    { d: circle(270, 165, 55), color: C.yellow },
    { d: 'M323.8 153.6 Q367 158 370 172 Q355 192 322.3 182 A55 55 0 0 0 323.8 153.6 Z', color: C.orange },
    { d: circle(283, 150, 9), color: C.black },
    { d: 'M120 255 Q165 215 230 245 Q200 295 135 285 Z', color: C.gold },
  ]),
  objectLevel('Castle', 'marker', [
    { d: `${rect(70, 150, 60, 180)} ${rect(270, 150, 60, 180)}`, color: C.gray },
    { d: 'M60 150 L100 70 L140 150 Z M260 150 L300 70 L340 150 Z', color: C.blue },
    { d: 'M130 330 V200 H150 V185 H170 V200 H190 V185 H210 V200 H230 V185 H250 V200 H270 V330 Z', color: C.tan },
    { d: 'M170 330 V280 Q170 250 200 250 Q230 250 230 280 V330 Z', color: C.brown },
    { d: `${rect(88, 190, 24, 34)} ${rect(288, 190, 24, 34)}`, color: C.yellow },
    { d: 'M300 40 L332 50 L300 60 Z', color: C.red },
  ], 'M300 70 V40'),
  objectLevel('Lollipop', 'crayon', [
    { d: circle(200, 150, 95), color: C.pink },
    { d: rect(190, 245, 20, 110), color: C.cream },
  ], spiral(200, 150, 80, 2.5)),
  objectLevel('Bus', 'paintstick', [
    { d: `M55 280 V140 Q55 120 75 120 H320 Q345 120 345 145 V280 ${arch(280, 280, 30)} ${arch(120, 280, 30)} Z`, color: C.yellow },
    { d: [rect(75, 140, 50, 45), rect(140, 140, 50, 45), rect(205, 140, 50, 45), rrect(270, 140, 58, 60, 6)].join(' '), color: C.sky },
    { d: rect(55, 215, 290, 14), color: C.orange },
    { d: wheels(282, 25, 120, 280), color: C.black },
  ]),
  objectLevel('Owl', 'marker', [
    { d: 'M110 300 Q90 200 120 120 L140 80 L175 115 Q200 108 225 115 L260 80 L280 120 Q310 200 290 300 Q200 330 110 300 Z', color: C.brown },
    { d: ellipse(200, 262, 58, 45), color: C.cream },
    { d: wheels(170, 32, 160, 240), color: C.white },
    { d: wheels(170, 13, 160, 240), color: C.black },
    { d: 'M188 195 H212 L200 216 Z', color: C.orange },
  ], 'M125 205 Q142 250 125 290 M275 205 Q258 250 275 290'),
  objectLevel('Flower', 'crayon', [
    { d: fluffy(200, 160, 80, 80, 6), color: C.pink },
    { d: circle(200, 160, 38), color: C.yellow },
    { d: 'M200 315 Q150 325 135 285 Q180 280 200 315 Z M200 300 Q250 310 265 270 Q220 265 200 300 Z', color: C.green },
  ], 'M200 240 V350'),
  objectLevel('Birthday Cake', 'paintstick', [
    { d: rrect(65, 320, 270, 16, 8), color: C.gray },
    { d: `M90 222 ${drips} V320 H90 Z`, color: C.pink },
    { d: `M90 222 V205 Q90 185 110 185 H290 Q310 185 310 205 V222 ${dripsBack} Z`, color: C.white },
    { d: `${rect(147, 140, 16, 45)} ${rect(192, 140, 16, 45)} ${rect(237, 140, 16, 45)}`, color: C.blue },
    { d: `${candleFlame(155)} ${candleFlame(200)} ${candleFlame(245)}`, color: C.yellow },
  ]),
  objectLevel('Helicopter', 'marker', [
    { d: 'M110 200 Q110 140 190 140 Q250 140 270 180 H345 L355 150 H370 V215 H345 V205 H270 Q250 255 190 255 Q110 255 110 200 Z', color: C.orange },
    { d: 'M130 195 Q135 162 180 160 V195 Z', color: C.sky },
    { d: `${rect(95, 112, 200, 12)} ${rect(186, 124, 10, 17)}`, color: C.gray },
  ], 'M130 285 H270 M165 253 V285 M235 240 V285'),
  objectLevel('Penguin', 'crayon', [
    { d: 'M200 70 Q290 70 290 200 Q295 300 250 320 H150 Q105 300 110 200 Q110 70 200 70 Z', color: C.navy },
    { d: 'M200 120 Q260 125 255 210 Q255 300 200 305 Q145 300 145 210 Q140 125 200 120 Z', color: C.white },
    { d: wheels(155, 9, 180, 220), color: C.black },
    { d: 'M186 172 H214 L200 192 Z', color: C.orange },
    { d: 'M150 320 H195 Q198 342 172 342 Q145 342 150 320 Z M205 320 H250 Q255 342 228 342 Q202 342 205 320 Z', color: C.orange },
  ], 'M115 170 Q80 230 112 260 M285 170 Q320 230 288 260'),
  objectLevel('Snowman', 'paintstick', [
    { d: bump(200, 280, 80, 200, 155, 58), color: C.white },
    { d: circle(200, 155, 58), color: C.white },
    { d: 'M165 85 V35 H235 V85 H260 V97 H140 V85 Z', color: C.black },
    { d: 'M200 160 L245 170 L200 176 Z', color: C.orange },
    { d: [circle(180, 142, 7), circle(220, 142, 7), circle(200, 240, 9), circle(200, 275, 9), circle(200, 310, 9)].join(' '), color: C.black },
  ], 'M124 262 L72 222 M276 262 L328 222'),
  objectLevel('Pear', 'marker', [
    { d: 'M200 110 Q235 110 238 165 Q240 200 280 240 Q300 330 200 330 Q100 330 120 240 Q160 200 162 165 Q165 110 200 110 Z', color: C.green },
    { d: 'M206 95 Q238 68 268 82 Q240 110 206 95 Z', color: C.forest },
  ], 'M200 110 Q200 85 212 72'),
  objectLevel('Race Car', 'crayon', [
    { d: `M50 262 Q52 230 90 225 L170 215 Q190 180 230 182 L252 215 L330 220 Q355 222 352 262 ${arch(282, 262, 33)} ${arch(118, 262, 33)} Z`, color: C.red },
    { d: 'M300 218 L306 168 H352 V182 L330 220 Z', color: C.yellow },
    { d: 'M184 214 Q198 198 224 198 L236 214 Z', color: C.sky },
    { d: circle(200, 243, 14), color: C.white },
    { d: wheels(264, 27, 118, 282), color: C.black },
  ], 'M196 236 L202 232 V252'),
  objectLevel('Frog', 'paintstick', [
    { d: 'M80 260 Q80 205 105 180 A38 38 0 1 1 176 177 Q200 172 224 177 A38 38 0 1 1 295 180 Q320 205 320 260 Q320 320 200 320 Q80 320 80 260 Z', color: C.green },
    { d: wheels(162, 22, 140, 260), color: C.white },
    { d: wheels(162, 10, 140, 260), color: C.black },
    { d: wheels(268, 14, 118, 282), color: C.pink },
  ], 'M135 245 Q200 295 265 245'),
  objectLevel('Beach Ball', 'marker', [
    { d: 'M200 70 A130 130 0 0 0 200 330 Q120 200 200 70 Z', color: C.red },
    { d: 'M200 70 Q120 200 200 330 Q280 200 200 70 Z', color: C.yellow },
    { d: 'M200 70 Q280 200 200 330 A130 130 0 0 0 200 70 Z', color: C.blue },
  ]),
  objectLevel('Cherries', 'crayon', [
    { d: `${circle(145, 270, 50)} ${circle(260, 262, 50)}`, color: C.red },
    { d: 'M215 95 Q250 58 288 72 Q262 110 215 95 Z', color: C.green },
  ], 'M150 220 Q170 140 215 95 M255 212 Q240 140 215 95'),
  objectLevel('Space Rocket', 'paintstick', [
    { d: 'M200 50 Q240 80 245 130 H155 Q160 80 200 50 Z', color: C.red },
    { d: rect(155, 130, 90, 160), color: C.white },
    { d: circle(200, 185, 24), color: C.sky },
    { d: 'M155 200 L115 240 V300 H155 Z M245 200 L285 240 V300 H245 Z', color: C.blue },
    { d: 'M165 290 Q175 330 200 360 Q225 330 235 290 Z', color: C.orange },
  ], 'M155 245 H245'),
  objectLevel('Turtle', 'marker', [
    { d: 'M110 267 H150 V300 Q130 312 110 300 Z M250 267 H290 V300 Q270 312 250 300 Z', color: C.mint },
    { d: circle(342, 238, 28), color: C.mint },
    { d: 'M90 250 Q95 130 200 125 Q305 130 310 250 Z', color: C.green },
    { d: rrect(80, 245, 240, 22, 11), color: C.yellow },
    { d: 'M175 160 H225 L248 200 L225 240 H175 L152 200 Z', color: C.forest },
    { d: circle(350, 230, 6), color: C.black },
  ]),
  objectLevel('Crown', 'crayon', [
    { d: 'M80 300 V140 L140 200 L200 110 L260 200 L320 140 V300 Z', color: C.gold },
    { d: rect(80, 250, 240, 50), color: C.red },
    { d: wheels(275, 12, 140, 200, 260), color: C.blue },
    { d: `${circle(80, 128, 12)} ${circle(200, 98, 12)} ${circle(320, 128, 12)}`, color: C.pink },
  ]),
  objectLevel('Popsicle', 'paintstick', [
    { d: 'M130 300 V130 Q130 70 200 70 Q270 70 270 130 V300 Z', color: C.pink },
    { d: rect(130, 230, 140, 70), color: C.mint },
    { d: 'M180 300 H220 V345 Q220 360 200 360 Q180 360 180 345 Z', color: C.wood },
  ]),
  objectLevel('Tractor', 'marker', [
    { d: 'M115 198 V105 H215 V185 H335 Q348 185 348 198 V242 H222 V198 Z', color: C.green },
    { d: rect(135, 120, 62, 50), color: C.sky },
    { d: rect(290, 150, 12, 35), color: C.black },
    { d: `${circle(160, 262, 58)} ${circle(300, 282, 36)}`, color: C.black },
    { d: `${circle(160, 262, 22)} ${circle(300, 282, 13)}`, color: C.yellow },
  ]),
  objectLevel('Butterfly', 'crayon', [
    { d: 'M188 185 Q120 60 75 105 Q45 170 188 205 Z M212 185 Q280 60 325 105 Q355 170 212 205 Z', color: C.purple },
    { d: 'M188 215 Q65 215 95 290 Q135 325 188 240 Z M212 215 Q335 215 305 290 Q265 325 212 240 Z', color: C.pink },
    { d: wheels(135, 16, 125, 275), color: C.yellow },
    { d: rrect(188, 140, 24, 150, 12), color: C.black },
  ], 'M195 142 Q185 110 165 100 M205 142 Q215 110 235 100'),
  objectLevel('Cloud', 'paintstick', [
    { d: 'M90 270 A45 45 0 0 1 110 190 A60 60 0 0 1 210 150 A55 55 0 0 1 300 190 A45 45 0 0 1 320 270 Z', color: C.gray },
    { d: `${drop(150, 295)} ${drop(205, 312)} ${drop(260, 295)}`, color: C.blue },
    { d: wheels(220, 8, 180, 230), color: C.black },
  ], 'M188 240 Q205 252 222 240'),
  objectLevel('Burger', 'marker', [
    { d: 'M80 200 Q80 100 200 100 Q320 100 320 200 Z', color: C.tan },
    { d: 'M78 200 H322 V215 Q305 230 288 215 Q271 230 254 215 Q237 230 220 215 Q203 230 186 215 Q169 230 152 215 Q135 230 118 215 Q101 230 84 215 L78 215 Z', color: C.green },
    { d: 'M85 223 H315 Q330 223 330 243 Q330 263 315 263 H85 Q70 263 70 243 Q70 223 85 223 Z', color: C.brown },
    { d: 'M80 263 H320 V285 Q320 310 295 310 H105 Q80 310 80 285 Z', color: C.tan },
  ], 'M150 140 l9 -4 M200 125 l9 -4 M250 140 l9 -4 M175 170 l9 -4 M230 168 l9 -4'),
  objectLevel('Submarine', 'crayon', [
    { d: 'M80 230 Q80 175 140 175 H270 Q330 175 330 230 Q330 285 270 285 H140 Q80 285 80 230 Z', color: C.yellow },
    { d: 'M175 175 V130 H245 V175 Z', color: C.orange },
    { d: wheels(230, 17, 140, 200, 260), color: C.sky },
    { d: 'M328 230 L360 200 V260 Z', color: C.gray },
  ], 'M225 130 V95 H255'),
  objectLevel('Bee', 'paintstick', [
    { d: ellipse(200, 230, 95, 70), color: C.yellow },
    { d: 'M165 164.9 A95 70 0 0 1 190 160.4 V299.6 A95 70 0 0 1 165 295.1 Z M220 161.6 A95 70 0 0 1 245 168.4 V291.6 A95 70 0 0 1 220 298.4 Z', color: C.black },
    { d: 'M150 170.5 Q110 80 160 75 Q205 75 190 160.4 A95 70 0 0 0 150 170.5 Z M210 160.4 Q195 75 240 75 Q290 80 250 170.5 A95 70 0 0 0 210 160.4 Z', color: C.sky },
    { d: circle(268, 215, 10), color: C.black },
    { d: 'M105 230 L78 220 V240 Z', color: C.black },
  ], 'M258 248 Q272 258 286 246', 'M262 177 Q268 135 292 125'),
  objectLevel('Tree', 'marker', [
    { d: 'M178 340 V267.7 A105 105 0 0 0 222 267.7 V340 Z', color: C.wood },
    { d: circle(200, 165, 105), color: C.green },
    { d: [circle(160, 150, 14), circle(240, 185, 14), circle(200, 105, 14), circle(150, 215, 14)].join(' '), color: C.red },
  ], 'M110 340 H290'),
  objectLevel('Grapes', 'crayon', [
    { d: `${wheels(150, 32, 136, 200, 264)} ${wheels(206, 32, 168, 232)} ${circle(200, 262, 32)}`, color: C.purple },
    { d: 'M200 116 Q165 70 125 86 Q148 122 200 116 Z', color: C.green },
  ], 'M200 116 Q204 92 222 80'),
  objectLevel('Police Car', 'paintstick', [
    { d: carBody, color: C.navy },
    { d: carCab, color: C.white },
    { d: carWindows, color: C.sky },
    { d: rect(180, 130, 20, 15), color: C.red },
    { d: rect(200, 130, 20, 15), color: C.blue },
    { d: carWheels, color: C.black },
  ], 'M200 212 V250'),
  objectLevel('Elephant', 'marker', [
    { d: 'M140 120 Q60 90 40 190 Q45 280 145 230 Q115 180 140 120 Z M260 120 Q340 90 360 190 Q355 280 255 230 Q285 180 260 120 Z', color: C.gray },
    { d: `${ellipse(92, 182, 28, 48)} ${ellipse(308, 182, 28, 48)}`, color: C.pink },
    {
      d: 'M140 120 Q200 90 260 120 Q285 180 255 230 Q225 255 225 290 Q225 330 250 335 Q262 350 240 352 Q192 348 178 290 Q175 255 145 230 Q115 180 140 120 Z',
      color: C.gray,
    },
    { d: wheels(165, 10, 175, 225), color: C.black },
  ]),
  objectLevel('Drum', 'crayon', [
    { d: 'M90 140 V280 Q90 320 200 320 Q310 320 310 280 V140 A110 35 0 0 1 90 140 Z', color: C.red },
    { d: ellipse(200, 140, 110, 35), color: C.white },
    { d: `${circle(72, 42, 11)} ${circle(328, 42, 11)}`, color: C.wood },
  ], 'M90 190 L127 290 L164 190 L200 297 L236 190 L273 290 L310 190', 'M150 100 L80 48 M250 100 L320 48'),
  objectLevel('Pineapple', 'paintstick', [
    { d: ellipse(200, 250, 85, 105), color: C.gold },
    { d: 'M160 157.4 L130 80 L178 118 L200 40 L222 118 L270 80 L240 157.4 A85 105 0 0 0 160 157.4 Z', color: C.green },
  ], hatch(200, 250, 85, 105, 38)),
  objectLevel('Digger', 'marker', [
    { d: rrect(60, 260, 190, 50, 25), color: C.black },
    { d: 'M80 260 V200 H170 V140 H240 V260 Z', color: C.yellow },
    { d: rect(185, 155, 40, 40), color: C.sky },
    { d: 'M240 215 L300 110 Q312 100 324 112 L340 200 H318 L306 140 L240 245 Z', color: C.orange },
    { d: 'M310 200 H352 L345 255 Q320 265 305 245 Z', color: C.gray },
  ], wheels(285, 13, 92, 155, 218)),
  objectLevel('Lion', 'crayon', [
    { d: fluffy(200, 205, 130, 125, 14), color: C.orange },
    { d: circle(200, 210, 80), color: C.yellow },
    { d: `${bump(145, 140, 25, 200, 210, 80)} ${bump(255, 140, 25, 200, 210, 80)}`, color: C.yellow },
    { d: ellipse(200, 248, 40, 28), color: C.cream },
    { d: 'M186 230 H214 L200 245 Z', color: C.brown },
    { d: wheels(198, 9, 170, 230), color: C.black },
  ], 'M200 245 V258 M184 264 Q200 274 216 264'),
  objectLevel('Traffic Light', 'paintstick', [
    { d: rect(185, 310, 30, 55), color: C.gray },
    { d: rrect(140, 60, 120, 250, 25), color: C.black },
    { d: circle(200, 112, 30), color: C.red },
    { d: circle(200, 185, 30), color: C.yellow },
    { d: circle(200, 258, 30), color: C.green },
  ]),
  objectLevel('Cheese', 'marker', [
    { d: 'M70 240 L290 140 L330 240 Z', color: C.gold },
    { d: rect(70, 240, 260, 70), color: C.yellow },
    { d: `${circle(120, 275, 14)} ${circle(250, 280, 18)} ${ellipse(255, 205, 16, 10)} ${circle(185, 262, 9)}`, color: C.tan },
  ]),
  objectLevel('Hot Air Balloon', 'crayon', [
    { d: 'M200 60 C290 60 315 150 280 215 L240 260 H160 L120 215 C85 150 110 60 200 60 Z', color: C.red },
    { d: 'M200 60 C235 70 245 150 230 215 L220 260 H180 L170 215 C155 150 165 70 200 60 Z', color: C.yellow },
    { d: rrect(170, 295, 60, 45, 6), color: C.wood },
  ], 'M165 262 L175 295 M235 262 L225 295'),
  objectLevel('Whale', 'paintstick', [
    { d: 'M330 240 Q330 150 220 145 Q130 145 95 200 L60 165 Q45 160 45 180 L65 225 L40 260 Q40 280 60 275 L95 245 Q130 300 220 300 Q330 300 330 240 Z', color: C.blue },
    { d: 'M140 268 Q230 280 318 258 Q305 288 220 290 Q165 290 140 268 Z', color: C.sky },
    { d: circle(285, 210, 9), color: C.black },
  ], 'M292 240 Q307 245 320 235', 'M215 145 V108 M215 120 Q198 92 180 100 M215 120 Q232 92 250 100'),
  objectLevel('Tent', 'marker', [
    { d: 'M60 320 L200 90 L340 320 Z', color: C.orange },
    { d: 'M160 320 L200 200 L240 320 Z', color: C.navy },
    { d: 'M200 58 L232 68 L200 78 Z', color: C.red },
  ], 'M200 90 V58', 'M40 320 H360'),
  objectLevel('Pickup Truck', 'crayon', [
    { d: `M60 275 V215 H180 V150 H255 L292 205 H332 Q345 205 345 218 V275 ${arch(277, 275, 33)} ${arch(123, 275, 33)} Z`, color: C.blue },
    { d: 'M195 165 H248 L274 205 H195 Z', color: C.sky },
    { d: wheels(277, 27, 123, 277), color: C.black },
  ], 'M180 215 V258'),
  objectLevel('Octopus', 'paintstick', [
    {
      d: 'M120 200 C112 255 90 285 68 300 C105 310 135 280 152 250 C150 290 138 320 145 342 C175 330 185 290 195 255 H205 ' +
        'C215 290 225 330 255 342 C262 320 250 290 248 250 C265 280 295 310 332 300 C310 285 288 255 280 200 Z',
      color: C.purple,
    },
    { d: 'M120 200 Q112 90 200 85 Q288 90 280 200 Z', color: C.pink },
    { d: wheels(150, 13, 170, 230), color: C.black },
  ], 'M178 175 Q200 192 222 175'),
  objectLevel('Guitar', 'marker', [
    { d: 'M200 170 Q260 170 255 215 Q300 230 295 290 Q290 350 200 350 Q110 350 105 290 Q100 230 145 215 Q140 170 200 170 Z', color: C.orange },
    { d: circle(200, 265, 25), color: C.black },
    { d: rect(188, 65, 24, 105), color: C.wood },
    { d: rrect(178, 22, 44, 43, 8), color: C.brown },
    { d: rect(178, 300, 44, 12), color: C.brown },
  ], 'M195 65 V300 M205 65 V300', 'M178 35 H166 M178 52 H166 M222 35 H234 M222 52 H234'),
  objectLevel('Ambulance', 'crayon', [
    { d: `M55 280 V120 H260 V165 H310 Q345 170 348 215 V280 ${arch(285, 280, 30)} ${arch(120, 280, 30)} Z`, color: C.white },
    { d: 'M130 160 H160 V190 H190 V220 H160 V250 H130 V220 H100 V190 H130 Z', color: C.red },
    { d: 'M268 178 H308 Q328 186 334 215 H268 Z', color: C.sky },
    { d: rect(140, 103, 30, 17), color: C.blue },
    { d: wheels(282, 25, 120, 285), color: C.black },
  ]),
  objectLevel('Dinosaur', 'paintstick', [
    {
      d: 'M40 250 Q90 245 120 215 Q160 185 220 195 Q245 195 255 160 L262 95 Q265 65 298 65 Q335 68 330 95 Q322 105 290 105 ' +
        'L285 175 Q290 225 275 250 V300 H245 V265 H160 V300 H130 V262 Q90 268 40 250 Z',
      color: C.green,
    },
    { d: `${circle(190, 225, 12)} ${circle(225, 243, 10)} ${circle(160, 240, 10)}`, color: C.yellow },
    { d: circle(305, 82, 6), color: C.black },
  ], 'M312 96 Q320 100 327 94'),
  objectLevel('Lighthouse', 'marker', [
    { d: 'M150 340 L170 130 H230 L250 340 Z', color: C.white },
    { d: 'M165.2 180 H234.8 L238.6 220 H161.4 Z M157.6 260 H242.4 L246.2 300 H153.8 Z', color: C.red },
    { d: rect(175, 90, 50, 40), color: C.yellow },
    { d: 'M165 90 L200 55 L235 90 Z', color: C.red },
    { d: 'M185 340 V315 Q185 300 200 300 Q215 300 215 315 V340 Z', color: C.brown },
  ], 'M168 100 L110 80 M168 118 L110 132 M232 100 L290 80 M232 118 L290 132'),
  objectLevel('Tugboat', 'crayon', [
    { d: 'M60 240 H340 L310 300 H95 Z', color: C.red },
    { d: rect(150, 170, 110, 70), color: C.white },
    { d: `${rect(170, 185, 30, 30)} ${rect(215, 185, 30, 30)}`, color: C.sky },
    { d: rect(225, 120, 25, 50), color: C.yellow },
  ], 'M50 322 Q75 307 100 322 T150 322 T200 322 T250 322 T300 322 T350 322'),
  objectLevel('Snail', 'paintstick', [
    { d: 'M70 300 Q60 270 95 270 H310 V170 Q310 140 335 140 Q360 140 360 170 V290 Q360 305 340 305 H85 Q70 305 70 300 Z', color: C.mint },
    { d: circle(195, 185, 85), color: C.orange },
    { d: wheels(98, 9, 315, 355), color: C.black },
  ], spiral(195, 185, 62, 2.3), 'M325 142 L315 107 M345 142 L355 107', 'M325 180 Q337 190 349 180'),
  objectLevel('Cactus', 'marker', [
    {
      d: 'M165 320 V125 Q165 90 200 90 Q235 90 235 125 V320 Z M165 230 H130 Q110 230 110 210 V160 Q110 145 125 145 Q140 145 140 160 V200 H165 Z ' +
        'M235 200 H260 V130 Q260 115 275 115 Q290 115 290 130 V210 Q290 230 270 230 H235 Z',
      color: C.green,
    },
    { d: rect(125, 320, 150, 20), color: C.orange },
    { d: 'M138 340 H262 L250 380 H150 Z', color: C.orange },
  ], 'M185 140 l-8 -4 M215 170 l8 -4 M185 210 l-8 -4 M215 260 l8 -4 M185 290 l-8 -4'),
  objectLevel('Ice Cream Truck', 'crayon', [
    { d: `M50 280 V130 Q50 115 65 115 H260 V170 H315 Q345 175 350 220 V280 ${arch(285, 280, 30)} ${arch(115, 280, 30)} Z`, color: C.pink },
    { d: rect(75, 145, 140, 55), color: C.cream },
    { d: 'M268 182 H310 Q328 190 334 220 H268 Z', color: C.sky },
    { d: 'M118 85 H162 L140 115 Z', color: C.tan },
    { d: 'M118 85 Q118 55 140 55 Q162 55 162 85 Z', color: C.mint },
    { d: wheels(282, 25, 115, 285), color: C.black },
  ]),
  objectLevel('Crab', 'paintstick', [
    { d: ellipse(200, 230, 90, 60), color: C.red },
    { d: 'M95 145 L124.5 139.8 A30 30 0 1 1 110 119 Z M305 145 L275.5 139.8 A30 30 0 1 0 290 119 Z', color: C.red },
    { d: wheels(142, 13, 182, 218), color: C.white },
    { d: wheels(144, 6, 182, 218), color: C.black },
  ], 'M182 155 V171 M218 155 V171 M123 200 Q100 192 97 175 M277 200 Q300 192 303 175 M120 255 L80 275 M128 270 L92 298 M280 255 L320 275 M272 270 L308 298', 'M180 245 Q200 260 220 245'),
  objectLevel('Sand Pail', 'marker', [
    { d: rect(100, 145, 200, 25), color: C.red },
    { d: 'M112 170 H288 L265 320 H135 Z', color: C.blue },
    { d: star(200, 245, 42, 17), color: C.yellow },
  ], 'M100 157 Q200 40 300 157'),
  objectLevel('Monster Truck', 'crayon', [
    { d: `${circle(115, 280, 62)} ${circle(285, 280, 62)}`, color: C.black },
    { d: wheels(280, 22, 115, 285), color: C.yellow },
    { d: 'M60 205 V160 H150 L180 110 H270 L300 160 H345 V205 Z', color: C.purple },
    { d: 'M188 125 H262 L284 158 H168 Z', color: C.sky },
  ], 'M115 218 V205 M285 218 V205'),
  objectLevel('Mouse', 'paintstick', [
    { d: circle(200, 235, 85), color: C.gray },
    { d: `${bump(120, 145, 55, 200, 235, 85)} ${bump(280, 145, 55, 200, 235, 85)}`, color: C.gray },
    { d: `${circle(112, 136, 28)} ${circle(288, 136, 28)}`, color: C.pink },
    { d: wheels(220, 10, 170, 230), color: C.black },
    { d: circle(200, 262, 13), color: C.pink },
  ], 'M200 275 V285 M185 290 Q200 298 215 290', 'M160 262 H110 M160 275 L115 290 M240 262 H290 M240 275 L285 290'),
  objectLevel('T-Shirt', 'marker', [
    { d: 'M140 80 Q200 110 260 80 L340 130 L310 185 L280 170 V330 H120 V170 L90 185 L60 130 Z', color: C.red },
    { d: star(200, 225, 50, 20), color: C.yellow },
  ], 'M140 80 Q200 125 260 80'),
  objectLevel('Cement Mixer', 'crayon', [
    { d: `M55 275 V235 H250 V150 H305 L345 200 V275 ${arch(280, 275, 30)} ${arch(120, 275, 30)} Z`, color: C.blue },
    { d: 'M65 235 Q55 160 115 140 L235 165 Q252 200 235 235 Z', color: C.yellow },
    { d: 'M262 165 H300 L328 205 H262 Z', color: C.sky },
    { d: wheels(277, 25, 120, 280), color: C.black },
  ], 'M120 142 Q150 190 130 235 M175 152 Q205 195 190 235'),
  objectLevel('Sheep', 'paintstick', [
    { d: fluffy(200, 200, 115, 105, 12), color: C.white },
    { d: 'M148 195 Q120 175 98 195 Q120 214 148 207 Z M252 195 Q280 175 302 195 Q280 214 252 207 Z', color: C.peach },
    { d: ellipse(200, 225, 55, 72), color: C.peach },
    { d: wheels(212, 9, 180, 220), color: C.black },
  ], 'M188 262 Q200 272 212 262 M200 270 V280'),
  objectLevel('Cup', 'marker', [
    { d: 'M110 120 H270 V300 Q270 330 240 330 H140 Q110 330 110 300 Z', color: C.sky },
    { d: 'M270 160 Q340 160 340 215 Q340 270 270 270 V245 Q312 245 312 215 Q312 185 270 185 Z', color: C.red },
    { d: heart(190, 225, 0.45), color: C.pink },
  ], 'M160 100 Q145 80 160 60 M200 100 Q185 80 200 60 M240 100 Q225 80 240 60'),
  objectLevel('Motorcycle', 'crayon', [
    { d: `${circle(110, 270, 45)} ${circle(295, 270, 45)}`, color: C.black },
    { d: wheels(270, 14, 110, 295), color: C.gray },
    { d: 'M145 200 H260 Q280 200 285 228 L255 252 H170 Q148 250 145 230 Z', color: C.red },
    { d: 'M140 200 Q140 178 165 178 H215 Q225 182 222 200 Z', color: C.black },
  ], 'M110 270 L160 248 M295 270 L272 185 L252 178 M272 185 H292'),
  objectLevel('Flying Saucer', 'paintstick', [
    { d: 'M160 244 L115 345 H285 L240 244 Z', color: C.mint },
    { d: 'M60 210 Q60 185 140 185 H260 Q340 185 340 210 Q340 240 200 245 Q60 240 60 210 Z', color: C.gray },
    { d: 'M140 185 Q140 120 200 120 Q260 120 260 185 Z', color: C.sky },
    { d: wheels(213, 9, 105, 160, 240, 295), color: C.yellow },
  ]),
];
