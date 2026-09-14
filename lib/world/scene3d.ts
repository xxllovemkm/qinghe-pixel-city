import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  W,
  H,
  createWorld,
  updateAgents,
  place,
  type Tool,
  type Building,
  type World,
} from './model';
import { renderGround, renderObjects } from './render';
import {
  buildCityGeometry,
  createAgentMeshes,
  disposeGeometry,
  buildingHeight,
  toX,
  toZ,
  fromXZ,
  OVERVIEW_DIRECTION,
  overviewDistance,
} from './geometry3d';
import { registerCityTools } from './agent-tools';
import { createDayActors, type DayActorSource } from './day-actors3d';
export type ViewOptions = {
  tool: Tool;
  paused: boolean;
  speed: number;
  labels: boolean;
  grid: boolean;
  night: boolean;
};
type Setup = {
  dayActors?: DayActorSource;
  saved?: CitySnapshot;
  canvas: HTMLCanvasElement;
  mini: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  options: () => ViewOptions;
  announce: (s: string) => void;
  onSelect: (b: Building) => void;
  onClock: (time: number) => void;
  onZoom: (n: number) => void;
  onCoords: (p: { x: number; y: number }) => void;
  onStats: (s: {
    population: number;
    buildings: number;
    trees: number;
  }) => void;
  onPause: () => void;
  onTool: (t: Tool) => void;
  onError: (message: string) => void;
};
export type CitySnapshot = {
  world: World;
  time: number;
  elapsed: number;
  position: [number, number, number];
  target: [number, number, number];
};
export function createCity3D(config: Setup) {
  const { canvas, mini, overlay } = config;
  const world = config.saved?.world ?? createWorld();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const dayBackground = new THREE.Color('#b5cfcb'),
    nightBackground = new THREE.Color('#172a40');
  scene.background = dayBackground.clone();
  scene.fog = new THREE.Fog(dayBackground, 530, 1050);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 1400);
  camera.position.copy(OVERVIEW_DIRECTION).multiplyScalar(320);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.rotateSpeed = 0.65;
  controls.panSpeed = 0.7;
  controls.zoomSpeed = 0.85;
  controls.minDistance = 24;
  controls.maxDistance = 530;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.screenSpacePanning = false;
  controls.maxTargetRadius = 175;
  const hemi = new THREE.HemisphereLight('#d4e7ed', '#756b4c', 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0cc', 3.3);
  sun.position.set(-115, 210, 95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -185;
  sun.shadow.camera.right = 185;
  sun.shadow.camera.top = 165;
  sun.shadow.camera.bottom = -165;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.1;
  scene.add(sun);
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 2200),
    new THREE.MeshStandardMaterial({ color: '#a8c1b4', roughness: 1 }),
  );
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.position.y = -5.3;
  backdrop.receiveShadow = true;
  scene.add(backdrop);
  const cached = document.createElement('canvas');
  cached.width = W;
  cached.height = H;
  const cg = cached.getContext('2d')!;
  renderGround(cg, world, false);
  const texture = new THREE.CanvasTexture(cached);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  let city = buildCityGeometry(world, texture);
  scene.add(city.root);
  const agents = createAgentMeshes(world);
  scene.add(agents.mesh);
  const dayActors = config.dayActors
    ? createDayActors(scene, 'city', config.dayActors)
    : null;
  const miniCache = document.createElement('canvas');
  miniCache.width = W;
  miniCache.height = H;
  const miniCtx = miniCache.getContext('2d')!,
    mc = mini.getContext('2d')!,
    oc = overlay.getContext('2d')!;
  const grid = new THREE.GridHelper(240, 75, '#f8e3ab', '#e1d9ae');
  grid.position.y = 0.04;
  grid.scale.z = H / W;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  grid.visible = false;
  scene.add(grid);
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: '#efca85',
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostMaterial);
  ghost.visible = false;
  scene.add(ghost);
  const raycaster = new THREE.Raycaster(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    ndc = new THREE.Vector2(),
    point = new THREE.Vector3();
  let width = 1,
    height = 1,
    baseDistance = 320,
    raf = 0,
    last = performance.now(),
    time = config.saved?.time ?? 510,
    elapsed = config.saved?.elapsed ?? 0,
    uiTime = 0,
    miniTime = 0,
    hover: { x: number; y: number } | null = null,
    disposed = false;
  let downPoint: {
    x: number;
    y: number;
    button: number;
    moved: boolean;
  } | null = null;
  const pointers = new Set<number>();
  let multiTouch = false;
  const stats = () =>
    config.onStats({
      population: world.buildings
        .filter((b) => b.kind === 'home')
        .reduce((n, b) => n + b.people, 0),
      buildings: world.buildings.length,
      trees: world.trees.length,
    });
  function refreshMini() {
    renderGround(miniCtx, world);
    renderObjects(miniCtx, world);
    stats();
  }
  refreshMini();
  function refresh() {
    renderGround(cg, world, false);
    texture.needsUpdate = true;
    scene.remove(city.root);
    disposeGeometry(city);
    city = buildCityGeometry(world, texture);
    scene.add(city.root);
    refreshMini();
  }
  function edit(t: Tool, x: number, y: number) {
    const result = place(world, t, x, y);
    refresh();
    config.announce(result);
    return result;
  }
  function moveTarget(x: number, z: number) {
    const target = new THREE.Vector3(
      THREE.MathUtils.clamp(x, -120, 120),
      0,
      THREE.MathUtils.clamp(z, -85, 85),
    );
    camera.position.add(target.clone().sub(controls.target));
    controls.target.copy(target);
    controls.update();
  }
  function orbit(angle: number, tilt = 0) {
    const offset = camera.position.clone().sub(controls.target),
      spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += angle;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + tilt,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
  }
  function zoom(factor: number) {
    const offset = camera.position.clone().sub(controls.target),
      distance = THREE.MathUtils.clamp(
        offset.length() / factor,
        controls.minDistance,
        controls.maxDistance,
      );
    camera.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
  }
  function focus(b?: Building) {
    if (b) {
      moveTarget(toX(b.x + b.w / 2), toZ(b.y + b.h / 2));
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .normalize()
        .multiplyScalar(Math.max(48, b.w * 0.27));
      camera.position.copy(controls.target).add(offset);
      config.onSelect(b);
    } else {
      controls.target.set(0, 0, 0);
      camera.position.copy(OVERVIEW_DIRECTION).multiplyScalar(baseDistance);
    }
    controls.update();
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const wasOverview =
      Math.abs(camera.position.distanceTo(controls.target) / baseDistance - 1) <
      0.06;
    baseDistance = overviewDistance(width / height);
    controls.maxDistance = Math.max(700, baseDistance * 1.8);
    camera.far = controls.maxDistance + 400;
    (scene.fog as THREE.Fog).near = baseDistance * 1.7;
    (scene.fog as THREE.Fog).far = baseDistance * 3.2;
    if (wasOverview)
      camera.position
        .sub(controls.target)
        .setLength(baseDistance)
        .add(controls.target);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    overlay.width = width * Math.min(devicePixelRatio, 2);
    overlay.height = height * Math.min(devicePixelRatio, 2);
  }
  function ray(e: { clientX: number; clientY: number }) {
    const box = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - box.left) / width) * 2 - 1,
      (-(e.clientY - box.top) / height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
  }
  function groundPoint() {
    const hit = raycaster.ray.intersectPlane(ground, point);
    return hit ? fromXZ(hit) : null;
  }
  const down = (e: PointerEvent) => {
    canvas.focus();
    pointers.add(e.pointerId);
    multiTouch ||= pointers.size > 1;
    downPoint = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
  };
  const move = (e: PointerEvent) => {
    if (
      downPoint &&
      Math.hypot(e.clientX - downPoint.x, e.clientY - downPoint.y) > 5
    )
      downPoint.moved = true;
    ray(e);
    hover = groundPoint();
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (multiTouch) {
      if (!pointers.size) multiTouch = false;
      downPoint = null;
      return;
    }
    if (!downPoint || downPoint.moved || downPoint.button !== 0) {
      downPoint = null;
      return;
    }
    downPoint = null;
    ray(e);
    if (dayActors?.pick(raycaster)) return;
    const p = groundPoint();
    const hits = raycaster.intersectObjects([city.solids, city.windows], false);
    const first = hits[0];
    const id =
      first && first.instanceId !== undefined
        ? first.object.userData.parts[first.instanceId]?.id
        : undefined;
    const tool = config.options().tool;
    if (tool === 'explore') {
      const b = world.buildings.find((b) => b.id === id);
      if (b) config.onSelect(b);
    } else if (tool === 'erase' && id) {
      const b = world.buildings.find((b) => b.id === id);
      if (b) edit(tool, b.x + b.w / 2, b.y + b.h / 2);
      else if (id.startsWith('tree:')) {
        const [, x, y] = id.split(':');
        edit(tool, Number(x), Number(y));
      }
    } else if (p) edit(tool, p.x, p.y);
  };
  const cancel = () => {
    pointers.clear();
    multiTouch = false;
    downPoint = null;
  };
  const leave = () => {
    hover = null;
  };
  const key = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).closest('input,textarea,button,[role="dialog"]')
    )
      return;
    const distance = camera.position.distanceTo(controls.target),
      step = distance * 0.035;
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let shift: THREE.Vector3 | null = null;
    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        config.onPause();
        return;
      case 'w':
      case 'arrowup':
        shift = forward.multiplyScalar(step);
        break;
      case 's':
      case 'arrowdown':
        shift = forward.multiplyScalar(-step);
        break;
      case 'd':
      case 'arrowright':
        shift = right.multiplyScalar(step);
        break;
      case 'a':
      case 'arrowleft':
        shift = right.multiplyScalar(-step);
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
      case '+':
      case '=':
        zoom(1.2);
        break;
      case '-':
        zoom(1 / 1.2);
        break;
      case '0':
        focus();
        break;
      case '1':
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
      case 'escape':
        config.onTool('explore');
        break;
      default:
        return;
    }
    e.preventDefault();
    if (shift)
      moveTarget(controls.target.x + shift.x, controls.target.z + shift.z);
  };
  const miniMove = (e: PointerEvent) => {
    const r = mini.getBoundingClientRect();
    moveTarget(
      toX(((e.clientX - r.left) / r.width) * W),
      toZ(((e.clientY - r.top) / r.height) * H),
    );
  };
  const contextLost = (e: Event) => {
    e.preventDefault();
    config.onError('3D 画面连接已中断，请点击重新加载。');
  };
  const events: [string, EventListener][] = [
    ['pointerdown', down as EventListener],
    ['pointermove', move as EventListener],
    ['pointerup', up as EventListener],
    ['pointercancel', cancel],
    ['pointerleave', leave],
    ['webglcontextlost', contextLost],
  ];
  events.forEach(([name, fn]) => canvas.addEventListener(name, fn));
  window.addEventListener('keydown', key);
  mini.addEventListener('pointerdown', miniMove);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  if (config.saved) {
    camera.position.fromArray(config.saved.position);
    controls.target.fromArray(config.saved.target);
    controls.update();
  }
  config.onClock(Math.floor(time));
  controls.update();
  const unregister = registerCityTools(world, edit);
  function drawMini() {
    mc.imageSmoothingEnabled = false;
    mc.clearRect(0, 0, mini.width, mini.height);
    mc.drawImage(miniCache, 0, 0, mini.width, mini.height);
    mc.fillStyle = '#132b362c';
    mc.fillRect(0, 0, mini.width, mini.height);
    const pts: THREE.Vector3[] = [];
    for (const [x, y] of [
      [-0.95, 0.88],
      [0.95, 0.88],
      [0.95, -0.88],
      [-0.95, -0.88],
    ]) {
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const p = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
      if (p) pts.push(p);
    }
    if (pts.length === 4) {
      mc.beginPath();
      pts.forEach((p, i) => {
        const wp = fromXZ(p),
          x = THREE.MathUtils.clamp((wp.x / W) * mini.width, 0, mini.width),
          y = THREE.MathUtils.clamp((wp.y / H) * mini.height, 0, mini.height);
        if (i === 0) mc.moveTo(x, y);
        else mc.lineTo(x, y);
      });
      mc.closePath();
      mc.fillStyle = '#fbe0a018';
      mc.fill();
      mc.strokeStyle = '#f8d697';
      mc.lineWidth = 1.5;
      mc.stroke();
    }
    const p = fromXZ(controls.target),
      x = (p.x / W) * mini.width,
      y = (p.y / H) * mini.height;
    mc.save();
    mc.translate(x, y);
    mc.rotate(-controls.getAzimuthalAngle());
    mc.beginPath();
    mc.moveTo(0, -7);
    mc.lineTo(4, 5);
    mc.lineTo(0, 3);
    mc.lineTo(-4, 5);
    mc.closePath();
    mc.fillStyle = '#fff1bf';
    mc.fill();
    mc.restore();
  }
  function drawLabels(visible: boolean) {
    const dpr = overlay.width / width;
    oc.setTransform(dpr, 0, 0, dpr, 0, 0);
    oc.clearRect(0, 0, width, height);
    if (!visible) return;
    const used: { x: number; y: number; w: number }[] = [];
    oc.font = '600 13px "PingFang SC", sans-serif';
    oc.textAlign = 'center';
    for (const b of world.buildings.filter(
      (b) => !['home', 'shop'].includes(b.kind),
    )) {
      const p = new THREE.Vector3(
        toX(b.x + b.w / 2),
        buildingHeight(b) + 7,
        toZ(b.y + b.h / 2),
      ).project(camera);
      if (p.z < 0 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1)
        continue;
      const x = (p.x * 0.5 + 0.5) * width,
        y = (-p.y * 0.5 + 0.5) * height,
        w = oc.measureText(b.name).width + 18;
      if (
        used.some(
          (r) =>
            Math.abs(r.y - y) < 27 && Math.abs(r.x - x) < (r.w + w) / 2 + 6,
        )
      )
        continue;
      used.push({ x, y, w });
      oc.fillStyle = '#203c3ce8';
      oc.fillRect(x - w / 2, y - 12, w, 25);
      oc.fillStyle = '#eddaa8';
      oc.fillText(b.name, x, y + 5);
      oc.fillStyle = '#e5c58b88';
      oc.fillRect(x, y + 13, 1, 8);
    }
  }
  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    const opts = config.options();
    if (config.dayActors) time = config.dayActors.simTime();
    if (!opts.paused) {
      elapsed += dt * opts.speed;
      if (!config.dayActors) time += dt * opts.speed * 2;
      updateAgents(world, dt * opts.speed);
      agents.update(elapsed);
    }
    dayActors?.update(dt, now / 1000);
    controls.update();
    camera.updateMatrixWorld();
    const hour = (time / 60) % 24,
      dark = opts.night
        ? 1
        : hour >= 19 || hour < 5
          ? 1
          : hour >= 17
            ? (hour - 17) / 2
            : hour < 7
              ? (7 - hour) / 2
              : 0;
    (scene.background as THREE.Color)
      .copy(dayBackground)
      .lerp(nightBackground, dark);
    (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
    hemi.intensity = 2.4 - dark * 1.65;
    sun.intensity = 3.3 - dark * 2.95;
    sun.color.set(dark > 0.5 ? '#c3d8ff' : '#fff0cc');
    (city.windows.material as THREE.MeshStandardMaterial).emissiveIntensity =
      dark * 2;
    city.ripples.position.z = Math.sin(elapsed * 0.65) * 0.18;
    grid.visible = opts.grid;
    ghost.visible =
      !!hover &&
      opts.tool !== 'explore' &&
      hover.x >= 0 &&
      hover.x <= W &&
      hover.y >= 0 &&
      hover.y <= H;
    if (ghost.visible && hover) {
      const h = opts.tool === 'home' ? 8 : opts.tool === 'tree' ? 6 : 0.15;
      ghost.position.set(
        toX(Math.round(hover.x / 8) * 8),
        h / 2 + 0.2,
        toZ(Math.round(hover.y / 8) * 8),
      );
      ghost.scale.set(
        opts.tool === 'home' ? 7.2 : 3.2,
        h,
        opts.tool === 'home' ? 5.6 : 3.2,
      );
      ghostMaterial.color.set(opts.tool === 'erase' ? '#ef8e77' : '#edce91');
    }
    renderer.render(scene, camera);
    canvas.dataset.scene = 'city';
    canvas.dataset.ready = 'true';
    drawLabels(opts.labels);
    dayActors?.labels(oc, camera, width, height);
    miniTime += dt;
    uiTime += dt;
    if (miniTime > 0.12) {
      drawMini();
      miniTime = 0;
    }
    if (uiTime > 0.3) {
      config.onClock(Math.floor(time));
      config.onZoom(
        Math.round(
          (baseDistance / camera.position.distanceTo(controls.target)) * 100,
        ),
      );
      if (hover)
        config.onCoords({ x: Math.round(hover.x), y: Math.round(hover.y) });
      uiTime = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    world,
    focus,
    zoom,
    orbit,
    refresh,
    edit,
    focusStudent: (id: string) => {
      const p = dayActors?.position(id);
      if (p) {
        const offset = camera.position.clone().sub(controls.target);
        controls.target.copy(p);
        camera.position
          .copy(p)
          .add(offset.setLength(Math.min(95, offset.length())));
        controls.update();
      }
    },
    snapshot: (): CitySnapshot => ({
      world,
      time,
      elapsed,
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    }),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      unregister();
      observer.disconnect();
      events.forEach(([name, fn]) => canvas.removeEventListener(name, fn));
      window.removeEventListener('keydown', key);
      mini.removeEventListener('pointerdown', miniMove);
      controls.dispose();
      disposeGeometry(city);
      agents.dispose();
      dayActors?.dispose();
      texture.dispose();
      ghost.geometry.dispose();
      ghostMaterial.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      backdrop.geometry.dispose();
      (backdrop.material as THREE.Material).dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export type City3DEngine = ReturnType<typeof createCity3D>;
