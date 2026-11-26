import * as T from 'three';
import {frameCorners} from 'three/addons/utils/CameraUtils.js';
import {reflectionLayer} from './lens.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {group,mesh,mat,link,oval,rubber} from './geometry.js';

// Clear panes pick up soft, angle-dependent reflections from the cabin and canopy.
function glazingMaterial(){
  return new T.ShaderMaterial({
    uniforms:{surroundings:{value:null}},
    side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,
    vertexShader:`#include <common>
      varying vec3 point,n;
      void main(){
        point=(modelMatrix*vec4(position,1.)).xyz;
        n=inverseTransformDirection(normalMatrix*normal,viewMatrix);
        gl_Position=projectionMatrix*viewMatrix*vec4(point,1.);
      }`,
    fragmentShader:`varying vec3 point,n;uniform samplerCube surroundings;
      void main(){
        vec3 ray=normalize(point-cameraPosition),normal=normalize(n);
        vec3 image=textureCube(surroundings,reflect(ray,normal),.8).rgb;
        float facing=abs(dot(ray,normal));
        float single=.04+.96*pow(1.-facing,5.);
        float reflectance=single+.53*single*(1.-single)/(1.+single);
        float absorption=.025/max(.50,facing);
        float alpha=reflectance+(1.-reflectance)*absorption;
        gl_FragColor=vec4((image*reflectance+vec3(.001,.002,.0015))/alpha,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}
function rounded(parent,x,y,z,w,h,d,r,material){
  return mesh(parent,new RoundedBoxGeometry(w,h,d,4,r),material,x,y,z);
}

// Reflect the viewer across the current mirror plane. Its four edges define
// an off-axis frustum, so the whole target is spent on the visible reflection.
function liveMirror(geometry,w,h){
  const target=new T.WebGLRenderTarget(384,Math.round(384*h/w),{type:T.HalfFloatType});
  const face=new T.Mesh(geometry,new T.MeshBasicMaterial({map:target.texture,color:0xeeefee}));
  face.layers.set(reflectionLayer);
  const uv=geometry.attributes.uv,pos=geometry.attributes.position;
  for(let i=0;i<uv.count;i++)uv.setXY(i,.5-pos.getX(i)/w,.5+pos.getY(i)/h);
  const virtual=new T.PerspectiveCamera(),eye=new T.Vector3();
  const bl=new T.Vector3(),br=new T.Vector3(),tl=new T.Vector3();
  face.onBeforeRender=(renderer,scene,viewer)=>{
    viewer.getWorldPosition(eye);face.worldToLocal(eye);
    if(eye.z<=.001)return;
    virtual.near=eye.z+.001;
    virtual.far=eye.z+viewer.far;
    virtual.position.copy(face.localToWorld(eye.setZ(-eye.z)));
    face.localToWorld(bl.set(w/2,-h/2,0));
    face.localToWorld(br.set(-w/2,-h/2,0));
    face.localToWorld(tl.set(w/2,h/2,0));
    frameCorners(virtual,bl,br,tl);
    const previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(target);
      renderer.state.buffers.depth.setMask(true);
      renderer.render(scene,virtual);
    }finally{renderer.setRenderTarget(previous)}
  };
  return face;
}
// Loft the rolled bezel, die-cast shell and inset reflecting face around the
// same outline. Housing coordinates have +Z pointing toward the driver.
function mirrorHead(parent,width,height,depth,frame){
  const outline=[],slices=64;
  for(let i=0;i<slices;i++){
    const a=i/slices*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    const y=Math.sign(s)*Math.abs(s)**.55;
    outline.push([width*.5*Math.sign(c)*Math.abs(c)**.49*(.977+.023*y),height*.5*y]);
  }
  const shell=[],indices=[];
  for(const [scale,z] of [[.08,-depth],[.76,-depth*.86],[.97,-depth*.51],[1,-.003],[.993,.001],[.943,.002],[.925,-.002]]){
    const start=shell.length/3;
    for(let j=0;j<slices;j++){
      const [x,y]=outline[j],k=start+j,q=start+(j+1)%slices;
      shell.push(x*scale,y*scale,z);
      if(start)indices.push(k-slices,q-slices,k,q-slices,q,k);
    }
  }
  for(let i=1;i<slices-1;i++)indices.push(0,i+1,i);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(shell,3));g.setIndex(indices);g.computeVertexNormals();
  mesh(parent,g,frame);
  const faceShape=new T.Shape(outline.map(([x,y])=>new T.Vector2(.943*x,.943*y)));
  // Attach the optical face after its metal housing is batched.
  const silver=liveMirror(new T.ShapeGeometry(faceShape),width,height);silver.position.z=-.001;return silver;
}
export function carOptics(car){
  const panes=[],mirrors=[];
  const chrome=mat(0xc2c5c4,{metalness:.91,roughness:.19});
  const eye=new T.Vector3(.33,1.13,-.42);
  function head(parent,position,rear,w,h,d,frame){
    const mount=group(parent,...position);
    const towardEye=eye.clone().sub(mount.position).normalize();
    const normal=towardEye.add(new T.Vector3(...rear).normalize()).normalize();
    // lookAt uses world space; set the orientation directly in the mount's parent frame.
    mount.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(normal,new T.Vector3(),new T.Vector3(0,1,0)));
    const face=mirrorHead(mount,w,h,d,frame);
    const mirror={mount,face};mirrors.push(mirror);return mirror;
  }
  function doorMirror(door,s,foot){
    const [x,y,z]=foot;
    const {mount}=head(door,[x+s*.145,y+.136,z-.037],[s*.13,-.055,-1],.193,.112,.040,chrome);
    const behind=new T.Vector3(0,-.043,-.021).applyQuaternion(mount.quaternion).add(mount.position);
    const base=new T.Vector3(x,y+.009,z+.072);
    rounded(door,base.x,base.y-.004,base.z,.048,.010,.118,.005,rubber);
    rounded(door,base.x,base.y+.003,base.z,.043,.014,.112,.006,chrome);
    const span=behind.clone().sub(base),mid=base.clone().lerp(behind,.5);
    const stalk=rounded(door,mid.x,mid.y,mid.z,.027,span.length(),.039,.009,chrome);
    stalk.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),span.normalize());
    oval(door,behind.x,behind.y,behind.z,.018,.016,.018,chrome);
  }
  function cabinMirror(){
    rounded(car,0,1.239,.138,.033,.035,.020,.005,rubber);
    link(car,[0,1.236,.130],[0,1.212,.051],.008,.009,rubber);
    head(car,[0,1.204,.038],[0,-.10,-1],.237,.061,.018,rubber);
  }
  function capture(renderer,scene){
    for(const {mount,face} of mirrors)mount.add(face);
    const probe=new T.CubeCamera(.018,210,null);
    function at(position,size){
      probe.renderTarget=new T.WebGLCubeRenderTarget(size,{type:T.HalfFloatType,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});
      probe.position.copy(position);probe.update(renderer,scene);
      return probe.renderTarget.texture;
    }
    // Glass has a low-contrast environment sample. Silvered mirrors instead
    // render the current scene whenever the playback camera sees their face.
    for(const pane of panes)pane.material.visible=false;
    for(const pane of panes)
      pane.material.uniforms.surroundings.value=at(car.localToWorld(pane.position.clone()),256);
    for(const pane of panes)pane.material.visible=true;
  }
  function glass(position){
    const material=glazingMaterial();panes.push({material,position:new T.Vector3(...position)});return material;
  }
  return {glass,doorMirror,cabinMirror,capture};
}
