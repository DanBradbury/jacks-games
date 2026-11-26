import * as T from 'three';
import {group,mesh,mat,box,cylinder,tube,rubber,seed} from './geometry.js';

const smooth=T.MathUtils.smoothstep;

// Stitched covers over shaped foam. Each row wraps from the insert across
// both bolsters and around the back of the cushion.
function upholstery(seat,kind,vinyl,insertCover,piping){
  const back=kind==='back',rings=76,sides=104,points=[],indices=[],insertIndices=[],uv=[];
  const insertSide=Math.round(.55*sides/(2*Math.PI));
  const insertStart=Math.round(.06*rings),insertEnd=Math.round((back?.73:.88)*rings);
  const sample=(v,angle)=>{
    const sin=Math.sin(angle),cos=Math.cos(angle);
    const u=Math.sign(sin)*Math.pow(Math.abs(sin),.79),a=Math.abs(u);
    const end=Math.min(v,1-v);
    const bevel=Math.sqrt(Math.max(0,1-(1-Math.min(1,end/.043))**2));
    const width=back?.222+.017*Math.sin(Math.PI*v)-.069*smooth(v,.59,.91):
      .204+.034*Math.sin(Math.PI*.85*v);
    const x=u*(width-.013*(1-bevel));
    const bolster=Math.exp(-(((a-.78)/.18)**2));
    const active=back?smooth(v,.012,.20)*(1-smooth(v,.59,.85)):
      smooth(v,.0,.19)*(1-smooth(v,.70,.99));
    const insert=(1-smooth(a,.49,.64))*smooth(v,.04,.15)*(1-smooth(v,back?.63:.74,back?.73:.89));
    const channel=(.5+.5*Math.cos(u*Math.PI*9))**4;
    const headPad=back?.012*smooth(v,.72,.80)*(1-smooth(v,.94,1)):0;
    const padding=(back?.038:.033)+.009*bevel+bolster*active*(back?.061:.045)+(.009-.013*channel)*insert+headPad;
    const depth=cos>0?padding:back?.039:.041;
    const section=Math.sign(cos)*Math.pow(Math.abs(cos),.62)*depth*(.66+.34*bevel);
    if(back)return [x,.601+v*.562,-.365-.165*v+.022*Math.sin(v*Math.PI*2)+section];
    return [x,.598+.015*v-.012*Math.sin(v*Math.PI)+section,-.407+.501*v];
  };
  for(let i=0;i<=rings;i++){
    for(let j=0;j<sides;j++){
      const v=i/rings,a=j/sides*Math.PI*2,p=sample(v,a);
      points.push(...p);uv.push(p[0]*6,(back?p[1]:p[2])*6);
      if(!i)continue;
      const k=i*sides+j,n=i*sides+(j+1)%sides;
      const inInsert=(j<insertSide||j>=sides-insertSide)&&i>insertStart&&i<=insertEnd;
      const face=inInsert?insertIndices:indices;
      if(back)face.push(k-sides,n-sides,k,n-sides,n,k);
      else face.push(k-sides,k,n-sides,n-sides,k,n);
    }
  }
  for(const row of [0,rings]){
    const start=row*sides;
    for(let j=1;j<sides-1;j++){
      const forward=back?row===0:row===rings;
      if(forward)indices.push(start,start+j+1,start+j);
      else indices.push(start,start+j,start+j+1);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices.concat(insertIndices));geometry.computeVertexNormals();
  const insertGeometry=geometry.clone();
  geometry.setIndex(indices);insertGeometry.setIndex(insertIndices);
  for(let j=0;j<sides;j++){
    const sx=Math.sin(j/sides*2*Math.PI);
    const u=4.5*Math.sign(sx)*Math.pow(Math.abs(sx),.79);
    for(let i=0;i<=rings;i++)insertGeometry.attributes.uv.setXY(i*sides+j,u,i/rings*(back?11:10));
  }
  mesh(seat,geometry,vinyl);mesh(seat,insertGeometry,insertCover);
  for(const sign of [-1,1]){
    const outer=Array.from({length:27},(_,i)=>sample(.025+.95*i/26,sign*1.27));
    const angle=sign*insertSide/sides*2*Math.PI;
    const inner=Array.from({length:insertEnd-insertStart+1},(_,i)=>sample((insertStart+i)/rings,angle));
    tube(seat,outer,.0026,piping);tube(seat,inner,.0015,piping);
  }
  for(const ring of [insertStart,insertEnd]){
    const seam=Array.from({length:2*insertSide+1},(_,i)=>sample(ring/rings,(i-insertSide)/sides*2*Math.PI));
    tube(seat,seam,.0015,piping);
  }
}

export function bucketSeats(car){
  const size=128,grain=new Uint8Array(size*size),rng=seed(451);
  for(let i=0;i<grain.length;i++)grain[i]=80+Math.floor(rng()*145);
  const texture=new T.DataTexture(grain,size,size,T.RedFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.needsUpdate=true;
  const vinyl=mat(0x60433b,{roughness:.60,bumpMap:texture,bumpScale:.00034});
  // One repeat spans a pleat. Its compressed seam, thread and pinholes keep
  // the insert legible in the soft light entering through the side glass.
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const seam=Math.min(x,size-x),thread=Math.abs(seam-4)<1&&y%11<7;
    const hole=Math.hypot(x%16-8,(y+(Math.floor(x/16)%2)*8)%16-8);
    const shade=237+8*Math.sin(Math.PI*x/size)-37*Math.exp(-seam*seam/16)
      +(thread?17:0)-24*Math.max(0,1-hole/2)+rng()*5;
    const i=4*(y*size+x);
    pixels[i]=pixels[i+1]=pixels[i+2]=shade;pixels[i+3]=255;
  }
  const facing=new T.DataTexture(pixels,size,size);
  facing.colorSpace=T.SRGBColorSpace;facing.wrapS=facing.wrapT=T.RepeatWrapping;
  facing.generateMipmaps=true;facing.minFilter=T.LinearMipmapLinearFilter;facing.magFilter=T.LinearFilter;facing.needsUpdate=true;
  const insertCover=mat(0x72564a,{map:facing,roughness:.67,bumpMap:texture,bumpScale:.00022});
  const welting=mat(0x44332e,{roughness:.59}),bracket=mat(0x555450,{metalness:.5,roughness:.55});
  for(const s of [-1,1]){
    const seat=group(car,s*.330,0,-.145);
    for(const x of [-.146,.146])box(seat,x,.554,-.163,.038,.028,.414,bracket);
    box(seat,0,.577,-.16,.38,.054,.443,rubber);
    upholstery(seat,'base',vinyl,insertCover,welting);upholstery(seat,'back',vinyl,insertCover,welting);
    const pivot=cylinder(seat,s*.207,.635,-.34,.033,.033,.022,bracket,24);
    pivot.rotation.z=Math.PI/2;
    tube(seat,[[s*.208,.641,-.34],[s*.209,.662,-.30],[s*.213,.695,-.268]],.008,bracket);
    box(seat,-s*.228,.649,-.32,.033,.071,.052,rubber).rotation.x=-.24;
  }
}
