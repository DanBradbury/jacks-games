import * as T from 'three';

export async function loadRackFace(){
  const map=await new T.TextureLoader().loadAsync(new URL('./equipment/rack-faces.jpg',import.meta.url).href);
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  return new T.MeshStandardMaterial({map,roughness:.73,metalness:.19});
}

export function dressRacks({add,box,pipe,cable,standard,basic,m,front,obstacles}){
  const black=standard(0x202322,.64,.28),rail=standard(0x84877b,.51,.55);
  const jackets=[0x32312c,0x878064,0x686f67,0x615847].map(c=>standard(c,.84,.07));
  const indicator=basic(0xa7ba79);
  function cabinet(x,z,yaw,power=false,variant=0){
    const w=power?.95:.82,h=power?2.19:2.13,d=.83;
    const sn=Math.sin(yaw),cs=Math.cos(yaw);
    const at=(u,y,v)=>[x+cs*u+sn*v,y,z-sn*u+cs*v];
    const block=(u,y,v,bw,bh,bd,mat)=>box(...at(u,y,v),bw,bh,bd,mat,0,yaw);
    block(0,h/2,0,w,h,d,m.metal);
    block(0,.055,0,w+.04,.11,d+.04,black);
    const depth=d*.5+.006,faceWidth=w-.055,faceHeight=h-.10;
    const panel=new T.PlaneGeometry(faceWidth,faceHeight),uv=panel.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(power?.004:.505)+uv.getX(i)*.489);
    add(panel,front,...at(0,h/2,depth),0,yaw);
    for(const u of [-1,1])block(u*(w*.5-.014),h/2,depth,.026,h,.047,rail);
    if(power){
      for(let j=0;j<3;j++){
        const u=(j-1)*.183-.097;
        block(u,1.37,depth+.028,.053,.055,.073,black);
      }
    }else{
      const socket=(column,row)=>at(faceWidth*(-.27+.053*column),.05+faceHeight*(.423-.075*row),depth+.036);
      for(let j=0;j<7;j++){
        const col=(j+variant)%9,from=socket(col,j%2),to=socket((col+3)%10,2+j%2);
        const midU=faceWidth*(-.27+.053*col);
        const sag=Math.min(from[1],to[1])-.115-(j%3)*.041;
        const points=[from,at(midU,from[1]-.048,depth+.09+j*.006),
          at(midU+.05,sag,depth+.14+j*.008),at(midU+.10,sag+.025,depth+.10),to];
        cable(points,.008,jackets[(j+variant)%4]);
        for(const p of [from,to])box(...p,.027,.027,.056,black,0,yaw);
      }
      for(let j=0;j<3;j++)block(-w*.34+j*.09,1.01,depth+.002,.013,.008,.008,indicator);
    }
    const halfX=(Math.abs(cs)*w+Math.abs(sn)*d)/2+.19,halfZ=(Math.abs(sn)*w+Math.abs(cs)*d)/2+.19;
    obstacles.push([x-halfX,x+halfX,z-halfZ,z+halfZ]);
  }
  cabinet(-.49,-28.34,0,true);cabinet(.70,-28.43,0);cabinet(1.61,-28.43,0,false,3);
  cabinet(2.67,-24.05,-Math.PI/2,false,2);cabinet(-2.72,-24.9,Math.PI/2,false,4);
  for(let j=0;j<5;j++){
    const x=.48+j*.22;
    cable([[x,2.14,-28.69],[x-.08,2.41,-29.06],[x-.08,2.9,-29.84],[x-.08,3.47,-29.93]],.021,jackets[0]);
  }
  // Wooden cable spool at the wall, with wound cable visible between the cheeks.
  const wood=standard(0x685138,.95,.02);
  for(const [x,z,r] of [[-2.85,-27.2,.36],[-2.49,-28.05,.23]]){
    pipe(x,r,z,r*.80,.32,black,0,Math.PI/2);
    for(let k=0;k<17;k++)add(new T.TorusGeometry(r*.81,.012,5,28),jackets[0],x-.148+k*.018,r,z,0,Math.PI/2);
    for(const side of [-1,1]){
      pipe(x+side*.177,r,z,r,.027,wood,0,Math.PI/2);
      pipe(x+side*.196,r,z,.042,.017,black,0,Math.PI/2);
    }
    obstacles.push([x-.39,x+.39,z-r-.16,z+r+.16]);
  }
}
