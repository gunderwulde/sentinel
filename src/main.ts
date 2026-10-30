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
import type { Command, CreatableKind, GameEvent, World } from './core';
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

function hoverHtml(): string {
  const parts: string[] = [];
  const kinds: [CreatableKind, string, string][] = [
    ['tree', '1', 'Árbol'],
    ['boulder', '2', 'Roca'],
    ['synthoid', '3', 'Robot'],
  ];
  if (hover.entityId !== undefined) {
    const e = world.entities.get(hover.entityId);
    if (e) {
      const names = { tree: 'árbol', boulder: 'roca', synthoid: 'robot', sentinel: 'Centinela' };
      const abs = checkAbsorb(world, e.id);
      parts.push(Hud.previewLine(`Clic: absorber ${names[e.kind]} (+${config.energy[e.kind]})`, abs, ''));
      if (e.kind === 'synthoid') parts.push(Hud.previewLine('T: transferir', checkTransfer(world, e.id), ''));
      if (e.kind === 'boulder')
        for (const [k, key, name] of kinds) parts.push(Hud.previewLine(`${key}: ${name} encima (−${config.energy[k]})`, checkCreate(world, k, e.tile), ''));
    }
  } else if (hover.tile !== undefined) {
    for (const [k, key, name] of kinds)
      parts.push(Hud.previewLine(`${key}: ${name} (−${config.energy[k]})`, checkCreate(world, k, hover.tile), ''));
  }
  return parts.join('<br>');
}

function updateHover(): void {
  hover = renderer.pick(input.pointer.x, input.pointer.y);
  const t = hover.tile ?? (hover.entityId !== undefined ? world.entities.get(hover.entityId)?.tile : undefined);
  if (t === undefined || world.status !== 'playing') {
    renderer.setHover(null, 0, false);
    return;
  }
  const ok = hover.entityId !== undefined ? checkAbsorb(world, hover.entityId) === undefined : checkCreate(world, 'tree', t) === undefined || checkCreate(world, 'boulder', t) === undefined;
  renderer.setHover(t, tileTopY(world, t), ok);
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
    view.yaw += (elapsed / 1000) * 0.06; // giro lento de fondo bajo el menú
  }
  const overview = !playing && menu.overview;
  if (overview) view.pitch = -0.3;
  renderer.sync(world, view, overview);
  if (playing) {
    updateHover();
    hud.update(world, world.status === 'playing' ? hoverHtml() : '');
  }
  renderer.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
