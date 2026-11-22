import * as T from 'three';

export const TOUR_SECONDS=26;

// Uniform cubic B-spline control poses: x, z, yaw and pitch. Positions and
// viewing angles share continuous velocity and acceleration through each turn.
const entrance=[-.8,5.6,-.11,-.035],racks=[.06,-25.65,-.045,-.15];
const poses=[
  entrance,entrance,entrance,[-.62,2.6,.33,-.01],[-1.02,-.35,1.38,.08],
  [.08,-6.3,-.37,-.055],[1.95,-9.43,-1.3,.01],[4.46,-9.14,-1.68,.09],
  [4.62,-9.30,-1.72,-.35],[1.45,-9.13,-.44,-.065],[.32,-12.5,.07,-.035],
  [.12,-17.2,.10,.015],[-.06,-21.7,-.04,.005],racks,racks,racks
];
export function tourPose(camera,time){
  const t=T.MathUtils.clamp(time,0,TOUR_SECONDS);
  const segments=poses.length-3, u=t*segments/TOUR_SECONDS;
  const i=Math.min(Math.floor(u),segments-1), f=u-i, g=1-f;
  const a=poses[i],b=poses[i+1],c=poses[i+2],d=poses[i+3];
  const blend=k=>(g**3*a[k]+(3*f**3-6*f*f+4)*b[k]+
    (1+3*f+3*f*f-3*f**3)*c[k]+f**3*d[k])/6;
  const rate=k=>(g*g*(b[k]-a[k])+ (1+2*f*g)*(c[k]-b[k])+f*f*(d[k]-c[k]))*.5*segments/TOUR_SECONDS;
  const stride=Math.min(1,Math.hypot(rate(0),rate(1)));
  const sway=Math.sin(t*5.4)*.007*stride;
  camera.position.set(blend(0)+sway,1.62+Math.sin(t*10.8)*.005*stride,blend(1));
  camera.rotation.set(blend(3),blend(2),sway*.14,'YXZ');
}

export function createCameraOutput(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});
 const stage=new T.Scene(), screen=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const overlay=document.createElement('canvas');overlay.width=1280;overlay.height=720;
 const ctx=overlay.getContext('2d');
 const hud=new T.CanvasTexture(overlay);hud.colorSpace=T.SRGBColorSpace;
 const uniforms={frame:{value:target.texture},hud:{value:hud},clock:{value:0},body:{value:1},labels:{value:1},px:{value:new T.Vector2(1,1)}};
 const shader=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 pos;void main(){pos=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D frame,hud;uniform vec2 px;uniform float clock,body,labels;
 varying vec2 pos;
 float hash(vec2 v){return fract(sin(dot(v,vec2(41.23,289.11)))*4375.831);}
 void main(){
 vec2 p=pos-.5;float r=dot(p,p);vec2 uv=.5+p*(1.+body*(.135*r-.037));
 vec3 c=texture2D(frame,uv).rgb;
 if(body>.5){
 vec2 shift=p*(.0012+.002*r);
 c.r=texture2D(frame,uv+shift).r;c.b=texture2D(frame,uv-shift).b;
 vec3 halo=vec3(0.);
 for(int j=0;j<8;j++){float ang=float(j)*.785398;vec2 off=vec2(cos(ang),sin(ang))*px;
 halo+=max(texture2D(frame,uv+off*5.).rgb-.72,0.)+max(texture2D(frame,uv+off*12.).rgb-.85,0.)*.5;}
 c+=halo*.037;c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,.85);
 c*=vec3(.99,1.012,1.025)*(1.-smoothstep(.055,.55,r)*.48);
 }
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 if(body>.5){
 float n=hash(gl_FragCoord.xy+floor(clock*24.)*13.31)-.5;
 gl_FragColor.rgb+=n*(.022+.021*(1.-gl_FragColor.g));
 gl_FragColor.rgb*=.995+.005*sin(gl_FragCoord.y*3.14159);
 vec4 h=texture2D(hud,pos);gl_FragColor.rgb=mix(gl_FragColor.rgb,h.rgb,h.a*labels);
 }
 }`});
 stage.add(new T.Mesh(new T.PlaneGeometry(2,2),shader));
 let lastHUD='';
 function telemetry(sec){
   const stamp=new Date(Date.UTC(2026,10,21,2,14,0)+1000*sec).toISOString().slice(11,19);
   const key=stamp+Math.floor(sec*2)%2;
   if(key===lastHUD)return;lastHUD=key;
   ctx.clearRect(0,0,1280,720);ctx.fillStyle='#e3e6df';ctx.font='16px monospace';
   ctx.shadowColor='#111';ctx.shadowBlur=3;ctx.textAlign='left';
   ctx.fillText('BC–07   //   FIELD UNIT',38,40);ctx.fillText('CAM 01',38,62);
   ctx.textAlign='right';ctx.fillText(stamp+' UTC',1240,62);
   ctx.fillText('REC',1240,40);ctx.fillStyle=Math.floor(sec*2)%2?'#a44839':'#ff6953';
   ctx.beginPath();ctx.arc(1195,34,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e3e6df';
   ctx.font='13px monospace';ctx.fillText('CH 1  ▂▄▆▃▂   CH 2  ▂▃▅▂',1240,681);
   ctx.textAlign='left';ctx.fillText('WIDE  /  AUTO ISO',38,681);hud.needsUpdate=true;
 }
 return {
   resize(w,h){target.setSize(w,h);uniforms.px.value.set(1/w,1/h);overlay.width=1280;overlay.height=Math.round(1280*h/w);ctx.setTransform(1,0,0,overlay.height/720,0,0);lastHUD='';},
   draw(t,filter,showHUD){telemetry(t);uniforms.clock.value=t;uniforms.body.value=Number(filter);uniforms.labels.value=Number(showHUD);
     renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(stage,screen);}
 };
}
