import * as T from 'three';
import {rain} from './rain.js';
import {optimizeFixtureLighting} from './fixture-lighting.js';
import {cameraLens} from './lens.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {station} from './station.js';
import {coupe} from './coupe.js';
import {hands} from './hands.js';
import {encounter} from './encounter.js';
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
const path=[[0,.15,1.58,5.57],[3.9,-.10,1.65,1.46],[6.1,0,1.60,.68],[7.1,0,1.56,.47],[8.3,0,1.58,-.22],[11,.06,1.65,-1.80],[14,-.40,1.65,-3.64],[17,-.93,1.65,-5.15],[20,-1.29,1.65,-7.20],[24,-1.24,1.65,-10.20],[28,-.83,1.65,-12.23],[32,-.68,1.66,-13.1],[48,-.68,1.66,-13.1]];
const gaze=[[0,-.63,1.27,2.38],[1.7,-.57,1.37,.27],[3.4,.19,1.50,-2.4],[5.8,.035,1.14,-.28],[7.2,0,1.06,-.78],[9.2,.08,1.47,-3.5],[12,1.38,1.13,-6.1],[15,1.81,.85,-6.7],[18.6,1.97,.78,-7.40],[21.0,2.05,1.00,-7.00],[23.5,2.55,1.13,-9.45],[25.7,1.63,1.40,-15.3],[28,-3.4,1.37,-29.5],[30.2,6.0,6.9,-35.0],[32.5,7.1,8.6,-37.0],[34.8,-3.1,5.6,-29.8],[37,-3.1,3.5,-29.8],[42,-3.1,5.7,-29.8],[44,-3.1,7.2,-29.8],[46.6,-15.8,13.9,-46.1],[48,-14,12.4,-47]];
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
  const {doors,puddles,probeMaterials}=station(scene,loader,filmTime,lens.optics),car=coupe(scene,loader);
  orchard(scene,loader,flash,cloudSource,filmTime);
  const skyCue={position:new T.Vector3(),width:new T.Vector2(1,1),radiance:new T.Color(0)};
  const animateStorm=storm(scene,flash,skyCue,doorsFullyOpen+.16);
  streetLights(scene);
  const handsLoaded=hands(scene,doors),field=encounter(scene,loader);
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
  puddles.visible=false;probe.position.set(.1,1.42,3.15);
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
    const stride=t*5.05,walk=1-smooth(25,29,t);
    camera.translateX(.009*Math.sin(stride)*walk);
    camera.position.y+=.008*Math.cos(2*stride)*walk;
    camera.rotation.z+=.0027*Math.sin(stride+.36)*walk;
    camera.rotation.y+=lookX;camera.rotation.x+=lookY;
    filmTime.value=t;animateStorm(t);

    const angle=smooth(6.05,doorsFullyOpen,t)*1.43*(1-smooth(10.4,14.8,t));
    doors[0].rotation.y=angle;doors[1].rotation.y=-angle;
    camera.updateMatrixWorld();
    animateHands(t,camera);
    const craftPosition=field.animate(t);
    right.setFromMatrixColumn(camera.matrixWorld,0);
    stage.craft=.84*stereoPosition(craftPosition);
    stage.thunder=.35*stereoPosition(cloudSource);
    captureReflection=!playingFrame||t-lastCapture>=.10||flash.value>.005||skyCue.radiance.b>.005||
      reflectedPose.angleTo(camera.quaternion)>.065;
    lens.draw(scene,camera);
    return stage;
  };
}
