import { Container, Graphics } from "pixi.js";

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  shrink: boolean;
}

/**
 * Lightweight particle system for visual effects.
 * Each effect spawns a batch of Graphics circles that move, fade, and die.
 */
export class ParticleSystem {
  public container: Container;
  private particles: Particle[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  /** Dust puff at a screen position (walking, landing) */
  spawnDust(sx: number, sy: number, zIndex: number): void {
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      const size = 2 + Math.random() * 2;
      g.circle(0, 0, size);
      g.fill({ color: 0x998877, alpha: 0.5 });
      g.position.set(sx + (Math.random() - 0.5) * 10, sy + Math.random() * 4);
      g.zIndex = zIndex;
      this.container.addChild(g);
      this.particles.push({
        g,
        vx: (Math.random() - 0.5) * 20,
        vy: -Math.random() * 15 - 5,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        gravity: 30,
        fadeOut: true,
        shrink: true,
      });
    }
  }

  /** Sparkle effect (XP gain, level up) */
  spawnSparkles(sx: number, sy: number, zIndex: number, color = 0x44ddff): void {
    for (let i = 0; i < 6; i++) {
      const g = new Graphics();
      g.circle(0, 0, 1.5);
      g.fill(color);
      g.position.set(sx + (Math.random() - 0.5) * 16, sy - Math.random() * 20);
      g.zIndex = zIndex + 1;
      this.container.addChild(g);
      this.particles.push({
        g,
        vx: (Math.random() - 0.5) * 30,
        vy: -Math.random() * 40 - 20,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        gravity: -10, // Float upward
        fadeOut: true,
        shrink: false,
      });
    }
  }

  /** Hit impact (damage taken) */
  spawnImpact(sx: number, sy: number, zIndex: number): void {
    for (let i = 0; i < 5; i++) {
      const g = new Graphics();
      g.circle(0, 0, 2);
      g.fill(0xff4444);
      g.position.set(sx, sy - 16);
      g.zIndex = zIndex + 1;
      this.container.addChild(g);
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.2 + Math.random() * 0.15,
        maxLife: 0.35,
        gravity: 60,
        fadeOut: true,
        shrink: true,
      });
    }
  }

  /** Death poof */
  spawnDeathPoof(sx: number, sy: number, zIndex: number): void {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics();
      const size = 3 + Math.random() * 3;
      g.circle(0, 0, size);
      g.fill({ color: 0x666666, alpha: 0.6 });
      g.position.set(sx, sy - 10);
      g.zIndex = zIndex + 1;
      this.container.addChild(g);
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - 30,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        gravity: 20,
        fadeOut: true,
        shrink: true,
      });
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.particles.length) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.g.destroy();
        // Swap with last element and pop — O(1) instead of O(n) splice
        const last = this.particles.length - 1;
        if (i < last) this.particles[i] = this.particles[last];
        this.particles.length = last;
        continue;
      }

      p.vy += p.gravity * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;

      const t = 1 - p.life / p.maxLife; // 0 → 1 as particle ages
      if (p.fadeOut) p.g.alpha = 1 - t;
      if (p.shrink) p.g.scale.set(1 - t * 0.5);
      i++;
    }
  }

  dispose(): void {
    for (const p of this.particles) p.g.destroy();
    this.particles = [];
    this.container.destroy();
  }
}
