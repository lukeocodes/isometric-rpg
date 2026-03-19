const TICK_MS = 50; // 20 ticks per second

export type TickCallback = (dt: number) => void;
export type RenderCallback = (dt: number) => void;

export class Loop {
  private tickCallbacks: TickCallback[] = [];
  private renderCallbacks: RenderCallback[] = [];
  private running = false;
  private accumulator = 0;
  private lastTime = 0;

  onTick(cb: TickCallback) {
    this.tickCallbacks.push(cb);
  }

  onRender(cb: RenderCallback) {
    this.renderCallbacks.push(cb);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  stop() {
    this.running = false;
  }

  private frame(time: number) {
    if (!this.running) return;

    const elapsed = time - this.lastTime;
    this.lastTime = time;
    this.accumulator += Math.min(elapsed, 200); // Cap at 200ms to prevent spiral

    // Fixed timestep ticks
    while (this.accumulator >= TICK_MS) {
      const dt = TICK_MS / 1000;
      for (const cb of this.tickCallbacks) {
        cb(dt);
      }
      this.accumulator -= TICK_MS;
    }

    // Variable render with frame delta
    const frameDt = elapsed / 1000;
    for (const cb of this.renderCallbacks) {
      cb(frameDt);
    }

    requestAnimationFrame((t) => this.frame(t));
  }
}
