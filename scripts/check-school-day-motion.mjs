import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const output = path.resolve('outputs/school-day-world');
fs.mkdirSync(output, { recursive: true });
const modulePath = path.join(output, 'school-day-motion.mjs');
fs.writeFileSync(
  modulePath,
  ts.transpileModule(
    fs.readFileSync('lib/world/school-day-motion.ts', 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  ).outputText,
);
const { SchoolDayMotionQueue } = await import(pathToFileURL(modulePath));
const student = (scene = 'home', x = 0, z = 0, id = 'student-001') => ({
  id,
  name: '同学',
  location: { scene, place_id: scene, x, z },
  journey: undefined,
});
const segments = [
  [
    'home',
    [
      { x: 0, z: 0 },
      { x: 0, z: 4 },
      { x: 3, z: 4 },
    ],
  ],
  [
    'city',
    [
      { x: 800, z: 400 },
      { x: 800, z: 600 },
      { x: 1200, z: 600 },
      { x: 1200, z: 700 },
    ],
  ],
  [
    'campus',
    [
      { x: 0, z: 70 },
      { x: 0, z: 40 },
      { x: 30, z: 40 },
      { x: 30, z: 10 },
    ],
  ],
  [
    'classroom',
    [
      { x: 12, z: 15 },
      { x: 12, z: 3 },
      { x: -11, z: 3 },
      { x: -11, z: 0 },
    ],
  ],
];
function movements(direction = 'school', day = 1) {
  const route =
    direction === 'school'
      ? segments
      : segments
          .toReversed()
          .map(([scene, points]) => [scene, points.toReversed()]);
  return route.flatMap(([scene, points]) =>
    points.map((point, index) => ({
      kind: 'student_moved',
      student_id: 'student-001',
      day,
      location: { scene, place_id: scene, ...point },
      journey: {
        scene,
        points,
        progress: index / Math.max(1, points.length - 1),
        direction,
      },
    })),
  );
}
const key = (location) => `${location.scene}:${location.x}:${location.z}`;
function drain(queue) {
  const frames = [];
  for (let now = 0; now < 120000; now += 16) {
    const frame = queue.advance(now);
    if (frame) frames.push(structuredClone(frame));
    if (!frame?.moving && queue.queuedSteps === 0) return frames;
  }
  throw new Error('Motion queue did not converge');
}
function assertRoute(frames, events) {
  let cursor = 0;
  for (const event of events) {
    const target = key(event.location);
    while (cursor < frames.length && key(frames[cursor].location) !== target)
      cursor++;
    assert.ok(
      cursor < frames.length,
      `Route endpoint was not presented in order: ${target}`,
    );
  }
  const scenes = frames
    .filter((frame) => frame.moving)
    .map((frame) => frame.location.scene)
    .filter((scene, index, all) => !index || scene !== all[index - 1]);
  const expected = events
    .map((event) => event.location.scene)
    .filter((scene, index, all) => !index || scene !== all[index - 1]);
  assert.deepEqual(scenes, expected);
}
const results = [];
const test = (name, check) => {
  check();
  results.push({ name, passed: true });
};
const outbound = movements(),
  inbound = movements('home');
const classroom = student('classroom', -11, 0),
  home = student();
test('Accumulated live events visit every scene, corner and endpoint', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('run-a', home, []);
  const evidence = JSON.stringify({ outbound, classroom });
  queue.ingest('run-a', classroom, outbound);
  const frames = drain(queue);
  assertRoute(frames, outbound);
  assert.deepEqual(frames.at(-1).location, classroom.location);
  assert.equal(frames.at(-1).moving, false);
  assert.equal(JSON.stringify({ outbound, classroom }), evidence);
});
test('Fractional classroom endpoints retain the exact persisted coordinates', () => {
  const queue = new SchoolDayMotionQueue();
  const points = [{x: -11, z: -0.14}, {x: -11, z: -0.14 + 1.4}, {x: 2.2, z: -0.14 + 1.4}];
  const events = points.map((point, index) => ({
    kind: 'student_moved', student_id: 'student-001', day: 1,
    location: {scene: 'classroom', place_id: 'classroom', ...point},
    journey: {scene: 'classroom', points, progress: index / (points.length - 1), direction: 'home'},
  }));
  queue.replay('fractional-route', home, events, 1);
  const frames = drain(queue);
  assertRoute(frames, events);
  assert.deepEqual(frames.at(-1).location, home.location);
});
test('Newly started run can present events committed before first snapshot', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('new-run', classroom, outbound, true);
  assertRoute(drain(queue), outbound);
});
test('Historical first load remains at current position', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('history', home, [...outbound, ...inbound]);
  assert.equal(queue.queuedSteps, 0);
  assert.deepEqual(queue.advance(0).location, home.location);
  assert.equal(queue.frame.moving, false);
});
test('Duplicate snapshots do not enqueue duplicate movement', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('run-a', home, []);
  queue.ingest('run-a', classroom, outbound);
  const count = queue.queuedSteps;
  queue.ingest('run-a', classroom, outbound);
  assert.equal(queue.queuedSteps, count);
  assertRoute(drain(queue), outbound);
});
test('Run identity changes clear the previous student movement', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('run-a', classroom, outbound, true);
  queue.advance(0);
  queue.ingest('run-b', home, []);
  assert.equal(queue.queuedSteps, 0);
  assert.equal(queue.frame.identity, 'run-b:student-001');
  assert.deepEqual(queue.advance(16).location, home.location);
});
test('Student changes clear the previous movement', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('run-a', classroom, outbound, true);
  queue.advance(0);
  const next = student('home', 9, 8, 'student-002');
  queue.ingest('run-a', next, outbound);
  assert.equal(queue.queuedSteps, 0);
  assert.equal(queue.frame.identity, 'run-a:student-002');
  assert.deepEqual(queue.advance(16).location, next.location);
});
test('Return journey presents classroom, campus, city and home in order', () => {
  const queue = new SchoolDayMotionQueue();
  queue.ingest('run-a', classroom, outbound);
  queue.ingest('run-a', home, [...outbound, ...inbound]);
  const frames = drain(queue);
  assertRoute(frames, inbound);
  assert.deepEqual(frames.at(-1).location, home.location);
});
test('Day replay selects persisted events and returns to current state', () => {
  const queue = new SchoolDayMotionQueue();
  const firstDay = [...outbound, ...inbound];
  const events = [
    ...firstDay,
    ...movements('school', 2),
    ...movements('home', 2),
  ];
  queue.replay('history', home, events, 1);
  assert.equal(queue.queuedSteps, firstDay.length);
  queue.ingest('history', home, events);
  const frames = drain(queue);
  assertRoute(frames, firstDay);
  assert.ok(frames.some((frame) => frame.replaying));
  assert.equal(frames.at(-1).replaying, false);
  assert.deepEqual(frames.at(-1).location, home.location);
});
test('Replay can be stopped at current state', () => {
  const queue = new SchoolDayMotionQueue();
  const events = [...outbound, ...inbound];
  queue.replay('history', home, events, 1);
  queue.advance(0);
  queue.clear();
  queue.ingest('history', home, events);
  assert.equal(queue.queuedSteps, 0);
  assert.equal(queue.frame.replaying, false);
  assert.deepEqual(queue.advance(16).location, home.location);
});
fs.writeFileSync(
  path.join(output, 'motion-report.json'),
  JSON.stringify({ passed: true, checks: results.length, results }, null, 2) +
    '\n',
);
console.log(`School day motion: ${results.length} checks passed`);

const snapshotIndex = process.argv.indexOf('--snapshot');
if (snapshotIndex !== -1) {
  const snapshotPath = process.argv[snapshotIndex + 1];
  assert.ok(
    snapshotPath && !snapshotPath.startsWith('--'),
    '--snapshot requires a JSON file path',
  );
  const bytes = fs.readFileSync(snapshotPath);
  const payload = JSON.parse(bytes);
  const state = payload.state || payload;
  const requireRoundTrip = process.argv.includes('--require-round-trip');
  if (requireRoundTrip)
    assert.equal(
      state.status,
      'complete',
      'Round-trip acceptance requires a complete run',
    );
  const days = requireRoundTrip
    ? Array.from(
        {
          length:
            state.settings?.days ||
            state.grade_setup?.days ||
            state.days ||
            state.day ||
            1,
        },
        (_, index) => index + 1,
      )
    : [
        ...new Set(
          state.events
            .filter((event) => event.kind === 'student_moved')
            .map((event) => event.day ?? 1),
        ),
      ];
  const checks = [];
  for (const pupil of state.students) {
    const initial = new SchoolDayMotionQueue();
    initial.ingest(state.run_id, pupil, state.events);
    assert.equal(
      initial.queuedSteps,
      0,
      'A persisted run must open at current state',
    );
    assert.deepEqual(initial.advance(0).location, pupil.location);
    for (const day of days) {
      const events = state.events.filter(
        (event) =>
          event.kind === 'student_moved' &&
          event.student_id === pupil.id &&
          (event.day ?? 1) === day,
      );
      if (requireRoundTrip) {
        for (const { direction, expectedScenes } of [
          {
            direction: 'school',
            expectedScenes: ['home', 'city', 'campus', 'classroom'],
          },
          {
            direction: 'home',
            expectedScenes: ['classroom', 'campus', 'city', 'home'],
          },
        ]) {
          const scenes = events
            .filter((event) => event.journey?.direction === direction)
            .map((event) => event.location.scene)
            .filter((scene, index, all) => !index || scene !== all[index - 1]);
          assert.deepEqual(
            scenes,
            expectedScenes,
            `${pupil.id} day ${day} ${direction} scenes`,
          );
        }
      }
      const queue = new SchoolDayMotionQueue();
      queue.replay(state.run_id, pupil, state.events, day);
      const frames = drain(queue);
      assertRoute(frames, events);
      assert.equal(queue.frame.moving, false);
      assert.deepEqual(queue.frame.location, pupil.location);
      checks.push({
        student_id: pupil.id,
        day,
        event_count: events.length,
        endpoints_verified: events.length,
        scenes: frames
          .filter((frame) => frame.moving)
          .map((frame) => frame.location.scene)
          .filter((scene, index, all) => !index || scene !== all[index - 1]),
        passed: true,
      });
    }
  }
  const report = {
    run_id: state.run_id,
    status: state.status,
    source_sha256: createHash('sha256').update(bytes).digest('hex'),
    require_round_trip: requireRoundTrip,
    checks,
    passed: true,
  };
  const reportPath = path.join(output, `motion-run-${state.run_id}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `Persisted motion: ${checks.length} student-day checks passed (${reportPath})`,
  );
}
