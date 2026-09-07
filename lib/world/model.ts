export const W = 2400,
  H = 1700;
export const ROAD_X = [180, 590, 1030, 1740, 2190];
export const ROAD_Y = [260, 670, 1090, 1480];
export type Kind =
  | 'home'
  | 'primary'
  | 'middle'
  | 'high'
  | 'university'
  | 'hall'
  | 'shop'
  | 'tower'
  | 'library';
export type Building = {
  id: string;
  name: string;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  color: number;
  people: number;
  added?: boolean;
};
export type Tree = { x: number; y: number; variant: number; added?: boolean };
export type Agent = {
  x: number;
  y: number;
  from: number;
  to: number;
  progress: number;
  speed: number;
  color: number;
  car: boolean;
};
export type Point = { x: number; y: number };
export type World = {
  buildings: Building[];
  trees: Tree[];
  agents: Agent[];
  nodes: Point[];
  edges: number[][];
  seed: number;
};
export type Tool = 'explore' | 'tree' | 'home' | 'erase';
export const TYPE_NAMES: Record<Kind, string> = {
  home: '居民区',
  primary: '小学',
  middle: '初中',
  high: '高中',
  university: '大学',
  hall: '市政厅',
  shop: '商业街',
  tower: '钟楼',
  library: '图书馆',
};
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function riverX(y: number) {
  return 1390 + Math.round(Math.sin(y / 310) * 4) * 16;
}
export function isWater(x: number, y: number) {
  return Math.abs(x - riverX(y)) < 102;
}
export function isRoad(x: number, y: number, margin = 0) {
  return (
    ROAD_Y.some((ry) => Math.abs(y - ry) < 29 + margin) ||
    ROAD_X.some((rx) => Math.abs(x - rx) < 29 + margin)
  );
}
export function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  m = 0,
) {
  return (
    a.x < b.x + b.w + m &&
    a.x + a.w + m > b.x &&
    a.y < b.y + b.h + m &&
    a.y + a.h + m > b.y
  );
}
export function createWorld(seed = 2417): World {
  const random = rng(seed),
    buildings: Building[] = [],
    trees: Tree[] = [];
  const add = (
    kind: Kind,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    height = 40,
    color = 0,
    people = 0,
  ) =>
    buildings.push({
      id: `b${buildings.length}`,
      kind,
      name,
      x,
      y,
      w,
      h,
      height,
      color,
      people,
    });
  let house = 0;
  for (const [startX, startY, cols, rows] of [
    [255, 350, 3, 2],
    [250, 90, 3, 1],
    [880, 90, 1, 1],
    [1830, 355, 3, 2],
    [1830, 100, 3, 1],
    [255, 1190, 3, 2],
    [690, 1200, 3, 2],
    [1820, 1560, 3, 1],
  ]) {
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        add(
          'home',
          `${house < 13 ? '梧桐里' : house < 22 ? '东岸花园' : '青禾社区'} ${++house} 号`,
          startX + col * 105,
          startY + row * 138,
          68 + Math.floor(random() * 3) * 4,
          57,
          30 + Math.floor(random() * 2) * 12,
          Math.floor(random() * 5),
          3 + Math.floor(random() * 5),
        );
      }
  }
  add('primary', '青禾小学', 690, 390, 236, 100, 44, 2, 320);
  add('middle', '明德初中', 275, 825, 240, 105, 57, 1, 680);
  add('high', '青河一中', 700, 812, 253, 113, 62, 0, 960);
  add('university', '青河大学', 1840, 815, 243, 125, 62, 1, 2400);
  add('library', '大学图书馆', 1850, 1175, 105, 110, 68, 1, 360);
  add('university', '理工学院', 2005, 1175, 107, 104, 45, 0, 480);
  add('hall', '青河市政厅', 1110, 410, 152, 121, 66, 1, 42);
  add('tower', '河畔钟楼', 1580, 855, 63, 65, 145, 2, 8);
  add('library', '城市图书馆', 1110, 835, 137, 92, 52, 3, 160);
  add('shop', '青河市场', 1100, 1220, 120, 73, 32, 0, 24);
  add('shop', '花间咖啡', 1575, 1235, 91, 67, 34, 2, 12);
  add('shop', '独立书店', 1575, 1340, 91, 62, 39, 1, 8);
  add('shop', '星光影院', 700, 100, 142, 91, 51, 4, 60);
  for (let i = 0; i < 780; i++) {
    const x = Math.floor((random() * W) / 8) * 8,
      y = Math.floor((random() * H) / 8) * 8;
    const protectedArea =
      (x > 660 && x < 985 && y > 340 && y < 640) ||
      (x > 240 && x < 545 && y > 760 && y < 1060) ||
      (x > 660 && x < 990 && y > 745 && y < 1060) ||
      (x > 1785 && x < 2150 && y > 730 && y < 1450) ||
      (x > 1080 && x < 1285 && y > 345 && y < 630);
    if (
      x < 45 ||
      x > W - 40 ||
      y < 55 ||
      y > H - 25 ||
      isWater(x, y) ||
      Math.abs(x - riverX(y)) < 130 ||
      isRoad(x, y, 27) ||
      protectedArea ||
      buildings.some((b) =>
        overlaps({ x: x - 20, y: y - 28, w: 40, h: 45 }, b, 12),
      )
    )
      continue;
    trees.push({ x, y, variant: Math.floor(random() * 4) });
  }
  const nodes: Point[] = [],
    edges: number[][] = [];
  ROAD_Y.forEach((y) =>
    ROAD_X.forEach((x) => {
      nodes.push({ x, y });
      edges.push([]);
    }),
  );
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 5; col++) {
      const n = row * 5 + col;
      if (col < 4) {
        edges[n].push(n + 1);
        edges[n + 1].push(n);
      }
      if (row < 3) {
        edges[n].push(n + 5);
        edges[n + 5].push(n);
      }
    }
  const agents: Agent[] = Array.from({ length: 180 }, (_, i) => {
    const from = Math.floor(random() * nodes.length),
      to = edges[from][Math.floor(random() * edges[from].length)];
    return {
      x: 0,
      y: 0,
      from,
      to,
      progress: random(),
      speed: i < 36 ? 45 + random() * 18 : 9 + random() * 9,
      color: Math.floor(random() * 6),
      car: i < 36,
    };
  });
  const world = { buildings, trees, agents, nodes, edges, seed };
  updateAgents(world, 0);
  return world;
}
export function updateAgents(world: World, dt: number) {
  for (const a of world.agents) {
    let p = world.nodes[a.from],
      q = world.nodes[a.to];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    a.progress += (dt * a.speed) / len;
    if (a.progress >= 1) {
      a.progress %= 1;
      const prev = a.from;
      a.from = a.to;
      const choices = world.edges[a.from].filter((n) => n !== prev);
      a.to =
        choices[(a.color + a.from + Math.floor(a.speed)) % choices.length] ??
        prev;
      p = world.nodes[a.from];
      q = world.nodes[a.to];
    }
    const dx = Math.sign(q.x - p.x),
      dy = Math.sign(q.y - p.y),
      offset = a.car ? 10 : 33;
    a.x = p.x + (q.x - p.x) * a.progress - dy * offset;
    a.y = p.y + (q.y - p.y) * a.progress + dx * offset;
  }
}
export function place(world: World, tool: Tool, x: number, y: number): string {
  x = Math.round(x / 8) * 8;
  y = Math.round(y / 8) * 8;
  if (tool === 'erase') {
    const b = world.buildings.findIndex(
      (b) =>
        b.added &&
        x >= b.x &&
        x <= b.x + b.w &&
        y >= b.y - b.height &&
        y <= b.y + b.h,
    );
    if (b >= 0) {
      world.buildings.splice(b, 1);
      return '已移除房屋';
    }
    const t = world.trees.findIndex(
      (t) => t.added && Math.abs(t.x - x) < 25 && Math.abs(t.y - y) < 40,
    );
    if (t >= 0) {
      world.trees.splice(t, 1);
      return '已移除树木';
    }
    return '请选择你放置的房屋或树木';
  }
  const rect =
    tool === 'home'
      ? { x: x - 36, y: y - 28, w: 72, h: 56 }
      : { x: x - 16, y: y - 16, w: 32, h: 32 };
  if (
    rect.x < 25 ||
    rect.y < 35 ||
    rect.x + rect.w > W - 25 ||
    rect.y + rect.h > H - 25
  )
    return '请在城市边界内建造';
  for (let a = rect.x; a <= rect.x + rect.w; a += 8)
    for (let b = rect.y; b <= rect.y + rect.h; b += 8) {
      if (isWater(a, b) || isRoad(a, b, 18))
        return '请选一块远离道路和河流的空地';
    }
  const campusZones = [
    { x: 660, y: 340, w: 325, h: 300 },
    { x: 240, y: 760, w: 305, h: 300 },
    { x: 660, y: 745, w: 330, h: 315 },
    { x: 1785, y: 730, w: 365, h: 720 },
    { x: 1080, y: 345, w: 205, h: 285 },
  ];
  if (
    campusZones.some((b) => overlaps(rect, b)) ||
    world.buildings.some((b) => overlaps(rect, b, 16)) ||
    world.trees.some((t) =>
      overlaps(rect, { x: t.x - 12, y: t.y - 14, w: 24, h: 28 }),
    )
  )
    return '这里已有建筑、树木或公共设施';
  if (tool === 'tree') {
    world.trees.push({ x, y, variant: world.trees.length % 4, added: true });
    return '已种下一棵树';
  }
  if (tool === 'home') {
    world.buildings.push({
      id: `custom-${Date.now()}-${world.buildings.length}`,
      kind: 'home',
      name: '新建住宅',
      x: rect.x,
      y: rect.y,
      w: 72,
      h: 56,
      height: 36,
      color: world.buildings.length % 5,
      people: 4,
      added: true,
    });
    return '新住宅落成，4 位居民入住';
  }
  return '';
}
