export const SPACE_LANES = [-2.2, 0, 2.2];
export const SPACE_SHIFT_TIME = .24;
export const SPACE_SPEED = 8;
export const SPACE_LENGTH = 280;

let safeLane = 1, direction = 1;
const gates = [], coins = [];
for (let i = 0; i < 18; i++) {
  if (safeLane === 0) direction = 1;
  if (safeLane === 2) direction = -1;
  safeLane += direction;
  const distance = 27 + i * 13;
  // Each safe route is one adjacent shift from the preceding safe lane.
  const blocked = [0, 1, 2].filter(lane => lane !== safeLane);
  gates.push({distance, blocked, safeLane});
  coins.push({distance: distance + 4, lane: safeLane, id: `space-${i}`});
}
export const SPACE_COURSE = {length: SPACE_LENGTH, speed: SPACE_SPEED, gates, coins, name: 'Beyond the rings'};

export function createSpaceGame() {
  return {course: SPACE_COURSE, distance: 0, x: 0, lane: 1, targetLane: 1, direction: 1, time: 0, score: 0, phase: 'ready', shift: null, collected: new Set(), passed: new Set(), calm: false};
}
export function startSpace(state) { if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'running'; }
export function pauseSpace(state) { if (state.phase === 'running') state.phase = 'paused'; }
export function shiftSpace(state, requestedDirection = null) {
  if (state.phase !== 'running' || state.shift) return false;
  let direction = requestedDirection;
  if (direction !== -1 && direction !== 1) {
    if (state.lane === 0) state.direction = 1;
    if (state.lane === 2) state.direction = -1;
    direction = state.direction;
  }
  const target = state.lane + direction;
  if (target < 0 || target > 2) return false;
  state.direction = direction;
  state.targetLane = target;
  state.shift = {from: state.x, to: SPACE_LANES[target], elapsed: 0};
  return true;
}
export function advanceSpace(state, delta) {
  if (state.phase !== 'running' || !Number.isFinite(delta) || delta <= 0) return;
  let remaining = Math.min(delta, .25);
  while (remaining > 1e-8 && state.phase === 'running') {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    state.time += dt; state.distance += SPACE_SPEED * dt;
    if (state.shift) {
      state.shift.elapsed += dt;
      const t = Math.min(1, state.shift.elapsed / SPACE_SHIFT_TIME);
      state.x = state.shift.from + (state.shift.to - state.shift.from) * t * t * (3 - 2 * t);
      if (t === 1) { state.lane = state.targetLane; state.shift = null; }
    }
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      if (Math.abs(state.distance - gate.distance) < .95 && gate.blocked.some(lane => Math.abs(state.x - SPACE_LANES[lane]) < 1.25)) {
        state.phase = 'lost'; return;
      }
      if (state.distance > gate.distance + 1 && !state.passed.has(i)) { state.passed.add(i); state.score += 5; }
    }
    for (const coin of coins) {
      if (!state.collected.has(coin.id) && Math.abs(state.distance - coin.distance) < .75 && Math.abs(state.x - SPACE_LANES[coin.lane]) < .75) {
        state.collected.add(coin.id); state.score += 10;
      }
    }
    if (state.distance >= SPACE_LENGTH) { state.distance = SPACE_LENGTH; state.phase = 'won'; }
  }
}
