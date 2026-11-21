// Lightweight canvas particle effects for "you did it!" feedback.

type Shape = 'dot' | 'star' | 'confetti';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number;
  vr: number;
  gravity: number;
}

export interface BurstOptions {
  count?: number;
  colors?: string[];
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
  shape?: Shape;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export class Particles {
  private ps: P[] = [];

  burst(x: number, y: number, o: BurstOptions = {}) {
    const colors = o.colors ?? ['#ffd23f', '#ffffff'];
    for (let i = 0; i < (o.count ?? 16); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (o.speed ?? 260) * rand(0.4, 1);
      const max = (o.life ?? 0.8) * rand(0.7, 1.2);
      this.ps.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: max,
        max,
        size: (o.size ?? 10) * rand(0.6, 1.2),
        color: pick(colors),
        shape: o.shape ?? 'star',
        rot: Math.random() * Math.PI,
        vr: rand(-6, 6),
        gravity: o.gravity ?? 300,
      });
    }
  }

  /** Confetti raining from the top of a w×h area. */
  confetti(w: number, h: number, colors: string[], count = 120) {
    for (let i = 0; i < count; i++) {
      const max = rand(2, 3.5);
      this.ps.push({
        x: rand(0, w),
        y: rand(-h * 0.3, -10),
        vx: rand(-60, 60),
        vy: rand(80, 260),
        life: max,
        max,
        size: rand(8, 14),
        color: pick(colors),
        shape: 'confetti',
        rot: Math.random() * Math.PI,
        vr: rand(-8, 8),
        gravity: 120,
      });
    }
  }

  clear() {
    this.ps.length = 0;
  }

  update(dt: number) {
    for (const p of this.ps) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.ps = this.ps.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const t = p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'confetti') {
        ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 'star') {
        const s = p.size * (0.5 + t * 0.5);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? s * 0.28 : s;
          const a = (i / 8) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
