import * as T from 'three';
import {box, group, mat, mesh} from './geometry.js';
import vinylFile from './shop-vinyl.webp';
import vinylResponse from './shop-vinyl-response.webp';
import wallFile from './shop-painted-wall.webp';
import paintResponse from './shop-paint-response.webp';
import brushFile from './shop-brushed-metal.webp';

// Low-frequency diffuse fill from the fluorescent bays and the warm till lamp.
// Separate from albedo so small-scale relief still responds to the moving view.
function roomBounce(){
  const w=64,h=48,data=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=(i+.5)/w*10-5,z=(j+.5)/h*7.5-.05;
    const falloff=(cx,cz,r)=>1/(1+((cx-x)**2+(cz-z)**2)/(r*r));
    const tubes=.44*falloff(2.28,2.05,1.55)+.42*falloff(.95,5.6,1.62);
    const counter=.52*falloff(-1.98,3.48,1.02);
    const base=.16+tubes;
    const rgb=[base+counter,base*.99+counter*.67,base*.86+counter*.39];
    data.set([...rgb.map(v=>Math.round(255*Math.min(1,v))),255],4*(j*w+i));
  }
  const map=new T.DataTexture(data,w,h);
  map.channel=1;map.minFilter=map.magFilter=T.LinearFilter;map.needsUpdate=true;
  return map;
}

// The shell was batched into station coordinates. Add a second UV set only to
// receivers of the room's indirect light; their primary UVs stay in material space.
export function roomLightUVs(shell){
  for(const mesh of shell.children){
    if(mesh.material?.lightMap?.channel!==1)continue;
    const p=mesh.geometry.attributes.position,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
      uv[i*2]=(p.getX(i)+5)/10;uv[i*2+1]=(p.getZ(i)+.05)/7.5;
    }
    mesh.geometry.setAttribute('uv1',new T.BufferAttribute(uv,2));
  }
}

// Contact under the till plinth, tins, cup and folded maps on the Formica.
export function countertopOcclusion(){
  const w=256,h=112,data=new Uint8Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x=((i+.5)/w-.5)*2.76,z=(.5-(j+.5)/h)*1.20;
    function under(cx,cz,width,depth,angle,spread){
      const dx=x-cx,dz=z-cz,c=Math.cos(angle),s=Math.sin(angle);
      const edge=Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-width/2),
        Math.max(0,Math.abs(s*dx+c*dz)-depth/2));
      return Math.exp(-edge/spread);
    }
    let block=.80*under(.46,.20,.52,.45,.19,.055);
    block=Math.max(block,.52*under(.99,.28,.16,.235,-.14,.020),
      .68*Math.exp(-Math.max(0,Math.hypot(x+.08,z-.25)-.035)/.026));
    for(let n=0;n<4;n++){
      const edge=Math.hypot(x+.86-.132*n,z+.24)-.059;
      block=Math.max(block,.60*Math.exp(-Math.max(0,edge)/.028));
    }
    data[j*w+i]=Math.round(255*(1-block));
  }
  const map=new T.DataTexture(data,w,h,T.RedFormat);
  map.minFilter=map.magFilter=T.LinearFilter;map.needsUpdate=true;
  return map;
}

export function roomSurfaces(shell,loader){
  function texture(file,color=false){
    const map=loader.load(file);map.anisotropy=8;
    if(color)map.colorSpace=T.SRGBColorSpace;
    return map;
  }
  const bounce=roomBounce(),wax=texture(vinylResponse);
  const vinyl=mat(0xffffff,{map:texture(vinylFile,true),aoMap:wax,roughnessMap:wax,
    roughness:1,lightMap:bounce,lightMapIntensity:.8});
  const floor=mesh(shell,new T.PlaneGeometry(10,7.5),vinyl,0,.081,3.70);
  floor.rotation.x=-Math.PI/2;

  const paint=texture(wallFile,true),relief=texture(paintResponse);
  for(const map of [paint,relief])map.wrapS=map.wrapT=T.MirroredRepeatWrapping;
  const plaster=mat(0xf7efd9,{map:paint,bumpMap:relief,bumpScale:.00055,roughness:1,
    roughnessMap:relief,lightMap:bounce,lightMapIntensity:1.35});
  const dado=plaster.clone();dado.color.setHex(0x768879);dado.roughness=.69;
  const skirting=mat(0x373a33,{roughness:.82});
  const molding=mat(0x989681,{roughness:.55});
  function lining(x,z,angle,length){
    const wall=group(shell,x,0,z);wall.rotation.y=angle;
    function coat(cx,y,span,height,depth,material){
      const g=new T.PlaneGeometry(span,height),uv=g.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*span/.83,uv.getY(i)*height/.83);
      mesh(wall,g,material,cx,y,depth);
    }
    coat(0,1.955,length,1.99,0,plaster);
    coat(0,.526,length,.875,.002,dado);
    box(wall,0,.968,.009,length,.025,.017,molding);
    box(wall,0,.138,.011,length,.117,.020,skirting);
    box(wall,0,.09,.020,length,.014,.036,skirting);
  }
  lining(-4.908,3.69,Math.PI/2,7.29);
  lining(4.908,3.69,-Math.PI/2,7.29);
  lining(0,7.32,Math.PI,9.82);
  for(const s of [-1,1]){
    const x=s*3.04;
    box(shell,x,.437,.097,3.88,.707,.028,dado);
    box(shell,x,.142,.113,3.88,.119,.019,skirting);
    box(shell,x,.819,.084,3.91,.038,.145,molding);
  }
  const brush=texture(brushFile);
  return {bounce,brush,vinyl,relief};
}
