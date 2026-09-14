import {
  createWorld,
  ROAD_X,
  ROAD_Y,
  type World,
  type Building,
} from './model';
import { createCampus, type SchoolKind } from './school-model';

export type DayPoint = { x: number; z: number };
export type DayPlace = DayPoint & {
  id: string;
  name: string;
  kind?: SchoolKind;
};
export type DayClassroom = {
  id: string;
  name: string;
  grade_level: number;
  facility_id: string;
  floor: number;
  door: DayPoint;
  entry: DayPoint;
  seat_columns: number;
  student_count: number;
};
export function classroomLayout(studentCount: number) {
  const count = Math.max(1, Math.min(200, Math.trunc(studentCount) || 6));
  const columns = Math.min(12, Math.max(3, Math.ceil(Math.sqrt(count))));
  const right = Math.max(3.5, -11 + (columns - 1) * 4 + 3.5);
  const back = Math.max(7.8, -0.14 + (Math.ceil(count / columns) - 1) * 4 + 4);
  return { count, columns, right, back, aisle: right - 1.3 };
}
export function gradeSchoolPlacement(gradeLevel: number) {
  const grade = Math.max(1, Math.min(12, Math.trunc(gradeLevel) || 5));
  const kind: SchoolKind =
    grade <= 6 ? 'primary' : grade <= 9 ? 'middle' : 'high';
  const facilityId =
    grade === 12
      ? 'senior'
      : grade <= 3 || grade === 7 || grade === 10
        ? 'teaching-a'
        : 'teaching-b';
  const localGrade =
    kind === 'primary' ? grade : kind === 'middle' ? grade - 6 : grade - 9;
  return { grade, kind, facilityId, localGrade };
}
export type SchoolDayWorld = {
  version: 'qinghe-2417-v1';
  seed: number;
  city_units_per_meter: number;
  school: DayPlace;
  grade_level?: number;
  teaching_building?: DayPlace & { entrance: DayPoint };
  classroom?: DayClassroom;
  homes: DayPlace[];
  roads: { nodes: DayPoint[]; edges: number[][] };
  campus_route: DayPoint[];
  classroom_route: DayPoint[];
  home_route: DayPoint[];
  routes: { home_id: string; points: DayPoint[] }[];
  schoolbound_routes?: { home_id: string; points: DayPoint[] }[];
  campus_schoolbound_route?: DayPoint[];
  classroom_entry_route?: DayPoint[];
  home_departure_route?: DayPoint[];
};

/** Street sidewalks and building entrances are expressed in the existing city frame. */
export function createSchoolDayWorld(
  world: World = createWorld(),
  kind: SchoolKind = 'primary',
  gradeLevel: number = kind === 'primary' ? 5 : kind === 'middle' ? 8 : 11,
  studentCount = 6,
): SchoolDayWorld {
  const placement = gradeSchoolPlacement(gradeLevel);
  if (placement.kind !== kind) throw new Error('年级需要对应学段的学校');
  const school = world.buildings.find((b) => b.kind === kind)!;
  const houses = world.buildings.filter((b) => b.kind === 'home');
  const selected = [3, 5, 13, 15, 22, 28].map((i) => houses[i]);
  const entrance = (b: Building): DayPlace => ({
    id: b.id,
    name: b.name,
    x: b.x + b.w / 2,
    z: b.y + b.h + 4,
  });
  const nodes = world.nodes.map((p) => ({ x: p.x - 33, z: p.y - 33 }));
  const edges = world.edges.map((links) => [...links]);
  const schoolPlace = {
    ...entrance(school),
    kind,
    z: ROAD_Y.find((z) => z - 33 > school.y + school.h)! - 33,
  };
  const homes = selected.map(entrance);
  const anchor = (p: DayPoint) => {
    const row = ROAD_Y.findIndex((z) => z - 33 >= p.z);
    if (row < 0) throw new Error('住宅入口需要连接城市街道');
    const at = nodes.length;
    nodes.push({ x: p.x, z: ROAD_Y[row] - 33 });
    edges.push([]);
    let col = ROAD_X.findIndex((x) => x - 33 >= p.x);
    if (col < 0) col = ROAD_X.length - 1;
    for (const c of new Set([Math.max(0, col - 1), col])) {
      const n = row * ROAD_X.length + c;
      edges[at].push(n);
      edges[n].push(at);
    }
    return at;
  };
  const schoolNode = anchor(schoolPlace);
  const routes = homes.map((home) => {
    const goal = anchor(home);
    const dist = Array(nodes.length).fill(Infinity) as number[];
    const previous = Array(nodes.length).fill(-1) as number[];
    const todo = new Set(nodes.map((_, i) => i));
    dist[schoolNode] = 0;
    while (todo.size) {
      const current = [...todo].reduce((a, b) => (dist[a] < dist[b] ? a : b));
      todo.delete(current);
      if (current === goal) break;
      for (const next of edges[current]) {
        const d =
          dist[current] +
          Math.hypot(
            nodes[next].x - nodes[current].x,
            nodes[next].z - nodes[current].z,
          );
        if (d < dist[next]) {
          dist[next] = d;
          previous[next] = current;
        }
      }
    }
    const path = [goal];
    while (path[0] !== schoolNode) {
      if (previous[path[0]] < 0) throw new Error('城市道路未连通');
      path.unshift(previous[path[0]]);
    }
    const points = [schoolPlace, ...path.map((i) => nodes[i]), home].map(
      ({ x, z }) => ({ x, z }),
    );
    return {
      home_id: home.id,
      points: points.filter(
        (p, i) => !i || p.x !== points[i - 1].x || p.z !== points[i - 1].z,
      ),
    };
  });
  const campus = createCampus(kind);
  const teaching = campus.facilities.find(
    (f) => f.id === placement.facilityId,
  )!;
  const academicX = campus.paths.find((p) => p.z === -30 && p.d === 3)!.x;
  const teachingEntrance = {
    x: teaching.x,
    z: teaching.z + teaching.d / 2 + 1,
  };
  const campusRoute =
    placement.facilityId === 'senior'
      ? [
          teachingEntrance,
          { x: teaching.x, z: 54 },
          { x: 0, z: 54 },
          { x: 0, z: 62 },
        ]
      : [
          teachingEntrance,
          { x: teaching.x, z: -30 },
          { x: academicX, z: -30 },
          { x: academicX, z: 0 },
          { x: 0, z: 0 },
          { x: 0, z: 62 },
        ];
  const layout = classroomLayout(studentCount);
  const classroomRoute = [
    { x: layout.aisle, z: 3 },
    { x: layout.aisle, z: layout.back + 1.5 },
  ];
  const homeRoute = [
    { x: 2.8, z: 3 },
    { x: 1.4, z: 2 },
    { x: 0, z: 0.8 },
  ];
  const gradeNames = [
    '',
    '一',
    '二',
    '三',
    '四',
    '五',
    '六',
    '七',
    '八',
    '九',
    '十',
    '十一',
    '十二',
  ];
  return {
    version: 'qinghe-2417-v1',
    seed: world.seed,
    city_units_per_meter: 10,
    school: schoolPlace,
    grade_level: placement.grade,
    teaching_building: {
      id: teaching.id,
      name: teaching.name,
      x: teaching.x,
      z: teaching.z,
      entrance: teachingEntrance,
    },
    classroom: {
      id: `${kind}:grade-${placement.grade}:class-1`,
      name: `${gradeNames[placement.grade]}年级（1）班`,
      grade_level: placement.grade,
      facility_id: teaching.id,
      floor:
        kind === 'primary'
          ? ((placement.grade - 1) % 3) + 1
          : kind === 'middle' && placement.grade === 9
            ? 2
            : 1,
      door: classroomRoute[1],
      entry: classroomRoute[0],
      seat_columns: layout.columns,
      student_count: layout.count,
    },
    homes,
    roads: { nodes, edges },
    routes,
    campus_route: campusRoute,
    classroom_route: classroomRoute,
    home_route: homeRoute,
    schoolbound_routes: routes.map((route) => ({
      home_id: route.home_id,
      points: [...route.points].reverse(),
    })),
    campus_schoolbound_route: [...campusRoute].reverse(),
    classroom_entry_route: [...classroomRoute].reverse(),
    home_departure_route: [...homeRoute].reverse(),
  };
}
