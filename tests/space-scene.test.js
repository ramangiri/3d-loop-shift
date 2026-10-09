import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {spaceCameraFraming,SPACE_SCENE_LAYOUT as L,SPACE_SCENE_BUDGET as B} from '../src/space-scene.js';

for(const [width,height] of [[375,667],[390,844],[430,932],[768,1024],[1180,760],[1440,900],[1920,1080]])test(`Space camera keeps ball close and all lanes readable at ${width}×${height}`,()=>{
 const f=spaceCameraFraming(width,height),camera=new THREE.PerspectiveCamera(f.fov,f.aspect,f.near,f.far);
 camera.position.set(f.x,f.y,f.z);camera.rotation.set(f.rotationX,f.rotationY,f.rotationZ);camera.updateMatrixWorld(true);
 for(const lane of L.lanes){
  const center=new THREE.Vector3(lane,L.ballCenterY,0).project(camera);
  assert(Math.abs((1-center.y)/2-.70)<.002,'ball should remain in the foreground');
  let minY=1,maxY=-1;
  for(let i=0;i<20;i++)for(let j=0;j<12;j++){
   const a=i*Math.PI/10,b=j*Math.PI/11,r=L.ballRadius;
   const p=new THREE.Vector3(lane+r*Math.sin(b)*Math.cos(a),L.ballCenterY+r*Math.cos(b),r*Math.sin(b)*Math.sin(a)).project(camera);
   assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,'outer-lane ball clipped');minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  }
  assert((maxY-minY)/2>(width<height?.08:.18),'ball must be large enough for the close reference');
  for(const ahead of [20,40])for(const y of [0,1.25])for(const edge of [-.75,.75]){
   const p=new THREE.Vector3(lane+edge,y,-ahead).project(camera);
   assert(Math.abs(p.x)<.95&&Math.abs(p.y)<.90,'upcoming barrier unreadable');
  }
 }
 assert.equal(f.rotationZ,0);assert.equal(f.rotationY,0);
});
test('Space scenery and effect pools stay bounded for mobile',()=>{assert(B.ringPlatforms<=12);assert(B.asteroids<=64);assert(B.particles<=180);assert(B.maxPixelRatio<=1.65);assert(B.visibleAhead>=40&&B.visibleAhead<=120);});
