import * as T from 'three';
import {group,mat,seed,smooth} from './geometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import leftModel from './left.glb?url';
import rightModel from './right.glb?url';
import skinMap from './hand-albedo.webp';

function twill(){
  const size=128,data=new Uint8Array(size*size*4),rng=seed(91345);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const ridge=(x+2*Math.floor(y/2))%8;
    const thread=(ridge<4?1:.78)*(.89+.19*rng());
    const i=(y*size+x)*4;
    data.set([63*thread,67*thread,57*thread,255],i);
  }
  const map=new T.DataTexture(data,size,size);
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.repeat.set(4,9);map.generateMipmaps=true;map.minFilter=T.LinearMipMapLinearFilter;map.magFilter=T.LinearFilter;
  map.needsUpdate=true;return map;
}

function jacketSleeve(hand,s,cloth){
  const profile=[[.028,-.004],[.043,0],[.045,.004],[.044,.009],[.044,.029],[.046,.033],
    [.052,.039],[.056,.052],[.055,.065],[.053,.076],[.064,.095],[.059,.118],[.064,.157],
    [.074,.193],[.065,.214],[.070,.23],[.081,.27],[.091,.42],[.099,.59]];
  const g=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),36);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),h=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x);
    const fold=smooth(.028,.10,h)*(.055*Math.sin(a*5+h*21)+.078*Math.cos(a*3-h*32));
    const bend=smooth(.01,.17,h);
    p.setXYZ(i,x*(1.02+fold)+s*h*.35, -.045-h*(1-.28*bend)+fold*.045,
      .001+z*(.73+fold)+h*.70*bend);
  }
  // Mapping vertical sleeve coordinates downward reverses the winding.
  const index=g.index.array;
  for(let i=0;i<index.length;i+=3)[index[i],index[i+1]]=[index[i+1],index[i]];
  g.computeVertexNormals();hand.add(new T.Mesh(g,cloth));
}

export async function hands(scene,doors){
  const [left,right,map]=await Promise.all([
    new GLTFLoader().loadAsync(leftModel),new GLTFLoader().loadAsync(rightModel),
    new T.TextureLoader().loadAsync(skinMap)
  ]);
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const skin=new T.MeshPhysicalMaterial({map,roughness:.55,ior:1.4,specularIntensity:.48});
  const cloth=mat(0xffffff,{map:twill(),roughness:.96});
  const arms=[left,right].map((model,i)=>{
    const s=i===0?-1:1,hand=group(scene);
    let surface;model.scene.traverse(o=>{if(o.isSkinnedMesh)surface=o});
    const g=surface.geometry,p=g.attributes.position,uv=g.attributes.uv;
    const relaxed=p.clone();
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
      // The hand scan was registered to an orthographic view of the bind pose.
      uv.setXY(j,.5-(z-i*.00104)/.24,.39-(y+i*.00021)/.24);
      // Open the opposable thumb alongside the bar before bearing weight.
      const across=x+s*.052*smooth(.019,.070,-z);
      p.setX(j,across);
      const finger=smooth(.024,.124,-y);
      relaxed.setXYZ(j,across-s*.028*finger*finger,y+.013*finger*finger,z);
    }
    g.computeVertexNormals();
    g.morphAttributes.position=[relaxed];
    const palm=new T.Mesh(g,skin);
    const axes=new T.Matrix4().makeBasis(new T.Vector3(0,0,s),new T.Vector3(0,-1,0),new T.Vector3(s,0,0));
    palm.quaternion.setFromRotationMatrix(axes);
    palm.position.set(-s*.009,.008,-.039);hand.add(palm);
    jacketSleeve(hand,s,cloth);
    hand.visible=false;return {hand,palm,door:doors[i],s};
  });
  const target=new T.Vector3(),rest=new T.Vector3();
  return (t,camera)=>{
    for(const {hand,palm,door,s} of arms){
      const delay=s<0?.07:0;
      const grip=smooth(4.5+delay,6.05+delay,t)*(1-smooth(8.07+delay,9.45+delay,t));
      hand.visible=grip>.001;if(!hand.visible)continue;
      door.localToWorld(target.set(-s*(s<0?.66:.69),1.059+delay*.13,.196));
      camera.localToWorld(rest.set(s*.28,-.64,-.25));
      hand.position.copy(rest).lerp(target,grip);
      hand.rotation.order='YXZ';
      hand.rotation.set(-.13-.28*(1-grip),door.rotation.y+s*(.12+.18*(1-grip)),-s*(s<0?.12:.065));
      palm.morphTargetInfluences[0]=1-.86*grip;
    }
  };
}
