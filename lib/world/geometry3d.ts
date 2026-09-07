import * as THREE from 'three';
import {
  W,
  H,
  ROAD_X,
  ROAD_Y,
  riverX,
  isWater,
  isRoad,
  rng,
  type World,
  type Building,
  type Tree,
} from './model';
export const SCALE = 0.1;
export const toX = (x: number) => (x - W / 2) * SCALE;
export const toZ = (y: number) => (y - H / 2) * SCALE;
export const fromXZ = (v: { x: number; z: number }) => ({
  x: v.x / SCALE + W / 2,
  y: v.z / SCALE + H / 2,
});
export const OVERVIEW_DIRECTION = new THREE.Vector3(155, 195, 215).normalize();
export function overviewDistance(aspect: number) {
  const right = new THREE.Vector3(
    OVERVIEW_DIRECTION.z,
    0,
    -OVERVIEW_DIRECTION.x,
  ).normalize();
  const up = OVERVIEW_DIRECTION.clone().cross(right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(38 / 2));
  let distance = 250;
  for (const x of [(-W * SCALE) / 2, (W * SCALE) / 2])
    for (const z of [(-H * SCALE) / 2, (H * SCALE) / 2])
      for (const y of [-5, 20]) {
        const p = new THREE.Vector3(x, y, z);
        distance = Math.max(
          distance,
          p.dot(OVERVIEW_DIRECTION) +
            Math.max(
              Math.abs(p.dot(right)) / (tangent * aspect * 0.88),
              Math.abs(p.dot(up)) / (tangent * 0.83),
            ),
        );
      }
  return distance;
}
export function buildingHeight(b: Building) {
  return b.kind === 'tower'
    ? 29
    : b.kind === 'home'
      ? b.height * 0.14 + 2
      : b.height * 0.15 + 3;
}
export function surfaceHeight(x: number, y: number) {
  return isWater(x, y) && ROAD_Y.some((ry) => Math.abs(y - ry) < 40)
    ? 0.16
    : 0.03;
}
type Voxel = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  id?: string;
};
class Voxels {
  parts: Voxel[] = [];
  glow: Voxel[] = [];
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    id?: string,
    lit = false,
  ) {
    (lit ? this.glow : this.parts).push({ x, y, z, w, h, d, color, id });
  }
  build(root: THREE.Group, emissive = false) {
    const parts = emissive ? this.glow : this.parts;
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0,
      emissive: emissive ? 0xffca69 : 0,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      mat,
      parts.length,
    );
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    parts.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = !emissive;
    mesh.receiveShadow = true;
    mesh.userData.parts = parts;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  }
}
const roofs = ['#c76c54', '#5b8196', '#d3a255', '#5f8e7e', '#986a85'];
const pale = ['#f0dfb8', '#e1e7d1', '#f4d695', '#dbddbe', '#e3d4d2'];
function building(v: Voxels, b: Building) {
  const x = toX(b.x + b.w / 2),
    z = toZ(b.y + b.h / 2),
    w = b.w * SCALE,
    d = b.h * SCALE,
    h = buildingHeight(b),
    id = b.id,
    roof = roofs[b.color];
  const box = (
    dx: number,
    y: number,
    dz: number,
    a: number,
    c: number,
    e: number,
    color: string,
    lit = false,
  ) => v.box(x + dx, y, z + dz, a, c, e, color, id, lit);
  box(0, 0.18, 0, w + 0.65, 0.36, d + 0.65, '#bdbba1');
  if (b.kind === 'tower') {
    box(0, 12, 0, w * 0.68, 24, d * 0.68, '#caba92');
    box(0, 1, 0, w + 1, 1.6, d + 1, '#b4af96');
    for (const yy of [3, 10, 18, 23.5])
      box(0, yy, 0, w * 0.8, 0.55, d * 0.8, '#ece0b8');
    for (let i = 0; i < 5; i++)
      box(
        0,
        25 + i * 0.85,
        0,
        w * 0.95 - i * 0.8,
        0.85,
        d * 0.95 - i * 0.8,
        roof,
      );
    box(0, 31, 0, 0.24, 3, 0.24, '#d8b267');
    for (const side of [-1, 1]) {
      box(0, 21, side * d * 0.35, 3.4, 3.4, 0.15, '#f6e8ba');
      box(0, 21.5, side * d * 0.37, 0.18, 1.15, 0.18, '#485e60');
      box(0.5, 21, side * d * 0.37, 1.1, 0.18, 0.18, '#485e60');
      box(side * w * 0.35, 21, 0, 0.15, 3.4, 3.4, '#f6e8ba');
      box(side * w * 0.37, 21.5, 0, 0.18, 1.15, 0.18, '#485e60');
      box(side * w * 0.37, 21, 0.5, 0.18, 0.18, 1.1, '#485e60');
      for (const yy of [6, 13])
        box(0, yy, side * d * 0.35, 1.2, 2, 0.16, '#628786', true);
    }
    return;
  }
  box(0, h / 2, 0, w, h, d, pale[b.color]);
  box(0, 0.7, 0, w + 0.1, 0.7, d + 0.1, '#c9bc9b');
  const floors = b.kind === 'home' ? 2 : 3;
  for (let f = 0; f < floors; f++) {
    const yy = 1.8 + (f * (h - 2)) / floors;
    for (let a = -w / 2 + 1.2; a < w / 2 - 0.8; a += 2.3) {
      for (const side of [-1, 1]) {
        box(a, yy, side * (d / 2 + 0.045), 0.9, 1.35, 0.12, '#56818c', true);
        box(a, yy - 0.76, side * (d / 2 + 0.15), 1.25, 0.15, 0.35, '#f4e5c5');
      }
    }
    for (let a = -d / 2 + 1.1; a < d / 2 - 0.6; a += 2.2)
      for (const side of [-1, 1]) {
        box(side * (w / 2 + 0.045), yy, a, 0.12, 1.35, 0.9, '#56818c', true);
        box(side * (w / 2 + 0.15), yy - 0.76, a, 0.35, 0.15, 1.2, '#f4e5c5');
      }
    if (b.kind !== 'home')
      box(0, yy + 1, 0, w + 0.15, 0.17, d + 0.15, '#c6bea1');
  }
  for (let i = 0; i < 5; i++) {
    const depth = d + 1.2 - i * (d / 6);
    box(0, h + 0.32 + i * 0.5, 0, w + 1.1, 0.5, depth, roof);
  }
  box(0, h + 2.75, 0, w + 1.25, 0.2, 0.5, roof);
  for (const side of [-1, 1]) {
    box(0, 1.2, side * (d / 2 + 0.09), 1.35, 2.4, 0.22, '#485f5b');
    box(0, 0.2, side * (d / 2 + 0.75), 2.9, 0.38, 1.5, '#e4d4b0');
  }
  if (b.kind === 'home') {
    box(w * 0.28, h + 2, -d * 0.16, 0.85, 3, 0.85, '#ac9275');
    box(w * 0.28, h + 3.6, -d * 0.16, 1.1, 0.3, 1.1, '#d7c8aa');
    box(-w * 0.2, h + 1.05, d * 0.25, 1.5, 1.5, 1.3, roof);
    box(-w * 0.2, h + 1.1, d * 0.25 + 0.68, 0.95, 0.8, 0.12, '#77a7b0', true);
  } else if (b.kind === 'shop') {
    for (let i = 0; i < Math.floor(w / 1.2); i++)
      box(
        -w / 2 + 0.6 + i * 1.2,
        2.7,
        d / 2 + 0.75,
        1.2,
        0.28,
        1.4,
        i % 2 ? '#f3e2bd' : roof,
      );
    box(0, h + 0.2, d / 2 + 0.25, w * 0.65, 1.6, 0.5, '#374f4e');
    box(0, h + 0.3, d / 2 + 0.52, w * 0.5, 0.28, 0.08, '#dfc787');
  } else {
    box(0, h + 2.8, 0, Math.min(w * 0.34, 6), 2.5, d * 0.58, pale[b.color]);
    for (let i = 0; i < 3; i++)
      box(
        0,
        h + 4.2 + i * 0.5,
        0,
        Math.min(w * 0.34, 6) + 0.6 - i * 1,
        0.5,
        d * 0.62 - i * 0.8,
        roof,
      );
    if (['hall', 'university', 'library'].includes(b.kind)) {
      for (let i = -2; i <= 2; i++)
        box(i * 1.2, 2.15, d / 2 + 0.8, 0.45, 4.3, 0.45, '#f8edce');
      box(0, 4.5, d / 2 + 0.9, 6.3, 0.5, 1.5, '#d7c7a4');
      box(0, 0.35, d / 2 + 1.2, 7, 0.35, 2.4, '#e2d4b3');
    }
    if (['primary', 'middle', 'high', 'university', 'hall'].includes(b.kind)) {
      box(w / 2 + 1, 4.5, d / 2 + 1, 0.14, 9, 0.14, '#e6d6b1');
      box(w / 2 + 2, 8.4, d / 2 + 1, 2, 1.15, 0.12, '#d86650');
    }
  }
}
function tree(v: Voxels, t: Tree) {
  const x = toX(t.x),
    z = toZ(t.y),
    size = 1 + (t.variant % 3) * 0.1;
  v.box(x, 2, z, 0.65, 4, 0.7, '#8c6b47', `tree:${t.x}:${t.y}`);
  v.box(
    x,
    4.8,
    z,
    3.8 * size,
    2.8,
    3.7 * size,
    ['#478157', '#689150', '#779b55', '#50876d'][t.variant],
    `tree:${t.x}:${t.y}`,
  );
  v.box(
    x - 0.4,
    6.5,
    z - 0.15,
    2.9 * size,
    1.2,
    2.8 * size,
    '#86ac60',
    `tree:${t.x}:${t.y}`,
  );
  v.box(x + 0.6, 4.2, z + 0.45, 3.2, 1.3, 3.3, '#3d754d', `tree:${t.x}:${t.y}`);
}
function terrainGeometry() {
  const positions: number[] = [],
    uv: number[] = [];
  function quad(x1: number, x2: number, y1: number, y2: number) {
    const points = [
      [x1, y1],
      [x1, y2],
      [x2, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
    ];
    for (const [x, y] of points) {
      positions.push(toX(x), 0, toZ(y));
      uv.push(x / W, 1 - y / H);
    }
  }
  for (let y = 0; y < H; y += 16) {
    const edge = riverX(y);
    quad(0, edge - 105, y, Math.min(y + 16, H));
    quad(edge + 105, W, y, Math.min(y + 16, H));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
export function buildCityGeometry(world: World, texture?: THREE.Texture) {
  const root = new THREE.Group();
  root.name = 'Qinghe voxel city';
  const v = new Voxels();
  const terrain = new THREE.Mesh(
    terrainGeometry(),
    new THREE.MeshStandardMaterial({
      map: texture ?? null,
      color: texture ? '#ffffff' : '#8daf6d',
      roughness: 1,
    }),
  );
  terrain.receiveShadow = true;
  terrain.name = 'land-with-river-channel';
  root.add(terrain);
  // Earth slabs have real exposed sides and a recessed river bed.
  v.box(0, -4.6, 0, W * SCALE, 1.2, H * SCALE, '#91795b');
  for (let y = 0; y < H; y += 16) {
    const edge = riverX(y),
      depth = Math.min(16, H - y) * SCALE;
    v.box(
      toX((edge - 105) / 2),
      -2.05,
      toZ(y) + depth / 2,
      (edge - 105) * SCALE,
      4.05,
      depth,
      '#a98e66',
    );
    v.box(
      toX((edge + 105 + W) / 2),
      -2.05,
      toZ(y) + depth / 2,
      (W - edge - 105) * SCALE,
      4.05,
      depth,
      '#a98e66',
    );
    for (const sign of [-1, 1])
      v.box(
        toX(edge + sign * 105),
        -0.35,
        toZ(y) + depth / 2,
        0.35,
        0.8,
        depth,
        '#c8bd93',
      );
  }
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(W * SCALE, H * SCALE),
    new THREE.MeshStandardMaterial({
      color: '#51a9b3',
      roughness: 0.28,
      metalness: 0.18,
      transparent: true,
      opacity: 0.91,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.88;
  water.receiveShadow = true;
  water.name = 'recessed-river';
  root.add(water);
  // Three dimensional bridge decks, piers, curb stones, railings and lamps.
  for (const yy of ROAD_Y) {
    const x = toX(riverX(yy)),
      z = toZ(yy);
    v.box(x, -0.36, z, 27, 0.9, 6.6, '#b9b7a0');
    v.box(x, 0.11, z, 27, 0.08, 4.6, '#838a81');
    for (let a = -12; a < 13; a += 3.2)
      v.box(x + a, 0.16, z, 1.5, 0.025, 0.16, '#e5d4a5');
    for (const s of [-1, 1]) {
      v.box(x, 0.2, z + s * 2.9, 27, 0.25, 1, '#d2cdb3');
      v.box(x, 1.25, z + s * 3.15, 27, 0.17, 0.22, '#dfd5b2');
      for (let a = -12.8; a <= 13; a += 2.2)
        v.box(x + a, 0.75, z + s * 3.15, 0.27, 1.3, 0.27, '#e8dcbc');
      for (const a of [-8, 8])
        v.box(x + a, -1.9, z + s * 2, 1.45, 3.8, 1.45, '#9f9f89');
    }
  }
  world.buildings.forEach((b) => building(v, b));
  world.trees.forEach((t) => tree(v, t));
  // Lamps, benches, campus trees and raised fountains.
  for (const yy of ROAD_Y)
    for (let xx = 100; xx < W - 60; xx += 140) {
      if (isWater(xx, yy) || ROAD_X.some((rx) => Math.abs(rx - xx) < 60))
        continue;
      const x = toX(xx),
        z = toZ(yy - 45);
      v.box(x, 2.3, z, 0.17, 4.6, 0.17, '#536b60');
      v.box(x, 4.55, z + 0.4, 0.18, 0.17, 0.9, '#536b60');
      v.box(x, 4.4, z + 0.8, 0.65, 0.2, 0.7, '#ffe5a6', undefined, true);
    }
  for (const [xx, yy] of [
    [1185, 575],
    [1940, 1020],
  ]) {
    const x = toX(xx),
      z = toZ(yy);
    v.box(x, 0.35, z, 7.2, 0.7, 5.4, '#e3d4b0');
    v.box(x, 0.74, z, 6.3, 0.08, 4.5, '#67bdc3');
    v.box(x, 1.3, z, 1, 2.6, 1, '#dddfc3');
    v.box(x, 2.5, z, 3.3, 0.3, 2.5, '#eddfbc');
    v.box(x, 3.1, z, 0.4, 1.2, 0.4, '#a5e3dc');
  }
  for (let yy = 130; yy < H - 50; yy += 145) {
    const xx = riverX(yy) + 151;
    if (isRoad(xx, yy, 50)) continue;
    const x = toX(xx),
      z = toZ(yy);
    v.box(x, 0.7, z, 2.6, 0.2, 0.9, '#bd9462');
    v.box(x, 1.25, z - 0.4, 2.6, 0.8, 0.15, '#b38955');
    for (const s of [-1, 1]) v.box(x + s, 0.32, z, 0.2, 0.65, 0.75, '#596657');
  }
  for (const [x, y, w] of [
    [688, 530, 116],
    [292, 969, 210],
    [723, 965, 211],
    [1840, 1342, 240],
  ])
    for (const xx of [x + 5, x + w - 5]) {
      for (const sy of [-1, 1])
        v.box(toX(xx), 0.9, toZ(y + 32 + sy * 11), 0.12, 1.8, 0.12, '#f2e7c8');
      v.box(toX(xx), 1.8, toZ(y + 32), 0.12, 0.12, 2.35, '#f2e7c8');
    }
  // Campus entrances have volume and can be seen from either bank.
  for (const [xx, yy] of [
    [808, 638],
    [394, 1055],
    [826, 1055],
    [1940, 735],
  ]) {
    for (const s of [-1, 1])
      v.box(toX(xx + s * 34), 1.5, toZ(yy), 0.9, 3, 0.9, '#dccdad');
    v.box(toX(xx), 3, toZ(yy), 7.6, 0.6, 0.65, '#526e6c');
  }
  for (const yy of [420, 970, 1300]) {
    const x = toX(riverX(yy)),
      z = toZ(yy);
    v.box(x, -0.45, z, 2.6, 0.5, 4.4, '#d6bc8f');
    v.box(x, -0.15, z, 2.15, 0.2, 3.45, '#efdcad');
    v.box(x, 1.8, z, 0.13, 4.3, 0.13, '#806b4c');
    for (let i = 0; i < 5; i++)
      v.box(
        x + 0.22 + i * 0.2,
        3.3 - i * 0.4,
        z,
        0.4 + i * 0.4,
        0.4,
        0.12,
        '#f3ead1',
      );
  }
  // Small ripples stay inside the channel and animate as a single batch.
  const ripples = new THREE.Group();
  const rv = new Voxels(),
    random = rng(431);
  for (let i = 0; i < 110; i++) {
    const y = random() * H,
      x = riverX(y) + (random() - 0.5) * 155;
    rv.box(toX(x), -0.82, toZ(y), 0.7 + random() * 1.9, 0.025, 0.13, '#a0d4cd');
  }
  rv.build(ripples);
  root.add(ripples);
  const solids = v.build(root),
    windows = v.build(root, true);
  root.updateMatrixWorld(true);
  return {
    root,
    solids,
    windows,
    ripples,
    water,
    terrain,
    buildingCount: world.buildings.length,
  };
}
export type CityGeometry = ReturnType<typeof buildCityGeometry>;
export function disposeGeometry(city: CityGeometry) {
  city.root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        material.dispose();
    }
  });
}
export function createAgentMeshes(world: World) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const count = world.agents.reduce((n, a) => n + (a.car ? 7 : 4), 0);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    bodyMaterial,
    count,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const colors = [
    '#efcd81',
    '#d97557',
    '#78a6bf',
    '#e9e4cf',
    '#5e7d98',
    '#a079a6',
  ];
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  function update(time: number) {
    let i = 0;
    for (const a of world.agents) {
      const p = world.nodes[a.from],
        q = world.nodes[a.to],
        angle = Math.atan2(q.x - p.x, q.y - p.y),
        y = surfaceHeight(a.x, a.y);
      const s = Math.sin(angle),
        c = Math.cos(angle);
      const part = (
        dx: number,
        dy: number,
        dz: number,
        w: number,
        h: number,
        d: number,
        col: string,
      ) => {
        dummy.position.set(
          toX(a.x) + dx * c + dz * s,
          y + dy,
          toZ(a.y) - dx * s + dz * c,
        );
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.set(col));
        i++;
      };
      if (a.car) {
        part(0, 0.6, 0, 1.35, 0.75, 2.65, colors[a.color]);
        part(0, 1.17, -0.15, 1.15, 0.65, 1.3, '#537986');
        part(0, 0.65, 1.35, 1, 0.23, 0.08, '#f8df9b');
        for (const x of [-0.73, 0.73])
          for (const z of [-0.8, 0.8])
            part(x, 0.3, z, 0.22, 0.55, 0.55, '#3e504b');
      } else {
        part(0, 1.15, 0, 0.62, 0.9, 0.48, colors[a.color]);
        part(0, 1.86, 0, 0.46, 0.52, 0.46, '#d8ad80');
        const step = Math.sin(time * 7 + a.color) * 0.18;
        part(-0.18, 0.4, step, 0.22, 0.65, 0.24, '#4c605b');
        part(0.18, 0.4, -step, 0.22, 0.65, 0.24, '#4c605b');
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  update(0);
  return {
    mesh,
    update,
    dispose: () => {
      mesh.geometry.dispose();
      bodyMaterial.dispose();
    },
  };
}
