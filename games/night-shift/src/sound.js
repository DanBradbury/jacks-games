import { PerspectiveCamera } from 'three';
import { distanceToWindow } from './windows.js';
import { tourPose } from './camera.js';

// All sound is synthesized locally. The offline mix and live scene share this graph.
function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeNoise(ctx, seconds, seed) {
  const roll = random(seed);
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = 2 * roll() - 1;
  return buffer;
}

// Glass responds with a brief broad click followed by two damped pane modes.
// Each side has its own seeded storm, including gusts and occasional heavier drops.
function paneRain(ctx,seed,seconds) {
  const roll=random(seed),rate=ctx.sampleRate;
  const buffer=ctx.createBuffer(1,Math.ceil(rate*seconds),rate),samples=buffer.getChannelData(0);
  for(let at=.013;at<seconds;){
    const gust=.5+.5*Math.sin(at*2*Math.PI/seconds);
    at+=.014-Math.log(Math.max(.001,roll()))/(17+gust*21);
    const start=Math.floor(at*rate),weight=roll()**3;
    const f=580+roll()*1050,ring=105+roll()*85,level=.025+.18*weight;
    for(let k=0;k<rate*.063;k++){
      const t=k/rate,attack=Math.min(1,t*2800);
      const click=(roll()*2-1)*Math.exp(-t*1180);
      const vibration=Math.sin(2*Math.PI*f*t)*Math.exp(-t*ring)+.28*Math.sin(2*Math.PI*f*1.59*t)*Math.exp(-t*240);
      samples[(start+k)%samples.length]+=level*attack*(.65*click+.5*vibration);
    }
  }
  return buffer;
}

function shoeOnConcrete(ctx, seed) {
  const roll = random(seed);
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, Math.ceil(rate * 0.64), rate);
  const dry = new Float32Array(buffer.length);
  const pitch = 72 + roll() * 24;
  const toe = 0.065 + roll() * 0.025;
  let low = 0;
  let phase = 0;
  for (let i = 0; i < dry.length; i++) {
    const t = i / rate;
    const grit = roll() * 2 - 1;
    low += (grit - low) * 0.065;
    phase += 2 * Math.PI * (pitch + 80 * Math.exp(-t * 60)) / rate;
    const heel = Math.min(1, t * 280) * Math.exp(-t * 28);
    const rollOff = Math.max(0, t - toe);
    const sole = Math.min(1, rollOff * 60) * Math.exp(-rollOff * 25);
    dry[i] = heel * (Math.sin(phase) * 0.52 + low * 1.4 + grit * 0.13) +
      sole * (low * 0.9 + grit * 0.05);
  }
  // Unequal early returns from the two window bays and the low ceiling.
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    samples.set(dry);
    for (let reflection = 0; reflection < 15; reflection++) {
      const delay = (0.016 + roll() * 0.012) + reflection * 0.023;
      const start = Math.round(rate * delay);
      const gain = Math.exp(-delay * 13) * (0.15 + 0.08 * roll());
      for (let i = start; i < samples.length; i++) samples[i] += dry[i - start] * gain;
    }
  }
  return buffer;
}

function buildMix(ctx) {
  const level = ctx.createGain();
  level.gain.value = 0.72;
  level.connect(ctx.destination);
  const sources = [];
  const stepBuffers = [173, 299, 653, 881].map(seed => shoeOnConcrete(ctx, seed));
  const noise = makeNoise(ctx, 4.73, 2124);

  function gainNode(value, target) {
    const node = ctx.createGain();
    node.gain.value = value;
    node.connect(target);
    return node;
  }

  function oscillator(type, frequency, gain, target) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gainNode(gain, target));
    osc.start();
    sources.push(osc);
    return osc;
  }

  function airflow(frequency, width, volume, pan, offset) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = width;
    const stereo = ctx.createStereoPanner();
    stereo.pan.value = pan;
    stereo.connect(level);
    const gain = gainNode(volume, stereo);
    source.connect(filter).connect(gain);
    source.start(0, offset);
    sources.push(source);
    return { gain, filter };
  }

  // Four independent layers: mains hum, filtered traffic, wet pavement hiss, and rack cooling.
  oscillator('sine', 59.85, 0.039, level);
  oscillator('sine', 119.83, 0.014, level);
  const traffic = airflow(150, 0.52, 0.54, -0.38, 0.36);
  oscillator('sine', 0.071, 72, traffic.filter.frequency);
  const rain = airflow(1900, 0.42, 0.061, 0.39, 2.4);
  oscillator('sine', 0.115, 0.012, rain.gain.gain);
  const panes=[-1,1].map((side,i)=>{
    const source=ctx.createBufferSource();source.buffer=paneRain(ctx,3948+i*951,9.7+i*2.6);
    source.loop=true;const pan=ctx.createStereoPanner();pan.pan.value=side*.75;
    const gain=gainNode(.5,pan);source.connect(gain);pan.connect(level);
    source.start();sources.push(source);return {side,gain,pan};
  });
  function setWindows(x,z,yaw,when=ctx.currentTime){
    const interior=Math.max(0,x-2.5,-22-z);
    for(const {side,gain,pan} of panes){
      const distance=distanceToWindow(x,z,side);
      gain.gain.setTargetAtTime(.96/(1+distance*.34+interior*2),when,.16);
      pan.pan.setTargetAtTime(side*.78*Math.cos(yaw),when,.16);
    }
  }
  const fan = airflow(465, 0.86, 0.018, 0.09, 1.12);
  const motor = gainNode(0.003, level);
  oscillator('triangle', 173.4, 1.0, motor);
  oscillator('sine', 349.15, 0.37, motor);
  let stepIndex = 0;

  function setPosition(proximity, when = ctx.currentTime) {
    const near = Math.max(0, Math.min(1, proximity));
    fan.gain.gain.setTargetAtTime(0.025 + near * 0.26, when, 0.22);
    fan.filter.frequency.setTargetAtTime(420 + near * 390, when, 0.23);
    motor.gain.setTargetAtTime(0.003 + near * 0.032, when, 0.25);
  }

  function step(strength = 0.5, when = ctx.currentTime) {
    const source = ctx.createBufferSource();
    source.buffer = stepBuffers[stepIndex % stepBuffers.length];
    source.playbackRate.value = 0.95 + 0.027 * (stepIndex % 5);
    const gain = gainNode(0.39 + Math.min(1, Math.max(0, strength)) * 0.35, level);
    const pan = ctx.createStereoPanner();
    pan.pan.value = stepIndex++ % 2 ? -0.13 : 0.13;
    source.connect(pan).connect(gain);
    source.start(when);
    source.onended = () => {
      source.disconnect();
      pan.disconnect();
      gain.disconnect();
    };
  }

  return { level, sources, setPosition, setWindows, step };
}

export function createSoundscape(context = new AudioContext()) {
  const { level, sources, setPosition, setWindows, step } = buildMix(context);
  const capture = context.createMediaStreamDestination();
  level.connect(capture);
  return {
    stream: capture.stream,
    resume: () => context.resume(),
    setMuted: muted => level.gain.setTargetAtTime(muted ? 0 : 0.72, context.currentTime, 0.035),
    setPosition,
    setWindows,
    step,
    dispose() {
      for (const source of sources) source.stop();
      for (const track of capture.stream.getTracks()) track.stop();
      level.disconnect();
      return context.close();
    }
  };
}

export async function renderTourAudio(duration = 30) {
  const sampleRate = 48000;
  const ctx = new OfflineAudioContext(2, Math.round(duration * sampleRate), sampleRate);
  const mix = buildMix(ctx);
  const camera=new PerspectiveCamera();
  for (let time = 0; time < duration; time += 0.25) {
    tourPose(camera,time);
    mix.setWindows(camera.position.x,camera.position.z,camera.rotation.y,time);
    mix.setPosition((-camera.position.z-20)/7.5,time);
  }
  const roll = random(1387);
  for (let time = 0.48; time < duration - 1.4; time += 0.48 + roll() * 0.1) {
    mix.step(0.38 + roll() * 0.35, time);
  }
  mix.level.gain.setValueAtTime(0.001, 0);
  mix.level.gain.linearRampToValueAtTime(0.72, 0.35);
  mix.level.gain.setValueAtTime(0.72, duration - 0.4);
  mix.level.gain.linearRampToValueAtTime(0.001, duration);
  return ctx.startRendering();
}
