import * as T from 'three';

const files = import.meta.glob('./scans/*.jpg',{eager:true,query:'?url',import:'default'});
// Preserve the measured relief and aggregate exposed by the chipped paint.
// Recolor just the surviving coating. World-space moisture has a larger scale
// than the scan and continues across joints between neighboring wall panels.
function finishPlaster(material,masonry){
 material.onBeforeCompile=shader=>{
   shader.uniforms.brickColor={value:masonry.map};
   shader.uniforms.brickNormal={value:masonry.normalMap};
   shader.uniforms.brickRough={value:masonry.roughnessMap};
   shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\nvarying vec3 plasterPoint;').replace('#include <begin_vertex>',
     '#include <begin_vertex>\nplasterPoint=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
     #include <common>
     varying vec3 plasterPoint;
     uniform sampler2D brickColor,brickNormal,brickRough;
     float grainAt(vec2 p){return fract(sin(dot(p,vec2(37.19,91.73)))*17358.353);}
     float plasterNoise(vec2 p){
       vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
       return mix(mix(grainAt(cell),grainAt(cell+vec2(1,0)),f.x),
         mix(grainAt(cell+vec2(0,1)),grainAt(cell+1.),f.x),f.y);
     }`).replace('#include <map_fragment>',`
     #include <map_fragment>
     vec3 sampleColor=diffuseColor.rgb;
     float paint=smoothstep(.025,.12,sampleColor.r-sampleColor.b);
     float pos=plasterPoint.x+plasterPoint.z;
     float y=plasterPoint.y;
     float grain=plasterNoise(vec2(pos*15.,y*24.));
     float lower=1.-smoothstep(1.12,1.126,y+grain*.009);
     float stripe=1.-smoothstep(.014,.018,abs(y-1.162+grain*.004));
     vec3 tint=mix(vec3(.83,.80,.70),vec3(.235,.355,.322),lower);
     tint=mix(tint,vec3(.31,.32,.255),stripe);
     float value=dot(sampleColor,vec3(.30,.59,.11));
     diffuseColor.rgb=mix(sampleColor,2.3*value*tint,paint);
     float mottling=plasterNoise(vec2(pos*.72,y*1.18));
     float drips=plasterNoise(vec2(pos*10.,y*.57));
     float wet=(1.-smoothstep(.05,.57+.46*mottling,y))*(.3+.7*drips);
     vec2 surface=vec2(pos,y);
     vec2 brickUV=surface/2.17;
     float mask=mottling*.53+plasterNoise(surface*3.9)*.27+plasterNoise(surface*16.)*.14+grain*.06;
     mask+=.12*exp(-y*1.6)+.065*smoothstep(2.6,3.4,y);
     float loss=smoothstep(.525,.575,mask);
     float lip=smoothstep(.49,.524,mask)*(1.-loss);
     vec3 exposed=texture2D(brickColor,brickUV).rgb*vec3(.76,.71,.63);
     diffuseColor.rgb=mix(diffuseColor.rgb,exposed,loss)*(1.-.23*lip);
     float runoff=plasterNoise(vec2(pos*1.8,y*.31))*.55+drips*.45;
     diffuseColor.rgb*=(.77+.31*mottling)*(1.-.54*wet)*(1.-.29*smoothstep(.54,.78,runoff));
     `).replace('#include <normal_fragment_maps>',`
       #include <normal_fragment_maps>
       vec3 substrate=texture2D(brickNormal,brickUV).rgb*2.-1.;
       normal=normalize(mix(normal,normalize(tbn*substrate),loss));
     `).replace('#include <roughnessmap_fragment>',`
       #include <roughnessmap_fragment>
       roughnessFactor=mix(roughnessFactor,texture2D(brickRough,brickUV).g,loss);
     `);
 };
 return material;
}

export async function loadConcrete(){
 const loader=new T.TextureLoader();
 async function material(name,color){
  const [map,normalMap,roughnessMap]=await Promise.all(['Diffuse','nor_gl','Rough'].map(async type=>{
   const tex=await loader.loadAsync(files['./scans/'+name+'_'+type+'.jpg']);
   if(type==='Diffuse')tex.colorSpace=T.SRGBColorSpace;
   tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;return tex;
  }));
  return new T.MeshStandardMaterial({color,map,normalMap,roughnessMap,roughness:.94,normalScale:new T.Vector2(.7,.7)});
 }
 const [wall,floor,plaster,masonry]=await Promise.all([material('cracked_concrete_wall',0xb8b7b0),material('concrete_floor_damaged_01',0x939791),material('peeling_painted_wall',0xffffff),material('red_brick_plaster_patch_02',0xffffff)]);
 plaster.normalScale.set(.94,.94);
 return {wall,floor,plaster:finishPlaster(plaster,masonry)};
}
