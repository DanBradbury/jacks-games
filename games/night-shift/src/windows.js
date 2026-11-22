// Centers in world-space meters. The tour looks west at z=0. The janitor’s closet
// occupies the opposite wall between z=-6 and z=-12.
export const windowCenters = { '-1': [0,-12], '1': [3,-18] };

export function distanceToWindow(x,z,side){
  const along=Math.min(...windowCenters[side].map(center=>Math.max(0,Math.abs(z-center)-1.22)));
  return Math.hypot(x-side*2.51,along);
}
