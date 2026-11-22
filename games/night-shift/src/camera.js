import * as T from 'three';

// Time, camera x/z, yaw, pitch. Tangents slow naturally at a change in direction.
const frames=[
 [0,-.8,5.6,-.11,-.035],[2,-.56,3.8,.02,-.045],
 [4.7,-.98,.1,1.23,.06],[6.5,-1.02,-2.1,.92,.035],
 [9,.24,-6.3,-.35,-.045],[11,1.2,-8.64,-1.08,-.025],
 [13.2,3.65,-9.14,-1.60,.09],[14.8,4.33,-9.3,-1.65,-.32],
 [16.4,3.45,-9.3,-1.16,-.03],[18.1,1.35,-9.43,-.35,-.03],
 [20.8,.37,-13.3,.02,-.065],[23.1,.16,-17.48,.13,.015],
 [25.6,-.05,-21.7,-.04,.005],[27.7,.03,-24.12,-.10,-.045],
 [30,.06,-25.65,-.045,-.15]
];
function tangent(i,k) {
 if(i===0||i===frames.length-1)return 0;
 const a=frames[i-1],b=frames[i],c=frames[i+1];
 if((b[k]-a[k])*(c[k]-b[k])<=0)return 0;
 return (c[k]-a[k])/(c[0]-a[0]);
}
export function tourPose(camera,time){
 const t=T.MathUtils.clamp(time,0,30);
 let i=0;while(i<frames.length-2 && frames[i+1][0]<t)i++;
 const a=frames[i],b=frames[i+1],span=b[0]-a[0],f=(t-a[0])/span,f2=f*f,f3=f*f2;
 const v=k=>(2*f3-3*f2+1)*a[k]+(f3-2*f2+f)*span*tangent(i,k)+
   (-2*f3+3*f2)*b[k]+(f3-f2)*span*tangent(i+1,k);
 const sway=Math.sin(t*5.85)*.024*Math.min(1,t,30-t);
 camera.position.set(v(1)+sway,1.62+Math.sin(t*11.7)*.021,v(2));
 camera.rotation.set(v(4)+sway*.22,v(3),sway*.38,'YXZ');
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
