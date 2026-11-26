// Pure game rules for one room. No Cloudflare APIs here, so it runs under plain
// Node for tests: the room wires in a clock, timers and a broadcast callback.
//
// Rules (same shape as the classic prompt-and-vote party game):
//  - 3–8 players. Rounds 1 and 2: every player gets two prompts, and every prompt
//    goes to exactly two players. Everyone answers at once.
//  - Each prompt is then a head-to-head matchup voted on by everyone who didn't
//    write it. 1000 points per round number are split by vote share, the winner
//    gets +100 × round, and a clean sweep (every vote, 2+ voters) +250 × round.
//  - Identical answers are a jinx (nobody scores). If only one player answered,
//    they win the full pot without a vote. Safety answers score half.
//  - Round 3 (the final): one prompt for everyone, each player hands out up to
//    three votes to other people's answers, 300 points per vote, +300 for the top answer.

import {
  FINAL_VOTES,
  MAX_ANSWER,
  MAX_NAME,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Answer,
  type Matchup,
  type Phase,
  type PlayerInfo,
  type RoomState,
  type Settings,
} from '../src/protocol.ts';
import { PROMPTS, SAFETY_ANSWERS, type PromptDef } from './prompts.ts';

export const TIMES = {
  answer: 90_000,
  vote: 20_000,
  reveal: 8_000,
  scores: 10_000,
  finalAnswer: 80_000,
  finalVote: 40_000,
  finalReveal: 14_000,
};

export interface Env {
  now: () => number;
  schedule: (ms: number, fn: () => void) => () => void;
  changed: () => void;
  random?: () => number;
}

interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

interface Written {
  text: string;
  safety: boolean;
}

interface Contest {
  id: string;
  text: string;
  authors: string[];
  answers: Map<string, Written>;
  /** Display order + opaque ids, fixed when voting opens. */
  slots: { id: string; author: string }[];
  votes: Map<string, string[]>;
  result?: { points: Map<string, number>; winners: Set<string>; sweep: boolean; jinx: boolean; forfeit: boolean };
}

export class GameError extends Error {}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '') || s.trim().toLowerCase();

export class Game {
  readonly code: string;
  settings: Settings;
  phase: Phase = 'lobby';
  round = 0;
  deadline: number | null = null;
  private players = new Map<string, Player>();
  private vipId: string | null = null;
  private contests: Contest[] = [];
  private current = 0;
  private final: Contest | null = null;
  private used = new Set<string>();
  private cancelTimer: (() => void) | null = null;
  private rand: () => number;
  private env: Env;

  constructor(code: string, settings: Settings, env: Env) {
    this.env = env;
    this.code = code;
    this.settings = settings;
    this.rand = env.random ?? Math.random;
  }

  // ---- players ----

  join(name: string, playerId: string | undefined, newId: () => string): string {
    const known = playerId ? this.players.get(playerId) : undefined;
    if (known) {
      known.connected = true;
      if (!this.vipConnected()) this.vipId = known.id;
      this.env.changed();
      return known.id;
    }
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!clean) throw new GameError('Type a name first.');
    if (this.phase !== 'lobby') throw new GameError('That game already started. Ask for a new link!');
    // Offline lobby players don't hold a seat or a name.
    for (const p of [...this.players.values()]) if (!p.connected) this.players.delete(p.id);
    if (this.players.size >= MAX_PLAYERS) throw new GameError(`This game is full (${MAX_PLAYERS} players).`);
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === clean.toLowerCase()))
      throw new GameError('Someone already has that name.');
    const id = newId();
    this.players.set(id, { id, name: clean, score: 0, connected: true });
    if (!this.vipConnected()) this.vipId = id;
    this.env.changed();
    return id;
  }

  disconnect(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    if (this.vipId === id) this.vipId = [...this.players.values()].find((q) => q.connected)?.id ?? id;
    this.env.changed();
    this.checkDone();
  }

  isVip(id: string) {
    return this.vipId === id;
  }

  private vipConnected() {
    return !!this.vipId && !!this.players.get(this.vipId)?.connected;
  }

  private requireVip(id: string) {
    if (!this.isVip(id)) throw new GameError('Only the host can do that.');
  }

  // ---- host controls ----

  setSettings(id: string, settings: Settings) {
    this.requireVip(id);
    if (this.phase !== 'lobby') return;
    this.settings = { familyFriendly: !!settings.familyFriendly };
    this.env.changed();
  }

  start(id: string) {
    this.requireVip(id);
    if (this.phase !== 'lobby') return;
    for (const p of [...this.players.values()]) if (!p.connected) this.players.delete(p.id);
    if (this.players.size < MIN_PLAYERS) throw new GameError(`Need at least ${MIN_PLAYERS} players.`);
    for (const p of this.players.values()) p.score = 0;
    this.round = 0;
    this.startRound();
  }

  /** Host hurries along the reveal/scoreboard screens. */
  skip(id: string) {
    this.requireVip(id);
    if (this.phase === 'reveal' || this.phase === 'scores' || this.phase === 'finalReveal') this.advance();
  }

  again(id: string) {
    this.requireVip(id);
    if (this.phase !== 'end') return;
    this.clearTimer();
    for (const p of [...this.players.values()]) {
      if (!p.connected) this.players.delete(p.id);
      else p.score = 0;
    }
    this.phase = 'lobby';
    this.round = 0;
    this.deadline = null;
    this.contests = [];
    this.final = null;
    this.env.changed();
  }

  // ---- answers + votes ----

  answer(id: string, promptId: string, text: string, safety = false) {
    const c = this.answerable(id, promptId);
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER);
    if (!clean) throw new GameError('Type an answer first.');
    c.answers.set(id, { text: clean, safety });
    this.env.changed();
    this.checkDone();
  }

  safety(id: string, promptId: string) {
    this.answerable(id, promptId);
    this.answer(id, promptId, SAFETY_ANSWERS[Math.floor(this.rand() * SAFETY_ANSWERS.length)], true);
  }

  private answerable(id: string, promptId: string): Contest {
    const pool = this.phase === 'answer' ? this.contests : this.phase === 'finalAnswer' && this.final ? [this.final] : [];
    const c = pool.find((x) => x.id === promptId);
    if (!c || !c.authors.includes(id)) throw new GameError("That prompt isn't yours right now.");
    if (c.answers.has(id)) throw new GameError('Already answered.');
    return c;
  }

  vote(id: string, answerIds: string[]) {
    const c = this.votingContest();
    if (!c || !this.voters(c).includes(id)) throw new GameError("You can't vote on this one.");
    const own = new Set(c.slots.filter((s) => s.author === id).map((s) => s.id));
    const valid = new Set(c.slots.map((s) => s.id));
    const picks = [...new Set(answerIds)].filter((a) => valid.has(a) && !own.has(a));
    const max = this.phase === 'finalVote' ? FINAL_VOTES : 1;
    if (picks.length < 1 || picks.length > max) throw new GameError(max === 1 ? 'Pick one answer.' : `Pick up to ${max}.`);
    c.votes.set(id, picks);
    this.env.changed();
    this.checkDone();
  }

  private votingContest(): Contest | null {
    if (this.phase === 'vote') return this.contests[this.current] ?? null;
    if (this.phase === 'finalVote') return this.final;
    return null;
  }

  private voters(c: Contest): string[] {
    const all = [...this.players.keys()];
    // In the final everyone votes (just not for themselves).
    return c === this.final ? all : all.filter((p) => !c.authors.includes(p));
  }

  // ---- flow ----

  private startRound() {
    this.round++;
    if (this.round === 3) return this.startFinal();
    const ids = this.shuffle([...this.players.keys()]);
    const prompts = this.draw(ids.length);
    // A ring: prompt i goes to players i and i+1, so everyone gets exactly two.
    this.contests = prompts.map((p, i) => ({
      id: `r${this.round}p${i}`,
      text: p.text,
      authors: [ids[i], ids[(i + 1) % ids.length]],
      answers: new Map(),
      slots: [],
      votes: new Map(),
    }));
    this.current = 0;
    this.enter('answer', TIMES.answer);
  }

  private startFinal() {
    const [p] = this.draw(1);
    this.final = {
      id: 'final',
      text: p.text,
      authors: [...this.players.keys()],
      answers: new Map(),
      slots: [],
      votes: new Map(),
    };
    this.enter('finalAnswer', TIMES.finalAnswer);
  }

  private draw(n: number): PromptDef[] {
    let pool = PROMPTS.filter((p) => (!this.settings.familyFriendly || p.familyFriendly) && !this.used.has(p.text));
    if (pool.length < n) {
      for (const p of PROMPTS) this.used.delete(p.text);
      pool = PROMPTS.filter((p) => !this.settings.familyFriendly || p.familyFriendly);
    }
    const picks = this.shuffle(pool).slice(0, n);
    for (const p of picks) this.used.add(p.text);
    return picks;
  }

  private enter(phase: Phase, ms: number | null) {
    this.clearTimer();
    this.phase = phase;
    this.deadline = ms === null ? null : this.env.now() + ms;
    if (ms !== null) this.cancelTimer = this.env.schedule(ms, () => this.advance());
    this.env.changed();
  }

  private clearTimer() {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  /** End the current step early once every connected player has acted. */
  private checkDone() {
    const online = (ids: string[]) => ids.filter((p) => this.players.get(p)?.connected);
    if (this.phase === 'answer' || this.phase === 'finalAnswer') {
      const pool = this.phase === 'answer' ? this.contests : [this.final!];
      if (pool.every((c) => online(c.authors).every((a) => c.answers.has(a)))) this.advance();
    } else if (this.phase === 'vote' || this.phase === 'finalVote') {
      const c = this.votingContest()!;
      if (online(this.voters(c)).every((v) => c.votes.has(v))) this.advance();
    }
  }

  private advance() {
    switch (this.phase) {
      case 'answer':
        this.current = -1;
        return this.nextMatchup();
      case 'vote':
        this.score(this.contests[this.current]);
        return this.enter('reveal', TIMES.reveal);
      case 'reveal':
        return this.nextMatchup();
      case 'scores':
        return this.startRound();
      case 'finalAnswer': {
        const c = this.final!;
        c.slots = this.makeSlots(c);
        if (c.slots.length < 2) {
          this.scoreFinal(c);
          return this.enter('finalReveal', TIMES.finalReveal);
        }
        return this.enter('finalVote', TIMES.finalVote);
      }
      case 'finalVote':
        this.scoreFinal(this.final!);
        return this.enter('finalReveal', TIMES.finalReveal);
      case 'finalReveal':
        return this.enter('end', null);
    }
  }

  private nextMatchup() {
    while (++this.current < this.contests.length) {
      const c = this.contests[this.current];
      c.slots = this.makeSlots(c);
      if (c.slots.length === 0) continue; // nobody answered: skip it
      const [a, b] = c.authors.map((x) => c.answers.get(x));
      if (c.slots.length === 1 || norm(a!.text) === norm(b!.text)) {
        this.score(c);
        return this.enter('reveal', TIMES.reveal);
      }
      return this.enter('vote', TIMES.vote);
    }
    this.enter('scores', TIMES.scores);
  }

  private makeSlots(c: Contest) {
    const authors = this.shuffle(c.authors.filter((a) => c.answers.has(a)));
    return authors.map((author, i) => ({ id: `${c.id}a${i}`, author }));
  }

  private score(c: Contest) {
    const r = this.round;
    const points = new Map<string, number>(c.authors.map((a) => [a, 0]));
    const winners = new Set<string>();
    let sweep = false;
    let jinx = false;
    const forfeit = c.slots.length === 1;
    if (forfeit) {
      const a = c.slots[0].author;
      winners.add(a);
      points.set(a, this.half(c, a, 1000 * r) + 100 * r);
    } else {
      const [x, y] = c.slots.map((s) => s.author);
      jinx = norm(c.answers.get(x)!.text) === norm(c.answers.get(y)!.text);
      if (!jinx) {
        const tally = this.tally(c);
        const total = [...tally.values()].reduce((s, v) => s + v, 0);
        for (const { author, id } of c.slots) {
          const v = tally.get(id) ?? 0;
          points.set(author, total ? this.half(c, author, Math.round((1000 * r * v) / total)) : 0);
        }
        const [vx, vy] = c.slots.map((s) => tally.get(s.id) ?? 0);
        if (vx !== vy) {
          const w = vx > vy ? x : y;
          winners.add(w);
          sweep = total >= 2 && Math.min(vx, vy) === 0;
          points.set(w, points.get(w)! + 100 * r + (sweep ? 250 * r : 0));
        }
      }
    }
    for (const [a, p] of points) this.players.get(a)!.score += p;
    c.result = { points, winners, sweep, jinx, forfeit };
  }

  private scoreFinal(c: Contest) {
    const tally = this.tally(c);
    const points = new Map<string, number>();
    const top = Math.max(0, ...tally.values());
    const winners = new Set<string>();
    for (const { id, author } of c.slots) {
      const v = tally.get(id) ?? 0;
      let p = this.half(c, author, v * 300);
      if (v > 0 && v === top) {
        winners.add(author);
        p += 300;
      }
      points.set(author, p);
      this.players.get(author)!.score += p;
    }
    c.result = { points, winners, sweep: false, jinx: false, forfeit: c.slots.length === 1 };
  }

  private tally(c: Contest) {
    const t = new Map<string, number>();
    for (const picks of c.votes.values()) for (const a of picks) t.set(a, (t.get(a) ?? 0) + 1);
    return t;
  }

  private half(c: Contest, author: string, pts: number) {
    return c.answers.get(author)?.safety ? Math.round(pts / 2) : pts;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- views ----

  view(me: string): RoomState {
    const c = this.visibleContest();
    const doneIds = this.doneIds();
    const players: PlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.connected,
      vip: p.id === this.vipId,
      done: doneIds.has(p.id),
    }));
    const pool = this.phase === 'answer' ? this.contests : this.phase === 'finalAnswer' && this.final ? [this.final] : [];
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      settings: this.settings,
      players,
      deadline: this.deadline,
      now: this.env.now(),
      me,
      myPrompts: pool.filter((x) => x.authors.includes(me)).map((x) => ({ id: x.id, text: x.text, answered: x.answers.has(me) })),
      matchup: c ? this.matchupView(c, me) : null,
    };
  }

  private visibleContest(): Contest | null {
    if (this.phase === 'vote' || this.phase === 'reveal') return this.contests[this.current] ?? null;
    if (this.phase === 'finalVote' || this.phase === 'finalReveal') return this.final;
    return null;
  }

  private doneIds(): Set<string> {
    const done = new Set<string>();
    if (this.phase === 'answer' || this.phase === 'finalAnswer') {
      const pool = this.phase === 'answer' ? this.contests : [this.final!];
      for (const id of this.players.keys()) {
        const mine = pool.filter((c) => c.authors.includes(id));
        if (mine.every((c) => c.answers.has(id))) done.add(id);
      }
    } else if (this.phase === 'vote' || this.phase === 'finalVote') {
      const c = this.votingContest()!;
      for (const id of c.votes.keys()) done.add(id);
    }
    return done;
  }

  private matchupView(c: Contest, me: string): Matchup {
    const revealed = !!c.result;
    const tally = this.tally(c);
    const name = (id: string) => this.players.get(id)?.name ?? '?';
    const answers: Answer[] = c.slots.map((s) => {
      const w = c.answers.get(s.author)!;
      const a: Answer = { id: s.id, text: w.text, safety: w.safety || undefined, mine: s.author === me || undefined };
      if (revealed) {
        a.author = name(s.author);
        a.votes = tally.get(s.id) ?? 0;
        a.voters = [...c.votes].filter(([, picks]) => picks.includes(s.id)).map(([v]) => name(v));
        a.points = c.result!.points.get(s.author) ?? 0;
        a.winner = c.result!.winners.has(s.author) || undefined;
      }
      return a;
    });
    const isFinal = c === this.final;
    return {
      index: isFinal ? 0 : this.contests.filter((x, i) => i <= this.current && x.slots.length > 0).length - 1,
      total: isFinal ? 1 : this.contests.filter((x) => x.answers.size > 0).length,
      prompt: c.text,
      answers,
      yours: !isFinal && c.authors.includes(me),
      myVotes: c.votes.get(me) ?? [],
      sweep: c.result?.sweep || undefined,
      jinx: c.result?.jinx || undefined,
      forfeit: c.result?.forfeit || undefined,
    };
  }
}
