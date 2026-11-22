import * as T from 'three';

export function dressCloset({add,box,pipe,cable,standard,m,obstacles}){
  const wood=standard(0x83633e,.92,0), iron=m.metal;
  const straw=[0x997844,0xb69963,0x76603d,0x695238].map(c=>standard(c,.97,0));
  const cotton=[0x6d6758,0x9d9380,0x807965].map(c=>standard(c,1,0));
  const steel=standard(0x6e7470,.46,.62),dark=standard(0x282921,.85,.15);
  const pail=standard(0x9a7635,.7,.06), porcelain=standard(0xaaa797,.57,.05);
  let state=6241;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  // Leak fan under the tap: pigments settle in runs with a broken lower edge.
  const stainCanvas=document.createElement('canvas');stainCanvas.width=384;stainCanvas.height=512;
  const stain=stainCanvas.getContext('2d');
  for(let j=0;j<280;j++){
    const x=192+(random()+random()-1)*187,start=random()*75,end=start+70+random()*355;
    const flow=stain.createLinearGradient(0,start,0,end);
    flow.addColorStop(0,'rgba(58,44,21,0)');flow.addColorStop(.16,'rgba(67,52,28,.14)');flow.addColorStop(1,'rgba(46,43,28,0)');
    stain.fillStyle=flow;stain.fillRect(x,start,1+random()*8,end-start);
  }
  const stainMap=new T.CanvasTexture(stainCanvas);stainMap.colorSpace=T.SRGBColorSpace;
  const damp=new T.MeshBasicMaterial({map:stainMap,transparent:true,depthWrite:false});
  add(new T.PlaneGeometry(1.36,1.27),damp,6.414,.69,-10.88,0,-Math.PI/2);
  add(new T.PlaneGeometry(1.18,.92),damp,6.414,.48,-9.54,0,-Math.PI/2);
  function jugLabel(title,ink){
    const c=document.createElement('canvas');c.width=192;c.height=144;const g=c.getContext('2d');
    g.fillStyle='#b6af95';g.fillRect(0,0,192,144);g.fillStyle=ink;g.fillRect(0,10,192,25);
    g.font='bold 24px sans-serif';g.fillText(title,10,69,175);g.fillRect(11,80,169,2);
    for(let i=0;i<5;i++)g.fillRect(11,91+i*7,70+random()*88,2);
    for(let j=0;j<850;j++){g.fillStyle='rgba(81,70,50,.22)';g.fillRect(random()*192,random()*144,2,1+random()*3);}
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
    return new T.MeshStandardMaterial({map,roughness:.9});
  }
  const labels=[jugLabel('FLOOR WAX','#51473d'),jugLabel('DEGREASER','#734632'),jugLabel('SOAP','#3f5048')];
  const bottles=[porcelain,pail,standard(0x515f50,.66,.03)];
  function rod(start,end,bottom,top,material){
    const a=new T.Vector3(...start),b=new T.Vector3(...end),d=b.clone().sub(a);
    const shape=new T.CylinderGeometry(top,bottom,d.length(),8);
    shape.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    a.lerp(b,.5);add(shape,material,a.x,a.y,a.z);
  }
  // A corn broom with a compressed shoulder, stitched binding and loose tips.
  box(6.37,1.6,-9.51,.085,.105,1.55,wood);
  for(const z of [-10.06,-9.45,-8.91]) {
    box(6.29,1.61,z,.108,.055,.057,steel);
    pipe(6.24,1.64,z,.023,.09,steel);
  }
  const bx=6.20,bz=-9.98;
  rod([bx,.72,bz],[6.29,2.13,bz+.07],.016,.021,wood);
  for(let j=0;j<172;j++){
    const across=random()*2-1,depth=random()-.5;
    const top=[bx+depth*.056,.76+random()*.025,bz+across*.043];
    const shoulder=[bx+depth*.079,.57,bz+across*.108];
    rod(top,shoulder,.006,.007,straw[j%4]);
    rod(shoulder,[bx-.023+depth*.10,.265+random()*.045,bz+across*.167],.0065,.004,straw[j%4]);
  }
  for(const y of [.575,.605,.643]){
    const ring=new T.TorusGeometry(.095,.005,5,30);ring.rotateX(Math.PI/2);ring.scale(.43,1,1.14);
    add(ring,dark,bx,y,bz);
  }
  // Cotton yarn hangs in uneven loops below an oxidized clamp.
  const mx=6.15,mz=-9.43;
  rod([mx,.39,mz],[6.27,2.04,mz+.08],.019,.016,wood);
  box(mx,.40,mz,.084,.078,.20,steel);
  for(let j=0;j<47;j++){
    const dz=(random()-.5)*.19,dx=(random()-.5)*.075,length=.18+.14*random();
    cable([[mx+dx,.38,mz+dz],[mx+dx-.035,.29,mz+dz*1.24],
      [mx+dx-.04-random()*.03,.38-length,mz+dz*1.59],
      [mx+dx+.012,.29,mz+dz*1.32],[mx+dx+.01,.375,mz+dz+.012]],.007,cotton[j%3]);
  }
  // Open bucket: inner wall, rolled lip, dirty water and a wire bail.
  const px=5.73,pz=-9.13;
  const profile=[[.01,.045],[.139,.045],[.198,.386],[.201,.398],[.188,.402],[.18,.378],[.128,.066],[.01,.066]];
  add(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),40),pail,px,0,pz);
  pipe(px,.20,pz,.152,.004,standard(0x33382b,.18,.12));
  cable([[px,.34,pz-.19],[px-.09,.51,pz-.12],[px-.13,.55,pz],[px-.09,.51,pz+.12],[px,.34,pz+.19]],.007,steel);
  box(px-.13,.55,pz,.028,.025,.092,dark);
  obstacles.push([px-.37,px+.37,pz-.37,pz+.37],[5.94,6.7,-10.29,-9.12]);
  // Slop sink with a recessed basin, corroded tap and exposed waste trap.
  const sz=-10.88;
  box(6.08,.48,sz,.58,.12,.83,porcelain);
  for(const dz of [-.39,.39])box(6.08,.63,sz+dz,.59,.27,.065,porcelain);
  for(const x of [5.80,6.35])box(x,.63,sz,.062,.27,.82,porcelain);
  pipe(6.08,.55,sz,.046,.006,dark);
  cable([[6.08,.42,sz],[6.08,.23,sz],[6.18,.18,sz],[6.30,.29,sz],[6.42,.29,sz]],.037,iron);
  cable([[6.41,1.03,sz],[6.24,1.03,sz],[6.19,.96,sz]],.024,steel);
  for(const dz of [-.17,.17]){
    pipe(6.37,1.03,sz+dz,.047,.11,iron,0,Math.PI/2);
    add(new T.TorusGeometry(.045,.008,6,16),steel,6.30,1.03,sz+dz,0,Math.PI/2);
  }
  obstacles.push([5.52,6.7,-11.54,-10.25]);
  // Shelves on angle brackets, with cloudy detergent bottles and paper rolls.
  for(const y of [.69,1.29,1.9]){
    box(6.13,y,-7.75,.58,.045,1.27,wood);
    for(const z of [-8.22,-7.29])rod([6.36,y-.23,z],[5.91,y-.03,z],.012,.012,iron);
    for(let j=0;j<4;j++){
      const z=-8.20+j*.27,x=6.08+random()*.12;
      if(y===1.9){pipe(x,y+.165,z,.091,.28,cotton[j%3]);pipe(x,y+.308,z,.029,.006,dark);continue;}
      if(j===1 && y===1.29)continue;
      const kind=(j+(y>1?1:0))%3,bottle=bottles[kind];
      const base=y+.023,h=.17+random()*.07;
      add(new T.LatheGeometry([[.045,0],[.070,.014],[.076,.04],[.075,h-.025],[.071,h],[.036,h+.045],[.029,h+.055]].map(([r,y])=>new T.Vector2(r,y)),20),bottle,x,base,z);
      pipe(x,base+h+.073,z,.034,.043,dark);
      const label=new T.CylinderGeometry(.0765,.0765,h*.58,12,1,true,-2.32,1.5);
      add(label,labels[kind],x,base+h*.53,z);
    }
  }
  obstacles.push([5.60,6.70,-8.64,-6.88]);
}
