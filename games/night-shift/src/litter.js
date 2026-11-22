import * as T from 'three';

export function scatterLitter({box,pipe,add,standard}){
  let seed=91473;
  const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const paper=standard(0xc2b8a1,.98,0),foil=standard(0x767972,.52,.45);
  const opening=standard(0x252722,.9),metal=standard(0x77776a,.52,.48),red=standard(0x894c3c,.78,.23),label=standard(0xac9266,.79,.19);
  function printed(title,color){
    const c=document.createElement('canvas');c.width=256;c.height=384;const g=c.getContext('2d');
    g.fillStyle=color;g.fillRect(0,0,256,384);g.fillStyle='#534e40';g.font='bold 22px monospace';g.fillText(title,19,46);
    for(let y=62;y<350;y+=14){g.globalAlpha=.5+r()*.4;g.fillRect(18,y,50+r()*158,2);}
    g.globalAlpha=.3;for(let i=0;i<650;i++)g.fillRect(r()*256,r()*384,1+r()*3,2);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
    return new T.MeshStandardMaterial({map,side:T.DoubleSide,roughness:1});
  }
  const forms=[printed('WORK ORDER','#afa999'),printed('INSPECTION','#92937d')];
  const debris=[standard(0x796b58),standard(0x584338),standard(0xa09983)];
  for(const [cx,cz] of [[-1.76,3.4],[1.61,.3],[-1.66,-5.1],[1.46,-8.5],[-1.22,-13.3],[1.66,-17.1],[-1.3,-20.8]]){
    for(let j=0;j<13;j++){
      const x=cx+(r()-.5)*1.04,z=cz+(r()-.5)*2.1;
      if(j<4){
        const g=new T.PlaneGeometry(.13+r()*.15,.18+r()*.20,4,6);
        g.rotateX(-Math.PI/2);
        const p=g.attributes.position;
        for(let k=0;k<p.count;k++)p.setY(k,.009+Math.abs(p.getX(k))*.08+r()*(j===3?.056:.014));
        g.computeVertexNormals();add(g,forms[j%2],x,.007,z,0,r()*6.28);
      }else{
        // Each fragment has an irregular perimeter and a broken top edge.
        const shape=new T.Shape();const n=4+Math.floor(r()*4),size=.023+r()*.07;
        for(let k=0;k<n;k++){
          const a=k/n*Math.PI*2,rad=size*(.6+r()*.45),u=Math.cos(a)*rad,v=Math.sin(a)*rad;
          if(k)shape.lineTo(u,v);else shape.moveTo(u,v);
        }
        shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.006+r()*.018,bevelEnabled:false});
        // World renderer batches indexed geometry.
        const vertexCount=g.attributes.position.count;g.setIndex(Array.from({length:vertexCount},(_,k)=>k));
        add(g,debris[j%3],x,.008,z,-Math.PI/2,0,r()*6.28);
      }
    }
    // Crushed drink tin with rolled ends, dented body and dark pull opening.
    const x=cx+.28,z=cz+.36;
    const g=new T.CylinderGeometry(.037,.037,.115,14,4);
    const p=g.attributes.position;for(let i=0;i<p.count;i++){
      const y=p.getY(i),dent=1-.39*Math.exp(-((y+.008)**2)/.00028)*(p.getX(i)>0?1:.26);
      p.setX(i,p.getX(i)*dent);
    }
    g.computeVertexNormals();add(g,r()>.5?red:label,x,.044,z,Math.PI/2);
    for(const end of [-1,1])pipe(x,.044,z+end*.057,.038,.004,metal,Math.PI/2);
    pipe(x,.050,z+.060,.013,.002,opening,Math.PI/2);
  }
  function sack(x,z){
    const g=new T.SphereGeometry(.12,12,7);g.scale(1,.34,1.45);
    const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+.011*Math.sin(75*p.getZ(i)));
    g.computeVertexNormals();add(g,foil,x,.047,z,0,.8);
    box(x-.08,.032,z+.15,.08,.014,.05,paper);
  }
  // A collapsed shipping carton with creased flaps and a strip of packing tape.
  const kraft=standard(0x897151,.97,0),tape=standard(0x987e55,.48,.04);
  box(-1.51,.028,-6.94,.51,.031,.34,kraft,0,.07);
  box(-1.71,.073,-6.95,.13,.018,.36,kraft,0,.07,-.60);
  box(-1.29,.055,-6.92,.12,.018,.34,kraft,0,.07,.36);
  box(-1.51,.064,-7.14,.5,.015,.14,kraft,.37,.07);
  box(-1.51,.049,-6.94,.047,.009,.32,tape,0,.07);
  pipe(.83,.074,-9.43,.044,.145,label);pipe(.83,.148,-9.43,.046,.005,metal);
  pipe(.839,.151,-9.43,.014,.002,opening);
  sack(1.35,-4.15);sack(-1.83,-10.4);
}
