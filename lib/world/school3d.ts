import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildSchoolGeometry,
  disposeSchoolGeometry,
  studentPosition,
  CAMPUS_DIRECTION,
  campusDistance,
} from './school-geometry';
import { editCampus, type Campus, type Facility } from './school-model';
import type { ViewOptions } from './scene3d';
import type { Tool } from './model';
import { createDayActors, type DayActorSource } from './day-actors3d';
export { SCHOOL_META, type SchoolKind } from './school-model';
type Setup = {
  dayActors?: DayActorSource;
  canvas: HTMLCanvasElement;
  mini: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  campus: Campus;
  options: () => ViewOptions;
  onSelect: (f: Facility) => void;
  onClock: (time: number) => void;
  onZoom: (zoom: number) => void;
  onCoords: (p: { x: number; y: number }) => void;
  onStats: (s: {
    population: number;
    buildings: number;
    trees: number;
  }) => void;
  onError: (message: string) => void;
  announce: (message: string) => void;
  onPause: () => void;
  onTool: (tool: Tool) => void;
};
export function createSchool3D(config: Setup) {
  const { canvas, mini, overlay, campus } = config;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene(),
    day = new THREE.Color('#b7cec8'),
    night = new THREE.Color('#1d2e40');
  scene.background = day.clone();
  const dayActors = config.dayActors
    ? createDayActors(scene, 'campus', config.dayActors)
    : null;
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  let baseDistance = 260;
  camera.position.copy(CAMPUS_DIRECTION).multiplyScalar(baseDistance);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.7;
  controls.screenSpacePanning = false;
  controls.minDistance = 18;
  controls.maxDistance = 900;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.maxTargetRadius = 105;
  const hemi = new THREE.HemisphereLight('#e0ebee', '#6f7859', 2.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d5', 3);
  sun.position.set(-90, 170, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -115,
    right: 115,
    top: 100,
    bottom: -100,
    near: 1,
    far: 380,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.07;
  scene.add(sun);
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ color: '#adc4b8', roughness: 1 }),
  );
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.position.y = -2.9;
  backdrop.receiveShadow = true;
  scene.add(backdrop);
  let geometry = buildSchoolGeometry(campus);
  scene.add(geometry.root);
  const grid = new THREE.GridHelper(180, 60, '#f5e3b2', '#dfe4c2');
  grid.scale.z = 140 / 180;
  grid.position.y = 0.16;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: '#e8c78e',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  ghost.visible = false;
  scene.add(ghost);
  const actors = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    38 * 4,
  );
  actors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  actors.castShadow = true;
  actors.frustumCulled = false;
  scene.add(actors);
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  function updateStudents() {
    for (let i = 0; i < 38; i++) {
      const p = studentPosition(campus, i, campus.elapsed);
      const step = Math.sin(campus.elapsed * 6 + i) * 0.16;
      [
        [0, 1.05, 0, 0.55, 0.8, 0.45, ['#e59670', '#6199b2', '#e3c675'][i % 3]],
        [0, 1.7, 0, 0.43, 0.48, 0.43, '#dcb38a'],
        [-0.16, 0.35, step, 0.2, 0.65, 0.22, '#536f77'],
        [0.16, 0.35, -step, 0.2, 0.65, 0.22, '#536f77'],
      ].forEach((part, j) => {
        const [dx, y, dz, w, h, d, col] = part as [
          number,
          number,
          number,
          number,
          number,
          number,
          string,
        ];
        dummy.position.set(
          p.x + dx * Math.cos(p.angle) + dz * Math.sin(p.angle),
          y,
          p.z - dx * Math.sin(p.angle) + dz * Math.cos(p.angle),
        );
        dummy.rotation.set(0, p.angle, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        actors.setMatrixAt(i * 4 + j, dummy.matrix);
        actors.setColorAt(i * 4 + j, color.set(col));
      });
    }
    actors.instanceMatrix.needsUpdate = true;
    if (actors.instanceColor) actors.instanceColor.needsUpdate = true;
  }
  updateStudents();
  const oc = overlay.getContext('2d')!,
    mc = mini.getContext('2d')!;
  const map = document.createElement('canvas');
  map.width = 540;
  map.height = 420;
  const mg = map.getContext('2d')!;
  const mapPoint = (p: { x: number; z: number }) => ({
    x: ((p.x + 90) / 180) * mini.width,
    y: ((p.z + 70) / 140) * mini.height,
  });
  function drawMapBase() {
    mg.setTransform(3, 0, 0, 3, 270, 210);
    mg.fillStyle = '#87ab73';
    mg.fillRect(-90, -70, 180, 140);
    mg.fillStyle = '#ddd8bb';
    for (const p of campus.paths)
      mg.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    for (const f of campus.facilities) {
      mg.fillStyle = f.color;
      if (f.type !== 'track')
        mg.fillRect(f.x - f.w / 2, f.z - f.d / 2, f.w, f.d);
      if (f.type === 'track') {
        mg.beginPath();
        mg.roundRect(f.x - 28, f.z - 19, 56, 38, 19);
        mg.fill();
        mg.fillStyle = '#79a665';
        mg.beginPath();
        mg.roundRect(f.x - 22.3, f.z - 13.3, 44.6, 26.6, 13.3);
        mg.fill();
      }
      if (f.type === 'building') {
        mg.fillStyle = '#fcf1c166';
        mg.fillRect(f.x - f.w / 2, f.z - f.d / 2, f.w, 2);
      }
    }
    for (const i of campus.items) {
      mg.fillStyle = i.type === 'tree' ? '#417652' : '#a57d51';
      mg.fillRect(i.x - 1.5, i.z - 1.5, 3, 3);
    }
  }
  function stats() {
    config.onStats({
      population: 38,
      buildings: campus.facilities.filter((f) => f.type === 'building').length,
      trees: campus.items.filter((i) => i.type === 'tree').length,
    });
  }
  function refresh() {
    scene.remove(geometry.root);
    disposeSchoolGeometry(geometry.root);
    geometry = buildSchoolGeometry(campus);
    scene.add(geometry.root);
    drawMapBase();
    stats();
  }
  drawMapBase();
  stats();
  config.onClock(Math.floor(campus.time));
  config.onCoords({ x: 90, y: 70 });
  const raycaster = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    ndc = new THREE.Vector2();
  let width = 1,
    height = 1,
    raf = 0,
    last = performance.now(),
    uiTimer = 0,
    disposed = false,
    hover: THREE.Vector3 | null = null;
  const pointers = new Set<number>();
  let multi = false,
    down: { x: number; y: number; button: number; moved: boolean } | null =
      null;
  function moveTarget(x: number, z: number) {
    const target = new THREE.Vector3(
      THREE.MathUtils.clamp(x, -90, 90),
      0,
      THREE.MathUtils.clamp(z, -70, 70),
    );
    camera.position.add(target.clone().sub(controls.target));
    controls.target.copy(target);
    controls.update();
  }
  function focus(f?: Facility) {
    if (f) {
      moveTarget(f.x, f.z);
      camera.position
        .copy(controls.target)
        .add(
          CAMPUS_DIRECTION.clone().multiplyScalar(
            Math.max(48, Math.max(f.w, f.d) * 2),
          ),
        );
      config.onSelect(f);
    } else {
      controls.target.set(0, 0, 0);
      camera.position.copy(CAMPUS_DIRECTION).multiplyScalar(baseDistance);
    }
    controls.update();
  }
  function orbit(a: number, t = 0) {
    const s = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    s.theta += a;
    s.phi = THREE.MathUtils.clamp(
      s.phi + t,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(s));
    controls.update();
  }
  function zoom(f: number) {
    const offset = camera.position.clone().sub(controls.target);
    camera.position
      .copy(controls.target)
      .add(
        offset.setLength(
          THREE.MathUtils.clamp(
            offset.length() / f,
            controls.minDistance,
            controls.maxDistance,
          ),
        ),
      );
    controls.update();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    const overview =
      Math.abs(camera.position.distanceTo(controls.target) / baseDistance - 1) <
      0.05;
    baseDistance = campusDistance(width / height);
    controls.maxDistance = baseDistance * 2;
    if (overview)
      camera.position
        .sub(controls.target)
        .setLength(baseDistance)
        .add(controls.target);
    camera.aspect = width / height;
    camera.far = controls.maxDistance + 300;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    overlay.width = width * Math.min(devicePixelRatio, 2);
    overlay.height = height * Math.min(devicePixelRatio, 2);
  }
  function ray(e: { clientX: number; clientY: number }) {
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / width) * 2 - 1,
      (-(e.clientY - r.top) / height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }
  function edit(tool: Tool, x: number, z: number) {
    const result = editCampus(campus, tool, x, z);
    refresh();
    config.announce(result);
    return result;
  }
  const pointerDown = (e: PointerEvent) => {
    canvas.focus();
    pointers.add(e.pointerId);
    multi ||= pointers.size > 1;
    down = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
  };
  const pointerMove = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5)
      down.moved = true;
    hover = ray(e);
  };
  const pointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (multi) {
      if (!pointers.size) multi = false;
      down = null;
      return;
    }
    if (!down || down.moved || down.button !== 0) {
      down = null;
      return;
    }
    down = null;
    const p = ray(e),
      tool = config.options().tool;
    if (dayActors?.pick(raycaster)) return;
    const hit = raycaster.intersectObjects(geometry.root.children, false)[0];
    const id =
      hit?.instanceId !== undefined
        ? hit.object.userData.parts[hit.instanceId]?.id
        : hit?.object.userData.facility;
    if (tool === 'explore') {
      const f =
        campus.facilities.find((f) => f.id === id) ??
        (p
          ? campus.facilities.find(
              (f) =>
                Math.abs(f.x - p.x) < f.w / 2 && Math.abs(f.z - p.z) < f.d / 2,
            )
          : undefined);
      if (f) config.onSelect(f);
    } else if (tool === 'erase' && id) {
      const item = campus.items.find((i) => i.id === id);
      if (item) edit(tool, item.x, item.z);
      else config.announce('请选择你放置的树木或长椅');
    } else if (p) edit(tool, p.x, p.z);
  };
  const cancel = () => {
    down = null;
    pointers.clear();
    multi = false;
  };
  const leave = () => {
    hover = null;
  };
  const miniClick = (e: PointerEvent) => {
    const r = mini.getBoundingClientRect();
    moveTarget(
      ((e.clientX - r.left) / r.width) * 180 - 90,
      ((e.clientY - r.top) / r.height) * 140 - 70,
    );
  };
  const key = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).closest('input,textarea,button,[role="dialog"]')
    )
      return;
    const distance = camera.position.distanceTo(controls.target),
      forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let shift: THREE.Vector3 | undefined;
    switch (e.key.toLowerCase()) {
      case ' ':
        config.onPause();
        break;
      case 'w':
      case 'arrowup':
        shift = forward;
        break;
      case 's':
      case 'arrowdown':
        shift = forward.negate();
        break;
      case 'a':
      case 'arrowleft':
        shift = right.negate();
        break;
      case 'd':
      case 'arrowright':
        shift = right;
        break;
      case 'q':
        orbit(0.16);
        break;
      case 'e':
        orbit(-0.16);
        break;
      case 'r':
        orbit(0, -0.1);
        break;
      case 'f':
        orbit(0, 0.1);
        break;
      case '0':
        focus();
        break;
      case '+':
      case '=':
        zoom(1.2);
        break;
      case '-':
        zoom(1 / 1.2);
        break;
      case '1':
      case 'escape':
        config.onTool('explore');
        break;
      case '2':
        config.onTool('tree');
        break;
      case '3':
        config.onTool('home');
        break;
      case '4':
        config.onTool('erase');
        break;
      default:
        return;
    }
    e.preventDefault();
    if (shift)
      moveTarget(
        controls.target.x + shift.x * distance * 0.03,
        controls.target.z + shift.z * distance * 0.03,
      );
  };
  const lost = (e: Event) => {
    e.preventDefault();
    config.onError('3D 画面连接已中断，请重新加载。');
  };
  const events: [string, EventListener][] = [
    ['pointerdown', pointerDown as EventListener],
    ['pointermove', pointerMove as EventListener],
    ['pointerup', pointerUp as EventListener],
    ['pointercancel', cancel],
    ['pointerleave', leave],
    ['webglcontextlost', lost],
  ];
  events.forEach(([name, fn]) => canvas.addEventListener(name, fn));
  mini.addEventListener('pointerdown', miniClick);
  window.addEventListener('keydown', key);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function drawMini() {
    mc.clearRect(0, 0, mini.width, mini.height);
    mc.imageSmoothingEnabled = false;
    mc.drawImage(map, 0, 0, mini.width, mini.height);
    mc.beginPath();
    let count = 0;
    for (const [x, y] of [
      [-0.94, 0.9],
      [0.94, 0.9],
      [0.94, -0.9],
      [-0.94, -0.9],
    ]) {
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (p) {
        const q = mapPoint(p);
        count++;
        if (count === 1) mc.moveTo(q.x, q.y);
        else mc.lineTo(q.x, q.y);
      }
    }
    if (count === 4) {
      mc.closePath();
      mc.fillStyle = '#fff0b321';
      mc.fill();
      mc.strokeStyle = '#ffdc8d';
      mc.lineWidth = 1.5;
      mc.stroke();
    }
    const p = mapPoint(controls.target);
    mc.save();
    mc.translate(p.x, p.y);
    mc.rotate(-controls.getAzimuthalAngle());
    mc.beginPath();
    mc.moveTo(0, -6);
    mc.lineTo(-4, 5);
    mc.lineTo(4, 5);
    mc.closePath();
    mc.fillStyle = '#fff6d4';
    mc.fill();
    mc.restore();
  }
  function labels() {
    const ratio = overlay.width / width;
    oc.setTransform(ratio, 0, 0, ratio, 0, 0);
    oc.clearRect(0, 0, width, height);
    if (!config.options().labels) return;
    oc.font = '600 13px "PingFang SC", sans-serif';
    oc.textAlign = 'center';
    const used: { x: number; y: number; w: number }[] = [];
    for (const f of campus.facilities) {
      const p = new THREE.Vector3(
        f.x,
        f.type === 'building' ? f.h + 3 : Math.max(1, f.h + 1),
        f.z,
      ).project(camera);
      if (p.z < 0 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1)
        continue;
      const x = (p.x * 0.5 + 0.5) * width,
        y = (-p.y * 0.5 + 0.5) * height,
        w = oc.measureText(f.name).width + 16;
      if (
        used.some(
          (r) =>
            Math.abs(r.y - y) < 27 && Math.abs(r.x - x) < (r.w + w) / 2 + 4,
        )
      )
        continue;
      used.push({ x, y, w });
      oc.fillStyle = '#203c3ce8';
      oc.fillRect(x - w / 2, y - 12, w, 24);
      oc.fillStyle = '#f3e4bc';
      oc.fillText(f.name, x, y + 5);
    }
  }
  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    const opts = config.options();
    if (config.dayActors) campus.time = config.dayActors.simTime();
    if (!opts.paused) {
      campus.elapsed += dt * opts.speed;
      if (!config.dayActors) campus.time += dt * opts.speed * 2;
      updateStudents();
    }
    dayActors?.update(dt, now / 1000);
    const hour = (campus.time / 60) % 24,
      dark = opts.night
        ? 1
        : hour >= 19 || hour < 5
          ? 1
          : hour >= 17
            ? (hour - 17) / 2
            : hour < 7
              ? (7 - hour) / 2
              : 0;
    (scene.background as THREE.Color).copy(day).lerp(night, dark);
    hemi.intensity = 2.5 - dark * 1.6;
    sun.intensity = 3 - dark * 2.7;
    sun.color.set(dark > 0.5 ? '#bad2ef' : '#fff1d5');
    (
      geometry.windows.material as THREE.MeshStandardMaterial
    ).emissiveIntensity = dark * 2;
    grid.visible = opts.grid;
    ghost.visible =
      !!hover &&
      opts.tool !== 'explore' &&
      Math.abs(hover.x) < 87 &&
      Math.abs(hover.z) < 67;
    if (hover && ghost.visible) {
      const h = opts.tool === 'tree' ? 5 : opts.tool === 'home' ? 1 : 0.2;
      ghost.position.set(
        Math.round(hover.x),
        h / 2 + 0.15,
        Math.round(hover.z),
      );
      ghost.scale.set(
        opts.tool === 'tree' ? 3.5 : 3,
        h,
        opts.tool === 'home' ? 1.5 : 3.5,
      );
    }
    controls.update();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    labels();
    dayActors?.labels(oc, camera, width, height);
    uiTimer += dt;
    if (uiTimer > 0.2) {
      drawMini();
      config.onClock(Math.floor(campus.time));
      config.onZoom(
        Math.round(
          (baseDistance / camera.position.distanceTo(controls.target)) * 100,
        ),
      );
      if (hover)
        config.onCoords({
          x: Math.round(hover.x + 90),
          y: Math.round(hover.z + 70),
        });
      uiTimer = 0;
    }
    canvas.dataset.scene = campus.kind;
    canvas.dataset.ready = 'true';
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    campus,
    facilities: campus.facilities,
    focus,
    zoom,
    orbit,
    edit,
    focusStudent: (id: string) => {
      const p = dayActors?.position(id);
      if (p) {
        const offset = camera.position.clone().sub(controls.target);
        controls.target.copy(p);
        camera.position
          .copy(p)
          .add(offset.setLength(Math.min(80, offset.length())));
        controls.update();
      }
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      events.forEach(([name, fn]) => canvas.removeEventListener(name, fn));
      mini.removeEventListener('pointerdown', miniClick);
      window.removeEventListener('keydown', key);
      controls.dispose();
      dayActors?.dispose();
      disposeSchoolGeometry(geometry.root);
      actors.geometry.dispose();
      (actors.material as THREE.Material).dispose();
      ghost.geometry.dispose();
      ghost.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      backdrop.geometry.dispose();
      backdrop.material.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export type School3DEngine = ReturnType<typeof createSchool3D>;
