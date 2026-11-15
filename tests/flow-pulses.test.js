import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../logic.js';
import { FLOW_PULSE_LULL, FLOW_PULSE_PERIOD, moveCrowd } from '../crowd.js';
import { measurePlayerRelative } from '../validation/measure-flow.js';

function timeline(seed) {
  const crowd = createGame(1, seed).crowd, entries = [];
  for (let tick = 0; tick < 2400; tick++) {
    const wasActive = crowd.map(p => p.active);
    moveCrowd(crowd, 0.05);
    for (const [i, p] of crowd.entries()) {
      if (p.flow === 'opposing' && !wasActive[i] && p.active) {
        const phase = (p.flowTime + crowd[0].flowPulsePhase) % FLOW_PULSE_PERIOD;
        entries.push([tick, p.id, +p.x.toFixed(4), +p.y.toFixed(4), +phase.toFixed(6)]);
        assert.ok(phase < FLOW_PULSE_PERIOD - FLOW_PULSE_LULL);
      }
    }
  }
  return entries;
}

test('station pulses have a seed-deterministic entry timeline and lulls', () => {
  const first = timeline(1402485787);
  assert.ok(first.length > 0, 'the audit must observe opposing re-entries');
  assert.deepEqual(timeline(1402485787), first);
  assert.notDeepEqual(timeline(1402485788), first);
});

test('stage 1 moving-player gap stays below threshold for less than half a second', () => {
  const result = measurePlayerRelative();
  assert.equal(result.planned, true);
  assert.equal(result.phase, 'finished');
  assert.equal(result.hits, 0);
  assert.ok(result.elapsed <= 15.6 * 1.1);
  // Expanded-body gap below 60 units, sampled 40 units ahead of the player.
  assert.ok(result.longestNoGap < 0.5, `no-gap stretch: ${result.longestNoGap}s`);
});

test('runtime flow treatment preserves stage headcounts', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(stage => createGame(stage).crowd.length),
    [14, 24, 49, 54, 58]);
});
