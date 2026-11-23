import assert from 'node:assert/strict'
import { Race, spinDuration, start } from '../src/race.ts'

function contactRun(side, gap, steer) {
  const race = new Race()
  race.cars.length = 2
  const [player, leader] = race.cars
  Object.assign(player, { s: start, x: side * 2.06, v: 78 })
  Object.assign(leader, { s: start + gap, x: 0, lane: 0, v: 78 })
  let impactTime = 0
  let hooked = false
  for (let tick = 0; tick < 240; tick++) {
    const previousSpeed = leader.v
    const previousSpin = leader.spin
    const incident = race.step(1/120, hooked ? 0 : steer, false)
    if (incident === 1) {
      impactTime = race.time
      hooked = true
      assert.ok(Math.abs(leader.v - previousSpeed) < 1, 'Quarter hook preserves initial forward speed')
      assert.ok(Math.abs(leader.spin - previousSpin) < .5, 'Rotation builds progressively')
    }
    assert.equal(player.recovery, 0)
  }
  if (hooked) {
    assert.ok(side * (player.x - leader.x) > 2.05)
    assert.ok(-side * leader.x > 3, 'Wreck slides away from the struck quarter')
    assert.ok(player.s - leader.s > 4.8, 'Chaser clears the wreck after releasing steering')
    assert.ok(leader.recovery > 0 && Math.cos(leader.yaw) < 0, 'Wreck is still facing away during the initial slide')
    while (leader.recovery > 0) race.step(1/120, 0, false)
    assert.ok(Math.abs(race.time - impactTime - 4) <= 1/120 + 1e-9, 'Recovery lasts four seconds')
    assert.ok(Math.abs(leader.yaw) < .1 && leader.v < 50, 'Wreck straightens at reduced speed')
    const rejoinSpeed = leader.v
    for (let tick = 0; tick < 120; tick++) race.step(1/120, 0, false)
    assert.ok(leader.v > rejoinSpeed && leader.v < rejoinSpeed + 7, 'Speed builds gradually on rejoin')
    for (let tick = 0; tick < 1200; tick++) race.step(1/120, 0, false)
    assert.ok(leader.v > 75 && !leader.rejoining, 'Driver returns to racing pace')
  }
  return hooked
}

for (const side of [-1, 1]) {
  assert.equal(contactRun(side, 3, -side), true, 'Sustained rear-quarter contact')
  assert.equal(contactRun(side, 0, -side), false, 'Door-to-door rub')
  assert.equal(contactRun(side, 3, side), false, 'Steering away')
}

// Clip either rear corner at speed, then hold a straight line past the wreck.
for (const offset of [-1.3, 0, 1.3]) {
  const race = new Race()
  race.cars.length = 2
  const [player, leader] = race.cars
  Object.assign(player, { s: start, x: offset, v: 90 })
  Object.assign(leader, { s: start + 5, x: 0, lane: 0, v: 78 })
  let spun = false
  for (let tick = 0; tick < 240; tick++) {
    if (race.step(1/120, 0, false) === 1) spun = true
  }
  assert.equal(spun, offset !== 0, 'Square bumper contact stays straight')
  if (spun) {
    assert.ok(-Math.sign(offset) * leader.x > 3)
    assert.ok(player.s - leader.s > 4.8)
  }
}

// A sideways wreck spans into both adjacent lanes. Hitting its exposed end
// should slow the chasing car and push the wreck forward.
function crosswiseWreck(offset) {
  const race = new Race()
  race.cars.length = 2
  const [player, wreck] = race.cars
  Object.assign(player, { s: start, x: offset, v: 82 })
  Object.assign(wreck, { s: start + 5, x: 0, lane: 0, v: 44, recovery: spinDuration, yaw: Math.PI/2 })
  for (let tick = 0; tick < 16; tick++) race.step(1/120, 0, false)
  return { player, wreck }
}
for (const side of [-1, 1]) {
  const hit = crosswiseWreck(side * 2.8)
  assert.ok(hit.player.v < 72 && hit.wreck.v > 55, 'Hitting the rotated body transfers speed')
  assert.ok(hit.wreck.s - hit.player.s > 3.3, 'Trailing bumper stays behind the wreck')
  const clear = crosswiseWreck(side * 4)
  assert.ok(clear.player.s > clear.wreck.s && clear.player.v > 81, 'Clear lane allows pass at racing speed')
}
