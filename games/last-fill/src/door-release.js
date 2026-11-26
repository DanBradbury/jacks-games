import * as T from 'three';
import {group,mesh,mat,rubber,cylinder} from './geometry.js';
import {deckPoint,sidePoint} from './coupe-body.js';

const platedMetal=mat(0xc4c5c2,{metalness:.88,roughness:.26});

// Coordinate system of the casting: X runs across the narrow dimension,
// Y is the outward skin normal, Z follows the length of the door.
function roundedOutline(halfWidth,halfLength){
  const r=.010,points=[];
  for(let c=0;c<4;c++){
    const cx=(c===0||c===3?1:-1)*(halfWidth-r);
    const cz=(c<2?1:-1)*(halfLength-r);
    for(let j=0;j<=8;j++){
      const a=(c+j/8)*Math.PI/2;
      const x=cx+r*Math.cos(a),z=cz+r*Math.sin(a);
      points.push(new T.Vector2(x,z*(.974+.026*x/halfWidth)));
    }
  }
  return points;
}

function casting(parent,sections,material,cap=false){
  const vertices=[],indices=[];
  for(const [w,l,y] of sections){
    const points=roundedOutline(w,l),start=vertices.length/3,n=points.length;
    for(let i=0;i<n;i++){
      const k=start+i,q=start+(i+1)%n,p=points[i];
      vertices.push(p.x,y,p.y);
      if(start)indices.push(k-n,k,q-n,q-n,k,q);
    }
    if(cap&&start===(sections.length-1)*n){
      const center=vertices.length/3;vertices.push(0,y+.00025,0);
      for(let i=0;i<n;i++)indices.push(start+i,center,start+(i+1)%n);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(parent,g,material);
}

export function doorRelease(owner,side,boundary,paint,trim){
  const z=(Math.min(...boundary.map(p=>p.z))+Math.max(...boundary.map(p=>p.z)))/2;
  function shoulder(z,dx=0){
    const width=Math.abs(sidePoint(side,.90,z)[0]);
    return new T.Vector3(...deckPoint(side*width*.966+dx,z));
  }
  const center=shoulder(z);center.y-=.0014; // deckPoint includes clearance for applied trim
  const across=shoulder(z,.001).sub(shoulder(z,-.001));
  const along=shoulder(z+.001).sub(shoulder(z-.001)).normalize();
  const normal=along.clone().cross(across).normalize();across.crossVectors(normal,along).normalize();
  const mount=group(owner,...center.toArray());
  mount.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(across,normal,along));
  const inverse=mount.quaternion.clone().invert();
  const outer=boundary.map(p=>p.clone().sub(center).applyQuaternion(inverse));
  const opening=roundedOutline(.027,.081);
  const surround=new T.BufferGeometry();
  const edges=outer.map(p=>new T.Vector2(p.x,p.z));
  const triangles=T.ShapeUtils.triangulateShape(edges,[opening]);
  surround.setAttribute('position',new T.Float32BufferAttribute([
    ...outer.flatMap(p=>p.toArray()),...opening.flatMap(p=>[p.x,0,p.y])
  ],3));
  surround.setIndex(triangles.flatMap(([a,b,c])=>[a,c,b]));
  surround.computeVertexNormals();mesh(mount,surround,paint);

  // Rolled bezel meets the paint at its outer edge. The pocket continues
  // below the cutout to give the pressed end somewhere to travel.
  casting(mount,[[.027,.081,0],[.0263,.0803,.0009],[.0245,.0785,.0012],[.0235,.0775,-.0008]],platedMetal);
  casting(mount,[[.0235,.0775,-.0008],[.0234,.0774,-.026],[.022,.076,-.027]],rubber,true);
  const pivotX=side*.010;
  const rocker=new T.Group();rocker.position.set(pivotX,-.0010,0);
  const plate=casting(rocker,[[.022,.076,-.0019],[.0222,.0762,-.0005],[.0215,.0755,.0003],
    [.0195,.0735,.0004]],platedMetal,true);
  plate.position.x=-pivotX;
  const pads=group(rocker,-pivotX,.00055,0);

  // Key barrel sits in the vertical skin below the release.
  const key=group(owner,...sidePoint(side,center.y-.127,z+.029,.0004));
  key.rotation.z=-side*Math.PI/2;
  cylinder(key,0,0,0,.016,.018,.0025,trim,32);
  cylinder(key,0,.0020,0,.012,.013,.0018,mat(0x514e46,{metalness:.69,roughness:.39}),32);
  const slot=mesh(key,new T.BoxGeometry(.0021,.001,.011),rubber,0,.0032,0);
  slot.rotation.y=.22;
  return {mount,rocker,pads};
}
