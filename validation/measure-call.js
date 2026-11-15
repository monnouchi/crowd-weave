import { createGame } from '../logic.js';
import { planRoute, replayPlannedRoute } from './plan-route.js';
import { spamPolicy } from './spam-policy.js';
const cost = Number(process.argv[2] || 0);
console.log(`variant: hate + ${cost} points per call`);
for (const stage of [1, 0]) {
  const seed = 1402485690 + stage * 97;
  const route = planRoute(stage, seed, 50);
  if (!route) { console.log({stage, error: 'no route'}); continue; }
  for (const [policy, driver] of [['weave', null], ['spam', spamPolicy]]) {
    const g = createGame(stage, seed); g.phase = 'playing'; g.negotiationEnabled = true; g.callCostScore = cost;
    replayPlannedRoute(g, { ...route, path: route.path + 'F'.repeat(300) }, .025, null, driver);
    console.log(JSON.stringify({stage, policy, phase:g.phase, time:+g.elapsed.toFixed(2), score:g.combo.score, calls:g.callsUsed ?? g.callSerial, left:g.friendsLeft ?? 0, party:g.party.members.length}));
  }
}
