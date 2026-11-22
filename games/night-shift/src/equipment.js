import * as T from 'three';

const HALF_PI = Math.PI / 2;

function paintedPanel(width, height, paint, emissive = false) {
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  paint(sheet.getContext('2d'));
  const texture = new T.CanvasTexture(sheet);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return emissive ? new T.MeshBasicMaterial({ map: texture }) : new T.MeshStandardMaterial({ map: texture, roughness: .86 });
}

function diagram() {
  return paintedPanel(768, 592, ctx => {
    ctx.fillStyle = '#cdc5aa'; ctx.fillRect(0, 0, 768, 592);
    ctx.fillStyle = '#343c35'; ctx.font = 'bold 28px monospace'; ctx.fillText('NORTH ANNEX   /   BUS B', 34, 56);
    ctx.font = '14px monospace'; ctx.fillText('POWER DISTRIBUTION   •   FIELD REVISION 04', 35, 88);
    ctx.strokeStyle = '#555b4e'; ctx.lineWidth = 2; ctx.strokeRect(18, 18, 732, 556);
    const wire = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); };
    wire(35, 104, 734, 104);
    for (let row = 0; row < 4; row++) {
      const y = 154 + row * 88;
      wire(74, y, 636, y); wire(93, 154, 93, y); wire(628, y, 628, 430);
      for (let i = 0; i < 4; i++) {
        const x = 150 + i * 123;
        ctx.fillStyle = '#cdc5aa'; ctx.fillRect(x, y-8, 40, 16); ctx.strokeRect(x, y-8, 40, 16);
        ctx.fillStyle = '#575a4a'; ctx.fillText('K' + (row+1) + (i+1), x+3, y-17);
        if ((row + i) % 2 === 0) {
          wire(x+58,y,x+58,y+24); wire(x+58,y+24,x+86,y+24); wire(x+86,y+24,x+86,y);
        }
      }
      ctx.fillText('L' + (row+1), 653, y+4);
    }
    wire(35, 491, 734, 491);
    ctx.font = '15px monospace'; ctx.fillText('ELECTRICAL SERVICES    /    NS-04-17', 36, 530);
    ctx.strokeStyle = '#91563d'; ctx.lineWidth = 3; ctx.strokeRect(568, 504, 147, 44);
    ctx.fillStyle = '#91563d'; ctx.font = 'bold 18px monospace'; ctx.fillText('INSPECTED', 592, 534);
    const fold = ctx.createLinearGradient(370,0,394,0);
    fold.addColorStop(0,'rgba(90,72,44,0)'); fold.addColorStop(.46,'rgba(82,65,40,.15)');
    fold.addColorStop(.53,'rgba(255,249,211,.16)'); fold.addColorStop(1,'rgba(255,244,209,0)');
    ctx.fillStyle = fold; ctx.fillRect(370,18,24,555);
  });
}

function shadowMaterial() {
  const surface = document.createElement('canvas'); surface.width = surface.height = 96;
  const ctx = surface.getContext('2d');
  const grad = ctx.createRadialGradient(48,48,6,48,48,48);
  grad.addColorStop(0,'rgba(9,8,4,.78)'); grad.addColorStop(.61,'rgba(9,8,4,.46)'); grad.addColorStop(1,'rgba(9,8,4,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,96,96);
  return new T.MeshBasicMaterial({ map: new T.CanvasTexture(surface), transparent: true, depthWrite: false });
}

/** Equipment on the server-room console. */
export function dressEquipment({ box, pipe, add, cable, standard, basic, m }) {
  const iron = standard(0x3b4241,.52,.55), zinc = standard(0xa1a398,.39,.67);
  const rubber = standard(0x242624,.85,.04), enamel = standard(0x677b72,.61,.23);
  const cream = standard(0xb2aa8d,.76,.09), oxblood = standard(0x854737,.63,.22);
  const light = basic(0xa5d98c);
  const shadow = shadowMaterial(), plan = diagram();
  const face = (x,y,z,w,h,mat,rx=0,ry=0,rz=0) => add(new T.PlaneGeometry(w,h),mat,x,y,z,rx,ry,rz);
  const contact = (x,y,z,w,d) => face(x,y,z,w,d,shadow,-HALF_PI);
  contact(0,.012,-28.9,3.45,1.5);
  // Terminal service handset, coiled lead, removable drive and file binders.
  box(-.95,1.20,-28.76,.32,.11,.30,iron,.09);
  box(-1.03,1.28,-28.76,.12,.07,.28,rubber,.09);
  for(const z of [-28.65,-28.89])box(-1.03,1.286,z,.137,.086,.092,rubber,.09);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(-.932+i*.034,1.268,-28.72-j*.044,.025,.014,.029,cream,.09);
  cable([[-1.04,1.26,-28.64],[-1.24,1.144,-28.57],[-1.31,1.152,-28.83],[-1.09,1.15,-28.9]],.009,rubber);
  for(let i=0;i<3;i++) {
    const x=.8+i*.105;
    box(x,1.30,-29.12,.084,.32,.239,[enamel,iron,oxblood][i]);
    box(x,1.325,-28.995,.064,.112,.009,cream);
    pipe(x,1.223,-28.995,.013,.011,rubber,HALF_PI);
  }
  box(.78,1.176,-28.68,.32,.065,.22,iron);
  box(.88,1.179,-28.563,.029,.01,.007,light);
  face(.95,1.145,-28.51,.33,.24,plan,-HALF_PI,0,-.16);
  for(const x of [-.13,.11])cable([[x,1.60,-29.02],[x+.04,1.17,-29.18],[x+.24,1.10,-29.46],[x+.18,.38,-29.48],[x+.40,.08,-29.6]],.012,rubber);
}
