export const TAU = Math.PI * 2;
export const laneRadius = lane => 4 + lane * 2.2;
export const SHIFT_TIME = .22;
export const GATE_HALF = .09;
export const BALL_RADIUS = .34;
const configs = [[2,8,.30,'First orbit'],[3,10,.32,'Into the grove'],[3,10,.36,'Find your rhythm'],[3,12,.38,'The winding path'],[4,12,.40,'Full circle']];
export const LEVELS = configs.map(([rings,count,speed,name],index)=>{
  let lane=rings-1, direction=-1;
  const gates=[],coins=[];
  for(let i=0;i<count;i++){
    const previous=lane;
    if(lane===0) direction=1;
    else if(lane===rings-1) direction=-1;
    lane+=direction;
    const angle=.85+i*(TAU-1.5)/(count-1);
    const blocked=[previous];
    if(index>=3 && rings>2){const extra=Array.from({length:rings},(_,j)=>j).find(j=>j!==lane&&j!==previous);blocked.push(extra);}
    gates.push({angle,blocked,safeLane:lane});
    coins.push({angle:angle+.17,lane,id:`${index}-${i}`});
  }
  return {index,rings,speed,name,gates,coins};
});
export function createGame(index=0,bank=0){
  const level=LEVELS[index];
  return {level,index,bank,score:bank,phase:'ready',angle:0,time:0,lane:level.rings-1,targetLane:level.rings-1,direction:-1,radius:laneRadius(level.rings-1),shift:null,collected:new Set(),passed:new Set(),calm:false};
}
export function start(game){if(game.phase==='ready'||game.phase==='paused')game.phase='running';}
export function pause(game){if(game.phase==='running')game.phase='paused';}
export function shift(game){
  if(game.phase!=='running'||game.shift)return false;
  if(game.lane===0)game.direction=1;
  if(game.lane===game.level.rings-1)game.direction=-1;
  game.targetLane=game.lane+game.direction;
  game.shift={from:game.radius,to:laneRadius(game.targetLane),elapsed:0};
  return true;
}
export function advance(game,delta){
  if(game.phase!=='running'||!Number.isFinite(delta)||delta<=0)return;
  // Small fixed steps prevent a fast frame from skipping a physical collision.
  let remaining=Math.min(delta,.25);
  while(remaining>1e-8&&game.phase==='running'){
    const dt=Math.min(remaining,1/120);remaining-=dt;game.time+=dt;
    game.angle+=game.level.speed*dt;
    if(game.shift){
      game.shift.elapsed+=dt;
      const t=Math.min(1,game.shift.elapsed/SHIFT_TIME),smooth=t*t*(3-2*t);
      game.radius=game.shift.from+(game.shift.to-game.shift.from)*smooth;
      if(t===1){game.lane=game.targetLane;game.shift=null;}
    }
    for(let i=0;i<game.level.gates.length;i++){
      const gate=game.level.gates[i];
      const angular=GATE_HALF+BALL_RADIUS/game.radius;
      if(Math.abs(game.angle-gate.angle)<angular&&gate.blocked.some(l=>Math.abs(game.radius-laneRadius(l))<.625+BALL_RADIUS)){
        game.phase='lost';return;
      }
      if(game.angle>gate.angle+angular&&!game.passed.has(i)){game.passed.add(i);game.score+=5;}
    }
    for(const coin of game.level.coins){
      if(!game.collected.has(coin.id)&&Math.abs(game.angle-coin.angle)<.055&&Math.abs(game.radius-laneRadius(coin.lane))<.65){game.collected.add(coin.id);game.score+=10;}
    }
    if(game.angle>TAU+.12)game.phase='won';
  }
}
