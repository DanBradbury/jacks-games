import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box,cylinder,group,mat,mesh,oval,tube} from './geometry.js';
import {weather} from './finish.js';
import {wetSign} from './service-bay.js';
import bladeFile from './sierra-porcelain.webp';
import reverseBladeFile from './sierra-porcelain-back.webp';
import priceFile from './sierra-price.webp';

// Outline of the rolled edge, in coordinates of the porcelain artwork.
const edge=[[0,99],[61,99],[104,20],[419,20],[461,64],[1197,64],[1279,106],
  [1260,366],[1191,419],[462,419],[422,476],[79,476],[0,390]];

export function roadsideSign(shell,loader,clock,footing){
  const sign=group(shell,-10.65,.02,-14.25);
  sign.rotation.y=.24;
  const steel=weather(mat(0x384944,{metalness:.28,roughness:.72}),.68);
  const lip=weather(mat(0x756b55,{metalness:.50,roughness:.54}),.55);
  function porcelain(file){
    const map=loader.load(file);
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    const m=mat(0xffffff,{map});
    wetSign(m,clock);return m;
  }
  box(sign,0,.085,0,.66,.17,.62,footing);
  box(sign,0,.187,0,.43,.034,.39,steel);
  for(const x of [-.16,.16])for(const z of [-.14,.14])cylinder(sign,x,.216,z,.024,.024,.036,lip,6);
  cylinder(sign,0,1.40,0,.092,.14,2.42,steel);
  const dial=group(sign,0,2.94,0);
  mesh(dial,new RoundedBoxGeometry(1.83,.70,.105,3,.035),steel);
  const price=porcelain(priceFile);
  for(const side of [-1,1]){
    mesh(dial,new T.PlaneGeometry(1.77,.656),price,0,0,side*.054).rotation.y=side<0?Math.PI:0;
  }
  for(const x of [-.57,.57])box(sign,x,3.35,0,.050,.25,.080,steel);

  const scale=.00265,blade=group(sign,0,3.94,0);
  const outline=new T.Shape(edge.map(([x,y])=>new T.Vector2((x-640)*scale,(244-y)*scale)));
  const depth=.136;
  const cabinet=new T.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSegments:2,bevelSize:.011,bevelThickness:.008});
  mesh(blade,cabinet,steel,0,0,-depth/2);
  const face=new T.ShapeGeometry(outline),pos=face.attributes.position,uv=face.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)/scale+640)/1280,(pos.getY(i)/scale+244)/488);
  const lampOffsets=[-.91,.73];
  const bulb=mat(0xc4b898,{emissive:0xffdfaa,emissiveIntensity:1.5});
  for(const x of lampOffsets)for(const side of [-1,1]){
    tube(blade,[[x,.42,0],[x,.70,.09*side],[x,.75,.32*side],[x,.68,.48*side]],.017,steel);
    const head=group(blade,x,.65,.48*side);head.rotation.x=side*.55;
    cylinder(head,0,0,0,.055,.13,.10,steel);
    oval(head,0,-.052,0,.109,.015,.109,bulb);
  }
  // Bake diffuse light from the two fixed hooded lamps onto each sign
  // face. Rain still changes the enamel highlights as the camera passes.
  const w=96,h=36,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const px=((x+.5)/w-.5)*1280*scale,py=((y+.5)/h-.5)*488*scale;
    let lux=0;
    for(const offset of lampOffsets){
      const dx=px-offset,dy=.60-py,dz=.40,r2=dx*dx+dy*dy+dz*dz;
      const cosBeam=(.84*dy+.54*dz)/Math.sqrt(r2);
      lux+=.17*dz/Math.pow(r2,1.5)*T.MathUtils.smoothstep(cosBeam,.30,.90);
    }
    const i=(y*w+x)*4;
    data[i]=Math.min(255,lux*255);data[i+1]=Math.min(255,lux*208);
    data[i+2]=Math.min(255,lux*148);data[i+3]=255;
  }
  const wash=new T.DataTexture(data,w,h);
  wash.magFilter=wash.minFilter=T.LinearFilter;wash.needsUpdate=true;
  const facePaint=porcelain(bladeFile),rearPaint=porcelain(reverseBladeFile);
  facePaint.lightMap=rearPaint.lightMap=wash;
  facePaint.lightMapIntensity=rearPaint.lightMapIntensity=1.65;
  mesh(blade,face,facePaint,0,0,depth/2+.009);
  // Both faces follow the same asymmetric steel stamping. Rear lettering
  // is reversed on the print so it reads correctly from the highway.
  const rear=face.clone();
  const index=rear.index;
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i);index.setX(i,index.getX(i+1));index.setX(i+1,a);
  }
  rear.computeVertexNormals();
  mesh(blade,rear,rearPaint,0,0,-depth/2-.009);
}
