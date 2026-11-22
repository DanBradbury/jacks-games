import * as THREE from 'three';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvas(width, height = width) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element.getContext('2d');
}

function texture(ctx, color = true) {
  const map = new THREE.CanvasTexture(ctx.canvas);
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

const SIZE = 512;
const clamp = (n) => Math.max(0, Math.min(1, n));

// Sample a periodic grid. The last texel interpolates back toward the first.
function grain(random, columns, rows = columns) {
  const grid = Float32Array.from({ length: columns * rows }, random);
  const field = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const v = y / SIZE * rows;
    const row = Math.floor(v);
    let fy = v - row;
    fy *= fy * (3 - 2 * fy);
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE * columns;
      const col = Math.floor(u);
      let fx = u - col;
      fx *= fx * (3 - 2 * fx);
      const a = grid[row * columns + col];
      const b = grid[row * columns + (col + 1) % columns];
      const next = (row + 1) % rows * columns;
      const c = grid[next + col];
      const d = grid[next + (col + 1) % columns];
      field[y * SIZE + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
  }
  return field;
}

function stroke(ctx, x, y, dx, dy, color, width) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function surface(kind, seed) {
  const random = rng(seed);
  const broad = grain(random, 5);
  const medium = grain(random, 19);
  const detail = grain(random, 66);
  const streaks = grain(random, 106, 6);
  const albedo = canvas(SIZE);
  const response = canvas(SIZE);
  const pixels = albedo.createImageData(SIZE, SIZE);
  // Green stores roughness, blue stores metalness, red stores relief.
  const physical = response.createImageData(SIZE, SIZE);
  const slabs = Float32Array.from({ length: 16 }, () => random() * 12);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    const low = broad[i], mid = medium[i], fine = detail[i];
    const dust = random();
    const mineral = (low - 0.5) * 38 + (mid - 0.5) * 28 + (fine - 0.5) * 14 + (dust - 0.5) * 16;
    let r, g, b, height, roughness, metalness = 0;
    if (kind === 'floor') {
      const gx = x % 128, gy = y % 128;
      const edge = Math.min(gx, gy, 127 - gx, 127 - gy);
      const chip = clamp((edge - (1 + fine * 3 + dust)) / 1.8);
      const pore = dust > 0.986 ? 27 : 0;
      const aggregate = dust < 0.06 && fine > 0.55 ? 18 : 0;
      const tile = 92 + slabs[(y >> 7) * 4 + (x >> 7)] + mineral - pore + aggregate;
      const wet = clamp((low * 0.63 + mid * 0.22 + fine * 0.15 - 0.51) * 4);
      r = 35 + (tile - wet * 23 - 35) * chip;
      g = r * .987; b = r * .945;
      height = 44 + chip * (104 + fine * 32 + dust * 14);
      roughness = 214 - wet * 138 + (1 - chip) * 32;
    } else if (kind === 'metal') {
      const flake = clamp((mid * .28 + low * .38 + fine * .27 + dust * .07 - .605) * 22);
      const rust = 68 + fine * 50 + dust * 19;
      const paint = 72 + mineral * .65;
      r = paint * (1 - flake) + rust * flake;
      g = (paint + 4) * (1 - flake) + rust * .53 * flake;
      b = (paint + 2) * (1 - flake) + rust * .31 * flake;
      height = 130 - flake * 45 + dust * 14;
      roughness = 121 + flake * 94 + medium[i] * 18; metalness = 80 + (1 - flake) * 30;
    } else {
      const ceiling = kind === 'ceiling';
      const spall = clamp((mid * .32 + low * .32 + fine * .28 + dust * .08 - .60) * 15);
      const drip = clamp((streaks[i] * .7 + low * .3 - .6) * 2.4);
      const hole = dust > .973 && fine > .52 ? 38 : 0;
      const value = (ceiling ? 119 : 155) + mineral - spall * 33 - drip * 25 - hole;
      r = value + spall * 6; g = value - 3 - drip * 3; b = value - 11 - spall * 8;
      height = 139 + fine * 22 + dust * 18 - spall * 42 - hole;
      roughness = 196 + spall * 30 - drip * 38;
    }
    const j = i * 4;
    pixels.data[j] = r; pixels.data[j + 1] = g; pixels.data[j + 2] = b; pixels.data[j + 3] = 255;
    physical.data[j] = height; physical.data[j + 1] = roughness;
    physical.data[j + 2] = metalness; physical.data[j + 3] = 255;
  }
  albedo.putImageData(pixels, 0, 0);
  response.putImageData(physical, 0, 0);

  if (kind === 'wall' || kind === 'ceiling') {
    // Tie-rod recesses from concrete formwork with lime halos and little runoff tails.
    for (const x of [62, 324]) for (const y of [91, 355]) {
      const radius = 3 + random() * 1.6;
      const shadow = albedo.createRadialGradient(x, y, 1, x, y, radius + 4);
      shadow.addColorStop(0, 'rgba(21,18,12,.65)');
      shadow.addColorStop(.5, 'rgba(41,36,29,.53)');
      shadow.addColorStop(.6, 'rgba(190,185,159,.34)');
      shadow.addColorStop(1, 'rgba(170,166,143,0)');
      albedo.fillStyle = shadow; albedo.fillRect(x - 9, y - 9, 18, 18);
      stroke(albedo, x, y + radius, random() - .5, 7 + random() * 21, 'rgba(54,42,26,.15)', 1.4);
    }
    for (let n = 0; n < 3; n++) {
      let x = 80 + random() * 300, y = 24 + random() * 326;
      const direction = random() > .5 ? 1 : -1;
      for (let k = 0; k < 14; k++) {
        const dx = direction * (random() * 5 + 1), dy = (random() - .35) * 10;
        stroke(albedo, x, y, dx, dy, 'rgba(47,39,31,.38)', .7 + .2 * random());
        x += dx; y += dy;
      }
    }
  } else {
    for (let n = 0; n < 120; n++) {
      const x = random() * SIZE, y = random() * SIZE;
      const angle = random() * Math.PI;
      const length = 1 + Math.pow(random(), 5) * 40;
      stroke(albedo, x, y, Math.sin(angle) * length, Math.cos(angle) * length,
        n % 3 ? 'rgba(189,184,160,.17)' : 'rgba(28,26,23,.17)', .5 + random());
    }
  }
  const channels = texture(response, false);
  return new THREE.MeshStandardMaterial({
    map: texture(albedo), bumpMap: channels, bumpScale: kind === 'metal' ? .012 : .029,
    roughnessMap: channels, roughness: 1, metalnessMap: channels, metalness: kind === 'metal' ? 1 : 0,
  });
}

function monitor() {
  const ctx = canvas(768, 432);
  ctx.fillStyle = '#071816'; ctx.fillRect(0, 0, 768, 432);
  ctx.fillStyle = '#86e0ba'; ctx.font = 'bold 26px monospace';
  ctx.fillText('NODE 07  /  TELEMETRY', 24, 46);
  ctx.fillStyle = '#478f71'; ctx.fillRect(24, 61, 720, 2);
  const random = rng(197);
  const labels = ['NET IN', 'NET OUT', 'CPU LOAD', 'BUS TEMP'];
  for (let i = 0; i < 4; i++) {
    const y = 102 + i * 76;
    ctx.fillStyle = '#78cba4'; ctx.font = '16px monospace'; ctx.fillText(labels[i], 25, y);
    ctx.fillStyle = '#346753'; ctx.font = '12px monospace';
    ctx.fillText(['018.38 Gb/s', '004.79 Gb/s', '023.66 %', '033.07 °C'][i], 25, y + 20);
    for (let j = 0; j < 120; j++) {
      const h = 5 + random() * 8 + Math.pow(random(), 7) * 33;
      ctx.fillStyle = j % 7 ? '#5cb28b' : '#a8ddac';
      ctx.fillRect(147 + j * 4.95, y + 20 - h, 3.5, h);
    }
  }
  ctx.fillStyle = '#6dbb97'; ctx.font = '14px monospace'; ctx.fillText('LINK ESTABLISHED   /   LOCAL CONSOLE', 24, 403);
  ctx.fillStyle = 'rgba(0,0,0,.17)';
  for (let y = 0; y < 432; y += 3) ctx.fillRect(0, y, 768, 1);
  return new THREE.MeshBasicMaterial({ map: texture(ctx), toneMapped: false });
}

function sign(title, subtitle = '', accent = '#c77c45') {
  const ctx = canvas(576, 192);
  ctx.fillStyle = '#242725'; ctx.fillRect(0, 0, 576, 192);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 12, 192);
  ctx.fillStyle = '#e5dcca'; ctx.font = 'bold 50px sans-serif';
  ctx.fillText(title, 36, subtitle ? 94 : 114, 504);
  ctx.fillStyle = '#a6aaa0'; ctx.font = '24px monospace'; ctx.fillText(subtitle, 38, 144, 495);
  const random = rng(320);
  ctx.fillStyle = 'rgba(165,155,125,.33)';
  for (let i = 0; i < 550; i++) ctx.fillRect(random() * 576, random() * 192, 1 + random() * 2, 1);
  for (const x of [24, 560]) for (const y of [14, 178]) {
    ctx.fillStyle = '#6b6b62'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    stroke(ctx, x - 2, y + 1, 4, -2, '#282822', 1);
  }
  return new THREE.MeshStandardMaterial({ map: texture(ctx), roughness: .64, metalness: .12 });
}

export function createMaterials() {
  return { ceiling: surface('ceiling',1771), metal: surface('metal',1970), monitor: monitor(), sign };
}
