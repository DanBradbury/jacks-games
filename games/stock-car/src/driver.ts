// Orthographic ray casting gives intersecting curved surfaces a depth per pixel.
const buffers = new WeakMap<HTMLCanvasElement, { image: ImageData; depth: Float32Array }>()
type Point = [number, number, number]
const dot = (a: Point, b: Point) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]

export function renderDriver(canvas: HTMLCanvasElement, angle: number,
  [suit,,style,facial,hair,skin]: string[], headshot = false, seconds = 0) {
  const ctx = canvas.getContext('2d')!
  const {width, height} = canvas
  let buffer = buffers.get(canvas)
  if (!buffer || buffer.image.width !== width || buffer.image.height !== height) {
    buffer = {image: ctx.createImageData(width,height), depth: new Float32Array(width*height)}
    buffers.set(canvas,buffer)
  }
  const {image,depth} = buffer
  depth.fill(-Infinity)
  image.data.fill(0)
  const scale = height / (headshot ? 1.15 : 3.55)
  const middle = headshot ? 2.87 : 1.65
  const sin = Math.sin(angle), cos = Math.cos(angle)
  const pitch = .13, rise = Math.sqrt(1-pitch*pitch)
  const right: Point = [cos,0,-sin], up: Point = [-sin*pitch,rise,-cos*pitch]
  const eye: Point = [sin*rise,pitch,cos*rise]
  const breath = .018*Math.sin(seconds*2.1)

  // Rotate each ellipsoid around its local Z axis to pose limbs and facial features.
  function oval(x:number,y:number,z:number,rx:number,ry:number,rz:number,color:string,tilt=0) {
    const center: Point = [x,y-middle,z]
    const cx = width/2 + scale*dot(center,right), cy = height/2 - scale*dot(center,up)
    const base = dot(center,eye)
    const s=Math.sin(tilt), c=Math.cos(tilt)
    function local(v:Point):Point {
      return [(v[0]*c+v[1]*s)/rx,(v[1]*c-v[0]*s)/ry,v[2]/rz]
    }
    const u=local(right), v=local(up), ray=local(eye)
    const aa=dot(ray,ray), ur=dot(u,ray), vr=dot(v,ray)
    const uu=dot(u,u), uv=dot(u,v), vv=dot(v,v)
    const extent=(axis:Point)=>scale*Math.hypot(rx*(axis[0]*c+axis[1]*s),ry*(axis[1]*c-axis[0]*s),rz*axis[2])
    const ex=extent(right), ey=extent(up)
    const left=Math.max(0,Math.floor(cx-ex)), end=Math.min(width,Math.ceil(cx+ex))
    const bottom=Math.min(height,Math.ceil(cy+ey))
    const rgb=parseInt(color.slice(1),16)
    for(let row=Math.max(0,Math.floor(cy-ey));row<bottom;row++){
      const dy=(cy-row-.5)/scale
      for(let col=left;col<end;col++){
        const dx=(col+.5-cx)/scale, b=dx*ur+dy*vr
        const disc=b*b-aa*(dx*dx*uu+2*dx*dy*uv+dy*dy*vv-1)
        if(disc<=0)continue
        const t=(Math.sqrt(disc)-b)/aa, index=row*width+col
        if(base+t<=depth[index])continue
        depth[index]=base+t
        const nx=dx*uu+dy*uv+t*ur, ny=dx*uv+dy*vv+t*vr, nz=b+t*aa
        const light=.70+.32*Math.max(0,(-.4*nx+.72*ny+.56*nz)/Math.hypot(nx,ny,nz))
        const offset=index*4
        image.data[offset]=(rgb>>16)*light
        image.data[offset+1]=((rgb>>8)&255)*light
        image.data[offset+2]=(rgb&255)*light
        image.data[offset+3]=255
      }
    }
  }

  for(const side of [-1,1]){
    oval(side*.19,1.13,0,.169,.48,.18,suit,side*.04)
    oval(side*.21,.54,.015,.14,.41,.15,suit)
    oval(side*.21,.16,.085,.15,.125,.24,'#343a38')
    const swing=.035*Math.sin(seconds*1.55)*side
    oval(side*.42,2.12+breath,0,.14,.31,.15,suit,side*.19)
    oval(side*.49,1.76+breath,.05+swing,.11,.24,.12,suit,-side*.08)
    oval(side*.47,1.5+breath,.08+swing,.094,.14,.098,skin)
  }
  oval(0,1.48,0,.315,.275,.198,suit)
  oval(0,1.83,0,.305,.41,.195,suit)
  oval(0,2.13+breath,0,.39,.34,.212,suit)
  oval(0,1.64,.002,.309,.068,.202,'#303735')
  oval(.175,2.2+breath,.18,.077,.044,.023,'#fff1cc')
  const face=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,tilt=0)=>
    oval(x,y+breath,z,w,h,d,color,tilt)
  face(0,2.5,0,.126,.2,.123,skin)
  face(0,2.88,0,.266,.36,.232,skin)
  face(0,2.74,.055,.224,.24,.193,skin)
  for(const side of [-1,1]){
    face(side*.259,2.83,-.005,.049,.082,.046,skin)
    face(side*.10,2.92,.209,.062,.044,.029,'#fff7e5')
    face(side*.10,2.918,.234,.026,.032,.013,'#37403d')
    face(side*.105,2.985,.207,.067,.017,.023,hair,side*-.09)
  }
  face(0,2.845,.235,.045,.078,.05,skin)
  face(0,2.70,.231,.069,.012,.016,'#a66759')
  if(style!=='Bald'){
    face(0,3.10,-.02,.273,.173,.234,hair)
    face(0,2.96,-.118,.255,.235,.145,hair)
    if(style==='Side part')face(-.058,3.09,.15,.208,.081,.088,hair,.19)
    if(style==='Curls')for(let i=0;i<12;i++){
      const a=i*Math.PI/6
      face(.20*Math.sin(a),3.12+.025*Math.cos(3*a),.17*Math.cos(a),.092,.099,.088,hair)
    }
    if(style==='Mullet'){
      face(0,2.78,-.174,.247,.32,.128,hair)
      for(const side of [-1,1])face(side*.176,2.67,-.146,.096,.23,.091,hair,side*.13)
      face(0,3.17,.038,.216,.105,.18,hair)
    }
  }
  if(facial!=='Clean-shaven')for(const side of [-1,1])
    face(side*.049,2.75,.237,.059,.022,.022,hair,-side*.17)
  if(facial==='Goatee')face(0,2.607,.199,.067,.062,.033,hair)
  if(facial==='Full beard'){
    face(0,2.65,.089,.214,.15,.151,hair)
    for(const side of [-1,1])face(side*.175,2.733,.095,.065,.126,.083,hair,-side*.23)
  }
  ctx.putImageData(image,0,0)
}
