import * as T from 'three';
import {seed} from './geometry.js';
import {waterLayer} from './lens.js';

const opticsShader=`
  uniform sampler2D backdrop,surfaceDepth;
  uniform vec2 resolution;
  vec3 bentLight(vec2 uv,vec2 bend){
    vec2 sampleAt=clamp(uv+bend,.5/resolution,1.-.5/resolution);
    if(texture2D(surfaceDepth,sampleAt).r<gl_FragCoord.z) sampleAt=uv;
    return texture2D(backdrop,sampleAt).rgb;
  }`;

function waterMesh(parent,geometry,shader){
  const material=new T.ShaderMaterial({...shader,transparent:true,depthWrite:false,depthTest:false,
    side:T.DoubleSide,forceSinglePass:true});
  const mesh=new T.Mesh(geometry,material);
  mesh.layers.set(waterLayer);
  parent.add(mesh);
  return mesh;
}

// Adhering water stays in pane coordinates as the door swings. A few larger
// beads slide down winding tracks and refract the moving scene behind them.
export function wetPane(parent,x,y,z,w,h,seedOffset,clock,optics){
  const pane=waterMesh(parent,new T.PlaneGeometry(w,h),{
    uniforms:{...optics,clock,seedOffset:{value:seedOffset}},
    vertexShader:`varying vec2 panePoint;
      void main(){panePoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:opticsShader+`
      uniform float clock,seedOffset;varying vec2 panePoint;
      float hash(vec2 p){vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      // Return surface slope and coverage of one population of droplets.
      vec3 bead(vec2 p,vec2 pitch,float sliding){
        vec2 cell=p/pitch,id=floor(cell);
        float size=hash(id+2.34);
        vec2 center=.18+.64*vec2(hash(id),hash(id+17.5));
        vec2 delta=(fract(cell)-center)*pitch;
        float radius=mix(.0008,.0038,size*size)*(1.+.65*sliding);
        delta/=vec2(radius,radius*(1.15+.8*sliding));
        float r=length(delta);
        float aa=clamp(length(fwidth(p))/radius,.05,2.);
        float mask=(1.-smoothstep(1.-aa*.5,1.+aa*.5,r))*min(1.,1./aa);
        return vec3(delta*mask,mask);
      }
      // Wind-blown drops flatten on contact, pull back into beads, then slip.
      // A thin, tapering trail stays connected to the head as it descends.
      vec3 impact(vec2 p){
        vec2 pitch=vec2(.063,.105),id=floor(p/pitch);
        float rate=mix(.39,1.22,hash(id+4.7));
        float phase=clock*rate+hash(id+8.1)*13.;
        vec2 key=id+floor(phase)*vec2(7.23,2.64);
        vec2 center=mix(vec2(.23,.63),vec2(.77,.86),vec2(hash(key),hash(key+9.4)));
        float age=fract(phase)/rate;
        float slide=.044*smoothstep(.14,.91,age);
        vec2 d=(fract(p/pitch)-center)*pitch;
        d.x-=.0015*sin(75.*d.y+7.*hash(key));
        d.y+=slide;
        float splash=smoothstep(0.,.028,age)*(1.-smoothstep(.028,.13,age));
        float radius=mix(.0024,.0053,hash(key+19.))*(1.+.95*splash);
        vec2 q=d/(radius*vec2(1.,1.21-.30*splash));
        float aa=clamp(length(fwidth(p))/radius,.04,1.5);
        float head=1.-smoothstep(1.-aa*.5,1.+aa*.5,length(q));
        float tailWidth=radius*.41*(1.-.75*clamp(d.y/max(.001,slide),0.,1.));
        float tail=(1.-smoothstep(tailWidth,tailWidth+aa*radius,abs(d.x)))*
                   smoothstep(0.,radius,d.y)*(1.-smoothstep(slide,slide+radius,d.y));
        float wet=smoothstep(0.,.02,age)*(1.-smoothstep(.78,1.,fract(phase)));
        return vec3(q*head+vec2(clamp(d.x/max(.0001,tailWidth),-1.,1.)*tail*.55,0.),
                    max(head,tail*.58))*wet;
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        if(gl_FragCoord.z>texture2D(surfaceDepth,uv).r)discard;
        vec2 p=panePoint+vec2(seedOffset,0.);
        vec3 beads=bead(p,vec2(.027,.032),0.);
        float lane=floor(p.x/.086);
        float pace=clock*(.039+.056*hash(vec2(lane,7.)));
        vec2 track=p+vec2(.0028*sin(p.y*31.+lane)+.0011*sin(p.y*56.+lane),pace+.008*sin(9.*pace+lane));
        vec3 moving=bead(track,vec2(.086,.114),1.);
        if(moving.z>beads.z)beads=moving;
        vec3 fresh=impact(p);
        if(fresh.z>beads.z)beads=fresh;
        // Map the physical direction of the pane's surface slope into screen UV.
        vec2 dx=dFdx(p),dy=dFdy(p);
        if(beads.z<.01)discard;
        vec2 slope=vec2(dot(beads.xy,dx),dot(beads.xy,dy))/max(max(length(dx),length(dy)),.00001);
        vec3 light=bentLight(uv,-slope*vec2(resolution.y/resolution.x,1.)*.038);
        light=light*(1.-.21*dot(beads.xy,beads.xy))+.13*pow(clamp(-beads.y,0.,1.),4.);
        gl_FragColor=vec4(light,.78*beads.z);
      }`
  });
  pane.position.set(x,y,z);
}

function fallingRain(scene,uniforms,rng,count,span,height,runoff=false){
  const geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const seeds=new Float32Array(count*4);
  for(let i=0;i<seeds.length;i++)seeds[i]=rng();
  if(runoff){
    // Independent drips collect at low spots along the four canopy edges.
    const sites=Array.from({length:19},(_,i)=>{
      const along=rng()*2-1,side=i%2?1:-1;
      return i%4<2?[1.5+side*5.13,-7.55+along*4.57]:[1.5+along*5.13,-7.55+side*4.57];
    });
    for(let i=0;i<count;i++){
      const [x,z]=sites[i%sites.length];
      seeds[i*4]=x+(rng()-.5)*.035;seeds[i*4+1]=z+(rng()-.5)*.035;
    }
  }
  geometry.setAttribute('drop',new T.InstancedBufferAttribute(seeds,4));
  const shader={
    defines:runoff?{EAVE_RUNOFF:1}:{},
    uniforms:{...uniforms,span:{value:span},height:{value:height}},
    vertexShader:`
      attribute vec4 drop;
      #ifdef SPLASH_SPRAY
        attribute float sibling;
      #endif
      uniform float clock,span,height,flash,beamStrength;
      uniform vec3 observer,beamCenter;
      uniform vec2 resolution;
      varying vec2 profile,axis;
      varying vec3 illumination;
      varying float coverage,aspect,bend;
      bool under(vec2 point,vec2 low,vec2 high){
        return all(greaterThan(point,low))&&all(lessThan(point,high));
      }
      float lamp(vec3 p,vec2 head){
        float down=6.-p.y;
        vec2 d=p.xz-head-vec2(0.,.18*down);
        return smoothstep(0.,.55,down)*exp(-dot(d,d)/(.25+.22*down*down))/(1.+.06*down*down);
      }
      float tubeLight(vec3 p,vec2 center){
        vec3 d=vec3(p.x-center.x,p.y-3.42,max(0.,abs(p.z-center.y)-.61));
        return smoothstep(-.18,.3,-d.y)/(.55+dot(d,d));
      }
      void main(){
        float size=drop.w*drop.w;
        float speed=mix(3.4,9.,drop.w);
        float fall=height/speed,period=fall+.17;
        float age=mod(clock+drop.z*period,period);
        float y=max(0.,height-speed*age);
        float after=age-fall;
        vec2 breeze=vec2(1.05,1.14);
        float gust=clock*.92+drop.z*2.;
        vec2 drift=breeze*clock+vec2(.58,.32)*sin(gust);
        vec2 wind=breeze+vec2(.58,.32)*.92*cos(gust);
        vec2 xz=observer.xz+mod((drop.xy-.5)*span+drift-observer.xz+span*.5,span)-span*.5;
        float edge=1.-smoothstep(span*.39,span*.5,max(abs(xz.x-observer.x),abs(xz.y-observer.z)));
        float radius=mix(.0005,.0024,size);
        bool sheltered=y<3.94&&under(xz-wind*max(3.94-y,0.)/speed,vec2(-3.62,-12.08),vec2(6.62,-3.03));
        #ifdef EAVE_RUNOFF
          period=1.12+1.90*drop.w;
          age=mod(clock+drop.z*period,period);
          fall=sqrt(2.*height/9.81);
          float flight=min(age,fall);
          y=height-4.905*flight*flight;speed=9.81*flight;
          wind=vec2(.28+.37*drop.z,-.13+.29*drop.w)*flight;
          xz=drop.xy+.5*wind*flight;edge=1.;sheltered=false;radius=.0018+.0014*drop.w;
          after=age-fall;
        #endif
        #ifdef SPLASH_SPRAY
          if(after<0.||after>.17){gl_Position=vec4(2.,2.,2.,1.);return;}
        #endif
        if(after>=0.){
          // A bouncing satellite bead leaves each exposed impact at a different
          // angle. Anchor the hit while the wind continues past it.
          float up=.35+.31*drop.z,angle=drop.w*127.+drop.z*53.;
          float outward=.12+.50*drop.w;
          #ifdef SPLASH_SPRAY
            angle+=sibling*(1.63+drop.z*.87);
            up=.42+.41*fract(drop.z*5.7+sibling*.37);
            outward=.22+.54*fract(drop.w*8.7+sibling*.61);
          #endif
          vec2 rebound=vec2(cos(angle),sin(angle))*outward;
          #ifdef EAVE_RUNOFF
            wind=vec2(0.);
          #endif
          xz+=(rebound-wind)*after;wind=rebound;
          float road=-18.+sign(xz.x)*17.*smoothstep(30.,144.,abs(xz.x));
          float surface=abs(xz.y-road)<2.9?.020:-.003;
          y=surface+up*after-4.905*after*after;
          speed=9.81*after-up;
          radius*=.65;
        }
        vec3 p=vec3(xz.x,y,xz.y);
        vec4 eye=viewMatrix*vec4(p,1.);
        if(y<0.||eye.z>-.26||edge<.001||sheltered||
           (y<3.25&&under(xz,vec2(-5.14,-.15),vec2(5.14,7.57)))||
           (y<3.4&&under(xz,vec2(7.22,-7.72),vec2(10.34,.83)))){
          gl_Position=vec4(2.,2.,2.,1.);return;
        }
        float warm=lamp(p,vec2(-11.8,-19.66))+lamp(p,vec2(6.4,-19.66));
        float tubes=tubeLight(p,vec2(3.66,-5.5))+tubeLight(p,vec2(3.66,-9.7))+
                    tubeLight(p,vec2(-2.87,-5.5))+tubeLight(p,vec2(-2.87,-9.7));
        float beamHeight=max(.1,beamCenter.y*2.);
        float beamRadius=mix(2.68,.90,clamp(y/beamHeight,0.,1.));
        float inBeam=(1.-smoothstep(beamRadius*.64,beamRadius,length(xz-beamCenter.xz)))*
                     (1.-smoothstep(beamHeight-.16,beamHeight,y));
        illumination=vec3(.26,.31,.37)+warm*vec3(3.7,2.7,1.75)+tubes*vec3(1.2,1.17,.96)+
                     flash*vec3(.70,.83,1.)+beamStrength*inBeam*vec3(.74,1.65,1.84);
        // Integrate the projected bead over a short exposure. Out-of-focus
        // and subpixel drops spread the same light over a larger footprint.
        vec3 travel=mat3(viewMatrix)*vec3(wind.x,-speed,wind.y)*.006;
        vec2 motion=travel.xy-eye.xy*travel.z/eye.z;
        axis=normalize(motion+vec2(.000001,0.));
        float pixel=-2.*eye.z/(projectionMatrix[1][1]*resolution.y);
        float footprint=max(pixel*.68,radius+.0055*(1.-smoothstep(.35,3.5,-eye.z)));
        float halfLength=footprint+length(motion)*.5;
        aspect=halfLength/footprint;
        coverage=edge*smoothstep(.4,1.15,-eye.z)*(1.-smoothstep(height*.94,height,y))*
                 min(1.,radius/footprint)*min(.9,6.8*radius/halfLength);
        bend=clamp(radius/pixel,0.,3.)+1.;
        profile=position.xy;
        eye.xy+=axis*halfLength*position.y+vec2(-axis.y,axis.x)*footprint*position.x;
        gl_Position=projectionMatrix*eye;
      }`,
    fragmentShader:opticsShader+`
      varying vec2 profile,axis;varying vec3 illumination;varying float coverage,aspect,bend;
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        if(gl_FragCoord.z>texture2D(surfaceDepth,uv).r)discard;
        float end=max(0.,1.-(1.-abs(profile.y))*aspect);
        vec2 section=vec2(profile.x,sign(profile.y)*end);
        float r=dot(section,section);
        float mask=(1.-smoothstep(.08,1.,r))*(1.-.48*smoothstep(.35,1.,abs(profile.y)));
        if(mask*coverage<.001)discard;
        vec2 normal=vec2(-axis.y,axis.x)*section.x+axis*section.y;
        vec3 transmitted=bentLight(uv,-normal*bend*5./resolution);
        float edge=clamp(r,0.,1.);
        float glint=.31+.85*pow(clamp(.5+.5*profile.x,0.,1.),4.);
        vec3 light=transmitted*(.75-.23*edge)+illumination*glint;
        gl_FragColor=vec4(light,coverage*mask);
      }`
  };
  waterMesh(scene,geometry,shader).frustumCulled=false;
  if(!runoff&&span>30)return;
  // Only the largest near-field drops throw visibly separate beads. Group
  // those siblings into one instanced draw, sharing the parent's impact time.
  const splashes=[],siblings=[];
  for(let i=0;i<count;i++){
    const drop=seeds.subarray(i*4,i*4+4);
    if(!runoff&&drop[3]<.84)continue;
    for(let j=1;j<=3;j++){splashes.push(...drop);siblings.push(j)}
  }
  const spray=new T.InstancedBufferGeometry();
  spray.setAttribute('position',geometry.attributes.position);spray.setIndex(geometry.index);
  spray.setAttribute('drop',new T.InstancedBufferAttribute(new Float32Array(splashes),4));
  spray.setAttribute('sibling',new T.InstancedBufferAttribute(new Float32Array(siblings),1));
  waterMesh(scene,spray,{...shader,defines:{...shader.defines,SPLASH_SPRAY:1}}).frustumCulled=false;
}

export function rain(scene,clock,flash,camera,beam,optics){
  const uniforms={...optics,clock,flash,observer:{value:camera.position},
    beamCenter:{value:beam.position},beamStrength:beam.material.uniforms.strength};
  const rng=seed(8316);
  fallingRain(scene,uniforms,rng,35000,23,13);
  fallingRain(scene,uniforms,rng,22000,64,24);
  fallingRain(scene,uniforms,rng,108,29,3.79,true);
}
