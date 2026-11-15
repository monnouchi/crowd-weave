import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, CALL_GAUGE_PASS, CALL_GAUGE_NEAR, CALL_GAUGE_PASSIVE, HATE_DECAY, HATE_CLEAN_RELIEF, HATE_NEAR_RELIEF } from '../logic.js';
import { makeCrowd } from '../crowd.js';
import { advanceRun, createRun } from '../src/run.js';
const brake = {left:true,right:true};
function empty(stage=0) { const g=createGame(stage,17); g.phase='playing'; g.crowd=[]; g.animals=[]; g.crossings=[]; return g; }
function pass(g, dx) { g.crowd=[{...makeCrowd(1,30,1)[0], x:g.player.x+dx,y:g.player.y-1,state:'meeting',wait:10}]; step(g,.05,{}); }
test('gauge uses passive backstop and pass-specific charges; weaving relieves hate', () => {
  const g=empty(); g.callGauge=0; g.hate=0.8; step(g,.05,brake);
  assert.ok(Math.abs(g.callGauge-CALL_GAUGE_PASSIVE*.05)<1e-9);
  assert.ok(Math.abs(g.hate-(.8-HATE_DECAY*.05))<1e-9);
  let gauge=g.callGauge, hate=g.hate; pass(g,60);
  assert.ok(Math.abs(g.callGauge-gauge-CALL_GAUGE_PASS-CALL_GAUGE_PASSIVE*.05)<1e-8);
  assert.ok(Math.abs(g.hate-hate+HATE_CLEAN_RELIEF+HATE_DECAY*.05)<1e-8);
  g.callGauge=0; gauge=g.callGauge; hate=g.hate; pass(g,30);
  assert.ok(Math.abs(g.callGauge-gauge-CALL_GAUGE_NEAR-CALL_GAUGE_PASSIVE*.05)<1e-8);
  assert.ok(Math.abs(g.hate-hate+HATE_NEAR_RELIEF+HATE_DECAY*.05)<1e-8);
});
function policy(interval, seconds) { const g=empty(4); for(let i=0;i<seconds*20;i++) step(g,.05,{...brake,call:i%Math.round(interval*20)===0,callPulse:true}); return g; }
test('sustained repeated calls can make friends visibly leave; moderate calls do not', () => {
  const moderate=policy(20,100); assert.equal(moderate.friendsLeft,0); assert.equal(moderate.party.members.length,4);
  const spam=policy(8.4,60); assert.ok(spam.friendsLeft>0); assert.equal(spam.friendsJoined,4);
});
test('departures persist across stages and clear records actual party', () => {
  const g=createRun(1,17); g.phase='finished'; g.party.members=[]; g.friendsLeft=1; g.friendsJoined=1;
  const next=advanceRun(g); assert.deepEqual(next.party.members.map(m=>m.id),[2]);
  next.phase='playing'; next.crowd=[]; next.animals=[]; next.crossings=[]; next.player.x=240; next.player.y=86;
  step(next,.05,{}); assert.equal(next.phase,'finished'); assert.equal(next.friendsArrived,1);
  const solo=empty(); solo.player.y=86; step(solo,.05,{}); assert.equal(solo.phase,'finished'); assert.equal(solo.friendsArrived,0);
});
