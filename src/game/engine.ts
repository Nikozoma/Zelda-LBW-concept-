import { sound } from './audio';
import {
  createInitialChests,
  createInitialCrystalOrbs,
  createInitialEnemies,
  createInitialPedestals,
  createInitialPickups,
  createInitialSignposts,
  createInitialWorlds,
  FISSURE_LINKS,
  MAP_H,
  MAP_W,
  TILE_SIZE,
  WorldData,
} from './levels';
import {
  BombEntity,
  BoomerangState,
  ChestEntity,
  CrystalOrb,
  Direction,
  Enemy,
  FloatingToast,
  GamePhase,
  HudSnapshot,
  ItemId,
  MergeState,
  Particle,
  PedestalEntity,
  Pickup,
  Player,
  Projectile,
  Signpost,
  TileKind,
  WorldId,
} from './types';

const PLAYER_SPEED = 165;
const MERGE_SPEED = 138;
const MERGE_STAMINA_DRAIN = 13.5; // per second
const STAMINA_REGEN_RATE = 38; // per second

export class ALBWEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (hud: HudSnapshot) => void;

  private phase: GamePhase = 'TITLE_MENU';
  private worlds: Record<WorldId, WorldData> = createInitialWorlds();
  private currentWorld: WorldId = 'hyrule';

  private player: Player;
  private chests: ChestEntity[] = [];
  private pedestals: PedestalEntity[] = [];
  private crystalOrbs: CrystalOrb[] = [];
  private signposts: Signpost[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private projectiles: Projectile[] = [];
  private bombs: BombEntity[] = [];
  private particles: Particle[] = [];
  private toasts: FloatingToast[] = [];
  private boomerang: BoomerangState;

  private nextEntityId = 100;
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;

  private camX = 0;
  private camY = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private hitstopTimer = 0;
  private warpFlashTimer = 0;
  private warpColor = '#a855f7';
  private bannerText: string | null = null;
  private bannerTimer = 0;

  private elapsedTime = 0;
  private playTime = 0;
  private enemiesDefeated = 0;
  private fissuresCrossed = 0;
  private bossDefeated = false;
  private arenaCleared = false;

  private rafId = 0;
  private lastTime = 0;
  private hudEmitAccum = 0;
  private lastHudKey = '';

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (hud: HudSnapshot) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context');
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;

    this.player = this.createInitialPlayer();
    this.boomerang = this.createEmptyBoomerang();
    this.resetWorldState('TITLE_MENU');
  }

  private createInitialPlayer(): Player {
    return {
      x: 14.5 * TILE_SIZE,
      y: 15.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'N',
      hp: 10, // 5 full hearts
      maxHp: 10,
      stamina: 100,
      maxStamina: 100,
      staminaRegenDelay: 0,
      rupees: 0,
      keys: 0,
      unlockedItems: [],
      equippedItem: null,
      merged: false,
      mergeState: null,
      mergeAnim: 0,
      swordTimer: 0,
      swordCooldown: 0,
      invulnTimer: 0,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      walkCycle: 0,
      lastSafeX: 14.5 * TILE_SIZE,
      lastSafeY: 15.5 * TILE_SIZE,
      lastSafeWorld: 'hyrule',
      warpCooldown: 0,
    };
  }

  private createEmptyBoomerang(): BoomerangState {
    return {
      active: false,
      world: 'hyrule',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      returning: false,
      timer: 0,
      angle: 0,
      carriedPickupIds: [],
    };
  }

  public resetWorldState(targetPhase: GamePhase = 'PLAYING') {
    this.phase = targetPhase;
    this.worlds = createInitialWorlds();
    this.currentWorld = 'hyrule';
    this.player = this.createInitialPlayer();
    this.chests = createInitialChests();
    this.pedestals = createInitialPedestals();
    this.crystalOrbs = createInitialCrystalOrbs();
    this.signposts = createInitialSignposts();
    this.enemies = createInitialEnemies();
    this.pickups = createInitialPickups();
    this.projectiles = [];
    this.bombs = [];
    this.particles = [];
    this.toasts = [];
    this.boomerang = this.createEmptyBoomerang();
    this.shakeTimer = 0;
    this.hitstopTimer = 0;
    this.warpFlashTimer = 0;
    this.playTime = 0;
    this.enemiesDefeated = 0;
    this.fissuresCrossed = 0;
    this.bossDefeated = false;
    this.arenaCleared = false;
    this.heldKeys.clear();
    this.justPressed.clear();

    if (targetPhase === 'PLAYING') {
      this.showBanner('Hyrule Overworld — Claim the Boomerang at Ravio’s Stall', 3.4);
    } else {
      this.bannerText = null;
      this.bannerTimer = 0;
    }

    this.centerCameraImmediate();
    this.emitHud(true);
  }

  public startGame() {
    this.resetWorldState('PLAYING');
    sound.itemFanfare();
  }

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    this.heldKeys.clear();
    this.justPressed.clear();
    this.emitHud(true);
  }

  public togglePause() {
    if (this.phase === 'PLAYING') {
      this.setPhase('PAUSED');
    } else if (this.phase === 'PAUSED') {
      this.setPhase('PLAYING');
    }
  }

  public selectItem(item: ItemId) {
    if (this.player.unlockedItems.includes(item)) {
      this.player.equippedItem = item;
      this.emitHud(true);
    }
  }

  public toggleMute(): boolean {
    const muted = sound.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public handleKeyDown(code: string) {
    if (!this.heldKeys.has(code)) {
      this.justPressed.add(code);
    }
    this.heldKeys.add(code);

    if (code === 'Escape' || code === 'KeyP') {
      if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
        this.togglePause();
      }
    } else if (code === 'KeyM') {
      this.toggleMute();
    } else if (this.phase === 'PLAYING') {
      if (code === 'Digit1') this.selectItem('bow');
      if (code === 'Digit2') this.selectItem('bomb');
      if (code === 'Digit3') this.selectItem('boomerang');
      if (code === 'Tab' || code === 'KeyQ') {
        this.cycleItem();
      }
    }
  }

  public handleKeyUp(code: string) {
    this.heldKeys.delete(code);
  }

  public handleBlur() {
    this.heldKeys.clear();
    this.justPressed.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  }

  public setTouchMove(x: number, y: number) {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
  }

  public triggerTouchAction(action: 'sword' | 'merge' | 'item' | 'cycle') {
    if (this.phase !== 'PLAYING') return;
    if (action === 'sword') {
      this.justPressed.add('Space');
    } else if (action === 'merge') {
      this.justPressed.add('KeyE');
    } else if (action === 'item') {
      this.justPressed.add('KeyF');
    } else if (action === 'cycle') {
      this.cycleItem();
    }
  }

  public handleCanvasClick(button: number) {
    if (this.phase !== 'PLAYING') return;
    if (button === 0) {
      this.justPressed.add('MouseSword');
    } else if (button === 2) {
      this.justPressed.add('MouseItem');
    }
  }

  private cycleItem() {
    const list = this.player.unlockedItems;
    if (list.length === 0) return;
    const idx = this.player.equippedItem ? list.indexOf(this.player.equippedItem) : -1;
    this.player.equippedItem = list[(idx + 1) % list.length];
    this.emitHud(true);
  }

  public mount() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.resizeCanvasIfNeeded();
      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public unmount() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private resizeCanvasIfNeeded() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.floor(parent.clientWidth));
    const h = Math.max(240, Math.floor(parent.clientHeight));
    const targetW = Math.floor(w * dpr);
    const targetH = Math.floor(h * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  private showBanner(text: string, duration = 2.8) {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.emitHud(true);
  }

  private spawnToast(x: number, y: number, text: string, color = '#fde68a') {
    this.toasts.push({ x, y, text, color, life: 1.25, maxLife: 1.25 });
  }

  private spawnBurst(x: number, y: number, color: string, count = 12, speed = 110, glow = false) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.45 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 2.5 + Math.random() * 3,
        color,
        glow,
      });
    }
  }

  private triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  private getObjectiveText(): string {
    if (this.bossDefeated) {
      return 'Claim the Pendant of Courage in the Sanctuary Vault';
    }
    if (this.currentWorld === 'dungeon') {
      if (!this.arenaCleared) {
        return 'Solve the East Wing puzzles and defeat the West Armory Guard';
      }
      return 'Enter the North Vault and defeat the Phantom Knight';
    }
    if (!this.player.unlockedItems.includes('boomerang')) {
      return 'Pick up the Boomerang at Ravio’s Stall';
    }
    if (!this.player.unlockedItems.includes('bow')) {
      return 'Wall-Merge (E) across the East Gorge for the Bow';
    }
    if (this.player.keys === 0 && this.worlds.hyrule.tiles[2][14] === 'locked_door') {
      return 'Use the Boomerang over the North Moat to fetch the Sanctuary Key';
    }
    if (!this.player.unlockedItems.includes('bomb')) {
      return 'Enter the West Fissure to Lorule and find the Bomb Bag';
    }
    if (this.worlds.lorule.tiles[3][11] === 'cracked_block') {
      return 'Bomb the North Lorule boulder and cross the Fissure to the Sanctuary';
    }
    if (this.worlds.hyrule.tiles[2][14] === 'locked_door') {
      return 'Unlock the Eastern Sanctuary Gate on Hyrule’s North Terrace';
    }
    return 'Enter the Eastern Sanctuary Dungeon';
  }

  private update(dt: number) {
    this.elapsedTime += dt;

    if (this.phase === 'TITLE_MENU') {
      // Atmospheric slow live-world pan across Hyrule Courtyard & West Fissure
      const vw = this.canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const vh = this.canvas.height / Math.min(window.devicePixelRatio || 1, 2);
      const mapPxW = MAP_W * TILE_SIZE;
      const mapPxH = MAP_H * TILE_SIZE;
      const targetX = mapPxW * 0.42 + Math.sin(this.elapsedTime * 0.22) * 190 - vw / 2;
      const targetY = mapPxH * 0.56 + Math.cos(this.elapsedTime * 0.17) * 90 - vh / 2;
      this.camX = Math.max(0, Math.min(Math.max(0, mapPxW - vw), targetX));
      this.camY = Math.max(0, Math.min(Math.max(0, mapPxH - vh), targetY));

      if (Math.random() < dt * 8) {
        this.particles.push({
          x: 4.5 * TILE_SIZE + (Math.random() - 0.5) * 32,
          y: 9.6 * TILE_SIZE + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 14,
          vy: -15 - Math.random() * 20,
          life: 1.1,
          maxLife: 1.1,
          size: 2.5,
          color: Math.random() > 0.4 ? '#c084fc' : '#fde047',
          glow: true,
        });
      }
      this.updateParticles(dt);
      this.justPressed.clear();
      return;
    }

    if (this.phase !== 'PLAYING') {
      this.justPressed.clear();
      return;
    }

    this.playTime += dt;

    if (this.warpFlashTimer > 0) {
      this.warpFlashTimer = Math.max(0, this.warpFlashTimer - dt);
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
        this.emitHud(true);
      }
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) this.shakeIntensity = 0;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateParticles(dt * 0.35);
      this.justPressed.clear();
      return;
    }

    // Ambient fissure shimmer particles
    if (this.currentWorld !== 'dungeon' && Math.random() < dt * 10) {
      for (const fl of FISSURE_LINKS) {
        if (fl.world === this.currentWorld) {
          this.particles.push({
            x: (fl.link.tx + 0.5) * TILE_SIZE + (Math.random() - 0.5) * 20,
            y: (fl.link.ty + 0.92) * TILE_SIZE,
            vx: (Math.random() - 0.5) * 16,
            vy: -14 - Math.random() * 18,
            life: 0.8,
            maxLife: 0.8,
            size: 2.4,
            color: this.currentWorld === 'hyrule' ? '#c084fc' : '#fde047',
            glow: true,
          });
        }
      }
    }

    this.updatePlayer(dt);
    this.updateCrystalOrbs(dt);
    this.updateBombs(dt);
    this.updateBoomerang(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateToasts(dt);
    this.updateCamera(dt);

    this.justPressed.clear();

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private getTile(world: WorldId, tx: number, ty: number): TileKind {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'wall';
    return this.worlds[world].tiles[ty][tx];
  }

  private isTileMergeable(world: WorldId, tx: number, ty: number): boolean {
    const t = this.getTile(world, tx, ty);
    return t === 'wall' || t === 'fissure';
  }

  private isTileWalkableForPlayer(world: WorldId, tx: number, ty: number): boolean {
    const t = this.getTile(world, tx, ty);
    if (
      t === 'grass' ||
      t === 'lorule_grass' ||
      t === 'path' ||
      t === 'dungeon_floor' ||
      t === 'bridge' ||
      t === 'dungeon_portal' ||
      t === 'exit_portal'
    ) {
      return true;
    }
    if (t === 'crystal_red') return this.worlds[world].crystalBlueActive;
    if (t === 'crystal_blue') return !this.worlds[world].crystalBlueActive;
    return false;
  }

  private isTileSolidForProjectiles(world: WorldId, tx: number, ty: number): boolean {
    const t = this.getTile(world, tx, ty);
    if (t === 'wall' || t === 'fissure' || t === 'cracked_block' || t === 'locked_door' || t === 'boss_door') {
      return true;
    }
    if (t === 'crystal_red') return !this.worlds[world].crystalBlueActive;
    if (t === 'crystal_blue') return this.worlds[world].crystalBlueActive;
    // Projectiles fly right over chasm, water, bush, and iron bars!
    return false;
  }

  private getSideVectors(side: Direction): { nx: number; ny: number; ux: number; uy: number } {
    switch (side) {
      case 'S':
        return { nx: 0, ny: 1, ux: 1, uy: 0 };
      case 'N':
        return { nx: 0, ny: -1, ux: 1, uy: 0 };
      case 'E':
        return { nx: 1, ny: 0, ux: 0, uy: 1 };
      case 'W':
        return { nx: -1, ny: 0, ux: 0, uy: 1 };
    }
  }

  private getOppositeDir(d: Direction): Direction {
    if (d === 'N') return 'S';
    if (d === 'S') return 'N';
    if (d === 'E') return 'W';
    return 'E';
  }

  private getMergeWorldPos(m: MergeState): { x: number; y: number } {
    switch (m.side) {
      case 'S':
        return { x: (m.tx + m.t) * TILE_SIZE, y: (m.ty + 1) * TILE_SIZE - 5 };
      case 'N':
        return { x: (m.tx + m.t) * TILE_SIZE, y: m.ty * TILE_SIZE + 5 };
      case 'W':
        return { x: m.tx * TILE_SIZE + 5, y: (m.ty + m.t) * TILE_SIZE };
      case 'E':
        return { x: (m.tx + 1) * TILE_SIZE - 5, y: (m.ty + m.t) * TILE_SIZE };
    }
  }

  private findNearbyMergeTarget(): MergeState | null {
    const p = this.player;
    const dirsToCheck: Direction[] = [p.dir, 'N', 'S', 'E', 'W'];
    const seen = new Set<Direction>();

    for (const d of dirsToCheck) {
      if (seen.has(d)) continue;
      seen.add(d);
      const vec =
        d === 'N'
          ? { dx: 0, dy: -1 }
          : d === 'S'
          ? { dx: 0, dy: 1 }
          : d === 'E'
          ? { dx: 1, dy: 0 }
          : { dx: -1, dy: 0 };
      for (const dist of [20, 30]) {
        const probeX = p.x + vec.dx * dist;
        const probeY = p.y + vec.dy * dist;
        const tx = Math.floor(probeX / TILE_SIZE);
        const ty = Math.floor(probeY / TILE_SIZE);
        if (this.isTileMergeable(this.currentWorld, tx, ty)) {
          const side = this.getOppositeDir(d);
          const t =
            side === 'S' || side === 'N'
              ? Math.max(0.15, Math.min(0.85, (p.x - tx * TILE_SIZE) / TILE_SIZE))
              : Math.max(0.15, Math.min(0.85, (p.y - ty * TILE_SIZE) / TILE_SIZE));
          return { tx, ty, side, t };
        }
      }
    }
    return null;
  }

  private enterMerge(target: MergeState) {
    this.player.merged = true;
    this.player.mergeState = { ...target };
    this.player.swordTimer = 0;
    const pos = this.getMergeWorldPos(target);
    this.player.x = pos.x;
    this.player.y = pos.y;
    this.player.dir = target.side;
    sound.wallMergeEnter();
    this.spawnBurst(pos.x, pos.y, '#38bdf8', 12, 90, true);
    this.emitHud(true);
  }

  private tryExitMerge(forcePenaltyIfUnsafe = false): boolean {
    const m = this.player.mergeState;
    if (!m) {
      this.player.merged = false;
      return true;
    }
    const { nx, ny } = this.getSideVectors(m.side);
    const outTx = m.tx + nx;
    const outTy = m.ty + ny;

    if (this.isTileWalkableForPlayer(this.currentWorld, outTx, outTy)) {
      this.player.merged = false;
      this.player.mergeState = null;
      this.player.x = (outTx + 0.5) * TILE_SIZE;
      this.player.y = (outTy + 0.5) * TILE_SIZE;
      this.player.dir = m.side;
      this.player.lastSafeX = this.player.x;
      this.player.lastSafeY = this.player.y;
      this.player.lastSafeWorld = this.currentWorld;
      sound.wallMergeExit();
      this.spawnBurst(this.player.x, this.player.y, '#fde047', 10, 80, true);
      this.emitHud(true);
      return true;
    }

    if (forcePenaltyIfUnsafe) {
      this.player.merged = false;
      this.player.mergeState = null;
      this.currentWorld = this.player.lastSafeWorld;
      this.player.x = this.player.lastSafeX;
      this.player.y = this.player.lastSafeY;
      this.damagePlayer(1, 0, 0);
      this.spawnToast(this.player.x, this.player.y - 24, 'Energy Depleted!', '#fca5a5');
      this.emitHud(true);
      return true;
    }

    sound.shieldClang();
    const pos = this.getMergeWorldPos(m);
    this.spawnToast(pos.x, pos.y - 22, 'Unsafe ground below!', '#fca5a5');
    return false;
  }

  private updatePlayer(dt: number) {
    const p = this.player;

    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.swordCooldown > 0) p.swordCooldown = Math.max(0, p.swordCooldown - dt);
    if (p.swordTimer > 0) p.swordTimer = Math.max(0, p.swordTimer - dt);
    if (p.warpCooldown > 0) p.warpCooldown = Math.max(0, p.warpCooldown - dt);
    if (p.staminaRegenDelay > 0) p.staminaRegenDelay = Math.max(0, p.staminaRegenDelay - dt);

    p.mergeAnim += ((p.merged ? 1 : 0) - p.mergeAnim) * Math.min(1, dt * 16);

    const mergePressed = this.justPressed.has('KeyE') || this.justPressed.has('ShiftLeft') || this.justPressed.has('ShiftRight');
    const swordPressed =
      this.justPressed.has('Space') || this.justPressed.has('KeyJ') || this.justPressed.has('MouseSword');
    const itemPressed =
      this.justPressed.has('KeyF') || this.justPressed.has('KeyK') || this.justPressed.has('MouseItem');

    let ix = this.touchMoveX;
    let iy = this.touchMoveY;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) ix -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) ix += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) iy -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) iy += 1;
    ix = Math.max(-1, Math.min(1, ix));
    iy = Math.max(-1, Math.min(1, iy));

    if (p.merged && p.mergeState) {
      // Stamina drain
      p.stamina = Math.max(0, p.stamina - MERGE_STAMINA_DRAIN * dt);
      p.staminaRegenDelay = 0.45;
      if (p.stamina <= 0) {
        this.tryExitMerge(true);
        return;
      }

      if (mergePressed) {
        this.tryExitMerge(false);
        return;
      }

      const qx = Math.abs(ix) > 0.25 ? Math.sign(ix) : 0;
      const qy = Math.abs(iy) > 0.25 ? Math.sign(iy) : 0;
      this.updateMergedMovement(qx, qy, dt);
      return;
    }

    // Normal 3D Overworld/Dungeon state
    if (p.staminaRegenDelay <= 0 && p.stamina < p.maxStamina) {
      p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN_RATE * dt);
    }

    if (mergePressed) {
      const target = this.findNearbyMergeTarget();
      if (target && p.stamina > 8) {
        this.enterMerge(target);
        return;
      }
    }

    if (swordPressed && p.swordCooldown <= 0) {
      this.performSwordSlash();
    }

    if (itemPressed && p.equippedItem) {
      this.useEquippedItem();
    }

    // Knockback decay
    if (Math.hypot(p.knockVx, p.knockVy) > 8) {
      this.moveEntityWithCollision(p, p.knockVx * dt, p.knockVy * dt, 12, true);
      p.knockVx *= Math.pow(0.001, dt);
      p.knockVy *= Math.pow(0.001, dt);
    }

    // Movement (supports both digital keys and analog virtual thumbstick)
    const rawLen = Math.hypot(ix, iy);
    if (rawLen > 0.14) {
      const mag = Math.min(1, rawLen);
      const vx = (ix / rawLen) * PLAYER_SPEED * mag;
      const vy = (iy / rawLen) * PLAYER_SPEED * mag;

      if (Math.abs(ix) >= Math.abs(iy)) {
        p.dir = ix > 0 ? 'E' : 'W';
      } else {
        p.dir = iy > 0 ? 'S' : 'N';
      }

      p.walkCycle += dt * (8 + 4 * mag);
      this.moveEntityWithCollision(p, vx * dt, vy * dt, 12, true);
    }

    // Record last safe tile
    const curTx = Math.floor(p.x / TILE_SIZE);
    const curTy = Math.floor(p.y / TILE_SIZE);
    if (this.isTileWalkableForPlayer(this.currentWorld, curTx, curTy)) {
      const tileKind = this.getTile(this.currentWorld, curTx, curTy);
      if (tileKind !== 'dungeon_portal' && tileKind !== 'exit_portal') {
        p.lastSafeX = (curTx + 0.5) * TILE_SIZE;
        p.lastSafeY = (curTy + 0.5) * TILE_SIZE;
        p.lastSafeWorld = this.currentWorld;
      }
    }

    // Check portals, chests, pedestals
    this.checkPlayerInteractions();
  }

  private updateMergedMovement(ix: number, iy: number, dt: number) {
    const p = this.player;
    const m = p.mergeState!;
    const { nx, ny, ux, uy } = this.getSideVectors(m.side);

    // Tangential motion along the current wall edge
    const tangentInput = ux !== 0 ? ix : iy;
    const perpInput = ux !== 0 ? iy : ix;

    if (tangentInput !== 0) {
      m.t += (tangentInput * MERGE_SPEED * dt) / TILE_SIZE;

      if (m.t > 1 || m.t < 0) {
        const step = m.t > 1 ? 1 : -1;
        const dx = ux * step;
        const dy = uy * step;

        // 1. Inner corner check (wall juts out towards us)
        const innerTx = m.tx + dx + nx;
        const innerTy = m.ty + dy + ny;
        if (this.isTileMergeable(this.currentWorld, innerTx, innerTy)) {
          const newSide = this.getOppositeDir(
            dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N'
          );
          const { ux: nux, uy: nuy } = this.getSideVectors(newSide);
          const intoNormal = nx * nux + ny * nuy;
          m.tx = innerTx;
          m.ty = innerTy;
          m.side = newSide;
          m.t = intoNormal > 0 ? 0.05 : 0.95;
        } else {
          // 2. Straight continuation along same face
          const nextTx = m.tx + dx;
          const nextTy = m.ty + dy;
          const frontBlocked = this.isTileMergeable(this.currentWorld, nextTx + nx, nextTy + ny);
          if (this.isTileMergeable(this.currentWorld, nextTx, nextTy) && !frontBlocked) {
            m.tx = nextTx;
            m.ty = nextTy;
            m.t = step > 0 ? m.t - 1 : m.t + 1;
          } else {
            m.t = step > 0 ? 1 : 0;
          }
        }
      }
    }

    // Outer corner wrapping when pressing inward perpendicular key near edge end
    if (perpInput !== 0) {
      const towardWall = perpInput * -1 === (ux !== 0 ? ny : nx);
      if (towardWall) {
        if (m.t >= 0.82) {
          const newSide: Direction = ux !== 0 ? 'E' : 'S';
          const { nx: cnx, ny: cny } = this.getSideVectors(newSide);
          if (!this.isTileMergeable(this.currentWorld, m.tx + cnx, m.ty + cny)) {
            m.side = newSide;
            m.t = (ux !== 0 ? ny : nx) > 0 ? 0.9 : 0.1;
          }
        } else if (m.t <= 0.18) {
          const newSide: Direction = ux !== 0 ? 'W' : 'N';
          const { nx: cnx, ny: cny } = this.getSideVectors(newSide);
          if (!this.isTileMergeable(this.currentWorld, m.tx + cnx, m.ty + cny)) {
            m.side = newSide;
            m.t = (ux !== 0 ? ny : nx) > 0 ? 0.9 : 0.1;
          }
        }
      }
    }

    const pos = this.getMergeWorldPos(m);
    p.x = pos.x;
    p.y = pos.y;
    p.dir = m.side;

    // Fissure dimensional warp check
    if (
      p.warpCooldown <= 0 &&
      this.getTile(this.currentWorld, m.tx, m.ty) === 'fissure' &&
      m.t >= 0.2 &&
      m.t <= 0.8
    ) {
      const entry = FISSURE_LINKS.find(
        (f) => f.world === this.currentWorld && f.link.tx === m.tx && f.link.ty === m.ty
      );
      if (entry) {
        const dest = entry.link;
        this.currentWorld = dest.targetWorld;
        p.mergeState = {
          tx: dest.targetTx,
          ty: dest.targetTy,
          side: dest.targetSide,
          t: 0.5,
        };
        const newPos = this.getMergeWorldPos(p.mergeState);
        p.x = newPos.x;
        p.y = newPos.y;
        p.warpCooldown = 0.9;
        p.stamina = Math.min(p.maxStamina, p.stamina + 25);
        this.fissuresCrossed += 1;
        this.warpFlashTimer = 0.45;
        this.warpColor = this.currentWorld === 'lorule' ? '#a855f7' : '#fbbf24';
        this.triggerShake(4, 0.22);
        sound.fissureWarp();
        this.spawnBurst(p.x, p.y, this.warpColor, 18, 120, true);
        this.showBanner(
          this.currentWorld === 'lorule' ? 'Entered Lorule Overworld' : 'Returned to Hyrule',
          2.4
        );
        this.centerCameraImmediate();
        this.emitHud(true);
      }
    }
  }

  private moveEntityWithCollision(
    ent: { x: number; y: number },
    dx: number,
    dy: number,
    radius: number,
    isPlayer: boolean
  ) {
    const canOccupy = (nx: number, ny: number): boolean => {
      const minTx = Math.floor((nx - radius) / TILE_SIZE);
      const maxTx = Math.floor((nx + radius) / TILE_SIZE);
      const minTy = Math.floor((ny - radius) / TILE_SIZE);
      const maxTy = Math.floor((ny + radius) / TILE_SIZE);
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const tile = this.getTile(this.currentWorld, tx, ty);
          if (isPlayer && tile === 'locked_door' && this.player.keys > 0) {
            this.worlds[this.currentWorld].tiles[ty][tx] =
              this.currentWorld === 'dungeon' ? 'dungeon_floor' : 'path';
            this.player.keys -= 1;
            sound.doorUnlock();
            this.spawnBurst((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, '#fde047', 16, 120, true);
            this.spawnToast((tx + 0.5) * TILE_SIZE, ty * TILE_SIZE, 'Door Unlocked!', '#fde047');
            this.emitHud(true);
            continue;
          }
          if (isPlayer && tile === 'locked_door' && this.player.keys === 0 && this.toasts.length === 0) {
            this.spawnToast((tx + 0.5) * TILE_SIZE, ty * TILE_SIZE, 'Needs 1 Small Key', '#fde68a');
          }
          if (isPlayer && tile === 'boss_door' && this.toasts.length === 0) {
            this.spawnToast((tx + 0.5) * TILE_SIZE, ty * TILE_SIZE, 'Clear West Armory First', '#fca5a5');
          }
          if (!this.isTileWalkableForPlayer(this.currentWorld, tx, ty)) {
            return false;
          }
        }
      }
      return true;
    };

    if (dx !== 0 && canOccupy(ent.x + dx, ent.y)) {
      ent.x += dx;
    }
    if (dy !== 0 && canOccupy(ent.x, ent.y + dy)) {
      ent.y += dy;
    }
  }

  private checkPlayerInteractions() {
    const p = this.player;
    const ptx = Math.floor(p.x / TILE_SIZE);
    const pty = Math.floor(p.y / TILE_SIZE);
    const tile = this.getTile(this.currentWorld, ptx, pty);

    // Dungeon portal transitions
    if (tile === 'dungeon_portal' && p.warpCooldown <= 0) {
      this.currentWorld = 'dungeon';
      p.x = 14.5 * TILE_SIZE;
      p.y = 17.2 * TILE_SIZE;
      p.dir = 'N';
      p.warpCooldown = 0.8;
      p.lastSafeWorld = 'dungeon';
      p.lastSafeX = p.x;
      p.lastSafeY = p.y;
      this.warpFlashTimer = 0.4;
      this.warpColor = '#38bdf8';
      sound.fissureWarp();
      this.showBanner('Eastern Sanctuary Dungeon', 2.8);
      this.centerCameraImmediate();
      this.emitHud(true);
      return;
    }

    if (tile === 'exit_portal' && p.warpCooldown <= 0) {
      this.currentWorld = 'hyrule';
      p.x = 14.5 * TILE_SIZE;
      p.y = 2.4 * TILE_SIZE;
      p.dir = 'S';
      p.warpCooldown = 0.8;
      this.warpFlashTimer = 0.35;
      this.warpColor = '#fde047';
      sound.fissureWarp();
      this.showBanner('Hyrule North Terrace', 2.2);
      this.centerCameraImmediate();
      this.emitHud(true);
      return;
    }

    // Chests
    for (const c of this.chests) {
      if (c.world !== this.currentWorld || c.opened) continue;
      const cx = (c.tx + 0.5) * TILE_SIZE;
      const cy = (c.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(p.x - cx, p.y - cy) < 34) {
        c.opened = true;
        this.grantReward(c.reward, cx, cy, c.label);
      }
    }

    // Pedestals
    for (const ped of this.pedestals) {
      if (ped.world !== this.currentWorld || ped.collected) continue;
      if (ped.reward === 'triforce' && !this.bossDefeated) continue;
      const px = (ped.tx + 0.5) * TILE_SIZE;
      const py = (ped.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(p.x - px, p.y - py) < 30) {
        ped.collected = true;
        this.grantReward(ped.reward, px, py, ped.label);
      }
    }
  }

  private grantReward(
    reward: ChestEntity['reward'] | PedestalEntity['reward'],
    x: number,
    y: number,
    label: string
  ) {
    const p = this.player;
    this.spawnBurst(x, y, '#fde047', 22, 130, true);

    if (reward === 'boomerang' || reward === 'bow' || reward === 'bomb') {
      if (!p.unlockedItems.includes(reward)) {
        p.unlockedItems.push(reward);
      }
      p.equippedItem = reward;
      sound.itemFanfare();
      const hint =
        reward === 'boomerang'
          ? 'Boomerang Collected! [3] + F / Right-Click to stun foes & fetch distant Keys'
          : reward === 'bow'
          ? "Hero's Bow Collected! [1] + F / Right-Click to shoot Crystal Switches & foes"
          : 'Bomb Bag Collected! [2] + F / Right-Click to blast Cracked Boulders & shields';
      this.showBanner(hint, 4.0);
      this.spawnToast(x, y - 20, `+ ${label}`, '#fde047');
    } else if (reward === 'heart_container') {
      p.maxHp += 2;
      p.hp = p.maxHp;
      sound.itemFanfare();
      this.showBanner('Heart Container! Max Hearts increased and health restored', 3.2);
      this.spawnToast(x, y - 20, '+1 Max Heart', '#fb7185');
    } else if (reward === 'rupees_50') {
      p.rupees += 50;
      sound.itemFanfare();
      this.spawnToast(x, y - 20, '+50 Rupees', '#4ade80');
    } else if (reward === 'key') {
      p.keys += 1;
      sound.itemFanfare();
      this.spawnToast(x, y - 20, '+1 Small Key', '#fde047');
    } else if (reward === 'triforce') {
      sound.victoryFanfare();
      this.setPhase('VICTORY');
    }

    this.emitHud(true);
  }

  private performSwordSlash() {
    const p = this.player;
    p.swordTimer = 0.2;
    p.swordCooldown = 0.28;
    sound.swordSlash();

    const dirVec = this.dirToVec(p.dir);
    const reach = 46;

    // Cut bushes & hit crystal orbs in arc
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = Math.floor(p.x / TILE_SIZE) + dx;
        const ty = Math.floor(p.y / TILE_SIZE) + dy;
        const cx = (tx + 0.5) * TILE_SIZE;
        const cy = (ty + 0.5) * TILE_SIZE;
        const dist = Math.hypot(cx - p.x, cy - p.y);
        if (dist <= reach + 16) {
          const dot = ((cx - p.x) * dirVec.x + (cy - p.y) * dirVec.y) / Math.max(1, dist);
          if (dot > -0.15) {
            if (this.getTile(this.currentWorld, tx, ty) === 'bush') {
              this.worlds[this.currentWorld].tiles[ty][tx] =
                this.currentWorld === 'lorule' ? 'lorule_grass' : 'grass';
              sound.bushCut();
              this.spawnBurst(cx, cy, '#4ade80', 10, 90);
              if (Math.random() < 0.45) {
                this.pickups.push({
                  id: this.nextEntityId++,
                  world: this.currentWorld,
                  kind: Math.random() < 0.35 ? 'heart' : 'rupee_green',
                  x: cx,
                  y: cy,
                  bobPhase: Math.random() * 4,
                  life: 25,
                });
              }
            }
          }
        }
      }
    }

    for (const orb of this.crystalOrbs) {
      if (orb.world !== this.currentWorld || orb.hitCooldown > 0) continue;
      const ox = (orb.tx + 0.5) * TILE_SIZE;
      const oy = (orb.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(ox - p.x, oy - p.y) < reach + 12) {
        this.triggerCrystalOrb(orb);
      }
    }

    // Deflect enemy rocks
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.world !== this.currentWorld || pr.fromPlayer) continue;
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < reach + 8) {
        pr.fromPlayer = true;
        pr.vx = -pr.vx * 1.3;
        pr.vy = -pr.vy * 1.3;
        sound.shieldClang();
        this.spawnBurst(pr.x, pr.y, '#fef08a', 6, 80);
      }
    }

    // Hit enemies
    for (const e of this.enemies) {
      if (!e.alive || e.world !== this.currentWorld) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= reach + e.radius) {
        const dot = (dx * dirVec.x + dy * dirVec.y) / Math.max(1, dist);
        if (dot > -0.1) {
          this.hitEnemy(e, 2, p.x, p.y, 'sword');
        }
      }
    }
  }

  private useEquippedItem() {
    const p = this.player;
    const item = p.equippedItem;
    if (!item) return;

    if (item === 'bow') {
      if (p.stamina < 18) {
        this.spawnToast(p.x, p.y - 22, 'Low Stamina', '#cbd5e1');
        return;
      }
      p.stamina -= 18;
      p.staminaRegenDelay = 0.55;
      const v = this.dirToVec(p.dir);
      this.projectiles.push({
        id: this.nextEntityId++,
        world: this.currentWorld,
        kind: 'arrow',
        fromPlayer: true,
        x: p.x + v.x * 16,
        y: p.y + v.y * 16,
        vx: v.x * 520,
        vy: v.y * 520,
        life: 1.5,
        radius: 5,
        damage: 2,
      });
      sound.bowShoot();
      this.emitHud(true);
    } else if (item === 'bomb') {
      const activeBombs = this.bombs.filter((b) => b.world === this.currentWorld && !b.exploded).length;
      if (activeBombs >= 2) return;
      if (p.stamina < 25) {
        this.spawnToast(p.x, p.y - 22, 'Low Stamina', '#cbd5e1');
        return;
      }
      p.stamina -= 25;
      p.staminaRegenDelay = 0.65;
      const v = this.dirToVec(p.dir);
      this.bombs.push({
        id: this.nextEntityId++,
        world: this.currentWorld,
        x: p.x + v.x * 18,
        y: p.y + v.y * 18,
        fuse: 1.35,
        maxFuse: 1.35,
        exploded: false,
      });
      sound.bombPlace();
      this.emitHud(true);
    } else if (item === 'boomerang') {
      if (this.boomerang.active) return;
      if (p.stamina < 12) {
        this.spawnToast(p.x, p.y - 22, 'Low Stamina', '#cbd5e1');
        return;
      }
      p.stamina -= 12;
      p.staminaRegenDelay = 0.4;
      const v = this.dirToVec(p.dir);
      this.boomerang = {
        active: true,
        world: this.currentWorld,
        x: p.x + v.x * 14,
        y: p.y + v.y * 14,
        vx: v.x * 360,
        vy: v.y * 360,
        returning: false,
        timer: 0.56,
        angle: 0,
        carriedPickupIds: [],
      };
      sound.boomerangThrow();
      this.emitHud(true);
    }
  }

  private triggerCrystalOrb(orb: CrystalOrb) {
    orb.hitCooldown = 0.45;
    this.worlds[orb.world].crystalBlueActive = !this.worlds[orb.world].crystalBlueActive;
    sound.crystalSwitch();
    const ox = (orb.tx + 0.5) * TILE_SIZE;
    const oy = (orb.ty + 0.5) * TILE_SIZE;
    const color = this.worlds[orb.world].crystalBlueActive ? '#38bdf8' : '#f87171';
    this.spawnBurst(ox, oy, color, 16, 110, true);
    this.spawnToast(ox, oy - 20, 'Crystal Toggled!', color);
  }

  private updateCrystalOrbs(dt: number) {
    for (const orb of this.crystalOrbs) {
      if (orb.hitCooldown > 0) orb.hitCooldown = Math.max(0, orb.hitCooldown - dt);
    }
  }

  private updateBombs(dt: number) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      if (b.world !== this.currentWorld) continue;
      b.fuse -= dt;
      if (b.fuse <= 0 && !b.exploded) {
        b.exploded = true;
        this.detonateBomb(b);
        this.bombs.splice(i, 1);
      }
    }
  }

  private detonateBomb(b: BombEntity) {
    sound.bombExplode();
    this.triggerShake(8, 0.3);
    this.hitstopTimer = 0.045;
    this.spawnBurst(b.x, b.y, '#fb923c', 24, 180, true);
    this.spawnBurst(b.x, b.y, '#fef08a', 14, 110, true);

    const blastRadius = 68;
    const minTx = Math.floor((b.x - blastRadius) / TILE_SIZE);
    const maxTx = Math.floor((b.x + blastRadius) / TILE_SIZE);
    const minTy = Math.floor((b.y - blastRadius) / TILE_SIZE);
    const maxTy = Math.floor((b.y + blastRadius) / TILE_SIZE);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const tile = this.getTile(b.world, tx, ty);
        const cx = (tx + 0.5) * TILE_SIZE;
        const cy = (ty + 0.5) * TILE_SIZE;
        if (Math.hypot(cx - b.x, cy - b.y) <= blastRadius) {
          if (tile === 'cracked_block') {
            this.worlds[b.world].tiles[ty][tx] =
              b.world === 'dungeon' ? 'dungeon_floor' : b.world === 'lorule' ? 'lorule_grass' : 'grass';
            this.spawnBurst(cx, cy, '#94a3b8', 16, 130);
            this.spawnToast(cx, cy - 16, 'Path Opened!', '#fde047');
          } else if (tile === 'bush') {
            this.worlds[b.world].tiles[ty][tx] = b.world === 'lorule' ? 'lorule_grass' : 'grass';
          }
        }
      }
    }

    for (const orb of this.crystalOrbs) {
      if (orb.world !== b.world || orb.hitCooldown > 0) continue;
      const ox = (orb.tx + 0.5) * TILE_SIZE;
      const oy = (orb.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(ox - b.x, oy - b.y) <= blastRadius) {
        this.triggerCrystalOrb(orb);
      }
    }

    for (const e of this.enemies) {
      if (!e.alive || e.world !== b.world) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) <= blastRadius + e.radius) {
        this.hitEnemy(e, 4, b.x, b.y, 'bomb');
      }
    }
  }

  private updateBoomerang(dt: number) {
    const bm = this.boomerang;
    if (!bm.active) return;

    if (bm.world !== this.currentWorld) {
      bm.active = false;
      return;
    }

    bm.angle += dt * 22;

    if (!bm.returning) {
      bm.timer -= dt;
      bm.x += bm.vx * dt;
      bm.y += bm.vy * dt;
      const tx = Math.floor(bm.x / TILE_SIZE);
      const ty = Math.floor(bm.y / TILE_SIZE);
      if (this.isTileSolidForProjectiles(bm.world, tx, ty) || bm.timer <= 0) {
        bm.returning = true;
        this.spawnBurst(bm.x, bm.y, '#93c5fd', 6, 60);
      }
    } else {
      const dx = this.player.x - bm.x;
      const dy = this.player.y - bm.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 20) {
        bm.active = false;
        // Deliver carried pickups straight to player
        for (const pid of bm.carriedPickupIds) {
          const pk = this.pickups.find((p) => p.id === pid);
          if (pk) {
            pk.x = this.player.x;
            pk.y = this.player.y;
          }
        }
        bm.carriedPickupIds = [];
        return;
      }
      const speed = 410;
      bm.x += (dx / dist) * speed * dt;
      bm.y += (dy / dist) * speed * dt;
    }

    // Carry any pickups touched
    for (const pk of this.pickups) {
      if (pk.world !== bm.world) continue;
      if (!bm.carriedPickupIds.includes(pk.id) && Math.hypot(pk.x - bm.x, pk.y - bm.y) < 26) {
        bm.carriedPickupIds.push(pk.id);
      }
      if (bm.carriedPickupIds.includes(pk.id)) {
        pk.x = bm.x;
        pk.y = bm.y;
      }
    }

    // Trigger crystal orbs
    for (const orb of this.crystalOrbs) {
      if (orb.world !== bm.world || orb.hitCooldown > 0) continue;
      const ox = (orb.tx + 0.5) * TILE_SIZE;
      const oy = (orb.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(ox - bm.x, oy - bm.y) < 24) {
        this.triggerCrystalOrb(orb);
        bm.returning = true;
      }
    }

    // Stun enemies
    for (const e of this.enemies) {
      if (!e.alive || e.world !== bm.world) continue;
      if (Math.hypot(e.x - bm.x, e.y - bm.y) < e.radius + 14) {
        if (e.state !== 'stunned') {
          e.state = 'stunned';
          e.stateTimer = 2.4;
          e.hitFlash = 0.14;
          sound.hitEnemy();
          this.spawnBurst(e.x, e.y, '#60a5fa', 10, 90, true);
          this.spawnToast(e.x, e.y - 22, 'Stunned!', '#93c5fd');
        }
        bm.returning = true;
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.world !== this.currentWorld) {
        this.projectiles.splice(i, 1);
        continue;
      }
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      const tx = Math.floor(pr.x / TILE_SIZE);
      const ty = Math.floor(pr.y / TILE_SIZE);

      if (pr.fromPlayer) {
        for (const orb of this.crystalOrbs) {
          if (orb.world !== pr.world || orb.hitCooldown > 0) continue;
          const ox = (orb.tx + 0.5) * TILE_SIZE;
          const oy = (orb.ty + 0.5) * TILE_SIZE;
          if (Math.hypot(ox - pr.x, oy - pr.y) < 22) {
            this.triggerCrystalOrb(orb);
            pr.life = 0;
          }
        }

        for (const e of this.enemies) {
          if (!e.alive || e.world !== pr.world) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.radius + pr.radius) {
            this.hitEnemy(e, pr.damage, pr.x, pr.y, 'arrow');
            pr.life = 0;
            break;
          }
        }
      } else if (!this.player.merged) {
        if (Math.hypot(this.player.x - pr.x, this.player.y - pr.y) < 14 + pr.radius) {
          this.damagePlayer(pr.damage, pr.x, pr.y);
          pr.life = 0;
        }
      }

      if (this.isTileSolidForProjectiles(pr.world, tx, ty) || pr.life <= 0) {
        this.spawnBurst(pr.x, pr.y, pr.kind === 'arrow' ? '#fde68a' : '#e879f9', 5, 65);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private hitEnemy(
    e: Enemy,
    damage: number,
    srcX: number,
    srcY: number,
    source: 'sword' | 'arrow' | 'bomb'
  ) {
    // Darknut blocks frontal sword/arrow attacks unless stunned or hit by bomb!
    if (e.kind === 'darknut' && e.state !== 'stunned' && source !== 'bomb') {
      const dv = this.dirToVec(e.dir);
      const toSrcX = srcX - e.x;
      const toSrcY = srcY - e.y;
      const len = Math.max(1, Math.hypot(toSrcX, toSrcY));
      const dot = (toSrcX / len) * dv.x + (toSrcY / len) * dv.y;
      if (dot > 0.25) {
        sound.shieldClang();
        this.spawnBurst(e.x + dv.x * 14, e.y + dv.y * 14, '#fef08a', 8, 95, true);
        this.spawnToast(e.x, e.y - 24, 'Shielded! Stun or Bomb', '#cbd5e1');
        return;
      }
    }

    e.hp -= damage;
    e.hitFlash = 0.16;
    if (source === 'bomb' && e.kind === 'darknut') {
      e.state = 'stunned';
      e.stateTimer = 1.6;
    }

    const dx = e.x - srcX;
    const dy = e.y - srcY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const kb = e.kind === 'phantom_boss' ? 140 : 240;
    e.knockVx = (dx / len) * kb;
    e.knockVy = (dy / len) * kb;

    this.hitstopTimer = Math.max(this.hitstopTimer, 0.035);
    this.triggerShake(3.5, 0.12);
    sound.hitEnemy();
    this.spawnBurst(e.x, e.y, '#fca5a5', 10, 110, true);

    if (e.hp <= 0) {
      e.alive = false;
      this.enemiesDefeated += 1;
      this.triggerShake(5.5, 0.2);
      this.spawnBurst(e.x, e.y, e.kind === 'phantom_boss' ? '#c084fc' : '#fde047', 20, 150, true);

      if (e.kind === 'phantom_boss') {
        this.bossDefeated = true;
        sound.itemFanfare();
        this.showBanner('Phantom Knight Vanquished! Claim the Pendant of Courage!', 4.2);
      } else {
        // Drop rupee or heart
        const dropKind =
          this.player.hp < this.player.maxHp && Math.random() < 0.45
            ? 'heart'
            : Math.random() < 0.35
            ? 'rupee_blue'
            : 'rupee_green';
        this.pickups.push({
          id: this.nextEntityId++,
          world: e.world,
          kind: dropKind,
          x: e.x,
          y: e.y,
          bobPhase: 0,
          life: 30,
        });
      }

      // Check West Armory Arena unlock
      if (e.arenaId === 'west_armory' && !this.arenaCleared) {
        const remaining = this.enemies.filter((x) => x.arenaId === 'west_armory' && x.alive);
        if (remaining.length === 0) {
          this.arenaCleared = true;
          this.worlds.dungeon.tiles[8][14] = 'dungeon_floor';
          sound.doorUnlock();
          this.triggerShake(6, 0.25);
          this.showBanner('Armory Cleared! The Boss Vault Door is now unsealed!', 3.6);
        }
      }

      this.emitHud(true);
    }
  }

  private damagePlayer(halfHearts: number, srcX: number, srcY: number) {
    const p = this.player;
    if (p.invulnTimer > 0) return;

    p.hp = Math.max(0, p.hp - halfHearts);
    p.invulnTimer = 1.1;
    p.hitFlash = 0.25;
    if (srcX !== 0 || srcY !== 0) {
      const dx = p.x - srcX;
      const dy = p.y - srcY;
      const len = Math.max(1, Math.hypot(dx, dy));
      p.knockVx = (dx / len) * 260;
      p.knockVy = (dy / len) * 260;
    }

    this.hitstopTimer = 0.045;
    this.triggerShake(6, 0.22);
    sound.playerHurt();
    this.spawnBurst(p.x, p.y, '#ef4444', 12, 110);

    if (p.hp <= 0) {
      sound.gameOver();
      this.setPhase('GAME_OVER');
    } else {
      this.emitHud(true);
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive || e.world !== this.currentWorld) continue;

      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      // Knockback
      if (Math.hypot(e.knockVx, e.knockVy) > 10) {
        this.moveEntityWithCollision(e, e.knockVx * dt, e.knockVy * dt, e.radius - 2, false);
        e.knockVx *= Math.pow(0.001, dt);
        e.knockVy *= Math.pow(0.001, dt);
      }

      e.stateTimer -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const distToPlayer = Math.hypot(dx, dy);

      if (e.state === 'stunned') {
        if (e.stateTimer <= 0) {
          e.state = 'patrol';
          e.stateTimer = 0.8;
        }
        continue;
      }

      if (e.kind === 'octorok') {
        if (e.state === 'patrol') {
          const dv = this.dirToVec(e.dir);
          const beforeX = e.x;
          const beforeY = e.y;
          this.moveEntityWithCollision(e, dv.x * 48 * dt, dv.y * 48 * dt, e.radius - 2, false);
          if (Math.hypot(e.x - beforeX, e.y - beforeY) < 0.1 || e.stateTimer <= 0) {
            const dirs: Direction[] = ['N', 'S', 'E', 'W'];
            e.dir = dirs[Math.floor(Math.random() * 4)];
            e.stateTimer = 1.0 + Math.random() * 1.1;
          }
          if (!p.merged && distToPlayer < 250 && Math.random() < dt * 0.7) {
            e.state = 'windup';
            e.stateTimer = 0.45;
            e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
          }
        } else if (e.state === 'windup') {
          if (e.stateTimer <= 0) {
            const dv = this.dirToVec(e.dir);
            this.projectiles.push({
              id: this.nextEntityId++,
              world: e.world,
              kind: 'rock',
              fromPlayer: false,
              x: e.x + dv.x * 14,
              y: e.y + dv.y * 14,
              vx: dv.x * 230,
              vy: dv.y * 230,
              life: 1.8,
              radius: 6,
              damage: 1,
            });
            e.state = 'patrol';
            e.stateTimer = 1.4;
          }
        }
      } else if (e.kind === 'shadow_soldier' || e.kind === 'stalfos' || e.kind === 'darknut') {
        const aggroRange = e.kind === 'darknut' ? 230 : 210;
        const speed = e.kind === 'darknut' ? 64 : e.kind === 'shadow_soldier' ? 86 : 78;

        if (e.state === 'patrol') {
          if (!p.merged && distToPlayer < aggroRange) {
            e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
            this.moveEntityWithCollision(
              e,
              (dx / Math.max(1, distToPlayer)) * speed * dt,
              (dy / Math.max(1, distToPlayer)) * speed * dt,
              e.radius - 2,
              false
            );
            if (distToPlayer < 75 && e.stateTimer <= 0) {
              e.state = 'windup';
              e.stateTimer = 0.42;
            }
          } else {
            const dv = this.dirToVec(e.dir);
            const bx = e.x;
            const by = e.y;
            this.moveEntityWithCollision(e, dv.x * 46 * dt, dv.y * 46 * dt, e.radius - 2, false);
            if (Math.hypot(e.x - bx, e.y - by) < 0.1 || e.stateTimer <= 0) {
              const dirs: Direction[] = ['N', 'S', 'E', 'W'];
              e.dir = dirs[Math.floor(Math.random() * 4)];
              e.stateTimer = 1.2 + Math.random();
            }
          }
        } else if (e.state === 'windup') {
          if (e.stateTimer <= 0) {
            e.state = 'attack';
            e.stateTimer = 0.25;
            const dv = this.dirToVec(e.dir);
            e.vx = dv.x * (speed * 2.2);
            e.vy = dv.y * (speed * 2.2);
          }
        } else if (e.state === 'attack') {
          this.moveEntityWithCollision(e, e.vx * dt, e.vy * dt, e.radius - 2, false);
          if (e.stateTimer <= 0) {
            e.state = 'cooldown';
            e.stateTimer = 0.65;
          }
        } else if (e.state === 'cooldown') {
          if (e.stateTimer <= 0) {
            e.state = 'patrol';
            e.stateTimer = 0.9;
          }
        }
      } else if (e.kind === 'phantom_boss') {
        // Boss only activates once Link enters Boss Vault (ty < 8)
        if (p.y > 8 * TILE_SIZE) continue;

        if (e.state === 'patrol') {
          const speed = 74;
          const len = Math.max(1, distToPlayer);
          this.moveEntityWithCollision(e, (dx / len) * speed * dt, (dy / len) * speed * dt, e.radius - 3, false);
          e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
          if (e.stateTimer <= 0) {
            e.state = 'windup';
            e.stateTimer = 0.65;
            e.vx = (dx / len) * 290;
            e.vy = (dy / len) * 290;
          }
        } else if (e.state === 'windup') {
          if (e.stateTimer <= 0) {
            // 50% dash charge, 50% 3-orb dark spread
            if (Math.random() < 0.55) {
              e.state = 'attack';
              e.stateTimer = 0.42;
            } else {
              const baseAngle = Math.atan2(dy, dx);
              for (const offset of [-0.32, 0, 0.32]) {
                const ang = baseAngle + offset;
                this.projectiles.push({
                  id: this.nextEntityId++,
                  world: 'dungeon',
                  kind: 'dark_orb',
                  fromPlayer: false,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(ang) * 215,
                  vy: Math.sin(ang) * 215,
                  life: 2.2,
                  radius: 7,
                  damage: 2,
                });
              }
              e.state = 'cooldown';
              e.stateTimer = 0.9;
            }
          }
        } else if (e.state === 'attack') {
          this.moveEntityWithCollision(e, e.vx * dt, e.vy * dt, e.radius - 3, false);
          if (e.stateTimer <= 0) {
            e.state = 'cooldown';
            e.stateTimer = 0.85;
          }
        } else if (e.state === 'cooldown') {
          if (e.stateTimer <= 0) {
            e.state = 'patrol';
            e.stateTimer = 1.2;
          }
        }
      }

      // Contact damage (safe when Wall-Merged on high walls!)
      if (!p.merged && Math.hypot(p.x - e.x, p.y - e.y) < e.radius + 12) {
        this.damagePlayer(e.kind === 'phantom_boss' || e.kind === 'darknut' ? 2 : 1, e.x, e.y);
      }
    }
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.bobPhase += dt * 4;
      if (pk.life < 9999) pk.life -= dt;
      if (pk.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.world !== this.currentWorld) continue;

      if (Math.hypot(this.player.x - pk.x, this.player.y - pk.y) < 22) {
        if (pk.kind === 'rupee_green') {
          this.player.rupees += 5;
          sound.pickupRupee();
          this.spawnToast(pk.x, pk.y - 16, '+5', '#4ade80');
        } else if (pk.kind === 'rupee_blue') {
          this.player.rupees += 20;
          sound.pickupRupee();
          this.spawnToast(pk.x, pk.y - 16, '+20', '#38bdf8');
        } else if (pk.kind === 'rupee_red') {
          this.player.rupees += 50;
          sound.pickupRupee();
          this.spawnToast(pk.x, pk.y - 16, '+50', '#f87171');
        } else if (pk.kind === 'heart') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
          sound.pickupHeart();
          this.spawnToast(pk.x, pk.y - 16, '+1 Heart', '#fb7185');
        } else if (pk.kind === 'key') {
          this.player.keys += 1;
          sound.itemFanfare();
          this.spawnToast(pk.x, pk.y - 18, '+1 Small Key!', '#fde047');
        }
        this.spawnBurst(pk.x, pk.y, '#fde047', 8, 70);
        this.pickups.splice(i, 1);
        this.emitHud(true);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.08, dt);
      pt.vy *= Math.pow(0.08, dt);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateToasts(dt: number) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) this.toasts.splice(i, 1);
    }
  }

  private centerCameraImmediate() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.canvas.width / dpr || 1280;
    const vh = this.canvas.height / dpr || 720;
    const mapPxW = MAP_W * TILE_SIZE;
    const mapPxH = MAP_H * TILE_SIZE;
    this.camX = Math.max(0, Math.min(Math.max(0, mapPxW - vw), this.player.x - vw / 2));
    this.camY = Math.max(0, Math.min(Math.max(0, mapPxH - vh), this.player.y - vh / 2));
  }

  private updateCamera(dt: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.canvas.width / dpr;
    const vh = this.canvas.height / dpr;
    const mapPxW = MAP_W * TILE_SIZE;
    const mapPxH = MAP_H * TILE_SIZE;

    const targetX =
      mapPxW <= vw
        ? -(vw - mapPxW) / 2
        : Math.max(0, Math.min(mapPxW - vw, this.player.x - vw / 2));
    const targetY =
      mapPxH <= vh
        ? -(vh - mapPxH) / 2
        : Math.max(0, Math.min(mapPxH - vh, this.player.y - vh / 2));

    const lerp = Math.min(1, dt * 8.5);
    this.camX += (targetX - this.camX) * lerp;
    this.camY += (targetY - this.camY) * lerp;
  }

  private dirToVec(d: Direction): { x: number; y: number } {
    if (d === 'N') return { x: 0, y: -1 };
    if (d === 'S') return { x: 0, y: 1 };
    if (d === 'E') return { x: 1, y: 0 };
    return { x: -1, y: 0 };
  }

  private getNearSignText(): string | null {
    if (this.phase !== 'PLAYING' || this.player.merged) return null;
    for (const s of this.signposts) {
      if (s.world !== this.currentWorld) continue;
      const sx = (s.tx + 0.5) * TILE_SIZE;
      const sy = (s.ty + 0.5) * TILE_SIZE;
      if (Math.hypot(this.player.x - sx, this.player.y - sy) < 48) {
        return s.text;
      }
    }
    return null;
  }

  private emitHud(force: boolean) {
    const boss = this.enemies.find((e) => e.kind === 'phantom_boss' && e.world === this.currentWorld && e.alive);
    const showBossBar = Boolean(boss && this.player.y < 8 * TILE_SIZE);
    const canMergePrompt =
      this.phase === 'PLAYING' && !this.player.merged && this.findNearbyMergeTarget() !== null;
    const nearSignText = this.getNearSignText();

    const key = [
      this.phase,
      this.currentWorld,
      this.player.hp,
      this.player.maxHp,
      Math.round(this.player.stamina),
      this.player.rupees,
      this.player.keys,
      this.player.unlockedItems.join(','),
      this.player.equippedItem,
      this.player.merged,
      canMergePrompt,
      nearSignText,
      this.bannerText,
      sound.isMuted(),
      showBossBar ? boss?.hp : 'no',
      this.enemiesDefeated,
    ].join('|');

    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;

    this.onHudUpdate({
      phase: this.phase,
      world: this.currentWorld,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      rupees: this.player.rupees,
      keys: this.player.keys,
      unlockedItems: [...this.player.unlockedItems],
      equippedItem: this.player.equippedItem,
      merged: this.player.merged,
      canMergePrompt,
      nearSignText,
      bannerText: this.bannerText,
      objectiveText: this.getObjectiveText(),
      muted: sound.isMuted(),
      bossHp: showBossBar && boss ? boss.hp : null,
      bossMaxHp: showBossBar && boss ? boss.maxHp : null,
      bossName: showBossBar ? 'Phantom Yuga Knight' : null,
      stats: {
        enemiesDefeated: this.enemiesDefeated,
        fissuresCrossed: this.fissuresCrossed,
        timeSeconds: Math.floor(this.playTime),
      },
    });
  }

  // ==================== RENDERING ====================

  private render() {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.canvas.width / dpr;
    const vh = this.canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Backdrop void matching current world
    ctx.fillStyle =
      this.currentWorld === 'hyrule'
        ? '#14261c'
        : this.currentWorld === 'lorule'
        ? '#160d24'
        : '#0f1219';
    ctx.fillRect(0, 0, vw, vh);

    const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;
    const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 2 : 0;

    ctx.save();
    ctx.translate(Math.round(-this.camX + shakeX), Math.round(-this.camY + shakeY));

    this.renderTiles(ctx);
    this.renderSignposts(ctx);
    this.renderCrystalOrbs(ctx);
    this.renderChests(ctx);
    this.renderPedestals(ctx);
    this.renderPickups(ctx);
    this.renderBombs(ctx);
    this.renderEnemies(ctx);
    this.renderPlayer(ctx);
    this.renderBoomerang(ctx);
    this.renderProjectiles(ctx);
    this.renderParticles(ctx);
    this.renderToasts(ctx);

    ctx.restore();

    // Subtle atmospheric lighting vignette per world
    if (this.currentWorld === 'lorule') {
      const grad = ctx.createRadialGradient(vw / 2, vh / 2, vw * 0.25, vw / 2, vh / 2, vw * 0.72);
      grad.addColorStop(0, 'rgba(88, 28, 135, 0)');
      grad.addColorStop(1, 'rgba(15, 7, 28, 0.42)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
    } else if (this.currentWorld === 'dungeon') {
      const grad = ctx.createRadialGradient(vw / 2, vh / 2, vw * 0.22, vw / 2, vh / 2, vw * 0.72);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      grad.addColorStop(1, 'rgba(5, 8, 15, 0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
    }

    // Dimensional warp flash overlay
    if (this.warpFlashTimer > 0) {
      ctx.fillStyle = this.warpColor;
      ctx.globalAlpha = Math.min(0.65, this.warpFlashTimer * 1.4);
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderTiles(ctx: CanvasRenderingContext2D) {
    const world = this.currentWorld;
    const grid = this.worlds[world].tiles;
    const blueActive = this.worlds[world].crystalBlueActive;

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const tile = grid[ty][tx];
        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;

        // Base floor underneath objects
        if (world === 'hyrule') {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#4d8c4a' : '#468344';
        } else if (world === 'lorule') {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#3a2449' : '#331f40';
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#2b3240' : '#262c39';
        }
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        if (tile === 'path') {
          ctx.fillStyle = world === 'lorule' ? '#4c3858' : '#c9ae78';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = world === 'lorule' ? '#5c4469' : '#d6be89';
          ctx.fillRect(x + 4, y + 4, 14, 12);
          ctx.fillRect(x + 22, y + 22, 16, 14);
        } else if (tile === 'bridge') {
          ctx.fillStyle = '#18141c';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#8b5a2b';
          ctx.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 8);
          ctx.fillStyle = '#a47141';
          for (let px = 3; px < TILE_SIZE; px += 11) {
            ctx.fillRect(x + px, y + 6, 8, TILE_SIZE - 12);
          }
        } else if (tile === 'chasm') {
          ctx.fillStyle = '#090b10';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          if (ty > 0 && grid[ty - 1][tx] !== 'chasm') {
            ctx.fillStyle = world === 'lorule' ? '#241433' : '#2a221c';
            ctx.fillRect(x, y, TILE_SIZE, 10);
          }
        } else if (tile === 'water') {
          const wave = Math.sin(this.elapsedTime * 3 + tx * 0.8 + ty * 0.5) * 2;
          ctx.fillStyle = '#1d6fa5';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
          ctx.fillRect(x + 6 + wave, y + 12, 14, 3);
          ctx.fillRect(x + 20 - wave, y + 28, 12, 3);
        } else if (tile === 'bush') {
          ctx.fillStyle = '#1e4620';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 2, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3c8d40';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 2, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#65b868';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2 - 4, y + TILE_SIZE / 2 - 6, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 'bars') {
          ctx.fillStyle = '#1b1f29';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#94a3b8';
          for (let bx = 7; bx < TILE_SIZE; bx += 13) {
            ctx.fillRect(x + bx, y, 4, TILE_SIZE);
          }
          ctx.fillStyle = '#475569';
          ctx.fillRect(x, y + 18, TILE_SIZE, 5);
        } else if (tile === 'cracked_block') {
          ctx.fillStyle = world === 'lorule' ? '#584b68' : '#78716c';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = world === 'lorule' ? '#433852' : '#57534e';
          ctx.fillRect(x + 2, y + TILE_SIZE - 12, TILE_SIZE - 4, 10);
          ctx.strokeStyle = '#1c1917';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 12, y + 8);
          ctx.lineTo(x + 22, y + 20);
          ctx.lineTo(x + 16, y + 32);
          ctx.moveTo(x + 22, y + 20);
          ctx.lineTo(x + 33, y + 25);
          ctx.stroke();
        } else if (tile === 'crystal_red' || tile === 'crystal_blue') {
          const isRed = tile === 'crystal_red';
          const raised = isRed ? !blueActive : blueActive;
          if (raised) {
            ctx.fillStyle = isRed ? '#991b1b' : '#1e40af';
            ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.fillStyle = isRed ? '#ef4444' : '#3b82f6';
            ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 18);
          } else {
            ctx.strokeStyle = isRed ? 'rgba(239,68,68,0.45)' : 'rgba(59,130,246,0.45)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          }
        } else if (tile === 'locked_door' || tile === 'boss_door') {
          const isBoss = tile === 'boss_door';
          ctx.fillStyle = isBoss ? '#4c1d24' : '#6b4c2a';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = isBoss ? '#f59e0b' : '#d4a373';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          // Keyhole / skull emblem
          ctx.fillStyle = isBoss ? '#fbbf24' : '#1e293b';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2, 4, 8);
        } else if (tile === 'dungeon_portal' || tile === 'exit_portal') {
          const pulse = 0.75 + Math.sin(this.elapsedTime * 4) * 0.25;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x + 4, y + 2, TILE_SIZE - 8, TILE_SIZE - 4);
          ctx.fillStyle = tile === 'dungeon_portal' ? `rgba(56, 189, 248, ${0.45 * pulse})` : `rgba(250, 204, 21, ${0.45 * pulse})`;
          ctx.fillRect(x + 8, y + 6, TILE_SIZE - 16, TILE_SIZE - 12);
        } else if (tile === 'wall' || tile === 'fissure') {
          // 2.5D Wall Top Cap + South Vertical Stone Face!
          const topColor =
            world === 'hyrule' ? '#a69473' : world === 'lorule' ? '#514166' : '#58657a';
          const faceColor =
            world === 'hyrule' ? '#7a694d' : world === 'lorule' ? '#362947' : '#3a4354';
          const rimColor =
            world === 'hyrule' ? '#cbb896' : world === 'lorule' ? '#75628f' : '#7b8aa1';

          // Top cap (upper 26px)
          ctx.fillStyle = topColor;
          ctx.fillRect(x, y, TILE_SIZE, 28);
          ctx.fillStyle = rimColor;
          ctx.fillRect(x, y, TILE_SIZE, 4);

          // Vertical front face (bottom 16px — where 2D mural Link slides!)
          ctx.fillStyle = faceColor;
          ctx.fillRect(x, y + 28, TILE_SIZE, 16);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x + 6, y + 32, 14, 3);
          ctx.fillRect(x + 25, y + 37, 13, 3);

          // Glowing Dimensional Fissure Crack!
          if (tile === 'fissure') {
            const glow = 0.75 + Math.sin(this.elapsedTime * 6) * 0.25;
            const crackColor = world === 'hyrule' ? '#c084fc' : '#fde047';
            ctx.save();
            ctx.shadowColor = crackColor;
            ctx.shadowBlur = 14 * glow;
            ctx.strokeStyle = crackColor;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(x + 22, y + 18);
            ctx.lineTo(x + 18, y + 27);
            ctx.lineTo(x + 25, y + 34);
            ctx.lineTo(x + 21, y + 43);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  }

  private renderSignposts(ctx: CanvasRenderingContext2D) {
    for (const s of this.signposts) {
      if (s.world !== this.currentWorld) continue;
      const x = (s.tx + 0.5) * TILE_SIZE;
      const y = (s.ty + 0.5) * TILE_SIZE;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y + 12, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(x - 3, y, 6, 12);
      ctx.fillStyle = '#a47148';
      ctx.fillRect(x - 13, y - 14, 26, 16);
      ctx.strokeStyle = '#4a2c16';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 13, y - 14, 26, 16);
      ctx.fillStyle = '#e6ccb2';
      ctx.fillRect(x - 9, y - 10, 18, 2);
      ctx.fillRect(x - 9, y - 5, 13, 2);
    }
  }

  private renderCrystalOrbs(ctx: CanvasRenderingContext2D) {
    const blue = this.worlds[this.currentWorld].crystalBlueActive;
    for (const orb of this.crystalOrbs) {
      if (orb.world !== this.currentWorld) continue;
      const x = (orb.tx + 0.5) * TILE_SIZE;
      const y = (orb.ty + 0.5) * TILE_SIZE;

      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 10, y + 2, 20, 10);

      ctx.save();
      const color = blue ? '#38bdf8' : '#f87171';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - 3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 3, y - 7, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderChests(ctx: CanvasRenderingContext2D) {
    for (const c of this.chests) {
      if (c.world !== this.currentWorld) continue;
      const x = (c.tx + 0.5) * TILE_SIZE;
      const y = (c.ty + 0.5) * TILE_SIZE;

      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x - 15, y - 8, 30, 22);

      ctx.fillStyle = c.opened ? '#5c3d24' : '#92400e';
      ctx.fillRect(x - 14, y - 12, 28, 22);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 14, y - 12, 28, 22);

      if (!c.opened) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 3, y - 3, 6, 7);
      } else {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(x - 11, y - 8, 22, 8);
      }
    }
  }

  private renderPedestals(ctx: CanvasRenderingContext2D) {
    for (const ped of this.pedestals) {
      if (ped.world !== this.currentWorld) continue;
      const x = (ped.tx + 0.5) * TILE_SIZE;
      const y = (ped.ty + 0.5) * TILE_SIZE;

      // Stone altar
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x - 16, y - 10, 32, 24);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x - 14, y - 14, 28, 12);

      if (ped.collected) continue;

      const sealed = ped.reward === 'triforce' && !this.bossDefeated;
      const bob = Math.sin(this.elapsedTime * 3.5) * 3;

      if (ped.reward === 'boomerang') {
        ctx.save();
        ctx.translate(x, y - 14 + bob);
        ctx.rotate(-0.4);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-9, -6);
        ctx.quadraticCurveTo(4, -2, 9, 8);
        ctx.stroke();
        ctx.restore();
      } else if (ped.reward === 'triforce') {
        ctx.save();
        ctx.translate(x, y - 16 + bob);
        ctx.shadowColor = sealed ? '#ef4444' : '#fde047';
        ctx.shadowBlur = 16;
        ctx.fillStyle = sealed ? 'rgba(239,68,68,0.45)' : '#facc15';
        // Triforce 3-triangle emblem
        const drawTri = (ox: number, oy: number) => {
          ctx.beginPath();
          ctx.moveTo(ox, oy - 7);
          ctx.lineTo(ox - 7, oy + 5);
          ctx.lineTo(ox + 7, oy + 5);
          ctx.closePath();
          ctx.fill();
        };
        drawTri(0, -6);
        drawTri(-7, 6);
        drawTri(7, 6);
        ctx.restore();
      }
    }
  }

  private renderPickups(ctx: CanvasRenderingContext2D) {
    for (const pk of this.pickups) {
      if (pk.world !== this.currentWorld) continue;
      const bob = Math.sin(pk.bobPhase) * 3;
      const x = pk.x;
      const y = pk.y + bob;

      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(pk.x, pk.y + 10, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (pk.kind.startsWith('rupee')) {
        ctx.fillStyle =
          pk.kind === 'rupee_green' ? '#22c55e' : pk.kind === 'rupee_blue' ? '#38bdf8' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y - 3);
        ctx.lineTo(x + 6, y + 3);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 6, y + 3);
        ctx.lineTo(x - 6, y - 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (pk.kind === 'heart') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(x - 4, y - 3, 4.5, 0, Math.PI * 2);
        ctx.arc(x + 4, y - 3, 4.5, 0, Math.PI * 2);
        ctx.moveTo(x - 8, y - 1);
        ctx.lineTo(x, y + 8);
        ctx.lineTo(x + 8, y - 1);
        ctx.fill();
      } else if (pk.kind === 'key') {
        ctx.save();
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(x, y - 5, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 2, y, 4, 11);
        ctx.fillRect(x + 2, y + 5, 4, 2.5);
        ctx.fillRect(x + 2, y + 9, 4, 2.5);
        ctx.restore();
      }
    }
  }

  private renderBombs(ctx: CanvasRenderingContext2D) {
    for (const b of this.bombs) {
      if (b.world !== this.currentWorld) continue;
      const urgency = 1 - b.fuse / b.maxFuse;
      const flash = Math.sin(this.elapsedTime * (12 + urgency * 28)) > 0;
      ctx.fillStyle = flash && urgency > 0.45 ? '#ef4444' : '#1e293b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10 + urgency * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Sparking fuse
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(b.x + 5, b.y - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      if (!e.alive || e.world !== this.currentWorld) continue;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius - 2, e.radius * 0.85, e.radius * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(e.x, e.y);

      const isFlashing = e.hitFlash > 0;
      const isWindup = e.state === 'windup';

      if (e.kind === 'octorok') {
        ctx.fillStyle = isFlashing ? '#ffffff' : isWindup ? '#fb923c' : '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        const dv = this.dirToVec(e.dir);
        ctx.beginPath();
        ctx.arc(dv.x * 10, dv.y * 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(-4, -3, 2.3, 0, Math.PI * 2);
        ctx.arc(4, -3, 2.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'shadow_soldier') {
        ctx.fillStyle = isFlashing ? '#ffffff' : isWindup ? '#e879f9' : '#4c1d95';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-5, -4, 3, 3);
        ctx.fillRect(2, -4, 3, 3);
      } else if (e.kind === 'stalfos') {
        ctx.fillStyle = isFlashing ? '#ffffff' : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, -2, e.radius - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isWindup ? '#ef4444' : '#0f172a';
        ctx.beginPath();
        ctx.arc(-4, -3, 3, 0, Math.PI * 2);
        ctx.arc(4, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-5, 6, 10, 4);
      } else if (e.kind === 'darknut') {
        ctx.fillStyle = isFlashing ? '#ffffff' : isWindup ? '#fb7185' : '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Heavy Front Shield!
        if (e.state !== 'stunned') {
          const dv = this.dirToVec(e.dir);
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dv.x * 11, dv.y * 11, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (e.kind === 'phantom_boss') {
        ctx.shadowColor = isWindup ? '#ef4444' : '#a855f7';
        ctx.shadowBlur = 16;
        ctx.fillStyle = isFlashing ? '#ffffff' : isWindup ? '#dc2626' : '#581c87';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Horned crown & glowing eyes
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(-12, -14);
        ctx.lineTo(-5, -24);
        ctx.lineTo(0, -14);
        ctx.lineTo(5, -24);
        ctx.lineTo(12, -14);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-7, -3, 4, 4);
        ctx.fillRect(3, -3, 4, 4);
      }

      // Stunned orbiting stars
      if (e.state === 'stunned') {
        ctx.fillStyle = '#60a5fa';
        for (let k = 0; k < 3; k++) {
          const ang = this.elapsedTime * 7 + (k * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * 14, -e.radius - 6 + Math.sin(ang) * 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 18) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.merged && p.mergeState) {
      // ALBW Iconic 2D Mural Painting on Wall!
      const isVerticalEdge = p.mergeState.side === 'W' || p.mergeState.side === 'E';
      if (isVerticalEdge) {
        ctx.scale(0.42, 1.05);
      } else {
        ctx.scale(1.05, 0.85);
      }

      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;

      // Chalk-parchment mural backing
      ctx.fillStyle = 'rgba(254, 243, 199, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-12, -16, 24, 30, 6);
      ctx.fill();
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flat 2D Green Tunic & Cap
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(8, -2);
      ctx.lineTo(7, 11);
      ctx.lineTo(-7, 11);
      ctx.lineTo(-8, -2);
      ctx.closePath();
      ctx.fill();

      // Flat 2D Face + Hair
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-5, -6, 10, 7);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-3, -4, 2, 2);
      ctx.fillRect(1, -4, 2, 2);

      // Ravio's glowing bracelet glyph
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-9, 1, 3, 4);
      ctx.restore();
      return;
    }

    // Standard Top-Down Hero Link
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle walk bounce
    const bob = Math.sin(p.walkCycle) * 1.5;
    ctx.translate(0, bob);

    // Sword slash arc!
    if (p.swordTimer > 0) {
      const progress = 1 - p.swordTimer / 0.2;
      const baseAngle =
        p.dir === 'E' ? 0 : p.dir === 'S' ? Math.PI / 2 : p.dir === 'W' ? Math.PI : -Math.PI / 2;
      const startAng = baseAngle - 1.1;
      const curAng = startAng + progress * 2.2;

      ctx.save();
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, 32, startAng, curAng);
      ctx.stroke();

      // Blade
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(curAng) * 10, Math.sin(curAng) * 10);
      ctx.lineTo(Math.cos(curAng) * 38, Math.sin(curAng) * 38);
      ctx.stroke();
      ctx.restore();
    }

    // Tunic body
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#16a34a';
    ctx.beginPath();
    ctx.arc(0, 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head & Golden Hair
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -4, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -6, 8.5, Math.PI, Math.PI * 2);
    ctx.fill();

    // Classic pointed green cap trailing opposite facing direction
    const dv = this.dirToVec(p.dir);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(-dv.x * 14, -6 - dv.y * 12);
    ctx.lineTo(-6, -9);
    ctx.lineTo(6, -9);
    ctx.closePath();
    ctx.fill();

    // Eyes when facing South/East/West
    if (p.dir !== 'N') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dv.x * 3 - 3, -4 + dv.y * 2, 2, 2.5);
      ctx.fillRect(dv.x * 3 + 2, -4 + dv.y * 2, 2, 2.5);
    }

    ctx.restore();
  }

  private renderBoomerang(ctx: CanvasRenderingContext2D) {
    const bm = this.boomerang;
    if (!bm.active || bm.world !== this.currentWorld) return;
    ctx.save();
    ctx.translate(bm.x, bm.y);
    ctx.rotate(bm.angle);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.quadraticCurveTo(5, -2, 9, 8);
    ctx.stroke();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const pr of this.projectiles) {
      if (pr.world !== this.currentWorld) continue;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      if (pr.kind === 'arrow') {
        ctx.rotate(Math.atan2(pr.vy, pr.vx));
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(5, -4);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
      } else if (pr.kind === 'rock') {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (pr.kind === 'dark_orb') {
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#d946ef';
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const pt of this.particles) {
      ctx.save();
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = alpha;
      if (pt.glow) {
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderToasts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.toasts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = '#090d16';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
