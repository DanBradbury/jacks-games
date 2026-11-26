import * as T from 'three';
import {smooth} from './geometry.js';

// WebXR hand assets store the joints as siblings in bind space. Compose each
// finger chain explicitly, then skin its two poses once for seekable playback.
function fingerPose(source,s,closed){
  const g=source.geometry,p=g.attributes.position,joints=g.attributes.skinIndex,weights=g.attributes.skinWeight;
  const bones=source.skeleton.bones,rest=source.skeleton.boneInverses.map(m=>new T.Vector3().setFromMatrixPosition(m.clone().invert()));
  const transforms=bones.map(()=>new T.Matrix4());
  function chain(names,angles,axis){
    const transform=new T.Matrix4(),turn=new T.Matrix4();
    for(let i=0;i<names.length;i++){
      const j=bones.findIndex(b=>b.name===names[i]),pivot=rest[j];
      turn.makeRotationAxis(axis,angles[i]);
      turn.setPosition(pivot.clone().sub(pivot.clone().applyMatrix4(turn)));
      transform.multiply(turn);transforms[j].copy(transform);
    }
  }
  // MCP angles fitted to the four distal pads on the right-hand scan.
  // With these shallow PIP/DIP bends all pads bear on one metal surface.
  for(const [digit,bias,press] of [['index',.94,.1277],['middle',1,.1409],['ring',1.04,.0808],['pinky',1.12,.0442]]){
    const names=['proximal','intermediate','distal'].map(n=>digit+'-finger-phalanx-'+n);
    const bends=closed?(s===1?[press,.25,.12]:[.47*bias,1.35*bias,1.01]):[.07*bias,.14*bias,.08];
    chain([...names,digit+'-finger-tip'],[...bends.map(a=>-s*a),0],new T.Vector3(0,0,1));
  }
  chain(['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip'],
    s===1?[.24,.19,.10,0]:closed?[-.36,-.66,-.40,0]:[-.07,-.12,-.06,0],
    s===1?new T.Vector3(-.38,0,.92).normalize():new T.Vector3(1,0,0));
  const posed=p.clone(),sum=new T.Vector3(),v=new T.Vector3();
  for(let i=0;i<p.count;i++){
    sum.set(0,0,0);
    for(let k=0;k<4;k++){
      const w=weights.getComponent(i,k);if(!w)continue;
      v.fromBufferAttribute(p,i).applyMatrix4(transforms[joints.getComponent(i,k)]);sum.addScaledVector(v,w);
    }
    posed.setXYZ(i,sum.x,sum.y,sum.z);
  }
  return posed;
}

// Cloth follows the wrist, elbow and shoulder. Round the elbow between two
// straight bones and carry the cuff right to the wrist cut on the hand scan.
function sleeveBetween(parent,cloth){
  const sections=26,sides=20,n=(sections+1)*(sides+1),g=new T.BufferGeometry();
  const p=new T.Float32BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage);
  const normals=p.clone().setUsage(T.DynamicDrawUsage),uv=[],indices=[];
  for(let j=0;j<=sections;j++)for(let k=0;k<=sides;k++){
    uv.push(k/sides,j/sections);
    const i=j*(sides+1)+k;
    if(j&&k)indices.push(i-sides-2,i-sides-1,i,i-sides-2,i,i-1);
  }
  g.setAttribute('position',p);g.setAttribute('normal',normals);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const sleeve=new T.Mesh(g,cloth);sleeve.frustumCulled=false;parent.add(sleeve);
  const axis=new T.Vector3(),bend=new T.Vector3(),elbow=new T.Vector3(),center=new T.Vector3();
  const forward=new T.Vector3(),side=new T.Vector3(),up=new T.Vector3(),normal=new T.Vector3();
  const a=new T.Vector3(),b=new T.Vector3();
  return (wrist,shoulder,pole)=>{
    axis.subVectors(shoulder,wrist);
    const d=Math.max(.001,axis.length());axis.divideScalar(d);
    bend.copy(pole).addScaledVector(axis,-pole.dot(axis)).normalize();
    const lower=.278,upper=.318;
    const along=T.MathUtils.clamp((lower*lower-upper*upper+d*d)/(2*d),0,d);
    elbow.copy(wrist).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,lower*lower-along*along)));
    a.copy(elbow).lerp(wrist,.34);b.copy(elbow).lerp(shoulder,.34);
    for(let j=0;j<=sections;j++){
      const t=j/sections;
      if(t<=.33){center.lerpVectors(wrist,a,t/.33);forward.subVectors(a,wrist)}
      else if(t>=.67){center.lerpVectors(b,shoulder,(t-.67)/.33);forward.subVectors(shoulder,b)}
      else{
        const u=(t-.33)/.34;
        center.copy(a).multiplyScalar((1-u)**2).addScaledVector(elbow,2*u*(1-u)).addScaledVector(b,u*u);
        forward.copy(a).multiplyScalar(u-1).addScaledVector(elbow,1-2*u).addScaledVector(b,u);
      }
      forward.normalize();
      if(j===0)side.set(0,0,1);
      side.addScaledVector(forward,-side.dot(forward));
      if(side.lengthSq()<.005)side.set(1,0,0).addScaledVector(forward,-forward.x);
      side.normalize();up.crossVectors(forward,side);
      const cuff=t<.10;
      const r=cuff?.036+.005*Math.sin(Math.PI*t/.10):.045+.045*t+.003*Math.sin(39*t);
      for(let k=0;k<=sides;k++){
        const angle=2*Math.PI*k/sides,c=Math.cos(angle),h=Math.sin(angle);
        normal.copy(side).multiplyScalar(c).addScaledVector(up,h);
        const radius=r*(1+(cuff?.17:.055)*c*c+.036*Math.sin(angle*4+t*22));
        const i=j*(sides+1)+k;
        p.setXYZ(i,center.x+radius*normal.x,center.y+radius*normal.y,center.z+radius*normal.z);
        normals.setXYZ(i,normal.x,normal.y,normal.z);
      }
    }
    p.needsUpdate=normals.needsUpdate=true;
  };
}

export function carGrip(scene,source,s,skin,cloth,car,handle){
  const outside=s===1,g=source.geometry.clone();
  const open=fingerPose(source,s,false),closed=fingerPose(source,s,true);
  // Recompute normals on each bent pose to keep knuckles round under the canopy.
  g.setAttribute('position',closed);g.computeVertexNormals();const closedNormals=g.attributes.normal.clone();
  g.setAttribute('position',open);g.computeVertexNormals();g.morphAttributes.position=[closed];g.morphAttributes.normal=[closedNormals];
  const rig=new T.Group();scene.add(rig);rig.visible=false;
  const palm=new T.Mesh(g,skin);rig.add(palm);
  const clothUpdate=sleeveBetween(rig,cloth);
  const basis=new T.Matrix4().makeBasis(new T.Vector3(0,-1,0),new T.Vector3(s,0,0),new T.Vector3(0,0,s));
  const orientation=new T.Quaternion().setFromRotationMatrix(basis);
  if(outside){
    orientation.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI));
  }else{
    orientation.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),s*.16));
  }
  const hold=outside?new T.Vector3(0,-.1025,.025):new T.Vector3(0,-.054,.010);
  const wristBind=new T.Vector3(s*.035,.061,.011);
  const eye=new T.Vector3(),shoulder=new T.Vector3(),target=new T.Vector3(),rest=new T.Vector3(),wrist=new T.Vector3(),axis=new T.Vector3(),carRotation=new T.Quaternion();
  return (t,camera)=>{
    const reach=outside?smooth(18.78,19.46,t)*(1-smooth(20.77,21.39,t)):smooth(25.48,26.20,t)*(1-smooth(27.61,28.12,t));
    rig.visible=reach>.001;if(!rig.visible)return;
    const curl=outside?smooth(19.12,19.44,t)*(1-smooth(20.84,21.05,t)):smooth(26.08,26.31,t)*(1-smooth(27.49,27.70,t));
    palm.morphTargetInfluences[0]=curl;
    car.worldToLocal(eye.copy(camera.position));
    shoulder.copy(eye);shoulder.x+=outside?.055:-.055;shoulder.y-=outside?.234:.21;shoulder.z-=outside?.035:.14;
    rest.copy(shoulder);rest.x+=outside?.09:-.07;rest.y-=outside?.33:.31;rest.z+=outside?-.12:.10;
    car.localToWorld(rest);car.localToWorld(shoulder);
    handle.getWorldQuaternion(palm.quaternion);palm.quaternion.multiply(orientation);
    handle.getWorldPosition(target);
    // Register the pressure plane of the pads, or the inside pull's grip centre.
    target.sub(axis.copy(hold).applyQuaternion(palm.quaternion));
    palm.position.lerpVectors(rest,target,reach);
    if(outside)palm.position.y+=.10*Math.sin(Math.PI*reach);
    wrist.copy(wristBind).applyQuaternion(palm.quaternion).add(palm.position);
    car.getWorldQuaternion(carRotation);
    axis.set(outside?.56:-.25,-1,-.50).applyQuaternion(carRotation);
    clothUpdate(wrist,shoulder,axis);
  };
}
