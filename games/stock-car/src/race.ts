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
export interface Car {s:number; x:number; v:number; vx:number; yaw:number; spin:number; spinTarget:number; roll:number; vr:number; h:number; vh:number; recovery:number
  // Fishtail amplitude (radians) and its oscillator phase; contact cooldown; AI lane;
  // riding the wall; the car that last got this one loose (-1 for none).
  wobble:number; phase:number; touch:number; lane:number; think:number; passing:Car|null; defended:boolean; wall:boolean; by:number}
// Square bump-drafting is clean, but rubbing and wall hits get a car loose, a loose
// car that keeps getting hit spins, and a shot to the rear quarter turns it around.
export interface Contact {kind:'rub'|'bump'|'scrape'|'grass'|'spin'; car:number; other:number; strength:number}
const lanes=[-6.4,-2.6,2.6,6.4]
export function field(): Car[] {
  return colors.map((_,i)=>{
    const x=i?(i%2?-2.6:2.6):-2.6
    return {s:start+(i?30+Math.floor((i-1)/2)*12+(i%2)*3:0),x,v:i?78:76,vx:0,yaw:0,spin:0,spinTarget:0,roll:0,vr:0,h:0,vh:0,recovery:0,
      wobble:0,phase:i,touch:0,lane:x,think:0,passing:null,defended:false,wall:false,by:-1}
  })
}
function tow(c:Car, leader:Car){
  const gap=leader.s-c.s, offset=Math.abs(leader.x-c.x)
  return gap>4.8 && gap<46 && offset<2.3 && !leader.recovery && !c.recovery
    ? (1-gap/50)*(1-offset/2.6) : 0
}
// Project both rotated footprints onto each door and bumper normal. The
// shallowest overlap gives the direction in which the bodies can separate.
function resolveWreck(a:Car,b:Car){
  const dx=b.x-a.x, ds=b.s-a.s
  if(Math.abs(dx)>5.3 || Math.abs(ds)>5.3)return 0
  const ca=Math.cos(a.yaw), sa=Math.sin(a.yaw), cb=Math.cos(b.yaw), sb=Math.sin(b.yaw)
  let overlap=Infinity, nx=0, ns=0
  for(const [x,s] of [[ca,-sa],[sa,ca],[cb,-sb],[sb,cb]]){
    const extent=1.025*(Math.abs(x*ca-s*sa)+Math.abs(x*cb-s*sb))
      +2.4*(Math.abs(x*sa+s*ca)+Math.abs(x*sb+s*cb))
    const distance=dx*x+ds*s
    const depth=extent-Math.abs(distance)
    if(depth<=0)return 0
    if(depth<overlap){
      const sign=distance<0?-1:1
      overlap=depth;nx=x*sign;ns=s*sign
    }
  }
  const separation=overlap*.5
  a.x-=nx*separation;b.x+=nx*separation
  a.s-=ns*separation;b.s+=ns*separation
  // If either body reaches the wall, the other must take the remaining travel.
  if(a.x>9){b.x-=a.x-9;a.x=9}
  if(b.x>9){a.x-=b.x-9;b.x=9}
  const relativeX=a.vx-b.vx, relativeS=a.v-b.v
  const closing=Math.max(0,relativeX*nx+relativeS*ns)
  const normal=closing*.5
  // Scrubbing along a rotating panel also transfers forward momentum, even
  // when separation is mostly sideways.
  const slip=relativeS*nx-relativeX*ns
  const friction=Math.sign(slip)*Math.min(Math.abs(slip)*.5,(normal+overlap*8)*.65)
  const lateral=nx*normal-ns*friction, forward=ns*normal+nx*friction
  a.vx-=lateral;b.vx+=lateral
  a.v-=forward;b.v+=forward
  return closing+Math.abs(friction)
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
  private quarterPressure = new Map<Car, number>()
  ignite(){if(this.fuel && !this.finished && !this.cars[0].recovery){this.fuel=0;this.boost=3;return true}return false}
  // Nearest healthy-or-not car ahead of `c` within `range` metres around lateral position `x`.
  ahead(c:Car,x:number,range:number){
    let best:Car|undefined
    for(const o of this.cars)if(o!==c&&o.s>c.s&&o.s-c.s<range&&Math.abs(o.x-x)<2.4&&(!best||o.s<best.s))best=o
    return best
  }
  // Check the whole lane change, including where closing traffic will be in one second.
  private openLine(c:Car,x:number,except?:Car){
    const left=Math.min(x,c.x)-2.4, right=Math.max(x,c.x)+2.4
    return this.cars.every(o=>{
      if(o===c || o===except || o.x<left || o.x>right)return true
      const gap=o.s-c.s, next=gap+o.v-c.v
      return Math.min(gap,next)>7 || Math.max(gap,next)<-7
    })
  }
  private planLine(c:Car,p:Car){
    const gap=p.s-c.s, closing=c.v-p.v
    if(gap>0 || gap < -48)c.defended=false
    if(c.recovery){c.passing=null;return}
    if(c.passing){
      if(c.passing.s-c.s>=-7 && c.passing.s-c.s<32 && !c.passing.recovery)return
      c.passing=null
    }
    if(c.think>0)return
    c.think=.25
    if(!p.recovery && !c.defended && gap < -8 && gap > -38 && closing < -1){
      const cover=Math.max(lanes[0],Math.min(lanes[3],p.x+p.vx*.45))
      if(Math.abs(cover-c.lane)>1 && (-gap-5)/-closing>1 && this.openLine(c,cover)){
        c.lane=cover
        c.defended=true
        return
      }
    }
    const front=this.ahead(c,c.x,32)
    const rival=front ?? (!p.recovery && gap>5 && gap<46 ? p : undefined)
    if(!rival)return
    const lead=rival.s-c.s, gain=c.v-rival.v
    if(gain>.7 && lead<12+Math.min(gain,18)*1.1){
      const options=lanes.filter(x=>Math.abs(x-rival.x)>2.9
        && (Math.abs(c.x-rival.x)<2.4 || (x-rival.x)*(c.x-rival.x)>0)
        && this.openLine(c,x,rival)
        && !this.ahead(c,x,lead+8))
      options.sort((a,b)=>Math.abs(a-c.x)-Math.abs(b-c.x))
      if(options.length){c.lane=options[0];c.passing=rival}
    }else if(rival===p && lead>6+Math.max(0,gain) && p.x>=-8 && p.x<=8 && this.openLine(c,p.x,p)){
      c.lane=p.x
    }
  }
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
      c.spinTarget=side*(2.8+force*.18); c.recovery=2.4; c.wobble=0
      if(trip){c.vh=6.8; c.vr=side*4.55}
      emit('spin',index,-1,force)
      // Only replay crashes the player is part of.
      if((index===0||by===0)&&(incident<0||index===0))incident=index
    }
    const shake=(c:Car,amount:number,by=-1)=>{if(!c.recovery){c.wobble=Math.min(.5,c.wobble+amount);c.by=by}}
    const p=this.cars[0]
    const wakes=this.cars.map(c=>this.cars.reduce((best,o)=>Math.max(best,tow(c,o)),0))
    this.draft=wakes[0]
    for(const c of this.cars.slice(1)){
      c.think-=dt
      this.planLine(c,p)
    }
    this.boost=Math.max(0,this.boost-dt)
    for(const [i,c] of this.cars.entries()){
      const troubled=c.recovery>0
      c.touch=Math.max(0,c.touch-dt)
      // Momentum carries cars up the track in the turns; drivers steer against it.
      const slide=c.v*c.v*track(c.s).bend*.28
      let target:number, lateral:number, rate=troubled?.12:.55
      if(i){
        const cruise=79+Math.sin(i*.7)*1.1
        target=cruise+wakes[i]*13
        // Carry earned speed through the pass after leaving the wake.
        if(c.passing && target<c.v)rate=.1
        const front=this.ahead(c,c.x,20)
        if(front && (front!==c.passing || Math.abs(c.lane-front.x)<2.9)){
          const gap=front.s-c.s
          if(gap<14){
            // Allow a closing run while there is room between the bumpers.
            const clearance=gap-4.8
            target=Math.min(target,front.v+(clearance-.6)*1.5)
            if(target<c.v)rate=1.6
          }
        }
        lateral=(c.lane+Math.sin(this.time*.55+i)*.35-c.x)*1.5-slide
      }else{
        target=brake?49:80+this.draft*10+(this.boost?24:0)
        if(this.boost&&!troubled)rate=1.5
        lateral=steer*10.8*(1-c.wobble*.5)
      }
      if(troubled){
        // Sliding tires scrub speed progressively as the body turns broadside.
        const scrub=2+12*Math.abs(Math.sin(c.yaw))
        c.v=Math.max(0,c.v-scrub*dt)
      }else c.v+=(target-c.v)*dt*rate
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
        c.spin+=(c.spinTarget-c.spin)*(1-Math.exp(-7*dt))
        c.spinTarget*=Math.exp(-1.25*dt)
        c.yaw+=c.spin*dt
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
          const heading=c.vx*.018+c.wobble*swing
          c.yaw+=(heading-c.yaw)*(1-Math.exp(-7*dt))+c.spin*dt
          c.spin*=Math.exp(-5*dt);c.roll=c.wobble*.35*Math.sin(c.phase+1)
          c.x+=c.wobble*Math.cos(c.phase)*dt*4
        }
      }
    }
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i], b=this.cars[j], ds=b.s-a.s, dx=b.x-a.x
      // Each contact impulse cancels most of the closing speed within one tick.
      // Held steering against a rear quarter still loads the leader over time.
      if(i===0){
        const onQuarter=ds>=1.8 && ds<=4.82 && Math.abs(dx)>=.95 && Math.abs(dx)<=2.07
        const pressing=onQuarter && steer*dx>0 && !a.recovery && !b.recovery
        if(pressing){
          const pressure=(this.quarterPressure.get(b)??0)+dt*Math.abs(steer)
          if(pressure>=.18){
            spin(b,j,6,-Math.sign(dx),false,i)
            this.quarterPressure.delete(b)
          }else this.quarterPressure.set(b,pressure)
        }else this.quarterPressure.delete(b)
      }
      if(Math.abs(a.h-b.h)>1.4)continue
      if(a.recovery || b.recovery){
        const strength=resolveWreck(a,b)
        if(strength>.25)emit('bump',i,j,strength)
        continue
      }
      if(Math.abs(ds)>=4.8 || Math.abs(dx)>=2.05)continue
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
        // Correct overlap without adding rebound. A car pinned against the
        // outside wall has no room to take its half of the correction.
        const inside=sign>0?a:b, outside=sign>0?b:a
        const overlap=2.05-Math.abs(dx)
        const outward=Math.min(overlap*.5,Math.max(0,9-outside.x))
        outside.x+=outward
        inside.x-=overlap-outward

        // Contact lies midway along the overlapping door panels. Yaw rate
        // contributes lateral speed at that point, with opposite lever arms.
        const arm=ds*.5
        const drift=(c:Car)=>c.v*c.v*track(c.s).bend*.28
        const closing=(a.vx+drift(a)-b.vx-drift(b)+(a.spin+b.spin)*arm)*sign
        if(closing<=0)continue
        const pinned=outside.x>=9
        const inverseInertia=12/(4.8**2+2.05**2)
        const impulse=closing/((pinned?1:2)+2*arm*arm*inverseInertia)
        inside.vx-=impulse
        if(!pinned)outside.vx+=impulse
        // Sliding panels exchange a little longitudinal momentum. Matching
        // speeds produce no drag, even when drivers lean on each other.
        const friction=Math.sign(a.v-b.v)*Math.min(Math.abs(a.v-b.v)*.5,impulse*.16)
        a.v-=friction;b.v+=friction
        const rotation=(1.025*friction-arm*impulse)*sign*inverseInertia
        a.spin+=rotation;b.spin+=rotation
        if(closing>5&&Math.abs(ds)>1.8){
          spin(front,fi,closing,Math.sign(rotation)||sign,false,ri)
        }else if(closing>.15||Math.abs(friction)>.01){
          emit('rub',i,j,closing)
        }
      }
    }
    this.place=1+this.cars.slice(1).filter(c=>c.s>p.s && (p.s<2*length||c.s>=2*length)).length
    this.finished=p.s>=2*length
    return incident
  }
}
