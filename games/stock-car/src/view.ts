import { colors, numbers, track, length, type Car } from './race'
type V = [number,number,number]
type P = [number,number]
type Frame = ReturnType<typeof track>
function world(f:Frame,x:number,y:number):V{return [f.x+f.tz*x,y+x*f.bank,f.z-f.tx*x]}
const crowd=['#d8bb83','#756957','#c77354','#6a8696','#b1a69a','#434f59']
export function draw(ctx:CanvasRenderingContext2D,w:number,h:number,cars:Car[],focus:number,angle:number,boost:boolean){
  const car=cars[focus], f=track(car.s)
  const cam=world(f,car.x+(angle===1?12:angle===2?-9:0),angle===1?8:angle===2?2.2:4.2)
  const behind=angle===1?8:angle===2?-9:10.8
  cam[0]-=f.tx*behind;cam[2]-=f.tz*behind
  const aim=world(f,car.x,angle?.8:1.1)
  aim[0]+=f.tx*(angle?0:10);aim[2]+=f.tz*(angle?0:10)
  const dx=aim[0]-cam[0], dz=aim[2]-cam[2], d=Math.hypot(dx,dz)
  const sx=dx/d,sz=dz/d,pitch=Math.atan2(aim[1]-cam[1],d),co=Math.cos(pitch),si=Math.sin(pitch)
  const lens=Math.min(h*.99,w*1.05)*(boost?.95:1)
  const cy=h*(w<h?.51:.49)
  // Camera space is [right, up, depth]. Polygons are clipped at the near plane so
  // quads that straddle the camera stay on screen instead of popping out.
  const near=.5
  function view(v:V):V{
    const x=v[0]-cam[0],y=v[1]-cam[1],z=v[2]-cam[2],forward=x*sx+z*sz
    return [x*sz-z*sx,y*co-forward*si,forward*co+y*si]
  }
  const screen=(c:V):P=>[w/2+c[0]*lens/c[2],cy-c[1]*lens/c[2]]
  function project(v:V):P|null{const c=view(v);return c[2]>near?screen(c):null}
  // Point where the camera-space segment from a (in front) to b crosses the near plane.
  function cut(a:V,b:V):V{const t=(near-a[2])/(b[2]-a[2]);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near]}
  function poly(pts:V[],color:string){
    const cs=pts.map(view),out:P[]=[]
    for(let i=0;i<cs.length;i++){
      const a=cs[i],b=cs[(i+1)%cs.length],ina=a[2]>near,inb=b[2]>near
      if(ina)out.push(screen(a))
      if(ina!==inb)out.push(screen(cut(a,b)))
    }
    if(out.length<3)return
    ctx.fillStyle=color;ctx.beginPath();for(const p of out)ctx.lineTo(...p);ctx.closePath();ctx.fill()
  }
  const horizon=cy+lens*Math.tan(pitch)
  const sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon))
  sky.addColorStop(0,'#6f9faa');sky.addColorStop(.55,'#bad3ce');sky.addColorStop(1,'#ffe2aa')
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h)
  const bearing=Math.atan2(sx,sz)
  for(let i=-1;i<=1;i++){
    const sunX=w*.66+(i*2*Math.PI-bearing)*lens
    ctx.fillStyle='#fff0bd';ctx.beginPath();ctx.arc(sunX,horizon-h*.105,h*.049,0,7);ctx.fill()
  }
  ctx.fillStyle='#778568';ctx.fillRect(0,horizon,w,h)
  ctx.beginPath();ctx.moveTo(0,horizon+1)
  for(let x=0;x<=w+8;x+=8){const k=bearing+x/lens;ctx.lineTo(x,horizon-h*(.014+.008*Math.sin(k*19)+.005*Math.cos(k*37)))}
  ctx.lineTo(w+8,horizon+2);ctx.closePath();ctx.fill()
  // The whole loop is drawn every frame; distant stretches use 4-segment chunks
  // that keep every stripe, pole and post but skip the crowd.
  const segment=8,chunk=4,count=Math.ceil(length/segment/chunk)*chunk
  type Job={depth:number; paint:()=>void}
  const jobs:Job[]=[]
  const depth=(v:V)=>(v[0]-cam[0])*sx+(v[2]-cam[2])*sz
  function line(v:V,u:V,col:string,width:number){
    let p=view(v),q=view(u)
    if(p[2]<=near&&q[2]<=near)return
    if(p[2]<=near)p=cut(q,p);else if(q[2]<=near)q=cut(p,q)
    ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...screen(p));ctx.lineTo(...screen(q));ctx.stroke()
  }
  function segmentJob(n:number,steps:number,detail:boolean){
    const s=n*segment,a=track(s),b=track(s+segment*steps)
    if(Math.max(...[world(a,-90,0),world(a,32,9),world(b,-90,0),world(b,32,9)].map(depth))<near)return
    const dep=depth(world(a,0,0))
    const frame=(k:number)=>k===0?a:k===steps?b:track(s+k*segment)
    const strip=(x:number,u:number,col:string,y=0,v=y)=>poly([world(a,x,y),world(b,x,y),world(b,u,v),world(a,u,v)],col)
    jobs.push({depth:dep+segment*steps*.5*(a.tx*sx+a.tz*sz),paint:()=>{
      strip(-90,-24,detail?(n%4<2?'#7e9164':'#819468'):'#7f9266')
      strip(-13,11,n%2?'#555a5a':'#565b5b');strip(-24,-13,'#656a65')
      strip(-13,-12.82,'#f4b742');strip(-12.62,-12.45,'#f4b742');strip(9.75,9.9,'#eee5cb')
      for(let k=0;k<steps;k++)if((n+k)%3===0){
        const p=frame(k),q=frame(k+1)
        for(const lane of [-4,3])poly([world(p,lane,0),world(q,lane,0),world(q,lane+.13,0),world(p,lane+.13,0)],'#d8d7c8')
      }
      if(Math.floor(s/length)!==Math.floor((s+segment*steps)/length)){
        for(let j=0;j<24;j++)for(let k=0;k<2;k++){
          const t=track(Math.round((s+4)/length)*length+k),u=track(Math.round((s+4)/length)*length+k+1)
          poly([world(t,j-13,.02),world(t,j-12,.02),world(u,j-12,.02),world(u,j-13,.02)],(j+k)%2?'#22292b':'#eee9d7')
        }
      }
      if(n%52<36){
        strip(32,32,'#778177',0,9)
        strip(16,32,'#656963',1,9)
        for(let row=0;row<5;row++){
          const x=17+row*3,y=1.6+row*1.48
          strip(x,x+.6,'#bdafa0',y,y+.32)
          if(detail)for(let k=0;k<5;k++){
            const t=k/5, mix=(v:V,u:V):V=>[v[0]+(u[0]-v[0])*t,v[1]+(u[1]-v[1])*t,v[2]+(u[2]-v[2])*t]
            const v=mix(world(a,x,y+.4),world(b,x,y+.4)),p=project(v)
            if(p){ctx.fillStyle=crowd[Math.abs(n*17+row*7+k*13)%crowd.length];const size=Math.min(14,lens*.55/Math.max(2,depth(v)));ctx.fillRect(p[0],p[1]-size,size,size)}
          }
        }
      }
      strip(10.9,10.9,'#d3ceba',0,1.15);strip(10.9,10.9,n%10<5?'#c45b42':'#ccc6b7',.72,.96)
      for(let k=0;k<3;k++)line(world(a,10.5,2+k*.85),world(b,10.5,2+k*.85),'#89938a',.75)
      for(let k=0;k<steps;k++){
        const p=frame(k),pd=Math.max(2,depth(world(p,0,0)))
        line(world(p,11,1),world(p,10.5,3.9),'#646e69',1.5)
        if((n+k)%11===0){
          line(world(p,17,1),world(p,17,16),'#566363',Math.max(1,lens*.28/pd))
          line(world(p,17,16),world(p,13,16),'#3a4548',Math.max(2,lens*.65/pd))
        }
      }
    }})
  }
  const first=Math.floor(car.s/segment/chunk)*chunk
  for(let n=first;n<first+count;n+=chunk){
    if(depth(world(track(n*segment),0,0))>360)segmentJob(n,chunk,false)
    else for(let k=0;k<chunk;k++)segmentJob(n+k,1,true)
  }
  jobs.sort((a,b)=>b.depth-a.depth).forEach(j=>j.paint())
  jobs.length=0
  cars.forEach((c,i)=>{
    const g=track(c.s),origin=world(g,c.x,0),dc=depth(origin)
    if(dc<1)return
    jobs.push({depth:dc,paint:()=>{
      const sin=Math.sin(c.yaw),cos=Math.cos(c.yaw),sr=Math.sin(c.roll),cr=Math.cos(c.roll)
      function v(x:number,y:number,z:number):V{
        const rx=x*cr-(y-.65)*sr, ry=x*sr+(y-.65)*cr+.65
        const side=rx*cos+z*sin, along=z*cos-rx*sin
        const p=world(g,c.x+side,c.h+ry);p[0]+=g.tx*along;p[2]+=g.tz*along;return p
      }
      const shadow:V[]=[]
      for(let k=0;k<16;k++){const a=k*Math.PI/8,p=world(g,c.x+1.22*Math.cos(a),.01);p[0]+=g.tx*2.7*Math.sin(a);p[2]+=g.tz*2.7*Math.sin(a);shadow.push(p)}
      poly(shadow,'#323838')
      const faces:Job[]=[]
      // Cull hidden panels, then paint each visible panel and its details as one job.
      // A decal's center depth can differ from its panel's when steering or banking.
      type Mark = { color:string; points:V[]; label?:string }
      const quad=(x:number,X:number,y:number,Y:number,z:number,Z:number):V[]=>
        [[x,y,z],[X,y,z],[X,Y,Z],[x,Y,Z]]
      function surface(color:string,points:V[],winding:number,marks:Mark[]=[],label?:string){
        const vertices=points.map(p=>v(...p)),[a,b,c]=vertices
        const bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2]
        const cx=c[0]-a[0],cy=c[1]-a[1],cz=c[2]-a[2]
        const facing=(by*cz-bz*cy)*(cam[0]-a[0])+(bz*cx-bx*cz)*(cam[1]-a[1])+(bx*cy-by*cx)*(cam[2]-a[2])
        if(winding && winding*facing<=0)return
        faces.push({depth:vertices.reduce((sum,p)=>sum+view(p)[2],0)/vertices.length,paint:()=>{
          poly(vertices,color)
          if(label)numberLabel(vertices,label)
          for(const mark of marks){
            const pts=mark.points.map(p=>v(...p))
            poly(pts,mark.color)
            if(mark.label)numberLabel(pts,mark.label)
          }
        }})
      }
      function numberLabel(vertices:V[],label:string){
        const corners=vertices.map(project)
        if(!corners.every(Boolean))return
        const [a,b,,d]=corners as P[]
        ctx.save();ctx.transform((b[0]-a[0])/100,(b[1]-a[1])/100,(d[0]-a[0])/50,(d[1]-a[1])/50,a[0],a[1])
        ctx.font='italic 900 55px Arial';ctx.textAlign='center';ctx.fillStyle='#fff7d9';ctx.strokeStyle='#292a29';ctx.lineWidth=4;ctx.strokeText(label,50,45);ctx.fillText(label,50,45);ctx.restore()
      }
      const paint=colors[i],cream='#fff1cc',number=String(numbers[i])
      surface('#242b2c',quad(-1,1,.18,.18,-2.4,2.4),1)
      surface(paint,quad(-1,1,.3,.86,-2.4,-2.39),-1,[
        {color:'#e8d9ac',points:quad(-.35,.35,.70,.48,-2.412,-2.412),label:number},
        {color:'#303331',points:quad(-.98,.98,.30,.45,-2.42,-2.42)},
        ...[-.91,.52].map(x=>({color:'#ac342b',points:quad(x,x+.39,.57,.74,-2.42,-2.42)}))
      ])
      const stripes=(y:number,Y:number,z:number,Z:number)=>[-.46,.23].map(x=>({color:cream,points:quad(x,x+.23,y,Y,z,Z)}))
      surface(paint,quad(-1,1,.86,.9,-2.4,-1.35),-1,stripes(.86,.9,-2.4,-1.35))
      surface('#24383c',quad(-.89,.89,.9,1.46,-1.35,-.65),-1,
        [-.72,-.02,.68].map(x=>({color:'#586965',points:quad(x,x+.035,.9,1.46,-1.35,-.65)})))
      surface(paint,quad(-.84,.84,1.47,1.47,.52,-.66),1,[],number)
      surface('#3e5558',quad(-.85,.85,1.46,.91,.52,1.15),-1)
      surface(paint,quad(-1,1,.91,.79,1.15,2.4),-1,stripes(.91,.79,1.15,2.4))
      surface('#333a38',quad(-1,1,.27,.79,2.4,2.4),1,
        [-.92,.58].map(x=>({color:cream,points:quad(x,x+.34,.51,.69,2.41,2.41)})))
      surface('#252e2e',quad(-1.04,1.04,.87,1,-2.32,-2.44),0)
      for(const side of [-1,1]){
        const x=side*1.01
        const marks:Mark[]=[{color:paint,points:[[x,.84,-.75],[x,.84,.78],[x,.32,.78],[x,.32,-.75]],label:number}]
        for(const z of [-1.51,1.52])for(const r of [.39,.18]){
          const rim:V[]=[];for(let k=0;k<12;k++){const a=k*Math.PI/6;rim.push([side*(r>.2?1.03:1.045),.39+r*Math.sin(a),z+r*Math.cos(a)])}
          marks.push({color:r>.2?'#222827':'#adae9b',points:rim})
        }
        surface(paint,[[x,.87,-2.39],[x,.79,2.4],[x,.26,2.4],[x,.26,-2.39]],side,marks)
        surface('#344449',[[x,.90,-1.34],[side*.84,1.45,-.64],[side*.84,1.45,.52],[x,.90,1.13]],side)
      }
      faces.sort((a,b)=>b.depth-a.depth).forEach(j=>j.paint())
    }})
  })
  jobs.sort((a,b)=>b.depth-a.depth).forEach(j=>j.paint())
  // Screen position of each car body, for effects drawn over the scene.
  return cars.map(c=>project(world(track(c.s),c.x,c.h+.8)))
}
