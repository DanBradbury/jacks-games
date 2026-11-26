import * as T from 'three';
import {group,mat,box,link,oval,cylinder,tube,mesh,metal,rubber} from './geometry.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import atlasFile from './station-atlas.jpg';
import plasterFile from '../../night-shift/src/scans/cracked_concrete_wall_Diffuse.jpg';
import plasterNormal from '../../night-shift/src/scans/cracked_concrete_wall_nor_gl.jpg';
import {weather} from './finish.js';

export function stationFinishes(loader){
  const atlas=loader.load(atlasFile);
  function tile(upper,right){
    const map=atlas.clone();
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    map.repeat.set(.496,.496);map.offset.set((right?.5:0)+.002,(upper?.5:0)+.002);
    return mat(0xd8d3c8,{map,roughness:.57});
  }
  const map=loader.load(plasterFile),normalMap=loader.load(plasterNormal);
  map.colorSpace=T.SRGBColorSpace;
  for(const t of [map,normalMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3.4,1.1);t.anisotropy=4}
  return {meter:tile(true,false),ice:tile(true,true),oil:tile(false,false),
    wall:mat(0x998e79,{map,normalMap,normalScale:new T.Vector2(.62,.62),roughness:.94})};
}
export function serviceBay(shell,scene,finish){
  // Workshop wing faces the pumps. Local +Z points out from its facade.
  const bay=group(shell,7.45,0,-3.45);bay.rotation.y=-Math.PI/2;
  const green=weather(mat(0x38443e),.58),rim=weather(mat(0x807f77,{metalness:.55}),.7);
  const offwhite=weather(mat(0xb7ae93),.65);
  box(bay,0,1.58,-1.32,8.25,3.16,2.65,finish.wall);
  box(bay,0,.22,.035,8.28,.44,.09,green);
  box(bay,0,3.26,-1.30,8.52,.24,2.98,rim);
  for(const y of [2.85,2.93])tube(bay,[[-4.14,y,.085],[-1.8,y,.085],[1.7,y,.085],[4.10,y,.085]],.014,metal);
  box(bay,-1.8,1.22,.06,2.25,2.44,.12,rim);
  for(let k=0;k<19;k++)box(bay,-1.8,.10+k*.127,.132,2.15,.025,.028,green);
  for(let k=0;k<4;k++)box(bay,-2.55+k*.50,1.79,.15,.435,.29,.034,matWindow);
  mesh(bay,new T.PlaneGeometry(.83,.96),finish.oil,.58,1.79,.024);
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
  const spill=new T.PointLight(0xffbf77,18,9,2);
  bay.localToWorld(spill.position.set(.61,2.32,.50));scene.add(spill);
}
const matWindow=mat(0x364340,{metalness:.6,roughness:.2});
const bulb=new T.MeshStandardMaterial({color:0xffe4bd,emissive:0xffc88f,emissiveIntensity:3});
