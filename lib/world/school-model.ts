import { rng, type Tool } from './model';

export type SchoolKind = 'primary' | 'middle' | 'high';
export const isSchoolKind = (kind: string): kind is SchoolKind =>
  kind === 'primary' || kind === 'middle' || kind === 'high';
export const SCHOOL_META = {
  primary: {
    name: '青禾小学',
    level: '小学',
    accent: '#efb961',
    capacity: 320,
    seed: 710,
  },
  middle: {
    name: '明德初中',
    level: '初中',
    accent: '#80b9d2',
    capacity: 680,
    seed: 1710,
  },
  high: {
    name: '青河一中',
    level: '高中',
    accent: '#e29179',
    capacity: 960,
    seed: 2710,
  },
};
export type Facility = {
  id: string;
  name: string;
  type:
    | 'building'
    | 'track'
    | 'basketball'
    | 'volleyball'
    | 'play'
    | 'garden'
    | 'gate'
    | 'plaza';
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  description: string;
  rooms: string[];
};
export type CampusItem = {
  id: string;
  type: 'tree' | 'bench';
  x: number;
  z: number;
  added?: boolean;
};
export type Campus = {
  kind: SchoolKind;
  width: number;
  depth: number;
  facilities: Facility[];
  items: CampusItem[];
  paths: { x: number; z: number; w: number; d: number }[];
  time: number;
  elapsed: number;
  nextId: number;
};
type Rect = { x: number; z: number; w: number; d: number };
export function intersects(a: Rect, b: Rect, margin = 0) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin
  );
}
export function createCampus(kind: SchoolKind): Campus {
  const meta = SCHOOL_META[kind];
  const facilities: Facility[] = [];
  function add(
    id: string,
    name: string,
    type: Facility['type'],
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    rooms: string[],
    description: string,
    color = meta.accent,
  ) {
    facilities.push({
      id,
      name,
      type,
      x,
      z,
      w,
      d,
      h,
      rooms,
      description,
      color,
    });
  }
  const primary = kind === 'primary',
    high = kind === 'high';
  const west = kind !== 'middle';
  const fieldX = west ? -42 : 42;
  const academicX = -fieldX;
  const col1 = academicX - 17,
    col2 = academicX + 17;
  add(
    'teaching-a',
    primary
      ? '启智楼 · 一至三年级'
      : high
        ? '致远楼 · 高一年级'
        : '明德楼 · 七年级',
    'building',
    col1,
    -43,
    25,
    13,
    primary ? 9 : 14,
    ['普通教室', '教师办公室', '卫生间', '饮水区'],
    '面向年级教学的主楼，走廊连接教室、备课空间与学生服务设施。',
  );
  add(
    'teaching-b',
    primary
      ? '博学楼 · 四至六年级'
      : high
        ? '笃行楼 · 高二年级'
        : '求知楼 · 八九年级',
    'building',
    col2,
    -43,
    25,
    13,
    primary ? 9 : 14,
    ['普通教室', '小组讨论室', '教师办公室', '卫生间'],
    '以班级教学为中心，设置讨论室与教师备课空间。',
  );
  add(
    'library',
    primary ? '童心图书馆' : '图书馆与自习中心',
    'building',
    col1,
    -17,
    23,
    12,
    8,
    ['借阅大厅', '开放阅览区', '电子阅览室', '安静自习区'],
    '收藏与阅读空间围绕公共阅览厅布置。',
    '#739887',
  );
  add(
    'lab',
    primary ? '科学与创客中心' : high ? '科技实验中心' : '理化生实验楼',
    'building',
    col2,
    -17,
    23,
    12,
    10,
    primary
      ? ['科学教室', '创客工坊', '信息技术教室']
      : [
          '物理实验室',
          '化学实验室',
          '生物实验室',
          '信息技术教室',
          '仪器准备室',
        ],
    '实验与信息技术教学集中布置，配备实验准备和器材储存空间。',
    '#6f92ab',
  );
  add(
    'arts',
    high ? '报告厅与艺术楼' : '艺术与音乐楼',
    'building',
    col1,
    9,
    23,
    12,
    7,
    [
      '音乐教室',
      '美术教室',
      '舞蹈排练室',
      high ? '学术报告厅' : '多功能活动室',
    ],
    '音乐、美术与集体活动的公共教学空间。',
    '#bd817d',
  );
  add(
    'gym',
    '室内体育馆',
    'building',
    col2,
    9,
    25,
    14,
    9,
    ['室内球场', '器材室', '更衣室'],
    '为体育课和校园集体活动提供室内场地。',
    '#628c95',
  );
  add(
    'canteen',
    '学生食堂',
    'building',
    col1,
    35,
    23,
    12,
    6,
    ['就餐大厅', '配餐区', '洗手区', '厨房'],
    '位于校园生活区，连接教学区与公共步道。',
    '#cf9769',
  );
  add(
    'service',
    '行政与健康中心',
    'building',
    col2,
    35,
    23,
    12,
    7,
    ['教师办公室', '医务室', '心理辅导室', '卫生间'],
    '教职工办公与学生健康服务集中设置。',
    '#a393ad',
  );
  add(
    'field',
    primary ? '田径操场与足球场' : '田径场与足球场',
    'track',
    fieldX,
    -25,
    62,
    46,
    0.3,
    ['环形跑道', '足球场', '跳远沙坑', '看台'],
    '环形跑道包围足球场，周边配置看台、沙坑与体育器材。',
    '#b26c5e',
  );
  add(
    'basketball',
    '篮球场',
    'basketball',
    fieldX - 18,
    16,
    25,
    17,
    0.3,
    ['篮球场', '篮球架'],
    '独立划线的室外篮球场。',
    '#618d9b',
  );
  add(
    'volleyball',
    primary ? '综合活动场' : '排球场',
    'volleyball',
    fieldX + 18,
    16,
    25,
    17,
    0.3,
    ['球网', '综合活动区域'],
    '与篮球场相邻的室外活动空间。',
    '#7fa579',
  );
  add(
    primary ? 'playground' : 'dorm',
    primary ? '儿童活动场' : '学生宿舍',
    primary ? 'play' : 'building',
    fieldX - 18,
    41,
    25,
    14,
    primary ? 3 : 11,
    primary ? ['滑梯', '攀爬架', '沙池'] : ['学生寝室', '洗漱间', '生活管理室'],
    primary
      ? '以低矮器械和沙池组成的儿童活动区域。'
      : '面向住宿学生的校园生活设施。',
    '#d8a65d',
  );
  add(
    high ? 'senior' : 'garden',
    high ? '励志楼 · 高三年级' : primary ? '自然观察园' : '生态实践园',
    high ? 'building' : 'garden',
    fieldX + 18,
    41,
    25,
    14,
    high ? 14 : 2,
    high
      ? ['高三教室', '答疑室', '自习室']
      : ['种植池', '植物观察区', '户外课堂'],
    high
      ? '高三教学、自习与教师答疑集中布置。'
      : '为自然观察与劳动实践提供户外教学场所。',
    '#8caf6a',
  );
  add(
    'plaza',
    '升旗广场',
    'plaza',
    0,
    13,
    10,
    20,
    9,
    ['国旗台', '集合区域'],
    '校园中轴线上的升旗与集合场地。',
    '#d4caa9',
  );
  add(
    'gate',
    '校门与门卫室',
    'gate',
    0,
    62,
    20,
    5,
    6,
    ['校门', '门卫室', '访客接待'],
    '校园的主要出入口，与中轴步道相连。',
  );
  const campus: Campus = {
    kind,
    width: 180,
    depth: 140,
    facilities,
    items: [],
    time: 510,
    elapsed: 0,
    nextId: 1,
    paths: [
      { x: 0, z: 0, w: 5, d: 128 },
      ...[-55, 0, 26.5, 54].map((z) => ({ x: 0, z, w: 160, d: 3 })),
      { x: academicX, z: -30, w: 65, d: 3 },
      { x: academicX, z: 0, w: 4, d: 110 },
      { x: -81, z: 0, w: 3, d: 110 },
      { x: 81, z: 0, w: 3, d: 110 },
    ],
  };
  const random = rng(meta.seed);
  for (let x = -84; x <= 84; x += 9)
    for (const z of [-64, 64]) {
      if (Math.abs(x) > 14)
        campus.items.push({
          id: `landscape-${campus.items.length}`,
          type: 'tree',
          x,
          z,
        });
    }
  for (let z = -54; z <= 54; z += 9)
    for (const x of [-86, 86])
      campus.items.push({
        id: `landscape-${campus.items.length}`,
        type: 'tree',
        x,
        z,
      });
  for (let i = 0; i < 18; i++) {
    const x = Math.round(random() * 150 - 75),
      z = Math.round(random() * 110 - 55);
    if (canPlace(campus, 'tree', x, z))
      campus.items.push({
        id: `landscape-${campus.items.length}`,
        type: 'tree',
        x,
        z,
      });
  }
  return campus;
}
export function canPlace(
  campus: Campus,
  type: 'tree' | 'bench',
  x: number,
  z: number,
) {
  const rect = {
    x,
    z,
    w: type === 'tree' ? 4 : 3,
    d: type === 'tree' ? 4 : 1.5,
  };
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) + rect.w / 2 < campus.width / 2 - 3 &&
    Math.abs(z) + rect.d / 2 < campus.depth / 2 - 3 &&
    !campus.facilities.some((f) => intersects(rect, f, 1)) &&
    !campus.paths.some((p) => intersects(rect, p, 0.5)) &&
    !campus.items.some((i) => intersects(rect, { ...i, w: 4, d: 4 }, 0.5))
  );
}
export function editCampus(campus: Campus, tool: Tool, x: number, z: number) {
  x = Math.round(x);
  z = Math.round(z);
  if (tool === 'erase') {
    const index = campus.items.findIndex(
      (i) => i.added && Math.abs(i.x - x) < 3 && Math.abs(i.z - z) < 3,
    );
    if (index < 0) return '请选择你放置的树木或长椅';
    campus.items.splice(index, 1);
    return '已移除';
  }
  if (tool !== 'tree' && tool !== 'home') return '';
  const type = tool === 'tree' ? 'tree' : 'bench';
  if (!canPlace(campus, type, x, z)) return '请在校园空地上放置';
  campus.items.push({
    id: `custom-${campus.nextId++}`,
    type,
    x,
    z,
    added: true,
  });
  return type === 'tree' ? '已种下一棵树' : '已放置一张长椅';
}
