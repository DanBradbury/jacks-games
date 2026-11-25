// Guided scenes. Parts stack back-to-front and color from foreground to background.
import { C, circle, ellipse, rect, rrect, type ColorTool } from './levels';

function part(id: string, d: string, color: string, detail?: string) {
  return { id, d, color, detail };
}

function scene(id: string, name: string, tool: ColorTool, ...parts: ReturnType<typeof part>[]) {
  return { id, name, tool, parts };
}

const backdrop = (id: string, color: string) => part(id, rect(0, 0, 400, 300), color);
const drift = () => part('snow', 'M0 221 Q86 192 190 216 T400 204 V300 H0 Z', C.white);
const pine = (x: number, y: number) =>
  `M${x} ${y} l24 39 h-10 l19 30 h-13 l21 33 h-82 l21 -33 h-13 l19 -30 h-10 Z`;
const sparkle = (x: number, y: number) =>
  `M${x} ${y-12} q2 10 12 12 q-10 2 -12 12 q-2 -10 -12 -12 q10 -2 12 -12 Z`;

export const christmasSheets = [
  scene('christmas-sleigh', 'Midnight Sleigh Ride', 'marker',
    backdrop('night', C.navy),
    part('moon', 'M84 22 A34 34 0 1 0 107 74 Q64 74 84 22 Z', C.cream),
    part('stars', sparkle(151, 38) + sparkle(256, 45) + sparkle(354, 78), C.gold),
    part('pines', pine(26, 133) + pine(366, 122), C.forest),
    drift(),
    part('braces', 'M126 198 H142 L150 231 H134 Z M246 197 H262 L254 231 H238 Z', C.wood),
    part('runner', 'M82 228 H275 Q311 228 324 204 Q336 197 333 212 Q322 245 278 245 H82 Q67 237 82 228 Z', C.gold),
    part('parcel', rrect(104, 94, 74, 61, 6), C.green),
    part('ribbon', rect(132, 94, 19, 61), C.yellow),
    part('sack', 'M176 156 Q161 129 195 99 L211 83 L198 62 Q218 57 226 71 Q241 53 253 64 L240 86 Q285 113 265 156 Z', C.tan, 'M211 84 Q225 91 240 85'),
    part('sleigh', 'M68 113 Q83 102 99 121 Q123 149 166 145 H252 Q285 144 294 110 Q298 94 312 99 Q330 108 317 123 Q302 127 295 153 Q279 207 239 209 H136 Q99 205 93 167 Q89 139 68 131 Q55 123 68 113 Z', C.red, 'M111 164 Q130 186 162 185 H237 Q266 184 278 162')),
  scene('christmas-reindeer', 'Reindeer at the Stable', 'crayon',
    backdrop('stable', C.wood),
    part('window', rrect(21, 24, 98, 89, 9), C.sky, 'M70 25 V112 M22 69 H118'),
    part('hay', 'M0 201 L24 161 L27 180 L51 145 L48 175 L76 158 L74 182 L105 153 L99 209 Z', C.gold),
    part('neck', 'M175 172 Q194 218 159 260 H290 Q251 218 261 166 Z', C.tan),
    part('antlers', 'M187 108 Q161 91 148 48 L146 21 Q154 11 158 22 L166 56 L176 41 Q185 35 184 48 L173 71 L199 96 Z M245 101 L266 73 L260 46 Q262 33 270 44 L278 59 L288 25 Q298 17 298 31 L287 73 L307 61 Q319 59 313 71 L282 91 L258 114 Z', C.brown),
    part('ears', 'M184 122 Q139 130 130 88 Q166 81 190 107 Z M254 116 Q279 83 311 89 Q305 125 263 133 Z', C.tan),
    part('face', ellipse(222, 141, 56, 61), C.tan, 'M193 130 q7 -8 14 0 M235 130 q7 -8 14 0'),
    part('muzzle', ellipse(222, 169, 40, 29), C.cream, 'M206 176 Q221 190 237 176'),
    part('nose', ellipse(222, 155, 17, 12), C.red),
    part('collar', 'M179 196 Q220 216 261 195 L265 211 Q222 231 178 212 Z', C.green),
    part('gate', rect(0, 235, 400, 65), C.wood, 'M0 251 H400 M70 252 V300 M152 252 V300 M244 252 V300 M328 252 V300'),
    part('bell', circle(218, 222, 15), C.gold, 'M211 226 q7 5 14 0')),
  scene('christmas-snowman', 'Snowman Tree Party', 'paintstick',
    backdrop('sky', C.sky),
    part('snowflakes', sparkle(43, 42) + sparkle(194, 51) + sparkle(354, 58), C.white),
    drift(),
    part('trunk', rect(287, 191, 23, 42), C.wood),
    part('fir', 'M299 51 L335 109 H320 L349 154 H333 L365 203 H231 L263 154 H248 L278 109 H264 Z', C.forest),
    part('baubles', circle(295, 109, 10) + circle(319, 151, 10) + circle(275, 175, 10), C.gold),
    part('twigs', 'M109 186 L66 154 L54 132 L48 136 L57 153 L36 149 L33 157 L62 165 L102 197 Z M156 184 L198 150 L201 128 L209 127 L208 146 L226 137 L230 144 L204 158 L163 196 Z', C.wood),
    part('snowball', ellipse(134, 208, 54, 49), C.white, 'M132 195 h4 M132 213 h4 M132 231 h4'),
    part('head', circle(134, 134, 38), C.white, 'M119 127 v3 M143 127 v3 M115 145 q11 14 23 7'),
    part('scarf', 'M103 155 Q134 171 162 154 L165 166 L153 172 L170 190 L155 201 L133 177 Q114 176 99 167 Z', C.red),
    part('carrot', 'M134 135 L173 139 L136 146 Q129 142 134 135 Z', C.orange),
    part('hat', 'M88 101 H108 L102 65 L148 58 L156 94 L173 91 L176 103 L90 115 Z', C.navy, 'M107 90 L153 83')),
  scene('north-pole-mail', 'Letters to Santa', 'marker',
    backdrop('sky', C.sky),
    part('trees', pine(39, 116) + pine(365, 110), C.forest),
    drift(),
    part('post', rect(180, 167, 30, 93), C.wood, 'M190 213 v31'),
    part('mailbox', 'M97 170 V101 Q97 57 137 57 H245 Q284 57 284 101 V172 Z', C.red, 'M137 58 Q177 62 177 102 V169'),
    part('opening', 'M108 154 V102 Q108 72 137 72 Q165 72 165 104 V154 Z', C.navy),
    part('flag', 'M234 118 V32 H289 L280 45 L290 59 H246 V118 Z', C.gold),
    part('door', 'M99 155 H174 L149 193 H68 Q61 191 67 182 Z', C.green),
    part('letter', 'M53 125 L130 105 L144 153 L67 173 Z', C.cream, 'M55 126 L101 144 L129 107'),
    part('seal', circle(100, 143, 10), C.red),
    part('snowcap', 'M171 63 Q179 45 200 48 Q213 35 229 49 Q253 39 267 58 Q277 75 258 71 Q247 65 241 73 Q231 84 221 69 Q213 62 199 70 Q182 81 171 63 Z', C.white)),
  scene('christmas-cookie-tray', 'Cookies for Santa', 'crayon',
    backdrop('tablecloth', C.mint),
    part('tray', rrect(22, 32, 356, 236, 32), C.navy, 'M39 65 Q39 48 59 48 H341'),
    part('parchment', rrect(43, 60, 314, 186, 18), C.cream),
    part('gingerbread', 'M99 127 C77 100 97 74 123 77 C151 78 161 106 143 126 L162 119 Q181 113 186 132 Q190 144 176 151 L152 160 L166 193 Q176 213 159 219 Q145 226 135 210 L122 191 L109 213 Q98 229 83 219 Q71 210 80 195 L94 162 L71 151 Q55 145 60 132 Q64 118 80 122 Z', C.tan, 'M108 100 v3 M133 100 v3 M109 111 q12 13 24 0 M80 194 l8 8 9 -5 M147 198 l8 6 9 -8'),
    part('buttons', circle(121, 143, 8) + circle(122, 165, 8), C.red),
    part('tree-cookie', 'M251 78 L278 117 H267 L289 147 H277 L299 178 H268 V195 H236 V178 H205 L227 147 H215 L237 117 H225 Z', C.green, 'M231 137 Q249 149 274 138 M223 165 Q250 177 283 164'),
    part('star-cookie', 'M305 152 L316 172 L339 176 L322 192 L326 216 L305 205 L283 216 L287 192 L270 176 L294 172 Z', C.gold),
    part('icing', circle(305, 187, 10), C.pink)),
  scene('christmas-snow-globe', 'Christmas Village Snow Globe', 'paintstick',
    backdrop('wall', C.mint),
    part('shelf', rect(0, 239, 400, 61), C.wood, 'M20 271 q31 -6 59 0 M315 260 q27 6 53 0'),
    part('glass', circle(200, 129, 111), C.sky, 'M110 109 Q114 80 135 61'),
    part('flakes', sparkle(157, 65) + sparkle(222, 49) + sparkle(267, 94), C.white),
    part('hillside', 'M97 170 Q149 133 204 157 Q251 176 305 164 A111 111 0 0 1 97 170 Z', C.white),
    part('fir', pine(244, 77), C.forest),
    part('cabin', rect(132, 135, 82, 58), C.tan),
    part('chimney', rect(182, 94, 17, 34), C.wood),
    part('roof', 'M119 138 L173 91 L225 138 L217 147 L173 111 L129 147 Z', C.red),
    part('door', rrect(143, 155, 20, 38, 4), C.brown),
    part('window', rrect(175, 149, 27, 26, 3), C.gold, 'M189 150 v24 M176 162 h25'),
    part('stand', 'M131 215 H269 L286 246 Q292 260 274 261 H126 Q108 260 114 246 Z', C.red),
    part('plaque', rrect(164, 225, 72, 25, 12), C.gold, 'M185 238 h30')),
];
