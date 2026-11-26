import {spawn, execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile, rename} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('..',import.meta.url));
const width=1920,height=1080,fps=60,seconds=48,sampleRate=48000;
execFileSync('ffmpeg',['-version'],{stdio:'ignore'});
const release=join(root,'release');
await mkdir(release,{recursive:true});
const tmp=await mkdtemp(join(tmpdir(),'last-fill-'));
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:0,open:false}});
let browser,encoder,staging;
try {
  await server.listen();
  browser=await chromium.launch({channel:'chrome'});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',error=>console.error(error));
  const url=new URL('/__render',server.resolvedUrls.local[0]).href;
  await page.route(url,route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
    <link rel="stylesheet" href="/src/style.css"><style>html,body,#app{background:transparent}</style>
    <main id="app" class="playing"><div id="screen"></div><div class="shade"></div><div class="grain"></div></main>`}));
  await page.goto(url);
  // Rasterize the film grade once. Transport controls stay in the video player.
  const overlay=await page.screenshot({omitBackground:true});
  await page.evaluate(async({overlay,width,height,fps})=>{
    const grade=new Image();
    grade.src='data:image/png;base64,'+overlay;await grade.decode();
    const {createScene}=await import('/src/scene.js');
    const screen=document.querySelector('#screen');
    const render=await createScene(screen,{pixelRatio:1});
    const canvas=screen.querySelector('canvas');
    if(canvas.width!==width||canvas.height!==height)throw Error('Unexpected render dimensions');
    const output=document.createElement('canvas');
    output.width=width;output.height=height;
    const ctx=output.getContext('2d',{alpha:false});
    window.panSamples=[];
    window.renderFrame=index=>{
      // Refresh reflections and all animated effects at every sampled instant.
      window.panSamples.push({...render(index/fps)});
      ctx.drawImage(canvas,0,0);ctx.drawImage(grade,0,0);
      return output.toDataURL('image/jpeg',.98).split(',')[1];
    };
  },{overlay:overlay.toString('base64'),width,height,fps});

  const video=join(tmp,'picture.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(fps),
    '-vcodec','mjpeg','-i','pipe:0','-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v','libx264','-preset','fast','-crf','17','-colorspace','bt709','-color_primaries','bt709',
    '-color_trc','bt709',video],{stdio:['pipe','inherit','inherit']});
  const done=once(encoder,'close');
  for(let i=0;i<fps*seconds;i++){
    const frame=await page.evaluate(index=>window.renderFrame(index),i);
    await new Promise((resolve,reject)=>encoder.stdin.write(Buffer.from(frame,'base64'),err=>err?reject(err):resolve()));
    if((i+1)%(fps*4)===0)console.log(`Rendered ${(i+1)/fps} / ${seconds} seconds`);
  }
  encoder.stdin.end();
  if((await done)[0]!==0)throw Error('Picture encode failed');

  const pcm=await page.evaluate(async({seconds,sampleRate,fps})=>{
    const {soundtrackTracks}=await import('/src/audio.js');
    const ctx=new OfflineAudioContext(2,seconds*sampleRate,sampleRate);
    const bus=ctx.createGain();bus.gain.setValueAtTime(0,0);bus.gain.linearRampToValueAtTime(.84,.015);
    bus.connect(ctx.destination);
    for(const track of soundtrackTracks()){
      const source=ctx.createBufferSource(),response=await fetch(track.file);
      if(!response.ok)throw Error('Missing soundtrack cue '+track.file);
      source.buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      if(track.pan){
        const pan=ctx.createStereoPanner();pan.connect(bus);source.connect(pan);
        pan.pan.setValueAtTime(window.panSamples[0][track.pan],0);
        window.panSamples.forEach((stage,i)=>pan.pan.setTargetAtTime(stage[track.pan],i/fps,.045));
      }else source.connect(bus);
      source.start(track.at);
    }
    const mix=await ctx.startRendering(),left=mix.getChannelData(0),right=mix.getChannelData(1);
    const stereo=new Int16Array(mix.length*2);
    const sample=v=>Math.round(Math.max(-1,Math.min(1,v))*32767);
    for(let i=0;i<mix.length;i++){stereo[2*i]=sample(left[i]);stereo[2*i+1]=sample(right[i])}
    const bytes=new Uint8Array(stereo.buffer),parts=[];
    for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    return btoa(parts.join(''));
  },{seconds,sampleRate,fps});
  const audio=join(tmp,'sound.pcm');
  await writeFile(audio,Buffer.from(pcm,'base64'));
  staging=await mkdtemp(join(release,'.render-'));
  const name='the-last-fill-1080p60.mp4';
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',video,'-f','s16le','-ar',String(sampleRate),
    '-ac','2','-i',audio,'-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',join(staging,name)]);
  await rename(join(staging,name),join(release,name));
  console.log(join(release,name));
} finally {
  encoder?.kill();
  await browser?.close();await server.close();
  await rm(tmp,{recursive:true,force:true});
  if(staging)await rm(staging,{recursive:true,force:true});
}
