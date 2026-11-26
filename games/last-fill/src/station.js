import * as T from 'three';
import {groundHeight,roadCenterZ} from './orchard.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {group,mesh,mat,metal,rubber,chrome,box,oval,link,tube,cylinder,paint,bake,seed} from './geometry.js';
import concreteFile from '../../night-shift/src/scans/concrete_floor_damaged_01_Diffuse.jpg';
import floorMap from './worn_asphalt.jpg';
import pastureMap from './rocky_terrain_02.jpg';
import roofMap from './canopy-panels.webp';
import concreteNormal from '../../night-shift/src/scans/concrete_floor_damaged_01_nor_gl.jpg';
import concreteRough from '../../night-shift/src/scans/concrete_floor_damaged_01_Rough.jpg';
import jointsFile from './apron-joints.webp';
import gravelColor from './gravel-diff.jpg';
import gravelNormal from './gravel-nor_gl.jpg';
import gravelResponse from './gravel-arm.jpg';
import {roomLightUVs} from './shop-surfaces.js';
import {shopInterior} from './shop.js';
import {stationFinishes,serviceBay,cladWall} from './service-bay.js';
import {roadsideSign} from './roadside-sign.js';
import {weather} from './finish.js';
import {wetPane} from './rain.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import floorNormal from './asphalt-normal.jpg';

const ivory=mat(0xb8b6a1),enamel=mat(0xa53d29,{roughness:.63}),trim=mat(0x425047,{metalness:.22,roughness:.66}),fluoro=mat(0xc5cdc5,{emissive:0xeaf4e9,emissiveIntensity:1.85});
[ivory,enamel,trim].forEach(m=>weather(m,.86));
const postRows=[-2.87,3.66],postBays=[-5.5,-9.7];
const fixtureX=post=>post+(post<0?.90:-.90);

function canopyCeiling(map){
  // A little light returns from the concrete and spills around the ends of
  // the reflector. Store that static irradiance on the underside only.
  const res=64,data=new Uint8Array(res*res*4);
  for(let y=0;y<res;y++)for(let x=0;x<res;x++){
    const worldX=1.5+((x+.5)/res-.5)*10.18;
    const worldZ=-7.55+((y+.5)/res-.5)*8.98;
    let bounce=.07;
    for(const post of postRows)for(const bay of postBays){
      const dx=worldX-fixtureX(post),dz=worldZ-bay;
      const pastTubeEnd=Math.max(0,Math.abs(dz)-.61);
      bounce+=.13/(1+.24*(dx*dx+dz*dz))+.40*Math.exp(-2*dx*dx-2*pastTubeEnd*pastTubeEnd);
    }
    const i=(y*res+x)*4;
    data[i]=bounce*246;data[i+1]=bounce*240;data[i+2]=bounce*219;data[i+3]=255;
  }
  const lightMap=new T.DataTexture(data,res,res);
  lightMap.channel=0;lightMap.magFilter=lightMap.minFilter=T.LinearFilter;lightMap.needsUpdate=true;
  return mat(0xd2d0c7,{map,roughness:.85,lightMap,lightMapIntensity:2.65});
}

function pump(p,x,z,n,finish){
  const plinth=group(p,x,.168,z);
  mesh(plinth,new RoundedBoxGeometry(1.06,.086,1.13,2,.024),finish.foot,0,.043,0);
  const g=group(plinth,0,.082,0);g.rotation.y=x>0?-.89:.59;
  mesh(g,new RoundedBoxGeometry(.80,1.03,.56,3,.018),finish.pumpRed,0,.525,0);
  box(g,0,1.045,0,.816,.018,.57,finish.gasket);
  mesh(g,new RoundedBoxGeometry(.88,.80,.60,3,.042),finish.pumpCream,0,1.45,0);
  mesh(g,new RoundedBoxGeometry(.91,.058,.63,2,.015),finish.pumpRed,0,1.861,0);
  function badge(parent,x,y,z,w,h,lines,bg,ink){
    const label=paint(parent,x,y,z,w,h,lines,bg,ink);
    label.material.color.setHex(0xc3bead);label.material.roughness=1;
    label.material.bumpMap=label.material.roughnessMap=finish.enamelResponse;
    label.material.bumpScale=.00012;
  }
  for(const side of [-1,1]){
    const front=group(g);front.rotation.y=side<0?Math.PI:0;
    mesh(front,new RoundedBoxGeometry(.754,.518,.015,2,.008),finish.gasket,0,1.49,.303);
    mesh(front,new T.PlaneGeometry(.732,.496),finish.meter,0,1.49,.312);
    badge(front,0,1.16,.302,.50,.096,[['LEADED  MOTOR  FUEL',.31,.27],['MINIMUM OCTANE  87',.25,.72]],'#b4ab8e');
    // Removable service door: folded lip, recessed latch and captive screws.
    box(front,0,.54,.281,.724,.867,.005,finish.gasket);
    mesh(front,new RoundedBoxGeometry(.716,.858,.012,2,.005),finish.pumpRed,0,.54,.286);
    box(front,.272,.854,.294,.056,.025,.009,finish.gasket);
    for(const x of [-.325,.325])for(const y of [.148,.928]){
      const stud=cylinder(front,x,y,.294,.006,.006,.004,metal,10);
      stud.rotation.x=Math.PI/2;
    }
    for(let k=0;k<8;k++)box(front,-.237+k*.068,.921,.294,.044,.014,.004,finish.gasket);
    badge(front,0,.70,.294,.49,.21,[['REGULAR',.38,.56]],'#bdb299','#903e31');
    badge(front,0,1.782,.301,.54,.073,[['S I E R R A    O I L',.61,.53]],'#bdb299','#623d32');
  }
  tube(g,[[.44,1.67,0],[.66,1.23,.06],[.68,.29,.10],[.53,.25,.25],[.49,1.14,.19]],.032,rubber);
  box(g,.410,1.21,.12,.055,.21,.135,finish.gasket);
  tube(g,[[.49,1.10,.20],[.554,1.122,.207],[.572,1.185,.175],[.515,1.246,.144]],.012,metal);
  link(g,[.47,1.06,.2],[.51,1.28,.13],.048,.054,trim);
  link(g,[.51,1.28,.13],[.43,1.41,.06],.022,.025,chrome);
  box(g,0,1.91,.285,.18,.15,.026,finish.pumpRed);
  badge(g,0,1.91,.30,.17,.14,[[String(n),.75,.53]],'#9d3927','#f8eccc');
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
  uniform sampler2D slabWear;
  vec3 pavementWear(vec2 p){
    vec2 uv=(p-vec2(-5.2,-.10))/vec2(13.1,-13.7);
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec3(0.,0.,noiseAt(p*.63));
    return texture2D(slabWear,uv).rgb;
  }
  float pooledWater(vec2 p,float exposure,vec3 wear){
    // Wind wets the margins. Tires also carry water under the roof,
    // where it stays in low spots and drains into the expansion joints.
    float tracks=exp(-pow(abs(abs(p.x-.85)-.80)/.48,2.));
    float supply=mix(.19+.30*tracks,1.,exposure);
    float basin=.75*wear.b+.25*noiseAt(p*1.73);
    return supply*smoothstep(.58-.20*supply,.75-.15*supply,basin+wear.g*.14);
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

function wetPavementMaterial(color,props,filmTime,wear){
  const surface=mat(color,props);
  surface.onBeforeCompile=shader=>{
    shader.uniforms.clock=filmTime;shader.uniforms.slabWear={value:wear};
    shader.vertexShader='varying vec2 land;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nland=(modelMatrix*vec4(position,1.)).xz;');
    shader.fragmentShader='varying vec2 land;\n'+surfaceRain+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 wear=pavementWear(land);
      float waterFilm=pooledWater(land,exposureAt(land),wear);
      diffuseColor.rgb*=1.-.32*waterFilm-.45*wear.r;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.25,1.17,1.09),wear.g*(1.-wear.r));`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.26,waterFilm);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 slope=rainSlope(land)*waterFilm;
        normal=normalize(normal+mat3(viewMatrix)*vec3(-slope.x,0.,-slope.y));`);
  };
  return surface;
}

function pavement(scene,loader,roadSurface,filmTime,wear){
  const diffuse=loader.load(floorMap),normal=loader.load(floorNormal);
  for(const t of [diffuse,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(12,10);t.anisotropy=4}
  diffuse.colorSpace=T.SRGBColorSpace;
  const lot=new T.PlaneGeometry(36,29.1).translate(0,.55,0);
  const base=mesh(scene,lot,wetPavementMaterial(0x605e58,{map:diffuse,normalMap:normal,roughness:.86,normalScale:new T.Vector2(.40,.40)},filmTime,wear),0,-.009,0);
  base.rotation.x=-Math.PI/2;
  const slab=loader.load(concreteFile),relief=loader.load(concreteNormal),rough=loader.load(concreteRough);
  slab.colorSpace=T.SRGBColorSpace;
  for(const map of [slab,relief,rough]){
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4.4,4.6);map.anisotropy=8;
  }
  const apron=mesh(scene,new T.PlaneGeometry(13.1,13.7),
    wetPavementMaterial(0xc4bfb4,{map:slab,normalMap:relief,normalScale:new T.Vector2(.67,.67),
      roughnessMap:rough,roughness:.96},filmTime,wear),1.35,-.003,-6.95);
  apron.rotation.x=-Math.PI/2;
  const shader=Reflector.ReflectorShader;
  const wet=new Reflector(mergeGeometries([lot,roadSurface]),{textureWidth:768,textureHeight:448,multisample:0,clipBias:.004,shader:{
    uniforms:{...shader.uniforms,relief:{value:null},slabWear:{value:wear},clock:{value:0},fogDensity:{value:scene.fog.density}},
    vertexShader:shader.vertexShader.replace('uniform mat4 textureMatrix;','uniform mat4 textureMatrix; varying vec3 groundPoint;').replace('vUv =','groundPoint=(modelMatrix*vec4(position,1.)).xyz; vUv ='),
    fragmentShader:surfaceRain+`uniform sampler2D tDiffuse,relief;uniform float fogDensity;varying vec4 vUv;varying vec3 groundPoint;
    void main(){vec2 land=groundPoint.xz;
      vec2 n=texture2D(relief,land*.37).rg-.5;
      // Wind-driven rain reaches the edges of the canopy and shop entrance.
      float exposure=exposureAt(land);
      vec2 shopEdge=abs(land-vec2(0.,3.7))-vec2(5.,3.7);
      float outdoors=smoothstep(-.12,.35,max(shopEdge.x,shopEdge.y));
      float damp=pooledWater(land,exposure,pavementWear(land));
      float wetness=outdoors*damp;
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
      gl_FragColor=vec4(r,wetness*fresnel*.72*visibility);
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
  const wear=loader.load(jointsFile);wear.anisotropy=8;
  const puddles=pavement(scene,loader,roadSurface,filmTime,wear);
  const shell=group(scene),rng=seed(74),finish=stationFinishes(loader,filmTime);
  serviceBay(shell,scene,finish);
  // Low specular response keeps point lights from blooming into opaque disks on the shop windows.
  const glass=new T.MeshPhysicalMaterial({color:0xbac7c3,roughness:.32,metalness:0,specularIntensity:.1,
    transparent:true,opacity:.065,depthWrite:false,side:T.DoubleSide});
  const {probeMaterials,doorMetal}=shopInterior(shell,scene,loader);
  probeMaterials.push(doorMetal);
  cladWall(shell,0,1.48,7.4,10,2.96,.14,finish.storeWall);
  // Full-width structural head bridges the transom and both window bays.
  box(shell,0,2.896,0,10.04,.204,.168,trim);
  for(const s of [-1,1]){
    cladWall(shell,s*5,1.48,3.7,.16,2.96,7.4,finish.storeWall);
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
    for(const x of [-s*.032,-s*1.034])box(door,x,1.14,0,.056,2.28,.07,doorMetal);
    for(const y of [.08,2.25])box(door,cx,y,0,1.065,y<1?.16:.068,.075,doorMetal);
    for(const x of [-s*.16,-s*.88])box(door,x,1.08,.072,.046,.058,.13,chrome);
    mesh(door,new RoundedBoxGeometry(.86,.063,.062,3,.011),doorMetal,cx,1.08,.14);
    paint(door,cx,1.36,.024,.29,.084,[['P U S H',.65,.52]],'#dbd4b9');
    if(s===1)paint(door,cx,1.76,-.025,.45,.20,[['OPEN',.73,.51]],'#354940','#f1dbad',true);
    bake(door);doors.push(door);
  }
  const soffit=loader.load(roofMap);soffit.colorSpace=T.SRGBColorSpace;soffit.anisotropy=8;
  box(shell,1.5,3.596,-7.55,10.18,.035,8.98,canopyCeiling(soffit));
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
  for(const x of postRows){
    mesh(shell,curb,island,x,.048,-7.7);
    for(const z of postBays){
      box(shell,x,1.83,z,.18,3.56,.22,ivory);
      box(shell,x,.48,z,.205,.69,.245,trim);
      box(shell,x,.18,z,.285,.024,.327,finish.foot);
      for(const dx of [-.117,.117])for(const dz of [-.141,.141])
        cylinder(shell,x+dx,.20,z+dz,.012,.014,.018,metal,6);
      const lampX=fixtureX(x);
      link(shell,[x,3.12,z],[x+.46,3.55,z],.035,.035,trim);
      link(shell,[x,3.12,z],[x-.46,3.55,z],.035,.035,trim);
      box(shell,lampX,3.505,z,.37,.14,1.38,trim);
      box(shell,lampX,3.431,z,.30,.012,1.30,ivory);
      box(shell,x,1.1,z,.21,.25,.25,ivory);
      for(const dx of [-.087,.087]){
        link(shell,[lampX+dx,3.409,z-.61],[lampX+dx,3.409,z+.61],.018,.018,fluoro);
        for(const dz of [-.63,.63])box(shell,lampX+dx,3.414,z+dz,.06,.068,.06,ivory);
      }
      const strip=new T.RectAreaLight(0xe3eee3,26,.25,1.22);
      strip.position.set(lampX,3.405,z);strip.rotation.x=-Math.PI/2;scene.add(strip);
      // Shadowed contribution from the near ballast bay anchors the car and
      // islands. The broad penumbra follows the cutoff of the steel reflector.
      if(x>0&&z===-5.5){
        const lamp=new T.SpotLight(0xe3eee3,4.6,12,1.06,.76,2);
        lamp.position.copy(strip.position);lamp.target.position.set(lampX-.36,0,z-.4);
        lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);
        lamp.shadow.camera.near=.25;lamp.shadow.bias=-.0007;lamp.shadow.normalBias=.014;
        scene.add(lamp,lamp.target);
      }
    }
    pump(shell,x,-7.55,x>0?2:1,finish);
  }
  roadsideSign(shell,loader,filmTime,island);
  // Road edge, dashed centerline and ranch fencing.
  const road=loader.load(floorMap);road.colorSpace=T.SRGBColorSpace;road.wrapS=road.wrapT=T.RepeatWrapping;road.repeat.set(138,2);
  mesh(shell,roadSurface,wetPavementMaterial(0x686b68,{map:road,roughness:.77},filmTime,wear),0,.013,0).rotation.x=-Math.PI/2;
  // Loose aggregate collects at the crumbling edge of the pavement.
  const gravel=loader.load(gravelColor),grit=loader.load(gravelNormal),arm=loader.load(gravelResponse);
  gravel.colorSpace=T.SRGBColorSpace;
  for(const map of [gravel,grit,arm]){
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=6;
  }
  const shoulder=mat(0x9d9a95,{map:gravel,normalMap:grit,normalScale:new T.Vector2(.72,.72),
    aoMap:arm,roughnessMap:arm,roughness:.89});
  shoulder.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 p=vMapUv/.91;
      float center=-18.+sign(p.x)*17.*smoothstep(30.,144.,abs(p.x));
      float driveway=(1.-smoothstep(3.,10.,abs(p.x)))*step(center,p.y);
      float bank=texture2D(roughnessMap,p*.14).r;
      float aggregate=texture2D(roughnessMap,vMapUv).r;
      float edge=.28+.27*sin(p.x*1.27)+.16*cos(p.x*3.72)+.34*bank-.25*driveway;
      if(abs(p.y-center)-2.88>edge+.27*(aggregate-.5))discard;
      diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.21,.72,.07))),diffuseColor.rgb,.58)*(.55+.22*bank);`);
  };
  for(const side of [-1,1]){
    const strip=roadStrip(1,side*3.38),pos=strip.attributes.position,uv=strip.attributes.uv;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=-pos.getY(i);
      uv.setXY(i,x*.91,z*.91);
    }
    mesh(shell,strip,shoulder,0,.009,0).rotation.x=-Math.PI/2;
  }
  const line=mat(0xc8bf9e,{roughness:.88});
  line.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 stripePoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nstripePoint=(modelMatrix*vec4(transformed,1.)).xz;');
    shader.fragmentShader='varying vec2 stripePoint;uniform sampler2D roadGrain;\n'+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        float abrasion=texture2D(roadGrain,stripePoint*.82).r;
        diffuseColor.rgb*=.26+.74*smoothstep(.020,.089,abrasion);`);
    shader.uniforms.roadGrain={value:road};
  };
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
    const verge=i<1450,z=roadCenterZ(x)+(verge?3.38+.22*Math.sin(x*1.3)+(rng()-.5)*.48:-3.1-rng()*37);
    const h=verge?(.03+rng()*.18)*Math.max(.1,.51+.42*Math.sin(x*1.6)+.21*Math.cos(x*.4)):.09+rng()*.28;
    const base=verge?0:groundHeight(x,z);
    for(let j=0;j<4;j++){
      const a=rng()*Math.PI*2,bend=.03+rng()*.115,dx=Math.cos(a),dz=Math.sin(a);
      const tall=h*(.67+rng()*.72);
      const tip=.20+rng()*.28;
      const rootA=[x-.013*dz,base,z+.013*dx],rootB=[x+.013*dz,base,z-.013*dx];
      const end=[x+bend*dx+.019,base+tall,z+bend*dz];
      if(verge){
        const knee=[x+.33*bend*dx,base+tall*.70,z+.33*bend*dz];
        blades.push(...rootA,...rootB,...knee,...rootB,...end,...knee);
        colors.push(.05,.053,.025,.08,.087,.042,.22,.21,.085,.08,.087,.042,tip,tip*.90,tip*.49,.22,.21,.085);
      }else{
        blades.push(...rootA,...rootB,...end);
        colors.push(.065,.071,.044,.11,.12,.065,tip*.86,tip,tip*.48);
      }
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
  bake(shell);roomLightUVs(shell);return {doors,puddles,probeMaterials};
}
