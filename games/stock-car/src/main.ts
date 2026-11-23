import './style.css'
import { Particles, playables, Sfx } from '@jack-games/kit'
import { Race, track, length, type Car, type Contact } from './race'
import { setupGarage } from './garage'
import { draw } from './view'

const el=(id:string)=>document.getElementById(id)!
const canvas=el('track') as HTMLCanvasElement, ctx=canvas.getContext('2d')!
const map=el('map') as HTMLCanvasElement, mc=map.getContext('2d')!
const garage=setupGarage()
const sound=new Sfx(), particles=new Particles()
type Mode='grid'|'race'|'replay'|'finish'
let mode:Mode='grid',race=new Race(),manualPause=false,hostPause=false
let frames:Car[][]=[],focus=-1,post=0,playTime=0,ticks=0,accumulator=0,last=0
let best=10
const saved=playables.load('stock-car',{best:10}).then(data=>{best=Math.min(best,data.best)})
const held=new Set<string>(), pointers=new Map<number,string>()
const active=(id:string)=>held.has(id)||[...pointers.values()].includes(id)
function clearInput(){held.clear();pointers.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'))}
function panel(kicker:string,title:string,copy:string,action:string){
  el('garage-open').hidden=mode!=='grid'&&mode!=='finish'
  el('prompt').hidden=false;el('kicker').textContent=kicker;el('title').textContent=title
  el('copy').textContent=copy;el('action').textContent=action
}
function startRace(){
  race=new Race();frames=[race.cars.map(c=>({...c}))];focus=-1;post=0;ticks=0;clearInput()
  particles.clear();mode='race';el('prompt').hidden=true;sound.tap()
}
function resumeRace(){mode='race';focus=-1;frames=[];clearInput();el('prompt').hidden=true}
function togglePause(){
  if(mode==='grid'||mode==='finish'||hostPause)return
  manualPause=!manualPause;clearInput()
  if(manualPause){sound.pause();panel('RACE CONTROL','Race paused','Pick up where you left off.','RESUME  →')}
  else{sound.resume();if(mode==='replay')replayPanel();else el('prompt').hidden=true}
}
function replayPanel(){panel('INCIDENT REPLAY','Crash cam',playTime<clipDuration()?'Trackside camera · slow motion':'Reverse angle · slow motion','SKIP REPLAY  →')}
function clipDuration(){return Math.max(1,frames.length-1)/24/.65}
function action(){
  sound.unlock()
  if(manualPause)togglePause()
  else if(mode==='grid'||mode==='finish')startRace()
  else if(mode==='replay')resumeRace()
}
el('action').onclick=action;el('pause').onclick=togglePause
for(const id of ['left','right','brake']){
  const btn=el(id)
  btn.onpointerdown=e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);pointers.set(e.pointerId,id);btn.classList.add('pressed');sound.unlock()}
  btn.onlostpointercapture=e=>{pointers.delete(e.pointerId);btn.classList.toggle('pressed',active(id))}
  btn.onclick=e=>{if(e.detail===0)sound.unlock()}
}
const keys:Record<string,string>={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'brake',KeyS:'brake'}
window.onkeydown=e=>{
  if(garage.dialog.open)return
  if(e.code==='Escape'&&!e.repeat){togglePause();return}
  const id=keys[e.code];if(!id)return;e.preventDefault()
  if(!e.repeat){held.add(id);sound.unlock()}
}
window.onkeyup=e=>held.delete(keys[e.code])
window.addEventListener('blur',clearInput)
playables.onPause(()=>{hostPause=true;clearInput();sound.pause()})
playables.onResume(()=>{hostPause=false;if(!manualPause)sound.resume()})
sound.setEnabled(playables.isAudioEnabled());playables.onAudioEnabledChange(v=>sound.setEnabled(v))
playables.installErrorLogging()
function finish(){
  mode='finish';sound.fanfare();particles.confetti(canvas.clientWidth,canvas.clientHeight,['#ff803d','#e6cd84','#f9f5db','#61aaa3'])
  panel('CHECKERED FLAG','Across the line!',`No. ${garage.car.number} finished ${race.place} of 10. Take another run at the pack.`,'RACE AGAIN  →')
  const place=race.place
  void saved.then(()=>{best=Math.min(best,place);return playables.save('stock-car',{best})})
  playables.sendScore(11-place)
}
let spots:([number,number]|null)[]=[]
const sparks=['#ffe38a','#ffb547','#fff7d9'],dirt=['#7e9164','#a08a5c','#5f6e4a']
function contact(e:Contact){
  const cars=race.cars,near=e.car===0||e.other===0||Math.abs(cars[e.car].s-cars[0].s)<40
  if(!near)return
  if(e.kind==='spin'){
    const level=Math.min(1,.45+e.strength/30)*(e.car===0||e.other===0?1:.78)
    sound.tone(79,.27,{slide:38,gain:.42*level})
    sound.noise(.18,{freq:1900,sweep:380,gain:.65*level})
    sound.noise(.42,{delay:.08,freq:1050,sweep:190,q:.7,gain:.43*level})
    return
  }
  const at=spots[e.car]
  if(e.kind==='grass'){
    if(at)particles.burst(at[0],at[1]+14,{count:5,colors:dirt,speed:120,size:6,life:.4,gravity:600,shape:'dot'})
    sound.noise(.18,{freq:160,sweep:90,gain:.25})
    return
  }
  if(at)particles.burst(at[0],at[1]+8,{count:e.kind==='bump'?6:10,colors:sparks,speed:180,size:5,life:.35,gravity:500,shape:'dot'})
  if(e.kind==='rub')sound.noise(.14,{freq:2400,sweep:1300,gain:.22,q:2})
  else if(e.kind==='scrape')sound.noise(.2,{freq:3200,sweep:1600,gain:.18,q:2})
  else{sound.tone(95,.18,{type:'sine',slide:44,gain:.28});sound.noise(.12,{freq:320,gain:.3})}
}
function simulate(){
  const incident=race.step(1/120,Number(active('right'))-Number(active('left')),active('brake'))
  if(incident>=0&&focus<0){focus=incident;post=1.6}
  for(const e of race.events)contact(e)
  if(++ticks%5===0){frames.push(race.cars.map(c=>({...c})));if(frames.length>70)frames.shift()}
  if(focus>=0&&(post-=1/120)<=0){
    mode='replay';playTime=0;replayPanel();clearInput()
  }else if(race.finished)finish()
}
function mini(cars:Car[]){
  mc.clearRect(0,0,260,124)
  const pos=(s:number)=>{const f=track(s);return [130+f.z*.14,16-f.x*.123] as const}
  mc.beginPath();for(let i=0;i<=120;i++)mc.lineTo(...pos(length*i/120));mc.closePath();mc.lineWidth=6;mc.strokeStyle='#a8aa95';mc.stroke()
  for(let i=cars.length-1;i>=0;i--){mc.beginPath();mc.arc(...pos(cars[i].s),i?3:7,0,7);mc.fillStyle=i?'#eee9cc':garage.car.paint;mc.fill()}
}
function render(){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio)
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0)
  const replay=mode==='replay',angle=replay?(playTime<clipDuration()?1:2):0
  const cars=replay?frames[Math.min(frames.length-1,Math.floor((playTime%clipDuration())*24*.65))]:race.cars
  spots=draw(ctx,w,h,cars,replay?focus:0,angle,garage.car.paint,garage.car.number);mini(cars);particles.draw(ctx)
  const place=1+cars.slice(1).filter(c=>c.s>cars[0].s).length
  el('place').innerHTML=place+'<span>/10</span>';el('laps').textContent=String(Math.max(0,2-Math.floor(cars[0].s/length))).padStart(2,'0')
  el('mph').textContent=String(Math.round(cars[0].v*2.237))
  el('status').textContent=manualPause?'PAUSED':replay?'INSTANT REPLAY':mode==='grid'?'ROLLING START':mode==='finish'?'CHECKERED FLAG':race.draft>.14?'DRAFTING':cars[0].s>=length?'FINAL LAP':'GREEN FLAG'
  ;(el('wake') as HTMLMeterElement).value=race.draft
  const pause=el('pause') as HTMLButtonElement;pause.disabled=mode==='grid'||mode==='finish';pause.textContent=manualPause?'▶':'Ⅱ';pause.ariaLabel=manualPause?'Resume race':'Pause race'
}
const tireNoise={type:'bandpass' as const,freq:950,q:.8,gain:.20}
function tireSound(){
  const car=race.cars[0]
  const level=mode==='race' ? Math.min(1,car.v/85)*Math.min(1,
    Math.abs(car.vx)*.055+(active('brake')?.52:0)+Math.abs(car.spin)*.55) : 0
  sound.setScratch(level,tireNoise)
}
function loop(now:number){
  const dt=Math.min(.1,(now-last)/1000);last=now
  if(!manualPause&&!hostPause){
    if(mode==='race'){accumulator+=dt;while(accumulator>=1/120&&mode==='race'){simulate();accumulator-=1/120}}
    else{accumulator=0;if(mode==='replay'){const before=playTime;playTime+=dt;if(playTime>=2*clipDuration())resumeRace();else if(before<clipDuration()&&playTime>=clipDuration())replayPanel()}}
    tireSound();particles.update(dt)
  }
  render();requestAnimationFrame(loop)
}
render();playables.firstFrameReady();playables.gameReady();requestAnimationFrame(loop)
