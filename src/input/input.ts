import type { Command, CreatableKind, TileId } from '../core';

export interface ViewState {
  yaw: number;
  pitch: number;
}

export interface HoverInfo {
  entityId?: number;
  tile?: TileId;
}

export interface InputCallbacks {
  command(cmd: Command): void;
  restart(delta: number): void;
  pause(): void;
}

const MAX_PITCH = 1.2;

export class Input {
  /** Posición del puntero en coordenadas normalizadas (-1..1). */
  readonly pointer = { x: 0, y: 0 };
  /** Desactivado mientras hay un menú abierto. */
  enabled = false;
  private looking = false;
  private readonly keys = new Set<string>();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly view: ViewState,
    private readonly getHover: () => HoverInfo,
    private readonly cb: InputCallbacks,
  ) {
    // Botón derecho (mantener y arrastrar) = mirar. Sin menú contextual del navegador sobre el juego.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 2) this.looking = true;
      if (e.button === 0) this.onClick();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) this.looking = false;
    });
    addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      if (this.looking && this.enabled) this.look(-e.movementX * 0.004, -e.movementY * 0.004);
    });
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape' && this.enabled) return this.cb.pause();
      if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return; // no robar Ctrl+R, Ctrl+N...
      this.keys.add(e.code);
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Al perder el foco no llegan los keyup/mouseup: sin esto la cámara seguiría girando sola.
    addEventListener('blur', () => {
      this.keys.clear();
      this.looking = false;
    });
  }

  private look(dyaw: number, dpitch: number): void {
    this.view.yaw += dyaw;
    this.view.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.view.pitch + dpitch));
  }

  /** Giro continuo con las flechas. */
  update(dt: number): void {
    if (!this.enabled) {
      this.keys.clear();
      this.looking = false;
      return;
    }
    const s = 1.8 * dt;
    if (this.keys.has('ArrowLeft')) this.look(s, 0);
    if (this.keys.has('ArrowRight')) this.look(-s, 0);
    if (this.keys.has('ArrowUp')) this.look(0, s);
    if (this.keys.has('ArrowDown')) this.look(0, -s);
  }

  private onClick(): void {
    const h = this.getHover();
    if (h.entityId !== undefined) this.cb.command({ t: 'absorb', target: h.entityId });
  }

  private create(kind: CreatableKind): void {
    const h = this.getHover();
    if (h.tile !== undefined) this.cb.command({ t: 'create', kind, tile: h.tile });
  }

  private onKey(code: string): void {
    switch (code) {
      case 'Digit1':
        return this.create('tree');
      case 'Digit2':
        return this.create('boulder');
      case 'Digit3':
        return this.create('synthoid');
      case 'KeyT': {
        const h = this.getHover();
        if (h.entityId !== undefined) this.cb.command({ t: 'transfer', target: h.entityId });
        return;
      }
      case 'KeyH':
        return this.cb.command({ t: 'hyperspace' });
      case 'KeyU':
        this.view.yaw += Math.PI;
        return;
      case 'KeyR':
        return this.cb.restart(0);
      case 'KeyN':
        return this.cb.restart(1);
      case 'KeyP':
        return this.cb.restart(-1);
    }
  }
}
