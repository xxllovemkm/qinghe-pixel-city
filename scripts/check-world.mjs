import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const src = fs.readFileSync('lib/world/model.ts', 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { createWorld, updateAgents, place, overlaps, isRoad, isWater, W, H } =
  await import(
    'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  );
const world = createWorld();
assert.deepEqual(createWorld(), world, 'Seed must reproduce the same city');
for (const kind of [
  'primary',
  'middle',
  'high',
  'university',
  'home',
  'hall',
  'tower',
  'library',
])
  assert.ok(
    world.buildings.some((b) => b.kind === kind),
    'Missing ' + kind,
  );
for (const b of world.buildings) {
  assert.ok(
    b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H,
    'Building outside map: ' + b.name,
  );
  for (const other of world.buildings)
    if (b !== other)
      assert.ok(
        !overlaps(b, other),
        'Buildings overlap: ' + b.name + ' / ' + other.name,
      );
  for (let x = b.x; x <= b.x + b.w; x += 4)
    for (let y = b.y; y <= b.y + b.h; y += 4) {
      assert.ok(!isRoad(x, y), 'Building on road: ' + b.name);
      assert.ok(!isWater(x, y), 'Building in river: ' + b.name);
    }
}
const visited = new Set([0]),
  queue = [0];
while (queue.length) {
  for (const n of world.edges[queue.shift()])
    if (!visited.has(n)) {
      visited.add(n);
      queue.push(n);
    }
}
assert.equal(visited.size, world.nodes.length, 'Road network disconnected');
for (let i = 0; i < 6000; i++) {
  updateAgents(world, 1 / 60);
  for (const a of world.agents) {
    assert.ok(
      Number.isFinite(a.x) && Number.isFinite(a.y),
      'Agent position invalid',
    );
    assert.ok(isRoad(a.x, a.y, 12), 'Agent left street/sidewalk');
  }
}
const originalBuildings = world.buildings.length;
place(world, 'home', 180, 260);
assert.equal(
  world.buildings.length,
  originalBuildings,
  'Allowed building on intersection',
);
place(world, 'home', 1390, 900);
assert.equal(
  world.buildings.length,
  originalBuildings,
  'Allowed building in river',
);
let good;
for (let x = 48; x < W - 48 && !good; x += 16)
  for (let y = 48; y < H - 48; y += 16) {
    if (place(world, 'home', x, y).startsWith('新住宅')) {
      good = { x, y };
      break;
    }
  }
assert.ok(good, 'No buildable land');
assert.equal(world.buildings.length, originalBuildings + 1);
place(world, 'home', good.x, good.y);
assert.equal(
  world.buildings.length,
  originalBuildings + 1,
  'Overlapping build accepted',
);
assert.equal(place(world, 'erase', good.x, good.y), '已移除房屋');
assert.equal(world.buildings.length, originalBuildings);
const existing = world.buildings[0];
place(world, 'erase', existing.x + 10, existing.y + 20);
assert.equal(
  world.buildings.length,
  originalBuildings,
  'Erased original world',
);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      buildings: world.buildings.length,
      trees: world.trees.length,
      agents: world.agents.length,
      connectedRoadNodes: visited.size,
      simulatedSeconds: 100,
      checks: [
        'deterministic seed',
        'all requested building types',
        'building separation',
        'roads and river protected',
        'connected road graph',
        '180 moving agents remain on streets',
        'valid and invalid construction',
        'erase preserves original city',
      ],
    },
    null,
    2,
  ),
);
