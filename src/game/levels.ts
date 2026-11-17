import {
  ChestEntity,
  CrystalOrb,
  Enemy,
  FissureLink,
  PedestalEntity,
  Pickup,
  Signpost,
  TileKind,
  WorldId,
} from './types';

export const TILE_SIZE = 44;
export const MAP_W = 30;
export const MAP_H = 20;

export interface WorldData {
  id: WorldId;
  name: string;
  tiles: TileKind[][];
  crystalBlueActive: boolean;
}

const CHAR_TO_TILE: Record<string, TileKind> = {
  '#': 'wall',
  'F': 'fissure',
  'C': 'cracked_block',
  '.': 'grass',
  ',': 'path',
  '=': 'bridge',
  'B': 'bush',
  '~': 'water',
  '^': 'chasm',
  '|': 'bars',
  'R': 'crystal_red',
  'U': 'crystal_blue',
  'D': 'locked_door',
  'G': 'boss_door',
  'P': 'dungeon_portal',
  'X': 'exit_portal',
};

function parseMap(rows: string[], defaultFloor: TileKind): TileKind[][] {
  const grid: TileKind[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    const rowStr = (rows[y] || '').padEnd(MAP_W, '#').slice(0, MAP_W);
    const row: TileKind[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const ch = rowStr[x];
      if (ch === '.') {
        row.push(defaultFloor);
      } else {
        row.push(CHAR_TO_TILE[ch] ?? defaultFloor);
      }
    }
    grid.push(row);
  }
  return grid;
}

// 30 cols x 20 rows — Hyrule Overworld
// Key landmarks:
// - Player start: (14, 15)
// - Boomerang Pedestal: (10, 15)
// - East Gorge Chasm cols 19..21, rows 11..15, wall bridge along row 10 cols 16..22
// - Bow Chest on East Plateau: (25, 14)
// - Crystal Orb on chasm islet: (20, 13) -> lowers Red Barrier R at (20, 16)
// - North Moat Water cols 12..16, rows 6..8, Key Pickup at (14, 7) (Boomerang fetch!)
// - West Fissure F1: (4, 9) -> warps to Lorule (4, 9)
// - Sealed North Terrace rows 1..3, cols 10..18: F2 at (11, 1), Locked Door D at (14, 2), Dungeon Portal P at (14, 1)
const HYRULE_ROWS: string[] = [
  '##############################', // 00
  '#........##F##P###.#.........#', // 01  F2=(11,1), P=(14,1)
  '#..B.....#...#D#...#.....B...#', // 02  D=(14,2)
  '#........#.........#.........#', // 03  North Terrace floor
  '#........###########.........#', // 04  Sealed wall separating terrace
  '#..B.....#~~~~~~~~~#.....B...#', // 05
  '#........#~~~~~~~~~#.........#', // 06
  '#........#~~~~.~~~~#.........#', // 07  Key on islet (14,7)
  '#........#~~~~~~~~~#.........#', // 08
  '#..#F#...#...,,,...#.........#', // 09  F1=(4,9)
  '#............,,,#######......#', // 10  Wall bridge cols 16..22
  '#..B.........,,,...^^^.......#', // 11  Chasm at 19..21
  '#............,,,...^^^.......#', // 12
  '#......B.....,,,...^.^.......#', // 13  Orb islet at (20,13)
  '#............,,,...^^^.......#', // 14  Bow Chest at (25,14)
  '#............,,,...^^^...B...#', // 15  Start (14,15), Boomerang (10,15)
  '#.....B......,,,,,,=R=,,.....#', // 16  Red Crystal barrier R=(20,16)
  '#............,,,...^^^.......#', // 17
  '#..........B.,,,...^^^..B....#', // 18
  '##############################', // 19
];

// 30 cols x 20 rows — Lorule Overworld (Dark Twilight Mirror)
// Key landmarks:
// - F1 at (4, 9) -> back to Hyrule (4, 9)
// - Iron bars at cols 18..20, rows 12..17 with continuous wall along row 11 cols 16..22 to Wall-Merge past bars!
// - Bomb Bag Chest at (25, 14)
// - Cracked Boulder C at (11, 3) blocking North Fissure F2 at (11, 1)
// - Secret Cracked Boulder C at (4, 15) hiding Rupees & Heart!
const LORULE_ROWS: string[] = [
  '##############################', // 00
  '#........##F######...........#', // 01  F2=(11,1) -> warps to Hyrule North Terrace!
  '#........#...#...#...........#', // 02
  '#........##C##...#...........#', // 03  Cracked Boulder C=(11,3)
  '#..........,,....#...........#', // 04
  '#....^^^...,,....#...^^^.....#', // 05
  '#....^^^...,,........^^^.....#', // 06
  '#..........,,................#', // 07
  '#..........,,,,,.............#', // 08
  '#..#F#........,,.............#', // 09  F1=(4,9)
  '#.............,,.............#', // 10
  '#.............,,.########....#', // 11  Merge wall along row 11 cols 17..24
  '#.............,,..|||........#', // 12  Iron bars blocking direct entry to East
  '#.....#....,,,,,..|||........#', // 13
  '#.............,,..|||........#', // 14  Bomb Chest at (25,14)
  '#..##C##......,,..|||........#', // 15  Secret alcove behind C=(5,15)
  '#..#...#......,,..|||........#', // 16
  '#..#####......,,..^^^........#', // 17
  '#.................^^^........#', // 18
  '##############################', // 19
];

// 30 cols x 20 rows — Eastern Sanctuary Dungeon
// 4 Chambers:
// - Chamber 1 (Foyer): cols 11..18, rows 14..18. Exit X=(14,18), Start=(14,17)
// - Chamber 2 (East Wing): cols 20..28, rows 5..18.
//    * Wall-merge along col 27 (rows 11..14) past chasm at row 12..13!
//    * Crystal Orb at (22, 10) lowers Red Crystal R=(10, 16) opening Chamber 3!
//    * Cracked wall C=(26, 9) hides Heart Container at (26, 7)!
//    * Dungeon Small Key across chasm at (21, 7) (Boomerang fetch from (21, 10)!)
// - Chamber 3 (West Armory Arena): cols 1..9, rows 9..18.
//    * Fight 2 Stalfos + 1 Armored Darknut -> opens Boss Door G at (14, 8)!
// - Chamber 4 (Boss Vault): cols 10..19, rows 1..7.
//    * Locked Door D at (14, 13) -> North Corridor -> Boss Door G at (14, 8)
//    * Pillars at (12,4) & (17,4) for Wall-Merge dodging Phantom Boss!
//    * Triforce Relic Pedestal at (14, 2) spawns/unseals when Boss defeated!
const DUNGEON_ROWS: string[] = [
  '##############################', // 00
  '#........#..........#........#', // 01  Boss Vault cols 10..19, rows 1..7
  '#........#..........#........#', // 02  Triforce Relic at (14,2)
  '#........#..........#........#', // 03
  '#........#..#....#..#........#', // 04  Pillars (12,4) and (17,4)
  '#........#..........#..^^^...#', // 05  East Wing upper alcove
  '#........#..........#..^^^...#', // 06
  '#........#..........#.^.^^.#.#', // 07  Key islet at (21,7), Secret Heart at (26,7)
  '##########....G.....#..^^^.#.#', // 08  Boss Door G=(14,8)
  '#........#..........######C###', // 09  Cracked Wall C=(26,9)
  '#........#..........#........#', // 10  Crystal Orb at (22,10)
  '#........#..........#........#', // 11
  '#........#..........#^^^^^^..#', // 12  Chasm cols 21..26! Merge along col 28 wall (28,11..14) or (27,12..13)!
  '#........#####D######^^^^^^..#', // 13  Locked Door D=(14,13); Wall at col 28, floor at col 27!
  '#........#..........#........#', // 14  Wait: if chasm is cols 21..26, col 27 is floor `.` and col 28 is wall `#` -> wait: let's make col 27 chasm too? No, col 27 floor lets you walk! Let's make chasm cols 21..27 and col 28 wall? No, then you'd pop out onto chasm! Wait: let's make chasm cols 21..26 at rows 12..13, and wall at col 27? No, if col 27 is floor at rows 11..14, you can just walk around! Let's make cols 21..28 chasm at rows 12..13 AND wall along col 29 (outer wall) where row 11 and row 14 at col 28 are floor!
  '#........#..........#........#', // 15
  '#........R...................#', // 16  R=(9,16) blocks West Arena; open doorway at (19..20,16) to East Wing!
  '#........#..........#........#', // 17
  '#........#....X.....#........#', // 18  Exit Portal X=(14,18)
  '##############################', // 19
];

// Let's fix Dungeon rows 12-13 cleanly so Wall-Merge is truly needed in East Wing:
// Rows 12-13 cols 21..28: `^^^^^^^#` -> Wait: col 29 is `#`, so if row 12-13 has `^^^^^^^` at cols 21..27 and `#` at col 28-29, wait:
// In row 11: `#........#..........#.......##` -> col 28 is `#`, col 27 is `.` (safe!)
// In row 12: `#........#..........#^^^^^^^##` -> cols 21..27 are `^`, col 28 is `#` (continuous wall on `'W'` edge? Wait: at row 12 col 28, `'W'` faces `(27,12)` which is `^`! And at row 11 col 28, `'W'` faces `(27,11)` which is `.`! And at row 14 col 28, `'W'` faces `(27,14)` which is `.`!)
// YES!! Look how clean that is:
// Col 28 is `#` on rows 11, 12, 13, 14!
// Col 27 is `.` on row 11, `^` on row 12, `^` on row 13, `.` on row 14!
// So Link stands at `(27, 14)`, merges onto the `'W'` edge of `(28, 14)` (facing East!), slides UP along `(28,14) -> (28,13) -> (28,12) -> (28,11)` right past the chasm `^` at `(27,12..13)`, and unmerges onto `(27, 11)`!
// Let's double check! Does `(27, 14)` touch the `'W'` edge of `(28, 14)`? YES! Is `(28, 11..14)` continuous `#`? YES! Is `(27, 11)` safe floor `.`? YES!
// Also let's check Key islet `(21, 7)` in Dungeon:
// Row 5..8 cols 20..28:
// Row 5: `#..^^^..#` -> cols 20=`#`, 21=`.`, 22=`.`, 23=`.`, 24=`^`, 25=`^`, 26=`^`, 27=`.`, 28=`.`?
// Let's make row 6,7,8 have water/chasm at cols 21..23 so `(22, 6)` or `(22, 7)` is an isolated 1-tile islet surrounded by chasm `^`!
// Let's inspect cols 20..29 carefully for Dungeon rows 5..14:
// Col:    20 21 22 23 24 25 26 27 28 29
// Row 05: #  .  .  .  .  #  .  .  .  #   <- wait: secret room for Heart Container at cols 26..28, rows 5..8!
// Row 06: #  ^  ^  ^  .  #  .  .  .  #   <- Key islet at (22,7) surrounded by ^ on rows 6,7,8!
// Row 07: #  ^  .  ^  .  #  .  .  .  #   <- Heart Container at (27, 7)! Key at (22, 7)!
// Row 08: #  ^  ^  ^  .  #  .  .  .  #   <- Chasm at (21..23, 8)
// Row 09: #  .  .  .  .  #  #  C  #  #   <- Cracked block C at (27, 9)! Bomb it from (27, 10) to enter Heart Room!
// Row 10: #  .  .  .  .  .  .  .  #  #   <- Walkable corridor! Crystal Orb at (22, 10)!
// Row 11: #  .  .  .  .  .  .  .  #  #   <- Safe floor (27, 11)!
// Row 12: #  ^  ^  ^  ^  ^  ^  ^  #  #   <- Chasm across cols 21..27!
// Row 13: #  ^  ^  ^  ^  ^  ^  ^  #  #   <- Chasm across cols 21..27!
// Row 14: #  .  .  .  .  .  .  .  .  #   <- Safe floor (27, 14)! Merge onto (28, 14) 'W' or wait: row 14 col 28 needs to be `#`!
// Let's make row 14 col 28 `#` (`#.......##`) and row 15 col 28 `.`! Then at `(27, 14)` you stand right left of `(28, 14)` `#`, merge onto `(28, 14)` `'W'`, slide North to `(28, 11)`, and pop out onto `(27, 11)`!

const DUNGEON_ROWS_FINAL: string[] = [
  '##############################', // 00
  '#........#..........#........#', // 01
  '#........#..........#........#', // 02  Triforce Relic at (14, 2)
  '#........#..........#........#', // 03
  '#........#..#....#..#........#', // 04  Pillars (12,4), (17,4)
  '#........#..........#....#...#', // 05
  '#........#..........#^^^.#...#', // 06
  '#........#..........#^.^.#...#', // 07  Key at (22,7), Heart Container at (27,7)
  '##########....G.....#^^^.#...#', // 08  Boss Door G=(14,8)
  '#........#..........###C######', // 09  Cracked Wall C=(23? Wait: col 20=#, 21=^, 22=^, 23=^, 24=., 25=#, 26=#, 27=C, 28=#, 29=# -> let's count!)
  '#........#..........#.......##', // 10  Crystal Orb at (22,10)
  '#........#..........#.......##', // 11
  '#........#..........#^^^^^^^##', // 12  Chasm cols 21..27, wall at col 28..29
  '#........#####D######^^^^^^^##', // 13  Locked Door D=(14,13)
  '#........#..........#.......##', // 14  Stand at (27,14), merge onto (28,14)!
  '#........#..........#........#', // 15
  '#........R...................#', // 16  R=(9,16), open doorway at (19..20,16)
  '#........#..........#........#', // 17
  '#........#....X.....#........#', // 18  Exit X=(14,18)
  '##############################', // 19
];

// Wait let's verify col indices of rows 05..09 for cols 20..29!
// 20 21 22 23 24 25 26 27 28 29
// Row 05: #  .  .  .  .  #  .  .  .  #  -> '#....#...#' (len 10)
// Row 06: #  ^  ^  ^  .  #  .  .  .  #  -> '#^^^.#...#' (len 10)
// Row 07: #  ^  .  ^  .  #  .  .  .  #  -> '#^.^.#...#' (len 10)
// Row 08: #  ^  ^  ^  .  #  .  .  .  #  -> '#^^^.#...#' (len 10)
// Row 09: #  .  .  .  .  #  #  C  #  #  -> '#....##C##' (len 10) -> col 25=#, 26=#, 27=C, 28=#, 29=#!
// Let's check row 09 total prefix: '#........#..........' is 1 + 8 + 1 + 10 = 20 chars (cols 0..19).
// Plus '#....##C##' (cols 20..29) = 30 chars!
// And in row 10: '#........#..........' (20) + '#.......##' (10) = 30 chars!
// So from (27, 10) you place Bomb next to C at (27, 9), blast it, walk north to (27, 7) for Heart Container!
// And from (22, 10) (wait: Orb at (24, 10) or (21, 10) so you can stand at (22, 9) and throw Boomerang north to (22, 7)!),
// Wait: if Orb is at (24, 10), you stand at (22, 9), throw Boomerang North over (22, 8) chasm, grab Key at (22, 7)! And hit Crystal Orb at (24, 10) with Sword/Bow/Boomerang!
// Let's make sure Dungeon Row 09 uses `#....##C##`!

DUNGEON_ROWS_FINAL[5] = '#........#..........#....#...#';
DUNGEON_ROWS_FINAL[6] = '#........#..........#^^^.#...#';
DUNGEON_ROWS_FINAL[7] = '#........#..........#^.^.#...#';
DUNGEON_ROWS_FINAL[8] = '##############G######^^^.#...#';
DUNGEON_ROWS_FINAL[9] = '#........#..........#....##C##';

export function createInitialWorlds(): Record<WorldId, WorldData> {
  return {
    hyrule: {
      id: 'hyrule',
      name: 'Hyrule Overworld',
      tiles: parseMap(HYRULE_ROWS, 'grass'),
      crystalBlueActive: false,
    },
    lorule: {
      id: 'lorule',
      name: 'Lorule Overworld',
      tiles: parseMap(LORULE_ROWS, 'lorule_grass'),
      crystalBlueActive: false,
    },
    dungeon: {
      id: 'dungeon',
      name: 'Eastern Sanctuary',
      tiles: parseMap(DUNGEON_ROWS_FINAL, 'dungeon_floor'),
      crystalBlueActive: false,
    },
  };
}

export const FISSURE_LINKS: Array<{ world: WorldId; link: FissureLink }> = [
  // West Hyrule <-> West Lorule
  {
    world: 'hyrule',
    link: { tx: 4, ty: 9, targetWorld: 'lorule', targetTx: 4, targetTy: 9, targetSide: 'S' },
  },
  {
    world: 'lorule',
    link: { tx: 4, ty: 9, targetWorld: 'hyrule', targetTx: 4, targetTy: 9, targetSide: 'S' },
  },
  // North Lorule <-> Hyrule Sealed North Terrace
  {
    world: 'lorule',
    link: { tx: 11, ty: 1, targetWorld: 'hyrule', targetTx: 11, targetTy: 1, targetSide: 'S' },
  },
  {
    world: 'hyrule',
    link: { tx: 11, ty: 1, targetWorld: 'lorule', targetTx: 11, targetTy: 1, targetSide: 'S' },
  },
];

export function createInitialChests(): ChestEntity[] {
  return [
    {
      id: 'hyrule_bow',
      world: 'hyrule',
      tx: 25,
      ty: 14,
      opened: false,
      reward: 'bow',
      label: "Hero's Bow",
    },
    {
      id: 'lorule_bombs',
      world: 'lorule',
      tx: 25,
      ty: 14,
      opened: false,
      reward: 'bomb',
      label: 'Bomb Bag',
    },
    {
      id: 'lorule_rupees',
      world: 'lorule',
      tx: 5,
      ty: 16,
      opened: false,
      reward: 'rupees_50',
      label: '50 Rupees',
    },
    {
      id: 'dungeon_heart',
      world: 'dungeon',
      tx: 27,
      ty: 7,
      opened: false,
      reward: 'heart_container',
      label: 'Heart Container',
    },
  ];
}

export function createInitialPedestals(): PedestalEntity[] {
  return [
    {
      id: 'hyrule_boomerang',
      world: 'hyrule',
      tx: 10,
      ty: 15,
      collected: false,
      reward: 'boomerang',
      label: 'Boomerang',
    },
    {
      id: 'dungeon_triforce',
      world: 'dungeon',
      tx: 14,
      ty: 2,
      collected: false,
      reward: 'triforce',
      label: 'Pendant of Courage',
    },
  ];
}

export function createInitialPickups(): Pickup[] {
  return [
    // Overworld Sanctuary Key on Hyrule North Moat Island (fetch with Boomerang!)
    {
      id: 1,
      world: 'hyrule',
      kind: 'key',
      x: 14.5 * TILE_SIZE,
      y: 7.5 * TILE_SIZE,
      bobPhase: 0,
      life: 999999,
    },
    // Dungeon Small Key on East Wing Chasm Island (fetch with Boomerang!)
    {
      id: 2,
      world: 'dungeon',
      kind: 'key',
      x: 22.5 * TILE_SIZE,
      y: 7.5 * TILE_SIZE,
      bobPhase: 1.2,
      life: 999999,
    },
    // Scattered rupees as visual trail breadcrumbs
    {
      id: 3,
      world: 'hyrule',
      kind: 'rupee_green',
      x: 18.5 * TILE_SIZE,
      y: 11.5 * TILE_SIZE,
      bobPhase: 0.4,
      life: 999999,
    },
    {
      id: 4,
      world: 'hyrule',
      kind: 'rupee_blue',
      x: 22.5 * TILE_SIZE,
      y: 11.5 * TILE_SIZE,
      bobPhase: 2.0,
      life: 999999,
    },
  ];
}

export function createInitialCrystalOrbs(): CrystalOrb[] {
  return [
    { id: 'hyrule_east_orb', world: 'hyrule', tx: 20, ty: 13, hitCooldown: 0 },
    { id: 'dungeon_east_orb', world: 'dungeon', tx: 24, ty: 10, hitCooldown: 0 },
  ];
}

export function createInitialSignposts(): Signpost[] {
  return [
    {
      world: 'hyrule',
      tx: 16,
      ty: 14,
      text: 'Press E beside a stone wall to Wall-Merge across the East Gorge or enter the West Fissure.',
    },
    {
      world: 'hyrule',
      tx: 13,
      ty: 9,
      text: 'Sanctuary Key lies on the moat isle — throw the Boomerang (3 + F) across the water to claim it!',
    },
    {
      world: 'lorule',
      tx: 5,
      ty: 10,
      text: 'Welcome to Lorule. Merge past the East iron bars for Bombs, then blast the North boulder!',
    },
  ];
}

export function createInitialEnemies(): Enemy[] {
  return [
    // Hyrule Overworld Octoroks
    {
      id: 'hy_octo_1',
      world: 'hyrule',
      kind: 'octorok',
      x: 8.5 * TILE_SIZE,
      y: 12.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'S',
      hp: 2,
      maxHp: 2,
      radius: 14,
      state: 'patrol',
      stateTimer: 1.2,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
    },
    {
      id: 'hy_octo_2',
      world: 'hyrule',
      kind: 'octorok',
      x: 24.5 * TILE_SIZE,
      y: 17.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'W',
      hp: 2,
      maxHp: 2,
      radius: 14,
      state: 'patrol',
      stateTimer: 1.6,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
    },
    // Lorule Shadow Soldiers
    {
      id: 'lo_soldier_1',
      world: 'lorule',
      kind: 'shadow_soldier',
      x: 9.5 * TILE_SIZE,
      y: 12.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'W',
      hp: 3,
      maxHp: 3,
      radius: 15,
      state: 'patrol',
      stateTimer: 1.0,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
    },
    {
      id: 'lo_soldier_2',
      world: 'lorule',
      kind: 'shadow_soldier',
      x: 22.5 * TILE_SIZE,
      y: 14.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'W',
      hp: 3,
      maxHp: 3,
      radius: 15,
      state: 'patrol',
      stateTimer: 1.4,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
    },
    // Dungeon East Wing Stalfos
    {
      id: 'dg_stalfos_east',
      world: 'dungeon',
      kind: 'stalfos',
      x: 24.5 * TILE_SIZE,
      y: 15.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'S',
      hp: 3,
      maxHp: 3,
      radius: 15,
      state: 'patrol',
      stateTimer: 1.0,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
    },
    // Dungeon West Armory Arena (clearing unlocks Boss Door!)
    {
      id: 'dg_arena_stalfos_1',
      world: 'dungeon',
      kind: 'stalfos',
      x: 4.5 * TILE_SIZE,
      y: 11.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'S',
      hp: 3,
      maxHp: 3,
      radius: 15,
      state: 'patrol',
      stateTimer: 0.9,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
      arenaId: 'west_armory',
    },
    {
      id: 'dg_arena_stalfos_2',
      world: 'dungeon',
      kind: 'stalfos',
      x: 7.5 * TILE_SIZE,
      y: 12.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'W',
      hp: 3,
      maxHp: 3,
      radius: 15,
      state: 'patrol',
      stateTimer: 1.3,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
      arenaId: 'west_armory',
    },
    {
      id: 'dg_arena_darknut',
      world: 'dungeon',
      kind: 'darknut',
      x: 4.5 * TILE_SIZE,
      y: 15.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'E',
      hp: 6,
      maxHp: 6,
      radius: 17,
      state: 'patrol',
      stateTimer: 1.1,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
      arenaId: 'west_armory',
    },
    // Dungeon Boss Vault: Phantom Yuga Knight
    {
      id: 'dg_boss_phantom',
      world: 'dungeon',
      kind: 'phantom_boss',
      x: 14.5 * TILE_SIZE,
      y: 4.5 * TILE_SIZE,
      vx: 0,
      vy: 0,
      dir: 'S',
      hp: 14,
      maxHp: 14,
      radius: 21,
      state: 'patrol',
      stateTimer: 1.5,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
      alive: true,
      arenaId: 'boss_vault',
    },
  ];
}
