import { renderTourAudio } from './sound.js';

async function selectFormat(width,height) {
  if (!window.VideoEncoder || !window.AudioEncoder) throw Error('Recording requires WebCodecs. Open in Chrome or Edge over HTTPS or localhost.');
  for (const mp4 of [true,false]) {
    const video={codec:mp4?'avc1.42001f':'vp8',width,height,bitrate:8500000,framerate:30};
    if(mp4)video.avc={format:'avc'};
    const audio={codec:mp4?'mp4a.40.2':'opus',sampleRate:48000,numberOfChannels:2,bitrate:128000};
    const [v,a]=await Promise.all([VideoEncoder.isConfigSupported(video),AudioEncoder.isConfigSupported(audio)]);
    if(v.supported && a.supported)return {mp4,video,audio};
  }
  throw Error('This browser has no supported recording encoder. Try Chrome or Edge.');
}

// Advance the camera on presentation timestamps. GPU speed affects export time only.
export async function recordTour(canvas,draw,progress,signal) {
  const {mp4,video,audio}=await selectFormat(canvas.width,canvas.height);
  const {Muxer,ArrayBufferTarget}=mp4?await import('mp4-muxer'):await import('webm-muxer');
  const muxer=new Muxer({
    target:new ArrayBufferTarget(),
    video:{codec:mp4?'avc':'V_VP8',width:video.width,height:video.height,frameRate:30},
    audio:{codec:mp4?'aac':'A_OPUS',numberOfChannels:2,sampleRate:48000},
    ...(mp4?{fastStart:'in-memory'}:{}),firstTimestampBehavior:'offset',
  });
  let error;
  const onError=e=>{error=e;};
  const output=method=>(chunk,meta)=>{try{muxer[method](chunk,meta);}catch(e){onError(e);}};
  const ve=new VideoEncoder({output:output('addVideoChunk'),error:onError});
  const ae=new AudioEncoder({output:output('addAudioChunk'),error:onError});
  async function drain(encoder,limit){
    while(encoder.encodeQueueSize>limit){
      check();await new Promise(resolve=>setTimeout(resolve,2));
    }
  }
  function check(){signal.throwIfAborted();if(error)throw error;}
  try {
    ve.configure(video);ae.configure(audio);
    const mix=await renderTourAudio(30);
    const block=mp4?1024:960;
    for(let start=0;start<mix.length;start+=block){
      check();
      const count=Math.min(block,mix.length-start),pcm=new Float32Array(count*2);
      for(let c=0;c<2;c++)pcm.set(mix.getChannelData(c).subarray(start,start+count),c*count);
      const sample=new AudioData({format:'f32-planar',sampleRate:48000,numberOfFrames:count,numberOfChannels:2,
        timestamp:Math.round(start*1e6/48000),data:pcm});
      ae.encode(sample);sample.close();
      await drain(ae,48);
    }
    await ae.flush();
    for(let i=0;i<900;i++){
      check();draw(i/30);
      const ts=Math.round(i*1e6/30);
      const frame=new VideoFrame(canvas,{timestamp:ts,duration:Math.round((i+1)*1e6/30)-ts});
      ve.encode(frame,{keyFrame:i%90===0});frame.close();
      await drain(ve,10);
      if(i%6===0){progress(i/900);await new Promise(resolve=>setTimeout(resolve,0));}
    }
    await ve.flush();check();muxer.finalize();
    return {blob:new Blob([muxer.target.buffer],{type:mp4?'video/mp4':'video/webm'}),ext:mp4?'mp4':'webm'};
  }finally{if(ve.state!=='closed')ve.close();if(ae.state!=='closed')ae.close();}
}
