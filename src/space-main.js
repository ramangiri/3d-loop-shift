import './style.css';
import './space.css';
import {createSpaceScene} from './space-scene.js';
import {createSpaceGame, startSpace, pauseSpace, shiftSpace, advanceSpace} from './space-game.js';
const $ = id => document.getElementById(id);
document.body.classList.add('space');
document.title = 'Loop Shift · Space Run';
$('world').setAttribute('aria-label', 'Space Run 3D playing field');
document.querySelector('.stat.level>span').textContent = 'COURSE';
$('mode-link').href = '/'; $('mode-link').textContent = '← Forest mode';
let state = createSpaceGame(), scene, last = 0, displayedPhase = '', calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const saved = localStorage.getItem('loop3d-calm'); if (saved !== null) calm = saved === 'true'; } catch {}
state.calm = calm;
try { scene = createSpaceScene($('world')); scene.setCourse(state.course); }
catch (error) { console.error(error); $('error').hidden = false; }

function reset() { state = createSpaceGame(); state.calm = calm; scene?.setCourse(state.course); displayedPhase = ''; updateUI(); }
function updateUI() {
  $('score').textContent = String(state.score).padStart(4, '0'); $('level').textContent = '01';
  $('chapter').textContent = 'SPACE RUN';
  $('rings').textContent = 'ONE COURSE · 18 GATES';
  const progress = Math.min(100, state.distance / state.course.length * 100);
  $('progress').style.width = progress + '%'; $('progress').parentElement.setAttribute('aria-valuenow', Math.round(progress));
  $('calm').textContent = `Calm effects: ${calm ? 'on' : 'off'}`; $('calm').setAttribute('aria-pressed', calm);
  $('pause').disabled = !['running', 'paused'].includes(state.phase);
  $('pause').textContent = state.phase === 'paused' ? '▷' : 'Ⅱ';
  $('pause').setAttribute('aria-label', state.phase === 'paused' ? 'Resume game' : 'Pause game');
  const next = state.lane === 0 ? 1 : state.lane === 2 ? -1 : state.direction;
  $('shift-label').textContent = state.phase === 'running' ? `SHIFT ${next > 0 ? 'RIGHT →' : '← LEFT'}` : 'TAP TO SHIFT';
  document.querySelector('.shift small').textContent = 'SPACE TO SHIFT · ← → TO STEER';
  if (displayedPhase === state.phase) return;
  displayedPhase = state.phase;
  $('panel').hidden = state.phase === 'running' || !scene;
  $('panel').className = 'panel ' + (state.phase === 'won' ? 'win' : state.phase === 'lost' ? 'lost' : '');
  const copy = {
    ready: ['ONE COURSE. INTO THE UNKNOWN.', 'Space Run', 'Follow the blue path. Dodge the red gates.<br>Collect gold and reach the final ring.', 'Launch run →', 'Tap or Space to shift. Arrow keys steer left and right.'],
    paused: ['THE STARS CAN WAIT', 'Run paused', 'Your place is saved.<br>Continue when you’re ready.', 'Continue →', 'P or Escape to pause.'],
    lost: ['ONE MORE RUN', 'Gate collision', 'Shift a little earlier.<br>The open lane is your way through.', 'Retry run ↻', 'Tap shifts across the lanes, then back again.'],
    won: ['COURSE COMPLETE', 'Beyond the rings', `${state.collected.size} / ${state.course.coins.length} coins collected.<br>${state.score} points. A clean flight through space.`, 'Fly again ↻', 'One playable course. More can follow.'],
  }[state.phase];
  if (copy) { $('eyebrow').textContent = copy[0]; $('title').textContent = copy[1]; $('description').innerHTML = copy[2]; $('primary').textContent = copy[3]; $('detail').textContent = copy[4]; }
}
function launch() { if (!scene) return; if (state.phase === 'won' || state.phase === 'lost') reset(); startSpace(state); $('world').focus({preventScroll: true}); updateUI(); }
function move(direction = null) { shiftSpace(state, direction); updateUI(); }
function togglePause() { if (state.phase === 'running') pauseSpace(state); else if (state.phase === 'paused') startSpace(state); updateUI(); }
$('primary').addEventListener('click', launch);
$('pause').addEventListener('click', togglePause);
$('restart').addEventListener('click', reset);
$('shift').addEventListener('click', () => state.phase === 'ready' ? launch() : move());
$('world').addEventListener('pointerdown', event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); move(); } });
$('calm').addEventListener('click', () => { calm = !calm; state.calm = calm; try { localStorage.setItem('loop3d-calm', String(calm)); } catch {} updateUI(); });
window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (event.code === 'Space') { if (event.target.closest?.('button,input,select,textarea,a')) return; event.preventDefault(); if (state.phase === 'running') move(); else launch(); }
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault(); move(event.code === 'ArrowLeft' ? -1 : 1); }
  if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); togglePause(); }
});
function suspend() { pauseSpace(state); last = 0; updateUI(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('blur', suspend);
window.addEventListener('resize', () => scene?.resize());
function frame(ms) { const dt = last ? Math.min((ms - last) / 1000, .05) : 0; last = ms; advanceSpace(state, dt); scene.update(state, dt); updateUI(); requestAnimationFrame(frame); }
updateUI(); if (scene) requestAnimationFrame(frame);
