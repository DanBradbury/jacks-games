import * as T from 'three';
import {group,mat,box,link,oval,cylinder,tube,mesh,metal,rubber} from './geometry.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import atlasFile from './station-atlas.jpg';
import blockColor from './garage-block-color.webp';
import blockNormal from './garage-block-normal.webp';
import renderColor from './station-render-color.webp';
import renderNormal from './station-render-normal.webp';
import rainwearFile from './forecourt-rainwear.webp';
import enamelColor from './forecourt-enamel.webp';
import enamelResponse from './forecourt-enamel-response.webp';
import {weather} from './finish.js';

// Give every face the same physical texel density, including the short returns.
export function cladWall(parent,x,y,z,w,h,d,material){
  const g=new T.BoxGeometry(w,h,d),{position,normal,uv}=g.attributes;
  for(let i=0;i<uv.count;i++){
    const px=position.getX(i),py=position.getY(i),pz=position.getZ(i);
    const horizontal=Math.abs(normal.getX(i))>.5?pz:px;
    const vertical=Math.abs(normal.getY(i))>.5?pz:py+y;
    uv.setXY(i,horizontal/1.60,vertical/1.60);
  }
  return mesh(parent,g,material,x,y,z);
}

function masonry(loader,colorFile,normalFile,strength,rainwear){
  const map=loader.load(colorFile),normalMap=loader.load(normalFile);
  map.colorSpace=T.SRGBColorSpace;
  for(const texture of [map,normalMap]){
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;
  }
  const material=mat(0xffffff,{map,normalMap,normalScale:new T.Vector2(strength,strength),roughness:.90});
  material.onBeforeCompile=shader=>{
    shader.uniforms.wallWeather={value:rainwear};
    shader.vertexShader='varying vec3 wallPoint;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nwallPoint=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='uniform sampler2D wallWeather; varying vec3 wallPoint;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float along=wallPoint.x+wallPoint.z*.91;
      vec2 elevation=vec2(along/8.6,clamp(wallPoint.y/3.16,0.,1.));
      diffuseColor.rgb*=texture2D(wallWeather,elevation).rgb;
      float run=.5+.5*sin(along*4.1+1.5*sin(along*7.3));
      float damp=1.-smoothstep(.22,.57+run*.29,wallPoint.y);
      float drip=pow(run,5.)*smoothstep(2.48,3.22,wallPoint.y);
      diffuseColor.rgb*=1.-.31*damp-.12*drip;`);
  };
  return material;
}

// Water changes the pigment and specular response in the same drainage tracks.
export function wetSign(material,filmTime){
  material.color.multiplyScalar(.60);material.roughness=.81;
  material.onBeforeCompile=shader=>{
    shader.uniforms.rainTime=filmTime;
    shader.vertexShader='varying vec2 signUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nsignUv=uv;');
    shader.fragmentShader='varying vec2 signUv; uniform float rainTime;\n'+shader.fragmentShader
      .replace('#include <map_fragment>',`#include <map_fragment>
        vec2 st=signUv;
        float lane=st.x*57.+.09*sin(st.y*11.+st.x*63.);
        float column=floor(lane);
        float seed=fract(sin(column*53.7+8.2)*4375.17);
        float path=1.-smoothstep(.035,.14+fwidth(lane),abs(fract(lane)-(.26+.45*seed)));
        float rivulet=path*smoothstep(.25,.83,seed)*(.45+.55*smoothstep(.3,.9,
          fract(st.y+rainTime*(.11+.12*seed)+seed)));
        float rim=min(min(st.x,1.-st.x),min(st.y,1.-st.y));
        diffuseColor.rgb*=.94-.18*rivulet-.20*(1.-smoothstep(0.,.029,rim));`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.39,rivulet);');
  };
}

export function stationFinishes(loader,filmTime){
  const atlas=loader.load(atlasFile);
  function tile(upper,right){
    const map=atlas.clone();
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    map.repeat.set(.496,.496);map.offset.set((right?.5:0)+.002,(upper?.5:0)+.002);
    return mat(0xd8d3c8,{map,roughness:.57});
  }
  const rainwear=loader.load(rainwearFile);rainwear.wrapS=T.RepeatWrapping;rainwear.anisotropy=4;
  const enamelMap=loader.load(enamelColor),response=loader.load(enamelResponse);
  enamelMap.colorSpace=T.SRGBColorSpace;enamelMap.anisotropy=response.anisotropy=6;
  const painted=color=>mat(color,{map:enamelMap,roughnessMap:response,bumpMap:response,
    bumpScale:.00038,roughness:1,metalness:.015});
  const oil=tile(false,false);wetSign(oil,filmTime);
  const meter=tile(true,false);meter.roughness=.86;meter.color.setHex(0xc4bfae);
  return {meter,ice:tile(true,true),oil,enamelResponse:response,
    pumpCream:painted(0xb9b298),pumpRed:painted(0x923e31),doorSteel:painted(0x828f87),
    gasket:mat(0x35312a,{roughness:.90}),foot:painted(0x747367),
    garageWall:masonry(loader,blockColor,blockNormal,.54,rainwear),storeWall:masonry(loader,renderColor,renderNormal,.39,rainwear)};

}
export function serviceBay(shell,scene,finish){
  // Workshop wing faces the pumps. Local +Z points out from its facade.
  const bay=group(shell,7.45,0,-3.45);bay.rotation.y=-Math.PI/2;
  const green=weather(mat(0x38443e),.58),rim=weather(mat(0x807f77,{metalness:.55}),.7);
  const offwhite=weather(mat(0xb7ae93),.65);
  cladWall(bay,0,1.58,-1.32,8.25,3.16,2.65,finish.garageWall);
  box(bay,0,.22,.035,8.28,.44,.09,green);
  box(bay,0,3.26,-1.30,8.52,.24,2.98,rim);
  // Folded coping with a hemmed drip edge; the downpipe stands clear of the wall.
  box(bay,0,3.175,.158,8.49,.035,.056,rim);
  for(const x of [-2.1,0,2.1])box(bay,x,3.28,.184,.025,.205,.016,rim);
  tube(bay,[[3.99,3.18,.164],[3.99,3.04,.163],[3.99,2.94,.105],[3.99,2.76,.10],
    [3.99,.32,.10],[3.99,.15,.123],[3.99,.091,.233]],.047,offwhite);
  for(const y of [.48,1.94,2.90]){
    box(bay,3.99,y,.054,.148,.028,.05,rim);
    cylinder(bay,3.99,y,.104,.052,.052,.037,rim,24);
  }
  for(const y of [2.85,2.93])tube(bay,[[-4.14,y,.085],[-1.8,y,.085],[1.7,y,.085],[4.10,y,.085]],.014,metal);
  // Folded sectional steel panels sit behind the guides, with a recessed seal
  // at each joint. The wider glazed section carries four gasketed lights.
  const door=group(bay,-1.80,0,.067);
  box(door,0,1.23,0,2.35,2.46,.115,finish.gasket);
  for(let row=0;row<5;row++){
    const y=.247+row*.482;
    mesh(door,new RoundedBoxGeometry(2.25,.474,.040,2,.009),finish.doorSteel,0,y,.067);
    if(row!==3)for(const offset of [-.13,-.09,.10,.14]){
      box(door,0,y+offset,.090,2.17,.013,.018,finish.doorSteel);
    }
  }
  for(const x of [-.83,-.277,.277,.83]){
    mesh(door,new RoundedBoxGeometry(.455,.244,.019,2,.018),finish.gasket,x,1.70,.096);
    mesh(door,new RoundedBoxGeometry(.427,.213,.012,2,.012),matWindow,x,1.70,.106);
  }
  for(const s of [-1,1]){
    box(door,s*1.154,1.23,.093,.063,2.46,.088,rim);
    box(door,s*1.112,1.22,.109,.026,2.42,.010,finish.gasket);
  }
  box(door,0,2.46,.096,2.37,.071,.098,rim);
  box(door,0,.025,.095,2.24,.035,.028,finish.gasket);
  box(door,.52,.67,.113,.139,.025,.05,rim);
  box(bay,.58,1.79,.025,.844,.973,.036,rim);
  mesh(bay,new T.PlaneGeometry(.83,.96),finish.oil,.58,1.79,.046);
  const freezer=group(bay,2.64,.01,.48);
  mesh(freezer,new RoundedBoxGeometry(1.65,.93,.83,3,.035),offwhite,0,.51,0);
  mesh(freezer,new T.PlaneGeometry(1.57,.81),finish.ice,0,.51,.417);
  for(const s of [-1,1]){
    box(freezer,s*.412,1.00,0,.799,.056,.84,rim);
    box(freezer,s*.412,.97,.440,.19,.032,.03,rubber);
  }
  // Plinth, hose bib and oil drum with rolled hoops.
  const drum=group(bay,-3.59,.01,.58);
  cylinder(drum,0,.432,0,.295,.286,.864,green,48);
  for(const y of [.047,.28,.57,.854])cylinder(drum,0,y,0,.303,.303,.020,rim,48);
  cylinder(drum,.135,.875,.105,.034,.034,.023,metal);
  const lamp=group(bay,.61,2.47,.18);
  box(lamp,0,.11,-.09,.20,.32,.12,rim);
  oval(lamp,0,0,0,.092,.144,.087,bulb);
  for(const x of [-.062,0,.062])tube(lamp,[[x,.12,.008],[x,0,.094],[x,-.12,.008]],.007,rim);
  for(const y of [-.05,.048])link(lamp,[-.083,y,.069],[.083,y,.069],.006,.006,rim);
  // A shielded, low-wattage utility light grazes the porcelain sign.
  box(lamp,0,.148,.033,.25,.028,.24,rim);
  const spill=new T.SpotLight(0xffd6a2,2.4,4.8,.97,.87,2);
  bay.localToWorld(spill.position.set(.61,2.47,.32));
  bay.localToWorld(spill.target.position.set(.58,1.55,.04));
  scene.add(spill,spill.target);
}
const matWindow=mat(0x384344,{metalness:.12,roughness:.29});
const bulb=new T.MeshStandardMaterial({color:0xffe4bd,emissive:0xffc88f,emissiveIntensity:1.12});
