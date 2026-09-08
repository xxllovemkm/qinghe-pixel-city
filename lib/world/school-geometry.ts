import * as THREE from 'three';
import { Voxels } from './geometry3d';
import { SCHOOL_META, type Campus, type Facility } from './school-model';

export const CAMPUS_DIRECTION = new THREE.Vector3(110, 140, 160).normalize();
export function campusDistance(aspect: number) {
  const right = new THREE.Vector3(
    CAMPUS_DIRECTION.z,
    0,
    -CAMPUS_DIRECTION.x,
  ).normalize();
  const up = CAMPUS_DIRECTION.clone().cross(right).normalize(),
    tangent = Math.tan(THREE.MathUtils.degToRad(19));
  let result = 160;
  for (const x of [-90, 90])
    for (const z of [-70, 70])
      for (const y of [-3, 19]) {
        const p = new THREE.Vector3(x, y, z);
        result = Math.max(
          result,
          p.dot(CAMPUS_DIRECTION) +
            Math.max(
              Math.abs(p.dot(right)) / (tangent * aspect * 0.83),
              Math.abs(p.dot(up)) / (tangent * 0.79),
            ),
        );
      }
  return result;
}
export function buildSchoolGeometry(campus: Campus) {
  const root = new THREE.Group();
  root.name = SCHOOL_META[campus.kind].name;
  const v = new Voxels();
  const box = (
    x: number,
    y: number,
    z: number,
    a: number,
    b: number,
    c: number,
    color: string,
    id?: string,
    lit = false,
  ) => v.box(x, y, z, a, b, c, color, id, lit);
  box(0, -1.45, 0, campus.width, 2.8, campus.depth, '#a89372');
  box(0, -0.15, 0, campus.width, 0.25, campus.depth, '#87ab73');
  for (const p of campus.paths) box(p.x, 0.025, p.z, p.w, 0.05, p.d, '#d8d3b9');
  const line = (x: number, z: number, a: number, c: number, id: string) =>
    box(x, 0.14, z, Math.max(a, 0.3), 0.03, Math.max(c, 0.3), '#f0edcb', id);
  function building(f: Facility) {
    const { x, z, w: a, d: c, h: b, id } = f;
    const wall = campus.kind === 'primary' ? '#f1dbac' : '#e3ddc8';
    box(x, b / 2, z, a, b, c, wall, id);
    box(x, 0.25, z, a + 0.5, 0.5, c + 0.5, '#c9bea2', id);
    for (let y = 2; y < b - 1; y += 3.1) {
      for (let xx = x - a / 2 + 1.8; xx < x + a / 2 - 1; xx += 3.4)
        for (const side of [-1, 1]) {
          box(
            xx,
            y,
            z + side * (c / 2 + 0.06),
            1.4,
            1.5,
            0.15,
            '#598995',
            id,
            true,
          );
          box(
            xx,
            y - 0.86,
            z + side * (c / 2 + 0.15),
            1.8,
            0.15,
            0.4,
            '#f1e9cb',
            id,
          );
        }
      for (let zz = z - c / 2 + 2; zz < z + c / 2 - 1; zz += 3.3)
        for (const side of [-1, 1])
          box(
            x + side * (a / 2 + 0.06),
            y,
            zz,
            0.15,
            1.5,
            1.3,
            '#598995',
            id,
            true,
          );
      box(x, y + 1.1, z, a + 0.2, 0.17, c + 0.2, f.color, id);
    }
    for (let i = 0; i < 4; i++)
      box(
        x,
        b + 0.3 + i * 0.45,
        z,
        a + 1 - i * 0.65,
        0.5,
        c + 1 - i * 0.7,
        f.color,
        id,
      );
    box(x, 1.4, z + c / 2 + 0.1, 2.6, 2.8, 0.2, '#486c70', id);
    box(x, 3.25, z + c / 2 + 1, 5, 0.3, 2, '#e7c992', id);
    for (let i = 0; i < 3; i++)
      box(
        x,
        0.1 + i * 0.12,
        z + c / 2 + 1 - i * 0.3,
        4,
        0.18,
        2 - i * 0.5,
        '#d7ccb1',
        id,
      );
    if (f.id === 'lab') {
      for (const xx of [x - 6, x, x + 6]) {
        box(xx, b + 2.3, z, 3, 0.2, 3, '#476b82', id);
        box(xx, b + 1.7, z, 0.2, 1.1, 2, '#667670', id);
      }
    }
    if (f.id === 'gym')
      for (let xx = x - a / 2 + 3; xx < x + a / 2; xx += 5)
        box(xx, b + 2.1, z, 2, 0.25, c * 0.65, '#a9c8c4', id);
  }
  for (const f of campus.facilities) {
    const { x, z, w: a, d: c, id } = f;
    if (f.type === 'building') {
      building(f);
      continue;
    }
    if (f.type === 'track') {
      // Concentric stadium polygons keep the lanes and runner route on the same geometry.
      const half = 9,
        radius = 19;
      function stadium(r: number, color: string, y: number, innerRadius = 0) {
        const shape = new THREE.Shape();
        shape.moveTo(-half, -r);
        shape.lineTo(half, -r);
        shape.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
        shape.lineTo(-half, r);
        shape.absarc(-half, 0, r, Math.PI / 2, Math.PI * 1.5, false);
        if (innerRadius > 0) {
          const hole = new THREE.Path();
          hole.moveTo(-half, -innerRadius);
          hole.lineTo(half, -innerRadius);
          hole.absarc(half, 0, innerRadius, -Math.PI / 2, Math.PI / 2, false);
          hole.lineTo(-half, innerRadius);
          hole.absarc(-half, 0, innerRadius, Math.PI / 2, Math.PI * 1.5, false);
          shape.holes.push(hole);
        }
        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape, 20),
          new THREE.MeshStandardMaterial({ color, roughness: 1 }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.userData.facility = id;
        root.add(mesh);
      }
      stadium(radius, '#b87061', 0.05, 13.3);
      for (let i = 0; i < 5; i++) {
        stadium(radius - 1 - i * 0.9, '#eac6a0', 0.13, radius - 1.32 - i * 0.9);
      }
      stadium(13.3, '#71a166', 0.08);
      for (let i = 0; i < 5; i++)
        box(
          x - 13.6 + i * 6.8,
          0.1,
          z,
          6.8,
          0.05,
          18,
          i % 2 ? '#75a86a' : '#7fb273',
          id,
        );
      line(x, z, 0.13, 18, id);
      for (const side of [-1, 1]) {
        line(x, z + side * 9, 34, 0.13, id);
        line(x + side * 17, z, 0.13, 18, id);
        line(x + side * 12, z, 0.12, 9, id);
        for (const sz of [-1, 1])
          line(x + side * 14.5, z + sz * 4.5, 5, 0.12, id);
      }
      for (const side of [-1, 1]) {
        for (const sz of [-1, 1])
          box(x + side * 17, 1.1, z + sz * 3, 0.12, 2.2, 0.12, '#f4ead0', id);
        box(x + side * 17, 2.2, z, 0.12, 0.12, 6.2, '#f4ead0', id);
      }
      for (let i = 0; i < 3; i++)
        box(x, 0.3 + i * 0.3, z + 21 + i * 0.45, 30, 0.5, 0.55, '#cec6ac', id);
      box(x + 24, 0.12, z + 17, 7, 0.12, 3, '#ead7a5', id);
      continue;
    }
    if (f.type === 'basketball' || f.type === 'volleyball') {
      box(x, 0.055, z, a, 0.1, c, f.color, id);
      for (const s of [-1, 1]) {
        line(x + s * (a / 2 - 1), z, 0.12, c - 2, id);
        line(x, z + s * (c / 2 - 1), a - 2, 0.12, id);
      }
      line(x, z, 0.12, c - 2, id);
      if (f.type === 'basketball')
        for (const s of [-1, 1]) {
          box(x + s * (a / 2 - 1), 1.8, z, 0.2, 3.6, 0.2, '#e7dec4', id);
          box(x + s * (a / 2 - 1), 3.3, z, 0.15, 1.1, 2, '#ece8d1', id);
          box(x + s * (a / 2 - 1.6), 2.9, z, 0.8, 0.13, 0.8, '#d4885e', id);
        }
      else {
        for (const s of [-1, 1])
          box(x, 1.25, z + s * (c / 2 - 1), 0.12, 2.5, 0.12, '#d6d5c0', id);
        for (let i = 0; i < 6; i++)
          box(x, 1.3 + i * 0.16, z, 0.045, 0.04, c - 2, '#e6e3cf', id);
      }
      continue;
    }
    if (f.type === 'gate') {
      for (const s of [-1, 1])
        box(x + s * 7, 2.5, z, 1.5, 5, 1.5, '#d5c6a5', id);
      box(x, 5.15, z, 16, 0.6, 1.9, f.color, id);
      box(x, 6, z, 8, 1.5, 0.35, '#e9d8ab', id);
      box(x + 9, 1.5, z, 3, 3, 4, '#ddcaaa', id);
      box(x + 9, 3.15, z, 3.5, 0.3, 4.5, f.color, id);
      box(x + 9, 2, z + 2.02, 1.8, 1, 0.12, '#6c9ca2', id, true);
      continue;
    }
    box(
      x,
      0.035,
      z,
      a,
      0.07,
      c,
      f.type === 'garden' ? '#9bb980' : '#d9cdb0',
      id,
    );
    if (f.type === 'plaza') {
      box(x, 0.25, z - 5, 4, 0.5, 3, '#e6ddc4', id);
      box(x, 4.5, z - 5, 0.12, 9, 0.12, '#dde0ca', id);
      box(x + 1.05, 8.2, z - 5, 2.1, 1.35, 0.07, '#d46152', id);
    } else if (f.type === 'garden') {
      for (const dx of [-7, 0, 7])
        for (const dz of [-3, 3]) {
          box(x + dx, 0.3, z + dz, 5, 0.6, 3, '#ac8d60', id);
          box(x + dx, 0.7, z + dz, 4.4, 0.3, 2.4, '#597d48', id);
          for (const n of [-1, 1])
            box(x + dx + n, 0.9, z + dz, 0.4, 0.4, 0.4, '#e6af6b', id);
        }
    } else if (f.type === 'play') {
      box(x + 5, 0.2, z, 8, 0.4, 8, '#e4c792', id);
      for (const dx of [-8, -3])
        box(x + dx, 1.7, z, 0.5, 3.4, 0.5, '#739aad', id);
      box(x - 5.5, 3.4, z, 6, 0.4, 3, '#d49a5d', id);
      for (let i = 0; i < 6; i++)
        box(
          x - 5.5,
          3.3 - i * 0.45,
          z + 1.5 + i * 0.8,
          2,
          0.2,
          1,
          '#d66f59',
          id,
        );
      for (let i = 0; i < 5; i++)
        box(x - 9, 1.2 + i * 0.45, z, 0.25, 0.15, 2, '#e8bb65', id);
    }
  }
  for (const item of campus.items) {
    const { x, z, id } = item;
    if (item.type === 'tree') {
      box(x, 1.6, z, 0.55, 3.2, 0.55, '#866642', id);
      box(x, 3.9, z, 3.3, 2.5, 3.1, '#518559', id);
      box(x - 0.3, 5.3, z, 2.5, 1.1, 2.5, '#7aa75e', id);
    } else {
      box(x, 0.65, z, 3, 0.18, 1.2, '#bd9768', id);
      box(x, 1.1, z - 0.5, 3, 0.9, 0.15, '#a98056', id);
      for (const s of [-1, 1]) box(x + s, 0.3, z, 0.18, 0.6, 1, '#65716a', id);
    }
  }
  for (const z of [-68, 68])
    for (let x = -88; x < 89; x += 4) {
      if (z > 0 && Math.abs(x) < 12) continue;
      box(x, 0.9, z, 0.18, 1.8, 0.18, '#ded4b5');
      box(x + 1.9, 1, z, 4, 0.12, 0.12, '#ded4b5');
    }
  for (const x of [-88, 88])
    for (let z = -66; z < 67; z += 4) {
      box(x, 0.9, z, 0.18, 1.8, 0.18, '#ded4b5');
      box(x, 1, z + 1.9, 0.12, 0.12, 4, '#ded4b5');
    }
  for (const z of [-55, 0, 54])
    for (const x of [-77, -8, 8, 77]) {
      box(x, 2.1, z, 0.13, 4.2, 0.13, '#61746a');
      box(x, 4.3, z, 0.7, 0.2, 0.7, '#ffe4aa', undefined, true);
    }
  const solids = v.build(root),
    windows = v.build(root, true);
  root.updateMatrixWorld(true);
  return { root, solids, windows };
}
export function disposeSchoolGeometry(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
    }
  });
}
export function studentPosition(campus: Campus, index: number, time: number) {
  if (index < 12) {
    const f = campus.facilities.find((f) => f.id === 'field')!,
      r = 16,
      half = 9;
    const total = 4 * half + 2 * Math.PI * r;
    let d = (time * 2 + (index * total) / 12) % total;
    if (d < 2 * half)
      return { x: f.x - half + d, z: f.z - r, angle: Math.PI / 2 };
    d -= 2 * half;
    if (d < Math.PI * r) {
      const a = d / r - Math.PI / 2;
      return {
        x: f.x + half + Math.cos(a) * r,
        z: f.z + Math.sin(a) * r,
        angle: -a,
      };
    }
    d -= Math.PI * r;
    if (d < 2 * half)
      return { x: f.x + half - d, z: f.z + r, angle: -Math.PI / 2 };
    d -= 2 * half;
    const a = d / r + Math.PI / 2;
    return {
      x: f.x - half + Math.cos(a) * r,
      z: f.z + Math.sin(a) * r,
      angle: -a,
    };
  }
  const length = 542;
  let d = (time * 1.2 + ((index - 12) * length) / 26) % length;
  if (d < 162) return { x: -81 + d, z: -55, angle: Math.PI / 2 };
  d -= 162;
  if (d < 109) return { x: 81, z: -55 + d, angle: 0 };
  d -= 109;
  if (d < 162) return { x: 81 - d, z: 54, angle: -Math.PI / 2 };
  d -= 162;
  return { x: -81, z: 54 - d, angle: Math.PI };
}
