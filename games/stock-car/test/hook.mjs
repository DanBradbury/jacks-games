import assert from 'node:assert/strict'
import { Race, start } from '../src/race.ts'

function contactRun(side, gap, steer) {
  const race = new Race()
  race.cars.length = 2
  const [player, leader] = race.cars
  Object.assign(player, { s: start, x: side * 2.06, v: 78 })
  Object.assign(leader, { s: start + gap, x: 0, lane: 0, v: 78 })
  let hooked = false
  for (let tick = 0; tick < 120; tick++) {
    const previousSpeed = leader.v
    const previousSpin = leader.spin
    const incident = race.step(1/120, hooked ? side : steer, false)
    if (incident === 1) {
      hooked = true
      assert.ok(Math.abs(leader.v - previousSpeed) < 1, 'Quarter hook preserves initial forward speed')
      assert.ok(Math.abs(leader.spin - previousSpin) < .5, 'Rotation builds progressively')
    }
    assert.equal(player.recovery, 0)
  }
  if (hooked) {
    assert.ok(side * (player.x - leader.x) > 2.05)
    assert.ok(player.s > leader.s)
  }
  return hooked
}

for (const side of [-1, 1]) {
  assert.equal(contactRun(side, 3, -side), true, 'Sustained rear-quarter contact')
  assert.equal(contactRun(side, 0, -side), false, 'Door-to-door rub')
  assert.equal(contactRun(side, 3, side), false, 'Steering away')
}

// A sideways wreck spans into both adjacent lanes. Hitting its exposed end
// should slow the chasing car and push the wreck forward even with boost on.
function crosswiseWreck(offset) {
  const race = new Race()
  race.cars.length = 2
  const [player, wreck] = race.cars
  Object.assign(player, { s: start, x: offset, v: 82 })
  Object.assign(wreck, { s: start + 5, x: 0, lane: 0, v: 44, recovery: 2.4, yaw: Math.PI/2 })
  race.ignite()
  for (let tick = 0; tick < 16; tick++) race.step(1/120, 0, false)
  return { player, wreck }
}
for (const side of [-1, 1]) {
  const hit = crosswiseWreck(side * 2.8)
  assert.ok(hit.player.v < 72 && hit.wreck.v > 55, 'Hitting the rotated body transfers speed')
  assert.ok(hit.wreck.s - hit.player.s > 3.3, 'Trailing bumper stays behind the wreck')
  assert.ok(crosswiseWreck(side * 4).player.v > 82, 'Clear lane allows boosted pass')
}
