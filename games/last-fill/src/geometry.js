import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const mat = (color, props={}) => new T.MeshStandardMaterial({color,...props});
export const metal = mat(0x999c99,{metalness:.87,roughness:.27});
export const rubber = mat(0x171819,{roughness:.91});
export const chrome = mat(0xc1c6c5,{metalness:.94,roughness:.13});
const cube = new T.BoxGeometry(), sphere = new T.SphereGeometry(1,28,20);
export function mesh(parent,geom,material,x=0,y=0,z=0) {
  const m=new T.Mesh(geom,material);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function box(p,x,y,z,w,h,d,m){const o=mesh(p,cube,m,x,y,z);o.scale.set(w,h,d);return o}
export function oval(p,x,y,z,w,h,d,m){const o=mesh(p,sphere,m,x,y,z);o.scale.set(w,h,d);return o}
export function cylinder(p,x,y,z,top,bottom,h,m,n=32){return mesh(p,new T.CylinderGeometry(top,bottom,h,n),m,x,y,z)}
export function link(p,a,b,r,s,m){
  const from=new T.Vector3(...a),to=new T.Vector3(...b),axis=to.clone().sub(from);
  const o=cylinder(p,0,0,0,s,r,axis.length(),m,12);
  o.position.copy(from).lerp(to,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());return o;
}
export function tube(p,points,r,m){
  const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));
  return mesh(p,new T.TubeGeometry(curve,Math.max(16,points.length*5),r,7,false),m);
}
export function group(p,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);p.add(g);return g}
export function panel(p,points,m){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  return mesh(p,g,m);
}
export function paint(p,x,y,z,w,h,lines,bg,ink='#181a18',reverse=false){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768*h/w);
  const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';
  lines.forEach(([s,f,v])=>{c.font='bold '+Math.round(f*canvas.height)+'px sans-serif';c.fillText(s,384,v*canvas.height,715)});
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const o=mesh(p,new T.PlaneGeometry(w,h),mat(0xffffff,{map,roughness:.47}),x,y,z);
  if(reverse)o.rotation.y=Math.PI;return o;
}
// Batch rigid parts once. Keep articulated objects in separate groups.
export function bake(root){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(), buckets=new Map();
  root.traverse(o=>{
    if(!o.isMesh||o.material.transparent)return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
    if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if(!buckets.has(o.material))buckets.set(o.material,[]);
    buckets.get(o.material).push([o,g]);
  });
  for(const [m,parts] of buckets){
    const g=mergeGeometries(parts.map(pair=>pair[1]));mesh(root,g,m);
    for(const [o,part] of parts){o.removeFromParent();part.dispose()}
  }
}
export const smooth=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
export function seed(value){return ()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296}}
