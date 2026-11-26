import * as T from 'three';
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
  const nose=mat(0x9c7567),hoof=mat(0x32302b);
  cattleHide(animal,flank);
  oval(animal,1.554,.984,0,.102,.084,.144,nose).rotation.z=-.36;
  oval(animal,-.59,.60,.01,.216,.143,.193,mat(0xa9887c));
  const legs=[];
  for(const s of [-1,1]){
    oval(animal,1.614,.997,s*.100,.027,.020,.012,hoof);
    oval(animal,1.302,1.27,s*.174,.037,.039,.020,rubber);
    oval(animal,1.14,1.39,s*.228,.113,.053,.139,coat).rotation.z=.25;
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
  tube(animal,[[-.86,1.33,.13],[-1.06,1.08,.18],[-1.08,.75,.22],[-1.0,.47,.255]],.026,coat);
  oval(animal,-1.0,.42,.255,.061,.12,.056,hoof);
  bake(animal);
  for(const {lower} of legs){bake(lower);animal.add(lower)}
  return {animal,legs};
}
export function encounter(scene,loader){
  const {animal,legs}=cow(scene,loader),craft=group(scene);
  const alloy=mat(0x656e72,{metalness:.91,roughness:.30}),rib=mat(0x384449,{metalness:.79,roughness:.35});
  const glow=new T.MeshBasicMaterial({color:new T.Color(2.8,2.2,1.5)}),ice=new T.MeshBasicMaterial({color:new T.Color(1.6,3.2,3.4)});
  const profile=[[.01,-.72],[.91,-.71],[1.08,-.60],[1.55,-.53],[1.73,-.47],[2.51,-.40],[3.50,-.21],[3.77,-.06],[3.8,.055],[3.51,.17],[2.15,.45],[1.48,.53],[1.23,.78],[.77,.96],[.01,1.03]];
  mesh(craft,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),128),alloy);
  const ring=(r,y,th,m)=>{const o=mesh(craft,new T.TorusGeometry(r,th,10,112),m,0,y,0);o.rotation.x=Math.PI/2};
  ring(3.70,-.085,.035,rib);ring(3.37,-.235,.015,glow);ring(1.62,-.50,.036,ice);ring(1.03,-.68,.07,rib);
  cylinder(craft,0,-.718,0,.91,.89,.045,ice,64);
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,x=Math.cos(a),z=Math.sin(a);
    link(craft,[x*1.82,-.495,z*1.82],[x*3.4,-.236,z*3.4],.016,.026,rib);
    if(i%2===0)oval(craft,x*3.49,-.218,z*3.49,.071,.032,.071,glow);
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
      float shafts=.78+.14*sin(st.x*94.25)+.08*sin(st.x*50.26);
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
  function animate(t){
    const arrive=smooth(28,34.7,t),leave=smooth(44,46.8,t),lift=smooth(36,43.9,t),active=smooth(34.5,35.7,t)*(1-smooth(43.8,44.9,t));
    for(const {lower,back,s} of legs){
      const weight=smooth(35.9,37.9,t);
      lower.rotation.z=weight*((back?-.39:.28)+.18*Math.sin(t*2.7+s*1.8+(back?2.1:0)));
    }
    craft.visible=t>=28&&t<46.8;
    craft.position.set(-3.1+48*(1-arrive)-74*leave,8.0+14*(1-arrive)+33*leave+.095*Math.sin(t*1.9),-29.8-30*(1-arrive)-65*leave);
    craft.rotation.set(.028*Math.cos(t),t*.27,.085*(1-arrive)-.25*leave);
    animal.visible=t<43.78;
    animal.position.set(-3.1+.18*Math.sin(lift*Math.PI),.035+6.97*lift,-29.8);
    animal.rotation.set(lift*.13,-.17+lift*.84,.014*Math.sin(t*1.64)+lift*.42);
    const height=craft.position.y-.7;
    beam.visible=dust.visible=active>.001;
    beam.position.set(-3.1,height/2,-29.8);beam.scale.y=height;beamMat.uniforms.strength.value=active;
    dust.position.set(-3.1,0,-29.8);dust.scale.y=height;dust.rotation.y=t*.16;
    pool.position.copy(craft.position);pool.intensity=active*185;
    return craft.position;
  }
  return {animate,beam};
}
