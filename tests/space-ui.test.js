import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../src/space-game.js';

// DOM-adapter unit tests. These exercise the shipped controller without claiming
// browser/WebGL rendering coverage, which requires a graphics-enabled browser.
function boot(saved = null) {
  const elements = new Map(), listeners = new Map(), documentListeners = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {id, hidden: false, style: {}, attrs: {}, textContent: '', innerHTML: '', callbacks: new Map(), parentElement: {setAttribute(){}}, setAttribute(k,v){this.attrs[k]=String(v);}, addEventListener(k,v){this.callbacks.set(k,v);}, focus(){this.focused=true;}});
    return elements.get(id);
  }
  const document = {body:{classList:{add(){}}},title:'',hidden:false,getElementById:element,querySelector:element,addEventListener:(name,fn)=>documentListeners.set(name,fn)};
  const storage = new Map(saved === null ? [] : [['loop3d-calm',saved]]);
  const scene = {setCourse(){},resize(){},update(){}};
  const context = vm.createContext({...engine,document,window:{addEventListener:(name,fn)=>listeners.set(name,fn)},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:true}),createSpaceScene:()=>scene,requestAnimationFrame(){},console});
  const source = fs.readFileSync(new URL('../src/space-main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source+'\nthis.inspectState=()=>state;',context);
  return {element,context,document,documentListeners,storage,click:id=>element(id).callbacks.get('click')(),key:(code,interactive=false)=>listeners.get('keydown')({code,repeat:false,target:{closest:()=>interactive?{}:null},preventDefault(){}}),blur:()=>listeners.get('blur')()};
}
test('Space mode launch, input, pause, resume and retry lifecycle',()=>{
 const app=boot(); assert.equal(app.document.title,'Loop Shift · Space Run');assert.equal(app.element('mode-link').href,'/');
 app.click('primary');assert.equal(app.context.inspectState().phase,'running');assert(app.element('world').focused);
 app.key('Space');assert.equal(app.context.inspectState().targetLane,2);
 app.key('KeyP');assert.equal(app.context.inspectState().phase,'paused');
 app.key('Space');assert.equal(app.context.inspectState().phase,'running');
 app.blur();assert.equal(app.context.inspectState().phase,'paused');
 app.click('restart');assert.equal(app.context.inspectState().phase,'ready');assert.equal(app.context.inspectState().score,0);
});
test('Space mode preserves native Space on focused controls',()=>{const app=boot();app.click('primary');app.key('Space',true);assert.equal(app.context.inspectState().shift,null);});
test('pause and arrows remain available after clicking a control',()=>{const app=boot();app.click('primary');app.key('KeyP',true);assert.equal(app.context.inspectState().phase,'paused');app.key('Escape',true);app.key('ArrowLeft',true);assert.equal(app.context.inspectState().targetLane,0);});
test('Space mode respects explicit calm off and saves toggle',()=>{const app=boot('false');assert.equal(app.context.inspectState().calm,false);app.click('calm');assert.equal(app.context.inspectState().calm,true);assert.equal(app.storage.get('loop3d-calm'),'true');});
test('Space mode pauses when the document is hidden',()=>{const app=boot();app.click('primary');app.document.hidden=true;app.documentListeners.get('visibilitychange')();assert.equal(app.context.inspectState().phase,'paused');});
