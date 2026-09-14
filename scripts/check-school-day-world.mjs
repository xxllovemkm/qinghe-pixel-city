import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';

const output = path.resolve('outputs/school-day-world');
fs.mkdirSync(output, { recursive: true });
for (const name of [
  'model',
  'geometry3d',
  'school-model',
  'school-day-world',
  'day-actors3d',
]) {
  const source = fs
    .readFileSync(`lib/world/${name}.ts`, 'utf8')
    .replace(/from ["']\.\/(.*?)["']/g, "from './$1.mjs'");
  fs.writeFileSync(
    path.join(output, `${name}.mjs`),
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const { createWorld, isWater, ROAD_Y } = await import(
  pathToFileURL(path.join(output, 'model.mjs'))
);
const { createCampus } = await import(
  pathToFileURL(path.join(output, 'school-model.mjs'))
);
const { createSchoolDayWorld, classroomLayout } = await import(
  pathToFileURL(path.join(output, 'school-day-world.mjs'))
);
const { createDayActors } = await import(
  pathToFileURL(path.join(output, 'day-actors3d.mjs'))
);
const { toX, toZ } = await import(
  pathToFileURL(path.join(output, 'geometry3d.mjs'))
);
const city = createWorld();
const world = createSchoolDayWorld(city);
assert.deepEqual(world, createSchoolDayWorld(createWorld()));
assert.equal(
  world.school.id,
  city.buildings.find((b) => b.kind === 'primary').id,
);
assert.equal(new Set(world.homes.map((home) => home.id)).size, 6);
const sample = (points, check) => {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let step = 0; step <= count; step++)
      check({
        x: a.x + ((b.x - a.x) * step) / count,
        z: a.z + ((b.z - a.z) * step) / count,
      });
  }
};
const results = [];
for (const route of world.routes) {
  const home = world.homes.find((home) => home.id === route.home_id);
  assert.ok(
    city.buildings.some(
      (building) => building.kind === 'home' && building.id === home.id,
    ),
  );
  assert.deepEqual(route.points[0], { x: world.school.x, z: world.school.z });
  assert.deepEqual(route.points.at(-1), { x: home.x, z: home.z });
  sample(route.points, (point) => {
    assert.ok(
      !city.buildings.some(
        (building) =>
          point.x > building.x &&
          point.x < building.x + building.w &&
          point.z > building.y &&
          point.z < building.y + building.h,
      ),
      `${home.id}: route intersects a building`,
    );
    assert.ok(
      !isWater(point.x, point.z) ||
        ROAD_Y.some((y) => Math.abs(y - point.z) <= 40),
      `${home.id}: river crossing must use an existing bridge`,
    );
  });
  const length = route.points
    .slice(1)
    .reduce(
      (total, point, i) =>
        total +
        Math.hypot(point.x - route.points[i].x, point.z - route.points[i].z),
      0,
    );
  assert.ok(length > 0);
  results.push({
    home_id: home.id,
    name: home.name,
    waypoints: route.points.length,
    meters: length / world.city_units_per_meter,
  });
}
const campus = createCampus('primary');
const gate = campus.facilities.find((facility) => facility.id === 'gate');
assert.deepEqual(world.campus_route.at(-1), { x: gate.x, z: gate.z });
sample(world.campus_route, (point) => {
  assert.ok(
    !campus.facilities
      .filter((facility) => facility.type === 'building')
      .some(
        (facility) =>
          point.x > facility.x - facility.w / 2 &&
          point.x < facility.x + facility.w / 2 &&
          point.z > facility.z - facility.d / 2 &&
          point.z < facility.z + facility.d / 2,
      ),
    'Campus route intersects a building',
  );
});
const schoolVariants = [];
for (const kind of ['primary', 'middle', 'high']) {
  const map = createSchoolDayWorld(city, kind),
    school = city.buildings.find((building) => building.kind === kind),
    campus = createCampus(kind);
  assert.equal(map.school.id, school.id);
  assert.equal(map.school.name, school.name);
  for (const route of map.routes)
    sample(route.points, (p) =>
      assert.ok(
        !city.buildings.some(
          (b) => p.x > b.x && p.x < b.x + b.w && p.z > b.y && p.z < b.y + b.h,
        ),
        `${kind}: home route crosses a building`,
      ),
    );
  sample(map.campus_route, (p) =>
    assert.ok(
      !campus.facilities
        .filter((f) => f.type === 'building')
        .some(
          (f) =>
            p.x > f.x - f.w / 2 &&
            p.x < f.x + f.w / 2 &&
            p.z > f.z - f.d / 2 &&
            p.z < f.z + f.d / 2,
        ),
      `${kind}: campus route crosses a building`,
    ),
  );
  schoolVariants.push({
    kind,
    id: school.id,
    name: school.name,
    routes: map.routes.length,
  });
  fs.writeFileSync(
    path.join(output, `world-${kind}.json`),
    JSON.stringify(map, null, 2),
  );
}
const gradeWorlds = {};
for (let grade = 1; grade <= 12; grade++) {
  const kind = grade <= 6 ? 'primary' : grade <= 9 ? 'middle' : 'high';
  const map = createSchoolDayWorld(city, kind, grade);
  const campus = createCampus(kind);
  const facilityId =
    grade === 12
      ? 'senior'
      : grade <= 3 || grade === 7 || grade === 10
        ? 'teaching-a'
        : 'teaching-b';
  const teaching = campus.facilities.find((f) => f.id === facilityId);
  assert.equal(map.teaching_building.id, facilityId);
  assert.equal(map.teaching_building.name, teaching.name);
  assert.equal(map.classroom.id, `${kind}:grade-${grade}:class-1`);
  assert.equal(map.classroom.facility_id, facilityId);
  assert.equal(map.classroom.grade_level, grade);
  assert.equal(
    map.classroom.floor,
    grade <= 6 ? ((grade - 1) % 3) + 1 : grade === 9 ? 2 : 1,
  );
  assert.deepEqual(map.campus_route[0], map.teaching_building.entrance);
  assert.deepEqual(map.campus_route.at(-1), { x: 0, z: 62 });
  assert.deepEqual(
    map.campus_schoolbound_route,
    [...map.campus_route].reverse(),
  );
  assert.deepEqual(
    map.classroom_entry_route,
    [...map.classroom_route].reverse(),
  );
  assert.deepEqual(map.home_departure_route, [...map.home_route].reverse());
  for (const route of map.routes) {
    assert.deepEqual(
      map.schoolbound_routes.find((r) => r.home_id === route.home_id).points,
      [...route.points].reverse(),
    );
  }
  sample(map.campus_route, (p) =>
    assert.ok(
      !campus.facilities
        .filter((f) => f.type === 'building')
        .some(
          (f) =>
            p.x > f.x - f.w / 2 &&
            p.x < f.x + f.w / 2 &&
            p.z > f.z - f.d / 2 &&
            p.z < f.z + f.d / 2,
        ),
      `grade ${grade}: teaching route crosses a building`,
    ),
  );
  for (const count of [1, 6, 50, 200]) {
    const sized = createSchoolDayWorld(city, kind, grade, count),
      layout = classroomLayout(count);
    assert.equal(sized.classroom.student_count, count);
    assert.equal(sized.classroom.seat_columns, layout.columns);
    assert.ok(
      sized.classroom.door.z >
        -0.14 + (Math.ceil(count / layout.columns) - 1) * 4,
    );
    assert.ok(sized.classroom.entry.x > -11 + (layout.columns - 1) * 4 + 1);
  }
  gradeWorlds[grade] = map;
}
assert.equal(
  new Set(Object.values(gradeWorlds).map((map) => map.classroom.id)).size,
  12,
);
fs.writeFileSync(
  path.join(output, 'grade_worlds.json'),
  JSON.stringify(gradeWorlds, null, 2),
);
const bend = [
  { x: 808, z: 637 },
  { x: 557, z: 637 },
  { x: 557, z: 1057 },
];
const student = {
  id: 'test-student',
  name: '同学',
  color: '#678e71',
  home_building_id: world.homes[0].id,
  location: { scene: 'city', place_id: world.homes[0].id, ...bend[0] },
  journey: { points: bend, progress: 0 },
};
const actors = createDayActors(new THREE.Scene(), 'city', {
  students: () => [student],
  selected: () => student.id,
  simTime: () => 960,
  onSelect() {},
});
actors.update(1 / 60, 0);
student.location = { ...student.location, ...bend[2] };
student.journey.progress = 1;
for (let tick = 1; tick <= 90; tick++) {
  actors.update(1 / 60, tick / 60);
  const point = actors.position(student.id);
  assert.ok(
    Math.abs(point.z - toZ(637)) < 0.001 ||
      Math.abs(point.x - toX(557)) < 0.001,
    'A missed snapshot must preserve the road corner during interpolation',
  );
}
assert.ok(
  actors
    .position(student.id)
    .distanceTo(new THREE.Vector3(toX(557), 0.15, toZ(1057))) < 0.05,
);
actors.dispose();
const classroomScene = new THREE.Scene();
const room = gradeWorlds[5].classroom;
const pupils = [
  {
    ...student,
    id: 'same-room',
    classroom_id: room.id,
    location: { scene: 'classroom', classroom_id: room.id, x: 0, z: 0 },
  },
  {
    ...student,
    id: 'other-room',
    classroom_id: gradeWorlds[4].classroom.id,
    location: {
      scene: 'classroom',
      classroom_id: gradeWorlds[4].classroom.id,
      x: 0,
      z: 0,
    },
  },
];
const classroomActors = createDayActors(classroomScene, 'classroom', {
  students: () => pupils,
  selected: () => pupils[0].id,
  simTime: () => 510,
  classroomId: () => room.id,
  onSelect() {},
});
classroomActors.update(1 / 60, 0);
assert.ok(classroomActors.position('same-room'));
assert.equal(classroomActors.position('other-room'), undefined);
classroomActors.dispose();
fs.writeFileSync(
  path.join(output, 'world.json'),
  JSON.stringify(world, null, 2),
);
fs.writeFileSync(
  path.join(output, 'report.json'),
  JSON.stringify(
    {
      status: 'passed',
      seed: city.seed,
      school: world.school.id,
      city_routes: results,
      school_variants: schoolVariants,
      grades: Object.values(gradeWorlds).map((map) => ({
        grade: map.grade_level,
        school: map.school.id,
        facility: map.teaching_building.id,
        classroom: map.classroom.id,
        floor: map.classroom.floor,
      })),
      campus_waypoints: world.campus_route.length,
      checks: [
        'deterministic building identities',
        'six existing residential entrances',
        'continuous route endpoints',
        'building clearance',
        'bridge crossings',
        'campus teaching building to gate',
        'interpolation preserves road turns after missed snapshots',
        'three school stages reuse existing schools and roads',
        'twelve grades bind existing teaching facilities and distinct classrooms',
        'home to school and school to home preserve all reverse path endpoints',
        'classroom door and aisle scale from 1 to 200 students',
        'classroom actors respect room identities',
      ],
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ status: 'passed', routes: results }, null, 2));
