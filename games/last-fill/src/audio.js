import locationMix from './sound/station-walk.mp3';
import thunderRoll from './sound/thunder-roll.mp3';
import craftPass from './sound/craft-pass.mp3';
import {strikeTime} from './thunder.js';

export function soundtrackTracks(){
  return [
    {file:locationMix,at:0},
    {file:craftPass,at:27.75,pan:'craft'},
    {file:thunderRoll,at:strikeTime+.86,pan:'thunder'}
  ];
}

export function soundtrack(){
  const tracks=soundtrackTracks();
  let ctx,loading,bus,origin=0,voices=[],audible=false;

  function boot(){
    if(!ctx)ctx=new AudioContext();
    ctx.resume().catch(()=>{});
    if(!loading){
      loading=Promise.all(tracks.map(async track=>{
        if(track.buffer)return;
        const response=await fetch(track.file);
        if(!response.ok)throw Error('Could not load '+track.file);
        track.buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      })).catch(err=>{loading=null;console.warn('Soundtrack:',err)});
    }
  }

  function stop(){
    if(!bus)return;
    const now=ctx.currentTime,level=bus.gain.value;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(level,now);
    bus.gain.linearRampToValueAtTime(0,now+.012);
    for(const voice of voices)voice.stop(now+.013);
    bus=null;voices=[];
  }

  function start(time,stage){
    const now=ctx.currentTime;
    origin=now-time;bus=ctx.createGain();bus.connect(ctx.destination);
    const group=bus;
    let remaining=0;
    bus.gain.setValueAtTime(0,now);bus.gain.linearRampToValueAtTime(.84,now+.015);
    for(const track of tracks){
      const offset=Math.max(0,time-track.at);
      if(offset>=track.buffer.duration)continue;
      const voice=ctx.createBufferSource();voice.buffer=track.buffer;
      let output=bus;
      if(track.pan){
        const pan=ctx.createStereoPanner();
        pan.pan.value=stage[track.pan];pan.connect(bus);output=pan;track.panner=pan;
      }
      voice.connect(output);voice.start(Math.max(now,origin+track.at),offset);
      remaining++;
      voice.onended=()=>{
        voice.disconnect();
        if(track.pan){
          output.disconnect();
          if(track.panner===output)track.panner=null;
        }
        if(--remaining===0)group.disconnect();
      };
      voices.push(voice);
    }
    if(!remaining)group.disconnect();
  }

  return {boot,stop,setAudible(value){audible=value;if(!value)stop()},tick(time,stage){
    if(!audible||ctx?.state!=='running'||!tracks.every(track=>track.buffer))return;
    if(bus&&Math.abs(ctx.currentTime-origin-time)>.16)stop();
    if(!bus)start(time,stage);
    for(const track of tracks)if(track.panner)track.panner.pan.setTargetAtTime(stage[track.pan],ctx.currentTime,.045);
  }};
}
