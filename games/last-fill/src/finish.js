// Faded paint, coarse pitting and vertical water tracks on exposed metal.
export function weather(material,amount=.45){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 weatherPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nweatherPoint=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`varying vec3 weatherPoint;
      float speck(vec2 p){return fract(sin(dot(p,vec2(41.73,275.19)))*43758.545);}
      float noise2(vec2 p){vec2 f=fract(p);f=f*f*(3.-2.*f);p=floor(p);
        return mix(mix(speck(p),speck(p+vec2(1,0)),f.x),mix(speck(p+vec2(0,1)),speck(p+1.),f.x),f.y);}
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 q=vec2(weatherPoint.x+weatherPoint.z*.93,weatherPoint.y+weatherPoint.z*.15);
      float streak=noise2(q*vec2(31.,1.8))*.53+noise2(q*vec2(12.,.67))*.47;
      float pit=noise2(q*64.)*.65+noise2(q*9.1)*.35;
      float distress=smoothstep(.55,.86,streak)*.49+smoothstep(.66,.88,pit)*.55;
      diffuseColor.rgb*=1.-${amount.toFixed(3)}*(.17*noise2(q*4.)+distress);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.065,.034),smoothstep(.80,.91,pit)*${amount.toFixed(3)});
    `);
  };
  material.customProgramCacheKey=()=>String(amount);
  return material;
}
