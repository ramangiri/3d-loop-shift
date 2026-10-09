import './style.css';
import {createScene} from './scene.js';
import {createGame,LEVELS,TAU,start,pause,shift,advance} from './game.js';
const $=id=>document.getElementById(id);
let game=createGame(),last=0,view,renderedPhase='',calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{const saved=localStorage.getItem('loop3d-calm');if(saved!==null)calm=saved==='true';}catch{}
game.calm=calm;
try{view=createScene($('world'));view.setLevel(game.level);}catch(error){console.error(error);$('error').hidden=false;$('panel').hidden=true;}
function setGame(index,bank=0){game=createGame(index,bank);game.calm=calm;view?.setLevel(game.level);renderedPhase='';updateUI();}
function updateUI(){
 $('score').textContent=String(game.score).padStart(4,'0');$('level').textContent=String(game.index+1).padStart(2,'0');
 $('chapter').textContent=game.level.name;$('rings').textContent=`${game.level.rings} RINGS · ${game.level.gates.length} GATES`;
 const percent=Math.min(100,100*game.angle/(TAU+.12));$('progress').style.width=percent+'%';$('progress').parentElement.setAttribute('aria-valuenow',Math.round(percent));
 $('calm').textContent=`Calm effects: ${calm?'on':'off'}`;$('calm').setAttribute('aria-pressed',calm);
 $('pause').disabled=!['running','paused'].includes(game.phase);$('pause').textContent=game.phase==='paused'?'▷':'Ⅱ';$('pause').setAttribute('aria-label',game.phase==='paused'?'Resume game':'Pause game');
 const nextDirection=game.lane===0?1:game.lane===game.level.rings-1?-1:game.direction;
 $('shift-label').textContent=game.phase==='running'?`TAP TO SHIFT ${nextDirection===-1?'IN':'OUT'}`:'TAP TO SHIFT';
 if(renderedPhase===game.phase)return;renderedPhase=game.phase;
 const panel=$('panel');panel.hidden=game.phase==='running';panel.className='panel '+(game.phase==='won'?'win':game.phase==='lost'?'lost':'');
 const final=game.index===LEVELS.length-1;
 const copy={ready:['FIVE ORBITS. ONE RHYTHM.','Find your flow','Collect gold. Stay clear of red.<br>Tap to move to the next ring.','Start orbit →','Shift inward, then outward. One tap at a time.'],paused:['TAKE YOUR TIME','Orbit paused','Your place is saved.<br>Ready when you are.','Continue →','P or Escape to pause. Space to shift.'],lost:['A FRESH START','Try another path','That red blocker caught you.<br>Shift a little earlier on your next run.','Retry orbit ↻','This level’s points reset. Previous levels stay saved.'],won:['ORBIT COMPLETE',final?'You found your flow':'Beautifully done',`${game.collected.size} of ${game.level.coins.length} coins collected.<br>${final?'All five forest orbits complete.':'A new rhythm is waiting.'}`,final?'Play again ↻':'Next orbit →',final?'Five levels. One forest. A little more flow.':`Up next: ${LEVELS[game.index+1]?.name}`]}[game.phase];
 if(copy){$('eyebrow').textContent=copy[0];$('title').textContent=copy[1];$('description').innerHTML=copy[2];$('primary').textContent=copy[3];$('detail').textContent=copy[4];}
}
function primary(){if(!view)return;if(game.phase==='won'){setGame(game.index===4?0:game.index+1,game.index===4?0:game.score);start(game);}else if(game.phase==='lost'){setGame(game.index,game.bank);start(game);}else start(game);$('world').focus({preventScroll:true});updateUI();}
function doShift(){if(game.phase==='running'){shift(game);updateUI();}}
$('primary').addEventListener('click',primary);$('shift').addEventListener('click',()=>game.phase==='ready'?primary():doShift());
$('world').addEventListener('pointerdown',event=>{if(event.isPrimary&&event.button===0){event.preventDefault();doShift();}});
function togglePause(){if(game.phase==='running')pause(game);else if(game.phase==='paused')start(game);updateUI();}
$('pause').addEventListener('click',togglePause);$('restart').addEventListener('click',()=>setGame(game.index,game.bank));
$('calm').addEventListener('click',()=>{calm=!calm;game.calm=calm;try{localStorage.setItem('loop3d-calm',String(calm));}catch{}updateUI();});
window.addEventListener('keydown',event=>{if(event.repeat)return;if(event.code==='Space'){if(event.target.closest?.('button,input,select,textarea,a'))return;event.preventDefault();if(game.phase==='running')doShift();else primary();}if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();togglePause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause(game);last=0;updateUI();}});
window.addEventListener('blur',()=>{pause(game);last=0;updateUI();});window.addEventListener('resize',()=>view?.resize());
function frame(ms){const dt=last?Math.min((ms-last)/1000,.05):0;last=ms;advance(game,dt);view?.update(game,dt);updateUI();requestAnimationFrame(frame);}
updateUI();if(view)requestAnimationFrame(frame);
