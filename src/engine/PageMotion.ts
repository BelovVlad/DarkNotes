/** Inertia never activates page creation; only a deliberate edge pull can do so. */
export class PageMotion {
  private frame = 0;
  private last = 0;
  private vx = 0;
  private vy = 0;
  private pull = 0;
  private wheelLocked = false;
  private wheelTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(private viewport: () => HTMLDivElement | null, private onExtend: () => void, private onPull: (distance: number) => void) {}
  start = () => {
    cancelAnimationFrame(this.frame); this.frame = 0; this.vx = this.vy = this.pull = 0;
    this.last = performance.now(); this.onPull(0);
  };
  move = (dx: number, dy: number) => {
    const view = this.viewport(); if (!view) return;
    const now = performance.now(), dt = Math.max(8, Math.min(50, now - this.last)); this.last = now;
    this.vx = Math.max(-3.5,Math.min(3.5,this.vx * .45 - dx / dt * .55)); this.vy = Math.max(-3.5,Math.min(3.5,this.vy * .45 - dy / dt * .55));
    const before = view.scrollTop; view.scrollLeft -= dx; view.scrollTop -= dy;
    const unused = -dy - (view.scrollTop - before);
    if (dy < 0 && Math.abs(dx) < Math.abs(dy) && view.scrollTop + view.clientHeight >= view.scrollHeight - 2) {
      this.pull = Math.min(140, this.pull + Math.max(0, unused)); this.onPull(Math.round(this.pull));
    } else if (dy > 0 && this.pull) { this.pull = Math.max(0, this.pull - dy); this.onPull(Math.round(this.pull)); }
  };
  end = (inertia = true) => {
    if (this.pull >= 88) { this.start(); this.onExtend(); return; }
    this.pull = 0; this.onPull(0);
    if (!inertia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (performance.now() - this.last > 90 || Math.hypot(this.vx, this.vy) < .12) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const view = this.viewport(); if (!view) return;
      const dt = Math.min(32, now - previous); previous = now;
      const x = view.scrollLeft, y = view.scrollTop;
      view.scrollLeft += this.vx * dt; view.scrollTop += this.vy * dt;
      const decay = Math.exp(-dt / 240); this.vx *= decay; this.vy *= decay;
      if (Math.abs(view.scrollLeft - x) < .1) this.vx = 0;
      if (Math.abs(view.scrollTop - y) < .1) this.vy = 0;
      if (Math.hypot(this.vx, this.vy) > .025) this.frame = requestAnimationFrame(tick);
      else this.frame = 0;
    };
    this.frame = requestAnimationFrame(tick);
  };
  wheel = (dy: number) => {
    cancelAnimationFrame(this.frame); this.frame = 0;
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => { this.wheelLocked = false; this.pull = 0; this.onPull(0); }, 350);
    const view = this.viewport(); if (!view || this.wheelLocked) return;
    if (dy > 0 && view.scrollTop + view.clientHeight >= view.scrollHeight - 2) {
      this.pull = Math.min(140, this.pull + dy); this.onPull(Math.round(this.pull));
      if (this.pull >= 88) { this.wheelLocked = true; this.pull = 0; this.onPull(0); this.onExtend(); }
    } else if (dy < 0) { this.pull = 0; this.onPull(0); }
  };
  dispose = () => { cancelAnimationFrame(this.frame); clearTimeout(this.wheelTimer); };
}
