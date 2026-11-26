import * as T from 'three';
import {group,mesh,mat,rubber,box,paint,seed} from './geometry.js';

const smooth=T.MathUtils.smoothstep;
const stations=[[-2.32,.826,.747],[-2.20,.888,.812],[-1.74,.929,.879],[-1.35,.955,.91],
  [-.82,.859,.827],[-.24,.807,.775],[.50,.835,.782],[1.28,.934,.827],[1.67,.897,.717],
  [1.99,.871,.668],[2.16,.83,.606],[2.26,.77,.565]];
const curve=new T.CatmullRomCurve3(stations.map(([z,w,h])=>new T.Vector3(z,w,h)),false,'centripetal');
const axleDistance=z=>Math.min(Math.abs(z+1.39),Math.abs(z-1.34));
const lampCenters=[.417,.66],lampY=.571;
const axleLip=.402;

function deckY(u,z,h){
  const a=Math.abs(u),axle=axleDistance(z);
  const crown=.123*Math.exp(-((axle/.55)**2)-(((a-.84)/.177)**2));
  const turn=T.MathUtils.clamp((a-.82)/.18,0,1);
  const shoulder=.094*(1-Math.sqrt(1-turn*turn));
  const cabin=smooth(z,-1.09,-.91)*(1-smooth(z,.48,.65));
  const belt=.072*cabin*smooth(a,.68,.91);
  return T.MathUtils.lerp(h+.055*(1-smooth(a,.04,.64))+crown+belt-shoulder,.515,cabin*(1-smooth(a,.67,.93)));
}
function sillY(z){
  const axle=axleDistance(z);
  return .237+.111*(1-smooth(axle,.393,.424))+Math.sqrt(Math.max(0,axleLip**2-axle**2));
}
function sideWidth(t,z,w){
  const tuck=.073*(1-smooth(t,0.,.34)),waist=.016*Math.sin(t*Math.PI)**2;
  return w*(1-tuck-waist)+.007*Math.exp(-((axleDistance(z)/.48)**4))*(1-t);
}
function tailDepth(x,y){
  const u=Math.abs(x)/.826;
  return -2.396+.132*u**3.8+.058*(1-smooth(y,.237,.40))+.025*smooth(y,.64,.79);
}
function tailFace(x,y){
  const lamp=Math.min(...lampCenters.map(c=>Math.hypot(Math.abs(x)-c,y-lampY)));
  const plate=Math.max(Math.abs(x)-.177,Math.abs(y-.459)-.082);
  return tailDepth(x,y)+.042*(1-smooth(lamp,.092,.118))+.03*(1-smooth(plate,.0,.024));
}
export function noseDepth(x,y){
  const roll=.029*Math.sin(Math.PI*T.MathUtils.clamp((y-.22)/.39,0,1));
  return 2.26+.145*(1-(x/.77)**2)+roll;
}
function bodyZ(x,y,z,w){
  return z+(tailDepth(x,y)+2.32)*(1-smooth(z,-2.32,-1.99))+
    Math.max(0,(z-1.62)/.64)*(noseDepth(x*.77/w,y)-2.26);
}
function atZ(z){
  let lo=0,hi=1;
  for(let k=0;k<16;k++){
    const mid=(lo+hi)/2;
    if(curve.getPoint(mid).x<z)lo=mid;else hi=mid;
  }
  return curve.getPoint((lo+hi)*.5);
}

export function sidePoint(side,y,z,offset=0){
  const {y:w,z:h}=atZ(z),sill=sillY(z);
  const t=T.MathUtils.clamp((y-sill)/(deckY(1,z,h)-sill),0,1);
  return [side*(sideWidth(t,z,w)+offset),y,z];
}

export function deckPoint(x,z){
  let lo=0,hi=1;
  for(let k=0;k<16;k++){
    const mid=(lo+hi)/2,p=curve.getPoint(mid),y=deckY(x/p.y,p.x,p.z);
    if(bodyZ(x,y,p.x,p.y)<z)lo=mid;else hi=mid;
  }
  const p=curve.getPoint((lo+hi)*.5);
  return [x,deckY(x/p.y,p.x,p.z)+.0014,z];
}

export function lacquer(){
  const size=128,normal=new Uint8Array(size*size*4),rng=seed(592);
  const relief=Float32Array.from({length:size*size},()=>rng());
  const at=(x,y)=>relief[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    normal.set([128+42*(at(x+1,y)-at(x-1,y)),128+42*(at(x,y+1)-at(x,y-1)),253,255],i);
  }
  const grain=new T.DataTexture(normal,size,size);
  grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.generateMipmaps=true;
  grain.minFilter=T.LinearMipmapLinearFilter;grain.magFilter=T.LinearFilter;grain.needsUpdate=true;
  const finish=new T.MeshPhysicalMaterial({color:0x792922,metalness:.045,roughness:.51,
    clearcoat:.39,clearcoatRoughness:.30,clearcoatNormalMap:grain,clearcoatNormalScale:new T.Vector2(.18,.18),
    side:T.DoubleSide});
  finish.onBeforeCompile=shader=>{
    const coordinates='varying vec3 paintPoint,paintAcross,paintAlong;\n';
    shader.vertexShader=coordinates+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\npaintPoint=position;paintAcross=modelViewMatrix[0].xyz;paintAlong=modelViewMatrix[2].xyz;');
    shader.fragmentShader=coordinates+`
      float paintHash(vec2 p){
        vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
      }
      float filmAt(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(paintHash(i),paintHash(i+vec2(1,0)),f.x),mix(paintHash(i+vec2(0,1)),paintHash(i+1.),f.x),f.y);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      // Road film accumulates below the doors and fans back from each tire.
      vec2 yz=paintPoint.zy;float trail=0.;
      for(int i=0;i<2;i++){
        float behind=(i==0?1.34:-1.39)-yz.x;
        trail+=smoothstep(.12,.46,behind)*(1.-smoothstep(.50,1.25,behind))*
               (1.-smoothstep(.30,.41+.12*clamp(behind,0.,1.),yz.y));
      }
      float deposit=clamp(.53*(1.-smoothstep(.25,.44,yz.y))+.46*trail,0.,1.)*
                    (.25+.75*filmAt(yz*vec2(15.,34.)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.093,.076,.060),deposit*.36);`)
      .replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        // Residual beads on upward-facing paint distort only the reflected light.
        vec2 p=paintPoint.xz*83.,cell=floor(p);
        vec2 d=fract(p)-(.24+.52*vec2(paintHash(cell),paintHash(cell+8.3)));
        float radius=.085+.14*paintHash(cell+5.);
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        float bead=(1.-smoothstep(radius*.65,radius,length(d)))*(1.-smoothstep(.15,.65,footprint))*
                   smoothstep(.28,.68,inverseTransformDirection(normal,viewMatrix).y)*
                   smoothstep(.32,.67,filmAt(paintPoint.xz*4.1));
        clearcoatNormal=normalize(clearcoatNormal+(paintAcross*d.x+paintAlong*d.y)*bead*2.4);`);
  };
  return finish;
}

export function bodyShell(car,finish){
  const positions=[],uv=[],indices=[],across=80,sideSteps=12,row=across+1+2*sideSteps;
  function vertex(x,y,z){
    positions.push(x,y,z);
    uv.push(6.2*(x+.52*z),6.2*(y+.77*z));
  }
  function quad(a,b,c,d){indices.push(a,b,c,a,c,d)}
  for(let i=0;i<=148;i++){
    const {x:z,y:w,z:h}=curve.getPoint(i/148),sill=sillY(z);
    function side(s,t){
      const x=s*sideWidth(t,z,w),y=T.MathUtils.lerp(sill,deckY(1,z,h),t);
      vertex(x,y,bodyZ(x,y,z,w));
    }
    for(let j=0;j<sideSteps;j++)side(-1,j/sideSteps);
    for(let j=0;j<=across;j++){
      const u=2*j/across-1,y=deckY(u,z,h),x=w*u;
      vertex(x,y,bodyZ(x,y,z,w));
    }
    for(let j=sideSteps-1;j>=0;j--)side(1,j/sideSteps);
    if(i)for(let j=1;j<row;j++){
      const k=i*row+j;quad(k-row-1,k-1,k,k-row);
    }
  }
  // Close both ends on the perimeter of the deck and quarter panels. Sample
  // the recessed stampings between those edges without overlapping bodywork.
  function closeEnd(front){
    const [z,w,h]=front?stations.at(-1):stations[0],sill=sillY(z),levels=48;
    const first=front?148*row:0;
    let above=Array.from({length:across+1},(_,j)=>first+sideSteps+j);
    for(let k=1;k<=levels;k++){
      const t=1-k/levels,below=[];
      for(let j=0;j<=across;j++){
        if((j===0||j===across)&&k%(levels/sideSteps)===0){
          const n=Math.round(sideSteps*t);
          below.push(first+(j===0?n:row-1-n));
        }else{
          const u=j*2/across-1,x=u*sideWidth(t,z,w),y=T.MathUtils.lerp(sill,deckY(u,z,h),t);
          const grille=Math.max(Math.abs(Math.abs(x)-.44)-.249,Math.abs(y-.366)-.052);
          const depth=front?noseDepth(x,y)-.036*(1-smooth(grille,-.004,.016)):tailFace(x,y);
          below.push(positions.length/3);vertex(x,y,depth);
        }
        if(j){
          if(front)quad(below[j-1],below[j],above[j],above[j-1]);
          else quad(above[j-1],above[j],below[j],below[j-1]);
        }
      }
      above=below;
    }
  }
  closeEnd(false);closeEnd(true);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();mesh(car,g,finish);
}

// Molded acrylic lenses have a smooth outer dome over concentric optical
// rings and a field of small prisms. Filter the relief into mip levels so the
// reflector still reads as a dark red lens in the wider station shots.
function lensMaterial(clearCenter){
  const size=256,pixels=new Uint8Array(size*size*4),normals=new Uint8Array(pixels.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=Math.hypot(u,v);
    const radial=r*58,ring=Math.cos(radial)*.5+.5;
    const prismX=Math.sin((u+v)*75),prismY=Math.sin((v-u)*75);
    const facet=(prismX*prismY+1)/2;
    const clear=clearCenter*(1-smooth(r,.39,.43));
    const level=(.65+.19*ring+.16*facet)*(1-.20*smooth(r,.85,1));
    const i=(y*size+x)*4;
    pixels.set([(224-10*clear)*level,(23+178*clear)*level,(14+177*clear)*level,255],i);
    const slope=.26*Math.sin(radial);
    normals.set([128+100*(slope*u/Math.max(.01,r)+.18*prismX),
      128+100*(slope*v/Math.max(.01,r)+.18*prismY),245,255],i);
  }
  function map(data){
    const t=new T.DataTexture(data,size,size);
    t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;
    return t;
  }
  const albedo=map(pixels);albedo.colorSpace=T.SRGBColorSpace;
  return new T.MeshPhysicalMaterial({map:albedo,normalMap:map(normals),metalness:.075,roughness:.31,
    clearcoat:1,clearcoatRoughness:.15,ior:1.49});
}

export function rearHardware(car){
  const lenses=[lensMaterial(true),lensMaterial(false)];
  const bezel=mat(0x706963,{metalness:.8,roughness:.34});
  const shape=new T.LatheGeometry([[.0001,.019],[.029,.0185],[.059,.016],[.078,.010],[.085,.003],[.086,-.008]]
    .map(([r,h])=>new T.Vector2(r,h)).reverse(),72);
  const p=shape.attributes.position,uv=shape.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/.173,.5+p.getZ(i)/.173);
  for(const sign of [-1,1])for(const [j,c] of lampCenters.entries()){
    const x=sign*c,unit=group(car,x,lampY,tailDepth(x,lampY)+.014);
    unit.rotation.y=-Math.atan((tailDepth(x+.001,lampY)-tailDepth(x-.001,lampY))/.002);
    const ring=(r,th,z,material)=>mesh(unit,new T.TorusGeometry(r,th,10,72),material,0,0,z);
    ring(.095,.008,.001,rubber);ring(.087,.0035,-.004,bezel);
    const lens=mesh(unit,shape,lenses[j]);lens.rotation.x=-Math.PI/2;
    // The two countersunk fasteners sit on the edge of the optical field.
    for(const sx of [-.073,.073]){
      const screw=mesh(unit,new T.SphereGeometry(.0032,8,6),bezel,sx,0,-.011);
      screw.scale.z=.48;
    }
  }
  const plateZ=tailFace(0,.459);
  box(car,0,.459,plateZ-.004,.342,.159,.012,bezel);
  paint(car,0,.459,plateZ-.012,.322,.143,[['NEVADA',.18,.20],['7L4  892',.51,.61]],'#c4b58d','#292922',true);
  for(const x of [-.122,.122])for(const y of [.406,.511]){
    const screw=mesh(car,new T.SphereGeometry(.005,8,6),bezel,x,y,plateZ-.013);
    screw.scale.z=.4;
  }
  // Rolled exhaust outlets tuck up behind the lower valance.
  const pipe=new T.LatheGeometry([[.031,.016],[.031,0],[.035,-.003],[.038,0],[.038,.20]]
    .map(([r,h])=>new T.Vector2(r,h)),32);
  box(car,0,.239,-.03,1.27,.044,3.90,rubber);
  for(const s of [-1,1]){
    const outlet=group(car,s*.55,.211,-2.285);outlet.rotation.x=Math.PI/2;
    mesh(outlet,pipe,bezel);
    const bore=mesh(outlet,new T.CircleGeometry(.032,32),rubber,0,.018,0);
    bore.rotation.x=Math.PI/2;
  }
}
