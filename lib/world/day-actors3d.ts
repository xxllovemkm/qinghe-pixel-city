import * as THREE from 'three';
import type { DayScene, DayStudent } from './school-day-contract';
import { toX, toZ } from './geometry3d';

export type DayActorSource = {
  students: () => DayStudent[];
  selected: () => string;
  simTime: () => number;
  onSelect: (id: string) => void;
  route?: () => { x: number; z: number }[];
  homeId?: () => string;
  schoolId?: () => string;
  classroomId?: () => string;
  exactPosition?: (id: string) => boolean;
};
type Figure = {
  root: THREE.Group;
  legs: THREE.Mesh[];
  arms: THREE.Mesh[];
  ring: THREE.Mesh;
  actor: DayStudent;
  target: THREE.Vector3;
  initialized: boolean;
  journeyKey: string;
  journeyIndex: number;
  waypoints: THREE.Vector3[];
};

export function createDayActors(
  scene: THREE.Scene,
  frame: DayScene,
  source: DayActorSource,
) {
  const root = new THREE.Group();
  scene.add(root);
  const figures = new Map<string, Figure>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.Material[] = [];
  let routeKey = '';
  let route: THREE.Line | undefined;
  const point = (x: number, z: number) =>
    new THREE.Vector3(
      frame === 'city' ? toX(x) : x,
      0.15,
      frame === 'city' ? toZ(z) : z,
    );
  function figure(actor: DayStudent): Figure {
    const group = new THREE.Group();
    group.userData.studentId = actor.id;
    const part = (
      color: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(cube, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      mesh.userData.studentId = actor.id;
      group.add(mesh);
      return mesh;
    };
    const legs = [-0.19, 0.19].map((x) =>
      part('#394954', x, 0.4, 0, 0.24, 0.67, 0.28),
    );
    part(
      actor.appearance?.clothing || actor.color || '#70a298',
      0,
      1.03,
      0,
      0.75,
      0.75,
      0.44,
    );
    part(actor.appearance?.skin || '#f0d0a7', 0, 1.68, 0, 0.59, 0.6, 0.53);
    part(actor.appearance?.hair || '#403c36', 0, 1.99, -0.03, 0.62, 0.18, 0.57);
    part(actor.appearance?.hair || '#403c36', 0, 1.77, -0.26, 0.61, 0.4, 0.1);
    for (const x of [-0.14, 0.14])
      part('#39352d', x, 1.71, 0.275, 0.055, 0.06, 0.025);
    const arms = [-0.49, 0.49].map((x) =>
      part(
        actor.appearance?.clothing || actor.color || '#70a298',
        x,
        1.02,
        0,
        0.2,
        0.67,
        0.25,
      ),
    );
    part('#e7b667', 0, 1.08, -0.32, 0.54, 0.57, 0.27);
    const ringMat = new THREE.MeshBasicMaterial({
      color: actor.color || '#4c978a',
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    });
    materials.push(ringMat);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.92, 32),
      ringMat,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    const size = frame === 'city' ? 1.65 : frame === 'campus' ? 1.25 : 1;
    group.scale.setScalar(
      size * Math.min(1.15, Math.max(0.85, actor.appearance?.height || 1)),
    );
    root.add(group);
    return {
      root: group,
      legs,
      arms,
      ring,
      actor,
      target: new THREE.Vector3(),
      initialized: false,
      journeyKey: '',
      journeyIndex: 0,
      waypoints: [],
    };
  }
  function update(dt: number, elapsed: number) {
    for (const f of figures.values()) f.root.visible = false;
    for (const actor of source.students()) {
      if (
        actor.location.scene !== frame ||
        (frame === 'campus' &&
          source.schoolId?.() &&
          actor.school_building_id !== source.schoolId()) ||
        (frame === 'classroom' &&
          source.classroomId?.() &&
          (actor.location.classroom_id || actor.classroom_id) &&
          (actor.location.classroom_id || actor.classroom_id) !==
            source.classroomId()) ||
        (frame === 'home' &&
          (source.homeId?.() !== actor.home_building_id ||
            source.selected() !== actor.id))
      )
        continue;
      let f = figures.get(actor.id);
      if (!f) {
        f = figure(actor);
        figures.set(actor.id, f);
      }
      f.actor = actor;
      f.root.visible = true;
      f.target.copy(point(actor.location.x, actor.location.z));
      const exact = source.exactPosition?.(actor.id);
      if (exact) {
        f.root.position.copy(f.target);
        f.waypoints = [];
        f.journeyKey = '';
        f.initialized = true;
      }
      const journey = exact ? [] : actor.journey?.points || [];
      const journeyIndex = Math.round(
        (actor.journey?.progress || 0) * Math.max(0, journey.length - 1),
      );
      const journeyKey = journey.length ? JSON.stringify(journey) : '';
      if (journeyKey && journeyKey !== f.journeyKey) {
        f.journeyKey = journeyKey;
        f.journeyIndex = journeyIndex;
        f.waypoints = journey
          .slice(1, journeyIndex + 1)
          .map((p) => point(p.x, p.z));
        f.root.position.copy(point(journey[0].x, journey[0].z));
        f.initialized = true;
      } else if (journeyKey && journeyIndex > f.journeyIndex) {
        f.waypoints.push(
          ...journey
            .slice(f.journeyIndex + 1, journeyIndex + 1)
            .map((p) => point(p.x, p.z)),
        );
        f.journeyIndex = journeyIndex;
      }
      if (!f.initialized) {
        f.root.position.copy(f.target);
        f.initialized = true;
      }
      const distanceXZ = (a: THREE.Vector3, b: THREE.Vector3) =>
        Math.hypot(a.x - b.x, a.z - b.z);
      if (!f.waypoints.length && distanceXZ(f.root.position, f.target) > 0.01)
        f.waypoints.push(f.target.clone());
      const distance = f.waypoints.reduce(
        (sum, p, i) =>
          sum + distanceXZ(p, i ? f.waypoints[i - 1] : f.root.position),
        0,
      );
      const moving = distance > 0.04 || actor.location.pose === 'walking';
      if (distance > 0.02) {
        const direction = (f.waypoints[0] || f.target)
          .clone()
          .sub(f.root.position);
        f.root.rotation.y = Math.atan2(direction.x, direction.z);
      } else if (actor.location.heading !== undefined)
        f.root.rotation.y = actor.location.heading;
      let travel =
        distance < 0.04 ? distance : distance * (1 - Math.exp(-dt * 9));
      while (travel > 0 && f.waypoints.length) {
        const target = f.waypoints[0];
        const length = distanceXZ(f.root.position, target);
        if (length <= travel + 0.0001) {
          f.root.position.copy(target);
          f.waypoints.shift();
          travel -= length;
        } else {
          f.root.position.lerp(target, travel / length);
          travel = 0;
        }
      }
      const seated =
        (frame === 'classroom' || frame === 'home') &&
        !moving &&
        !actor.journey;
      f.legs.forEach((leg, i) => {
        leg.rotation.x = seated
          ? -Math.PI / 2
          : moving
            ? Math.sin(elapsed * 9 + i * Math.PI) * 0.45
            : 0;
      });
      f.arms.forEach((arm, i) => {
        arm.rotation.x = seated
          ? -0.65
          : moving
            ? Math.sin(elapsed * 9 - i * Math.PI) * 0.4
            : 0;
      });
      f.root.position.y = seated ? -0.13 : 0.15;
      f.ring.visible = actor.id === source.selected();
    }
    const path = source.route?.() || [];
    const key = JSON.stringify(path);
    if (key !== routeKey) {
      routeKey = key;
      if (route) {
        root.remove(route);
        route.geometry.dispose();
        (route.material as THREE.Material).dispose();
        route = undefined;
      }
      if (path.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          path.map((p) => point(p.x, p.z).setY(0.12)),
        );
        route = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color: '#e09c43',
            transparent: true,
            opacity: 0.8,
            depthTest: false,
          }),
        );
        route.renderOrder = 2;
        root.add(route);
      }
    }
  }
  function labels(
    context: CanvasRenderingContext2D,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    context.font = '600 12px "PingFang SC", sans-serif';
    context.textAlign = 'center';
    const used: { x: number; y: number; w: number }[] = [];
    for (const f of [...figures.values()].sort(
      (a, b) =>
        Number(b.actor.id === source.selected()) -
        Number(a.actor.id === source.selected()),
    )) {
      if (!f.root.visible) continue;
      const p = f.root.position.clone();
      p.y += frame === 'city' ? 6 : 3.3;
      p.project(camera);
      if (p.z < 0 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1)
        continue;
      const x = (p.x * 0.5 + 0.5) * width;
      let y = (-p.y * 0.5 + 0.5) * height;
      const text =
          f.actor.id === source.selected()
            ? f.actor.name
            : f.actor.name.slice(-1),
        w = context.measureText(text).width + 18;
      let offset = 0;
      while (
        used.some(
          (label) =>
            Math.abs(label.y - y) < 26 &&
            Math.abs(label.x - x) < (label.w + w) / 2 + 5,
        ) &&
        offset < 3
      ) {
        y -= 27;
        offset++;
      }
      if (
        y < 14 ||
        (offset === 3 &&
          used.some(
            (label) =>
              Math.abs(label.y - y) < 26 &&
              Math.abs(label.x - x) < (label.w + w) / 2 + 5,
          ))
      )
        continue;
      used.push({ x, y, w });
      context.fillStyle =
        f.actor.id === source.selected() ? '#286653ed' : '#fbf8ecee';
      context.fillRect(x - w / 2, y - 12, w, 24);
      context.fillStyle =
        f.actor.id === source.selected() ? '#ffffff' : '#254a3f';
      context.fillText(text, x, y + 4);
    }
  }
  return {
    update,
    labels,
    pick(raycaster: THREE.Raycaster) {
      const hit = raycaster.intersectObjects(
        [...figures.values()].filter((f) => f.root.visible).map((f) => f.root),
        true,
      )[0];
      const id = hit?.object.userData.studentId;
      if (id) {
        source.onSelect(id);
        return true;
      }
      return false;
    },
    position(id: string) {
      return figures.get(id)?.root.position.clone();
    },
    dispose() {
      root.removeFromParent();
      cube.dispose();
      materials.forEach((m) => m.dispose());
      figures.forEach((f) => f.ring.geometry.dispose());
      route?.geometry.dispose();
      if (route) (route.material as THREE.Material).dispose();
    },
  };
}
