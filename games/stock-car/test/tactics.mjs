import assert from 'node:assert/strict'
import { Race, start, track } from '../src/race.ts'

function duel(gap, playerSpeed, rivalSpeed) {
  const race = new Race()
  race.cars.length = 2
  const [player, rival] = race.cars
  Object.assign(player, { v: playerSpeed })
  Object.assign(rival, { s: start + gap, x: 2.6, lane: 2.6, v: rivalSpeed })
  return { race, player, rival }
}

// Hold the player's line through the banking while the rival builds a run.
for (const [gap, offset, playerSpeed] of [[-28, 5.2, 80], [-7, 0, 80], [2, 3.8, 86]]) {
  const { race, player, rival } = duel(gap, playerSpeed, 79)
  rival.x = rival.lane = player.x + offset
  let tuckedIn = false
  let passedByPlayer = false
  for (let tick = 0; tick < 1440 && rival.s < player.s + 5; tick++) {
    const steer = (-2.6 - player.x - player.v ** 2 * track(player.s).bend * .28) / 10.8
    race.step(1/120, steer, false)
    if (player.s - rival.s > 4.8) passedByPlayer = true
    if (rival.s < player.s && Math.abs(rival.x - player.x) < 1 && rival.v > player.v + 1) tuckedIn = true
    assert.equal(race.events.length, 0, 'Pass stays clear of contact')
  }
  assert.ok(passedByPlayer, 'Player gets clear of the rival')
  assert.ok(tuckedIn, 'Rival uses the wake to gain speed')
  assert.ok(rival.s >= player.s + 5, 'Rival clears the player')
}

{
  const { race, player, rival } = duel(22, 87, 79)
  race.step(1/120, 0, false)
  assert.equal(rival.lane, player.x, 'Leader covers the approaching player')
  player.x = 6.4
  for (let tick = 0; tick < 60; tick++) race.step(1/120, 0, false)
  assert.equal(rival.lane, -2.6, 'Leader commits to one defensive move')
}

for (const [gap, speed] of [[3, 87], [22, 75]]) {
  const { race, rival } = duel(gap, speed, 79)
  race.step(1/120, 0, false)
  assert.equal(rival.lane, 2.6, 'Leader holds line alongside or when pulling away')
}

{
  const { race, rival } = duel(22, 87, 79)
  race.cars.push({ ...rival, x: 0, lane: 0 })
  race.step(1/120, 0, false)
  assert.equal(rival.lane, 2.6, 'Traffic between lanes prevents a block')
}
