// At a distance a fixture subtends a small solid angle. Integrate it as a
// single incident direction on rough paint, concrete, bark and glass. Keep
// the full rectangular reflection on polished metal and clear-coated paint.
const fixtureLighting = `
#if NUM_RECT_AREA_LIGHTS > 0
void fixtureLight(RectAreaLight light, vec3 position, vec3 normal, vec3 viewDir,
                  vec3 coatNormal, PhysicalMaterial material, inout ReflectedLight result) {
  vec3 offset = light.position - position;
  float distanceSq = max(dot(offset, offset), 0.0001);
  vec3 direction = offset * inversesqrt(distanceSq);
  vec3 areaVector = 4.0 * cross(light.halfWidth, light.halfHeight);
  float projectedArea = dot(areaVector, direction);
  if (projectedArea <= 0.0) return;
  // Close to a window or fluorescent tube its edges span multiple directions.
  float extentSq = dot(light.halfWidth, light.halfWidth) + dot(light.halfHeight, light.halfHeight);
  float farWeight = smoothstep(4.0 * extentSq, 9.0 * extentSq, distanceSq);
  vec3 radiance = light.color;
  if (farWeight < 1.0) {
    light.color = radiance * (1.0 - farWeight);
    RE_Direct_RectArea_Physical(light, position, normal, viewDir, coatNormal, material, result);
    if (farWeight == 0.0) return;
  }
  IncidentLight incident;
  incident.visible = true;
  incident.direction = direction;
  incident.color = radiance * farWeight * projectedArea / (distanceSq + extentSq);
  RE_Direct_Physical(incident, position, normal, viewDir, coatNormal, material, result);
}
#undef RE_Direct_RectArea
#define RE_Direct_RectArea fixtureLight
#endif
`;

export function optimizeFixtureLighting(scene){
  const materials = new Set();
  scene.traverse(object => {
    if (object.isMesh) materials.add(object.material);
  });
  for (const material of materials) {
    const faintGlass = material.transparent && material.specularIntensity <= .1;
    if (!material.isMeshStandardMaterial || material.metalness >= .4 ||
        material.clearcoat > 0 || (!faintGlass && material.roughness < .4)) continue;
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => key + ':fixtures';
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      const include = '#include <lights_physical_pars_fragment>';
      shader.fragmentShader = shader.fragmentShader.replace(include, include + '\n' + fixtureLighting);
    };
  }
}
