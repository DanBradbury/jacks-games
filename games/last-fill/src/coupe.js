import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {group,mesh,mat,rubber,metal,chrome,box,oval,tube,panel,cylinder,bake} from './geometry.js';

import {bodyShell,deckPoint,lacquer,noseDepth,rearHardware,sidePoint} from './coupe-body.js';
import {carOptics} from './car-optics.js';
import {wetPane} from './rain.js';
import {doorRelease} from './door-release.js';
import {bucketSeats} from './bucket-seats.js';
import {driverDash} from './cockpit.js';
import wheelResponse from './wheel-response.webp';
import wheelImage from './rally-wheel.jpg';

// Revolve a radial profile while projecting the photographed face onto the dish and sidewall.
function rallyWheel(parent,finish){
  const profile=[[.005,.106],[.068,.143],[.090,.132],[.112,.093],[.16,.078],[.213,.101],[.226,.112],
    [.240,.104],[.277,.110],[.316,.099],[.337,.079],[.347,.051],[.349,-.062],[.335,-.097]];
  const shape=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),80);
  const pos=shape.attributes.position,uv=shape.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,.5+pos.getX(i)/.70,.5+pos.getZ(i)/.70);
  mesh(parent,shape,finish);
}
function skin(parent,sample,finish,across=24,along=12){
  const vertices=[],uv=[],idx=[];
  for(let j=0;j<=along;j++)for(let i=0;i<=across;i++){
    const [x,y,z]=sample(i/across*2-1,j/along);
    vertices.push(x,y,z);uv.push(6.2*(x+.52*z),6.2*(y+.77*z));
    if(i&&j){const n=j*(across+1)+i;idx.push(n-across-2,n-across-1,n,n-across-2,n,n-1)}
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(idx);geometry.computeVertexNormals();
  return mesh(parent,geometry,finish);
}
// Fit each intermediate point to the sheet metal. Interpolating in 3D
// between only the corner landmarks cuts across a convex panel.
function panelGap(car,landmarks,surface,radius){
  const curve=new T.SplineCurve(landmarks.map(([a,b])=>new T.Vector2(a,b)));
  const seam=curve.getPoints(landmarks.length*7).map(p=>new T.Vector3(...surface(p.x,p.y)));
  const path=new T.CatmullRomCurve3(seam);
  mesh(car,new T.TubeGeometry(path,seam.length*2,radius,6,false),rubber);
}
function windshield(u,v){
  return [u*(.78-.205*v),.838+.432*v+(.012+.025*v)*(1-u*u),
    .65*(1-v)+.005*v+(.115-.068*v)*(1-u*u)];
}
function roof(u,v){
  const [x,y,z]=windshield(u,1);
  return [T.MathUtils.lerp(x,u*.595,v),y+.011*v*(1-u*u)+.014*Math.sin(Math.PI*v),
    T.MathUtils.lerp(z,-.754,v)];
}

// Sweep the reveal moulding and its padded backing on one continuous section.
// Both finishes share borders and turn the windshield corner together.
function windowFrame(car,side,metalFinish,padding){
  const foot=new T.Vector3(...windshield(side,0)),corner=new T.Vector3(...roof(side,0));
  const bend=new T.QuadraticBezierCurve3(
    new T.Vector3(...windshield(side,.963)),corner,new T.Vector3(...roof(side,.040)));
  const sections=[new T.Vector3(...windshield(side,-.17)),new T.Vector3(...windshield(side,-.08))];
  for(let j=0;j<=16;j++)sections.push(foot.clone().lerp(bend.v0,j/16));
  const startOfBend=sections.length-1;
  for(let j=1;j<=10;j++)sections.push(bend.getPoint(j/10));
  const endOfBend=sections.length-1;
  for(let j=1;j<=32;j++)sections.push(new T.Vector3(...roof(side,.040+.960*j/32)));
  const rearCorner=sections.at(-1);
  sections.push(rearCorner.clone().add(new T.Vector3(-side*.014,-.006,-.009)));
  const frames=sections.map((center,i)=>{
    const tangent=sections[Math.min(i+1,sections.length-1)].clone()
      .sub(sections[Math.max(0,i-1)]).normalize();
    const upper=new T.Vector3(0,-tangent.z,tangent.y).normalize();
    const outer=new T.Vector3().crossVectors(tangent,upper).multiplyScalar(side);
    const post=1-T.MathUtils.smoothstep(i,startOfBend,endOfBend);
    return {center,outer,upper,depth:.019+.007*post,width:.016+.017*post};
  });
  function band(from,to,finish){
    skin(car,(u,v)=>{
      const f=frames[Math.round(v*(frames.length-1))];
      const a=T.MathUtils.lerp(from,to,(u+1)/2)*-side;
      return f.center.clone().addScaledVector(f.outer,f.depth*Math.cos(a)-.006)
        .addScaledVector(f.upper,f.width*Math.sin(a)).toArray();
    },finish,16,frames.length-1);
  }
  // Chrome rolls over the exterior face; vinyl wraps the cabin side.
  band(-1.20,1.20,metalFinish);
  band(1.20,2*Math.PI-1.20,padding);
}
export function coupe(parent,loader,clock,optics){
  const wheels=loader.load(wheelImage);wheels.colorSpace=T.SRGBColorSpace;wheels.anisotropy=4;
  const wheelFinish=loader.load(wheelResponse);wheelFinish.anisotropy=6;
  const wheelMaterial=mat(0xdfdcd4,{map:wheels,metalnessMap:wheelFinish,metalness:.74,roughnessMap:wheelFinish,
    roughness:1,bumpMap:wheelFinish,bumpScale:.00075,side:T.DoubleSide});
  const car=group(parent,2.03,.012,-7.3);
  car.rotation.y=Math.PI-.09;
  const red=lacquer();
  const {glass,doorMirror,cabinMirror,capture}=carOptics(car);
  function glazing(owner,surface,width,height,offset){
    const pane=skin(owner,surface,glass(surface(0,.5)),32,12);
    const uv=pane.geometry.attributes.uv;
    for(let j=0;j<=12;j++)for(let i=0;i<=32;i++)uv.setXY(j*33+i,i/32*width,j/12*height);
    wetPane(owner,0,0,0,width,height,offset,clock,optics,pane.geometry);
  }
  const windowTrim=mat(0xa4a5a1,{metalness:.84,roughness:.39});
  const pillarPadding=mat(0x282625,{roughness:.75});
  const leather=mat(0x382622),amber=mat(0xb67324,{roughness:.29}),reflector=mat(0x84241b,{roughness:.28});
  // Build the movable assembly in body coordinates, then reparent it to the
  // forward hinge after the fixed shell has been batched.
  const leaf=new T.Group(),pulls={};
  let driverRelease;
  const openings=bodyShell(car,leaf,red);
  rearHardware(car);
  for(const s of [-1,1]){
    const grille=group(car,s*.44,.366,noseDepth(s*.44,.366)-.026);
    grille.rotation.y=s*.21;
    box(grille,0,0,0,.51,.105,.025,rubber);
    for(let j=0;j<3;j++)box(grille,0,-.034+j*.031,.017,.49,.008,.012,metal);
    for(let j=0;j<10;j++)box(grille,-.225+j*.05,0,.017,.006,.089,.012,rubber);
    box(grille,s*.23,.003,.021,.095,.063,.017,amber);
  }
  for(const s of [-1,1]){
    for(const z of [-1.39,1.34]){
      // Recessed wheel tubs block daylight through the opposite arch.
      const liner=cylinder(car,s*.755,.353,z,.393,.393,.178,rubber,64);liner.rotation.z=Math.PI/2;
      const wheel=group(car,s*.84,.355,z);wheel.rotation.z=-s*Math.PI/2;
      rallyWheel(wheel,wheelMaterial);
    }
    const onSide=(y,z,offset)=>sidePoint(s,y,z,offset);
    const door=s===1?leaf:car;
    const rockerProfile=new T.SplineCurve([[-.94,.29],[-.73,.274],[0,.263],[.68,.274],[.90,.29]]
      .map(([z,y])=>new T.Vector2(z,y)));
    tube(car,rockerProfile.getPoints(48).map(p=>onSide(p.y,p.x,.004)),.008,windowTrim);
    const shut=[[.801,-.73],[.71,-.765],[.48,-.745],[.347,-.66],[.325,-.43],[.327,.34],[.36,.48],[.49,.537],[.71,.554],[.792,.536]];
    if(s<0)panelGap(car,shut,(y,z)=>onSide(y,z,.0012),.0035);
    else panelGap(leaf,[[.79,-.774],[.58,-.774],[.34,-.774],[.326,-.65],[.326,.42],[.34,.549],[.59,.549],[.78,.549]],(y,z)=>onSide(y,z,.0012),.0035);
    const release=doorRelease(door,s,openings[s<0?0:1],red,windowTrim);
    if(s===1){driverRelease=release;pulls.outside=release.pads}
    else release.mount.add(release.rocker);
    for(let j=0;j<3;j++){
      const vent=group(car,...onSide(.60,.697+j*.070,.002));
      vent.rotation.x=-.19;
      oval(vent,0,0,0,.008,.080,.016,rubber);
      tube(vent,[[s*.005,-.053,-.008],[s*.009,0,-.010],[s*.006,.058,-.008]],.003,red);
    }
    for(const [z,y,lens] of [[-1.98,.48,reflector],[1.92,.46,amber]]){
      const marker=group(car,...onSide(y,z,.001));
      marker.rotation.y=s*(z<0?-.18:.07);
      mesh(marker,new RoundedBoxGeometry(.014,.043,.121,2,.006),rubber);
      mesh(marker,new RoundedBoxGeometry(.010,.031,.108,2,.004),lens,s*.007,0,0);
    }
    const sideGlass=(u,v)=>{
      const t=(u+1)*.5,z=T.MathUtils.lerp(-.807,.599,t);
      const lower=deckPoint(s*.757,z);
      const top=roof(s,.916*(1-t));
      return [T.MathUtils.lerp(lower[0],top[0]-s*.008,v)+s*.008*Math.sin(Math.PI*v),
        T.MathUtils.lerp(lower[1]-.006,top[1]-.011,v),T.MathUtils.lerp(z,top[2],v)];
    };
    glazing(door,sideGlass,1.39,.46,3+s);
    windowFrame(car,s,windowTrim,pillarPadding);
    // Set the belt moulding into the door crown, with separate fixed ends at the jambs.
    const beltSections=s===1?[[-.86,-.776,car],[-.774,.549,door],[.551,.65,car]]:[[-.86,.65,car]];
    for(const [from,to,owner] of beltSections){
      const belt=[];
      for(let j=0;j<=40;j++){
        const z=from+(to-from)*j/40,p=deckPoint(s*.770,z);p[1]+=.004;belt.push(p);
      }
      tube(owner,belt,.0075,windowTrim);
    }

    // Trace shut lines directly on the compound-curved deck.
    const line=(coords,r)=>panelGap(car,coords,(x,z)=>deckPoint(s*x,z),r);
    line([[.43,1.83],[.57,1.83],[.72,1.83],[.735,1.87],[.716,2.02],[.68,2.043],[.53,2.056],[.44,2.054],[.425,2.015],[.426,1.91],[.43,1.83]],.0028);
    line([[.66,.63],[.64,.81],[.60,1.11],[.52,1.46],[.415,1.75],[.385,1.81],[.26,1.82],[0,1.82]],.0028);
    doorMirror(door,s,deckPoint(s*.786,.32));
  }
  glazing(car,windshield,1.50,.80,6);
  // Bridge the cowl to the glass and continue the padded dash to its inner seal.
  skin(car,(u,v)=>{
    const p=windshield(u,0),q=deckPoint(p[0],p[2]+.105);
    return [p[0],T.MathUtils.lerp(p[1]-.003,q[1],v),T.MathUtils.lerp(p[2],q[2],v)];
  },red,40,6);
  skin(car,(u,v)=>{
    const p=windshield(u,0);
    return [u*(.685+.095*v),T.MathUtils.lerp(.869,p[1]-.002,v),T.MathUtils.lerp(.47,p[2],v)];
  },mat(0x27282a,{roughness:.78,side:T.DoubleSide}));
  cabinMirror();
  for(const v of [0,1]){
    const rim=Array.from({length:13},(_,i)=>windshield(i/6-1,v));
    tube(car,rim,v?.011:.009,rubber);
  }
  skin(car,roof,red);
  skin(car,(u,v)=>{
    const [x,y,z]=roof(u,v);
    return [x*.984,y-.014,z];
  },mat(0x352e2b,{side:T.DoubleSide,roughness:.98}));
  tube(car,Array.from({length:25},(_,j)=>roof(0,j/24)),.0045,rubber);
  const backlight=(u,v)=>[
    u*(.602-.031*v),.895+.370*v+.015*(1-u*u),
    -.977+.209*v-.024*(1-u*u)
  ];
  glazing(car,backlight,1.18,.42,9);
  skin(car,(u,v)=>{
    const p=backlight(u,0),q=deckPoint(p[0],-1.19);
    return [p[0],T.MathUtils.lerp(p[1]-.005,q[1],v),T.MathUtils.lerp(p[2],q[2],v)];
  },red,32,8);
  for(const v of [0,1])tube(car,Array.from({length:17},(_,j)=>backlight(j/8-1,v)),.014,rubber);
  skin(car,(u,v)=>[u*(.595-.024*v),
    T.MathUtils.lerp(1.27+.048*(1-u*u),backlight(u,1)[1],v),
    T.MathUtils.lerp(-.754,backlight(u,1)[2],v)],red,24,5);
  for(const s of [-1,1]){
    tube(car,[backlight(s,0),backlight(s,.5),backlight(s,1)],.014,rubber);
    // The sail blends the T-top's trailing corner into the rear haunch.
    const crown=new T.CatmullRomCurve3([[s*.59,1.28,-.69],[s*.595,1.27,-.754],backlight(s,1)].map(p=>new T.Vector3(...p)));
    const foot=new T.CatmullRomCurve3([[s*.77,.86,-.86],deckPoint(s*.78,-1.32),backlight(s,0)].map(p=>new T.Vector3(...p)));
    skin(car,(u,v)=>{
      const edge=crown.getPoint((u+1)/2).lerp(foot.getPoint((u+1)/2),v);
      edge.x+=s*.022*(1-u*u)*Math.sin(Math.PI*v);
      return edge.toArray();
    },red,20,14);
    const door=s===1?leaf:car;
    mesh(door,new RoundedBoxGeometry(.075,.432,1.27,3,.025),leather,s*.661,.601,-.113);
    mesh(door,new RoundedBoxGeometry(.082,.069,1.24,3,.02),rubber,s*.668,.791,-.11);
    for(let j=0;j<4;j++)
      tube(door,[[s*.621,.493+j*.017,-.66],[s*.620,.493+j*.017,-.12],[s*.621,.493+j*.017,.44]],.0025,rubber);
    mesh(door,new RoundedBoxGeometry(.065,.05,.43,3,.020),leather,s*.609,.602,-.19);
    const grip=group(door,s*.554,.682,-.193);
    mesh(grip,new RoundedBoxGeometry(.026,.027,.220,4,.012),leather);
    for(const end of [-1,1]){
      tube(grip,[[0,0,end*.105],[s*.012,.005,end*.126],[s*.067,.011,end*.149]],.013,leather);
      box(grip,s*.067,.011,end*.149,.009,.039,.043,windowTrim);
    }
    if(s===1)pulls.inside=grip;
    box(door,s*.620,.707,.151,.011,.041,.109,rubber);
    box(door,s*.608,.705,.151,.017,.014,.080,windowTrim);

  }
  bucketSeats(car);
  box(car,0,.806,-.882,1.25,.078,.35,leather);
  box(car,0,.532,-.10,1.42,.030,1.34,rubber);
  const scuffPlate=mat(0x807b70,{metalness:.49,roughness:.54});
  box(car,.754,.328,-.11,.139,.027,1.34,scuffPlate);
  for(let j=0;j<5;j++)box(car,.703+.024*j,.343,-.11,.004,.004,1.24,scuffPlate);
  for(const z of [-.74,.515])for(const x of [.714,.793])oval(car,x,.344,z,.005,.002,.005,rubber);
  // Local +X is the driver's left when facing the hood (+Z).
  driverDash(car,.39);
  box(car,0,.631,-.102,.165,.217,.43,rubber);
  tube(car,[[0,.71,-.145],[0,.784,-.13],[0,.831,-.105]],.011,chrome);
  oval(car,0,.84,-.105,.027,.031,.027,rubber);
  // Park the two articulated blades against the curvature of the lower glass.
  for(const start of [-.89,.06]){
    const blade=[];
    for(let i=0;i<=12;i++){
      const t=i/12,u=start+.79*t,v=.029+.049*t+.010*Math.sin(Math.PI*t);
      const p=windshield(u,v);p[1]+=.004;p[2]+=.005;blade.push(p);
    }
    tube(car,blade,.0034,rubber);
    const joint=blade[6],base=windshield(start+.61,.006);
    tube(car,[base,[base[0]-.024,base[1]+.008,base[2]], [joint[0],joint[1]+.004,joint[2]+.006]],.0036,windowTrim);
  }
  // The closed, body-colored fuel door follows the deck crown. Its gasket is
  // visible only as a narrow panel gap around the flush painted lid.
  const fuelSeam=new T.RingGeometry(.101,.104,72);
  fuelSeam.rotateX(-Math.PI/2);
  const rim=fuelSeam.attributes.position;
  for(let i=0;i<rim.count;i++)rim.setXYZ(i,...deckPoint(rim.getX(i),-1.71+rim.getZ(i)));
  fuelSeam.computeVertexNormals();mesh(car,fuelSeam,rubber);
  bake(car);
  bake(leaf);
  const {mount,rocker:lever}=driverRelease;mount.add(lever);
  const hinge=group(car,.779,.555,.554);
  leaf.position.copy(hinge.position).negate();hinge.add(leaf);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d'),shade=ctx.createRadialGradient(64,64,0,64,64,64);
  shade.addColorStop(0,'rgba(0,0,0,.85)');shade.addColorStop(.58,'rgba(0,0,0,.66)');shade.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shade;ctx.fillRect(0,0,128,128);
  const shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false});
  function contact(x,z,width,depth){
    const spot=new T.Mesh(new T.PlaneGeometry(width,depth),shadowMat);
    spot.rotation.x=-Math.PI/2;spot.position.set(x,.016,z);spot.renderOrder=2;car.add(spot);
  }
  contact(0,0,2.85,5.8);
  for(const s of [-1,1])for(const z of [-1.39,1.34])contact(s*.84,z,.66,.90);
  return {car,hinge,lever,pulls,capture};
}
