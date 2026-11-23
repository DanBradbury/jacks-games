export type V = [number, number, number]
export type Mark = { color:string; points:V[]; label?:string }
const quad=(x:number,X:number,y:number,Y:number,z:number,Z:number):V[]=>
  [[x,y,z],[X,y,z],[X,Y,Z],[x,Y,Z]]
export type Surface = (color:string, points:V[], winding:number, marks?:Mark[], label?:string)=>void
export function carModel(surface:Surface, paint:string, number:string){
  const cream='#fff1cc'
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
}
