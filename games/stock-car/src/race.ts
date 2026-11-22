// Distances in metres, velocities in metres per second. Track position increases
// continuously through the timing line, so lapped cars retain their actual rank.
const points = [{ x: -730, z: 0 }]
function curve(cx: number, cz: number, dx: number, dz: number, x: number, z: number) {
  const a = points[points.length - 1]
  for (let i = 1; i <= 160; i++) {
    const t = i / 160, u = 1 - t
    points.push({ x: u**3*a.x + 3*u*u*t*cx + 3*u*t*t*dx + t**3*x,
      z: u**3*a.z + 3*u*u*t*cz + 3*u*t*t*dz + t**3*z })
  }
}
curve(-730,-160,-640,-345,-640,-520)
curve(-640,-945,0,-945,0,-520)
curve(0,-175,0,175,0,520)
curve(0,945,-640,945,-640,520)
curve(-640,345,-730,160,-730,0)
const distance = [0]
for (let i=1;i<points.length;i++) distance.push(distance[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z))
export const length = distance[distance.length-1]
export const start = distance[400]
// Heading at each point (the loop closes on itself), blended between points so the
// camera and lateral offsets turn smoothly instead of stepping at every vertex.
const last = points.length - 1
const tangents = points.map((_, i) => {
  const a = points[i ? i - 1 : last - 1], b = points[i < last ? i + 1 : 1], d = Math.hypot(b.x - a.x, b.z - a.z)
  return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }
})
// Signed curvature: positive where the track bends towards the infield (negative x),
// so a car's momentum carries it towards the wall.
const bends = points.map((_, i) => {
  const p = i ? i - 1 : last - 1, n = i < last ? i + 1 : 1, a = tangents[p], b = tangents[n]
  const ds = (i ? distance[i] - distance[p] : length - distance[p]) + (i < last ? distance[n] - distance[i] : distance[1])
  const t = tangents[i]
  return -((b.x - a.x) * t.z - (b.z - a.z) * t.x) / ds
})
export function track(s: number) {
  const d = ((s % length) + length) % length
  let lo=0, hi=points.length-1
  while(hi-lo>1){const m=(lo+hi)>>1; if(distance[m]<=d) lo=m; else hi=m}
  const a=points[lo], b=points[hi], span=distance[hi]-distance[lo], t=(d-distance[lo])/span
  const ux=tangents[lo].x+(tangents[hi].x-tangents[lo].x)*t, uz=tangents[lo].z+(tangents[hi].z-tangents[lo].z)*t
  const un=Math.hypot(ux,uz), tx=ux/un, tz=uz/un
  const z=a.z+(b.z-a.z)*t
  const bank=.035+.50*Math.min(1,Math.max(0,(Math.abs(z)-465)/145))
  return {x:a.x+(b.x-a.x)*t,z,tx,tz,bank,bend:bends[lo]+(bends[hi]-bends[lo])*t}
}
export const colors=['#ff5c25','#4899c2','#f5be33','#e9e4d3','#bc3842','#57ac90','#bc86ca','#477bd0','#ef9442','#cee256']
export const numbers=[27,43,12,71,8,56,92,19,64,3]
export interface Car {s:number; x:number; v:number; vx:number; yaw:number; spin:number; roll:number; vr:number; h:number; vh:number; recovery:number
  // Fishtail amplitude (radians) and its oscillator phase; contact cooldown; AI lane;
  // riding the wall; the car that last got this one loose (-1 for none).
  wobble:number; phase:number; touch:number; lane:number; think:number; wall:boolean; by:number}
// Square bump-drafting is clean, but rubbing and wall hits get a car loose, a loose
// car that keeps getting hit spins, and a shot to the rear quarter turns it around.
export interface Contact {kind:'rub'|'bump'|'scrape'|'grass'|'spin'; car:number; other:number; strength:number}
const lanes=[-6.4,-2.6,2.6,6.4]
export function field(): Car[] {
  return colors.map((_,i)=>{
    const x=i?(i%2?-2.6:2.6):-2.6
    return {s:start+(i?30+Math.floor((i-1)/2)*12+(i%2)*3:0),x,v:i?78:76,vx:0,yaw:0,spin:0,roll:0,vr:0,h:0,vh:0,recovery:0,
      wobble:0,phase:i,touch:0,lane:x,think:0,wall:false,by:-1}
  })
}
export class Race {
  cars=field()
  time=0
  fuel=1
  boost=0
  draft=0
  place=10
  finished=false
  events:Contact[]=[]
  ignite(){if(this.fuel && !this.finished && !this.cars[0].recovery){this.fuel=0;this.boost=3;return true}return false}
  // Nearest healthy-or-not car ahead of `c` within `range` metres around lateral position `x`.
  ahead(c:Car,x:number,range:number){
    let best:Car|undefined
    for(const o of this.cars)if(o!==c&&o.s>c.s&&o.s-c.s<range&&Math.abs(o.x-x)<2.4&&(!best||o.s<best.s))best=o
    return best
  }
  clear(c:Car,x:number){return this.cars.every(o=>o===c||Math.abs(o.s-c.s)>9||Math.abs(o.x-x)>2.4)}
  step(dt:number,steer:number,brake:boolean) {
    this.time+=dt
    this.events.length=0
    let incident=-1
    const emit=(kind:Contact['kind'],car:number,other:number,strength:number)=>{
      const c=this.cars[car]
      if(kind!=='spin'&&c.touch>0)return
      c.touch=.2;this.events.push({kind,car,other,strength})
    }
    const spin=(c:Car,index:number,force:number,side:number,trip:boolean,by=-1)=>{
      if(c.recovery>0)return
      c.spin=side*(2.8+force*.18); c.v*=.71; c.recovery=2.4; c.wobble=0
      if(trip){c.vh=6.8; c.vr=side*4.55}
      emit('spin',index,-1,force)
      // Only replay crashes the player is part of.
      if((index===0||by===0)&&(incident<0||index===0))incident=index
    }
    const shake=(c:Car,amount:number,by=-1)=>{if(!c.recovery){c.wobble=Math.min(.5,c.wobble+amount);c.by=by}}
    const p=this.cars[0]
    this.draft=this.cars.slice(1).reduce((best,c)=>{
      const gap=c.s-p.s
      return gap>4.8&&gap<46&&Math.abs(c.x-p.x)<2.3&&!c.recovery&&!p.recovery?
        Math.max(best,(1-gap/50)*(1-Math.abs(c.x-p.x)/2.6)):best
    },0)
    this.boost=Math.max(0,this.boost-dt)
    for(const [i,c] of this.cars.entries()){
      const troubled=c.recovery>0
      c.touch=Math.max(0,c.touch-dt)
      // Momentum carries cars up the track in the turns; drivers steer against it.
      const slide=c.v*c.v*track(c.s).bend*.28
      let target:number, lateral:number, rate=troubled?.12:.55
      if(i){
        // AI: hold a lane, draft the car ahead, and pull out to pass anything slower.
        const cruise=78+Math.sin(i*.7)*1.1
        target=cruise
        const front=troubled?undefined:this.ahead(c,c.lane,32)
        const chased=!troubled&&this.cars.some(o=>o!==c&&c.s-o.s>0&&c.s-o.s<12&&Math.abs(o.x-c.x)<2.4&&o.v>c.v+2)
        c.think-=dt
        if((front&&front.v<target-1||chased)&&c.think<=0){
          c.think=.8
          const k=lanes.indexOf(c.lane)
          const options=[lanes[k-1],lanes[k+1]].filter(x=>x!==undefined&&this.clear(c,x)&&(!front||(this.ahead(c,x,32)?.s??Infinity)>front.s))
          if(options.length)c.lane=options[Math.floor(c.s)%options.length]
        }
        if(front){
          const gap=front.s-c.s
          target+=(1-gap/32)*5
          // Lift quickly when closing on the car ahead; a car that was just bumped
          // from behind keeps its extra speed and eases back to cruise.
          if(this.ahead(c,c.lane,32)===front&&gap<14){target=Math.min(target,front.v+(gap-9)*.6);if(target<c.v)rate=1.6}
        }
        lateral=(c.lane+Math.sin(this.time*.55+i)*.35-c.x)*1.5-slide
      }else{
        target=brake?49:80+this.draft*10+(this.boost?24:0)
        if(this.boost&&!troubled)rate=1.5
        lateral=steer*10.8*(1-c.wobble*.5)
      }
      c.v+=(target-c.v)*dt*rate
      c.vx+=(lateral-c.vx)*dt*(troubled?.5:3.2)
      if(c.x<8.6)c.wall=false
      c.x+=(c.vx+slide)*dt; c.s+=c.v*dt
      if(c.x>9){
        // The wall is on the outside only. The first touch is a hit (a hard boosted one
        // spins); after that the car slides along it and steering away drives it off.
        const impact=c.vx+slide
        c.x=9
        if(c.vx>0)c.vx=0
        if(!c.wall){c.wall=true
          if(impact>10.2&&c.v>84)spin(c,i,impact,-1,false)
          else{c.v-=impact*.2;shake(c,impact*.015);emit('scrape',i,-1,impact)}
        }else{c.v-=dt*10;emit('scrape',i,-1,1)}
      }
      // Inside the yellow lines: the apron is a little slower, the infield grass is
      // slow and bumpy, and the far edge of the infield stops a car.
      if(c.x<-12){
        const grass=c.x<-23
        c.v-=dt*(grass?14:3.5)
        if(grass){shake(c,dt*.12);emit('grass',i,-1,1)}
        if(c.x<-80){c.x=-80;if(c.vx<0)c.vx=0}
      }
      if(c.recovery>0){
        c.recovery=Math.max(0,c.recovery-dt)
        c.yaw+=c.spin*dt;c.spin*=Math.exp(-1.25*dt)
        c.h+=c.vh*dt;c.vh-=9.81*dt
        if(c.h>0){c.roll+=c.vr*dt}
        else {c.h=0;c.vh=0;c.vr=0;c.roll=Math.atan2(Math.sin(c.roll),Math.cos(c.roll))*Math.exp(-6*dt)}
        if(c.recovery<.9)c.yaw=Math.atan2(Math.sin(c.yaw),Math.cos(c.yaw))*Math.exp(-6*dt)
      }else{
        // A loose car fishtails: the tail swings, the body rocks and the line wanders.
        // Past the limit the tail comes all the way around.
        c.phase+=dt*11;c.wobble*=Math.exp(-1.3*dt)
        const swing=Math.sin(c.phase)
        if(c.wobble>.3)spin(c,i,c.wobble*20,Math.sign(swing)||1,false,c.by)
        else{
          c.yaw=c.vx*.018+c.wobble*swing;c.roll=c.wobble*.35*Math.sin(c.phase+1)
          c.x+=c.wobble*Math.cos(c.phase)*dt*4
        }
      }
    }
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i], b=this.cars[j], ds=b.s-a.s, dx=b.x-a.x
      if(Math.abs(ds)>=4.8 || Math.abs(dx)>=2.05 || Math.abs(a.h-b.h)>1.4)continue
      const sign=Math.sign(dx)||1, ahead=Math.sign(ds)||1
      const [rear,front,ri,fi]=ahead>0?[a,b,i,j]:[b,a,j,i]
      if(4.8-Math.abs(ds)<2.05-Math.abs(dx)){
        // Nose to tail.
        const push=(4.8-Math.abs(ds))*.5*ahead;a.s-=push;b.s+=push
        const closing=rear.v-front.v, offset=Math.abs(dx)
        if(closing<=0)continue
        if(closing>7&&offset>.8){
          // Clipped the rear corner hard enough to hook the car ahead around.
          spin(front,fi,closing,rear.x<front.x?1:-1,false,ri)
          if(closing>20&&offset>1.4)spin(rear,ri,closing,rear.x<front.x?-1:1,true,fi)
          else shake(rear,.12,fi)
          const share=closing*.4;rear.v-=share;front.v+=share
        }else{
          // Bump draft: a square hit shoves the leader forward and both stay straight;
          // only the off-centre part of a hit gets the car ahead loose.
          front.v+=Math.min(closing*.5,5);rear.v=Math.min(rear.v-closing*.25,front.v+.5)
          if(offset>.8)shake(front,(offset-.8)*closing*.03,ri)
          if(closing>2)emit('bump',ri,fi,closing)
        }
      }else{
        // Side by side.
        const push=(2.05-Math.abs(dx))*.5;a.x-=push*sign;b.x+=push*sign
        const sideSpeed=(a.vx-b.vx)*sign
        if(sideSpeed<=0)continue
        a.vx-=sideSpeed*.8*sign;b.vx+=sideSpeed*.8*sign
        if(sideSpeed>5&&Math.abs(ds)>1.8){
          // Door into the rear quarter: the car ahead gets turned.
          spin(front,fi,sideSpeed,front===b?sign:-sign,false,ri);shake(rear,.12,fi)
        }else{
          const loss=1-.004*sideSpeed;a.v*=loss;b.v*=loss
          shake(a,sideSpeed*.035,j);shake(b,sideSpeed*.035,i)
          emit('rub',i,j,sideSpeed)
        }
      }
    }
    this.place=1+this.cars.slice(1).filter(c=>c.s>p.s && (p.s<2*length||c.s>=2*length)).length
    this.finished=p.s>=2*length
    return incident
  }
}
