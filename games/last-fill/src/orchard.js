import * as T from 'three';
import {seed} from './geometry.js';
import sprayMap from './elm-spray.webp';

const up=new T.Vector3(0,1,0);
const turn=Math.PI*(3-Math.sqrt(5));

export function roadCenterZ(x){
  return -18+Math.sign(x)*17*T.MathUtils.smoothstep(Math.abs(x),30,144);
}

export function groundHeight(x,z){
  const distance=T.MathUtils.smoothstep(Math.hypot(x,z),30,120);
  const shoulder=T.MathUtils.smoothstep(Math.abs(z-roadCenterZ(x)),4,25);
  const base=-.07+.067*T.MathUtils.smoothstep(roadCenterZ(x)-z,3,8);
  return base+distance*shoulder*(3.5+1.65*Math.sin(x*.083-z*.037)+1.42*Math.sin(x*.037+z*.084));
}

function geometry(positions,indices,colors,uv){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

// Build wood and foliage together so every spray grows from a visible limb.
function specimen(rng,distant){
  const wood=[],rings=[],bark=[],leaves=[],faces=[],color=[],uv=[];
  function limb(a,b,r0,r1){
    const axis=b.clone().sub(a).normalize();
    const tangent=new T.Vector3().crossVectors(axis,new T.Vector3(0,0,1)).normalize();
    const normal=new T.Vector3().crossVectors(axis,tangent);
    const start=wood.length/3,sides=distant?4:6;
    for(let k=0;k<sides;k++){
      const angle=k*2*Math.PI/sides;
      const radial=tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(normal,Math.sin(angle));
      const tone=.77+.23*rng();
      for(const [p,r] of [[a,r0],[b,r1]]){
        wood.push(...p.clone().addScaledVector(radial,r).toArray());bark.push(tone,tone,tone);
      }
      const i=start+k*2,j=start+((k+1)%sides)*2;
      rings.push(i,j,i+1,j,j+1,i+1);
    }
  }
  function spray(base,direction,size){
    const axis=direction.clone().normalize(),roll=rng()*Math.PI;
    const side=new T.Vector3().crossVectors(axis,up).normalize().applyAxisAngle(axis,roll);
    const end=base.clone().addScaledVector(axis,size);
    const i=leaves.length/3,tint=.70+.30*rng();
    for(const [p,sign] of [[base,-1],[base,1],[end,1],[end,-1]]){
      leaves.push(...p.clone().addScaledVector(side,sign*size*.51).toArray());
      color.push(tint,.85*tint+.1,.81*tint);
    }
    uv.push(0,0,1,0,1,1,0,1);faces.push(i,i+1,i+2,i,i+2,i+3);
  }
  function branch(base,azimuth,rise,length,radius,depth){
    const outward=new T.Vector3(Math.cos(azimuth),rise,Math.sin(azimuth)).normalize();
    const fork=base.clone().addScaledVector(outward,length*.58);
    const heading=azimuth+(rng()-.5)*.61;
    const tip=fork.clone().addScaledVector(new T.Vector3(Math.cos(heading),rise+.40,Math.sin(heading)).normalize(),length*.42);
    limb(base,fork,radius,radius*.74);limb(fork,tip,radius*.74,radius*.43);
    if(depth){
      branch(tip,heading+(rng()-.5)*.95,rise*.85+.08,length*(.65+rng()*.20),radius*.53,depth-1);
      branch(fork,heading+(.68+rng()*.72)*(rng()<.5?-1:1),.15+rng()*1.1,length*(.54+rng()*.20),radius*.45,depth-1);
    }else{
      for(let j=0;j<5;j++){
        const a=heading+(j-2)*.95+(rng()-.5)*.6;
        const direction=new T.Vector3(Math.cos(a),rng()*1.4-.27,Math.sin(a));
        spray(fork.clone().lerp(tip,j/4),direction,(.65+rng()*.68)*(distant?1.35:1));
      }
    }
  }
  let foot=new T.Vector3(),angle=rng()*Math.PI,trunkHeight=3.9+rng()*1.1;
  for(let i=0;i<10;i++){
    const t=(i+1)/10;
    const joint=foot.clone().add(new T.Vector3((rng()-.45)*.19,trunkHeight*.1,(rng()-.5)*.17));
    limb(foot,joint,.195*(1-i/10)**.73,.195*(1-t)**.73+.007);
    if(i>=2){
      angle+=turn+(rng()-.5)*.54;
      branch(joint,angle,.50+rng()*.69,1.12+1.25*Math.sin(t*Math.PI),.108*(1-t*.73),distant?2:3);
    }
    foot=joint;
  }
  return [geometry(wood,rings,bark),geometry(leaves,faces,color,uv)];
}

export function orchard(scene,loader,flash,source,filmTime){
  const map=loader.load(sprayMap);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const bark=new T.MeshStandardMaterial({color:0x665747,roughness:.84,vertexColors:true});
  const foliage=new T.MeshStandardMaterial({map,side:T.DoubleSide,vertexColors:true,roughness:.88,alphaTest:.23,alphaToCoverage:true});
  // Thin leaves transmit a little light toward the lens. Branches remain opaque.
  foliage.onBeforeCompile=shader=>{
    shader.uniforms.strikeFlash=flash;
    shader.uniforms.filmTime=filmTime;
    shader.uniforms.strikeSource={value:source};
    shader.vertexShader='varying vec3 leafPosition; uniform float filmTime;\n'+shader.vertexShader
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 root=instanceMatrix[3].xyz;
        float wind=sin(filmTime*2.1+root.x*.32+root.z*.16+position.y*.64);
        transformed.xz+=vec2(.044,.023)*wind*uv.y*uv.y;
      `).replace('#include <project_vertex>',
      '#include <project_vertex>\nleafPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 leafPosition; uniform float strikeFlash; uniform vec3 strikeSource;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 toFlash=strikeSource-leafPosition;
      float forward=max(0.,dot(normalize(toFlash),normalize(leafPosition-cameraPosition)));
      float transmission=strikeFlash*pow(forward,10.)/(1.+dot(toFlash,toFlash)*.00035);
      outgoingLight+=diffuseColor.rgb*vec3(.82,.97,1.12)*transmission*1.7;
      #include <opaque_fragment>`);
  };
  const rng=seed(44151),placements=Array.from({length:10},()=>[]);
  function plant(x,z,size){
    const o=new T.Object3D();
    o.position.set(x,groundHeight(x,z)-.055,z);o.rotation.set((rng()-.5)*.08,rng()*2*Math.PI,(rng()-.5)*.15);
    o.scale.set(size*(.85+rng()*.25),size,size*(.8+rng()*.28));o.updateMatrix();
    const variant=Math.floor(rng()*5);
    placements[Math.hypot(x,z)>70||size<.65?5+variant:variant].push(o.matrix);
  }
  for(let i=0;i<77;i++){
    const distance=rng();
    plant((rng()-.5)*(100+distance*72),-35-distance*76,.76+rng()*.82);
  }
  // Low thickets break the sightline to the far side of the pasture.
  for(let i=0;i<18;i++){
    const x=(rng()-.5)*130,z=-66-rng()*28;
    for(let j=0;j<3;j++)plant(x+(rng()-.5)*8,z+rng()*3,.23+rng()*.37);
  }
  // A mature tree sits between the lens and the lower lightning channel.
  plant(6.5,-40.5,1.58);
  // Shelterbelts follow the lanes and the back field around the station.
  for(let i=0;i<42;i++){
    const angle=i*turn,radius=42+rng()*70;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(z< -35||Math.abs(z-roadCenterZ(x))<11)continue;
    for(let j=0;j<3;j++)plant(x+(rng()-.5)*8,z+(rng()-.5)*8,.72+rng()*.75);
  }
  for(const [variant,matrices] of placements.entries()){
    const shapes=specimen(rng,variant>=5);
    // Cull contiguous groves together in the main, shadow and reflected views.
    const groves=new Map();
    for(const matrix of matrices){
      const x=Math.floor(matrix.elements[12]/36),z=Math.floor(matrix.elements[14]/36);
      const cell=x+','+z;
      if(!groves.has(cell))groves.set(cell,[]);
      groves.get(cell).push(matrix);
    }
    for(const grove of groves.values())for(const [i,material] of [bark,foliage].entries()){
      const trees=new T.InstancedMesh(shapes[i],material,grove.length);
      trees.castShadow=true;trees.receiveShadow=true;
      grove.forEach((m,j)=>trees.setMatrixAt(j,m));trees.computeBoundingSphere();scene.add(trees);
    }
  }
}
