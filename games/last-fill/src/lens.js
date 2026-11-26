import * as T from 'three';

export const waterLayer=1;

// Scatter only bright sources into adjacent pixels. Work in scene-linear light so
// the white tubes and lightning contribute more than gray sky or wet concrete.
export function cameraLens(renderer){
  const depth=new T.DepthTexture(1,1,T.UnsignedIntType);
  const picture=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2,depthTexture:depth});
  const bright=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  const horizontal=bright.clone();
  const water=bright.clone();
  const optics={backdrop:{value:picture.texture},surfaceDepth:{value:depth},resolution:{value:new T.Vector2()}};
  const camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;
  const screen=new T.Scene();screen.add(quad);
  const texel=new T.Vector2();
  function pass(fragment,uniforms){
    return new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'varying vec2 v;'+fragment});
  }
  const composite=`uniform sampler2D src,waterImage;
    vec3 sceneColor(){vec4 w=texture2D(waterImage,v);return texture2D(src,v).rgb*(1.-w.a)+w.rgb;}`;
  const images={src:{value:picture.texture},waterImage:{value:water.texture}};
  const threshold=pass(composite+`void main(){
    vec3 c=sceneColor();float peak=max(c.r,max(c.g,c.b));
    gl_FragColor=vec4(c*smoothstep(.9,2.6,peak),1.);
  }`,images);
  const blur=`vec3 blurSource(sampler2D src,vec2 axis){
    return texture2D(src,v).rgb*.227027+
      (texture2D(src,v+axis*1.384615).rgb+texture2D(src,v-axis*1.384615).rgb)*.316216+
      (texture2D(src,v+axis*3.230769).rgb+texture2D(src,v-axis*3.230769).rgb)*.070270;
  }`;
  const soften=pass(blur+`uniform sampler2D src;uniform vec2 texel;void main(){
    gl_FragColor=vec4(blurSource(src,vec2(texel.x,0.)),1.);
  }`,{src:{value:bright.texture},texel:{value:texel}});
  const finish=pass(blur+composite+`uniform sampler2D glow;uniform vec2 texel;void main(){
    vec3 c=sceneColor()+blurSource(glow,vec2(0.,texel.y))*.21;
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,{...images,glow:{value:horizontal.texture},texel:{value:texel}});
  return {
    optics,
    async prepare(scene,view){
      // Compile later shots (hands, car and craft) against the same linear
      // render target used in playback, before the film clock starts.
      renderer.setRenderTarget(picture);
      try{await renderer.compileAsync(scene,view)}
      finally{renderer.setRenderTarget(null)}
    },
    resize(w,h){
      water.setSize(w,h);optics.resolution.value.set(w,h);
      picture.setSize(w,h);const bw=Math.max(1,Math.ceil(w/5)),bh=Math.max(1,Math.ceil(h/5));
      bright.setSize(bw,bh);horizontal.setSize(bw,bh);texel.set(1/bw,1/bh);
    },
    draw(scene,view){
      renderer.setRenderTarget(picture);renderer.render(scene,view);
      // Water samples the resolved scene and its depth. Keep it on a separate
      // transparent target to avoid reading pixels we are currently writing.
      const background=scene.background,mask=view.layers.mask,alpha=renderer.getClearAlpha();
      const update=scene.matrixWorldAutoUpdate;
      scene.matrixWorldAutoUpdate=false;scene.background=null;view.layers.set(waterLayer);
      renderer.setClearAlpha(0);renderer.setRenderTarget(water);renderer.render(scene,view);
      renderer.setClearAlpha(alpha);scene.background=background;view.layers.mask=mask;scene.matrixWorldAutoUpdate=update;
      quad.material=threshold;renderer.setRenderTarget(bright);renderer.render(screen,camera);
      quad.material=soften;renderer.setRenderTarget(horizontal);renderer.render(screen,camera);
      quad.material=finish;renderer.setRenderTarget(null);renderer.render(screen,camera);
    }
  };
}
