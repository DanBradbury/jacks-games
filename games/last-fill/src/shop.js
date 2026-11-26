import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box, cylinder, group, link, mat, mesh, metal, paint, rubber, seed, tube} from './geometry.js';
import {countertopOcclusion,roomSurfaces} from './shop-surfaces.js';
import finishResponse from './shop-finish-response.webp';
import finishesFile from './shop-finishes.jpg';
import labelsFile from './shop-labels.jpg';

function swatches(loader,file,cols,rows,responseFile){
  const materials=[],source=loader.load(file);
  const response=responseFile?loader.load(responseFile):null;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const map=source.clone();
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    map.repeat.set(1/cols-.004,1/rows-.004);
    map.offset.set(col/cols+.002,1-(row+1)/rows+.002);
    const material=mat(0xe7e1d5,{map,roughness:.66});
    if(response){
      const field=response.clone();
      field.repeat.copy(map.repeat);field.offset.copy(map.offset);field.anisotropy=8;
      material.roughnessMap=material.bumpMap=field;
      material.roughness=1;
    }
    materials.push(material);
  }
  return materials;
}

function rolled(parent,x,y,z,w,h,d,r,material){
  return mesh(parent,new RoundedBoxGeometry(w,h,d,2,r),material,x,y,z);
}

const frame=mat(0x4c5352,{metalness:.7,roughness:.32});
const nickel=mat(0xaaa998,{metalness:.74,roughness:.32});
const agedCream=mat(0xb4ad94,{roughness:.57,metalness:.15});
const softBlack=mat(0x24221d,{roughness:.54});
const red=mat(0x82251e,{metalness:.42,roughness:.28});
const frosting=mat(0xe6e5d6,{emissive:0xe5ead9,emissiveIntensity:1.35});
const bottleBody=new T.LatheGeometry([
  [.004,0],[.030,.001],[.034,.007],[.035,.020],[.032,.043],[.031,.100],[.034,.138],
  [.032,.157],[.026,.173],[.016,.190],[.013,.219],[.014,.238],[.016,.239],[.016,.245],[.009,.246]
].map(([r,y])=>new T.Vector2(r,y)),18);
const drinks=[0x31221b,0x35422c,0x774021,0x37261c].map(color=>mat(color,{metalness:.18,roughness:.14}));
const labelBand=new T.CylinderGeometry(.033,.032,.066,18,1,true);
const canBody=new T.CylinderGeometry(.059,.059,.145,24,1,true);
const canLid=new T.CylinderGeometry(.060,.060,.005,24);
function product(p,x,y,z,kind,labels,angle){
  const item=group(p,x,y,z);item.rotation.y=angle;
  if(kind<4){
    mesh(item,bottleBody,drinks[kind]);
    mesh(item,labelBand,labels[kind],0,.104,0);
    cylinder(item,0,.245,0,.016,.017,.007,nickel,14);
  }else if(kind<8){
    mesh(item,canBody,labels[kind],0,.075,0);
    mesh(item,canLid,nickel,0,.003,0);mesh(item,canLid,nickel,0,.148,0);
  }else{
    const h=kind===8?.255:.188,w=kind===11?.119:.145;
    box(item,0,h/2,0,w,h,.056,agedCream);
    mesh(item,new T.PlaneGeometry(w-.002,h-.003),labels[kind],0,h/2,.0285);
  }
}

function stockRack(p,x,z,angle,width,kinds,labels,random){
  const rack=group(p,x,0,z);rack.rotation.y=angle;
  box(rack,0,.57,-.22,width,1.05,.039,frame);
  for(const side of [-1,1])box(rack,side*(width/2-.025),.602,-.24,.034,1.19,.034,nickel);
  for(let level=0;level<3;level++){
    const y=.17+level*.34;
    box(rack,0,y,0,width,.029,.49,agedCream);
    box(rack,0,y+.001,.245,width,.042,.014,nickel);
    const qty=Math.floor(width/.182);
    for(let slot=0;slot<qty;slot++){
      const kind=kinds[(level*2+Math.floor(slot/3))%kinds.length];
      for(let row=0;row<2;row++){
        if(random()<.16)continue;
        const px=(slot+.5)/qty*width-width/2+(random()-.5)*.023;
        product(rack,px,y+.016,.144-row*.145+(random()-.5)*.026,kind,labels,
          (kind<8?-Math.PI:0)+(random()-.5)*.34);
      }
    }
    for(let i=0;i<3;i++)paint(rack,(i-1)*width*.31,y+.003,.255,.096,.035,[[['39¢','59¢','75¢'][i],.77,.52]],'#d0c8a9');
  }
}

function cooler(p,labels){
  const cabinet=group(p,2.07,.089,3.28);cabinet.rotation.y=-.62;
  rolled(cabinet,0,.965,0,1.11,1.93,.67,.075,red);
  box(cabinet,0,1.02,.35,.942,1.38,.032,softBlack);
  paint(cabinet,0,1.79,.35,.91,.145,[['M E S A   C O L A',.63,.52]],'#d9d3ac','#94362b');
  for(let row=0;row<4;row++){
    const y=.35+row*.319;
    box(cabinet,0,y,.442,.85,.022,.19,nickel);
    for(let col=0;col<8;col++)product(cabinet,(col-3.5)*.107,y+.011,.438,
      (Math.floor(col/3)+row)%4,labels,Math.PI+col*.13);
  }
  for(const side of [-1,1]){
    box(cabinet,side*.472,1.017,.50,.047,1.40,.062,nickel);
    box(cabinet,side*.525,.995,.414,.047,1.48,.18,red);
  }
  for(const y of [.331,1.703])box(cabinet,0,y,.50,.95,.049,.06,nickel);
  // A recessed seal and a thin retaining flange give the cabinet glazing an edge.
  for(const side of [-1,1])box(cabinet,side*.450,1.017,.525,.014,1.33,.011,softBlack);
  for(const y of [.354,1.680])box(cabinet,0,y,.525,.912,.012,.011,softBlack);
  const pane=new T.MeshPhysicalMaterial({color:0xc8d5cb,transparent:true,opacity:.078,
    depthWrite:false,roughness:.17,ior:1.51,specularIntensity:.32});
  mesh(cabinet,new T.PlaneGeometry(.90,1.32),pane,0,1.02,.528);
  tube(cabinet,[[.434,.88,.528],[.435,.91,.591],[.435,1.12,.591],[.434,1.15,.528]],.012,nickel);
  for(let i=0;i<6;i++)box(cabinet,0,.069+i*.030,.342,.75,.008,.007,softBlack);
  return pane;
}

// One atlas for the inset legends on the molded till keys.
function keyLegends(keyboard){
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;
  const c=canvas.getContext('2d');c.textAlign='center';c.textBaseline='middle';
  const legends=[['1','2','3','10','20','SUB'],['4','5','6','30','40','TAX'],
    ['7','8','9','50','60','CASH'],['0','00','1/2','70','80','TOTAL']];
  const positions=[],uv=[],indices=[];
  for(const [r,row] of legends.entries())for(const [col,label] of row.entries()){
    c.fillStyle=col<2||col===5?'#ede5cb':'#343029';
    c.font='bold '+(label.length>2?21:32)+'px sans-serif';c.fillText(label,64*col+32,64*r+33);
    const x=(col-2.5)*.048,z=(r-1.5)*.044,n=positions.length/3;
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
      positions.push(x+(u-.5)*.036,.027,z+(.5-v)*.028);uv.push((col+u)/6,1-(r+1-v)/4);
    }
    indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  mesh(keyboard,g,mat(0xffffff,{map,alphaTest:.33,roughness:.76}));
}
function register(counter){
  const till=group(counter,.46,1.05,.20);till.rotation.y=.19;
  rolled(till,0,.069,0,.53,.138,.46,.023,softBlack);
  box(till,0,.072,.235,.474,.083,.012,nickel);
  box(till,0,.080,.246,.143,.012,.012,softBlack);
  const hull=rolled(till,0,.178,-.01,.50,.160,.41,.039,agedCream);
  hull.rotation.x=.08;
  const keyboard=group(till,.035,.259,.041);keyboard.rotation.x=.19;
  box(keyboard,0,0,0,.306,.012,.199,softBlack);
  const keys=[0x46413a,0xbdb498,0x996658].map(c=>mat(c));
  for(let r=0;r<4;r++)for(let c=0;c<6;c++)
    rolled(keyboard,(c-2.5)*.048,.014,(r-1.5)*.044,.038,.026,.032,.005,keys[c===5?2:c<2?1:0]);
  keyLegends(keyboard);
  box(till,0,.122,.208,.452,.005,.008,softBlack);
  const plate=paint(till,.125,.169,.196,.103,.022,[['SIERRA  270',.55,.52]],'#49483d','#d1c7ac');
  plate.rotation.x=.08;
  // Paper emerges from a recessed slot on the operator's left.
  box(till,-.167,.265,-.035,.065,.009,.068,softBlack);
  const tape=new T.PlaneGeometry(.052,.085,1,8),tp=tape.attributes.position;
  for(let i=0;i<tp.count;i++){
    const y=tp.getY(i)+.0425;
    tp.setXYZ(i,tp.getX(i),.042*Math.sin(y*25)+.18*y,-y);
  }
  tape.computeVertexNormals();
  mesh(till,tape,mat(0xd9d1b5,{side:T.DoubleSide,roughness:.94}),-.167,.269,-.011);
  rolled(till,0,.313,-.152,.465,.136,.116,.031,agedCream);
  box(till,0,.327,-.087,.358,.075,.019,softBlack);
  paint(till,0,.329,-.076,.295,.054,[['0   0   0 . 0 0',.77,.53]],'#221f18','#dbc79b');
  cylinder(till,-.184,.277,.022,.043,.043,.009,nickel);
  box(till,-.184,.283,.020,.003,.004,.036,softBlack);
}

function taskLight(scene,x,y,z,color,intensity,targetX,targetZ){
  const lamp=new T.SpotLight(color,intensity,8,.97,.67,1.9);
  lamp.position.set(x,y,z);lamp.target.position.set(targetX,.5,targetZ);
  scene.add(lamp,lamp.target);return lamp;
}

function serviceBoard(shell,walnut,labels){
  const board=group(shell,-4.90,1.56,1.98);board.rotation.y=Math.PI/2;
  box(board,0,0,0,1.72,1.02,.037,walnut);
  const fiber=mat(0x957c50,{roughness:.94,bumpMap:walnut.bumpMap,bumpScale:.0016,lightMap:walnut.lightMap,lightMapIntensity:.78});
  box(board,0,0,.021,1.65,.95,.012,fiber);
  paint(board,.35,.341,.030,.70,.109,[['SERVICE  TICKETS',.54,.52]],'#d9c69a','#633d2d');
  for(let i=0;i<6;i++){
    const hook=group(board,.14+(i%3)*.21,.18-Math.floor(i/3)*.31,.044);
    hook.rotation.z=.085*Math.sin(i*25);
    link(hook,[0,0,0],[0,-.017,.024],.004,.004,nickel);
    const ring=mesh(hook,new T.TorusGeometry(.021,.0035,6,18),nickel,0,-.029,.026);
    ring.rotation.y=.15;
    box(hook,.014,-.082,.031,.017,.072,.005,nickel);
    box(hook,.021,-.108,.031,.022,.012,.005,nickel);
    const tag=paint(hook,-.010,-.136,.036,.076,.088,[[String(205+i),.34,.51]],'#ccad72','#4b3928');
    tag.rotation.z=.15;
  }
  box(board,-.425,-.03,.039,.54,.755,.013,agedCream);
  const mapCover=mesh(board,new T.PlaneGeometry(.51,.33),labels[11],-.425,.164,.048);
  mapCover.rotation.z=.016;
  paint(board,-.425,-.182,.050,.50,.295,[
    ['NOVEMBER  1974',.20,.17],['S   M   T   W   T   F   S',.085,.39],
    ['3    4    5    6    7    8    9',.087,.52],['10  11  12  13  14  15  16',.087,.65],
    ['17  18  19  20  21  22  23',.087,.78],['24  25  26  27  28  29  30',.087,.91]
  ],'#d8ccb4','#4e453a');
  // Wall clock face and bezel sit proud of the plaster.
  const clock=group(shell,-4.89,2.37,2.65);clock.rotation.y=Math.PI/2;
  const rim=cylinder(clock,0,0,.032,.214,.214,.063,nickel,48);rim.rotation.x=Math.PI/2;
  const dial=cylinder(clock,0,0,.066,.197,.197,.009,agedCream,48);dial.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    const tick=box(clock,.171*Math.sin(angle),.171*Math.cos(angle),.073,.007,.022,.005,softBlack);
    tick.rotation.z=-angle;
  }
  link(clock,[0,0,.080],[-.099,.050,.080],.008,.005,softBlack);
  link(clock,[0,0,.083],[.076,.118,.083],.005,.0035,softBlack);
}

export function shopInterior(shell,scene,loader){
  const {vinyl,bounce,brush,relief}=roomSurfaces(shell,loader);
  const [,acoustic,walnut,laminate]=swatches(loader,finishesFile,2,2,finishResponse);
  acoustic.color.setHex(0xe0e7e8);acoustic.bumpScale=.0016;
  acoustic.lightMap=bounce;acoustic.lightMapIntensity=2.15;
  walnut.bumpScale=.0006;laminate.bumpScale=.00012;
  for(const material of [walnut,laminate,agedCream,red,softBlack]){
    material.lightMap=bounce;material.lightMapIntensity=.75;
  }
  for(const material of [frame,nickel]){
    material.bumpMap=brush;material.bumpScale=.00009;
    material.roughnessMap=brush;material.roughness=.78;
  }
  agedCream.bumpMap=relief;agedCream.bumpScale=.00017;agedCream.roughnessMap=relief;
  red.bumpMap=relief;red.bumpScale=.00012;red.roughness=.34;red.metalness=.08;
  const labels=swatches(loader,labelsFile,4,3),random=seed(1974);
  for(const [i,label] of labels.entries()){
    label.roughness=i<4?.68:i<8?.42:.88;
    label.metalness=i>=4&&i<8?.14:0;
  }
  const tileFace=new T.PlaneGeometry(1.188,.588);
  box(shell,0,3.036,3.7,10.35,.19,7.85,frame);
  for(let x=-4;x<=4;x++)for(let z=0;z<13;z++){
    const face=mesh(shell,tileFace,acoustic,1.2*x,2.932,.18+.60*z);
    face.rotation.set(Math.PI/2,0,random()>.5?Math.PI:0);
  }
  const tee=mat(0xb4b1a1,{roughness:.67,lightMap:bounce,lightMapIntensity:1.9});
  for(let x=-4.2;x<4.91;x+=1.2)box(shell,x,2.929,3.69,.016,.014,7.3,tee);
  for(let z=.48;z<7.32;z+=.60)box(shell,0,2.930,z,9.82,.012,.015,tee);
  const reflector=mat(0xd4d2bd,{metalness:.12,roughness:.52,emissive:0x37392f});
  for(const z of [2.05,5.6]){
    const x=z<3?2.28:.95;
    box(shell,x,2.90,z,.35,.086,1.24,frame);
    box(shell,x,2.855,z,.32,.013,1.18,reflector);
    for(const side of [-1,1]){
      const lip=box(shell,x+side*.154,2.843,z,.030,.025,1.18,reflector);
      lip.rotation.z=side*.42;
    }
    for(const dx of [-.082,.082]){
      link(shell,[x+dx,2.842,z-.55],[x+dx,2.842,z+.55],.014,.014,frosting);
      for(const end of [-1,1])box(shell,x+dx,2.85,z+end*.565,.051,.046,.037,agedCream);
    }
    taskLight(scene,x,2.81,z,0xe7eadf,17,x-.3,z-.24);
  }
  const counter=group(shell,-2.37,0,3.36);counter.rotation.y=.07;
  box(counter,0,.15,0,2.49,.21,1.02,softBlack);
  box(counter,0,.584,0,2.63,.813,1.094,walnut);
  // Bookmatched veneer doors with separate grain runs and narrow shadow reveals.
  for(let i=0;i<6;i++){
    const g=new T.BoxGeometry(.435,.802,.018),uv=g.attributes.uv;
    for(let j=0;j<uv.count;j++){
      const u=uv.getX(j),v=uv.getY(j);
      uv.setXY(j,.05+.89*v,(i%3+(i%2?1-u:u))/3);
    }
    mesh(counter,g,walnut,-1.10+i*.44,.585,.551);
  }
  laminate.aoMap=countertopOcclusion();
  const edge=mat(0x4d3930,{roughness:.68});
  rolled(counter,0,.976,0,2.75,.022,1.19,.008,edge);
  const top=rolled(counter,0,1.010,0,2.76,.081,1.20,.019,laminate);
  const {position,uv}=top.geometry.attributes;
  for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/2.76+.5,.5-position.getZ(i)/1.20);
  box(counter,0,.990,.598,2.71,.032,.013,nickel);
  for(const y of [.983,.994])box(counter,0,y,.606,2.69,.002,.002,frame);
  register(counter);
  // Paper map stack, pen cup, till receipt and display tins give the countertop scale.
  for(let i=0;i<4;i++){
    const paper=group(counter,.99,1.053+i*.004,.28);paper.rotation.y=-.22+.04*i;
    box(paper,0,0,0,.16,.004,.235,agedCream);
    const cover=mesh(paper,new T.PlaneGeometry(.159,.233),labels[11],0,.0023,0);cover.rotation.x=-Math.PI/2;
  }
  cylinder(counter,-.08,1.108,.25,.036,.030,.115,frame);
  for(let i=0;i<4;i++)link(counter,[-.083,1.127,.251],[-.113+i*.016,1.235+random()*.029,.261+i*.007],.003,.003,softBlack);
  for(let i=0;i<4;i++)product(counter,-.86+i*.132,1.052,-.24,6,labels,Math.PI+i*.26);
  const shade=group(shell,-1.98,2.31,3.48);
  cylinder(shade,0,.312,0,.007,.007,.63,softBlack);
  cylinder(shade,0,.065,0,.042,.172,.123,frame);
  cylinder(shade,0,-.002,0,.153,.153,.009,frosting);
  const deskLamp=taskLight(scene,-1.98,2.28,3.48,0xffcc91,17,-1.89,3.55);
  deskLamp.castShadow=true;deskLamp.shadow.mapSize.set(1024,1024);
  deskLamp.shadow.camera.near=.12;deskLamp.shadow.normalBias=.004;
  deskLamp.shadow.bias=-.0003;
  serviceBoard(shell,walnut,labels);

  stockRack(shell,2.59,1.48,-.74,2.42,[4,5,10,8,9,7],labels,random);
  stockRack(shell,-3.67,1.10,.45,1.97,[6,7,8,9,4],labels,random);
  const coolerPane=cooler(shell,labels);
  const matting=mat(0x302e29,{roughness:.94,bumpMap:relief,bumpScale:.0009});
  const ribs=mat(0x48463a,{roughness:.93,bumpMap:relief,bumpScale:.001});
  rolled(shell,0,.090,.72,1.91,.016,1.00,.007,matting);
  for(let i=0;i<38;i++)box(shell,0,.100,.249+i*.025,1.82,.006,.007,ribs);
  return {probeMaterials:[vinyl,laminate,walnut,nickel,frame,red,coolerPane,...drinks],doorMetal:mat(0xb7b8ae,{metalness:.83,roughness:.62,roughnessMap:brush,bumpMap:brush,bumpScale:.00013})};
}
