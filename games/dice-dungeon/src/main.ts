import './style.css';
import { Particles, Sfx, playables } from '@jack-games/kit';
import {
  ART,
  DRAGON,
  DRAGON_ANGRY,
  DRAGON_DIZZY,
  EART,
  ICON,
  SIDES,
  brokenHeart,
  die,
  heart,
  skull,
  starIcon,
  type DieKind,
} from './art';
import {
  DRAGON_HP,
  HAND_MAX,
  HAND_SIZE,
  HERO,
  MAX_ATTACKS,
  MAX_HEARTS,
  buildDungeon,
  dragonMove,
  dragonPower,
  shuffle,
  type DragonMove,
  type EnemyDef,
  type HeroDef,
} from './data';

const SAVE_KEY = 'jack-games.dice-dungeon.v1';
const CONFETTI = ['#ff5a5f', '#ffd23f', '#5bc236', '#3a86ff', '#ff8fc7', '#9b5de5'];
const GOLD = ['#ffd23f', '#ffffff', '#ffb02e'];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  app: $('app'),
  path: $('path'),
  hearts: $('hearts'),
  stage: $('stage'),
  foe: $('foe'),
  tray: $('tray'),
  effect: $('effect'),
  roll: $<HTMLButtonElement>('btn-roll'),
  hand: $('hand'),
  title: $('title'),
  camp: $('camp'),
  win: $('win'),
  fx: $<HTMLCanvasElement>('fx'),
};
const fxCtx = ui.fx.getContext('2d')!;

const sfx = new Sfx();
const fx = new Particles();

// ---- clock: game time stops while paused, so waits and celebrations hold ----
let paused = false;
let clock = 0;
const timers: { at: number; done: () => void }[] = [];
const wait = (ms: number) => new Promise<void>((done) => timers.push({ at: clock + ms, done }));

const rnd = (sides: number) => 1 + Math.floor(Math.random() * sides);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function restartAnim(el: Element | null | undefined, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

function center(el: Element | null | undefined) {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const burstAt = (el: Element | null | undefined, colors = GOLD, count = 18, speed = 260) => {
  const p = center(el);
  fx.burst(p.x, p.y, { colors, count, speed });
};

// ---- sounds beyond the kit presets ----
const snd = {
  rattle: () => sfx.noise(0.06, { freq: 2000 + Math.random() * 1800, q: 2.5, gain: 0.14 }),
  land: () => {
    sfx.tone(190, 0.14, { type: 'triangle', gain: 0.3, slide: 90 });
    sfx.noise(0.06, { freq: 900, gain: 0.12 });
  },
  pow: () => {
    sfx.tone(520, 0.18, { type: 'square', gain: 0.1, slide: 180 });
    sfx.noise(0.25, { type: 'lowpass', freq: 1800, sweep: 300, gain: 0.3 });
  },
  hit: () => {
    sfx.tone(150, 0.3, { type: 'square', gain: 0.16, slide: 60 });
    sfx.noise(0.22, { type: 'lowpass', freq: 600, gain: 0.3 });
  },
  clang: () => {
    sfx.tone(1250, 0.4, { type: 'square', gain: 0.07 });
    sfx.tone(1870, 0.35, { type: 'triangle', gain: 0.12 });
  },
  roar: () => {
    sfx.noise(1, { type: 'lowpass', freq: 250, sweep: 1400, q: 4, gain: 0.45 });
    sfx.tone(110, 1, { type: 'sawtooth', gain: 0.12, slide: 65 });
  },
  crackle: () => {
    for (let i = 0; i < 10; i++) sfx.noise(0.05, { freq: 1500 + Math.random() * 2500, q: 3, gain: 0.1, delay: i * 0.1 + Math.random() * 0.06 });
  },
  snore: () => {
    sfx.noise(0.8, { type: 'lowpass', freq: 180, sweep: 520, q: 7, gain: 0.3 });
    sfx.tone(90, 0.8, { type: 'triangle', gain: 0.12, slide: 70 });
  },
  munch: () => {
    for (let i = 0; i < 3; i++) sfx.noise(0.08, { freq: 700, q: 1.5, gain: 0.25, delay: i * 0.16 });
  },
  whoosh: () => sfx.whoosh(),
};

// ---- game state ----
interface Card {
  uid: number;
  def: HeroDef;
}
let nextUid = 1;
const isAttack = (c: Card) => !!c.def.roll;

const S = {
  busy: true,
  hearts: MAX_HEARTS,
  shields: 0,
  deck: [] as Card[],
  discard: [] as Card[],
  hand: [] as Card[],
  picked: [] as number[],
  dungeon: [] as EnemyDef[],
  idx: 0,
  dragonHp: DRAGON_HP,
};
const progress = { wins: 0 };

const foeNow = (): EnemyDef | undefined => S.dungeon[S.idx];
const angry = () => S.dragonHp <= DRAGON_HP / 2;

function setBusy(b: boolean) {
  S.busy = b;
  ui.hand.classList.toggle('idle', !b);
  updateRoll();
}

// ---- rendering ----
const BADGE = `<svg viewBox="0 0 100 100"><path d="M50 4 L92 18 V48 C92 74 72 90 50 97 C28 90 8 74 8 48 V18 Z" fill="#ffc93c" stroke="#2b2240" stroke-width="7" stroke-linejoin="round"/><path d="M50 16 L80 26 V48 C80 66 66 78 50 84 C34 78 20 66 20 48 V26 Z" fill="#ffe08a"/></svg>`;

function renderPath() {
  ui.path.innerHTML =
    S.dungeon
      .map((e, i) => {
        const cls = i < S.idx ? 'done' : i === S.idx ? 'now' : '';
        return `<div class="step ${cls}">${i < S.idx ? ICON.check : i === S.idx ? EART[e.art] : ICON.question}</div>`;
      })
      .join('') + `<div class="step boss ${S.idx >= S.dungeon.length ? 'now' : ''}">${ICON.crown}</div>`;
}

function renderHearts() {
  ui.hearts.innerHTML =
    range(MAX_HEARTS)
      .map((i) => `<div class="heart">${heart(i < S.hearts)}</div>`)
      .join('') + range(S.shields).map(() => `<div class="heart shield-slot">${ART.shield}</div>`).join('');
}
const heartEl = (i: number) => ui.hearts.children[i] as HTMLElement | undefined;

function foeNote(e: EnemyDef) {
  switch (e.special) {
    case 'mimic':
      return `<i>${die('g')}</i><b>×2</b>`;
    case 'ghost':
      return `<i>${die('p')}</i><b>×2</b>`;
    case 'golem':
      return `<i>${die('p')}</i><b>½</b>`;
    case 'troll':
      return `<i class="stack">${ART.dog}${ICON.noEntry}</i>`;
    default:
      return '';
  }
}

function renderFoe(anim = '') {
  const e = foeNow();
  if (e) {
    ui.foe.innerHTML = `
      <div class="foe-card rank-${e.rank} ${anim}">
        <div class="foe-head">${range(e.rank).map(skull).join('')}</div>
        <div class="foe-art">${EART[e.art]}</div>
        ${e.special ? `<div class="foe-note">${foeNote(e)}</div>` : ''}
        <div class="foe-foot">
          <div class="badge">${BADGE}<b>${e.power}</b></div>
          <div class="hits">${range(e.hits).map(brokenHeart).join('')}</div>
        </div>
      </div>`;
  } else {
    const art = S.dragonHp <= 0 ? DRAGON_DIZZY : angry() ? DRAGON_ANGRY : DRAGON;
    ui.foe.innerHTML = `
      <div class="foe-dragon ${angry() ? 'angry' : ''} ${anim}">
        <div class="dragon-art">${art}</div>
        <div class="hp"><div class="hp-fill"></div><div class="hp-mid"></div><b></b></div>
      </div>`;
    updateHp();
  }
}
const foeEl = () => ui.foe.firstElementChild as HTMLElement | null;

function updateHp() {
  const fill = ui.foe.querySelector<HTMLElement>('.hp-fill');
  const num = ui.foe.querySelector<HTMLElement>('.hp b');
  if (fill) fill.style.width = `${(S.dragonHp / DRAGON_HP) * 100}%`;
  if (num) num.textContent = String(S.dragonHp);
}

function cardFoot(d: HeroDef) {
  switch (d.free) {
    case 'dog':
      return `<b>+</b><i>${die('w')}</i>`;
    case 'clover':
      return `<i class="wide">${ICON.reroll}</i><i>${die('w', 1)}</i>`;
    case 'shield':
      return `<i class="stack">${brokenHeart()}${ICON.noEntry}</i>`;
    case 'potion':
      return `<b>+</b>${heart()}${heart()}${heart()}`;
    default:
      return d.roll!.map((k) => `<i>${die(k)}</i>`).join('');
  }
}

const trollBlocks = (c: Card) => c.def.free === 'dog' && foeNow()?.special === 'troll';

function renderHand(drawn: number[] = []) {
  ui.hand.innerHTML = S.hand
    .map((c) => {
      const cls = [
        'card',
        isAttack(c) ? 'attack' : 'free',
        S.picked.includes(c.uid) ? 'picked' : '',
        trollBlocks(c) ? 'blocked' : '',
        drawn.includes(c.uid) ? 'drawn' : '',
      ].join(' ');
      return `<button class="${cls}" data-uid="${c.uid}" aria-label="${c.def.art}">
        <div class="card-art">${ART[c.def.art]}</div>
        <div class="card-foot" data-n="${c.def.roll?.length ?? 0}">${cardFoot(c.def)}</div>
        ${c.def.free ? `<div class="tag">${starIcon()}</div>` : ''}
      </button>`;
    })
    .join('');
  ui.hand.classList.toggle('has-pick', pickedCards().some(isAttack));
  updateRoll();
}
const cardEl = (uid: number) => ui.hand.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
const pickedCards = () => S.hand.filter((c) => S.picked.includes(c.uid));

function updateRoll() {
  ui.roll.classList.toggle('ready', !S.busy && pickedCards().some(isAttack));
}

// ---- cards ----
function newDeck(): Card[] {
  const cards: Card[] = [];
  for (const def of HERO) for (let i = 0; i < def.count; i++) cards.push({ uid: nextUid++, def });
  return shuffle(cards);
}

function drawOne(): Card | undefined {
  if (!S.deck.length) {
    S.deck = shuffle(S.discard);
    S.discard = [];
  }
  const c = S.deck.pop();
  if (c) S.hand.push(c);
  return c;
}

async function drawCards(n: number, force = false) {
  for (let i = 0; i < n; i++) {
    if (S.hand.length >= HAND_MAX && !force) {
      sfx.boop();
      return;
    }
    const c = drawOne();
    if (!c) return;
    renderHand([c.uid]);
    snd.whoosh();
    sfx.pop(i * 2);
    await wait(220);
  }
}

async function refill() {
  if (S.hand.length < HAND_SIZE) await drawCards(HAND_SIZE - S.hand.length);
  // There must always be something to attack with.
  let guard = 20;
  while (!S.hand.some(isAttack) && guard-- > 0) {
    if (S.hand.length >= HAND_MAX) {
      // Hand full of free cards: swap one out so the hand never overflows.
      const c = S.hand[0];
      cardEl(c.uid)?.classList.add('toss');
      snd.whoosh();
      await wait(450);
      discardCard(c);
    }
    await drawCards(1, true);
  }
}

function discardCard(c: Card) {
  S.hand = S.hand.filter((h) => h !== c);
  S.picked = S.picked.filter((u) => u !== c.uid);
  S.discard.push(c);
}

async function onCard(uid: number) {
  if (S.busy) return;
  const c = S.hand.find((h) => h.uid === uid);
  if (!c) return;
  const el = cardEl(uid);

  if (trollBlocks(c)) {
    sfx.boop();
    restartAnim(el, 'nope');
    restartAnim(foeEl(), 'wobble');
    return;
  }

  if (c.def.free === 'potion') {
    if (S.hearts >= MAX_HEARTS) {
      sfx.boop();
      restartAnim(el, 'nope');
      return;
    }
    setBusy(true);
    burstAt(el, ['#ff8fc7', '#ff3b5c', '#fff']);
    discardCard(c);
    renderHand();
    await gainHearts(3);
    setBusy(false);
    return;
  }

  if (c.def.free === 'shield') {
    burstAt(el, ['#3a86ff', '#9cc4ff', '#fff']);
    snd.clang();
    discardCard(c);
    S.shields++;
    renderHand();
    renderHearts();
    restartAnim(heartEl(MAX_HEARTS + S.shields - 1), 'pop');
    return;
  }

  // Attack cards and Doggo / Clover get picked for the next roll.
  if (S.picked.includes(uid)) {
    S.picked = S.picked.filter((u) => u !== uid);
    sfx.tap();
  } else {
    if (isAttack(c)) {
      const attacks = pickedCards().filter(isAttack);
      if (attacks.length >= MAX_ATTACKS) S.picked = S.picked.filter((u) => u !== attacks[0].uid);
    }
    S.picked.push(uid);
    sfx.pop(S.picked.length * 2);
  }
  renderHand();
}

// ---- hearts ----
async function gainHearts(n: number) {
  for (let i = 0; i < n && S.hearts < MAX_HEARTS; i++) {
    S.hearts++;
    renderHearts();
    const el = heartEl(S.hearts - 1);
    restartAnim(el, 'pop');
    burstAt(el, ['#ff3b5c', '#ff8fc7', '#fff'], 10, 160);
    sfx.sparkle(i);
    await wait(220);
  }
}

async function blockHit() {
  const el = heartEl(MAX_HEARTS + S.shields - 1);
  restartAnim(el, 'pop');
  burstAt(el, ['#3a86ff', '#9cc4ff', '#fff'], 16, 220);
  snd.clang();
  await wait(380);
  S.shields--;
  renderHearts();
}

/** A Shield card still in hand jumps in by itself when a hit is coming. */
async function shieldFromHand() {
  if (S.shields > 0) return;
  const c = S.hand.find((h) => h.def.free === 'shield');
  if (!c) return;
  cardEl(c.uid)?.classList.add('picked');
  snd.clang();
  await wait(300);
  discardCard(c);
  S.shields++;
  renderHand();
  renderHearts();
}

/** Lose hearts. A shield blocks one heart, or all of a fire breath. */
async function takeHits(n: number, fire = false) {
  await shieldFromHand();
  if (fire && S.shields > 0) {
    await blockHit();
    return;
  }
  for (let i = 0; i < n; i++) {
    await shieldFromHand();
    if (S.shields > 0) {
      await blockHit();
      continue;
    }
    S.hearts--;
    renderHearts();
    const el = heartEl(S.hearts);
    restartAnim(el, 'pop');
    burstAt(el, ['#ff3b5c', '#2b2240'], 10, 180);
    sfx.boop();
    await wait(300);
    if (S.hearts <= 0) {
      await campfire();
      return;
    }
  }
}

/** Out of hearts: nobody loses, the heroes rest and get all their hearts back. */
async function campfire() {
  await wait(300);
  ui.camp.innerHTML = `<div class="camp-art">${ICON.campfire}</div><div class="camp-hearts">${range(MAX_HEARTS)
    .map(() => `<div class="heart">${heart(false)}</div>`)
    .join('')}</div>`;
  ui.camp.classList.remove('hidden');
  snd.crackle();
  await wait(700);
  const slots = ui.camp.querySelectorAll('.heart');
  for (let i = 0; i < MAX_HEARTS; i++) {
    slots[i].innerHTML = heart(true);
    restartAnim(slots[i], 'pop');
    burstAt(slots[i], ['#ff7a1a', '#ffd23f'], 6, 120);
    sfx.sparkle(i);
    if (i % 3 === 0) snd.crackle();
    await wait(160);
  }
  S.hearts = MAX_HEARTS;
  renderHearts();
  sfx.chime();
  await wait(900);
  ui.camp.classList.add('hidden');
}

// ---- dice tray ----
interface DieRoll {
  kind: DieKind;
  value: number;
  el: HTMLElement;
}
interface Group {
  dice: DieRoll[];
  el: HTMLElement;
  sum: HTMLElement;
}

function makeTray(spec: { label?: string; dice: DieKind[] }[]): Group[] {
  ui.tray.innerHTML = '';
  return spec.map((s) => {
    const el = document.createElement('div');
    el.className = 'group';
    el.innerHTML = `${s.label ? `<i class="glabel">${s.label}</i>` : ''}<div class="dice"></div><div class="gsum"></div>`;
    const box = el.querySelector('.dice')!;
    const dice = s.dice.map((kind) => {
      const d = document.createElement('div');
      d.className = 'die';
      d.innerHTML = die(kind);
      box.appendChild(d);
      return { kind, value: 0, el: d };
    });
    ui.tray.appendChild(el);
    return { dice, el, sum: el.querySelector<HTMLElement>('.gsum')! };
  });
}

function clearTray() {
  ui.tray.innerHTML = '';
}

async function rollDice(dice: DieRoll[]) {
  dice.forEach((d) => d.el.classList.add('rolling'));
  for (let i = 0; i < 8; i++) {
    for (const d of dice) d.el.innerHTML = die(d.kind, rnd(SIDES[d.kind]));
    snd.rattle();
    await wait(70);
  }
  for (const d of dice) {
    d.value = rnd(SIDES[d.kind]);
    d.el.innerHTML = die(d.kind, d.value);
    d.el.classList.remove('rolling');
    restartAnim(d.el, 'land');
  }
  snd.land();
  await wait(280);
}

async function countUp(el: HTMLElement, total: number) {
  const steps = Math.min(total, 14);
  for (let i = 1; i <= steps; i++) {
    el.textContent = String(Math.round((total * i) / steps));
    sfx.tick();
    await wait(45);
  }
  el.textContent = String(total);
}

const threeMatch = (dice: DieRoll[]) => {
  const counts: Record<number, number> = {};
  for (const d of dice) if (d.kind === 'w') counts[d.value] = (counts[d.value] ?? 0) + 1;
  return Object.values(counts).some((n) => n >= 3);
};

// ---- turns ----
async function attack() {
  const played = pickedCards();
  if (S.busy || !played.some(isAttack)) return;
  setBusy(true);
  sfx.unlock();
  snd.whoosh();

  const foe = foeNow();
  const attacks = played.filter(isAttack);
  const dog = played.some((c) => c.def.free === 'dog');
  const clover = played.some((c) => c.def.free === 'clover');
  for (const c of played) discardCard(c);
  renderHand();

  const spec = attacks.map((c) => ({ label: ART[c.def.art], dice: [...c.def.roll!] }));
  if (dog) spec.push({ label: ART.dog, dice: ['w'] });
  const groups = makeTray(spec);
  const all = groups.flatMap((g) => g.dice);
  await rollDice(all);

  if (clover) {
    const low = all.filter((d) => d.value <= (SIDES[d.kind] === 20 ? 7 : 2));
    if (low.length) {
      burstAt(ui.tray, ['#5bc236', '#a6f08a', '#fff'], 24);
      sfx.sparkle(3);
      await wait(250);
      await rollDice(low);
    }
  }

  // Magic dice change against some monsters; vs the Dragon, a natural 20 or a white triple doubles that card.
  let total = 0;
  for (const g of groups) {
    let sum = 0;
    for (const d of g.dice) {
      let v = d.value;
      if (d.kind === 'p' && foe?.special === 'ghost') v *= 2;
      if (d.kind === 'p' && foe?.special === 'golem') v = Math.ceil(v / 2);
      sum += v;
    }
    const usesMagic = g.dice.some((d) => d.kind === 'p');
    const double = !foe && (g.dice.some((d) => d.kind === 'p' && d.value === 20) || threeMatch(g.dice));
    if (double) sum *= 2;
    g.sum.textContent = String(sum);
    if (double || (usesMagic && (foe?.special === 'ghost' || foe?.special === 'golem'))) {
      g.sum.classList.add('boosted');
      restartAnim(ui.foe.querySelector('.foe-note'), 'pop');
      burstAt(g.el, double ? GOLD : ['#c084fc', '#fff'], 16);
      sfx.sparkle(5);
    }
    restartAnim(g.sum, 'pop');
    sfx.pop(4);
    total += sum;
    await wait(260);
  }

  const totalEl = document.createElement('div');
  totalEl.className = 'total';
  ui.tray.appendChild(totalEl);
  await countUp(totalEl, total);

  if (foe) {
    if (total >= foe.power) await beatFoe(foe, totalEl);
    else await foeHits(foe, totalEl);
  } else {
    await hurtDragon(total);
    if (S.dragonHp <= 0) return victory();
    await dragonTurn();
  }

  clearTray();
  await refill();
  setBusy(false);
}

async function beatFoe(foe: EnemyDef, totalEl: HTMLElement) {
  totalEl.classList.add('win');
  totalEl.insertAdjacentHTML('beforeend', `<i class="mark">${ICON.check}</i>`);
  restartAnim(totalEl, 'pop');
  snd.pow();
  sfx.chime();
  burstAt(foeEl(), [...CONFETTI, '#fff'], 36, 380);
  foeEl()?.classList.add('defeated');
  await wait(900);

  // Loot: roll the green die (twice for a Mimic).
  for (let i = 0; i < (foe.special === 'mimic' ? 2 : 1); i++) {
    const [g] = makeTray([{ label: ICON.card, dice: ['g'] }]);
    ui.foe.innerHTML = '';
    await wait(200);
    await rollDice(g.dice);
    const v = g.dice[0].value;
    if (v <= 2) {
      showEffect(heart());
      await gainHearts(1);
    } else {
      const n = v <= 4 ? 1 : 2;
      showEffect(range(n).map(() => ICON.card).join(''));
      await drawCards(n);
    }
    await wait(500);
    hideEffect();
  }

  clearTray();
  S.idx++;
  renderPath();
  restartAnim(ui.path.querySelector('.now'), 'pop');
  renderHand();
  if (foeNow()) {
    snd.whoosh();
    renderFoe('flip-in');
    await wait(600);
  } else {
    await dragonIntro();
  }
}

async function foeHits(foe: EnemyDef, totalEl: HTMLElement) {
  totalEl.classList.add('miss');
  totalEl.insertAdjacentHTML('beforeend', `<i class="mark">${ICON.miss}</i>`);
  restartAnim(totalEl, 'pop');
  await wait(450);
  restartAnim(foeEl(), 'lunge');
  restartAnim(ui.app, 'shake');
  snd.hit();
  await wait(250);
  await takeHits(foe.hits);
  await wait(300);
}

async function dragonIntro() {
  S.dragonHp = DRAGON_HP;
  renderFoe('enter');
  renderHand();
  await wait(500);
  snd.roar();
  restartAnim(ui.app, 'shake');
  burstAt(foeEl(), ['#ff7a1a', '#ffd23f', '#ff3b5c'], 30, 400);
  await wait(1000);
}

async function hurtDragon(total: number) {
  const wasAngry = angry();
  S.dragonHp = Math.max(0, S.dragonHp - total);
  snd.pow();
  restartAnim(foeEl(), 'hurt');
  burstAt(ui.foe.querySelector('.dragon-art'), [...GOLD, '#ff7a1a'], 30, 360);
  updateHp();
  await wait(700);
  if (S.dragonHp > 0 && angry() && !wasAngry) {
    renderFoe('hurt');
    snd.roar();
    restartAnim(ui.app, 'shake');
    await wait(900);
  }
}

const MOVE_ICON: Record<DragonMove, string> = {
  snore: ICON.zzz,
  claw: ICON.claw,
  tail: ICON.tail,
  fire: ICON.fire,
  snack: ICON.snack,
  roar: ICON.roar,
};

function showEffect(icon: string, mult = 1) {
  ui.effect.innerHTML = `<div class="effect-in">${icon}${mult > 1 ? `<b>×${mult}</b>` : ''}</div>`;
}
function hideEffect() {
  ui.effect.innerHTML = '';
}

async function dragonTurn() {
  await wait(500);
  const reds: DieKind[] = angry() ? ['r', 'r'] : ['r'];
  const [redGroup, greenGroup] = makeTray([{ dice: reds }, { dice: ['g'] }]);
  restartAnim(foeEl(), 'wobble');
  await rollDice([...redGroup.dice, ...greenGroup.dice]);

  // Angry: roll the red die twice and use the higher one.
  const best = redGroup.dice.reduce((a, b) => (b.value > a.value ? b : a));
  for (const d of redGroup.dice) if (d !== best) d.el.classList.add('faded');
  const move = dragonMove(best.value);
  const mult = dragonPower(greenGroup.dice[0].value);
  const multiplies = move === 'claw' || move === 'tail' || move === 'fire' || move === 'snack';
  await wait(300);
  showEffect(MOVE_ICON[move], multiplies ? mult : 1);
  const art = ui.foe.querySelector('.dragon-art');

  switch (move) {
    case 'snore':
      snd.snore();
      restartAnim(foeEl(), 'snooze');
      await wait(1200);
      break;
    case 'claw':
    case 'tail':
      restartAnim(foeEl(), 'lunge');
      restartAnim(ui.app, 'shake');
      snd.hit();
      await wait(300);
      await takeHits((move === 'claw' ? 1 : 2) * mult);
      break;
    case 'fire':
      restartAnim(foeEl(), 'lunge');
      snd.roar();
      for (let i = 0; i < 4; i++) {
        burstAt(art, ['#ff7a1a', '#ffd23f', '#ff3b5c'], 18, 420);
        await wait(90);
      }
      await takeHits(2 * mult, true);
      break;
    case 'snack':
      snd.munch();
      await wait(500);
      S.dragonHp = Math.min(DRAGON_HP, S.dragonHp + 3 * mult);
      if (!angry()) renderFoe();
      updateHp();
      burstAt(art, ['#5bc236', '#a6f08a', '#fff'], 20);
      sfx.sparkle(1);
      await wait(600);
      break;
    case 'roar': {
      snd.roar();
      restartAnim(ui.app, 'shake');
      await wait(400);
      if (S.hand.length > 1) {
        const c = S.hand[Math.floor(Math.random() * S.hand.length)];
        cardEl(c.uid)?.classList.add('toss');
        sfx.boop();
        await wait(500);
        discardCard(c);
        renderHand();
      }
      await wait(400);
      break;
    }
  }
  await wait(400);
  hideEffect();
}

async function victory() {
  renderFoe('hurt');
  clearTray();
  hideEffect();
  sfx.fanfare();
  fx.confetti(innerWidth, innerHeight, CONFETTI, 160);
  progress.wins++;
  void playables.save(SAVE_KEY, progress);
  playables.sendScore(progress.wins);
  await wait(1600);
  ui.win.innerHTML = `
    <div class="win-crown">${ICON.crown}</div>
    <div class="win-art">${DRAGON_DIZZY}</div>
    <button class="round-btn" id="btn-again" aria-label="Play again">${ICON.replay}</button>`;
  ui.win.classList.remove('hidden');
  burstAt(ui.win.querySelector('.win-crown'), GOLD, 40, 420);
  sfx.chime();
}

// ---- title ----
function renderTitle() {
  const dots = (n: number) => `${range(n).map(() => '<i></i>').join('')}<span class="mini-crown">${ICON.crown}</span>`;
  const crowns = Math.min(progress.wins, 12);
  ui.title.innerHTML = `
    <h1 class="logo">DICE DUNGEON</h1>
    <div class="title-art">${DRAGON}</div>
    <div class="modes">
      <button class="mode-btn" data-long="0" aria-label="Short dungeon">${ICON.play}<span class="dots">${dots(5)}</span></button>
      <button class="mode-btn" data-long="1" aria-label="Long dungeon">${ICON.play}<span class="dots">${dots(11)}</span></button>
    </div>
    <div class="crowns">${range(crowns).map(() => `<i>${ICON.crown}</i>`).join('')}${progress.wins > crowns ? `<b>+${progress.wins - crowns}</b>` : ''}</div>`;
}

async function startGame(long: boolean) {
  sfx.unlock();
  sfx.chime();
  S.hearts = MAX_HEARTS;
  S.shields = 0;
  S.deck = newDeck();
  S.discard = [];
  S.hand = [];
  S.picked = [];
  S.dungeon = buildDungeon(long);
  S.idx = 0;
  S.dragonHp = DRAGON_HP;
  setBusy(true);
  ui.title.classList.add('hidden');
  ui.win.classList.add('hidden');
  clearTray();
  hideEffect();
  renderPath();
  renderHearts();
  renderHand();
  ui.foe.innerHTML = '';
  await wait(300);
  snd.whoosh();
  renderFoe('flip-in');
  await wait(500);
  await refill();
  setBusy(false);
}

// ---- input ----
ui.hand.addEventListener('click', (e) => {
  sfx.unlock();
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.card');
  if (btn) void onCard(Number(btn.dataset.uid));
});
ui.roll.addEventListener('click', () => void attack());
ui.title.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.mode-btn');
  if (btn) void startGame(btn.dataset.long === '1');
});
ui.win.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#btn-again')) return;
  sfx.unlock();
  sfx.tap();
  ui.win.classList.add('hidden');
  renderTitle();
  ui.title.classList.remove('hidden');
});
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// ---- loop ----
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ui.fx.width = Math.round(innerWidth * dpr);
  ui.fx.height = Math.round(innerHeight * dpr);
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(t: number) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  if (!paused) {
    clock += dt * 1000;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= clock) timers.splice(i, 1)[0].done();
    }
    fx.update(dt);
  }
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  fx.draw(fxCtx);
  requestAnimationFrame(frame);
}

async function init() {
  playables.installErrorLogging();
  resize();
  ui.roll.innerHTML = ICON.dice;
  renderTitle();
  requestAnimationFrame(frame);
  playables.firstFrameReady();

  sfx.setEnabled(playables.isAudioEnabled());
  playables.onAudioEnabledChange((on) => sfx.setEnabled(on));
  playables.onPause(() => {
    paused = true;
    ui.app.classList.add('paused');
    sfx.pause();
  });
  playables.onResume(() => {
    paused = false;
    ui.app.classList.remove('paused');
    sfx.resume();
  });

  Object.assign(progress, await playables.load(SAVE_KEY, progress));
  renderTitle();
  playables.gameReady();
}

void init();
