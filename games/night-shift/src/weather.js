import * as T from 'three';

export async function loadCityTextures(){
  const loader=new T.TextureLoader();
  const [sky,facade]=await Promise.all([
    loader.loadAsync(new URL('./city/sky.jpg',import.meta.url).href),
    loader.loadAsync(new URL('./city/facade.jpg',import.meta.url).href),
  ]);
  for(const texture of [sky,facade]){
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.wrapS=T.RepeatWrapping;
  }
  facade.wrapT=T.RepeatWrapping;
  return {sky,facade};
}

const worldVertex=`
varying vec3 point;
void main(){
  point=(modelMatrix*vec4(position,1.)).xyz;
  gl_Position=projectionMatrix*viewMatrix*vec4(point,1.);
}`;
const skyUV=`
vec2 skylineUV(vec3 d){
  return vec2(atan(d.z,d.x)*.477465+0.08,clamp(.51+d.y*.92,.002,.998));
}`;

// Far skyline and low cloud share world coordinates so the cloud moves
// across distant lights while foreground buildings retain their silhouettes.
export function createWeather(scene,{sky},rand){
  const time={value:0};
  const skyMat=new T.ShaderMaterial({
    uniforms:{sky:{value:sky},time},side:T.BackSide,vertexShader:worldVertex,
    fragmentShader:`uniform sampler2D sky;uniform float time;varying vec3 point;
    `+skyUV+`
    float hash(vec2 p){return fract(sin(dot(p,vec2(41.2,287.1)))*43758.5);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){
      vec3 d=normalize(point-vec3(0.,1.,-8.));
      vec2 uv=skylineUV(d);
      vec3 city=texture2D(sky,uv).rgb;
      float mist=noise(d.xz*5.+vec2(time*.018,d.y*4.))*.68+noise(d.xz*14.+d.y*5.-time*.009)*.32;
      float low=exp(-abs(d.y+.09)*3.);
      gl_FragColor=vec4(mix(city*.91,vec3(.056,.085,.115),low*(.08+.34*mist)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const dome=new T.Mesh(new T.SphereGeometry(119,64,32),skyMat);
  dome.position.z=-8;scene.add(dome);

  const glass=new T.ShaderMaterial({
    uniforms:{sky:{value:sky},time},transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:worldVertex,fragmentShader:`
    uniform sampler2D sky; uniform float time; varying vec3 point;
    `+skyUV+`
    float hash(vec2 p){return fract(sin(dot(p,vec2(71.7,329.1)))*4358.23);}
    // Radius varies per bead. A second sparse population runs down fixed lanes.
    vec3 beads(vec2 p,float density){
      vec2 cell=floor(p),j=vec2(hash(cell),hash(cell+19.31));
      vec2 q=fract(p)-(.18+.64*j);
      float r=.026+.102*pow(hash(cell+13.7),2.);
      q.y*=.8;
      float a=(1.-smoothstep(r-fwidth(q.y),r+fwidth(q.y),length(q)))*step(hash(cell+33.1),density);
      return vec3(q/max(r,.001),1.)*a;
    }
    void main(){
      vec2 pane=vec2(point.z+sign(point.x)*19.,point.y);
      float lane=floor(pane.x*4.);
      float phase=hash(vec2(lane,19.));
      float dropY=fract(pane.y*.42+time*(.051+phase*.077)+phase);
      float cx=phase*.64+.18+.025*sin(pane.y*13.+phase*22.);
      float offset=fract(pane.x*4.)-cx;
      float trail=(1.-smoothstep(.002,.026,abs(offset)))*(1.-smoothstep(.01,.47,dropY));
      vec3 staticDrop=beads(pane*11.,.62)+beads(pane*24.+.35,.32)*.54;
      vec2 q=vec2(offset/.03,min(dropY,1.-dropY)/.009);
      float moving=1.-smoothstep(.6,1.,length(q));
      vec2 normal=staticDrop.xy+moving*q+vec2(trail*.16,0.);
      float coverage=clamp(staticDrop.z+moving,0.,1.);
      vec3 ray=normalize(point-cameraPosition);
      vec3 refracted=texture2D(sky,skylineUV(normalize(ray+vec3(.01,normal.y*.66,normal.x*.61)))).rgb;
      float glint=max(0.,dot(normal,normalize(vec2(-.4,.9))));
      float grazing=pow(1.-abs(ray.x),3.);
      vec3 color=mix(vec3(.07,.095,.11),refracted*1.2+glint*vec3(.32,.37,.40),coverage);
      float alpha=.014+grazing*.072+coverage*.61+trail*.12;
      gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  // Short exposure streaks occupy two outdoor volumes, each bounded by its window wall.
  const seeds=[],tips=[];
  for(let i=0;i<4600;i++){
    const x=(i%2?1:-1)*(2.9+rand()**1.5*28),y=rand()*19,z=-51+rand()*76;
    seeds.push(x,y,z,x,y,z);tips.push(0,.085+rand()*.16);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(seeds,3));
  geo.setAttribute('tip',new T.Float32BufferAttribute(tips,1));
  const rainfall=new T.LineSegments(geo,new T.ShaderMaterial({uniforms:{time},transparent:true,depthWrite:false,
    vertexShader:`uniform float time;attribute float tip;varying float strength;
    void main(){
      float speed=6.+fract(position.z*3.714)*3.;
      float y=mod(position.y-time*speed,19.)-8.;
      vec3 p=vec3(position.x,y+tip,position.z+.15*(y+tip));
      strength=(.043+.055*fract(position.y*7.2))*(1.-smoothstep(9.,42.,distance(cameraPosition,p)));
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }`,
    fragmentShader:`varying float strength;void main(){gl_FragColor=vec4(.35,.48,.60,strength);}`}));
  rainfall.frustumCulled=false;rainfall.renderOrder=0;scene.add(rainfall);
  return {glass,update(seconds){time.value=seconds;}};
}
