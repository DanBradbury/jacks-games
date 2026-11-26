import * as T from 'three';
import {rain} from './rain.js';
import {optimizeFixtureLighting} from './fixture-lighting.js';
import {cameraLens,reflectionLayer} from './lens.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {station} from './station.js';
import {coupe} from './coupe.js';
import {hands} from './hands.js';
import {arrivalTime,encounter,flightPosition} from './encounter.js';
import {smooth} from './geometry.js';
import {orchard} from './orchard.js';
import {cloudSource, storm, streetLights} from './storm.js';
import landscape from './storm-shelf.webp';
import panorama from './moonless-golf.hdr?url';

// Timed Hermite interpolation keeps walking speed continuous at shot landmarks.
function track(keys,t,out){
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],p=keys[Math.max(0,i-1)],q=keys[Math.min(keys.length-1,i+2)];
  const dt=b[0]-a[0],u=T.MathUtils.clamp((t-a[0])/dt,0,1);
  for(let k=1;k<=3;k++){
    const v0=(b[k]-p[k])*dt/(b[0]-p[0]),v1=(q[k]-a[k])*dt/(q[0]-a[0]);
    out.setComponent(k-1,(2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*v0+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*v1);
  }
  return out;
}
const doorsFullyOpen=8.72;
// The entry is blocked in car coordinates. The walker steps back from the
// opening leaf, lowers below the roof rail, then slides across the sill.
function cameraTracks(car){
  function fromCar(keys){
    return keys.map(([t,x,y,z])=>[t,...car.localToWorld(new T.Vector3(x,y,z)).toArray()]);
  }
  const path=[[0,.15,1.58,5.57],[3.9,-.10,1.65,1.46],[6.1,0,1.60,.68],[7.1,0,1.56,.47],
    [8.3,0,1.58,-.22],[11,.06,1.65,-1.80],[14,.12,1.63,-3.65],...fromCar([
      [16.6,1.43,1.62,-1.92],[18.5,1.42,1.57,-.84],[19.6,1.27,1.40,-.55],
      [20.18,1.54,1.41,-.48],[20.88,1.86,1.42,-.36],[21.65,2.08,1.49,-.45],
      [22.13,1.93,1.45,-.65],[22.70,1.55,1.35,-.54],
      [23.6,1.01,1.17,-.24],[24.5,.62,1.075,-.17],[25.3,.375,1.09,-.33],
      [26.2,.62,1.085,-.18],[27.35,.45,1.12,-.23],[28.4,.33,1.13,-.42],
      [arrivalTime+.20,.33,1.13,-.42],[arrivalTime+.55,.33,1.118,-.416],
      [31.4,.33,1.105,-.33],[48,.33,1.105,-.33]])];
  const shipAt=t=>flightPosition(t,new T.Vector3()).toArray();
  const gaze=[[0,-.63,1.27,2.38],[1.7,-.57,1.37,.27],[3.4,.19,1.50,-2.4],[5.8,.035,1.14,-.28],
    [7.2,0,1.06,-.78],[9.2,.08,1.47,-3.5],[12,1.38,1.13,-6.1],...fromCar([
      [15,.64,.98,-.85],[17.8,.81,.81,-.49],[19.65,.81,.74,-.55],
      [20.7,1.44,.80,-.36],[21.65,1.1,.82,-.16],[23.1,.34,.74,.20],
      [24.75,.27,.90,.35],[25.65,.70,.90,.35],[26.4,1.15,.71,-.08],
      [27.35,.79,.74,-.10],[28.35,.37,.995,.54],[28.95,.34,1.105,1.10],
      [arrivalTime+.18,.34,1.105,1.10]]),
    [30.16,...shipAt(29.93)],[31.3,...shipAt(31.06)],[32.85,...shipAt(32.6)],
    [34.8,-3.1,6.3,-29.8],[36.4,-3.1,1.65,-29.8],
    [39,-3.1,3.9,-29.8],[42.6,-3.1,6.25,-29.8],[44.1,-3.1,7.5,-29.8],
    [46.7,-15,13,-47],[48,-14,12,-47]];
  // Interpolate gaze directions on a consistent radius. Switching from a
  // nearby dashboard target to a distant craft otherwise whips the view.
  for(const key of gaze){
    if(key[0]<28.35)continue;
    const eye=track(path,key[0],new T.Vector3());
    const target=new T.Vector3(key[1],key[2],key[3]).sub(eye).normalize().add(eye);
    [key[1],key[2],key[3]]=target.toArray();
  }
  return {path,gaze};
}
export async function createScene(container,{pixelRatio}={}){
  const renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  container.replaceChildren(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(62,1,.035,240);
  camera.rotation.order='YXZ';
  const manager=new T.LoadingManager(),loader=new T.TextureLoader(manager);
  let resolveTextures,rejectTextures;
  const texturesReady=new Promise((res,rej)=>{resolveTextures=res;rejectTextures=rej});
  manager.onLoad=resolveTextures;manager.onError=url=>rejectTextures(new Error('Texture unavailable: '+url));
  const skyLoaded=new HDRLoader().loadAsync(panorama);
  scene.fog=new T.FogExp2(0x33343d,.028);
  scene.add(new T.HemisphereLight(0x9faec1,0x675c50,.19));
  const moon=new T.DirectionalLight(0xb2c2d3,.12);moon.position.set(-15,22,-27);scene.add(moon);
  const flash={value:0},filmTime={value:0};
  const lens=cameraLens(renderer);
  const {doors,puddles,probeMaterials}=station(scene,loader,filmTime,lens.optics);
  puddles.layers.set(reflectionLayer);camera.layers.enable(reflectionLayer);
  const {car,hinge,lever,pulls,capture}=coupe(scene,loader,filmTime,lens.optics);
  const {path,gaze}=cameraTracks(car);
  orchard(scene,loader,flash,cloudSource,filmTime);
  const skyCue={position:new T.Vector3(),width:new T.Vector2(1,1),radiance:new T.Color(0)};
  const animateStorm=storm(scene,flash,skyCue,doorsFullyOpen+.16);
  streetLights(scene);
  const handsLoaded=hands(scene,doors,car,pulls),field=encounter(scene,loader);
  rain(scene,filmTime,flash,camera,field.beam,lens.optics);
  const horizon=loader.load(landscape);horizon.colorSpace=T.SRGBColorSpace;horizon.wrapS=T.MirroredRepeatWrapping;
  const skyDome=new T.Mesh(new T.SphereGeometry(182,96,40),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:{plate:{value:horizon},flash,source:{value:cloudSource},mist:{value:scene.fog.color},
      cuePosition:{value:skyCue.position},cueWidth:{value:skyCue.width},cueRadiance:{value:skyCue.radiance}},
    vertexShader:`varying vec3 d;void main(){d=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 d;uniform sampler2D plate;uniform float flash;uniform vec3 source,mist,cuePosition,cueRadiance;uniform vec2 cueWidth;
    void main(){vec3 n=normalize(d);
      // Only sample the cloud bank. All tree occlusion comes from world geometry.
      // One mirrored pair closes the full circle at the longitude seam.
      vec2 uv=vec2(.40+atan(n.x,-n.z)/3.14159265,clamp(.068+asin(n.y)/1.15,.03,.998));
      vec3 clouds=texture2D(plate,uv).rgb;
      vec3 axis=normalize(source-cameraPosition);
      vec2 offset=vec2(atan(n.x,-n.z)-atan(axis.x,-axis.z),n.y-axis.y);
      float pocket=exp(-dot(offset*vec2(4.7,8.5),offset*vec2(4.7,8.5)));
      float sheet=exp(-dot(offset*2.4,offset*2.4));
      // Far trees and the low sky share the storm's horizon light.
      vec3 sky=mix(mist,clouds*vec3(.44,.405,.39),.88*smoothstep(-.02,.54,n.y));
      float vapor=dot(clouds,vec3(.21,.72,.07));
      sky+=flash*vec3(.78,.86,1.)*(vapor*(.12+1.8*sheet+7.*pocket)+.038*pocket);
      if(any(greaterThan(cueRadiance,vec3(.001)))){
        vec3 center=normalize(cuePosition-cameraPosition);
        vec3 east=normalize(cross(center,vec3(0.,1.,0.)));
        vec2 local=vec2(dot(n,east),dot(n,cross(east,center)))/cueWidth;
        float halo=exp(-dot(local,local));
        sky+=cueRadiance*halo*(.20+2.8*vapor)*smoothstep(.8,.95,dot(n,center));
      }
      gl_FragColor=vec4(sky,1.);
      #include <colorspace_fragment>
    }`
  }));
  skyDome.renderOrder=1;scene.add(skyDome);
  const [sky,,animateHands]=await Promise.all([skyLoaded,texturesReady,handsLoaded]);
  optimizeFixtureLighting(scene);
  sky.mapping=T.EquirectangularReflectionMapping;scene.environment=sky;scene.environmentIntensity=.30;
  scene.background=sky;scene.backgroundIntensity=.48;scene.backgroundRotation.y=1.8;scene.environmentRotation.y=1.8;
  field.alloy.envMap=sky;field.alloy.envMapIntensity=.83;
  field.alloy.envMapRotation.copy(scene.environmentRotation);
  // Capture canopy strips, pumps and sky from hood height for local paint reflections.
  const envTarget=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType});
  const probe=new T.CubeCamera(.1,200,envTarget);probe.position.copy(car.position);probe.position.y=1.08;
  field.animate(0);animateStorm(0);
  car.visible=false;puddles.visible=false;
  probe.update(renderer,scene);
  car.visible=true;puddles.visible=true;
  scene.background=null; // The skydome covers the playback camera in every direction.
  renderer.shadowMap.needsUpdate=true;
  const pmrem=new T.PMREMGenerator(renderer);
  const carEnvironment=pmrem.fromCubemap(envTarget.texture);
  const finishes=new Map();
  car.traverse(o=>{
    if(!o.isMesh||!o.material.isMeshStandardMaterial)return;
    if(!o.material.isMeshPhysicalMaterial&&o.material.metalness<.4)return;
    if(!finishes.has(o.material)){
      const finish=o.material.clone();finish.onBeforeCompile=o.material.onBeforeCompile;
      finish.customProgramCacheKey=o.material.customProgramCacheKey;
      finish.envMap=carEnvironment.texture;
      finish.envMapIntensity=.54;finishes.set(o.material,finish);
    }
    o.material=finishes.get(o.material);
  });
  // Capture the shop once. Brushed hardware, bottles and wax pick up the
  // actual fluorescent bays, counter and dark window openings.
  puddles.visible=false;capture(renderer,scene);probe.position.set(.1,1.42,3.15);
  probe.update(renderer,scene);puddles.visible=true;
  const shopEnvironment=pmrem.fromCubemap(envTarget.texture);
  for(const material of probeMaterials){
    material.envMap=shopEnvironment.texture;material.envMapIntensity=.82;
    material.needsUpdate=true;
  }
  renderer.shadowMap.needsUpdate=true;
  envTarget.dispose();pmrem.dispose();
  const pos=new T.Vector3(),aim=new T.Vector3();
  const stage={craft:0,thunder:0},right=new T.Vector3(),soundDirection=new T.Vector3();
  function stereoPosition(source){
    return soundDirection.copy(source).sub(camera.position).normalize().dot(right);
  }
  // Ripple normals animate every frame. Reuse the projected scene underneath
  // between captures, refreshing immediately on seeks, turns and lightning.
  let captureReflection=true,lastCapture=-Infinity;
  const reflectedPose=new T.Quaternion();
  const reflect=puddles.onBeforeRender;
  puddles.onBeforeRender=function(renderer,scene,view){
    if(!captureReflection)return;
    reflect.call(this,renderer,scene,view);
    lastCapture=filmTime.value;reflectedPose.copy(view.quaternion);
  };
  function resize(){
    const w=container.clientWidth,h=container.clientHeight;
    if(!w||!h)return;
    const ratio=pixelRatio??Math.min(window.devicePixelRatio,1.5,Math.sqrt(1050000/(w*h)));
    renderer.setDrawingBufferSize(w,h,ratio);lastCapture=-Infinity;
    lens.resize(renderer.domElement.width,renderer.domElement.height);camera.aspect=w/h;
    camera.fov=w<h?76:65;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);resize();
  await lens.prepare(scene,camera);
  return (t,lookX=0,lookY=0,playingFrame=false)=>{
    track(path,t,pos);track(gaze,t,aim);
    camera.position.copy(pos);
    camera.lookAt(aim);
    // Weight transfer during the walk settles as the viewer stops at the road.
    const stride=t*5.05,walk=1-smooth(17.6,19.2,t);
    camera.translateX(.009*Math.sin(stride)*walk);
    camera.position.y+=.008*Math.cos(2*stride)*walk;
    camera.rotation.z+=.0027*Math.sin(stride+.36)*walk;
    camera.rotation.y+=lookX;camera.rotation.x+=lookY;
    filmTime.value=t;animateStorm(t);

    const angle=smooth(6.05,doorsFullyOpen,t)*1.43*(1-smooth(10.4,14.8,t));
    doors[0].rotation.y=angle;doors[1].rotation.y=-angle;
    // Hold at the check strap until the seated driver takes the pull. The
    // door gathers speed and meets its rubber seal on the recorded latch.
    const opened=smooth(19.73,21.28,t);
    const close=T.MathUtils.clamp((t-26.49)/.98,0,1);
    hinge.rotation.y=-.91*opened*(1-.08*smooth(26.32,26.66,t)-.92*close**1.55);
    lever.rotation.z=.54*smooth(19.48,19.73,t)*(1-smooth(20.85,21.08,t));
    camera.rotation.z+=.071*smooth(22.15,23.55,t)*(1-smooth(23.8,25.5,t));
    camera.updateMatrixWorld();
    animateHands(t,camera);
    const craftPosition=field.animate(t);
    // The running lights catch the trailing cloud edge as the craft breaks
    // through. Use the textured sky so the glow follows the cloud contours.
    if(t>28.5&&t<30.4){
      flightPosition(t-.12,skyCue.position);
      const scatter=smooth(28.5,29.28,t)*(1-smooth(29.45,30.4,t));
      skyCue.width.set(.080,.027);
      skyCue.radiance.setRGB(.052,.11,.23).multiplyScalar(scatter);
    }
    // Ease into a closer windshield framing as the craft settles above the cow.
    const fov=(camera.aspect<1?76:65)-10*smooth(32.5,36.4,t);
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix()}
    right.setFromMatrixColumn(camera.matrixWorld,0);
    stage.craft=.84*stereoPosition(craftPosition);
    stage.thunder=.35*stereoPosition(cloudSource);
    captureReflection=!playingFrame||t-lastCapture>=.10||flash.value>.005||skyCue.radiance.b>.005||
      reflectedPose.angleTo(camera.quaternion)>.065;
    lens.draw(scene,camera);
    return stage;
  };
}
