import * as T from 'three';
import alloyFile from './saucer-alloy.webp';
import hideFile from './holstein.jpg';
import {group,mesh,mat,rubber,metal,chrome,box,oval,link,tube,cylinder,bake,seed,smooth} from './geometry.js';

// Shape the silhouette with transverse sections from rump to muzzle. A continuous
// hide lets the ribs, shoulder and neck catch the beam without overlapping seams.
function cattleHide(animal,coat){
  const slices=[
    [-1.03,1.24,.83,.06],[-.97,1.43,.69,.27],[-.83,1.53,.63,.36],
    [-.63,1.49,.57,.395],[-.42,1.44,.555,.415],[-.18,1.46,.51,.425],
    [.09,1.49,.515,.408],[.32,1.53,.57,.372],[.52,1.57,.63,.316],
    [.68,1.52,.69,.28],[.80,1.46,.76,.225],[.94,1.42,.85,.188],
    [1.07,1.43,.91,.152],[1.16,1.46,1.0,.173],[1.27,1.42,.99,.192],
    [1.38,1.31,.96,.164],[1.49,1.18,.905,.135],[1.56,1.08,.91,.12]];
  const top=new T.CatmullRomCurve3(slices.map(([x,y,,w])=>new T.Vector3(x,y,w)),false,'catmullrom',.48);
  const bottom=new T.SplineCurve(slices.map(([x,,y])=>new T.Vector2(x,y)));
  // Corresponding back and belly landmarks in the broadside hide photograph.
  const landmarks=[
    [22,61,107],[29,44,169],[49,37,189],[85,36,166],[125,46,160],[177,47,195],
    [239,43,201],[279,45,196],[329,45,194],[365,49,186],[395,51,157],[425,50,135],
    [455,45,119],[484,36,112],[505,52,118],[522,72,124],[539,106,130],[546,121,131]];
  const mapping=new T.CatmullRomCurve3(landmarks.map(p=>new T.Vector3(...p)),false,'catmullrom',.48);
  const positions=[],indices=[],uv=[],n=40;
  for(let i=0;i<=84;i++){
    const t=i/84,{x,y,z:w}=top.getPoint(t),lo=bottom.getPoint(t).y;
    const sample=mapping.getPoint(t);
    for(let j=0;j<n;j++){
      const a=2*Math.PI*j/n,up=Math.cos(a),side=Math.sin(a);
      const v=(1+Math.sign(up)*Math.abs(up)**.91)*.5;
      uv.push(sample.x/560,1-T.MathUtils.lerp(sample.z,sample.y,v)/373);
      const rib=Math.exp(-((x+.1)**2)/.17)*Math.cos(19*x+up*3)*.012;
      const width=w+rib+.03*Math.exp(-((x+.81)**2)/.025)*Math.max(up,0);
      positions.push(x,(y+lo)/2+(y-lo)*Math.sign(up)*Math.abs(up)**.91/2,
        width*Math.sign(side)*Math.abs(side)**.90);
      if(i){const k=i*n+j,l=i*n+(j+1)%n;indices.push(k-n,l-n,k,k,l-n,l)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  mesh(animal,g,coat);
}
// The coat photograph also supplies the legs. Each cross section samples
// the corresponding band on the hide so the shoulder patch continues downwards.
function cattleLimb(parent,sections,coat){
  const p=[],uv=[],indices=[],sides=16;
  for(const [i,[x,y,z,rx,rz,u,v,width]] of sections.entries()){
    for(let j=0;j<sides;j++){
      const a=2*Math.PI*j/sides,side=Math.cos(a);
      p.push(x+rx*side,y,z+rz*Math.sin(a));uv.push((u+width*side)/560,1-v/373);
      if(i){const k=i*sides+j,l=i*sides+(j+1)%sides;indices.push(k-sides,l-sides,k,k,l-sides,l)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();mesh(parent,g,coat);
}
function cow(parent,loader){
  const animal=group(parent,-3.1,.04,-29.8);
  const map=loader.load(hideFile);map.colorSpace=T.SRGBColorSpace;map.anisotropy=6;
  const flank=mat(0xb9b6a9,{map,roughness:.98,side:T.DoubleSide});
  const coat=mat(0xd1c2a8,{roughness:.96});
  const nose=mat(0x9c7567),hoof=mat(0x32302b),eye=rubber.clone(),udder=mat(0xa9887c);
  // Fade the entire silhouette with the same fine coverage mask. A ray
  // passing through the hide must also pass through the far leg and hoof.
  const coverage={value:1};
  for(const material of [flank,coat,nose,hoof,eye,udder]){
    material.onBeforeCompile=shader=>{
      shader.uniforms.cowCoverage=coverage;
      shader.fragmentShader='uniform float cowCoverage;\n'+shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(cowCoverage<1.){
          float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
          if(threshold>=cowCoverage)discard;
        }`);
    };
  }
  cattleHide(animal,flank);
  oval(animal,1.554,.984,0,.102,.084,.144,nose).rotation.z=-.36;
  oval(animal,-.59,.60,.01,.216,.143,.193,udder);
  const legs=[],ears=[];
  for(const s of [-1,1]){
    oval(animal,1.614,.997,s*.100,.027,.020,.012,hoof);
    oval(animal,1.302,1.27,s*.174,.037,.039,.020,eye);
    const ear=group(parent,1.14,1.39,s*.13);
    oval(ear,0,0,s*.098,.113,.053,.139,coat).rotation.z=.25;
    ears.push(ear);
    for(const x of [-.71,.65]){
      const z=s*.228,shift=s*.064,back=x<0;
      const knee=[x+(back?.042:.004),.51,z+shift],ankle=[x+(back?-.11:0)+shift,.16,z+shift];
      const u=back?52:322;
      cattleLimb(animal,[
        [x,1.29,z*.87,.145,.092,u,102,25],[x,.99,z,.18,.127,u,147,26],
        [x-.012,.78,z+shift*.45,.143,.106,u,179,20],[knee[0],.62,knee[2],.094,.076,u-4,214,15],
        [...knee,.077,.069,u-6,239,13]
      ],flank);
      const lower=group(parent,...knee),dx=ankle[0]-knee[0];
      cattleLimb(lower,[
        [0,.011,0,.077,.069,u-6,238,13],[dx*.65,-.105,0,.065,.056,u-9,261,11],
        [dx,-.35,0,.044,.044,u-9,307,9],[dx+.009,-.42,0,.059,.051,u-5,326,12]
      ],flank);
      for(const half of [-1,1]){
        const toe=cylinder(lower,ankle[0]+.013-knee[0],.074-knee[1],ankle[2]-knee[2]+half*.023,.043,.056,.099,hoof,12);
        toe.scale.set(1.15,1,.44);toe.rotation.z=-.13;
      }
      legs.push({lower,back,s});
    }
  }
  const tail=group(parent,-.86,1.33,.13);
  tube(tail,[[0,0,0],[-.20,-.25,.05],[-.22,-.58,.09],[-.14,-.86,.125]],.026,coat);
  oval(tail,-.14,-.91,.125,.061,.12,.056,hoof);
  bake(animal);
  for(const part of [...legs.map(leg=>leg.lower),...ears,tail]){bake(part);animal.add(part)}
  return {animal,legs,tail,ears,coverage};
}
export const arrivalTime=29.4;
const inboundStart=28.05;
export function flightPosition(time,out){
  const approach=1-smooth(28,34.7,time),departure=smooth(44,46.8,time);
  // Start beyond the far plane. Descend out of the right-hand cloud bank
  // and shed speed before joining the low glide across the windshield.
  const inbound=(1-smooth(inboundStart,30.45,time))**2;
  const levelOff=1.65*smooth(.003,.065,inbound)*(1-smooth(.09,.15,inbound));
  return out.set(-3.1+16.8*approach+244*inbound-74*departure,
    8-3.55*approach+80*inbound+levelOff+17*departure+.095*Math.sin(time*1.9),
    -29.8-15*approach-109*inbound-65*departure);
}

// Sample earlier positions on the banked, rotating rim. Each strip retains
// its position in the sky as the ship advances, including on timeline seeks.
function lightTrails(scene){
  const steps=24,lanes=3,count=steps*lanes*2,coords=new T.BufferAttribute(new Float32Array(count*3),3);
  const uv=[],indices=[];
  for(let lane=0;lane<lanes;lane++)for(let j=0;j<steps;j++){
    const k=(lane*steps+j)*2;
    uv.push(0,j/(steps-1),1,j/(steps-1));
    if(j)indices.push(k-2,k-1,k,k-1,k+1,k);
  }
  const g=new T.BufferGeometry(),travel=new T.BufferAttribute(new Float32Array(count),1).setUsage(T.DynamicDrawUsage);
  g.setAttribute('position',coords.setUsage(T.DynamicDrawUsage));
  g.setAttribute('travel',travel);
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,
    uniforms:{strength:{value:0}},
    vertexShader:`attribute float travel;varying vec2 st;varying float depth,dist;void main(){
      st=uv;dist=travel;vec4 eye=modelViewMatrix*vec4(position,1.);depth=-eye.z;gl_Position=projectionMatrix*eye;}`,
    fragmentShader:`varying vec2 st;varying float depth,dist;uniform float strength;void main(){
      float d=abs(2.*st.x-1.);
      float core=exp(-15.*d*d),haze=exp(-3.5*d*d);
      vec3 tint=mix(vec3(.15,.46,1.),vec3(1.25,1.50,1.8),core);
      float air=1.-smoothstep(40.,96.,depth);
      gl_FragColor=vec4(tint,(1.-smoothstep(.0,1.,st.y))*(1.-smoothstep(4.,13.,dist))*haze*strength*air);
    }`
  });
  const ribbons=new T.Mesh(g,material);ribbons.frustumCulled=false;scene.add(ribbons);
  const center=new T.Vector3(),offset=new T.Vector3(),rotation=new T.Euler();
  return (t,speed,head)=>{
    material.uniforms.strength.value=smooth(0.6,4.1,speed)*.86;
    ribbons.visible=t>inboundStart&&t<46.8&&material.uniforms.strength.value>.01;
    if(!ribbons.visible)return;
    const departing=t>=44;
    const duration=departing?.58:T.MathUtils.lerp(1.42,.18,smooth(6,34,speed));
    // Follow the three pods on the trailing edge during each pass. The
    // disc rotates while hovering between the two passes.
    const firstPod=departing?-3:4;
    for(let j=0;j<steps;j++){
      const age=j/(steps-1),sample=Math.max(inboundStart,t-age*duration);
      flightPosition(sample,center);flightRotation(sample,rotation);
      const distance=center.distanceTo(head);
      for(let lane=0;lane<lanes;lane++){
        const a=(firstPod+lane*2)*Math.PI/8,halfWidth=(.12+.045*lane)*(1-.72*age);
        offset.set(3.48*Math.cos(a),-.25,3.48*Math.sin(a)).applyEuler(rotation).add(center);
        const k=(lane*steps+j)*2;
        travel.setX(k,distance);travel.setX(k+1,distance);
        coords.setXYZ(k,offset.x,offset.y-halfWidth,offset.z);
        coords.setXYZ(k+1,offset.x,offset.y+halfWidth,offset.z);
      }
    }
    coords.needsUpdate=travel.needsUpdate=true;
  };
}
function flightRotation(t,out){
  const bank=.28*smooth(inboundStart,29.1,t)*(1-smooth(29.7,30.75,t));
  return out.set(.028*Math.cos(t),t*.27,bank+.085*(1-smooth(28,34.7,t))-.25*smooth(44,46.8,t));
}

// Rain dragged off the moving rim disperses at its earlier world positions.
function rimSpray(scene){
  const rows=20,count=rows*16,rng=seed(1965);
  const offsets=[],positions=new Float32Array(count*3),fades=new Float32Array(count);
  for(let i=0;i<count;i++){
    const age=Math.floor(i/16)/(rows-1),angle=rng()*Math.PI*2;
    offsets.push(new T.Vector3(Math.cos(angle)*(3.55+age*rng()),-.16+age*(rng()-.6),Math.sin(angle)*(3.55+age*rng())));
    fades[i]=(1-age)**1.5*(.22+.65*rng());
  }
  const g=new T.BufferGeometry(),buffer=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  g.setAttribute('position',buffer);g.setAttribute('fade',new T.BufferAttribute(fades,1));
  const material=new T.ShaderMaterial({
    uniforms:{motion:{value:0},height:{value:1}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute float fade;uniform float height;varying float opacity;
      void main(){vec4 eye=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*eye;gl_PointSize=clamp(height*.021/max(1.,-eye.z),1.,3.);
        opacity=fade*(1.-smoothstep(40.,96.,-eye.z));}`,
    fragmentShader:`uniform float motion;varying float opacity;void main(){
      vec2 d=gl_PointCoord*2.-1.;float glint=exp(-3.*dot(d,d));
      gl_FragColor=vec4(.42,.63,.79,opacity*motion*glint*.71);}`});
  const points=new T.Points(g,material),center=new T.Vector3(),viewport=new T.Vector4();
  points.frustumCulled=false;points.visible=false;scene.add(points);
  points.onBeforeRender=r=>{material.uniforms.height.value=r.getCurrentViewport(viewport).w};
  return (t,speed)=>{
    material.uniforms.motion.value=smooth(1.6,9,speed);
    points.visible=t>=inboundStart&&t<46.8&&material.uniforms.motion.value>.01;
    if(!points.visible)return;
    for(let row=0;row<rows;row++){
      const age=row/(rows-1);
      flightPosition(Math.max(inboundStart,t-age*.54),center);
      for(let j=0;j<16;j++){
        const i=row*16+j,o=offsets[i];
        buffer.setXYZ(i,center.x+o.x,center.y+o.y-age*age*.76,center.z+o.z+age*.36*Math.sin(t*3+j));
      }
    }
    buffer.needsUpdate=true;
  };
}

export function encounter(scene,loader){
  const {animal,legs,tail,ears,coverage}=cow(scene,loader),craft=group(scene);
  const response=loader.load(alloyFile);response.wrapS=T.RepeatWrapping;response.anisotropy=8;
  const alloy=mat(0x9da7ae,{metalness:.78,roughness:.89,roughnessMap:response,bumpMap:response,bumpScale:.006});
  alloy.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb*=texture2D(roughnessMap,vRoughnessMapUv).b;`);
  };
  const rib=mat(0x384449,{metalness:.79,roughness:.35});
  const glow=new T.MeshBasicMaterial({color:new T.Color(1.9,1.75,1.5)});
  const emitter=mat(0x293338,{metalness:.68,roughness:.32,emissive:0xbed9dd,emissiveIntensity:.12});
  const gasket=mat(0x191e20,{roughness:.68});
  const profile=[[.01,-.72],[.91,-.71],[1.08,-.60],[1.55,-.53],[1.73,-.47],[2.51,-.40],[3.50,-.21],[3.77,-.06],[3.8,.055],[3.51,.17],[2.15,.45],[1.48,.53],[1.23,.78],[.77,.96],[.01,1.03]];
  mesh(craft,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),128),alloy);
  const ring=(r,y,th,m)=>{const o=mesh(craft,new T.TorusGeometry(r,th,10,112),m,0,y,0);o.rotation.x=Math.PI/2};
  ring(3.70,-.085,.035,rib);ring(3.52,-.193,.026,metal);
  ring(1.62,-.50,.042,rib);ring(1.52,-.55,.019,emitter);ring(1.03,-.68,.07,rib);
  cylinder(craft,0,-.718,0,.91,.89,.045,emitter,64);
  for(const r of [.29,.54,.78])ring(r,-.743,.014,rib);
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,x=Math.cos(a),z=Math.sin(a);
    link(craft,[x*1.82,-.495,z*1.82],[x*3.4,-.236,z*3.4],.014,.020,rib);
    if(i%2===0){
      const pod=group(craft,x*3.48,-.218,z*3.48);pod.rotation.y=-a;
      oval(pod,0,0,0,.097,.048,.146,gasket);
      oval(pod,0,-.034,0,.063,.023,.099,glow);
      const strip=mesh(craft,new T.TorusGeometry(3.62,.017,6,12,.125),glow,0,.116,0);
      strip.rotation.order='YXZ';strip.rotation.set(Math.PI/2,-a,0);
    }
  }
  bake(craft);
  const flare=document.createElement('canvas');flare.width=flare.height=96;
  const context=flare.getContext('2d'),halo=context.createRadialGradient(48,48,0,48,48,48);
  halo.addColorStop(0,'rgba(190,255,255,.65)');halo.addColorStop(.20,'rgba(118,209,223,.27)');halo.addColorStop(.64,'rgba(76,147,168,.065)');halo.addColorStop(1,'rgba(76,147,168,0)');
  context.fillStyle=halo;context.fillRect(0,0,96,96);
  const bloom=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(flare),transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  bloom.position.y=-.88;bloom.scale.set(4.8,2.7,1);craft.add(bloom);
  const beamMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.FrontSide,
    uniforms:{strength:{value:0}},
    vertexShader:`varying vec2 st;varying vec3 radial,eye;void main(){
      st=uv;vec4 p=modelMatrix*vec4(position,1.);
      radial=normalize(vec3(position.x,0.,position.z));eye=cameraPosition-p.xyz;
      gl_Position=projectionMatrix*viewMatrix*p;
    }`,
    fragmentShader:`varying vec2 st;varying vec3 radial,eye;uniform float strength;void main(){
      float thickness=smoothstep(0.,.72,abs(dot(normalize(radial),normalize(eye))));
      float shafts=.92+.05*sin(st.x*94.25+st.y*2.)+.03*sin(st.x*50.26-st.y*3.);
      float density=(.19+.81*st.y*st.y)*smoothstep(0.,.12,st.y)*thickness;
      gl_FragColor=vec4(.43,.76,.83,strength*shafts*density*.30);
    }`
  });
  const beam=mesh(scene,new T.CylinderGeometry(.90,2.68,1,72,1,true),beamMat);beam.castShadow=false;
  const pool=new T.SpotLight(0xb9f5ff,0,23,.33,.72,1.1);pool.target.position.set(-3.1,0,-29.8);scene.add(pool,pool.target);
  const dustGeom=new T.BufferGeometry(),coords=[],rng=seed(8942);
  for(let i=0;i<140;i++){const a=rng()*2*Math.PI,r=Math.sqrt(rng())*2;coords.push(r*Math.cos(a),rng(),r*Math.sin(a))}
  dustGeom.setAttribute('position',new T.Float32BufferAttribute(coords,3));
  const dust=new T.Points(dustGeom,new T.PointsMaterial({color:0xa7dcda,size:.018,transparent:true,opacity:.65,depthWrite:false}));scene.add(dust);
  const wake=rimSpray(scene),trails=lightTrails(scene),previous=new T.Vector3();
  function animate(t){
    const lift=smooth(36,43.9,t),active=smooth(34.5,35.7,t)*(1-smooth(43.73,44,t));
    for(const {lower,back,s} of legs){
      const weight=smooth(35.9,37.9,t);
      lower.rotation.z=weight*((back?-.39:.28)+.18*Math.sin(t*2.7+s*1.8+(back?2.1:0)));
    }
    craft.visible=t<46.8;
    flightPosition(t,craft.position);flightRotation(t,craft.rotation);
    const speed=craft.position.distanceTo(flightPosition(t-.05,previous))/.05;
    wake(t,speed);trails(t,speed,craft.position);
    const ignition=smooth(arrivalTime-.55,arrivalTime+.20,t)*(1-smooth(arrivalTime+.20,arrivalTime+.80,t));
    const running=smooth(.6,4.1,speed);
    glow.color.setRGB(1.9+2*ignition,1.75+.6*running+4*ignition,1.5+1.4*running+7*ignition);
    emitter.emissiveIntensity=.12+.65*running+7*ignition+3.4*active;
    bloom.scale.set(4.8+5*ignition,2.7+1.4*ignition,1);
    bloom.material.color.setRGB(1+1.2*ignition,1+2.3*ignition,1+4*ignition);
    bloom.material.opacity=(.08+.16*running+.58*ignition+.86*active)*smooth(-100,-43,craft.position.z);
    tail.rotation.x=.13+.21*Math.sin(t*1.14)+.07*Math.sin(t*2.9);
    for(const [i,ear] of ears.entries()){
      const flick=Math.max(0,Math.sin(t*1.7+i*2.6))**18;
      ear.rotation.x=(i?1:-1)*(.07+.24*flick);
    }
    animal.scale.y=1+.0035*Math.sin(t*1.8);
    const rise=6.97*lift;
    coverage.value=smooth(1.05,3.4,6.97-rise);
    animal.visible=coverage.value>0;
    animal.position.set(-3.1+.18*Math.sin(lift*Math.PI),.035+rise,-29.8);
    animal.rotation.set(lift*.13,-.17+lift*.84,.014*Math.sin(t*1.64)+lift*.42);
    const height=craft.position.y-.7;
    beam.visible=dust.visible=active>.001;
    beam.position.set(-3.1,height/2,-29.8);beam.scale.y=height;beamMat.uniforms.strength.value=active;
    dust.position.set(-3.1,0,-29.8);dust.scale.y=height;dust.rotation.y=t*.16;
    dust.material.opacity=.54*active;
    pool.position.copy(craft.position);pool.intensity=active*138;
    return craft.position;
  }
  return {animate,beam,alloy};
}
