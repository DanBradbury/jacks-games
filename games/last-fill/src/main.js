import './style.css';
import {playables} from '@jack-games/kit';
import {soundtrack} from './audio.js';

const $=id=>document.getElementById(id),app=$('app'),screen=$('screen'),audio=soundtrack();
const duration=48;
let frame,loading=false,active=false,playing=false,muted=false,time=0,last=0,raf=0,hostPaused=false;
let lookX=0,lookY=0,drag=null;
const pad=v=>String(Math.floor(v)).padStart(2,'0');
function icon(button,name){button.querySelector('use').setAttribute('href','#'+name)}
function syncAudio(){
  const quiet=muted||!playables.isAudioEnabled();
  audio.setAudible(active&&playing&&!quiet);
  icon($('audio'),quiet?'mute':'sound');$('audio').querySelector('span').textContent=quiet?'Sound off':'Sound on';
  $('audio').setAttribute('aria-label',quiet?'Enable sound':'Mute sound');
}
function update(playingFrame=false){
  const stage=frame(time,lookX,lookY,playingFrame);
  audio.tick(time,stage);$('seek').value=time;
  const clock='00:'+pad(time),chapter=time<13?'The station':time<28?'The forecourt':'The encounter';
  if($('clock').textContent!==clock)$('clock').textContent=clock;
  if($('chapter').textContent!==chapter)$('chapter').textContent=chapter;
}
function setPlaying(value){
  playing=value;last=performance.now();cancelAnimationFrame(raf);
  icon($('toggle'),value?'pause':'play');$('toggle').setAttribute('aria-label',value?'Pause':'Resume');
  syncAudio();if(value)raf=requestAnimationFrame(loop);
}
function home(finished=false){
  active=false;setPlaying(false);drag=null;lookX=lookY=0;hostPaused=false;
  app.classList.remove('playing');document.querySelector('.transport').hidden=true;
  $('begin').querySelector('span').textContent=finished?'Replay experience':'Begin experience';$('begin').focus({preventScroll:true});
}
function loop(now){
  if(!active||!playing)return;
  time=Math.min(duration,time+(now-last)/1000);last=now;
  update(true);if(time>=duration){home(true);return}
  raf=requestAnimationFrame(loop);
}
async function start(at){
  if(loading)return;
  loading=true;$('begin').disabled=true;$('status').textContent=frame?'':'Loading scene…';
  try{
    if(typeof AudioContext!=='undefined')audio.boot();
    if(!frame){const {createScene}=await import('./scene.js');frame=await createScene(screen)}
    time=at;lookX=lookY=0;audio.stop();active=true;$('status').textContent='';
    app.classList.add('playing');document.querySelector('.transport').hidden=false;
    update();setPlaying(!document.hidden&&!hostPaused);$('toggle').focus({preventScroll:true});
  }catch(err){console.error(err);$('status').textContent='Could not open the 3D scene. Check WebGL availability and try again.'}
  finally{loading=false;$('begin').disabled=false}
}
$('begin').onclick=()=>start(0);
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>start(Number(b.dataset.start)));
$('audio').onclick=()=>{muted=!muted;syncAudio()};
$('full').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen()}
  catch{$('full').hidden=true}
};
if(!document.fullscreenEnabled)$('full').style.display='none';
document.addEventListener('fullscreenchange',()=>$('full').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
$('toggle').onclick=()=>setPlaying(!playing);
$('exit').onclick=()=>home();
$('seek').oninput=e=>{time=Number(e.target.value);last=performance.now();audio.stop();lookX=lookY=0;update()};
document.addEventListener('keydown',e=>{
  if(!active)return;
  if(e.key==='Escape'){home();return}
  if(e.code==='Space'&&!['BUTTON','INPUT'].includes(e.target.tagName)){e.preventDefault();setPlaying(!playing)}
});
screen.onpointerdown=e=>{if(active){screen.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY}}};
screen.onpointermove=e=>{if(drag?.id===e.pointerId){
  lookX=(lookX+(e.clientX-drag.x)*.002)%(2*Math.PI);
  lookY=Math.max(-.39,Math.min(.39,lookY+(e.clientY-drag.y)*.002));
  drag.x=e.clientX;drag.y=e.clientY;if(!playing)update();
}};
screen.onlostpointercapture=()=>{drag=null};
playables.installErrorLogging();
playables.onPause(()=>{hostPaused=loading||(active&&playing);if(active)setPlaying(false)});
playables.onResume(()=>{if(active&&hostPaused)setPlaying(true);hostPaused=false});
playables.onAudioEnabledChange(syncAudio);syncAudio();
requestAnimationFrame(()=>{playables.firstFrameReady();playables.gameReady()});
