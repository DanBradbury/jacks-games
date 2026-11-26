import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box,cylinder,group,link,mat,mesh,oval,panel,rubber,seed,tube} from './geometry.js';

function instrument(parent,x,label,limit,increment,units,rim){
  const radius=.065,canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#191b1a';ctx.fillRect(0,0,256,256);
  ctx.translate(128,128);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 18px sans-serif';
  for(let i=0;i<=limit*4/increment;i++){
    const major=i%4===0,angle=-2.28+4.56*i/(limit*4/increment);
    const dx=Math.sin(angle),dy=-Math.cos(angle);
    ctx.strokeStyle=label==='RPM'&&i*increment/4>=6?'#a95743':'#c2c1a6';ctx.lineWidth=major?3:1.5;
    ctx.beginPath();ctx.moveTo(dx*(major?85:92),dy*(major?85:92));ctx.lineTo(dx*101,dy*101);ctx.stroke();
    if(major){ctx.fillStyle='#c2c1ab';ctx.fillText(String(i*increment/4),dx*70,dy*70)}
  }
  ctx.fillStyle='#b5b5a4';ctx.font='13px sans-serif';ctx.fillText(label,0,35);
  if(units){ctx.font='9px sans-serif';ctx.fillText(units,0,51)}
  ctx.rotate(-2.28);ctx.fillStyle='#d4784f';ctx.beginPath();
  ctx.moveTo(-3,15);ctx.lineTo(-1,-88);ctx.lineTo(2,-88);ctx.lineTo(4,15);ctx.fill();
  ctx.fillStyle='#3c403d';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const dial=mesh(parent,new T.CircleGeometry(radius,48),mat(0xe3dfcb,{map,roughness:.68}),x,.903,.169);
  dial.rotation.y=Math.PI;
  mesh(parent,new T.TorusGeometry(radius+.003,.0038,8,56),rim,x,.903,.167);
}

function auxiliaryGauge(parent,x,y,label,reading,edge){
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d');ctx.translate(64,64);ctx.fillStyle='#141514';ctx.fillRect(-64,-64,128,128);
  ctx.strokeStyle='#e4e0cd';ctx.fillStyle='#e4e0cd';ctx.lineWidth=3;
  for(let i=0;i<=8;i++){
    const a=-2.15+i*.54,dx=Math.sin(a),dy=-Math.cos(a);
    ctx.beginPath();ctx.moveTo(dx*(i%2?44:39),dy*(i%2?44:39));ctx.lineTo(dx*49,dy*49);ctx.stroke();
  }
  ctx.textAlign='center';ctx.font='bold 14px sans-serif';ctx.fillText(label,0,29);
  ctx.rotate(reading);ctx.strokeStyle='#d57e52';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,-38);ctx.stroke();
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  mesh(parent,new T.CircleGeometry(.028,40),mat(0xffffff,{map,roughness:.52}),x,y,.155).rotation.y=Math.PI;
  mesh(parent,new T.TorusGeometry(.0295,.0018,8,40),edge,x,y,.154);
}
function hornButton(parent){
  const c=document.createElement('canvas');c.width=c.height=192;
  const ctx=c.getContext('2d');ctx.translate(96,96);
  const fill=ctx.createRadialGradient(-16,-25,1,0,0,98);fill.addColorStop(0,'#343532');fill.addColorStop(1,'#151514');
  ctx.fillStyle=fill;ctx.fillRect(-96,-96,192,192);
  for(const [s,col] of [[-1,'#923c31'],[1,'#e1dfd3']]){
    ctx.save();ctx.rotate(s*.58);
    ctx.strokeStyle='#c7c1a9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,48);ctx.lineTo(0,-47);ctx.stroke();
    for(let j=0;j<3;j++)for(let i=0;i<5;i++){
      ctx.fillStyle=s===1&&(i+j)%2?'#252624':col;
      ctx.fillRect(s*(i+(s<0?1:0))*7,-47+j*8,7.2,8.2);
    }
    ctx.restore();
  }
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  mesh(parent,new T.CircleGeometry(.034,40),mat(0xffffff,{map,roughness:.49}),0,0,-.038).rotation.y=Math.PI;
}

export function driverDash(car,driverX){
  const edge=mat(0x827d71,{metalness:.63,roughness:.49,side:T.DoubleSide});
  const grain=new Uint8Array(128*128),rng=seed(5921);
  for(let i=0;i<grain.length;i++)grain[i]=90+Math.floor(rng()*130);
  const surface=new T.DataTexture(grain,128,128,T.RedFormat);
  surface.generateMipmaps=true;surface.minFilter=T.LinearMipmapLinearFilter;surface.needsUpdate=true;
  const vinyl=mat(0x332f2e,{side:T.DoubleSide,roughness:.80,bumpMap:surface,bumpScale:.00042});
  const padded=(x,y,z,w,h,d,r,m=vinyl)=>mesh(car,new RoundedBoxGeometry(w,h,d,3,r),m,x,y,z);
  padded(0,.789,.384,1.39,.178,.345,.041);
  padded(driverX,.886,.243,.359,.181,.137,.035);
  // The twin instruments sit under a brow just above their upper rims.
  const brow=[];
  for(let i=0;i<=24;i++){
    const u=i/12-1;brow.push([driverX+.186*u,.934+.046*(1-u*u),.175+.023*u*u]);
  }
  tube(car,brow,.008,vinyl);
  instrument(car,driverX+.083,'MPH',160,20,'',edge);
  instrument(car,driverX-.083,'RPM',8,1,'x 1000',edge);
  padded(-.398,.776,.218,.463,.109,.016,.007);
  box(car,-.398,.809,.207,.066,.010,.008,edge);
  for(const x of [-.51,-.25,.22,.52])for(let j=0;j<3;j++)
    box(car,x,.878,.397+j*.013,.159,.004,.007,rubber);
  const stack=group(car,.015,0,0);
  mesh(stack,new RoundedBoxGeometry(.227,.280,.048,5,.012),vinyl,0,.736,.183);
  for(const x of [-.050,.050]){
    box(stack,x,.851,.156,.094,.039,.008,edge);
    box(stack,x,.851,.149,.088,.032,.007,rubber);
    for(const y of [.846,.858])box(stack,x,y,.144,.082,.003,.008,edge);
  }
  for(const gauge of [[-.068,.794,'FUEL',-.50],[0,.794,'TEMP',-1.9],[.068,.794,'OIL',-2.05],
    [-.041,.733,'BATT',-.04],[.041,.733,'CLOCK',1.16]])auxiliaryGauge(stack,...gauge,edge);
  box(stack,0,.668,.153,.134,.033,.008,edge);
  box(stack,0,.668,.147,.120,.020,.007,rubber);
  for(const x of [-.083,.083])oval(stack,x,.668,.147,.013,.013,.012,edge);
  for(let i=0;i<5;i++)box(stack,-.050+i*.025,.632,.152,.019,.009,.012,rubber);
  tube(car,[[-.62,.734,.199],[-.55,.704,.177],[-.35,.696,.172],[-.227,.718,.190]],.010,vinyl);

  link(car,[driverX,.817,.217],[driverX,.913,.054],.036,.027,vinyl);
  const hub=group(car,driverX,.913,.046);hub.rotation.x=.34;
  mesh(hub,new T.TorusGeometry(.178,.014,16,88),vinyl);
  for(const angle of [-1.39,1.39,Math.PI]){
    const spoke=group(hub);spoke.rotation.z=angle;
    panel(spoke,[[-.028,0,-.002],[-.014,.174,0],[.014,.174,0],[.028,0,-.002]],vinyl);

  }
  const horn=cylinder(hub,0,0,-.016,.046,.050,.041,vinyl);horn.rotation.x=Math.PI/2;
  mesh(hub,new T.TorusGeometry(.035,.0017,8,48),edge,0,0,-.037);
  hornButton(hub);
  link(car,[driverX+.026,.883,.106],[driverX+.188,.908,.107],.004,.003,edge);
  oval(car,driverX+.186,.908,.107,.018,.007,.007,rubber);
}
