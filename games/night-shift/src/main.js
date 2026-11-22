import * as T from 'three';
import { createWorld, canStand } from './world.js';
import { createCameraOutput, tourPose } from './camera.js';
import { createSoundscape } from './sound.js';
import './style.css';

import { recordTour } from './record.js';
import { loadCityTextures } from './weather.js';
import { loadRackFace } from './racks.js';
import { loadConcrete } from './scans.js';

const $=id=>document.getElementById(id);
async function boot(){
  const capture=new URLSearchParams(location.search).has('capture');
  const touch=matchMedia('(pointer:coarse)').matches;
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:capture});}
  catch(error){$('status').textContent='WebGL 2 is required. Enable hardware acceleration or try another browser.';document.querySelectorAll('button').forEach(b=>b.disabled=true);throw error;}
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(69,1,.045,175);
  const [scans,cityTextures,rackFront]=await Promise.all([loadConcrete(),loadCityTextures(),loadRackFace()]);
  const updateWorld=createWorld(scene,scans,cityTextures,rackFront);
  const output=createCameraOutput(renderer,scene,camera);
  function resize(){
   const w=innerWidth,h=innerHeight,ratio=capture?1:Math.min(devicePixelRatio,1.5,1920/w);
   renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
   output.resize(Math.floor(w*ratio),Math.floor(h*ratio));
  }
  resize();addEventListener('resize',()=>{if(mode!=='record')resize();});
  let mode='menu',filter=true,elapsed=0,yaw=0,pitch=0,phase=0,sound=null,stepClock=0,exportController=null;
  const keys=new Set(),pad={x:0,y:0};
  function setFilter(value){
   filter=value;$('body').setAttribute('aria-pressed',filter);$('clean').setAttribute('aria-pressed',!filter);
   $('liveFilter').textContent=filter?'Bodycam':'Clean';
  }
  $('body').onclick=()=>setFilter(true);$('clean').onclick=()=>setFilter(false);
  $('liveFilter').onclick=()=>setFilter(!filter);
  function showMenu(message=''){
   exportController?.abort();exportController=null;$('liveFilter').disabled=false;
   mode='menu';keys.clear();pad.x=pad.y=0;$('stick').firstChild.style.transform='';$('menu').hidden=false;$('live').hidden=true;$('stick').hidden=true;
   if(document.pointerLockElement)document.exitPointerLock();
   sound?.setMuted(true);$('status').textContent=message;
  }
  function enter(next){
   mode=next;elapsed=phase=stepClock=0;
   $('status').textContent='';$('menu').hidden=true;$('live').hidden=false;$('stick').hidden=next!=='walk'||!touch;
   try{sound??=createSoundscape();sound.resume().catch(()=>{});sound.setMuted(false);}catch{/* Allow silent playback when Web Audio is unavailable. */}
   if(next==='walk'){
    tourPose(camera,0);yaw=camera.rotation.y;pitch=camera.rotation.x;
    if(!touch) $('view').requestPointerLock?.()?.catch?.(()=>{});
   }else tourPose(camera,0);
  }
  $('walk').onclick=()=>enter('walk');$('tour').onclick=()=>enter('tour');$('back').onclick=()=>showMenu();
  document.addEventListener('pointerlockchange',()=>{if(mode==='walk'&&!document.pointerLockElement&&!touch)showMenu();});
  function look(dx,dy){yaw-=dx*.0023;pitch=T.MathUtils.clamp(pitch-dy*.0023,-1.35,1.35);}
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement && mode==='walk')look(e.movementX,e.movementY);});
  let drag=null;
  $('view').onpointerdown=e=>{if(mode==='walk'&&!document.pointerLockElement){drag=[e.pointerId,e.clientX,e.clientY];$('view').setPointerCapture(e.pointerId);}};
  $('view').onpointermove=e=>{if(drag?.[0]===e.pointerId){look(e.clientX-drag[1],e.clientY-drag[2]);drag=[e.pointerId,e.clientX,e.clientY];}};
  $('view').onpointerup=$('view').onpointercancel=()=>{drag=null;};
  function movePad(e){
   const rect=$('stick').getBoundingClientRect(),x=(e.clientX-rect.left-48)/34,y=(e.clientY-rect.top-48)/34,l=Math.max(1,Math.hypot(x,y));
   pad.x=x/l;pad.y=y/l;$('stick').firstChild.style.transform='translate('+pad.x*30+'px,'+pad.y*30+'px)';
  }
  $('stick').onpointerdown=e=>{$('stick').setPointerCapture(e.pointerId);movePad(e);};
  $('stick').onpointermove=e=>{if($('stick').hasPointerCapture(e.pointerId))movePad(e);};
  $('stick').onpointerup=$('stick').onpointercancel=()=>{pad.x=pad.y=0;$('stick').firstChild.style.transform='';};
  addEventListener('keydown',e=>{
   if(e.code==='Escape' && mode!=='menu'){showMenu();return;}
   if(e.code==='KeyF'&&!e.repeat&&mode!=='record'){setFilter(!filter);return;}
   if(mode==='walk'){keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault();}
  });
  addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
  function walk(dt){
   let x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+pad.x;
   let z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+pad.y;
   yaw+=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*1.6;
   const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;
   const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.55:2.05);
   const dx=(x*Math.cos(yaw)+z*Math.sin(yaw))*speed*dt,dz=(-x*Math.sin(yaw)+z*Math.cos(yaw))*speed*dt;
   const p=camera.position,oldX=p.x,oldZ=p.z;
   if(canStand(p.x+dx,p.z))p.x+=dx;if(canStand(p.x,p.z+dz))p.z+=dz;
   const moved=Math.hypot(oldX-p.x,oldZ-p.z);phase+=moved*5.4;stepClock+=moved;
   if(stepClock>.84){sound?.step(speed/4);stepClock=0;}
   p.y=1.62+Math.sin(phase)*Math.min(1,moved*80)*.028;
   camera.rotation.set(pitch,yaw,Math.sin(phase*.5)*Math.min(1,moved*80)*.009,'YXZ');
  }
  $('record').onclick=async()=>{
    mode='record';
    const controller=new AbortController();exportController=controller;
    $('menu').hidden=true;$('live').hidden=false;$('liveFilter').disabled=true;
    $('liveFilter').textContent='Preparing recording…';
    // Keep capture resolution and aspect constant throughout the export.
    renderer.setPixelRatio(1);renderer.setSize(1280,720,false);
    camera.aspect=16/9;camera.updateProjectionMatrix();output.resize(1280,720);
    let message='';
    try{
      const {blob,ext}=await recordTour($('view'),window.renderTourFrame,
        fraction=>{$('liveFilter').textContent='Rendering '+Math.round(fraction*100)+'%';},controller.signal);
      const link=document.createElement('a');link.href=URL.createObjectURL(blob);
      link.download='night-shift-'+(filter?'bodycam':'clean')+'.'+ext;
      link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60000);message='Tour saved.';
    }catch(error){if(!controller.signal.aborted)message=error.message;}
    finally{if(exportController===controller)showMenu(message);if(!exportController){resize();setFilter(filter);}}
  };
  window.renderTourFrame=(seconds)=>{tourPose(camera,seconds);updateWorld(seconds);output.draw(seconds,filter,true);};
  if(capture){$('menu').hidden=true;window.renderTourFrame(0);}
  let last=performance.now();
  function tick(now){
   if(mode==='record'){last=now;requestAnimationFrame(tick);return;}
    const real=(now-last)/1000,dt=Math.min(.05,real);last=now;elapsed+=real;
   if(mode==='walk')walk(dt);
   else if(mode==='tour'){
     tourPose(camera,elapsed);stepClock+=dt;if(stepClock>.53&&elapsed<28.6){sound?.step(.49);stepClock=0;}
   }else{
     tourPose(camera,0);camera.position.set(-1.08,1.58,4.85);camera.rotation.set(-.052,-.126+.015*Math.sin(now*.00013),-.012,'YXZ');
   }
   if(mode!=='menu'){
     sound?.setPosition((-camera.position.z-20)/7.5);
     sound?.setWindows(camera.position.x,camera.position.z,camera.rotation.y);
   }
   updateWorld(elapsed);
   output.draw(elapsed,filter,mode!=='menu');
   if(mode==='tour'&&elapsed>=30)showMenu();
   requestAnimationFrame(tick);
  }
  $('status').textContent='';
  if(!capture)requestAnimationFrame(tick);

}
boot().catch(error=>{console.error(error);$('status').textContent='Could not start the 3D scene. Check WebGL support and reload.';});
