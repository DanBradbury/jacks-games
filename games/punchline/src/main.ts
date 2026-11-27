import { Particles, Sfx } from '@jack-games/kit';
import qrcode from 'qrcode-generator';
import './style.css';
import {
  FINAL_VOTES,
  MAX_ANSWER,
  MAX_NAME,
  MIN_PLAYERS,
  type Answer,
  type ClientMsg,
  type RoomState,
  type ServerMsg,
} from './protocol';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const app = $<HTMLElement>('#app');
const timerEl = $<HTMLElement>('#timer');
const timerBar = $<HTMLElement>('#timer-bar');
const timerNum = $<HTMLElement>('#timer-num');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`punchline:${k}`);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`punchline:${k}`, v);
    } catch {
      // private mode: rejoining after a refresh just asks for a name again
    }
  },
};

// ---- sound + celebration ----

const sfx = new Sfx();
const fx = new Particles();
const canvas = $<HTMLCanvasElement>('#fx');
const fxCtx = canvas.getContext('2d')!;
const CONFETTI = ['#ff5a36', '#13a597', '#ffc83d', '#3d7bff', '#ffffff'];
let last = performance.now();
function frame(now: number) {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== innerWidth * dpr) {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  fx.update(Math.min(0.05, (now - last) / 1000));
  last = now;
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  fx.draw(fxCtx);
  tickTimer();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const burstAt = (el: Element | null, count = 30) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { colors: CONFETTI, count, speed: 380 });
};
const confetti = () => fx.confetti(innerWidth, innerHeight, CONFETTI, 160);

// Every tap makes a sound (and unlocks audio on the first one).
document.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if ((e.target as HTMLElement).closest('button')) sfx.tap();
});

let toastTimer = 0;
function toast(msg: string) {
  const t = $<HTMLElement>('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('on'), 3200);
}

// ---- connection ----

let ws: WebSocket | null = null;
let state: RoomState | null = null;
let clockSkew = 0; // server now - local now
let roomCode = '';
let myName = '';
let retry = 0;
let fatal = false;

const send = (msg: ClientMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

function connect(code: string, name: string) {
  roomCode = code;
  myName = name;
  fatal = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws`);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    send({ t: 'join', name, playerId: store.get(`room:${code}`) ?? undefined });
  };
  sock.onmessage = (e) => onServer(JSON.parse(e.data) as ServerMsg);
  sock.onclose = () => {
    if (ws !== sock || fatal) return;
    // Phones drop sockets when the screen locks; quietly come back.
    retry = Math.min(retry + 1, 6);
    setTimeout(() => ws === sock && connect(roomCode, myName), 400 * retry);
  };
}

function onServer(msg: ServerMsg) {
  if (msg.t === 'welcome') {
    store.set(`room:${roomCode}`, msg.playerId);
  } else if (msg.t === 'error') {
    toast(msg.message);
    if (msg.fatal) {
      fatal = true;
      ws?.close();
      renderHome(msg.message);
    } else if (!state) {
      // Join was refused (name taken, game full…): let them try again.
      fatal = true;
      ws?.close();
      renderJoin(roomCode, msg.message);
    }
  } else {
    const prev = state;
    state = msg.state;
    clockSkew = state.now - Date.now();
    render(prev);
  }
}

// ---- routing ----

function route() {
  const code = location.pathname.slice(1).toUpperCase();
  if (/^[A-Z]{4}$/.test(code)) {
    const name = store.get('name');
    if (store.get(`room:${code}`) && name) connect(code, name);
    else renderJoin(code);
  } else {
    renderHome();
  }
}

function go(code: string, name: string) {
  store.set('name', name);
  history.pushState(null, '', `/${code}`);
  app.innerHTML = `<p class="waiting">Joining ${code}…</p>`;
  connect(code, name);
}

window.addEventListener('popstate', () => {
  fatal = true;
  ws?.close();
  ws = null;
  state = null;
  route();
});

// ---- screens: home + join ----

const nameField = (id: string) =>
  `<label for="${id}">Your name</label>
   <input id="${id}" type="text" maxlength="${MAX_NAME}" autocomplete="nickname" value="${esc(store.get('name') ?? '')}" />`;

function title() {
  return `<header><h1>Punchline Party<span class="dot">!</span></h1>
    <p class="sub">Answer silly prompts. Vote for the funniest. Phones out!</p></header>`;
}

function renderHome(error?: string) {
  state = null;
  setTimer(null);
  app.innerHTML = `${title()}
    <section class="card">
      <h2>Start a game</h2>
      ${nameField('host-name')}
      <label class="toggle"><span>Family friendly<small>Only kid-safe prompts</small></span>
        <input id="ff" type="checkbox" checked /></label>
      <button class="primary" id="create">Create game</button>
    </section>
    <p class="or">or</p>
    <section class="card">
      <h2>Join a game</h2>
      <label for="code">Room code</label>
      <input id="code" class="code-input" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" />
      ${nameField('join-name')}
      <button id="join">Join</button>
    </section>`;
  if (error) toast(error);
  $<HTMLButtonElement>('#create').onclick = async (e) => {
    const name = $<HTMLInputElement>('#host-name').value.trim();
    if (!name) return toast('Type your name first.');
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ familyFriendly: $<HTMLInputElement>('#ff').checked }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!data.code) throw new Error(data.error);
      go(data.code, name);
    } catch {
      btn.disabled = false;
      toast("Couldn't make a room. Try again?");
    }
  };
  $<HTMLButtonElement>('#join').onclick = () => {
    const code = $<HTMLInputElement>('#code').value.trim().toUpperCase();
    const name = $<HTMLInputElement>('#join-name').value.trim();
    if (!/^[A-Z]{4}$/.test(code)) return toast('Room codes are 4 letters.');
    if (!name) return toast('Type your name first.');
    void checkThenGo(code, name);
  };
}

async function checkThenGo(code: string, name: string) {
  const res = await fetch(`/api/rooms/${code}`).catch(() => null);
  if (!res?.ok) return toast(`No room called ${code}.`);
  go(code, name);
}

function renderJoin(code: string, error?: string) {
  state = null;
  setTimer(null);
  app.innerHTML = `${title()}
    <section class="card">
      <p class="tag">Joining room</p>
      <div class="roomcode">${esc(code)}</div>
      ${nameField('name')}
      <button class="primary" id="join">Join game</button>
      <button class="ghost" id="home">Start a different game</button>
    </section>`;
  if (error) toast(error);
  const input = $<HTMLInputElement>('#name');
  const join = () => {
    const name = input.value.trim();
    if (!name) return toast('Type your name first.');
    void checkThenGo(code, name);
  };
  $<HTMLButtonElement>('#join').onclick = join;
  input.onkeydown = (e) => e.key === 'Enter' && join();
  $<HTMLButtonElement>('#home').onclick = () => {
    history.pushState(null, '', '/');
    renderHome();
  };
}

// ---- screens: in a room ----

let screenKey = '';
const drafts = new Map<string, string>();

function render(prev: RoomState | null) {
  const s = state!;
  const me = s.players.find((p) => p.id === s.me);
  const vip = !!me?.vip;
  setTimer(s.deadline);
  const firstOpen = s.myPrompts.find((p) => !p.answered);
  // Only rebuild the main screen when what you can do changes; otherwise just
  // refresh the player chips, so typing and focus survive other people's moves.
  const key = JSON.stringify([
    s.phase,
    s.round,
    s.matchup?.index,
    s.matchup?.myVotes,
    !!s.matchup?.answers[0]?.author,
    firstOpen?.id,
    vip,
    s.phase === 'lobby' || s.phase === 'scores' || s.phase === 'end' ? [s.players.map((p) => [p.id, p.score, p.vip]), s.settings] : 0,
  ]);
  if (key !== screenKey) {
    screenKey = key;
    app.innerHTML = screen(s, vip);
    wire(s);
    celebrate(s, prev);
  }
  const chips = document.getElementById('chips');
  if (chips) chips.innerHTML = playerChips(s);
}

function playerChips(s: RoomState) {
  const showDone = ['answer', 'finalAnswer', 'vote', 'finalVote'].includes(s.phase);
  return s.players
    .map(
      (p) =>
        `<li class="chip${p.id === s.me ? ' me' : ''}${!p.connected ? ' off' : ''}${showDone && p.done ? ' done' : ''}">${esc(p.name)}${
          p.vip ? '<span class="host">HOST</span>' : ''
        }</li>`,
    )
    .join('');
}

// Native share sheet on phones; desktops just copy the link.
const canShare = () => matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function';

// Scan-to-join code for the lobby, drawn locally as an SVG (no network).
function qrSvg(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
}

const chipsBlock = (label: string) => `<div><p class="tag">${label}</p><ul class="players" id="chips"></ul></div>`;
const hostName = (s: RoomState) => esc(s.players.find((p) => p.vip)?.name ?? 'the host');
const roundLabel = (s: RoomState) => (s.round >= 3 ? 'Final round' : `Round ${s.round}`);

function screen(s: RoomState, vip: boolean): string {
  switch (s.phase) {
    case 'lobby':
      return lobby(s, vip);
    case 'answer':
    case 'finalAnswer':
      return answerScreen(s);
    case 'vote':
      return voteScreen(s);
    case 'finalVote':
      return finalVoteScreen(s);
    case 'reveal':
    case 'finalReveal':
      return revealScreen(s, vip);
    case 'scores':
      return scoresScreen(s, vip);
    case 'end':
      return endScreen(s, vip);
  }
}

function lobby(s: RoomState, vip: boolean) {
  const link = `${location.origin}/${s.code}`;
  const need = Math.max(0, MIN_PLAYERS - s.players.filter((p) => p.connected).length);
  return `${title()}
    <section class="card">
      <p class="tag">Room code</p>
      <div class="roomcode">${esc(s.code)}</div>
      <div class="qr" role="img" aria-label="QR code to join ${esc(s.code)}">${qrSvg(link)}</div>
      <p class="center sub">Scan with a phone camera to join</p>
      <div class="link">${esc(link)}</div>
      <button id="share">${canShare() ? 'Share invite link' : 'Copy invite link'}</button>
    </section>
    <section class="card">
      ${chipsBlock(`Players (${s.players.length}/8)`)}
      <label class="toggle"><span>Family friendly<small>${vip ? 'Only kid-safe prompts' : `${hostName(s)} picks this`}</small></span>
        <input id="ff" type="checkbox" ${s.settings.familyFriendly ? 'checked' : ''} ${vip ? '' : 'disabled'} /></label>
      ${
        vip
          ? `<button class="primary" id="start" ${need ? 'disabled' : ''}>${need ? `Need ${need} more player${need > 1 ? 's' : ''}` : 'Everybody’s in. Start!'}</button>`
          : `<p class="waiting">Waiting for ${hostName(s)} to start…</p>`
      }
    </section>
    <section class="card">
      <h3>How to play</h3>
      <p class="sub">Everyone gets two prompts. Type the funniest answer you can. Then each prompt goes head to head, and everyone else votes. Round 2 is worth double. The final round puts everyone on the same prompt.</p>
    </section>`;
}

function answerScreen(s: RoomState) {
  const open = s.myPrompts.find((p) => !p.answered);
  if (!open) {
    return `<p class="tag">${roundLabel(s)}</p>
      <p class="waiting">Answers locked in!</p>
      <p class="center sub">Waiting for everyone else to finish…</p>
      ${chipsBlock('Done when green')}`;
  }
  const n = s.myPrompts.indexOf(open) + 1;
  const draft = drafts.get(open.id) ?? '';
  return `<p class="tag">${roundLabel(s)}${s.myPrompts.length > 1 ? ` · Prompt ${n} of ${s.myPrompts.length}` : ''}</p>
    <section class="card">
      <div class="prompt">${esc(open.text)}</div>
      <textarea id="answer" maxlength="${MAX_ANSWER}" enterkeyhint="send" placeholder="Your funniest answer">${esc(draft)}</textarea>
      <span class="count" id="count">${draft.length}/${MAX_ANSWER}</span>
      <button class="primary" id="submit" data-id="${open.id}">Send it</button>
      <button class="ghost" id="safety" data-id="${open.id}">Stuck? Use a safety answer (half points)</button>
    </section>
    ${chipsBlock('Done when green')}`;
}

function voteScreen(s: RoomState) {
  const m = s.matchup!;
  const voted = m.myVotes.length > 0;
  const choices = m.answers
    .map(
      (a, i) =>
        `${i ? '<div class="vs">VS</div>' : ''}<button class="choice${m.myVotes.includes(a.id) ? ' picked' : ''}" data-id="${a.id}" ${
          m.yours || voted ? 'disabled' : ''
        }>${esc(a.text)}${a.safety ? '<span class="note">safety answer</span>' : ''}</button>`,
    )
    .join('');
  return `<p class="tag">${roundLabel(s)} · Matchup ${m.index + 1} of ${m.total}</p>
    <div class="prompt">${esc(m.prompt)}</div>
    <div class="choices">${choices}</div>
    <p class="waiting">${m.yours ? 'You wrote one of these! Sit tight.' : voted ? 'Vote in!' : 'Tap your favorite'}</p>
    ${chipsBlock('Voted when green')}`;
}

let finalPicks = new Set<string>();

function finalVoteScreen(s: RoomState) {
  const m = s.matchup!;
  const voted = m.myVotes.length > 0;
  if (!voted) finalPicks = new Set([...finalPicks].filter((id) => m.answers.some((a) => a.id === id)));
  const picks = voted ? new Set(m.myVotes) : finalPicks;
  const choices = m.answers
    .map(
      (a) =>
        `<button class="choice${picks.has(a.id) ? ' picked' : ''}${a.mine ? ' mine' : ''}" data-id="${a.id}" ${a.mine || voted ? 'disabled' : ''}>${esc(
          a.text,
        )}${a.mine ? '<span class="note">yours</span>' : a.safety ? '<span class="note">safety answer</span>' : ''}</button>`,
    )
    .join('');
  return `<p class="tag">Final round · Pick up to ${FINAL_VOTES}</p>
    <div class="prompt">${esc(m.prompt)}</div>
    <div class="choices">${choices}</div>
    ${
      voted
        ? '<p class="waiting">Votes in!</p>'
        : `<button class="primary" id="cast" ${picks.size ? '' : 'disabled'}>Vote for ${picks.size || 'your favorites'}</button>`
    }
    ${chipsBlock('Voted when green')}`;
}

function revealScreen(s: RoomState, vip: boolean) {
  const m = s.matchup!;
  const final = s.phase === 'finalReveal';
  const answers = final ? [...m.answers].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)) : m.answers;
  const banner = m.jinx ? 'JINX!' : m.sweep ? 'CLEAN SWEEP!' : m.forfeit ? 'Won by no-show!' : '';
  return `<p class="tag">${final ? 'Final round' : `${roundLabel(s)} · Matchup ${m.index + 1} of ${m.total}`}</p>
    <div class="prompt">${esc(m.prompt)}</div>
    ${banner ? `<div class="banner">${banner}</div>` : ''}
    <div class="choices">${answers.map((a, i) => result(a, i)).join('')}</div>
    ${vip ? '<button id="skip">Next</button>' : ''}`;
}

function result(a: Answer, i: number) {
  const voters = a.voters?.length ? `Votes: ${a.voters.map(esc).join(', ')}` : 'No votes';
  return `<div class="result${a.winner ? ' win' : ''}" style="animation-delay:${i * 0.15}s">
    <div class="text">${esc(a.text)}</div>
    <div class="by"><span>${a.winner ? '🏆 ' : ''}${esc(a.author ?? '')}${a.safety ? ' <span class="note">(safety)</span>' : ''}</span>
      <span class="pts">+${a.points ?? 0}</span></div>
    <div class="voters">${voters}</div>
  </div>`;
}

function board(s: RoomState) {
  return `<ol class="board">${[...s.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => `<li style="animation-delay:${i * 0.07}s"><span class="rank">${i + 1}</span><span class="name">${esc(p.name)}</span><span>${p.score}</span></li>`)
    .join('')}</ol>`;
}

function scoresScreen(s: RoomState, vip: boolean) {
  const next = s.round === 1 ? 'Round 2 is worth double!' : 'Final round next: everyone answers the same prompt.';
  return `<h2>Scores after ${roundLabel(s).toLowerCase()}</h2>
    ${board(s)}
    <p class="waiting">${next}</p>
    ${vip ? '<button class="primary" id="skip">Keep going</button>' : ''}`;
}

function endScreen(s: RoomState, vip: boolean) {
  const top = Math.max(...s.players.map((p) => p.score));
  const winners = s.players.filter((p) => p.score === top).map((p) => esc(p.name));
  return `<div class="banner" id="winner">${winners.join(' & ')} win${winners.length > 1 ? '' : 's'}!</div>
    ${board(s)}
    ${vip ? '<button class="primary" id="again">Play again</button>' : `<p class="waiting">${hostName(s)} can start another round.</p>`}
    <button class="ghost" id="home">Leave game</button>`;
}

function wire(s: RoomState) {
  const on = (id: string, fn: (el: HTMLElement) => void) => {
    const el = document.getElementById(id);
    if (el) el.onclick = () => fn(el);
  };
  on('share', async () => {
    const url = `${location.origin}/${s.code}`;
    if (canShare()) {
      await navigator.share({ title: 'Punchline Party', text: `Join my game! Code ${s.code}`, url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(url);
      toast('Link copied!');
    }
  });
  const ff = document.getElementById('ff') as HTMLInputElement | null;
  if (ff) ff.onchange = () => send({ t: 'settings', settings: { familyFriendly: ff.checked } });
  on('start', () => send({ t: 'start' }));
  on('skip', () => send({ t: 'skip' }));
  on('again', () => send({ t: 'again' }));
  on('home', () => {
    fatal = true;
    ws?.close();
    history.pushState(null, '', '/');
    renderHome();
  });

  const answer = document.getElementById('answer') as HTMLTextAreaElement | null;
  if (answer) {
    const id = $<HTMLElement>('#submit').dataset.id!;
    const submit = () => {
      const text = answer.value.trim();
      if (!text) return toast('Type something funny first!');
      drafts.delete(id);
      sfx.chime();
      burstAt(answer, 24);
      send({ t: 'answer', promptId: id, text });
    };
    answer.oninput = () => {
      drafts.set(id, answer.value);
      $<HTMLElement>('#count').textContent = `${answer.value.length}/${MAX_ANSWER}`;
    };
    answer.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };
    on('submit', submit);
    on('safety', () => {
      drafts.delete(id);
      sfx.pop();
      send({ t: 'safety', promptId: id });
    });
    // Focusing pops the keyboard on phones; only do it on wide screens.
    if (matchMedia('(pointer: fine)').matches) answer.focus();
  }

  for (const el of document.querySelectorAll<HTMLButtonElement>('.choice')) {
    el.onclick = () => {
      const id = el.dataset.id!;
      if (s.phase === 'vote') {
        sfx.pop(4);
        burstAt(el, 20);
        send({ t: 'vote', answerIds: [id] });
      } else if (s.phase === 'finalVote') {
        if (finalPicks.has(id)) finalPicks.delete(id);
        else if (finalPicks.size < FINAL_VOTES) finalPicks.add(id);
        else return toast(`You only get ${FINAL_VOTES} votes.`);
        sfx.pop(finalPicks.size);
        screenKey = '';
        render(s);
      }
    };
  }
  on('cast', () => {
    sfx.chime();
    send({ t: 'vote', answerIds: [...finalPicks] });
    finalPicks = new Set();
  });
}

function celebrate(s: RoomState, prev: RoomState | null) {
  const changed = prev?.phase !== s.phase || prev?.matchup?.index !== s.matchup?.index;
  if (!changed) return;
  if (s.phase === 'reveal' || s.phase === 'finalReveal') {
    const m = s.matchup!;
    sfx.whoosh();
    setTimeout(() => {
      if (m.jinx) return sfx.boop();
      if (m.sweep) {
        sfx.fanfare();
        confetti();
      } else sfx.chime();
      for (const el of document.querySelectorAll('.result.win')) burstAt(el, 40);
    }, 450);
  } else if (s.phase === 'scores') {
    sfx.sparkle(2);
  } else if (s.phase === 'end') {
    sfx.fanfare();
    confetti();
    setTimeout(confetti, 900);
  } else if (s.phase === 'answer' || s.phase === 'finalAnswer' || s.phase === 'vote' || s.phase === 'finalVote') {
    sfx.whoosh();
  }
}

// ---- countdown ----

let deadline: number | null = null;
let total = 1;
let lastSecond = -1;

function setTimer(d: number | null) {
  if (d !== deadline) {
    deadline = d;
    total = d ? Math.max(1, d - (Date.now() + clockSkew)) : 1;
  }
  timerEl.classList.toggle('on', !!d);
}

function tickTimer() {
  if (!deadline) return;
  const left = Math.max(0, deadline - (Date.now() + clockSkew));
  const sec = Math.ceil(left / 1000);
  timerBar.style.transform = `scaleX(${left / total})`;
  timerNum.textContent = String(sec);
  timerEl.classList.toggle('low', sec <= 5);
  const acting = state && ['answer', 'finalAnswer', 'vote', 'finalVote'].includes(state.phase);
  if (sec !== lastSecond && sec > 0 && sec <= 5 && acting) sfx.tick();
  lastSecond = sec;
}

route();
