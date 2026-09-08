import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';
import { pathToFileURL } from 'node:url';
const dir = path.resolve('outputs/school-check');
fs.mkdirSync(dir, { recursive: true });
for (const name of ['model', 'geometry3d', 'school-model', 'school-geometry']) {
  const source = fs
    .readFileSync(`lib/world/${name}.ts`, 'utf8')
    .replace(/from '\.\/(.*?)'/g, "from './$1.mjs'");
  fs.writeFileSync(
    path.join(dir, name + '.mjs'),
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const model = await import(pathToFileURL(path.join(dir, 'school-model.mjs'))),
  geo = await import(pathToFileURL(path.join(dir, 'school-geometry.mjs')));
const reports = [];
for (const kind of ['primary', 'middle', 'high']) {
  const campus = model.createCampus(kind),
    original = structuredClone(campus);
  assert.deepEqual(campus, model.createCampus(kind));
  for (const id of [
    'teaching-a',
    'teaching-b',
    'library',
    'lab',
    'arts',
    'gym',
    'canteen',
    'service',
    'field',
    'basketball',
    'volleyball',
    'plaza',
    'gate',
  ])
    assert.ok(
      campus.facilities.some((f) => f.id === id),
      `${kind}: missing ${id}`,
    );
  for (const f of campus.facilities) {
    assert.ok(
      Math.abs(f.x) + f.w / 2 < 90 && Math.abs(f.z) + f.d / 2 < 70,
      `${kind} ${f.name} outside campus`,
    );
    for (const other of campus.facilities)
      if (other !== f)
        assert.ok(
          !model.intersects(f, other),
          `${kind}: ${f.name} overlaps ${other.name}`,
        );
    if (f.type === 'building')
      for (const p of campus.paths)
        assert.ok(
          !model.intersects(f, p),
          `${kind}: path intersects ${f.name}`,
        );
  }
  const scene = geo.buildSchoolGeometry(campus),
    ray = new THREE.Raycaster(),
    parts = scene.solids.userData.parts;
  for (const f of campus.facilities.filter((f) => f.type === 'building')) {
    ray.set(new THREE.Vector3(f.x, 80, f.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(scene.solids)[0];
    assert.equal(parts[hit.instanceId].id, f.id, `${kind}: picking ${f.name}`);
    const bound = new THREE.Box3();
    for (const p of parts.filter((p) => p.id === f.id))
      bound.union(
        new THREE.Box3(
          new THREE.Vector3(p.x - p.w / 2, p.y - p.h / 2, p.z - p.d / 2),
          new THREE.Vector3(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2),
        ),
      );
    assert.ok(bound.max.y > 5);
  }
  for (let t = 0; t < 500; t += 3)
    for (let i = 0; i < 38; i++) {
      const p = geo.studentPosition(campus, i, t);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
      for (const f of campus.facilities.filter((f) => f.type === 'building'))
        assert.ok(
          !model.intersects({ ...p, w: 0.8, d: 0.8 }, f),
          `${kind}: student crosses ${f.name}`,
        );
    }
  model.editCampus(
    campus,
    'home',
    campus.facilities[0].x,
    campus.facilities[0].z,
  );
  assert.equal(campus.items.length, original.items.length);
  let empty;
  for (let x = -83; x < 83 && !empty; x += 2)
    for (let z = -62; z < 62; z += 2)
      if (model.canPlace(campus, 'bench', x, z)) {
        empty = { x, z };
        break;
      }
  assert.ok(empty);
  assert.equal(
    model.editCampus(campus, 'home', empty.x, empty.z),
    '已放置一张长椅',
  );
  assert.equal(campus.items.length, original.items.length + 1);
  assert.equal(model.editCampus(campus, 'erase', empty.x, empty.z), '已移除');
  assert.equal(campus.items.length, original.items.length);
  model.editCampus(campus, 'erase', campus.items[0].x, campus.items[0].z);
  assert.equal(campus.items.length, original.items.length);
  reports.push({
    kind,
    facilities: campus.facilities.length,
    buildings: campus.facilities.filter((f) => f.type === 'building').length,
    voxels: scene.solids.count + scene.windows.count,
  });
  geo.disposeSchoolGeometry(scene.root);
}
for (const aspect of [16 / 9, 4 / 3, 0.49]) {
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 2000);
  camera.position
    .copy(geo.CAMPUS_DIRECTION)
    .multiplyScalar(geo.campusDistance(aspect));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  for (const x of [-90, 90])
    for (const z of [-70, 70])
      for (const y of [-3, 19]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(
          Math.abs(p.x) < 0.85 && Math.abs(p.y) < 0.81,
          'campus outside overview',
        );
      }
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      campuses: reports,
      checks: [
        'facilities and paths do not overlap',
        'all teaching buildings have volume and ray picking',
        '38 students stay outside buildings over 500 simulated seconds',
        'valid and invalid placement',
        'erase preserves original landscaping',
        'desktop and mobile overview framing',
      ],
    },
    null,
    2,
  ),
);
