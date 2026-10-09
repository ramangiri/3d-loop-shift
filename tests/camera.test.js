import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { frameBoard } from '../src/camera-fit.js';

for(const [width,height] of [[390,844],[430,932],[768,1024],[1180,760],[1440,900],[1920,1080],[844,390]]){
 for(const rings of [2,3,4])test(`close camera keeps ${rings} rings visible at ${width}×${height}`,()=>{
  const outer=4+(rings-1)*2.2+.625;
  const camera=new THREE.PerspectiveCamera(38,width/height,.1,180);
  const {bounds}=frameBoard(camera,width,height,outer);
  let minX=1,maxX=-1,minY=1,maxY=-1;
  for(let i=0;i<360;i++)for(const y of [-.63,.55,1.38]){
   const angle=i*Math.PI/180;
   const p=new THREE.Vector3(Math.cos(angle)*outer,y,Math.sin(angle)*outer).project(camera);
   assert(p.x>=bounds.left-.002&&p.x<=bounds.right+.002,'horizontal route clipped');
   assert(p.y>=bounds.bottom-.002&&p.y<=bounds.top+.002,'vertical route clipped');
   minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  }
  assert(Math.max((maxX-minX)/(bounds.right-bounds.left),(maxY-minY)/(bounds.top-bounds.bottom))>.90,'board should fill play area');
 });
}
