import {
  apply,
  checkAbsorb,
  checkCreate,
  checkTransfer,
  config,
  createWorld,
  playerEntity,
  tick,
  tileTopY,
  tileX,
  tileZ,
} from './core';
import type { Command, CreatableKind, GameEvent, RuleError, World } from './core';
import { Input } from './input/input';
import type { HoverInfo, ViewState } from './input/input';
import { Renderer } from './render/renderer';
import { Hud, errorText } from './ui/hud';
import { Menu } from './ui/menu';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hudRoot = document.querySelector<HTMLElement>('#hud')!;
const hud = new Hud(hudRoot);
const renderer = new Renderer(canvas);

const params = new URLSearchParams(location.search);
let code = Math.abs(parseInt(params.get('code') ?? '0', 10) || 0) % 10000;
let world: World;
const view: ViewState = { yaw: 0, pitch: -0.15 };
let hover: HoverInfo = {};

function load(newCode: number): void {
  code = (newCode + 10000) % 10000;
  history.replaceState(null, '', `?code=${code}`);
  world = createWorld(code);
  hover = {}; // los ids se reinician en cada mundo: un hover viejo apuntaría a otra entidad
  hoverKey = '';
  renderer.setWorld(world);
  const me = playerEntity(world)!;
  const s = world.entities.get(world.sentinelId!)!;
  view.yaw = Math.atan2(tileX(s.tile) - tileX(me.tile), tileZ(s.tile) - tileZ(me.tile));
  view.pitch = -0.15;
  (window as unknown as { __game: unknown }).__game = { get world() { return world; } };
}

function run(cmd: Command): void {
  const r = apply(world, cmd);
  if (r.error) hud.say(errorText(r.error));
  hud.onEvents(r.events);
}

let playing = false;

function setPlaying(p: boolean): void {
  playing = p;
  input.enabled = p;
  hudRoot.style.display = p ? '' : 'none';
  if (!p) renderer.setHover(null, 0, false);
}

const input = new Input(canvas, view, () => hover, {
  command: run,
  restart: (d) => load(d === 0 ? code : code + d),
  pause: () => {
    setPlaying(false);
    menu.show('pause');
  },
});

const menu = new Menu(
  {
    start: (c) => {
      load(c);
      setPlaying(true);
    },
    preview: (c) => {
      if (c !== code) load(c);
    },
    resume: () => setPlaying(true),
    restart: () => {
      load(code);
      setPlaying(true);
    },
    toMain: () => {
      load(code); // descarta la partida en curso y muestra el nivel limpio
      menu.show('main', code);
    },
  },
  code,
);

// Esc también reanuda desde la pausa (el Input está desactivado mientras hay menú).
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !e.repeat && menu.isPause) {
    menu.close();
    setPlaying(true);
  }
});

const KINDS: [CreatableKind, string, string][] = [
  ['tree', '1', 'Árbol'],
  ['boulder', '2', 'Roca'],
  ['synthoid', '3', 'Robot'],
];
const NAMES = { tree: 'árbol', boulder: 'roca', synthoid: 'robot', sentinel: 'Centinela' };

interface HoverView {
  html: string;
  tile: number | null;
  y: number;
  ok: boolean;
}

// La visibilidad cuesta ~25–60 µs por comprobación y el resultado solo cambia si cambia el objetivo apuntado,
// el mundo (version) o la energía/robot del jugador: se cachea por esa clave.
let hoverKey = '';
let hoverView: HoverView = { html: '', tile: null, y: 0, ok: false };

function analyzeHover(): HoverView {
  const key = `${hover.entityId ?? ''}|${hover.tile ?? ''}|${world.version}|${world.player.energy}|${world.player.synthoidId}|${world.status}`;
  if (key === hoverKey) return hoverView;
  hoverKey = key;

  const parts: string[] = [];
  let tile: number | null = null;
  let ok = false;
  const line = (label: string, err: RuleError | undefined): void => {
    parts.push(Hud.previewLine(label, err, ''));
  };
  if (hover.entityId !== undefined) {
    const e = world.entities.get(hover.entityId);
    if (e) {
      tile = e.tile;
      const abs = checkAbsorb(world, e.id);
      ok = abs === undefined;
      line(`Clic: absorber ${NAMES[e.kind]} (+${config.energy[e.kind]})`, abs);
      if (e.kind === 'synthoid') line('T: transferir', checkTransfer(world, e.id));
      if (e.kind === 'boulder')
        for (const [k, kk, name] of KINDS) line(`${kk}: ${name} encima (−${config.energy[k]})`, checkCreate(world, k, e.tile));
    }
  } else if (hover.tile !== undefined) {
    tile = hover.tile;
    for (const [k, kk, name] of KINDS) {
      const err = checkCreate(world, k, hover.tile);
      if (err === undefined) ok = true;
      line(`${kk}: ${name} (−${config.energy[k]})`, err);
    }
  }
  if (world.status !== 'playing') tile = null;
  hoverView = {
    html: world.status === 'playing' ? parts.join('<br>') : '',
    tile,
    y: tile === null ? 0 : tileTopY(world, tile),
    ok,
  };
  return hoverView;
}

load(code);
setPlaying(false);
menu.show('main', code);

const DT = 1000 / config.tickHz;
let acc = 0;
let last = performance.now();

function frame(now: number): void {
  const elapsed = Math.min(now - last, 250);
  last = now;
  acc += elapsed;
  if (playing) {
    while (acc >= DT) {
      const events: GameEvent[] = tick(world);
      if (events.length > 0) hud.onEvents(events);
      acc -= DT;
    }
    input.update(elapsed / 1000);
  } else {
    acc = 0;
  }
  const overview = !playing && menu.overview;
  if (overview) {
    view.yaw += (elapsed / 1000) * 0.06; // giro lento desde el centro del nivel (solo menú principal)
    view.pitch = -0.3;
  }
  renderer.update(elapsed / 1000);
  renderer.sync(world, view, overview);
  if (playing) {
    hover = renderer.pick(input.pointer.x, input.pointer.y);
    const hv = analyzeHover();
    renderer.setHover(hv.tile, hv.y, hv.ok);
    hud.update(world, hv.html);
  }
  renderer.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
