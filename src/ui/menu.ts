type Screen = 'main' | 'pause' | 'help' | 'closed';

export interface MenuCallbacks {
  /** Nueva partida en el paisaje `code`. */
  start(code: number): void;
  /** Vista previa del paisaje elegido en el menú principal. */
  preview(code: number): void;
  resume(): void;
  restart(): void;
  toMain(): void;
}

const CSS = `
#menu{position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;overflow:hidden;
  font-family:system-ui,sans-serif;color:#f2f5f7;background:radial-gradient(ellipse at 50% 40%,rgba(10,14,20,.35),rgba(5,8,12,.88))}
#menu.open{display:flex}
.menu-card{display:flex;flex-direction:column;gap:clamp(6px,1.6vh,12px);box-sizing:border-box;min-width:min(320px,94vw);max-width:min(560px,94vw);max-height:96vh;overflow:hidden;padding:clamp(14px,4vh,32px) clamp(16px,4vw,36px);
  background:rgba(10,14,20,.7);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:16px;text-align:center}
.menu-title{font-size:clamp(28px,8vh,54px);font-weight:800;letter-spacing:.28em;margin:0 0 0 .28em;text-shadow:0 0 28px rgba(255,90,79,.55)}
.menu-sub{margin:-6px 0 14px;font-size:13px;opacity:.65;letter-spacing:.08em}
.menu-btn{font:inherit;font-size:17px;font-weight:600;color:inherit;padding:12px 18px;border-radius:10px;cursor:pointer;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);transition:background .15s,transform .15s}
.menu-btn:hover,.menu-btn:focus-visible{background:rgba(255,226,122,.2);border-color:#ffe27a;outline:none;transform:translateY(-1px)}
.menu-btn.primary{background:#ffe27a;color:#1a1500;border-color:#ffe27a}
.menu-btn.primary:hover,.menu-btn.primary:focus-visible{background:#fff0a6}
.menu-row{display:flex;gap:10px;align-items:center;justify-content:center;font-size:14px}
.menu-row input{width:92px;font:inherit;font-size:18px;text-align:center;padding:8px;border-radius:8px;color:inherit;
  background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.25)}
.menu-row input:focus{outline:none;border-color:#ffe27a}
.menu-row .menu-btn{padding:8px 12px;font-size:14px}
.menu-row input[type=number]{-moz-appearance:textfield;appearance:textfield}
.menu-row input::-webkit-outer-spin-button,.menu-row input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.menu-help{text-align:left;font-size:clamp(11px,1.9vh,14px);line-height:1.45}
.menu-help h3{margin:clamp(2px,.8vh,6px) 0 2px;font-size:clamp(12px,2vh,15px);color:#ffe27a}
.menu-help kbd{background:rgba(255,255,255,.14);border-radius:4px;padding:0 6px;font-family:inherit;font-weight:700}
.menu-foot{font-size:12px;opacity:.5;margin-top:6px}
`;

const HELP = `
<div class="menu-help">
  <h3>Objetivo</h3>
  Sube más alto que el Centinela, absórbelo, crea un robot en su pedestal, transfiérete a él y salta al hiperespacio.
  <h3>Acciones</h3>
  <kbd>Clic izq</kbd> absorber lo apuntado (+energía) · <kbd>1</kbd> árbol (−1) · <kbd>2</kbd> roca (−2) · <kbd>3</kbd> robot (−3)<br>
  <kbd>T</kbd> transferirte al robot apuntado · <kbd>H</kbd> hiperespacio (−3)
  <h3>Cámara</h3>
  <kbd>Botón dcho + ratón</kbd> o flechas: mirar · <kbd>U</kbd> media vuelta
  <h3>Partida</h3>
  <kbd>Esc</kbd> pausa · <kbd>R</kbd> reiniciar · <kbd>N</kbd>/<kbd>P</kbd> paisaje siguiente/anterior
  <h3>Peligro</h3>
  Si el Centinela ve tu casilla te avisa (pantalla roja) y luego te drena energía. Ponte fuera de su vista o transfiérete.
  Solo puedes crear en casillas planas que veas, y apilar sobre rocas.
</div>`;

export class Menu {
  private readonly root: HTMLElement;
  private screen: Screen = 'closed';
  private from: 'main' | 'pause' = 'main';
  private lastCode = 0;

  constructor(private readonly cb: MenuCallbacks, initialCode: number) {
    this.lastCode = initialCode;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.root = document.createElement('div');
    this.root.id = 'menu';
    document.body.append(this.root);
  }

  /** El menú principal (y su ayuda) se ven sobre la cámara de presentación; la pausa, sobre la partida. */
  get overview(): boolean {
    return this.screen === 'main' || (this.screen === 'help' && this.from === 'main');
  }

  get isPause(): boolean {
    return this.screen === 'pause';
  }

  close(): void {
    this.screen = 'closed';
    this.root.classList.remove('open');
    this.root.innerHTML = '';
  }

  show(screen: Exclude<Screen, 'closed'>, code?: number): void {
    if (code !== undefined) this.lastCode = code;
    if (screen !== 'help') this.from = screen; // la ayuda vuelve a donde se abrió
    this.screen = screen;
    this.root.classList.add('open');
    if (screen === 'main') this.renderMain();
    else if (screen === 'pause') this.renderPause();
    else this.renderHelp();
  }

  private card(html: string): HTMLElement {
    this.root.innerHTML = `<div class="menu-card">${html}</div>`;
    return this.root.firstElementChild as HTMLElement;
  }

  private on(sel: string, fn: () => void): void {
    this.root.querySelector(sel)?.addEventListener('click', fn);
  }

  private readCode(): number {
    const el = this.root.querySelector<HTMLInputElement>('#menu-code');
    const n = parseInt(el?.value ?? '', 10);
    return Number.isFinite(n) ? Math.min(9999, Math.max(0, n)) : this.lastCode;
  }

  private renderMain(): void {
    this.card(`
      <h1 class="menu-title">SENTINEL</h1>
      <p class="menu-sub">ADAPTACIÓN WEB DE THE SENTINEL · 10 000 PAISAJES</p>
      <button class="menu-btn primary" id="m-play">Jugar</button>
      <div class="menu-row">
        <label for="menu-code">Paisaje</label>
        <input id="menu-code" type="number" min="0" max="9999" value="${this.lastCode}" />
        <button class="menu-btn" id="m-rand">Aleatorio</button>
      </div>
      <button class="menu-btn" id="m-help">Cómo jugar</button>
      <div class="menu-foot">Prototipo v0.1 · generador de paisajes propio</div>`);
    const input = this.root.querySelector<HTMLInputElement>('#menu-code')!;
    const play = (): void => {
      const c = this.readCode();
      this.close();
      this.cb.start(c);
    };
    this.on('#m-play', play);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') play();
      e.stopPropagation();
    });
    // El campo siempre muestra el código realmente usado (ya acotado a 0–9999).
    const sync = (): void => {
      this.lastCode = this.readCode();
      if (input.value !== '') input.value = String(this.lastCode);
      this.cb.preview(this.lastCode);
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', () => {
      input.value = String(this.readCode());
    });
    this.on('#m-rand', () => {
      input.value = String(Math.floor(Math.random() * 10000));
      sync();
    });
    this.on('#m-help', () => this.show('help'));
    this.root.querySelector<HTMLElement>('#m-play')?.focus();
  }

  private renderPause(): void {
    this.card(`
      <h1 class="menu-title" style="font-size:38px">PAUSA</h1>
      <button class="menu-btn primary" id="p-resume">Reanudar</button>
      <button class="menu-btn" id="p-restart">Reiniciar paisaje</button>
      <button class="menu-btn" id="p-help">Cómo jugar</button>
      <button class="menu-btn" id="p-main">Menú principal</button>`);
    this.on('#p-resume', () => {
      this.close();
      this.cb.resume();
    });
    this.on('#p-restart', () => {
      this.close();
      this.cb.restart();
    });
    this.on('#p-help', () => this.show('help'));
    this.on('#p-main', () => {
      this.cb.toMain();
    });
    this.root.querySelector<HTMLElement>('#p-resume')?.focus();
  }

  private renderHelp(): void {
    const back = this.from;
    this.card(`
      <h1 class="menu-title" style="font-size:34px">CÓMO JUGAR</h1>
      ${HELP}
      <button class="menu-btn primary" id="h-back">Volver</button>`);
    this.on('#h-back', () => this.show(back));
    this.root.querySelector<HTMLElement>('#h-back')?.focus();
  }

}
