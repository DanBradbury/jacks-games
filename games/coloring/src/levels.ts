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
];
