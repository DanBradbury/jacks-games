import { carModel, type Surface, type V } from './car-model'

export function renderModel(canvas:HTMLCanvasElement, angle:number, scale:number, center:number, model:(surface:Surface)=>void){
  const ctx=canvas.getContext('2d')!
  ctx.clearRect(0,0,canvas.width,canvas.height)
  const sin=Math.sin(angle), cos=Math.cos(angle)
  const faces:{depth:number;draw:()=>void}[]=[]
  function project([x,y,z]:V):V{
    const forward=z*cos+x*sin
    return [canvas.width/2+(x*cos-z*sin)*scale,canvas.height/2+((center-y)*.95+forward*.31)*scale,forward*.95+y*.31]
  }
  function polygon(points:V[],color:string,label?:string){
    ctx.beginPath()
    for(const [x,y] of points)ctx.lineTo(x,y)
    ctx.closePath();ctx.fillStyle=color;ctx.fill()
    if(!label)return
    const [a,b,,d]=points
    ctx.save()
    ctx.transform((b[0]-a[0])/100,(b[1]-a[1])/100,(d[0]-a[0])/50,(d[1]-a[1])/50,a[0],a[1])
    ctx.textAlign='center';ctx.font='italic bold 47px Arial';ctx.lineWidth=3
    ctx.strokeStyle='#292a29';ctx.strokeText(label,50,42);ctx.fillStyle='#fff1cc';ctx.fillText(label,50,42);ctx.restore()
  }
  model((color,points,winding,marks=[],label)=>{
    const vertices=points.map(project),[a,b,c]=vertices
    const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    if(winding*cross>0)return
    faces.push({depth:vertices.reduce((sum,v)=>sum+v[2],0)/vertices.length,draw:()=>{
      polygon(vertices,color,label)
      for(const mark of marks)polygon(mark.points.map(project),mark.color,mark.label)
    }})
  })
  faces.sort((a,b)=>a.depth-b.depth).forEach(face=>face.draw())
}

export function renderCar(canvas:HTMLCanvasElement,angle:number,paint:string,number:string){
  renderModel(canvas,angle,canvas.width*.176,.73,surface=>carModel(surface,paint,number))
}
