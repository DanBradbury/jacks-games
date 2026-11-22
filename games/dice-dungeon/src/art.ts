// Color versions of the printable Dice Dungeon art (printables/dice-dungeon.html).
// Every shape gets the group's base fill (--f); `.g` uses the second color (--g),
// `.k` is solid ink, `.n` is line-only. Explicit fill attributes override both.

export const INK = '#2b2240';

export const svg = (vb: string, body: string, f = '#fff', g = '#bbb') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><g class="ink" style="--f:${f};--g:${g}">${body}</g></svg>`;

export const star = (cx: number, cy: number, R: number, r: number, n = 5, attrs = '') => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" ${attrs}/>`;
};

const GOLD = '#ffc93c';
const HEART_D = 'M12 21 C5 15 2 11 2 7.5 C2 4.5 4.5 2 7.5 2 C9.5 2 11 3 12 4.5 C13 3 14.5 2 16.5 2 C19.5 2 22 4.5 22 7.5 C22 11 19 15 12 21 Z';

export const heart = (full = true) =>
  `<svg viewBox="0 0 24 24"><path d="${HEART_D}" fill="${full ? '#ff3b5c' : '#d9d3e6'}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>${
    full ? '<path d="M6 6.5 C6.5 5 8 4.4 9 4.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>' : ''
  }</svg>`;

export const brokenHeart = () =>
  `<svg viewBox="0 0 24 24"><path d="${HEART_D}" fill="#ff3b5c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 4.5 L10 9 L13.5 12 L10.5 16 L12 21" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

export const skull = () =>
  `<svg viewBox="0 0 20 20"><path d="M3 9 C3 2 17 2 17 9 C17 12 15 13 14 14 V17 H6 V14 C5 13 3 12 3 9Z" fill="#f4efe1" stroke="${INK}" stroke-width="1.6"/><circle cx="7.3" cy="9" r="2.2" fill="${INK}"/><circle cx="12.7" cy="9" r="2.2" fill="${INK}"/></svg>`;

export const starIcon = (fill = GOLD) => svg('0 0 40 40', star(20, 20, 18, 8, 5, `fill="${fill}"`));

// ---------- dice ----------
export type DieKind = 'w' | 'g' | 'p' | 'r';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};
const pips = (n: number, color: string) => PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${color}"/>`).join('');

const d6 = (n: number, face: string, pip: string, shade: string) =>
  `<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="20" fill="${face}" stroke="${INK}" stroke-width="6"/><path d="M14 80 Q50 92 86 80 V82 Q86 91 76 91 H24 Q14 91 14 82 Z" fill="${shade}"/>${pips(n, pip)}</svg>`;

const D20 = 'M50 4 L92 28 L92 72 L50 96 L8 72 L8 28 Z';
const d20 = (n: number | undefined, face: string, line: string) =>
  `<svg viewBox="0 0 100 100"><path d="${D20}" fill="${face}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M50 22 L76 66 L24 66 Z" fill="none" stroke="${line}" stroke-width="3"/><path d="M50 4 L50 22 M92 28 L76 66 M8 28 L24 66 M50 96 L76 66 M50 96 L24 66 M92 72 L76 66 M8 72 L24 66" stroke="${line}" stroke-width="3"/>${
    n === undefined
      ? star(50, 50, 13, 6, 5, `fill="${GOLD}" stroke="${INK}" stroke-width="2"`)
      : `<text x="50" y="${n > 9 ? 59 : 60}" font-size="${n > 9 ? 25 : 30}" font-weight="900" text-anchor="middle" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif">${n}</text>`
  }</svg>`;

export const die = (kind: DieKind, n?: number) => {
  switch (kind) {
    case 'w':
      return d6(n ?? 5, '#fffaf0', INK, '#ece3d0');
    case 'g':
      return d6(n ?? 5, '#3fbf5a', '#fff', '#2f9a47');
    case 'p':
      return d20(n, '#8b5cf6', '#c4b0ff');
    case 'r':
      return d20(n ?? 20, '#ef4444', '#ffb0b0');
  }
};

export const SIDES: Record<DieKind, number> = { w: 6, g: 6, p: 20, r: 20 };

// ---------- hero art ----------
export const ART = {
  sword: svg('0 0 100 100', `<path d="M50 6 L59 18 L59 60 L41 60 L41 18 Z" fill="#dfe8f5"/><path class="n" d="M50 18 V56"/><rect x="26" y="59" width="48" height="8" rx="4" fill="${GOLD}"/><rect x="45" y="67" width="10" height="18" rx="2" fill="#9b5f38"/><circle cx="50" cy="90" r="6" fill="${GOLD}"/>`),
  bigsword: svg('0 0 100 100', `<path d="M50 3 L64 16 L64 58 L36 58 L36 16 Z" fill="#cfe4ff"/><path class="n" d="M50 14 V54 M44 22 V50 M56 22 V50"/><path d="M18 57 Q50 66 82 57 L82 66 Q50 74 18 66 Z" fill="${GOLD}"/><rect x="44" y="69" width="12" height="17" rx="2" fill="#7b4a2e"/>${star(50, 91, 8, 4, 5, `fill="${GOLD}"`)}<path class="n" d="M20 20 l6 6 M80 20 l-6 6 M14 40 h7 M86 40 h-7" stroke="#3a86ff"/>`),
  axe: svg('0 0 100 100', `<g transform="rotate(25 50 50)"><rect x="45" y="8" width="10" height="88" rx="4" fill="#9b5f38"/><path d="M55 14 C80 6 94 22 92 46 C78 38 66 40 55 46 Z" fill="#c9d3e0"/><path d="M45 14 C20 6 6 22 8 46 C22 38 34 40 45 46 Z" fill="#c9d3e0"/><path class="n" d="M45 70 h10 M45 78 h10 M45 86 h10"/></g>`),
  bow: svg('0 0 100 100', `<path class="n" d="M34 8 Q90 50 34 92" stroke-width="8"/><path class="n" d="M34 8 Q90 50 34 92" stroke="#c07a3a" stroke-width="3.5"/><path class="n" d="M34 8 L34 92" stroke-width="2"/><path class="n" d="M14 50 H84"/><path d="M76 42 L90 50 L76 58 Z" fill="#c9d3e0"/><path d="M14 50 L6 42 L20 42 L26 50 L20 58 L6 58 Z" fill="#ff5a5f"/>`),
  wand: svg('0 0 100 100', `<g transform="rotate(40 40 64)"><rect x="35" y="36" width="10" height="56" rx="4" fill="#8b5cf6"/><rect x="35" y="80" width="10" height="12" rx="3" class="k"/></g>${star(66, 30, 22, 10, 5, `fill="${GOLD}"`)}<path class="n" d="M88 54 v10 M83 59 h10 M24 18 v10 M19 23 h10 M90 10 v8 M86 14 h8" stroke="#c084fc"/>`),
  fireball: svg('0 0 100 100', `<path d="M70 12 C66 26 80 26 92 22 C86 34 92 40 96 46 C86 46 82 52 80 60 C70 86 40 92 24 80 C8 66 10 40 30 30 C44 22 52 26 58 24 C62 22 66 18 70 12 Z" fill="#ff7a1a"/><circle cx="44" cy="58" r="17" fill="#ffd23f"/><path class="n" d="M44 50 C52 50 54 60 46 64 C40 66 36 60 40 56" stroke="#ff7a1a"/>`),
  mega: svg('0 0 100 100', `<polygon points="60,4 22,56 46,56 34,96 80,40 54,40 70,4" fill="#ffe14d"/><path class="n" d="M12 20 l10 8 M88 64 l-10 -6 M14 80 l10 -4 M88 18 l-8 6" stroke="#3a86ff"/>${star(20, 44, 6, 3, 5, `fill="${GOLD}"`)}${star(84, 84, 6, 3, 5, `fill="${GOLD}"`)}`),
  dog: svg('0 0 100 100', `<ellipse cx="50" cy="54" rx="30" ry="28"/><path d="M24 34 C10 36 8 62 18 70 C26 62 26 48 28 40 Z" class="g"/><path d="M76 34 C90 36 92 62 82 70 C74 62 74 48 72 40 Z" class="g"/><ellipse cx="50" cy="68" rx="16" ry="12" fill="#fff3dc"/><ellipse cx="50" cy="62" rx="7" ry="5" class="k"/><circle cx="39" cy="48" r="4.5" class="k"/><circle cx="61" cy="48" r="4.5" class="k"/><path class="n" d="M50 67 V74 M42 74 Q50 80 58 74"/><path d="M47 77 Q50 90 53 77" fill="#ff7aa8"/>`, '#e8b77a', '#9b6a3c'),
  clover: svg('0 0 100 100', `<path class="n" d="M50 52 Q56 80 72 94" stroke-width="5"/><path class="n" d="M50 52 Q56 80 72 94" stroke="#3e9a22" stroke-width="2"/><circle cx="35" cy="35" r="16"/><circle cx="65" cy="35" r="16"/><circle cx="35" cy="62" r="16"/><circle cx="65" cy="62" r="16"/><circle cx="50" cy="49" r="7" class="g"/>`, '#5bc236', '#3e9a22'),
  shield: svg('0 0 100 100', `<path d="M50 6 L86 20 V46 C86 70 70 86 50 95 C30 86 14 70 14 46 V20 Z"/><path d="M50 18 L74 28 V47 C74 64 63 76 50 83 C37 76 26 64 26 47 V28 Z" class="g"/>${star(50, 50, 16, 7, 5, `fill="${GOLD}"`)}`, '#3a86ff', '#9cc4ff'),
  potion: svg('0 0 100 100', `<rect x="40" y="6" width="20" height="12" rx="3" fill="#9b6a3c"/><path d="M42 18 H58 V34 C74 40 84 52 84 66 C84 84 70 94 50 94 C30 94 16 84 16 66 C16 52 26 40 42 34 Z" fill="#e8f4ff"/><path d="M19 60 Q35 52 50 60 T81 60 C83 64 84 66 84 68 C84 84 70 94 50 94 C30 94 16 84 16 68 Z" fill="#ff8fc7" stroke="none"/><path class="n" d="M20 60 Q35 52 50 60 T80 60"/><path d="${HEART_D}" transform="translate(36 62) scale(1.15)" fill="#ff3b5c"/><circle cx="30" cy="46" r="3" class="n"/>`),
};
export type ArtId = keyof typeof ART;

// ---------- monster art ----------
export const EART = {
  rat: svg('0 0 100 100', `<path class="n" d="M84 64 Q100 84 78 90 Q66 92 70 84" stroke-width="4"/><ellipse cx="58" cy="62" rx="28" ry="18"/><path d="M36 50 L8 64 L36 76 Z"/><circle cx="34" cy="44" r="10" class="g"/><circle cx="24" cy="60" r="3" class="k"/><circle cx="9" cy="64" r="3" fill="#ff7aa8"/><path class="n" d="M12 58 L2 52 M12 70 L2 76" stroke-width="2"/><path class="n" d="M44 78 v8 M70 78 v8"/>`, '#a9a4bd', '#ffb3c7'),
  bat: svg('0 0 100 100', `<path d="M50 40 C40 28 24 24 4 30 C12 38 12 46 10 54 C18 50 28 52 32 60 C38 54 44 56 50 64 C56 56 62 54 68 60 C72 52 82 50 90 54 C88 46 88 38 96 30 C76 24 60 28 50 40 Z" class="g"/><ellipse cx="50" cy="48" rx="11" ry="15"/><path d="M42 38 L40 26 L47 34 Z M58 38 L60 26 L53 34 Z"/><circle cx="45" cy="45" r="3" fill="#ffe14d"/><circle cx="55" cy="45" r="3" fill="#ffe14d"/><path d="M45 54 L47 59 L49 54 M51 54 L53 59 L55 54" class="n" stroke-width="2"/>`, '#8a6cc4', '#5b3f8f'),
  slime: svg('0 0 100 100', `<path d="M12 82 C12 52 30 24 50 24 C70 24 88 52 88 82 Q78 88 70 82 Q60 90 50 82 Q40 90 30 82 Q20 88 12 82 Z"/><ellipse cx="38" cy="56" rx="6" ry="9" class="k"/><ellipse cx="62" cy="56" rx="6" ry="9" class="k"/><path class="n" d="M40 70 Q50 78 60 70"/><path class="n" d="M28 44 Q32 34 40 32" stroke="#fff"/><circle cx="22" cy="20" r="4"/><circle cx="80" cy="16" r="3"/>`, '#7ee36b'),
  goblin: svg('0 0 100 100', `<path d="M28 46 L4 32 L26 64 Z M72 46 L96 32 L74 64 Z" class="g"/><ellipse cx="50" cy="54" rx="26" ry="28"/><path class="n" d="M34 40 L46 46 M66 40 L54 46" stroke-width="4"/><circle cx="40" cy="50" r="4" class="k"/><circle cx="60" cy="50" r="4" class="k"/><path d="M47 54 L50 64 L53 54" class="n"/><path d="M34 70 Q50 80 66 70 Q50 74 34 70 Z" fill="#fff"/><path d="M40 72 l2 5 l2 -4 M56 72 l2 4 l2 -5" class="n" stroke-width="2"/>`, '#8fce5a', '#6fae3c'),
  spider: svg('0 0 100 100', `<path class="n" d="M50 2 V26" stroke-width="2"/><path class="n" d="M38 56 L18 40 L6 56 M38 62 L16 58 L6 74 M40 68 L22 76 L14 94 M42 72 L32 86 L30 98 M62 56 L82 40 L94 56 M62 62 L84 58 L94 74 M60 68 L78 76 L86 94 M58 72 L68 86 L70 98"/><ellipse cx="50" cy="64" rx="18" ry="20" class="g"/><path d="M44 58 L50 66 L56 58 L50 74 Z" fill="#ff5a5f" stroke="none"/><circle cx="50" cy="38" r="13"/><circle cx="45" cy="35" r="3" fill="#ff5a5f"/><circle cx="55" cy="35" r="3" fill="#ff5a5f"/><circle cx="42" cy="42" r="2" fill="#ff5a5f"/><circle cx="58" cy="42" r="2" fill="#ff5a5f"/><path d="M46 49 L44 55 M54 49 L56 55" class="n"/>`, '#6c5a90', '#4b3a6b'),
  skeleton: svg('0 0 100 100', `<path class="n" d="M14 70 L86 96 M86 70 L14 96" stroke-width="7"/><path class="n" d="M14 70 L86 96 M86 70 L14 96" stroke="#f4efe1" stroke-width="2.5"/><path d="M24 46 C24 18 76 18 76 46 C76 58 70 62 68 68 L68 80 L32 80 L32 68 C30 62 24 58 24 46 Z"/><circle cx="39" cy="48" r="9" class="k"/><circle cx="61" cy="48" r="9" class="k"/><circle cx="39" cy="48" r="3" fill="#7dd3fc" stroke="none"/><circle cx="61" cy="48" r="3" fill="#7dd3fc" stroke="none"/><path d="M50 56 L45 64 L55 64 Z" class="k"/><path class="n" d="M32 70 H68 M41 70 V80 M50 70 V80 M59 70 V80" stroke-width="2"/>`, '#f4efe1'),
  mimic: svg('0 0 100 100', `<path d="M14 26 L22 6 L78 6 L86 26 Z" fill="#b5733a"/><path d="M14 26 L86 26 L86 40 L14 40 Z" fill="${GOLD}"/><path d="M18 40 L24 50 L30 40 L36 50 L42 40 L48 50 L54 40 L60 50 L66 40 L72 50 L78 40 L82 40" fill="#fff"/><path d="M50 56 Q46 74 60 76 Q70 74 62 60" fill="#ff7aa8"/><rect x="12" y="58" width="76" height="34" rx="3" fill="#c98a4b"/><path d="M18 58 L24 48 L30 58 L36 48 L42 58 L48 48 L54 58 L60 48 L66 58 L72 48 L78 58 Z" fill="#fff"/><rect x="44" y="70" width="12" height="14" rx="2" fill="${GOLD}"/><circle cx="36" cy="16" r="5" fill="#ffe14d"/><circle cx="64" cy="16" r="5" fill="#ffe14d"/><path class="n" d="M12 75 H88"/>`),
  ghost: svg('0 0 100 100', `<path d="M24 88 V44 C24 18 76 18 76 44 V88 L67 80 L58 88 L50 80 L42 88 L33 80 Z"/><path d="M24 50 C14 46 8 38 10 30 M76 50 C86 46 92 38 90 30" class="n"/><ellipse cx="40" cy="44" rx="6" ry="9" class="k"/><ellipse cx="60" cy="44" rx="6" ry="9" class="k"/><ellipse cx="50" cy="64" rx="7" ry="9" class="k"/><path class="n" d="M8 14 Q14 8 20 14 M80 10 Q86 4 92 10" stroke-width="2"/>`, '#e6f0ff'),
  orc: svg('0 0 100 100', `<path d="M20 40 L8 34 L18 58 Z M80 40 L92 34 L82 58 Z" class="g"/><rect x="20" y="20" width="60" height="64" rx="22"/><path d="M24 40 L76 40" stroke-width="7" class="n"/><circle cx="38" cy="49" r="4" fill="#ff5a5f"/><circle cx="62" cy="49" r="4" fill="#ff5a5f"/><ellipse cx="50" cy="58" rx="8" ry="5" class="g"/><path class="n" d="M32 72 Q50 64 68 72"/><path d="M34 72 L36 58 L42 69 Z M66 72 L64 58 L58 69 Z" fill="#fffaf0"/><path class="n" d="M40 22 L44 10 L50 20 L56 10 L60 22" stroke-width="3"/>`, '#7aa85a', '#5d8a42'),
  troll: svg('0 0 100 100', `<path d="M36 22 L30 4 L42 18 L50 2 L56 18 L68 4 L64 22 Z" class="g"/><ellipse cx="50" cy="56" rx="36" ry="34"/><circle cx="36" cy="40" r="5" class="k"/><circle cx="64" cy="40" r="5" class="k"/><path class="n" d="M28 32 L42 34 M72 32 L58 34" stroke-width="4"/><ellipse cx="50" cy="56" rx="11" ry="14" fill="#5f9e8f"/><path d="M26 74 Q50 88 74 74 Q50 80 26 74 Z" fill="#fff"/><path d="M44 77 L46 84 L49 78 Z" fill="#fff"/><circle cx="74" cy="56" r="2.5" class="k"/><circle cx="28" cy="62" r="2" class="k"/><circle cx="68" cy="66" r="2" class="k"/><path class="n" d="M82 22 q4 -6 0 -12 M90 28 q4 -6 0 -12" stroke="#9bd35a" stroke-width="2.5"/>`, '#7fb6a8', '#ff8a3d'),
  golem: svg('0 0 100 100', `<rect x="34" y="6" width="32" height="24" rx="4" class="g"/><rect x="40" y="14" width="7" height="5" fill="#ffb02e"/><rect x="53" y="14" width="7" height="5" fill="#ffb02e"/><rect x="22" y="32" width="56" height="40" rx="6" class="g"/><rect x="4" y="34" width="16" height="44" rx="6"/><rect x="80" y="34" width="16" height="44" rx="6"/><rect x="28" y="74" width="18" height="22" rx="4"/><rect x="54" y="74" width="18" height="22" rx="4"/><path class="n" d="M40 40 L48 50 L44 60 M66 44 L60 52 M30 60 L36 66 M60 82 L64 88"/><circle cx="34" cy="44" r="3" fill="#5bc236" stroke="none"/><circle cx="68" cy="62" r="2.5" fill="#5bc236" stroke="none"/>`, '#b8aea4', '#968a7f'),
};
export type EnemyArtId = keyof typeof EART;

const dragonBody = (body: string, belly: string, wing: string) => `
  <path d="M190 150 Q214 140 206 116 Q200 102 186 110 L196 98 L176 104 Q194 120 180 134 Q170 144 150 140 Z" fill="${body}"/>
  <path d="M70 92 L14 30 L24 70 L2 72 L22 92 L8 108 L56 118 Z" fill="${wing}"/>
  <path d="M150 92 L206 30 L196 70 L218 72 L198 92 L212 108 L164 118 Z" fill="${wing}"/>
  <path class="n" d="M64 98 L24 70 M64 104 L22 92 M156 98 L196 70 M156 104 L198 92"/>
  <ellipse cx="110" cy="136" rx="52" ry="38" fill="${body}"/>
  <ellipse cx="110" cy="142" rx="28" ry="28" fill="${belly}"/>
  <path class="n" d="M86 130 H134 M84 142 H136 M88 154 H132"/>
  <ellipse cx="74" cy="168" rx="18" ry="9" fill="${body}"/><ellipse cx="146" cy="168" rx="18" ry="9" fill="${body}"/>
  <path class="n" d="M64 172 v4 M74 173 v4 M84 172 v4 M136 172 v4 M146 173 v4 M156 172 v4"/>
  <path d="M80 44 L64 8 L92 36 Z M140 44 L156 8 L128 36 Z" fill="#fffaf0"/>
  <ellipse cx="110" cy="66" rx="44" ry="36" fill="${body}"/>
  <path d="M90 32 L94 14 L102 26 L110 10 L118 26 L126 14 L130 32 Z" fill="${GOLD}"/>
  ${star(110, 24, 4, 2, 5, 'fill="#ff5a5f"')}
  <ellipse cx="110" cy="84" rx="26" ry="15" fill="${belly}"/>
  <ellipse cx="101" cy="78" rx="3" ry="4" class="k"/><ellipse cx="119" cy="78" rx="3" ry="4" class="k"/>
  <path d="M88 88 Q110 100 132 88" fill="#fff"/>
  <path d="M94 91 L97 97 L100 93 M120 93 L123 97 L126 91" class="n" stroke-width="2.5"/>
  <path class="n" d="M144 34 Q150 26 158 30 M150 22 Q156 14 164 18" stroke-width="2"/>`;

const dragonEyes = `
  <path class="n" d="M82 48 L102 54 M138 48 L118 54" stroke-width="5"/>
  <circle cx="94" cy="62" r="9" fill="#ffe14d"/><circle cx="126" cy="62" r="9" fill="#ffe14d"/>
  <circle cx="96" cy="63" r="4.5" class="k"/><circle cx="124" cy="63" r="4.5" class="k"/>`;

const dragonDizzy = `
  <path class="n" d="M88 56 L100 68 M100 56 L88 68 M120 56 L132 68 M132 56 L120 68" stroke-width="4"/>
  ${star(70, 30, 7, 3, 5, `fill="${GOLD}"`)}${star(150, 30, 7, 3, 5, `fill="${GOLD}"`)}${star(110, 4, 6, 3, 5, `fill="${GOLD}"`)}`;

export const DRAGON = svg('0 0 220 180', dragonBody('#e5484d', '#ffd28a', '#a8323a') + dragonEyes);
export const DRAGON_ANGRY = svg('0 0 220 180', dragonBody('#c81e2a', '#ffb35c', '#7d1d27') + dragonEyes + `<path class="n" d="M60 50 q-8 -10 0 -20 M160 50 q8 -10 0 -20" stroke="#bbb" stroke-width="4"/>`);
export const DRAGON_DIZZY = svg('0 0 220 180', dragonBody('#e5484d', '#ffd28a', '#a8323a') + dragonDizzy);

// ---------- UI icons ----------
export const ICON = {
  play: svg('0 0 100 100', `<path d="M32 18 L84 50 L32 82 Z" fill="#fff" stroke-width="7"/>`),
  dice: `<svg viewBox="0 0 100 100"><g transform="rotate(-14 40 56)">${die('w', 5).replace('<svg viewBox="0 0 100 100">', '<svg x="6" y="30" width="54" height="54" viewBox="0 0 100 100">')}</g><g transform="rotate(12 66 40)">${die('w', 3).replace('<svg viewBox="0 0 100 100">', '<svg x="42" y="12" width="50" height="50" viewBox="0 0 100 100">')}</g></svg>`,
  check: svg('0 0 100 100', `<circle cx="50" cy="50" r="44" fill="#5bc236"/><path class="n" d="M28 52 L44 68 L74 34" stroke="#fff" stroke-width="12"/>`),
  miss: svg('0 0 100 100', `<circle cx="50" cy="50" r="44" fill="#ff5a5f"/><path class="n" d="M32 32 L68 68 M68 32 L32 68" stroke="#fff" stroke-width="12"/>`),
  replay: svg('0 0 24 24', `<path class="n" d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" stroke="#fff" stroke-width="2.8"/><path class="n" d="M4 4v5h5" stroke="#fff" stroke-width="2.8"/>`),
  crown: svg('0 0 100 80', `<path d="M10 70 L6 20 L30 42 L50 8 L70 42 L94 20 L90 70 Z" fill="${GOLD}"/><rect x="10" y="64" width="80" height="12" rx="3" fill="#ffb02e"/><circle cx="50" cy="46" r="7" fill="#ff5a5f"/><circle cx="26" cy="54" r="5" fill="#3a86ff"/><circle cx="74" cy="54" r="5" fill="#3a86ff"/>`),
  question: svg('0 0 100 100', `<circle cx="50" cy="50" r="40" fill="#5b4a80"/><text x="50" y="66" font-size="46" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" fill="#fff" stroke="none">?</text>`),
  reroll: svg('0 0 100 100', `<path class="n" d="M80 50 A30 30 0 1 1 66 24" stroke-width="9"/><path class="n" d="M80 50 A30 30 0 1 1 66 24" stroke="#5bc236" stroke-width="4"/><path d="M58 8 L82 22 L58 36 Z" fill="#5bc236" stroke-width="3"/>`),
  noEntry: svg('0 0 100 100', `<circle cx="50" cy="50" r="40" class="n" stroke="#ff3b5c" stroke-width="10"/><path class="n" d="M22 78 L78 22" stroke="#ff3b5c" stroke-width="10"/>`),
  campfire: svg('0 0 120 110', `
    <path d="M60 8 C66 26 84 30 82 54 C80 70 70 78 60 78 C50 78 38 70 38 54 C38 40 48 36 50 22 C56 30 54 36 60 40 C62 30 58 20 60 8 Z" fill="#ff7a1a"/>
    <path d="M60 38 C64 48 72 52 70 62 C68 70 64 74 60 74 C56 74 50 70 50 62 C50 56 56 52 60 38 Z" fill="#ffd23f"/>
    <rect x="18" y="80" width="84" height="14" rx="7" fill="#9b5f38" transform="rotate(12 60 87)"/>
    <rect x="18" y="80" width="84" height="14" rx="7" fill="#7b4a2e" transform="rotate(-12 60 87)"/>
    <ellipse cx="14" cy="100" rx="9" ry="6" fill="#a9a4bd"/><ellipse cx="106" cy="100" rx="9" ry="6" fill="#a9a4bd"/>`),
  zzz: svg('0 0 100 100', `<path class="n" d="M20 60 H40 L20 84 H40 M48 30 H66 L48 52 H66 M72 8 H86 L72 26 H86" stroke="#3a86ff" stroke-width="7"/>`),
  claw: svg('0 0 100 100', `<path class="n" d="M20 18 Q50 50 34 88 M44 12 Q74 46 58 86 M68 10 Q96 44 82 80" stroke="#ff3b5c" stroke-width="9"/>`),
  tail: svg('0 0 100 100', `<path d="M8 70 Q40 40 70 54 Q84 60 90 48 L96 70 Q80 80 66 72 Q40 60 14 84 Z" fill="#e5484d"/><path d="M84 44 L98 40 L94 56 Z" fill="#fffaf0"/><path class="n" d="M20 30 l8 8 M40 20 l2 12 M60 22 l-4 10" stroke="#ffc93c" stroke-width="5"/>`),
  fire: svg('0 0 100 100', `<path d="M50 6 C58 28 82 34 80 62 C78 82 64 94 50 94 C36 94 20 82 20 62 C20 44 34 38 36 20 C44 30 42 38 50 42 C52 30 48 18 50 6 Z" fill="#ff7a1a"/><path d="M50 44 C56 56 66 62 64 74 C62 84 56 88 50 88 C44 88 36 84 36 74 C36 66 46 60 50 44 Z" fill="#ffd23f"/>`),
  snack: svg('0 0 100 100', `<path d="M60 14 C82 14 92 34 82 52 C74 66 56 66 48 58 L30 76 Q34 88 24 90 Q14 92 14 82 Q6 84 6 74 Q8 64 20 68 L38 50 C30 40 34 14 60 14 Z" fill="#c98a4b"/><path class="n" d="M58 26 Q72 26 76 38" stroke="#fff" stroke-width="4"/><path d="M26 74 Q20 70 18 76" class="n" stroke="#fffaf0" stroke-width="3"/>`),
  roar: svg('0 0 100 100', `<path class="n" d="M14 50 H34 M20 24 L36 38 M20 76 L36 62 M66 50 H86 M80 24 L64 38 M80 76 L64 62" stroke="#ff7a1a" stroke-width="7"/><circle cx="50" cy="50" r="12" fill="#ffd23f"/>`),
  card: svg('0 0 70 100', `<rect x="6" y="6" width="58" height="88" rx="9" fill="#fff3d6"/><rect x="14" y="14" width="42" height="50" rx="5" fill="#bde0ff"/>${star(35, 39, 13, 6, 5, `fill="${GOLD}"`)}`),
};
