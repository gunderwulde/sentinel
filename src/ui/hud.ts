import type { GameEvent, RuleError, World } from '../core';
import { config } from '../core';

const ERRORS: Record<RuleError, string> = {
  NotVisible: 'No lo ves desde aquí',
  NotEnoughEnergy: 'Energía insuficiente',
  InvalidTile: 'Casilla no válida',
  HasObjectOnTop: 'Hay algo encima',
  NoSuchTarget: 'Objetivo no válido',
  NotFlat: 'La casilla no es plana',
  GameOver: 'Partida terminada',
};

export function errorText(e: RuleError): string {
  return ERRORS[e];
}

const CSS = `
#hud{overflow:hidden}
.hud-panel{position:absolute;overflow:hidden;background:rgba(10,14,20,.62);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;font-size:14px;line-height:1.5}
#hud-energy{top:16px;left:16px;font-size:20px;font-weight:600}
#hud-energy small{display:block;font-size:12px;font-weight:400;opacity:.7}
#hud-help{bottom:16px;left:16px;font-size:12px;opacity:.85;max-width:340px}
#hud-help b{color:#ffe27a}
#hud-hover{bottom:16px;left:50%;transform:translateX(-50%);min-width:220px;text-align:center;display:none}
#hud-msg{top:18%;left:50%;transform:translateX(-50%);font-size:18px;font-weight:600;opacity:0;transition:opacity .4s}
#hud-end{inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(5,8,12,.7);font-size:34px;font-weight:700;text-align:center;border:0;border-radius:0}
#hud-end small{font-size:16px;font-weight:400;opacity:.8;margin-top:10px}
#hud-alert{inset:0;border:0;border-radius:0;padding:0;box-shadow:inset 0 0 120px 30px rgba(255,40,40,.65);opacity:0;transition:opacity .25s}
.ok{color:#9dffb5}.bad{color:#ff9a9a}
`;

export class Hud {
  private readonly energy: HTMLElement;
  private readonly hover: HTMLElement;
  private readonly msg: HTMLElement;
  private readonly end: HTMLElement;
  private readonly alert: HTMLElement;
  private msgTimer = 0;
  private alertTimer = 0;

  constructor(root: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    root.innerHTML = `
      <div id="hud-alert" class="hud-panel"></div>
      <div id="hud-energy" class="hud-panel"></div>
      <div id="hud-help" class="hud-panel">
        <b>Clic izq</b> absorber · <b>1</b> árbol (1) · <b>2</b> roca (2) · <b>3</b> robot (3)<br>
        <b>T</b> transferir al robot apuntado · <b>H</b> hiperespacio (3)<br>
        <b>Botón dcho + ratón</b> o <b>flechas</b>: mirar · <b>U</b> media vuelta<br>
        <b>R</b> reiniciar · <b>N/P</b> paisaje siguiente/anterior<br>
        Objetivo: sube con rocas, absorbe al Centinela, crea un robot en su pedestal, transfiérete y pulsa H.
      </div>
      <div id="hud-hover" class="hud-panel"></div>
      <div id="hud-msg" class="hud-panel"></div>
      <div id="hud-end" class="hud-panel"></div>`;
    const q = (id: string): HTMLElement => root.querySelector<HTMLElement>(id)!;
    this.energy = q('#hud-energy');
    this.hover = q('#hud-hover');
    this.msg = q('#hud-msg');
    this.end = q('#hud-end');
    this.alert = q('#hud-alert');
  }

  update(w: World, hoverHtml: string): void {
    this.energy.innerHTML = `⚡ ${w.player.energy}<small>Paisaje ${String(w.landscape.code).padStart(4, '0')}</small>`;
    this.hover.style.display = hoverHtml ? 'block' : 'none';
    this.hover.innerHTML = hoverHtml;
    if (w.status === 'won') {
      this.end.style.display = 'flex';
      this.end.innerHTML = '¡Hiperespacio!<small>Pulsa N para el siguiente paisaje o R para repetir</small>';
    } else if (w.status === 'lost') {
      this.end.style.display = 'flex';
      this.end.innerHTML = 'Absorbido<small>Pulsa R para reintentar</small>';
    } else {
      this.end.style.display = 'none';
    }
    const now = performance.now();
    if (this.msgTimer && now > this.msgTimer) {
      this.msg.style.opacity = '0';
      this.msgTimer = 0;
    }
    if (this.alertTimer && now > this.alertTimer) {
      this.alert.style.opacity = '0';
      this.alertTimer = 0;
    }
  }

  say(text: string): void {
    this.msg.textContent = text;
    this.msg.style.opacity = '1';
    this.msgTimer = performance.now() + 2200;
  }

  flashAlert(): void {
    this.alert.style.opacity = '1';
    this.alertTimer = performance.now() + 1200;
  }

  onEvents(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'drainWarning':
          this.flashAlert();
          this.say('¡El Centinela te ve!');
          break;
        case 'drained':
          this.flashAlert();
          this.say('Te drena energía');
          break;
        case 'enemyAbsorbed':
          this.say('El Centinela absorbe un objeto');
          break;
        case 'sentinelAbsorbed':
          this.say('¡Centinela absorbido! Crea un robot en su pedestal');
          break;
        case 'absorbed':
          if (e.kind !== 'sentinel') this.say(`+${e.gain} energía`);
          break;
        case 'transferred':
          this.say('Transferido');
          break;
        case 'hyperspace':
          this.say('Hiperespacio');
          break;
        default:
          break;
      }
    }
  }

  static previewLine(label: string, err: RuleError | undefined, extra: string): string {
    return err
      ? `<span class="bad">${label} — ${errorText(err)}</span>`
      : `<span class="ok">${label}${extra ? ' ' + extra : ''}</span>`;
  }

  static get energyOf(): typeof config.energy {
    return config.energy;
  }
}
