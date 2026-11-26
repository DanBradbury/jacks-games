import * as T from 'three';
import {groundHeight,roadCenterZ} from './orchard.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {group,mesh,mat,metal,rubber,chrome,box,oval,link,tube,cylinder,paint,bake,seed} from './geometry.js';
import concreteFile from '../../night-shift/src/scans/concrete_floor_damaged_01_Diffuse.jpg';
import floorMap from './worn_asphalt.jpg';
import pastureMap from './rocky_terrain_02.jpg';
import roofMap from './corrugated_iron_02.jpg';
import {shopInterior} from './shop.js';
import {stationFinishes,serviceBay} from './service-bay.js';
import {weather} from './finish.js';
import {wetPane} from './rain.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import floorNormal from './asphalt-normal.jpg';

const ivory=mat(0xb8b6a1),enamel=mat(0xa53d29,{roughness:.63}),trim=mat(0x425047,{metalness:.22,roughness:.66}),fluoro=mat(0xfaf2d9,{emissive:0xffeac2,emissiveIntensity:3.4});
[ivory,enamel,trim].forEach(m=>weather(m,.86));
function canopyLamp(scene,x,y,z,color,power,range){
  const lamp=new T.SpotLight(color,power,range,1.42,.45,2);
  lamp.position.set(x,y,z);lamp.target.position.set(x,0,z);
  scene.add(lamp,lamp.target);return lamp;
}
function pump(p,x,z,n,finish){
  const g=group(p,x,0,z);g.rotation.y=x>0?-.89:.59;
  box(g,0,.11,0,1.24,.22,1.0,ivory);box(g,0,.65,0,.79,1.0,.55,enamel);
  mesh(g,new RoundedBoxGeometry(.88,.80,.60,3,.042),ivory,0,1.46,0);box(g,0,1.89,0,.93,.075,.64,enamel);
  for(const side of [-1,1]){
    const front=group(g);front.rotation.y=side<0?Math.PI:0;
    box(front,0,1.49,.302,.77,.567,.016,metal);
    mesh(front,new T.PlaneGeometry(.737,.536),finish.meter,0,1.49,.313);
    for(const side of [-1,1])for(const y of [1.22,1.76])oval(front,side*.384,y,.30,.012,.012,.006,metal);
    paint(front,0,1.189,.304,.52,.13,[['LEADED  MOTOR  FUEL',.31,.27],['MINIMUM OCTANE  87',.25,.72]],'#a99b7e');
    for(let k=0;k<8;k++)box(front,-.237+k*.068,1.02,.28,.044,.021,.006,rubber);
    paint(front,0,.80,.28,.49,.23,[['REGULAR',.38,.56]],'#e3d8b7','#a83b24');
    paint(front,0,1.78,.306,.54,.086,[['S I E R R A    O I L',.61,.53]],'#d7cdb5');
  }
  tube(g,[[.44,1.67,0],[.66,1.23,.06],[.68,.29,.10],[.53,.25,.25],[.49,1.14,.19]],.032,rubber);
  link(g,[.47,1.06,.2],[.51,1.28,.13],.048,.054,trim);
  link(g,[.51,1.28,.13],[.43,1.41,.06],.022,.025,chrome);
  paint(g,0,1.92,.334,.17,.15,[[String(n),.75,.53]],'#9d3927','#f8eccc');
}
// Local +Y becomes world -Z when these coplanar surfaces are laid flat.
function roadStrip(width,offset=0){
  const g=new T.PlaneGeometry(432,width,144,1),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)-roadCenterZ(p.getX(i))-offset);
  return g;
}
// Local impulses disturb the water film on rough asphalt as well as the
// deeper puddles. Both materials use the same hits in world coordinates.
const surfaceRain=`
  uniform float clock;
  float hash(vec2 p){vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
  float noiseAt(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+1.),f.x),f.y);}
  float exposureAt(vec2 p){
    vec2 canopy=abs(p-vec2(1.5,-7.55))-vec2(5.1,4.5);
    vec2 store=abs(p-vec2(0.,3.7))-vec2(5.,3.7);
    vec2 garage=abs(p-vec2(8.78,-3.45))-vec2(1.56,4.28);
    return smoothstep(-.8,.30,max(canopy.x,canopy.y))*smoothstep(-.07,.18,max(store.x,store.y))*
           smoothstep(-.12,.18,max(garage.x,garage.y));
  }
  vec2 waveSlope(vec2 cell,float time){
    vec2 id=floor(cell);
    float phase=time*mix(1.25,2.9,hash(id))+hash(id+31.)*12.;
    vec2 key=id+floor(phase)*vec2(9.,17.);
    vec2 d=fract(cell)-mix(vec2(.32),vec2(.68),vec2(hash(key),hash(key+8.)));
    float radius=length(d),age=fract(phase);
    float front=radius-.28*age,footprint=length(fwidth(cell));
    float resolve=1.-smoothstep(.045,.16,footprint);
    float wave=sin(front*81.)*exp(-front*front*640.)*(1.-age)*smoothstep(0.,.06,age);
    return d/max(.006,radius)*wave*resolve;
  }
  vec2 rainSlope(vec2 p){
    mat2 turn=mat2(.8,.6,-.6,.8);
    vec2 fine=waveSlope(turn*p*5.1+7.4,clock+.7);
    return waveSlope(p*3.7,clock)*.31+transpose(turn)*fine*.21;
  }`;

function wetPavementMaterial(color,props,filmTime){
  const surface=mat(color,props);
  surface.onBeforeCompile=shader=>{
    shader.uniforms.clock=filmTime;
    shader.vertexShader='varying vec2 land;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nland=(modelMatrix*vec4(position,1.)).xz;');
    shader.fragmentShader='varying vec2 land;\n'+surfaceRain+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float waterFilm=exposureAt(land)*(.28+.72*smoothstep(.26,.78,noiseAt(land*.61)));
      roughnessFactor=mix(roughnessFactor,.36,waterFilm);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 slope=rainSlope(land)*waterFilm;
        normal=normalize(normal+mat3(viewMatrix)*vec3(-slope.x,0.,-slope.y));`);
  };
  return surface;
}

function pavement(scene,loader,roadSurface,filmTime){
  const diffuse=loader.load(floorMap),normal=loader.load(floorNormal);
  for(const t of [diffuse,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(12,10);t.anisotropy=4}
  diffuse.colorSpace=T.SRGBColorSpace;
  const lot=new T.PlaneGeometry(36,29.1).translate(0,.55,0);
  const base=mesh(scene,lot,wetPavementMaterial(0x605e58,{map:diffuse,normalMap:normal,roughness:.86,normalScale:new T.Vector2(.40,.40)},filmTime),0,-.009,0);
  base.rotation.x=-Math.PI/2;
  const slab=loader.load(concreteFile);slab.colorSpace=T.SRGBColorSpace;slab.anisotropy=6;
  slab.wrapS=slab.wrapT=T.RepeatWrapping;slab.repeat.set(3.9,3.05);
  const apron=mesh(scene,new T.PlaneGeometry(13.1,13.7),
    wetPavementMaterial(0x9a978e,{map:slab,normalMap:normal,normalScale:new T.Vector2(.21,.21),roughness:.88},filmTime),1.35,-.003,-6.95);
  apron.rotation.x=-Math.PI/2;
  const gaps=group(scene),tar=mat(0x332f2b,{roughness:.73});
  for(const x of [-4.95,-1.60,1.8,5.14])box(gaps,x,.001,-6.95,.011,.004,13.64,tar);
  for(const z of [-.50,-3.79,-7.21,-10.52,-13.72])box(gaps,1.35,.001,z,13.1,.005,.013,tar);
  const random=seed(584);
  for(let i=0;i<25;i++){
    let x=-4.99+random()*12.6,z=-.33-random()*11.5;
    const fissure=[[x,.004,z]],angle=random()*Math.PI*2;
    for(let j=0;j<7;j++){
      x+=.14*Math.cos(angle)+(random()-.5)*.25;z+=.18*Math.sin(angle)+(random()-.5)*.21;
      fissure.push([x,.004,z]);
    }
    tube(gaps,fissure,.0035+random()*.005,tar);
  }
  bake(gaps);
  const shader=Reflector.ReflectorShader;
  const wet=new Reflector(mergeGeometries([lot,roadSurface]),{textureWidth:768,textureHeight:448,multisample:0,clipBias:.004,shader:{
    uniforms:{...shader.uniforms,relief:{value:null},clock:{value:0},fogDensity:{value:scene.fog.density}},
    vertexShader:shader.vertexShader.replace('uniform mat4 textureMatrix;','uniform mat4 textureMatrix; varying vec3 groundPoint;').replace('vUv =','groundPoint=(modelMatrix*vec4(position,1.)).xyz; vUv ='),
    fragmentShader:surfaceRain+`uniform sampler2D tDiffuse,relief;uniform float fogDensity;varying vec4 vUv;varying vec3 groundPoint;
    void main(){vec2 land=groundPoint.xz;
      vec2 n=texture2D(relief,land*.37).rg-.5;
      // Wind-driven rain reaches the edges of the canopy and shop entrance.
      float exposure=exposureAt(land);
      vec2 shopEdge=abs(land-vec2(0.,3.7))-vec2(5.,3.7);
      float outdoors=smoothstep(-.12,.35,max(shopEdge.x,shopEdge.y));
      float basin=.59*noiseAt(land*.47)+.29*noiseAt(land*1.47)+.12*noiseAt(land*5.2);
      float damp=smoothstep(mix(.69,.42,exposure),mix(.85,.69,exposure),basin);
      float wetness=outdoors*mix(.24,1.,exposure)*damp;
      vec2 ripple=rainSlope(land)*exposure*damp;
      if(wetness<.005)discard;
      vec2 uv=vUv.xy/vUv.w+n*mix(.031,.004,damp)+ripple*.026;
      vec2 blur=vec2(.0015,.005)*mix(1.9,.50,damp);
      vec3 r=texture2D(tDiffuse,uv).rgb*.4;
      r+=.15*(texture2D(tDiffuse,uv+blur).rgb+texture2D(tDiffuse,uv-blur).rgb+
              texture2D(tDiffuse,uv+vec2(-blur.x,blur.y)).rgb+texture2D(tDiffuse,uv+vec2(blur.x,-blur.y)).rgb);
      vec3 surfaceNormal=normalize(vec3(-ripple.x,1.,-ripple.y));
      float facing=clamp(dot(normalize(cameraPosition-groundPoint),surfaceNormal),0.,1.);
      float fresnel=.02+.98*pow(1.-facing,5.);
      float visibility=exp(-fogDensity*fogDensity*dot(cameraPosition-groundPoint,cameraPosition-groundPoint));
      gl_FragColor=vec4(r,wetness*fresnel*.79*visibility);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  }});
  wet.material.uniforms.clock=filmTime;
  wet.material.uniforms.relief.value=normal;wet.material.transparent=true;wet.material.depthWrite=false;wet.rotation.x=-Math.PI/2;wet.position.y=.023;scene.add(wet);
  return wet;
}
export function station(scene,loader,filmTime,optics){
  RectAreaLightUniformsLib.init();
  const roadSurface=roadStrip(5.8);
  const puddles=pavement(scene,loader,roadSurface,filmTime);
  const shell=group(scene),rng=seed(74),finish=stationFinishes(loader);
  serviceBay(shell,scene,finish);
  // Low specular response keeps point lights from blooming into opaque disks on the shop windows.
  const glass=new T.MeshPhysicalMaterial({color:0xbac7c3,roughness:.32,metalness:0,specularIntensity:.1,
    transparent:true,opacity:.065,depthWrite:false,side:T.DoubleSide});
  shopInterior(shell,scene,loader);
  box(shell,0,1.48,7.4,10,2.96,.14,finish.wall);
  for(const s of [-1,1]){
    box(shell,s*5,1.48,3.7,.16,2.96,7.4,finish.wall);
    box(shell,s*3.04,.41,.02,3.92,.82,.14,trim);box(shell,s*3.04,1.81,0,3.92,1.97,.035,glass);
    wetPane(shell,s*3.04,1.81,-.019,3.92,1.97,s*3.04,filmTime,optics);
    // The fixed display windows cast shop light onto the forecourt. Keep
    // their emitting surfaces clear of the doors' swing and the push bars.
    const windowSpill=new T.RectAreaLight(0xffe6c7,2.3,2.1,1.62);
    windowSpill.position.set(s*3.04,1.81,-.05);scene.add(windowSpill);
    for(const x of [1.11,3.13,4.97])box(shell,s*x,1.42,0,.06,2.84,.13,metal);
    box(shell,s*3.04,.85,0,3.92,.06,.1,metal);
    box(shell,s*3.04,2.74,0,3.92,.17,.16,trim);
    for(let i=0;i<8;i++)box(shell,s*3.04,.07+i*.1,-.065,3.9,.018,.015,ivory);
  }
  box(shell,0,2.62,0,2.2,.37,.075,glass);box(shell,0,2.4,0,2.24,.06,.15,metal);
  paint(shell,0,2.67,.06,.54,.21,[['EXIT',.78,.5]],'#8a2a1e','#ffe4be');
  // Aluminum-framed door leaves rotate about their outer jambs.
  const doors=[];
  for(const s of [-1,1]){
    const door=group(scene,s*1.08,.086,0),cx=-s*.532;
    box(door,cx,1.14,0,1.01,2.21,.03,glass);
    wetPane(door,cx,1.14,-.016,1.01,2.21,s*.548,filmTime,optics);
    for(const x of [-s*.032,-s*1.034])box(door,x,1.14,0,.056,2.28,.07,metal);
    for(const y of [.08,2.25])box(door,cx,y,0,1.065,y<1?.16:.068,.075,metal);
    for(const x of [-s*.16,-s*.88])box(door,x,1.08,.072,.046,.058,.13,chrome);
    mesh(door,new RoundedBoxGeometry(.86,.063,.062,3,.011),metal,cx,1.08,.14);
    paint(door,cx,1.36,.024,.29,.084,[['P U S H',.65,.52]],'#dbd4b9');
    if(s===1)paint(door,cx,1.76,-.025,.45,.20,[['OPEN',.73,.51]],'#354940','#f1dbad',true);
    bake(door);doors.push(door);
  }
  const soffit=loader.load(roofMap);soffit.colorSpace=T.SRGBColorSpace;soffit.wrapS=soffit.wrapT=T.RepeatWrapping;soffit.repeat.set(4,4);
  box(shell,1.5,3.596,-7.55,10.18,.035,8.98,mat(0xaba28e,{map:soffit,roughness:.85}));
  for(const x of [-2.8,.07,3.64,6.2])box(shell,x,3.545,-7.55,.07,.10,8.9,trim);
  box(shell,1.5,3.77,-7.55,10.2,.31,9.0,ivory);
  for(const y of [3.76,3.85])box(shell,1.5,y,-7.55,10.23,.045,9.03,enamel);
  const curbMap=loader.load(concreteFile);curbMap.colorSpace=T.SRGBColorSpace;
  curbMap.wrapS=curbMap.wrapT=T.RepeatWrapping;curbMap.anisotropy=4;
  const island=mat(0xd9d8ca,{map:curbMap,roughness:.94});
  const curb=new RoundedBoxGeometry(1.19,.24,7.35,3,.055);
  const pos=curb.attributes.position,norm=curb.attributes.normal,uv=curb.attributes.uv;
  for(let i=0;i<pos.count;i++){
    const top=Math.abs(norm.getY(i))>.65,side=Math.abs(norm.getX(i))>.65;
    uv.setXY(i,(!top&&side?pos.getZ(i):pos.getX(i))*.56,(top?pos.getZ(i):pos.getY(i))*.56);
  }
  for(const x of [3.66,-2.87]){
    mesh(shell,curb,island,x,.048,-7.7);
    for(const z of [-5.5,-9.7]){
      box(shell,x,1.83,z,.18,3.56,.22,ivory);
      box(shell,x,.48,z,.205,.69,.245,trim);
      link(shell,[x,3.12,z],[x+.46,3.55,z],.045,.045,metal);
      link(shell,[x,3.12,z],[x-.46,3.55,z],.045,.045,metal);
      box(shell,x,3.47,z,.47,.085,1.41,trim);
      box(shell,x,1.1,z,.21,.25,.25,ivory);
      for(const dx of [-.13,.13]){
        link(shell,[x+dx,3.418,z-.61],[x+dx,3.418,z+.61],.018,.018,fluoro);
        for(const dz of [-.63,.63])box(shell,x+dx,3.432,z+dz,.06,.068,.06,ivory);
      }
    }
    pump(shell,x,-7.55,x>0?2:1,finish);
  }
  // Give the bright fixtures a finite emitting surface. The shadow-casting
  // fill still grounds the wheels, while the tubes draw narrow reflections.
  for(const x of [-2.87,3.66])for(const z of [-5.5,-9.7]){
    const strip=new T.RectAreaLight(0xffeed6,11,.28,1.22);
    strip.position.set(x,3.415,z);strip.rotation.x=-Math.PI/2;scene.add(strip);
  }
  const canopyLight=canopyLamp(scene,1.2,3.36,-6.9,0xdde0d5,36,16);
  canopyLight.castShadow=true;canopyLight.shadow.mapSize.set(512,512);canopyLight.shadow.bias=-.002;
  canopyLamp(scene,-2.3,3.27,-10.5,0xbbd6db,33,13);
  const sign=group(shell,-7.2,.02,-12.4);
  cylinder(sign,0,2.26,0,.115,.13,4.52,metal);
  box(sign,0,4.5,0,2.8,1.04,.19,enamel);
  const face=paint(sign,0,4.5,.105,2.67,.92,[['SIERRA',.47,.36],['M O T O R   O I L',.17,.76]],'#d0ba90','#942e1d');face.material.emissiveMap=face.material.map;face.material.emissive.set(0x8c7058);
  paint(sign,0,3.58,.08,1.75,.70,[['REGULAR',.23,.2],['49 ⁹',.58,.68]],'#d6c7a5');
  // Road edge, dashed centerline and ranch fencing.
  const road=loader.load(floorMap);road.colorSpace=T.SRGBColorSpace;road.wrapS=road.wrapT=T.RepeatWrapping;road.repeat.set(138,2);
  mesh(shell,roadSurface,wetPavementMaterial(0x686b68,{map:road,roughness:.63},filmTime),0,.013,0).rotation.x=-Math.PI/2;
  const line=mat(0xbeb995);
  for(let x=-213;x<216;x+=6){
    const dz=roadCenterZ(x+1.4)-roadCenterZ(x-1.4);
    box(shell,x,.017,roadCenterZ(x),Math.hypot(2.8,dz),.005,.085,line).rotation.y=-Math.atan2(dz,2.8);
  }
  mesh(shell,roadStrip(.075,2.72),line,0,.019,0).rotation.x=-Math.PI/2;
  const wood=mat(0x665643);
  for(let x=-154;x<=154;x+=3.5){
    const z=roadCenterZ(x)-4.2;
    box(shell,x,.61,z,.135,1.22,.13,wood).rotation.z=.035*(rng()-.5);
    for(const y of [.44,.83])link(shell,[x,y,z],[x+3.5,y-.016,roadCenterZ(x+3.5)-4.2],.006,.006,metal);
  }
  const turf=loader.load(pastureMap);turf.colorSpace=T.SRGBColorSpace;turf.wrapS=turf.wrapT=T.RepeatWrapping;turf.repeat.set(144,144);
  const paddock=new T.PlaneGeometry(576,576,192,192);
  paddock.rotateX(-Math.PI/2);
  const soil=paddock.attributes.position;
  for(let i=0;i<soil.count;i++)soil.setY(i,groundHeight(soil.getX(i),soil.getZ(i)));
  paddock.computeVertexNormals();
  mesh(scene,paddock,mat(0x888775,{map:turf,roughness:.87}));
  const blades=[],colors=[];
  for(let i=0;i<11200;i++){
    const x=(rng()-.5)*102;
    const verge=i<1450,z=roadCenterZ(x)+(verge?2.9+.07*Math.sin(x*1.3)+(rng()-.5)*.28:-3.1-rng()*37);
    const h=verge?(.03+rng()*.14)*(.45+.45*Math.sin(x*1.6)+.23*Math.cos(x*.4)):.09+rng()*.28;
    const base=verge?0:groundHeight(x,z);
    for(let j=0;j<4;j++){
      const a=rng()*Math.PI*2,bend=.03+rng()*.115,dx=Math.cos(a),dz=Math.sin(a);
      blades.push(x-.016*dz,base,z+.016*dx,x+.016*dz,base,z-.016*dx,x+bend*dx,base+h*(.67+rng()*.72),z+bend*dz);
      const tip=.20+rng()*.28;
      colors.push(.065,.071,.044,.11,.12,.065,tip*.86,tip,tip*.48);
    }
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(blades,3));geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));geom.computeVertexNormals();
  // Keep per-blade color attributes outside the rigid geometry batch.
  mesh(scene,geom,mat(0xb2ac83,{side:T.DoubleSide,vertexColors:true}));
  for(let i=0;i<8;i++){
    const x=-70+i*21,z=-47.2;
    cylinder(shell,x,3.3,z,.084,.14,6.6,wood);
    box(shell,x,6.2,z,1.82,.12,.12,wood);
    if(i<7)for(const d of [-.72,.72])tube(shell,[[x+d,6.35,z],[x+10+d,5.53,z],[x+21+d,6.35,z]],.016,rubber);
  }
  bake(shell);return {doors,puddles};
}
