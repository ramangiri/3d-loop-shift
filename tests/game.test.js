import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,createGame,start,pause,shift,advance,laneRadius} from '../src/game.js';
test('five progressive levels and 52 gates',()=>{assert.deepEqual(LEVELS.map(l=>l.rings),[2,3,3,3,4]);assert.equal(LEVELS.reduce((n,l)=>n+l.gates.length,0),52);});
for(let index=0;index<5;index++)test(`level ${index+1} can be completed by timely adjacent shifts`,()=>{
 const game=createGame(index);start(game);let gateIndex=0;
 for(let frame=0;frame<10000&&game.phase==='running';frame++){
  const gate=game.level.gates[gateIndex];
  if(gate&&game.angle>=gate.angle-.32){assert(shift(game));gateIndex++;}
  advance(game,1/60);
 }
 assert.equal(game.phase,'won');assert.equal(game.collected.size,game.level.coins.length);assert.equal(game.passed.size,game.level.gates.length);assert.equal(game.score,game.level.gates.length*15);
});
test('no input hits a blocker',()=>{const g=createGame();start(g);for(let i=0;i<1000&&g.phase==='running';i++)advance(g,1/60);assert.equal(g.phase,'lost');});
test('pause freezes angle and shifts, resume works',()=>{const g=createGame();start(g);shift(g);advance(g,.05);pause(g);const angle=g.angle,radius=g.radius;advance(g,.25);assert.equal(g.angle,angle);assert.equal(g.radius,radius);assert.equal(shift(g),false);start(g);advance(g,.1);assert(g.angle>angle);});
test('repeated input does not skip rings',()=>{const g=createGame(4);start(g);assert.equal(shift(g),true);assert.equal(shift(g),false);advance(g,.25);assert.equal(g.lane,2);assert.equal(g.radius,laneRadius(2));});
test('large frame cannot skip collision',()=>{const g=createGame();start(g);g.angle=g.level.gates[0].angle-.15;advance(g,5);assert.equal(g.phase,'lost');});
test('closed state ignores movement',()=>{const g=createGame();advance(g,.1);assert.equal(g.angle,0);assert.equal(shift(g),false);});
test('restart preserves only banked points',()=>{const g=createGame(2,210);assert.equal(g.score,210);assert.equal(g.collected.size,0);});
