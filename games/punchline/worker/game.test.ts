// Plays full games against the rules engine with a fake clock.
// Run: npm test -w @jack-games/punchline
import assert from 'node:assert/strict';
import { Game, GameError, TIMES } from './game.ts';
import { PROMPTS } from './prompts.ts';

function setup(n: number, familyFriendly = true) {
  let t = 0;
  let timers: { at: number; fn: () => void }[] = [];
  const g = new Game('ABCD', { familyFriendly }, {
    now: () => t,
    schedule: (ms, fn) => {
      const timer = { at: t + ms, fn };
      timers.push(timer);
      return () => (timers = timers.filter((x) => x !== timer));
    },
    changed: () => {},
  });
  let next = 0;
  const ids = Array.from({ length: n }, (_, i) => g.join(`P${i}`, undefined, () => `id${next++}`));
  const tick = (ms: number) => {
    t += ms;
    for (const x of timers.filter((x) => x.at <= t)) {
      timers = timers.filter((y) => y !== x);
      x.fn();
    }
  };
  return { g, ids, tick };
}

const throws = (fn: () => void) => assert.throws(fn, GameError);

// Lobby rules.
{
  const { g, ids } = setup(2);
  throws(() => g.start(ids[0])); // too few
  throws(() => g.join('p0', undefined, () => 'x')); // duplicate name
  g.join('P2', undefined, () => 'id2');
  throws(() => g.start(ids[1])); // not host
  g.start(ids[0]);
  throws(() => g.join('Late', undefined, () => 'late'));
  assert.equal(g.join('', ids[1], () => 'unused'), ids[1], 'reconnect keeps seat');
}

// Full game, everyone plays; also checks prompt pairing and family filter.
for (const n of [3, 4, 8]) {
  const { g, ids, tick } = setup(n);
  g.start(ids[0]);
  for (const round of [1, 2]) {
    assert.equal(g.phase, 'answer');
    const prompts = ids.map((id) => g.view(id).myPrompts);
    assert.ok(prompts.every((p) => p.length === 2), 'two prompts each');
    for (const p of prompts.flat()) assert.ok(PROMPTS.find((d) => d.text === p.text)!.familyFriendly);
    ids.forEach((id, i) => prompts[i].forEach((p, j) => g.answer(id, p.id, `${id} answer ${j} r${round}`)));
    let matchups = 0;
    while (g.phase === 'vote') {
      matchups++;
      const m = g.view(ids[0]).matchup!;
      for (const id of ids) {
        const v = g.view(id).matchup!;
        if (!v.yours) g.vote(id, [v.answers[0].id]);
      }
      assert.equal(g.phase, 'reveal');
      const r = g.view(ids[0]).matchup!;
      assert.equal(r.prompt, m.prompt);
      const pts = r.answers.map((a) => a.points!);
      assert.ok(pts[0] >= 1000 * round + 100 * round, `winner takes the pot (${pts})`);
      assert.equal(pts[1], 0);
      tick(TIMES.reveal);
    }
    assert.equal(matchups, n);
    assert.equal(g.phase, 'scores');
    tick(TIMES.scores);
  }
  assert.equal(g.phase, 'finalAnswer');
  for (const id of ids) g.answer(id, 'final', `final from ${id}`);
  assert.equal(g.phase, 'finalVote');
  for (const id of ids) {
    const others = g.view(id).matchup!.answers.filter((a) => !a.mine).map((a) => a.id);
    throws(() => g.vote(id, g.view(id).matchup!.answers.filter((a) => a.mine).map((a) => a.id)));
    g.vote(id, others.slice(0, 3));
  }
  assert.equal(g.phase, 'finalReveal');
  tick(TIMES.finalReveal);
  assert.equal(g.phase, 'end');
  const total = g.view(ids[0]).players.reduce((s, p) => s + p.score, 0);
  assert.ok(total > 0);
  g.again(ids[0]);
  assert.equal(g.phase, 'lobby');
  assert.ok(g.view(ids[0]).players.every((p) => p.score === 0));
}

// Jinx, forfeit, safety answers, timeouts.
{
  const { g, ids, tick } = setup(3);
  g.start(ids[0]);
  const mine = (id: string) => g.view(id).myPrompts;
  // Find the prompt shared by P0 and P1; both type the same thing → jinx.
  const shared = mine(ids[0]).find((p) => mine(ids[1]).some((q) => q.id === p.id))!;
  g.answer(ids[0], shared.id, 'Same Thing!');
  g.answer(ids[1], shared.id, 'same thing');
  // P2 uses a safety answer on one prompt and skips the other (forfeit for the partner).
  const [p2a] = mine(ids[2]);
  g.safety(ids[2], p2a.id);
  for (const id of ids.slice(0, 2)) for (const p of mine(id)) if (!p.answered) g.answer(id, p.id, `${id} ${p.id}`);
  tick(TIMES.answer);
  const seen = new Set<string>();
  while (g.phase === 'vote' || g.phase === 'reveal') {
    const m = g.view(ids[0]).matchup!;
    if (g.phase === 'reveal') {
      if (m.jinx) seen.add('jinx'), assert.ok(m.answers.every((a) => a.points === 0));
      if (m.forfeit) seen.add('forfeit'), assert.equal(m.answers[0].points, 1100);
      tick(TIMES.reveal);
      continue;
    }
    const s = m.answers.find((a) => a.safety);
    tick(TIMES.vote); // nobody votes → nobody scores
    const r = g.view(ids[0]).matchup!;
    assert.ok(r.answers.every((a) => a.points === 0));
    if (s) seen.add('safety');
  }
  assert.deepEqual([...seen].sort(), ['forfeit', 'jinx', 'safety']);
  assert.equal(g.phase, 'scores');
}

// Adult prompts show up when family friendly is off.
{
  const { g, ids } = setup(8, false);
  const texts = new Set<string>();
  for (let i = 0; i < 20; i++) {
    g.start(ids[0]);
    for (const p of g.view(ids[0]).myPrompts) texts.add(p.text);
    (g as unknown as { phase: string }).phase = 'end';
    g.again(ids[0]);
  }
  assert.ok([...texts].some((t) => !PROMPTS.find((d) => d.text === t)!.familyFriendly));
}

console.log('punchline rules: all tests passed');
