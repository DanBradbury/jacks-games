import * as T from 'three';
import {group, mat, mesh, cylinder, oval, tube, metal, seed, bake} from './geometry.js';

import {strikeTime} from './thunder.js';
import {roadCenterZ} from './orchard.js';

export function streetLights(scene) {
  const fixtures = group(scene);
  const steel = mat(0x494647, {metalness:.72,roughness:.49});
  const lens = new T.MeshBasicMaterial({color:new T.Color(3.4,2.7,1.7)});
  // Integrate the illuminated rain volume along the view ray. Its long
  // axis follows the lamp's throw across the road in every camera view.
  const mist=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{fogDensity:{value:scene.fog.density}},
    vertexShader:`varying vec3 rayStart,entry;
      void main(){
        entry=position;rayStart=cameraPosition-modelMatrix[3].xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`varying vec3 rayStart,entry;uniform float fogDensity;
      void main(){
        vec3 dir=normalize(entry-rayStart);
        vec3 boundary=mix(vec3(-6.,-3.,-6.),vec3(6.,3.,6.),step(vec3(0.),dir));
        vec3 toEnd=(boundary-entry)/(mix(vec3(-1.),vec3(1.),step(vec3(0.),dir))*max(abs(dir),vec3(.00001)));
        float extent=max(0.,min(toEnd.x,min(toEnd.y,toEnd.z)));
        vec3 start=entry-vec3(0.,2.99,-1.05);
        float along=dot(start,dir);
        vec3 perpendicular=start-along*dir;
        float impact=sqrt(dot(perpendicular,perpendicular)+.48);
        // Sample equal angles about the bulb, concentrating samples where
        // inverse-square irradiance changes fastest.
        float angle=atan(along/impact);
        float arc=(atan((along+extent)/impact)-angle)/12.;
        float scatter=0.;
        for(int i=0;i<12;i++){
          vec3 travel=perpendicular+dir*impact*tan(angle+(float(i)+.5)*arc);
          float r2=dot(travel,travel);
          float beam=dot(travel*inversesqrt(max(r2,.001)),vec3(0.,-.935,.355));
          scatter+=smoothstep(.43,.93,beam)*smoothstep(0.,.35,-travel.y);
        }
        float air=length(entry-rayStart)*fogDensity;
        gl_FragColor=vec4(.92,.71,.50,scatter*arc/impact*.145*exp(-air*air));
      }`
  });
  for(const x of [-11.8,6.4]){
    const z=roadCenterZ(x)-2.6;
    cylinder(fixtures,x,.27,z,.108,.135,.54,steel);
    cylinder(fixtures,x,2.84,z,.045,.076,5.68,steel);
    tube(fixtures,[[x,5.56,z],[x,5.88,z-.02],[x,6.08,z+.26],[x,6.11,z+.84]],.042,steel);
    oval(fixtures,x,6.09,z+.91,.15,.083,.35,metal);
    oval(fixtures,x,6.025,z+.94,.128,.035,.27,lens);
    const shaft=mesh(scene,new T.BoxGeometry(12,6,12),mist,x,3.0,z+1.99);
    shaft.castShadow=shaft.receiveShadow=false;
    const lamp=new T.SpotLight(0xffd1a2,147,17,.96,.78,2);
    lamp.position.set(x,5.96,z+.94);lamp.target.position.set(x,.01,z+3.20);scene.add(lamp,lamp.target);
  }
  bake(fixtures);

}

export const cloudSource=new T.Vector3(24,54,-98);
const groundStrike=new T.Vector3(17,-.3,-91);

const openingCloud=new T.Vector3(-78,23,-103);
const blueCloud=new T.Vector3(-91,29,-92);

function boltGeometry(source,foot,spread,radius,forks,seedValue){
  const rng=seed(seedValue);
  const positions=[],tangents=[],widths=[],sides=[],energies=[],indices=[];
  function channel(start,end,displacement,depth,radius){
    let points=[start,end];
    const axis=end.clone().sub(start).normalize();
    const across=new T.Vector3().crossVectors(axis,new T.Vector3(0,0,1)).normalize();
    for(let j=0;j<depth;j++){
      const next=[points[0]];
      for(let k=1;k<points.length;k++){
        const mid=points[k-1].clone().lerp(points[k],.43+rng()*.14);
        mid.addScaledVector(across,(rng()-.5)*displacement);
        mid.z+=(rng()-.5)*displacement*.63;
        next.push(mid,points[k]);
      }
      points=next;displacement*=.55;
    }
    for(let i=0;i<points.length;i++){
      const t=i/(points.length-1),j=positions.length/3;
      const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(i-1,0)]).normalize();
      const width=radius*(1-.55*t)*(.86+.21*rng());
      const cloudFade=start===source?T.MathUtils.smoothstep(t,0,.055):1;
      const energy=(radius/.065)*cloudFade*(1-.60*t**4);
      for(const edge of [-1,1]){
        positions.push(...points[i].toArray());tangents.push(...tangent.toArray());
        widths.push(width);sides.push(edge);energies.push(energy);
      }
      if(i)indices.push(j-2,j-1,j,j-1,j+1,j);
    }
    return points;
  }
  const main=channel(source,foot,spread,6,radius);
  for(const at of forks){
    const p=main[at],sign=at%3===1?-1:1;
    const branch=channel(p,p.clone().add(new T.Vector3(sign*(3+rng()*8),-3-rng()*8,rng()*4)),spread*.225,4,radius*.36);
    const split=branch[7];
    channel(split,split.clone().add(new T.Vector3(sign*3,-3,rng()*2)),spread/12,3,radius*.176);
  }
  const channels=new T.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['pathTangent',tangents,3],['radius',widths,1],['edge',sides,1],['energy',energies,1]]){
    channels.setAttribute(name,new T.Float32BufferAttribute(data,size));
  }
  channels.setIndex(indices);
  return channels;
}

// Finite film-time pulses keep scrubbing and fixed-frame export deterministic.
function pulse(age,rise,decay){
  return age<=0||age>2?0:Math.min(age/rise,1)*Math.exp(-age*decay);
}

export function storm(scene,flash,skyCue,blueFlashTime) {
  const core=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    uniforms:{pulse:{value:0},viewportHeight:{value:1}},
    vertexShader:`attribute vec3 pathTangent;attribute float radius,edge,energy;
      uniform float viewportHeight;varying float crossSection,brightness;
      void main(){
        vec4 eye=modelViewMatrix*vec4(position,1.);
        vec3 dir=mat3(modelViewMatrix)*pathTangent;
        vec2 projected=dir.xy-eye.xy*(dir.z/eye.z);
        vec2 side=normalize(vec2(-projected.y,projected.x));
        float pixel=2.*abs(eye.z)/(projectionMatrix[1][1]*viewportHeight);
        float width=max(radius,pixel*.68);
        eye.xy+=side*edge*width*2.4;
        crossSection=edge*2.4;brightness=energy*radius/width;
        gl_Position=projectionMatrix*eye;
      }`,
    fragmentShader:`uniform float pulse;varying float crossSection,brightness;
      void main(){
        float core=exp(-2.4*crossSection*crossSection);
        gl_FragColor=vec4(vec3(.78,.86,1.)*core*brightness*pulse,1.);
      }`
  });
  const light=new T.SpotLight(0xd6dfff,0,165,1.04,.76,2);
  light.position.copy(groundStrike).lerp(cloudSource,.43);
  light.target.position.set(1,0,-41);scene.add(light,light.target);
  light.castShadow=true;light.shadow.mapSize.set(1024,1024);
  light.shadow.camera.near=5;light.shadow.camera.far=160;light.shadow.normalBias=.035;
  const viewport=new T.Vector4();
  function boltMesh(geometry,material){
    const mesh=new T.Mesh(geometry,material);
    mesh.visible=false;
    mesh.onBeforeRender=renderer=>{material.uniforms.viewportHeight.value=renderer.getCurrentViewport(viewport).w};
    scene.add(mesh);return mesh;
  }
  const bolt=boltMesh(boltGeometry(cloudSource,groundStrike,24,.125,[8,14,22,31,41,48],4417),core);
  const distantCore=core.clone();
  const distantBolt=boltMesh(boltGeometry(openingCloud,new T.Vector3(-86,1,-108),9,.075,[18,33,46],1924),distantCore);
  // Scattering in the rain column occupies the strike's depth. Opaque limbs
  // and alpha-tested leaves occlude it in the main and reflected views.
  const haze=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{flash},
    vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 st;uniform float flash;void main(){
      float height=st.y;
      float dx=st.x-.5-(height-.5)*.19;
      float spread=.07+.085*height;
      float veil=exp(-dx*dx/(spread*spread))*smoothstep(0.,.17,height)*(1.-smoothstep(.72,1.,height));
      gl_FragColor=vec4(.48,.58,.79,flash*veil*.15);
    }`
  });
  const veil=new T.Mesh(new T.PlaneGeometry(61,51),haze);
  veil.position.copy(groundStrike).lerp(cloudSource,.50);veil.position.z-=1.4;scene.add(veil);
  return time=>{
    const age=time-strikeTime;
    const stroke=pulse(age,.012,14)+.82*pulse(age-.086,.012,19)+.40*pulse(age-.207,.012,24);
    flash.value=stroke+.22*pulse(age-.017,.012,4.8);

    const opening=time-.72;
    const distant=pulse(opening,.023,13)+.64*pulse(opening-.115,.017,17);
    distantBolt.visible=distant>.012;
    distantCore.uniforms.pulse.value=distant*2.7;
    // A distant discharge lights a broad patch behind the shop glass.
    // The second cue occupies a much smaller patch above the roadside sign.
    const blueAge=time-blueFlashTime;
    if(blueAge<0){
      skyCue.position.copy(openingCloud);
      skyCue.width.set(.14,.069);
      skyCue.radiance.setRGB(.40,.53,.79).multiplyScalar(distant+.17*pulse(opening-.012,.04,5));
    }else{
      skyCue.position.copy(blueCloud);
      skyCue.width.set(.029,.018);
      skyCue.radiance.setRGB(.15,.46,1.0).multiplyScalar(pulse(blueAge,.048,9));
    }
    bolt.visible=stroke>.009;veil.visible=flash.value>.003;
    core.uniforms.pulse.value=stroke*9;
    light.intensity=flash.value*3900;
  };
}
