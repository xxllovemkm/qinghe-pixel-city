import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';
const directory = path.resolve('outputs/3d-check');
fs.mkdirSync(directory, { recursive: true });
for (const name of ['model', 'geometry3d']) {
  let source = fs
    .readFileSync(`lib/world/${name}.ts`, 'utf8')
    .replace("from './model'", "from './model.mjs'");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  fs.writeFileSync(path.join(directory, `${name}.mjs`), output);
}
const model = await import(pathToFileURL(path.join(directory, 'model.mjs')));
const geometry = await import(
  pathToFileURL(path.join(directory, 'geometry3d.mjs'))
);
const world = model.createWorld(),
  city = geometry.buildCityGeometry(world);
assert.equal(city.buildingCount, world.buildings.length);
const parts = city.solids.userData.parts,
  raycaster = new THREE.Raycaster();
for (const b of world.buildings) {
  const objects = parts.filter((p) => p.id === b.id);
  assert.ok(objects.length > 8, `${b.name} has no solid model`);
  const bounds = new THREE.Box3();
  for (const p of objects)
    bounds.union(
      new THREE.Box3(
        new THREE.Vector3(p.x - p.w / 2, p.y - p.h / 2, p.z - p.d / 2),
        new THREE.Vector3(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2),
      ),
    );
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 3 && size.y > 5 && size.z > 3, `${b.name} is flat`);
  raycaster.set(
    new THREE.Vector3(
      geometry.toX(b.x + b.w / 2),
      80,
      geometry.toZ(b.y + b.h / 2),
    ),
    new THREE.Vector3(0, -1, 0),
  );
  const hit = raycaster.intersectObject(city.solids)[0];
  assert.equal(parts[hit.instanceId].id, b.id, `3D picking missed ${b.name}`);
}
assert.ok(city.water.position.y < 0, 'River is not below land');
for (const y of model.ROAD_Y) {
  raycaster.set(
    new THREE.Vector3(geometry.toX(model.riverX(y)), 30, geometry.toZ(y)),
    new THREE.Vector3(0, -1, 0),
  );
  const hit = raycaster.intersectObject(city.solids)[0];
  assert.ok(
    hit.point.y > 0 && hit.point.y < 1,
    'Bridge does not cross above water',
  );
}
for (const [x, y] of [
  [0, 0],
  [2400, 1700],
  [802, 543],
])
  assert.deepEqual(
    geometry.fromXZ({ x: geometry.toX(x), z: geometry.toZ(y) }),
    { x, y },
  );
const camera = new THREE.PerspectiveCamera(38, 1.6, 0.2, 1400);
camera.position.set(155, 195, 215);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const p = new THREE.Vector3(-50, 10, 20),
  before = p.clone().project(camera);
camera.position.set(-215, 195, 155);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const after = p.clone().project(camera);
assert.ok(
  before.distanceTo(after) > 0.1,
  'Camera rotation does not change perspective',
);
for (const aspect of [16 / 9, 4 / 3, 0.55]) {
  const overview = new THREE.PerspectiveCamera(38, aspect, 0.2, 3000);
  overview.position
    .copy(geometry.OVERVIEW_DIRECTION)
    .multiplyScalar(geometry.overviewDistance(aspect));
  overview.lookAt(0, 0, 0);
  overview.updateMatrixWorld();
  for (const x of [-120, 120])
    for (const z of [-85, 85])
      for (const y of [-5, 20]) {
        const p = new THREE.Vector3(x, y, z).project(overview);
        assert.ok(
          Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85,
          'Overview cuts off the city',
        );
      }
}
const agents = geometry.createAgentMeshes(world),
  first = Array.from(agents.mesh.instanceMatrix.array);
model.updateAgents(world, 1);
agents.update(1);
assert.notDeepEqual(
  Array.from(agents.mesh.instanceMatrix.array),
  first,
  '3D agents do not move',
);
assert.ok(
  Array.from(agents.mesh.instanceMatrix.array).every(Number.isFinite),
  'Invalid actor transforms',
);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      solidVoxels: parts.length,
      illuminatedVoxels: city.windows.count,
      buildingsWithVolumeAndPicking: world.buildings.length,
      bridgesAboveRiver: model.ROAD_Y.length,
      moving3DInstances: agents.mesh.count,
      checks: [
        'every building has width, height, depth',
        'all 47 models ray-pick correctly',
        '4 solid bridges cross recessed water',
        'map coordinates round-trip',
        'perspective changes with camera orbit',
        '3D residents and vehicles move',
      ],
    },
    null,
    2,
  ),
);
geometry.disposeGeometry(city);
agents.dispose();
