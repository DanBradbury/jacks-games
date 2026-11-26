import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {group,mesh,mat,rubber,metal,chrome,box,oval,tube,panel,cylinder,bake} from './geometry.js';

import {bodyShell,deckPoint,lacquer,noseDepth,rearHardware,sidePoint} from './coupe-body.js';
import wheelImage from './rally-wheel.jpg';

// Revolve a radial profile while projecting the photographed face onto the dish and sidewall.
function rallyWheel(parent,map){
  const profile=[[.005,.106],[.068,.143],[.090,.132],[.112,.093],[.16,.078],[.213,.101],[.226,.112],
    [.240,.104],[.277,.110],[.316,.099],[.337,.079],[.347,.051],[.349,-.062],[.335,-.097]];
  const shape=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),80);
  const pos=shape.attributes.position,uv=shape.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,.5+pos.getX(i)/.70,.5+pos.getZ(i)/.70);
  mesh(parent,shape,mat(0xe8e4da,{map,metalness:.18,roughness:.44,side:T.DoubleSide}));
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
export function coupe(parent,loader){
  const wheels=loader.load(wheelImage);wheels.colorSpace=T.SRGBColorSpace;wheels.anisotropy=4;
  const car=group(parent,2.03,.012,-7.3);
  car.rotation.y=Math.PI-.09;
  const red=lacquer();
  const glass=new T.MeshPhysicalMaterial({color:0x526363,ior:1.51,roughness:.12,specularIntensity:.24,
    transparent:true,depthWrite:false,opacity:.26,side:T.DoubleSide});
  const windowTrim=mat(0xa4a5a1,{metalness:.84,roughness:.39});
  const leather=mat(0x382622),amber=mat(0xb67324,{roughness:.29}),reflector=mat(0x84241b,{roughness:.28});
  bodyShell(car,red);
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
      rallyWheel(wheel,wheels);
    }
    const onSide=(y,z,offset)=>sidePoint(s,y,z,offset);
    tube(car,[[-.94,.29],[-.73,.274],[0,.263],[.68,.274],[.90,.29]].map(([z,y])=>onSide(y,z,.002)),.012,windowTrim);
    const shut=[[.801,-.73],[.71,-.765],[.48,-.745],[.347,-.66],[.325,-.43],[.327,.34],[.36,.48],[.49,.537],[.71,.554],[.792,.536]];
    panelGap(car,shut,(y,z)=>onSide(y,z,.0012),.0035);
    const latch=group(car,...onSide(.736,-.556,.002));
    oval(latch,0,0,0,.009,.028,.085,rubber);
    box(latch,s*.007,.008,0,.015,.019,.128,windowTrim);
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
    const front=[s*.78,.86,.65],a=[s*.575,1.27,.005],b=[s*.59,1.28,-.69];
    panel(car,[front,a,b,[s*.77,.86,-.86]],glass);
    tube(car,[front,a],.025,windowTrim);
    tube(car,[a,[s*.595,1.30,-.31],b],.015,windowTrim);
    tube(car,[front,[s*.788,.863,-.11],[s*.77,.86,-.86]],.010,windowTrim);

    // Trace shut lines directly on the compound-curved deck.
    const line=(coords,r)=>panelGap(car,coords,(x,z)=>deckPoint(s*x,z),r);
    line([[.43,1.83],[.57,1.83],[.72,1.83],[.735,1.87],[.716,2.02],[.68,2.043],[.53,2.056],[.44,2.054],[.425,2.015],[.426,1.91],[.43,1.83]],.0028);
    line([[.66,.63],[.64,.81],[.60,1.11],[.52,1.46],[.415,1.75],[.385,1.81],[.26,1.82],[0,1.82]],.0028);
    tube(car,[onSide(.816,.34),[s*.87,.856,.34],[s*.91,.883,.35]],.017,red);
    oval(car,s*.923,.908,.34,.108,.063,.116,red);
    oval(car,s*.923,.908,.266,.089,.050,.026,rubber);
    oval(car,s*.923,.908,.251,.082,.044,.016,chrome);

    const seat=group(car,s*.365,.80,-.33);seat.rotation.x=-.24;
    oval(seat,0,.07,0,.231,.265,.102,leather);
    for(const edge of [-1,1])oval(seat,edge*.194,.015,.060,.047,.192,.065,leather);
    for(let i=0;i<5;i++)tube(seat,[[-.145,-.041+i*.047,.095],[0,-.048+i*.047,.106],[.145,-.041+i*.047,.095]],.003,rubber);
    oval(seat,0,.269,-.026,.168,.097,.079,leather);
  }
  const windshield=(u,v)=>[
    u*(.78-.205*v),.86+.41*v+.018*(1-u*u),
    .65*(1-v)+.005*v+(.115-.068*v)*(1-u*u)
  ];
  skin(car,windshield,glass);
  for(const v of [0,1]){
    const rim=Array.from({length:13},(_,i)=>windshield(i/6-1,v));
    tube(car,rim,.019,rubber);
  }
  skin(car,(u,v)=>[u*(.578+.017*v),1.27+.048*(1-u*u)+.014*Math.sin(Math.PI*v),.006-.76*v+.047*(1-u*u)*(1-v)],red);
  tube(car,[[0,1.32,.044],[0,1.329,-.30],[0,1.318,-.74]],.006,rubber);
  const backlight=(u,v)=>[
    u*(.602-.031*v),.895+.370*v+.015*(1-u*u),
    -1.097+.329*v-.041*(1-u*u)
  ];
  skin(car,backlight,glass,32,12);
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
    box(car,s*.68,.672,-.15,.10,.25,.91,leather);
    oval(car,s*.36,.73,-.30,.24,.105,.29,leather);
  }
  box(car,0,.806,-.882,1.25,.078,.35,leather);
  box(car,0,.786,.37,1.39,.19,.32,rubber);
  // The model faces +Z, so its left-hand driving position is on local +X.
  const driverX=.39;
  for(const x of [driverX-.087,driverX+.085]){
    const gauge=cylinder(car,x,.82,.194,.075,.075,.022,metal,36);gauge.rotation.x=Math.PI/2;
    const dial=cylinder(car,x,.82,.18,.066,.066,.010,rubber,36);dial.rotation.x=Math.PI/2;
    tube(car,[[x,.82,.172],[x-.032,.854,.172]],.003,chrome);
  }
  box(car,0,.631,-.102,.165,.217,.43,rubber);
  tube(car,[[0,.71,-.145],[0,.784,-.13],[0,.831,-.105]],.011,chrome);
  oval(car,0,.84,-.105,.027,.031,.027,rubber);
  tube(car,[[.10,.873,.74],[.32,.884,.67],[.61,.883,.61]],.008,rubber);
  
  tube(car,[[-.74,.877,.62],[-.57,.901,.55],[-.27,.902,.54]],.009,rubber);
  const wheel=mesh(car,new T.TorusGeometry(.15,.014,10,32),rubber,driverX,.94,.2);wheel.rotation.x=-.36;
  for(let k=0;k<3;k++){
    const a=k*2*Math.PI/3+.35;
    tube(car,[[driverX,.94,.2],[driverX+.13*Math.cos(a),.94+.124*Math.sin(a),.2-.040*Math.sin(a)]],.008,chrome);
  }
  // The closed, body-colored fuel door follows the deck crown. Its gasket is
  // visible only as a narrow panel gap around the flush painted lid.
  const fuelSeam=new T.RingGeometry(.101,.104,72);
  fuelSeam.rotateX(-Math.PI/2);
  const rim=fuelSeam.attributes.position;
  for(let i=0;i<rim.count;i++)rim.setXYZ(i,...deckPoint(rim.getX(i),-1.71+rim.getZ(i)));
  fuelSeam.computeVertexNormals();mesh(car,fuelSeam,rubber);
  bake(car);
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
  return car;
}
