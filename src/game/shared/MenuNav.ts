import Phaser from 'phaser';

/**
 * A keyboard / controller cursor for screens that were built for the mouse:
 * the arrow keys (the D-pad, through Pad.ts) move a highlight between the
 * items - to the nearest one in that direction, so it works for lists, rows
 * and grids alike - and Enter / Space (A / Start) picks the highlighted one.
 * Hovering an item with the mouse moves the highlight there too.
 */

export interface NavItem {
  /** Centre and size in screen space (for the highlight and for spatial moves). */
  x: number;
  y: number;
  w: number;
  h: number;
  activate: () => void;
  /** Called when the highlight arrives (true) or leaves (false), e.g. to recolour a label. */
  onFocus?: (on: boolean) => void;
  /** Something to hover with the mouse to move the highlight here. */
  hover?: Phaser.GameObjects.GameObject;
}

export interface MenuNavOptions {
  initial?: number;
  /** Highlight colour. */
  color?: number;
  depth?: number;
  /** Draw the highlight box (default true); set false when onFocus shows the focus itself. */
  box?: boolean;
  /** Called whenever the focus moves (with the new index). */
  onMove?: (i: number) => void;
}

export class MenuNav {
  private index: number;
  private readonly box: Phaser.GameObjects.Graphics | null;
  private readonly tween: Phaser.Tweens.Tween | null;
  private enabled = true;
  private readonly onKey: (ev: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: NavItem[],
    private readonly opts: MenuNavOptions = {},
  ) {
    this.index = Math.max(0, Math.min(items.length - 1, opts.initial ?? 0));
    if (opts.box !== false) {
      this.box = scene.add.graphics().setDepth(opts.depth ?? 1000);
      this.tween = scene.tweens.add({ targets: this.box, alpha: { from: 1, to: 0.45 }, duration: 520, yoyo: true, repeat: -1 });
    } else {
      this.box = null;
      this.tween = null;
    }
    items.forEach((it, i) => it.hover?.on('pointerover', () => this.enabled && this.focus(i)));
    this.onKey = (ev) => this.handle(ev);
    scene.input.keyboard!.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.draw();
    items[this.index]?.onFocus?.(true);
  }

  get current(): number {
    return this.index;
  }

  focus(i: number): void {
    if (i === this.index || !this.items[i]) return;
    this.items[this.index]?.onFocus?.(false);
    this.index = i;
    this.items[i].onFocus?.(true);
    this.draw();
    this.opts.onMove?.(i);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.box?.setVisible(on);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.tween?.remove();
    this.box?.destroy();
  }

  private handle(ev: KeyboardEvent): void {
    if (!this.enabled || !this.items.length) return;
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = dirs[ev.key];
    if (d) {
      this.move(d[0], d[1]);
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      if (ev.repeat) return;
      this.items[this.index].activate();
    }
  }

  /** Moves to the nearest item in direction (dx, dy), favouring ones straight ahead. */
  private move(dx: number, dy: number): void {
    const from = this.items[this.index];
    let best = -1;
    let bestScore = Infinity;
    this.items.forEach((it, i) => {
      if (i === this.index) return;
      const ox = it.x - from.x;
      const oy = it.y - from.y;
      const along = ox * dx + oy * dy;
      if (along <= 1) return;
      const across = Math.abs(ox * dy - oy * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) {
      // Nothing that way: wrap along lists (up from the top goes to the bottom).
      const sorted = this.items
        .map((it, i) => ({ i, key: it.x * dx + it.y * dy, off: Math.abs((it.x - from.x) * dy - (it.y - from.y) * dx) }))
        .filter((o) => o.i !== this.index && o.off < 4);
      if (!sorted.length) return;
      sorted.sort((a, b) => a.key - b.key);
      best = sorted[0].i;
    }
    this.focus(best);
  }

  private draw(): void {
    if (!this.box) return;
    const it = this.items[this.index];
    this.box.clear();
    if (!it) return;
    const c = this.opts.color ?? 0xf8d800;
    this.box.lineStyle(3, c, 1).strokeRoundedRect(it.x - it.w / 2 - 5, it.y - it.h / 2 - 5, it.w + 10, it.h + 10, 6);
  }
}
