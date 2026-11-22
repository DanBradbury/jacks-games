import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { windowCenters } from './windows.js';
import { createWeather } from './weather.js';
import { dressRacks } from './racks.js';
import { scatterLitter } from './litter.js';
import { dressCloset } from './closet.js';
import { dressEquipment } from './equipment.js';
import { createMaterials } from './materials.js';

export const bounds = [
  [-2.35, 2.35, -22, 7], [2.10, 6.16, -9.66, -8.34], [2.85, 6.16, -11.49, -6.51],
  [-1.05, 1.05, -22.6, -21.7], [-3.4, 3.4, -29.5, -22.3]
];
export const obstacles = [];
export function canStand(x,z) {
  return bounds.some(([a,b,c,d]) => x>=a && x<=b && z>=c && z<=d) &&
    !obstacles.some(([a,b,c,d]) => x>a && x<b && z>c && z<d);
}

export function createWorld(scene,scans,cityTextures,rackFront) {
  const m = {...createMaterials(),...scans}, groups = new Map();
  let seed = 6418;
  const rand = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const basic = color => new T.MeshBasicMaterial({color});
  const standard = (color, roughness=.7, metalness=.15) => new T.MeshStandardMaterial({color,roughness,metalness});
  const iron=standard(0x302e2b), black=standard(0x161c21), brass=standard(0x806948,.42,.55);
  const green=basic(0x8bffb5), red=basic(0xff4924);
  const white=standard(0x939382), rubber=standard(0x101719);
  const rot=new T.Euler(), transform=new T.Matrix4(), quat=new T.Quaternion(), scale=new T.Vector3(1,1,1);
  const surfaces=new Set([m.floor,m.wall,m.plaster,m.ceiling,m.metal]);
  let assembly=null;
  function add(g,material,x,y,z,rx=0,ry=0,rz=0) {
    transform.compose(new T.Vector3(x,y,z),quat.setFromEuler(rot.set(rx,ry,rz)),scale);
    g.applyMatrix4(transform);
    if(assembly)g.applyMatrix4(assembly);
    if(surfaces.has(material)) {
      const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      for(let i=0;i<p.count;i++){
        const wall=Math.abs(n.getY(i))<.6;
        const horizontal=wall && Math.abs(n.getX(i))>.6 ? p.getZ(i) : p.getX(i);
        const span=material===m.plaster?2.15:3;
        // Shift the scan at construction joints to avoid repeated spalls at eye level.
        const phase=material===m.plaster?Math.sin(x*11.4+z*2.27)*.83:0;
        uv.setXY(i,horizontal/span+phase,(wall ? p.getY(i) : p.getZ(i))/span+phase*.74);
      }
    }
    if(!groups.has(material))groups.set(material,[]);
    groups.get(material).push(g);
  }
  const box=(x,y,z,w,h,d,mat,rx=0,ry=0,rz=0)=>add(new T.BoxGeometry(w,h,d),mat,x,y,z,rx,ry,rz);
  const pipe=(x,y,z,r,h,mat,rx=0,rz=0)=>add(new T.CylinderGeometry(r,r,h,12),mat,x,y,z,rx,0,rz);
  function cable(points,r,mat) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    // Match indexed geometry used by boxes and cylinders.
    add(new T.TubeGeometry(curve,28,r,6,false),mat,0,0,0);
  }
  function light(x,y,z,color,power,distance) {
    const l=new T.PointLight(color,power,distance,2); l.position.set(x,y,z);scene.add(l);return l;
  }
  const fixtures=[];
  function agingLamp(bulb,lights,first,period,depth){
    fixtures.push({bulb,color:bulb.color.clone(),lights:lights.map(l=>[l,l.intensity]),first,period,depth});
  }
  function updateFixtures(seconds){
    for(const f of fixtures){
      let output=1;
      if(seconds>=f.first){
        const cycle=Math.floor((seconds-f.first)/f.period);
        const t=(seconds-f.first)%f.period;
        // A short sag, partial recovery, then a softer dip on alternate starts.
        const dip=(center,width)=>Math.exp(-Math.pow((t-center)/width,2));
        output-=f.depth*(dip(.25,.135)+(cycle%2===0?.54*dip(.85,.18):0));
      }
      f.bulb.color.copy(f.color).multiplyScalar(output);
      for(const [light,base] of f.lights)light.intensity=base*output;
    }
  }
  scene.background=new T.Color(0x131d2b);
  scene.fog=new T.FogExp2(0x1c2a39,.015);
  scene.add(new T.HemisphereLight(0x9bbbe1,0x655447,.15));
  const moon=new T.DirectionalLight(0x9fbfd7,.14);moon.position.set(-12,16,-8);scene.add(moon);

  box(0,-.15,-7.5,5.4,.3,30,m.floor);
  box(0,3.68,-7.5,5.4,.32,30,m.ceiling);
  box(0,1.75,7.42,5.4,3.5,.25,m.wall);
  const weather=createWeather(scene,cityTextures,rand);
  const windowGlow=basic(0x48534e);
  for(let side of [-1,1]){
    for(let i=0;i<10;i++){
      const z=6-i*3,x=side*2.59;
      if(side===1 && i===5) continue;
      box(side*2.45,.09,z,.10,.17,3,m.metal);
      if(!windowCenters[side].includes(z)){
        box(x,1.76,z,.25,3.52,3,m.plaster);
        continue;
      }
      // Deep concrete reveals and a projecting sill surround each isolated opening.
      box(x,.49,z,.29,.98,3,m.plaster);
      box(x,3.12,z,.29,.80,3,m.plaster);
      for(const end of [-1,1]){
        box(x,1.85,z+end*1.36,.29,1.75,.28,m.plaster);
        box(side*2.54,1.85,z+end*1.215,.09,1.75,.055,iron);
      }
      // Cool city light enters through the opening at glazing height.
      light(side*2.14,1.94,z,0x8baacc,5.8,6.0);
      add(new T.PlaneGeometry(2.44,1.76),weather.glass,side*2.57,1.85,z,0,-side*Math.PI/2);
      for(const y of [1.005,2.70])box(side*2.54,y,z,.10,.06,2.46,iron);
      box(side*2.54,1.85,z+.38,.09,1.72,.047,iron);
      box(side*2.48,.96,z,.42,.085,2.61,m.metal);
      box(side*2.43,.57,z+.25,.04,.043,.63,windowGlow);
    }
  }
  // Two service lights skim the painted surface. The stand-off, cast base
  // and wire cage explain the warm raking light at either end of the hall.

  for(const [side,z] of [[1,-1.85],[-1,-15.7]]){
    const mount=side*2.45,lampGlass=basic(0x94734d);
    box(mount,2.21,z,.09,.37,.21,m.metal);
    pipe(mount-side*.078,2.21,z,.068,.24,lampGlass);
    for(const y of [2.07,2.35])pipe(mount-side*.078,y,z,.086,.046,iron);
    for(const dz of [-.06,0,.06])box(mount-side*.14,2.21,z+dz,.014,.26,.012,iron);
    for(const y of [2.14,2.27])box(mount-side*.145,y,z,.014,.01,.15,iron);
    for(const dz of [-.075,.075])for(const y of [2.065,2.355])
      pipe(mount-side*.053,y,z+dz,.012,.01,brass,0,Math.PI/2);
    agingLamp(lampGlass,[light(mount-side*.25,2.21,z,0xf3b575,.58,3.2)],side>0?7.4:20.8,17.3,.63);
  }
  for(let j=0;j<5;j++){
    const x=-2.19+j*.155,y=3.18+(j%2)*.11;
    pipe(x,y,-7.4,j===0?.11:.052,29.7,j===0?m.metal:iron,Math.PI/2);
    for(let z=6;z>-22;z-=2.8)pipe(x,y,z,j===0?.13:.066,.072,brass,Math.PI/2);
  }
  for(let z=6;z>-22;z-=4.6){
    box(0,3.43,z,5.2,.19,.145,m.metal);
    cable([[1.86,3.42,z],[1.89,3.05,z-1.8],[1.85,3.41,z-4.6]],.022,rubber);
  }
  const enamel=standard(0x404335,.45,.4);
  for(const [index,z] of [1.35,-9.2,-21.2].entries()){
    const warm=basic(index%2?0xc8ba88:0xe4bd85);
    pipe(-.25,3.495,z,.074,.05,iron);
    pipe(-.25,3.29,z,.014,.37,iron);
    pipe(-.25,3.095,z,.050,.075,enamel);
    add(new T.CylinderGeometry(.065,.29,.115,32,1,true),enamel,-.25,3.02,z);
    const lining=basic(0xbba381);
    lining.side=T.BackSide;
    add(new T.CylinderGeometry(.062,.287,.112,32,1,true),lining,-.25,3.019,z);
    const bulb=new T.SphereGeometry(.070,18,12);bulb.scale(1,1.35,1);
    add(bulb,warm,-.25,2.925,z);
    // Wire hoops and bowed ribs keep the bulb legible against the dark shade.
    for(const [y,r] of [[2.918,.102],[2.846,.086],[2.817,.057]]){
      add(new T.TorusGeometry(r,.004,5,28),iron,-.25,y,z,Math.PI/2);
    }
    for(let k=0;k<6;k++){
      const dx=Math.cos(k*Math.PI/3),dz=Math.sin(k*Math.PI/3);
      cable([[ -.25+dx*.095,2.988,z+dz*.095],[-.25+dx*.103,2.924,z+dz*.103],
        [-.25+dx*.085,2.846,z+dz*.085],[-.25+dx*.056,2.817,z+dz*.056]],.004,iron);
    }
    const spill=light(-.25,2.89,z,0xe7ad74,4.5,6.6);
    const cone=new T.SpotLight(index%2?0xe4d1a0:0xefbb83,35,8.5,1.07,.78,1.7);
    cone.position.set(-.25,2.91,z);cone.target.position.set(-.25,0,z);
    scene.add(cone,cone.target);
    const first=1.2+index*5.2,period=21+index*1.35,depth=.53+index%2*.12;
    agingLamp(warm,[spill,cone],first,period,depth);
    agingLamp(lining,[],first,period,depth);
  }
  // Painted threshold stripes, dirt, folded forms and chipped plaster fragments.
  const paint=standard(0x978151), paper=[white,standard(0x8d785c),standard(0x585e5d)];
  for(let i=0;i<106;i++){
    const x=(rand() < .76 ? (rand()<.5?-1:1)*(1.5+rand()*.9) : rand()*4.6-2.3);
    const z=7-rand()*28.8,s=.035+rand()**3*.28;
    box(x,.012+rand()*.013,z,s,.009,s*(.55+rand()),paper[i%3],.025,rand()*6,.016);
    if(i%7===0)box(x,.029,z,s*.45,.012,s*.7,paper[i%3],.1,rand(),.16);
  }
  scatterLitter({box,pipe,add,standard});
  for(let z of [-20.6,-20.78])box(0,.009,z,4.99,.012,.053,paint);
  // Narrow janitor's closet with an open doorway and a single failing strip.
  box(4.57,-.15,-9,3.99,.30,5.92,m.floor);
  box(4.57,2.94,-9,3.99,.24,5.92,m.ceiling);
  for(const z of [-11.91,-6.09])box(4.57,1.43,z,3.99,2.86,.18,m.plaster);
  box(6.51,1.43,-9,.18,2.86,5.92,m.plaster);
  for(const z of [-10.70,-7.30])box(2.61,1.76,z,.24,3.52,1.60,m.plaster);
  box(2.60,2.98,-9,.26,1.09,1.88,m.plaster);
  for(const z of [-9.90,-8.10])box(2.58,1.21,z,.30,2.42,.095,m.metal);
  box(2.58,2.43,-9,.30,.10,1.90,m.metal);
  add(new T.PlaneGeometry(.70,.22),m.sign('JANITOR','SERVICE  /  07'),2.442,1.63,-7.67,0,-Math.PI/2);
  // Worn bay number stencilled onto the plaster at the door.
  const signCanvas=document.createElement('canvas');signCanvas.width=384;signCanvas.height=224;
  const ink=signCanvas.getContext('2d');ink.fillStyle='#b4a483';ink.font='bold 183px monospace';
  ink.fillText('07',65,176);ink.globalCompositeOperation='destination-out';ink.fillStyle='#000';
  let stencilSeed=2471;
  const speck=()=>((stencilSeed=(Math.imul(stencilSeed,1664525)+1013904223)>>>0)/4294967296);
  for(let k=0;k<3900;k++)ink.fillRect(speck()*384,speck()*224,1+speck()*3,1+speck()*2);
  const stencil=new T.CanvasTexture(signCanvas);stencil.colorSpace=T.SRGBColorSpace;
  add(new T.PlaneGeometry(.61,.36),new T.MeshStandardMaterial({map:stencil,transparent:true,opacity:.57,depthWrite:false}),
    2.461,1.60,-10.96,0,-Math.PI/2);
  dressCloset({add,box,pipe,cable,standard,m,obstacles});
  // One pendant below the ceiling: cable, strain relief, flared enamel
  // shade and a diffusing glass bulb. Only the bulb lights the closet.
  const bulb=basic(0x949a87),lampX=5.25,lampZ=-9.13;
  pipe(lampX,2.80,lampZ,.056,.032,iron);
  pipe(lampX,2.585,lampZ,.007,.43,rubber);
  pipe(lampX,2.345,lampZ,.023,.058,brass);
  // LatheGeometry winds outward along an ascending profile. Keep the
  // rolled lip and exterior separate from the reflector facing the bulb.
  const shellProfile=[[.091,-.043],[.095,-.041],[.094,-.035],[.060,.002],[.036,.036],[.016,.050]];
  const linerProfile=[[.015,.044],[.032,.032],[.056,-.001],[.090,-.038],[.091,-.043]];
  const lathe=profile=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),40);
  add(lathe(shellProfile),standard(0x30332d,.76,.19),lampX,2.30,lampZ);

  const lining=basic(0x6a6a56);
  const reflector=lathe(linerProfile);
  const vertices=reflector.attributes.position,shading=[];
  for(let i=0;i<vertices.count;i++){
    const radius=Math.hypot(vertices.getX(i),vertices.getZ(i));
    const bounce=.23+.77*(1-T.MathUtils.smoothstep(radius,.029,.092));
    shading.push(bounce,bounce,bounce);
  }
  reflector.setAttribute('color',new T.Float32BufferAttribute(shading,3));
  lining.vertexColors=true;
  add(reflector,lining,lampX,2.30,lampZ);
  add(new T.SphereGeometry(.029,20,14),bulb,lampX,2.265,lampZ);
  // Limit direct light to the aperture. The opaque shade screens the
  // upper hemisphere, including the socket, suspension cord and ceiling.
  const pool=new T.SpotLight(0xb8bbaa,1.55,3.65,1.29,.40,2);
  pool.position.set(lampX,2.265,lampZ);
  pool.target.position.set(lampX,0,lampZ);
  scene.add(pool,pool.target);
  agingLamp(bulb,[pool],13.25,16.7,.69);
  agingLamp(lining,[],13.25,16.7,.69);
  // End bulkhead frames a real opening into the machine room.
  for(let x of [-1.93,1.93])box(x,1.75,-22.25,1.48,3.5,.32,m.wall);
  box(0,3.08,-22.25,2.45,.88,.32,m.wall);
  for(let x of [-1.19,1.19])box(x,1.34,-22.19,.11,2.67,.42,m.metal);
  box(0,2.65,-22.19,2.47,.11,.42,m.metal);
  box(0,2.99,-22.04,1.44,.34,.045,m.sign('SERVER ROOM','RESTRICTED ACCESS','#92cfa1'));
  box(0,-.15,-26.16,7.52,.30,8.06,m.floor);
  box(0,3.68,-26.16,7.52,.32,8.06,m.ceiling);
  box(0,1.75,-30.12,7.52,3.5,.25,m.plaster);
  for(let x of [-3.72,3.72]){
    box(x,1.75,-26.15,.2,3.5,8,m.wall);
    box(x*.74,1.75,-22.32,1.9,3.5,.24,m.wall);
  }
  dressRacks({add,box,pipe,cable,standard,basic,m,front:rackFront,obstacles});
  // Compact maintenance terminal beside the full-height switchgear.
  assembly=new T.Matrix4().makeScale(.61,.83,.70).setPosition(-1.97,0,-8.62);
  box(0,1.08,-28.9,2.8,.12,1.09,m.metal);
  for(let x of [-1.18,1.18])box(x,.55,-28.9,.13,1.1,.84,iron);
  obstacles.push([-3.03,-.95,-30,-28.31]);
  box(0,1.32,-28.9,.2,.4,.19,iron);
  box(0,1.89,-28.92,1.58,.89,.19,black);
  box(0,1.89,-28.81,1.47,.79,.015,m.monitor);
  box(0,1.17,-28.55,.82,.045,.27,black);
  for(let j=0;j<4;j++)for(let k=0;k<16;k++)box(-.37+k*.048,1.20,-28.46-j*.055,.037,.014,.037,iron);
  dressEquipment({box,pipe,add,cable,standard,basic,m});
  assembly=null;
  light(-1.97,1.65,-28.40,0x87d6af,.62,2.1);
  box(0,3.41,-26.8,1.65,.1,.28,iron);box(0,3.34,-26.8,1.54,.04,.18,basic(0x899887));
  light(0,3.1,-26.8,0xb4ccbb,4.8,5.5);
  // Ladder tray, steam risers, valve wheels, loose electrical leads.
  for(let z of [2.4,-12.9,-18.4]){
    for(let k=0;k<2;k++){
      pipe(2.32-k*.17,1.72,z,.064,3.38,m.metal);
      for(let y of [.27,1.23,2.72])pipe(2.32-k*.17,y,z,.088,.09,brass);
    }
    add(new T.TorusGeometry(.17,.022,8,20),standard(0x8e3929),2.11,1.13,z,0,Math.PI/2);
    box(2.11,1.13,z,.035,.29,.032,iron);
  }
  for(let k=0;k<4;k++){
    cable([[-2.38,.035,-15+k*.06],[-1.91,.039,-15.4+k*.07],[-1.45,.036,-16.9+k*.06],[-2.26,.04,-17.43+k*.055]],.016,rubber);
  }
  // Recessed fire hose cabinet. A glazed front exposes the wound hose, brass
  // couplings and folded nozzle behind a battered vermilion frame.
  const oxide=standard(0x793d32,.64,.3), hose=standard(0x746753,.89,0);
  function fireCabinet(x,z){
    box(x,1.48,z,.29,1.48,.91,oxide);
    const face=x-.152;
    box(face,1.47,z,.03,1.27,.76,black);
    for(let i=0;i<8;i++)add(new T.TorusGeometry(.073+i*.029,.019,7,36),hose,face-.033,1.56,z,0,Math.PI/2);
    pipe(face-.06,1.02,z+.22,.047,.24,brass);
    for(let y of [.84,2.09])box(face-.09,y,z,.095,.055,.84,oxide);
    for(let dz of [-.39,.39])box(face-.09,1.47,z+dz,.095,1.25,.055,oxide);
    box(face-.11,1.44,z-.32,.035,.16,.034,brass);
    add(new T.PlaneGeometry(.78,.19),m.sign('FIRE HOSE',''),face-.055,2.17,z,0,-Math.PI/2);
    obstacles.push([face-.34,2.65,z-.71,z+.71]);
  }
  fireCabinet(2.26,-3.75);
  // Drain covers sit in the wet slab, with paired rows of slotted openings.
  for(let z of [2.6,-4.2,-12.1,-19.3]){
    box(-1.43,.019,z,.45,.024,.7,iron);
    for(let j=0;j<11;j++) for(let k of [-1,1])box(-1.43+k*.09,.034,z-.28+j*.055,.126,.009,.023,black);
  }
  // Pneumatic riser and manometer tucked alongside a window column.
  for(let z of [1.57,-15.2]){
    pipe(-2.31,1.6,z,.092,3.16,m.metal);
    for(let y of [.17,.79,1.91,2.74]){
      pipe(-2.31,y,z,.122,.055,iron);
      box(-2.425,y,z,.20,.055,.07,iron);
    }
    pipe(-2.21,1.46,z,.038,.24,brass,0,Math.PI/2);
    const dial=document.createElement('canvas');dial.width=dial.height=128;
    const g=dial.getContext('2d');g.fillStyle='#b6b09a';g.fillRect(0,0,128,128);
    g.translate(64,64);g.strokeStyle='#302d26';
    for(let i=0;i<=24;i++){g.save();g.rotate(-2.35+i*.196);
      g.beginPath();g.moveTo(0,-51);g.lineTo(0,i%4?-44:-38);g.stroke();g.restore();}
    g.lineWidth=3;g.beginPath();g.moveTo(4,7);g.lineTo(-24,-33);g.stroke();
    g.font='12px monospace';g.fillStyle='#272723';g.textAlign='center';g.fillText('BAR',0,25);
    const tex=new T.CanvasTexture(dial);tex.colorSpace=T.SRGBColorSpace;
    pipe(-2.05,1.47,z,.144,.073,iron,0,Math.PI/2);
    add(new T.CircleGeometry(.126,30),new T.MeshStandardMaterial({map:tex}),-2.011,1.47,z,0,Math.PI/2);
  }
  // Backlit signs mounted on the street-facing towers, aligned with the walkway.
  const signNames=[['HOTEL','VACANCY'],['KINO','LATE SHOW'],['NORI','MARKET'],['AXIS','TRANSIT']];
  function neonBoard(index) {
    const c=document.createElement('canvas');c.width=192;c.height=384;
    const g=c.getContext('2d'), ink=['#f18482','#8abecb','#ceb086','#b9a0c7'][index];
    g.fillStyle='#131a21';g.fillRect(0,0,192,384);g.strokeStyle=ink;g.lineWidth=4;
    g.strokeRect(8,8,176,368);g.textAlign='center';g.shadowColor=ink;g.shadowBlur=8;
    g.fillStyle=ink;g.font='bold 56px sans-serif';const [title,sub]=signNames[index];
    [...title].forEach((l,i)=>g.fillText(l,96,68+i*(250/title.length)));
    g.font='20px monospace';g.fillText(sub,96,340);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map});
  }
  const cityBoards=signNames.map((_,i)=>neonBoard(i));
  // Photographic bays keep desks, partitions and ceiling fixtures at human scale.
  // Each mass has its own UV origin. Separate wings, setbacks and roof plant
  // give nearby towers actual depth as the observer walks along the glass.
  const facades=[0xffe3c7,0xaecbdd,0xb2becd,0xffecd6].map(color=>
    new T.MeshBasicMaterial({map:cityTextures.facade,color}));
  const cladding=basic(0x242d35), roof=basic(0x30363b), rim=basic(0x45515a);
  function block(x,z,w,d,base,height,material,offset){
    const g=new T.BoxGeometry(w,height,d),uv=g.attributes.uv,n=g.attributes.normal;
    for(let k=0;k<uv.count;k++){
      const faceWidth=Math.abs(n.getX(k))>.5?d:w;
      uv.setXY(k,offset+uv.getX(k)*faceWidth/19,uv.getY(k)*height/19.8);
    }
    add(g,material,x,base+height/2,z);
    box(x,base+height+.14,z,w+.16,.28,d+.16,rim);
    box(x,base+height+.31,z,w,.1,d,roof);
  }
  for(const side of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<6;i++){
    const x=side*(25+row*26+rand()*8),z=-76+i*26+rand()*8+side*4;
    const w=10+rand()*8,d=10+rand()*7,base=-51,top=-5+rand()*26+row*13;
    const material=facades[(i+row+(side===1?2:0))%4],offset=Math.floor(rand()*8)/8;
    block(x,z,w,d,base,top-base,material,offset);
    const crown=3.3*(1+Math.floor(rand()*4));
    block(x+.4,z-.6,w*.73,d*.72,top+.36,crown,material,offset+.125);
    const perch=top+crown+.72;
    box(x,perch+.62,z,w*.32,1.24,d*.34,cladding);
    for(let j=0;j<3;j++)pipe(x-1.8+j*1.13,perch+.34,z+d*.23,.42,.64,roof);
    if(i%3===0){pipe(x,perch+2.5,z,.055,5,iron);box(x,perch+5,z,.13,.12,.13,red);}
    if(row===0){
      const street=x-side*(w/2+.12);
      for(let j=-1;j<=1;j++)box(street,(top+base)/2,z+j*d*.33,.28,top-base,.16,cladding);
      for(let j=base+9.9;j<top-.9;j+=9.9)box(x,j,z,w+.22,.24,d+.25,roof);
      if(i%2===1){
        const signY=Math.min(top-3.4,2.);
        box(street-side*.15,signY,z+d*.3,.32,5.4,1.85,cladding);
        add(new T.PlaneGeometry(1.78,5.28),cityBoards[(i+(side===1?1:0))%4],
          street-side*.32,signY,z+d*.3,0,-side*Math.PI/2);
      }
    }
  }
  for(const [material,parts] of groups){
    const merged=mergeGeometries(parts,false);
    const mesh=new T.Mesh(merged,material);
    scene.add(mesh); parts.forEach(g=>g.dispose());
  }
  // Project the real scene into thin patches of standing water. Low-frequency
  // coverage and fine ripples dissolve the mirror into the porous floor.
  const shader=Reflector.ReflectorShader;
  const wet=new Reflector(new T.PlaneGeometry(5.1,29.55),{
    clipBias:.003,multisample:0,textureWidth:640,textureHeight:360,color:0xffffff,
    shader:{...shader, fragmentShader:shader.fragmentShader.replace('void main() {',`
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      varying vec2 floorUV;
      void main() {`).replace('texture2DProj( tDiffuse, vUv )','texture2D( tDiffuse, vUv.xy/vUv.w + .00075*vec2(noise(floorUV*460.), noise(floorUV*640.)) )')
      .replace('#include <tonemapping_fragment>',`float mask=noise(floorUV*vec2(5.,24.))*.64+noise(floorUV*vec2(15.,65.))*.28+noise(floorUV*vec2(77.,180.))*.08;
        gl_FragColor=vec4(base.rgb, .56*smoothstep(.43,.58,mask));
        #include <tonemapping_fragment>`),
      vertexShader:shader.vertexShader.replace('void main() {','varying vec2 floorUV; void main() { floorUV=uv;')}
  });
  wet.material.transparent=true;wet.material.depthWrite=false;wet.rotation.x=-Math.PI/2;wet.position.set(0,.006,-7.43);scene.add(wet);
  return seconds=>{weather.update(seconds);updateFixtures(seconds);};
}
