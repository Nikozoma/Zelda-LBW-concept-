export type WorldId = 'hyrule' | 'lorule' | 'dungeon';

export type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type Direction = 'N' | 'S' | 'E' | 'W';

export type ItemId = 'bow' | 'bomb' | 'boomerang';

export type TileKind =
  | 'grass'
  | 'lorule_grass'
  | 'path'
  | 'dungeon_floor'
  | 'bridge'
  | 'wall'
  | 'fissure'
  | 'cracked_block'
  | 'bush'
  | 'chasm'
  | 'water'
  | 'bars'
  | 'crystal_red'
  | 'crystal_blue'
  | 'locked_door'
  | 'boss_door'
  | 'dungeon_portal'
  | 'exit_portal';

export interface FissureLink {
  tx: number;
  ty: number;
  targetWorld: WorldId;
  targetTx: number;
  targetTy: number;
  targetSide: Direction;
}

export interface ChestEntity {
  id: string;
  world: WorldId;
  tx: number;
  ty: number;
  opened: boolean;
  reward: 'bow' | 'bomb' | 'boomerang' | 'key' | 'heart_container' | 'rupees_50';
  label: string;
}

export interface PedestalEntity {
  id: string;
  world: WorldId;
  tx: number;
  ty: number;
  collected: boolean;
  reward: 'boomerang' | 'bow' | 'bomb' | 'key' | 'triforce';
  label: string;
}

export interface CrystalOrb {
  id: string;
  world: WorldId;
  tx: number;
  ty: number;
  hitCooldown: number;
}

export interface Signpost {
  world: WorldId;
  tx: number;
  ty: number;
  text: string;
}

export type EnemyKind = 'octorok' | 'shadow_soldier' | 'stalfos' | 'darknut' | 'phantom_boss';

export interface Enemy {
  id: string;
  world: WorldId;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  hp: number;
  maxHp: number;
  radius: number;
  state: 'patrol' | 'windup' | 'attack' | 'stunned' | 'cooldown';
  stateTimer: number;
  hitFlash: number;
  knockVx: number;
  knockVy: number;
  alive: boolean;
  arenaId?: string;
}

export interface Projectile {
  id: number;
  world: WorldId;
  kind: 'arrow' | 'rock' | 'dark_orb';
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
  damage: number;
}

export interface BoomerangState {
  active: boolean;
  world: WorldId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  returning: boolean;
  timer: number;
  angle: number;
  carriedPickupIds: number[];
}

export interface BombEntity {
  id: number;
  world: WorldId;
  x: number;
  y: number;
  fuse: number;
  maxFuse: number;
  exploded: boolean;
}

export interface Pickup {
  id: number;
  world: WorldId;
  kind: 'rupee_green' | 'rupee_blue' | 'rupee_red' | 'heart' | 'key';
  x: number;
  y: number;
  bobPhase: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow?: boolean;
}

export interface FloatingToast {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface MergeState {
  tx: number;
  ty: number;
  side: Direction; // The exposed face of (tx, ty) Link is flattened onto
  t: number; // 0..1 along that edge
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  hp: number; // In half-hearts (e.g. 10 = 5 full hearts)
  maxHp: number;
  stamina: number; // 0..100
  maxStamina: number;
  staminaRegenDelay: number;
  rupees: number;
  keys: number;
  unlockedItems: ItemId[];
  equippedItem: ItemId | null;
  merged: boolean;
  mergeState: MergeState | null;
  mergeAnim: number; // 0 = 3D, 1 = flat 2D mural
  swordTimer: number;
  swordCooldown: number;
  invulnTimer: number;
  hitFlash: number;
  knockVx: number;
  knockVy: number;
  walkCycle: number;
  lastSafeX: number;
  lastSafeY: number;
  lastSafeWorld: WorldId;
  warpCooldown: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  world: WorldId;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  rupees: number;
  keys: number;
  unlockedItems: ItemId[];
  equippedItem: ItemId | null;
  merged: boolean;
  canMergePrompt: boolean;
  nearSignText: string | null;
  bannerText: string | null;
  objectiveText: string;
  muted: boolean;
  bossHp: number | null;
  bossMaxHp: number | null;
  bossName: string | null;
  stats: {
    enemiesDefeated: number;
    fissuresCrossed: number;
    timeSeconds: number;
  };
}
