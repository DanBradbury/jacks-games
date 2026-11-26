import * as T from 'three';
import {group, mat, mesh, cylinder, oval, tube, metal, seed, bake} from './geometry.js';

import {strikeTime} from './thunder.js';
import {roadCenterZ} from './orchard.js';

export function streetLights(scene) {
  const fixtures = group(scene);
  const steel = mat(0x494647, {metalness:.72,roughness:.49});
  const lens = new T.MeshBasicMaterial({color:new T.Color(3.4,2.7,1.7)});
  const mist = new T.ShaderMaterial({
    transparent:true, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending,
    uniforms:{fogDensity:{value:scene.fog.density}},
    vertexShader:`varying vec2 v;varying float range;void main(){
      v=uv;vec4 eye=modelViewMatrix*vec4(position,1.);range=length(eye.xyz);gl_Position=projectionMatrix*eye;
    }`,
    fragmentShader:`varying vec2 v;varying float range;uniform float fogDensity; void main(){
      // Multisample edge fragments can interpolate UVs outside the light card.
      float height=clamp(v.y,0.,1.);
      float dist=1.-height;
      float width=.025+.43*dist;
      float radius=(v.x-.5)/width;
      float core=exp(-radius*radius*2.8);
      float alpha=core*pow(height,.85)*smoothstep(0.,.045,dist);
      gl_FragColor=vec4(.82,.68,.47,alpha*.22*exp(-pow(range*fogDensity,2.)));
    }`
  });
  const shafts = [];
  for(const x of [-11.8,6.4]){
    const z=roadCenterZ(x)-2.6;
    cylinder(fixtures,x,.27,z,.108,.135,.54,steel);
    cylinder(fixtures,x,2.84,z,.045,.076,5.68,steel);
    tube(fixtures,[[x,5.56,z],[x,5.88,z-.02],[x,6.08,z+.26],[x,6.11,z+.84]],.042,steel);
    oval(fixtures,x,6.09,z+.91,.15,.083,.35,metal);
    oval(fixtures,x,6.025,z+.94,.128,.035,.27,lens);
    const shaft=mesh(scene,new T.PlaneGeometry(4.95,6.03),mist,x,3.013,z+.94);
    shaft.castShadow=false;shafts.push(shaft);
    const lamp=new T.SpotLight(0xffdbb1,145,15,.81,.84,1.85);
    lamp.position.set(x,5.96,z+.94);lamp.target.position.set(x,.01,z+2.4);scene.add(lamp,lamp.target);
  }
  bake(fixtures);
  return camera=>{
    for(const shaft of shafts)shaft.rotation.y=Math.atan2(camera.position.x-shaft.position.x,camera.position.z-shaft.position.z);
  };
}

export const cloudSource=new T.Vector3(24,54,-98);
const groundStrike=new T.Vector3(17,-.3,-91);

export function storm(scene,flash) {
  const rng=seed(4417);
  // Short return strokes share the same channel. Scene-linear radiance drives
  // lens bloom only where the channel is visible through foreground geometry.
  const positions=[],tangents=[],widths=[],sides=[],energies=[],indices=[];
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
      const cloudFade=start===cloudSource?T.MathUtils.smoothstep(t,0,.055):1;
      const energy=(radius/.065)*cloudFade*(1-.60*t**4);
      for(const edge of [-1,1]){
        positions.push(...points[i].toArray());tangents.push(...tangent.toArray());
        widths.push(width);sides.push(edge);energies.push(energy);
      }
      if(i)indices.push(j-2,j-1,j,j-1,j+1,j);
    }
    return points;
  }
  const main=channel(cloudSource,groundStrike,24,6,.125);
  for(const at of [8,14,22,31,41,48]){
    const p=main[at],sign=at%3===1?-1:1;
    const branch=channel(p,p.clone().add(new T.Vector3(sign*(3+rng()*8),-3-rng()*8,rng()*4)),5.4,4,.045);
    const split=branch[7];
    channel(split,split.clone().add(new T.Vector3(sign*3,-3,rng()*2)),2,3,.022);
  }
  const channels=new T.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['pathTangent',tangents,3],['radius',widths,1],['edge',sides,1],['energy',energies,1]]){
    channels.setAttribute(name,new T.Float32BufferAttribute(data,size));
  }
  channels.setIndex(indices);
  const bolt=new T.Mesh(channels,core),viewport=new T.Vector4();
  bolt.onBeforeRender=renderer=>{core.uniforms.viewportHeight.value=renderer.getCurrentViewport(viewport).w};
  scene.add(bolt);
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
  bolt.visible=false;
  return time=>{
    const age=time-strikeTime;
    const impulse=(start,decay)=>{
      const t=age-start;
      return t<0?0:Math.min(t/.012,1)*Math.exp(-t*decay);
    };
    const stroke=impulse(0,14)+.82*impulse(.086,19)+.40*impulse(.207,24);
    flash.value=stroke+.22*impulse(.017,4.8);
    bolt.visible=stroke>.009;veil.visible=flash.value>.003;
    core.uniforms.pulse.value=stroke*9;
    light.intensity=flash.value*3900;
  };
}
