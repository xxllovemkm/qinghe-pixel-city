import {
  W,
  H,
  ROAD_X,
  ROAD_Y,
  riverX,
  rng,
  isWater,
  isRoad,
  type World,
  type Building,
  type Tree,
} from './model';
type C = CanvasRenderingContext2D;
const ROOFS = ['#bd6351', '#627f9e', '#d59a4e', '#648d83', '#9b7296'];
const DARK = ['#854534', '#435a78', '#a96b36', '#426459', '#705273'];
function rect(c: C, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function poly(c: C, pts: number[][], color: string) {
  c.fillStyle = color;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
export function drawTree(c: C, t: Tree) {
  const { x, y, variant: v } = t;
  rect(c, x - 12, y + 5, 31, 10, '#55724755');
  rect(c, x - 3, y - 7, 7, 22, '#866349');
  const colors = ['#3e7650', '#4f8751', '#6e934d', '#49805c'];
  const col = colors[v];
  rect(c, x - 19, y - 24, 36, 23, '#366244');
  rect(c, x - 13, y - 38, 25, 38, col);
  rect(c, x - 22, y - 28, 40, 20, col);
  rect(c, x - 13, y - 42, 21, 14, col);
  rect(c, x - 12, y - 34, 11, 11, '#82ab61');
  rect(c, x - 19, y - 25, 10, 8, '#6b9b59');
  rect(c, x + 11, y - 18, 8, 14, '#356345');
}
function fence(c: C, x: number, y: number, w: number, h: number) {
  rect(c, x, y, w, 3, '#ebe5be');
  rect(c, x, y + h, w, 3, '#ebe5be');
  for (let a = x; a < x + w; a += 16) {
    rect(c, a, y - 4, 3, 12, '#f7efcc');
    rect(c, a, y + h - 4, 3, 12, '#f7efcc');
  }
  for (let b = y; b < y + h; b += 16) {
    rect(c, x, b, 3, 12, '#ebe5be');
    rect(c, x + w, b, 3, 12, '#ebe5be');
  }
}
function pitch(
  c: C,
  x: number,
  y: number,
  w: number,
  h: number,
  track = false,
) {
  if (track) {
    rect(c, x - 15, y - 15, w + 30, h + 30, '#ae7060');
    c.strokeStyle = '#d79779';
    c.lineWidth = 2;
    for (let n = 1; n <= 3; n++)
      c.strokeRect(x - n * 4, y - n * 4, w + n * 8, h + n * 8);
  }
  rect(c, x, y, w, h, '#72a366');
  for (let i = 0; i < 6; i++)
    if (i % 2 === 0) rect(c, x + (i * w) / 6, y, w / 6, h, '#7ba970');
  c.strokeStyle = '#e6edbb';
  c.lineWidth = 2;
  c.strokeRect(x + 6, y + 5, w - 12, h - 10);
  c.beginPath();
  c.moveTo(x + w / 2, y + 5);
  c.lineTo(x + w / 2, y + h - 5);
  c.stroke();
  c.beginPath();
  c.arc(x + w / 2, y + h / 2, Math.min(h / 4, 21), 0, Math.PI * 2);
  c.stroke();
  c.strokeRect(x + 6, y + h / 2 - 17, 21, 34);
  c.strokeRect(x + w - 27, y + h / 2 - 17, 21, 34);
  rect(c, x + 2, y + h / 2 - 11, 5, 23, '#eee7c1');
  rect(c, x + w - 7, y + h / 2 - 11, 5, 23, '#eee7c1');
}
function bench(c: C, x: number, y: number) {
  rect(c, x, y, 25, 4, '#8b6548');
  rect(c, x, y + 6, 25, 5, '#b18b59');
  rect(c, x + 3, y + 10, 3, 5, '#545f52');
  rect(c, x + 20, y + 10, 3, 5, '#545f52');
}
function fountain(c: C, x: number, y: number) {
  rect(c, x - 44, y - 28, 88, 54, '#abac92');
  rect(c, x - 38, y - 33, 76, 60, '#e5dfbd');
  rect(c, x - 32, y - 25, 64, 44, '#74b8bd');
  rect(c, x - 25, y - 21, 50, 30, '#93d1c9');
  rect(c, x - 5, y - 26, 10, 38, '#d8dcc5');
  rect(c, x - 16, y - 27, 32, 7, '#e9e6cd');
  rect(c, x - 3, y - 43, 6, 17, '#d4f1df');
  rect(c, x - 13, y - 37, 7, 5, '#b8e2d1');
  rect(c, x + 10, y - 38, 5, 9, '#b8e2d1');
}
function flowerbed(c: C, x: number, y: number, w: number) {
  rect(c, x, y, w, 14, '#477342');
  for (let a = 4; a < w - 3; a += 8) {
    rect(c, x + a, y + 3, 4, 4, a % 3 ? '#eebd67' : '#e69a8b');
    rect(c, x + a + 2, y + 9, 3, 3, '#dbde94');
  }
}
function road(
  c: C,
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean,
) {
  rect(c, x - 9, y - 9, w + 18, h + 18, '#b1b2a1');
  rect(c, x - 5, y - 5, w + 10, h + 10, '#d9d3b6');
  rect(c, x, y, w, h, '#777f79');
  rect(c, x, y + 2, w, h - 4, '#858981');
  if (horizontal) {
    for (let a = x + 8; a < x + w; a += 35)
      rect(c, a, y + h / 2 - 1, 16, 2, '#d0c9a1');
  } else {
    for (let a = y + 8; a < y + h; a += 35)
      rect(c, x + w / 2 - 1, a, 2, 16, '#d0c9a1');
  }
}
export function renderGround(c: C, world: World) {
  c.imageSmoothingEnabled = false;
  rect(c, 0, 0, W, H, '#8daf6d');
  const random = rng(world.seed);
  for (let i = 0; i < 12000; i++) {
    const x = Math.floor((random() * W) / 4) * 4,
      y = Math.floor((random() * H) / 4) * 4;
    rect(
      c,
      x,
      y,
      2 + Math.floor(random() * 2) * 2,
      2,
      random() > 0.55 ? '#a0ba793e' : '#527f422c',
    );
  }
  // The river is a tiled, continuous channel with stepped banks.
  for (let y = 0; y < H; y += 16) {
    const x = riverX(y);
    rect(c, x - 126, y, 252, 16, '#6d995a');
    rect(c, x - 114, y, 228, 16, '#c9c796');
    rect(c, x - 105, y, 210, 16, '#72b8b4');
    rect(c, x - 93, y, 186, 16, '#58a5ab');
    rect(c, x - 75, y, 148, 16, '#529da5');
  }
  for (let i = 0; i < 850; i++) {
    const y = Math.floor((random() * H) / 4) * 4,
      x = riverX(y) - 85 + Math.floor((random() * 165) / 4) * 4;
    rect(
      c,
      x,
      y,
      8 + Math.floor(random() * 4) * 4,
      2,
      random() > 0.5 ? '#a7d8c248' : '#316f9425',
    );
  }
  // Block lawns and pedestrian courts.
  const yards = [
    [662, 344, 320, 286],
    [245, 762, 300, 290],
    [671, 758, 315, 292],
    [1788, 745, 352, 687],
    [1085, 355, 203, 264],
  ];
  for (const [x, y, w, h] of yards) {
    rect(c, x, y, w, h, '#b8bd93');
    rect(c, x + 7, y + 7, w - 14, h - 14, '#97af77');
    fence(c, x, y, w, h);
  }
  for (const b of world.buildings) {
    if (b.kind === 'home') {
      rect(c, b.x - 10, b.y - 4, b.w + 20, b.h + 34, '#adc18a');
      rect(c, b.x + b.w / 2 - 6, b.y + b.h, 12, 30, '#dbd1ab');
      flowerbed(c, b.x + 4, b.y + b.h + 7, 19);
    }
  }
  rect(c, 794, 355, 24, 266, '#d2c6a2');
  rect(c, 285, 938, 230, 30, '#c9c4a3');
  rect(c, 702, 940, 250, 20, '#c9c4a3');
  pitch(c, 688, 530, 116, 64);
  rect(c, 842, 535, 102, 61, '#bd866a');
  c.strokeStyle = '#e1caa4';
  c.lineWidth = 2;
  c.strokeRect(849, 542, 88, 47);
  c.strokeRect(892, 542, 1, 47);
  c.beginPath();
  c.arc(893, 565, 11, 0, 7);
  c.stroke();
  pitch(c, 292, 969, 210, 62);
  pitch(c, 723, 965, 211, 63, true);
  rect(c, 1927, 749, 29, 682, '#d7cdad');
  rect(c, 1815, 1070, 298, 25, '#d7cdad');
  fountain(c, 1940, 1020);
  pitch(c, 1840, 1342, 240, 68, true);
  for (let i = 0; i < 4; i++) {
    bench(c, 1820 + i * 83, 1125);
    flowerbed(c, 1822 + i * 82, 1148, 35);
  }
  rect(c, 1098, 550, 176, 48, '#d4cbae');
  fountain(c, 1185, 575);
  // Roads remain connected across all four bridges.
  for (const x of ROAD_X) road(c, x - 23, 42, 46, H - 90, false);
  for (const y of ROAD_Y) road(c, 55, y - 23, W - 110, 46, true);
  for (const y of ROAD_Y)
    for (const x of ROAD_X) {
      rect(c, x - 24, y - 24, 48, 48, '#858981');
      for (let i = -17; i < 20; i += 8) {
        rect(c, x + i, y - 41, 4, 14, '#e2dfc2');
        rect(c, x + i, y + 28, 4, 14, '#e2dfc2');
        rect(c, x - 41, y + i, 14, 4, '#e2dfc2');
        rect(c, x + 28, y + i, 14, 4, '#e2dfc2');
      }
      rect(c, x + 32, y + 32, 5, 14, '#435c4c');
      rect(c, x + 31, y + 29, 7, 8, '#4c7451');
      rect(c, x + 33, y + 30, 3, 3, '#b7d778');
    }
  for (const y of ROAD_Y) {
    const x = riverX(y);
    rect(c, x - 135, y + 30, 275, 15, '#34687860');
    rect(c, x - 132, y - 29, 264, 58, '#b9b6a6');
    rect(c, x - 132, y - 21, 264, 42, '#858981');
    for (let i = -120; i < 130; i += 32)
      rect(c, x + i, y - 1, 15, 2, '#d6caa5');
    for (let i = -126; i < 130; i += 22) {
      rect(c, x + i, y - 37, 6, 15, '#e0d8b7');
      rect(c, x + i, y + 23, 6, 15, '#d3c9a8');
    }
    rect(c, x - 134, y - 32, 268, 5, '#e7debd');
    rect(c, x - 134, y + 29, 268, 5, '#e7debd');
  }
  // Riverside promenade, pocket gardens and street lamps.
  for (let y = 90; y < H - 40; y += 80) {
    const x = riverX(y) + 140;
    if (!isRoad(x, y, 40)) {
      bench(c, x, y);
      flowerbed(c, x + 5, y + 24, 25);
    }
  }
  for (const y of ROAD_Y)
    for (let x = 100; x < W - 60; x += 140) {
      if (isWater(x, y) || ROAD_X.some((rx) => Math.abs(rx - x) < 60)) continue;
      rect(c, x + 3, y - 58, 7, 31, '#647260');
      rect(c, x, y - 63, 12, 8, '#eee4ad');
      rect(c, x + 4, y - 58, 3, 30, '#e0d9b3');
    }
  // Small sailboats are part of the world, with water kept open below them.
  for (const y of [420, 970, 1300]) {
    const x = riverX(y);
    poly(
      c,
      [
        [x - 16, y],
        [x + 17, y],
        [x + 9, y + 13],
        [x - 7, y + 13],
      ],
      '#e7d7ad',
    );
    rect(c, x, y - 28, 3, 35, '#755f48');
    poly(
      c,
      [
        [x + 4, y - 26],
        [x + 4, y - 2],
        [x + 22, y - 2],
      ],
      '#f1e7cc',
    );
  }
}
export function drawBuilding(c: C, b: Building) {
  const { x, y, w, h, height: z, color: v } = b;
  const roof = ROOFS[v],
    dark = DARK[v];
  rect(c, x + 10, y + 10, w + 8, h + 8, '#38594635');
  if (b.kind === 'tower') {
    rect(c, x - 5, y + h - 13, w + 15, 18, '#b4b69b');
    rect(c, x + 10, y - z, w - 20, h + z, '#c6ac79');
    rect(c, x + w - 16, y - z, 12, h + z, '#998561');
    rect(c, x + 5, y - z - 5, w - 10, 12, '#e3cc93');
    rect(c, x + 13, y - z - 37, w - 26, 32, '#59717a');
    rect(c, x + 7, y - z - 22, w - 14, 8, '#435765');
    rect(c, x + 22, y - z - 48, w - 44, 13, '#778687');
    rect(c, x + w / 2 - 2, y - z - 61, 4, 15, '#455f66');
    rect(c, x + 18, y - z + 18, 27, 27, '#f4e5bc');
    rect(c, x + 30, y - z + 22, 3, 12, '#5c6054');
    rect(c, x + 23, y - z + 32, 9, 3, '#5c6054');
    rect(c, x + 26, y + h - 32, 15, 32, '#5b6257');
    return;
  }
  rect(c, x, y, w, h, '#e5d7b3');
  rect(c, x + w - 12, y, 12, h, '#b3ac91');
  rect(c, x, y + h - 6, w, 7, '#b9b49a');
  const floors = b.kind === 'home' ? 1 : Math.max(1, Math.floor(z / 24));
  for (let f = 0; f < floors; f++) {
    const yy = y + 12 + f * 23;
    if (yy > y + h - 16) break;
    for (let xx = x + 12; xx < x + w - 17; xx += 24) {
      rect(c, xx - 2, yy - 2, 14, 17, '#c4bca1');
      rect(c, xx, yy, 10, 12, '#4c7784');
      rect(c, xx, yy, 4, 5, '#a3cad0');
      rect(c, xx - 2, yy + 12, 14, 3, '#f1e0ba');
    }
  }
  rect(c, x + w / 2 - 8, y + h - 28, 17, 27, '#55716e');
  rect(c, x + w / 2 - 7, y + h - 27, 6, 15, '#8eafaa');
  rect(c, x + w / 2 - 15, y + h - 1, 31, 5, '#dcd3b5');
  rect(c, x + w / 2 - 19, y + h + 4, 39, 4, '#cbc4a8');
  // Chunky pitched roofs, laid in pixel stair-steps.
  const roofH = Math.min(z, 42);
  rect(c, x - 7, y - roofH + 9, w + 14, roofH - 2, dark);
  rect(c, x - 3, y - roofH + 3, w + 6, roofH - 4, roof);
  rect(c, x + 5, y - roofH - 3, w - 10, 8, roof);
  rect(c, x + 8, y - roofH - 3, w - 16, 3, '#f1cf8a66');
  for (let yy = y - roofH + 9; yy < y; yy += 8) {
    rect(c, x - 1, yy, w + 2, 2, dark + '70');
    for (let xx = x + 7 + (yy % 16 ? 0 : 6); xx < x + w; xx += 16)
      rect(c, xx, yy - 5, 2, 5, dark + '44');
  }
  rect(c, x - 8, y + 3, w + 16, 5, dark);
  rect(c, x - 6, y + 8, w + 12, 3, '#efd5a677');
  if (b.kind === 'home') {
    rect(c, x + w - 24, y - roofH - 13, 11, 22, '#a9a087');
    rect(c, x + w - 26, y - roofH - 14, 15, 5, '#d1c2a2');
    rect(c, x + 13, y - roofH + 8, 19, 15, '#4a626f');
    rect(c, x + 15, y - roofH + 10, 14, 9, '#8ab1b5');
  } else if (b.kind === 'shop') {
    for (let i = 0; i < w - 12; i += 14)
      rect(c, x + 6 + i, y + h - 27, 14, 10, i % 28 === 0 ? '#e6dabc' : roof);
    rect(c, x + 7, y + h - 15, 26, 10, '#75a3a0');
    rect(c, x + w - 35, y + h - 15, 24, 10, '#75a3a0');
  } else {
    const mx = x + w / 2;
    rect(c, mx - 27, y - roofH - 12, 54, 17, '#e1d8b5');
    poly(
      c,
      [
        [mx - 35, y - roofH - 12],
        [mx, y - roofH - 32],
        [mx + 35, y - roofH - 12],
      ],
      dark,
    );
    rect(c, mx - 3, y - roofH - 17, 6, 8, '#547681');
    if (b.kind === 'hall' || b.kind === 'university') {
      for (let i = -2; i <= 2; i++)
        rect(c, mx + i * 15 - 3, y + h - 44, 6, 38, '#f1e3c0');
      rect(c, mx - 40, y + h - 49, 80, 8, '#ded3b1');
    }
    if (['primary', 'middle', 'high'].includes(b.kind)) {
      rect(c, x + w + 12, y + h - 70, 3, 71, '#e2d9b7');
      rect(c, x + w + 15, y + h - 69, 23, 13, '#d36d53');
    }
  }
}
export function renderObjects(c: C, world: World) {
  const objects = [
    ...world.trees.map((t) => ({ y: t.y, draw: () => drawTree(c, t) })),
    ...world.buildings.map((b) => ({
      y: b.y + b.h,
      draw: () => drawBuilding(c, b),
    })),
  ];
  objects.sort((a, b) => a.y - b.y);
  objects.forEach((o) => o.draw());
}
export function drawAgents(c: C, world: World, time: number) {
  const colors = [
    '#edd294',
    '#d9785b',
    '#6798ba',
    '#e8e3cc',
    '#627b9a',
    '#8d658f',
  ];
  for (const a of world.agents) {
    const x = Math.round(a.x),
      y = Math.round(a.y);
    const horizontal = world.nodes[a.from].y === world.nodes[a.to].y;
    if (a.car) {
      rect(
        c,
        x - 8,
        y - 3,
        horizontal ? 23 : 12,
        horizontal ? 13 : 24,
        '#3b54443b',
      );
      rect(
        c,
        x - 9,
        y - 7,
        horizontal ? 23 : 12,
        horizontal ? 12 : 23,
        colors[a.color],
      );
      rect(
        c,
        x - 3,
        y - 5,
        horizontal ? 10 : 8,
        horizontal ? 8 : 10,
        '#496877',
      );
      if (horizontal) {
        rect(c, x - 5, y - 8, 5, 2, '#404d48');
        rect(c, x + 8, y + 4, 5, 2, '#404d48');
        rect(c, x + 12, y - 4, 2, 6, '#f3dda6');
      } else {
        rect(c, x - 10, y - 3, 2, 5, '#404d48');
        rect(c, x + 2, y + 8, 2, 5, '#404d48');
      }
    } else {
      rect(c, x - 3, y + 4, 9, 3, '#47644955');
      rect(c, x - 3, y - 4, 6, 7, colors[a.color]);
      rect(c, x - 2, y - 8, 4, 4, '#dfb087');
      rect(c, x - 2, y - 10, 4, 3, '#4b5144');
      const walk = Math.floor(time * 6 + a.color) % 2;
      rect(c, x - 3, y + 3, 2, 3 + walk, '#415c59');
      rect(c, x + 1, y + 3, 2, 4 - walk, '#415c59');
    }
  }
}
export function drawNight(c: C, world: World, alpha: number) {
  if (alpha <= 0) return;
  rect(c, 0, 0, W, H, `rgba(21,35,75,${alpha * 0.58})`);
  c.globalAlpha = alpha;
  for (const b of world.buildings) {
    for (let x = b.x + 12; x < b.x + b.w - 17; x += 24) {
      rect(c, x, b.y + 12, 9, 11, '#f5d586');
    }
  }
  for (const y of ROAD_Y)
    for (let x = 100; x < W - 60; x += 140)
      if (!isWater(x, y) && !ROAD_X.some((rx) => Math.abs(rx - x) < 60)) {
        c.fillStyle = '#f7d99024';
        c.beginPath();
        c.arc(x + 6, y - 38, 24, 0, 7);
        c.fill();
        rect(c, x, y - 63, 12, 8, '#ffdf91');
      }
  c.globalAlpha = 1;
}
