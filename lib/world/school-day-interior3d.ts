import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createDayActors, type DayActorSource } from './day-actors3d';
import { classroomLayout, type DayClassroom } from './school-day-world';

export function createSchoolDayInterior3D(config: {
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  frame: 'classroom' | 'home';
  schoolTitle: string;
  classroom?: DayClassroom;
  actors: DayActorSource;
  title: () => string;
  onError: (text: string) => void;
  onExit?: () => void;
}) {
  const { canvas, overlay, frame } = config;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d5dfd4');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 180);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.465;
  controls.minDistance = 8;
  controls.maxDistance = 70;
  controls.target.set(frame === 'classroom' ? -6 : 0, 0, 0);
  camera.position.set(
    frame === 'classroom' ? 13 : 12,
    frame === 'classroom' ? 19 : 14,
    frame === 'classroom' ? 24 : 17,
  );
  scene.add(new THREE.HemisphereLight('#fffae9', '#7e9481', 2.4));
  const sun = new THREE.DirectionalLight('#fff0cb', 3.2);
  sun.position.set(-14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 20,
    bottom: -20,
    near: 1,
    far: 65,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const boxParts: {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: string;
  }[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) => {
    boxParts.push({ x, y, z, w, h, d, color });
  };
  const sign = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    text: string,
    bg = '#eaf0e3',
    fg = '#365647',
  ) => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const paint = (value: string) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = fg;
      ctx.font = '600 46px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const lines = value.split('\n');
      lines
        .slice(0, 3)
        .forEach((line, i) => ctx.fillText(line, 512, 85 + i * 64, 950));
    };
    paint(text);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const geometry = new THREE.PlaneGeometry(w, h);
    geometries.push(geometry);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return (value: string) => {
      paint(value);
      texture.needsUpdate = true;
    };
  };
  const desk = (x: number, z: number, color: string) => {
    box(x, 1.06, z, 1.9, 0.15, 1.3, '#d7ad78');
    for (const dx of [-0.74, 0.74])
      for (const dz of [-0.48, 0.48])
        box(x + dx, 0.5, z + dz, 0.09, 1, 0.09, '#758a7c');
    box(x, 0.58, z + 1, 0.85, 0.12, 0.85, color);
    box(x, 0.99, z + 1.38, 0.85, 0.75, 0.12, color);
    for (const dx of [-0.31, 0.31])
      for (const dz of [0.68, 1.3])
        box(x + dx, 0.28, z + dz, 0.07, 0.55, 0.07, '#627b6d');
    box(x - 0.25, 1.15, z, 0.86, 0.04, 0.88, '#fffbee');
    box(x + 0.47, 1.17, z - 0.1, 0.47, 0.07, 0.66, color);
    for (let i = 0; i < 4; i++)
      box(x - 0.25, 1.174, z - 0.25 + i * 0.14, 0.61, 0.008, 0.012, '#c7d0c3');
    box(x + 0.05, 1.19, z + 0.35, 0.58, 0.026, 0.035, '#c6954e');
  };
  const plant = (x: number, z: number) => {
    box(x, 0.3, z, 0.65, 0.6, 0.65, '#ba9474');
    box(x, 0.86, z, 0.12, 0.68, 0.12, '#80936b');
    box(x, 1.27, z, 0.8, 0.8, 0.75, '#789862');
    box(x - 0.3, 1.09, z + 0.12, 0.64, 0.52, 0.58, '#91aa70');
  };
  let board: (s: string) => void;
  const classSize =
    config.classroom?.student_count ||
    Math.max(
      1,
      config.actors
        .students()
        .filter(
          (student) =>
            !config.actors.classroomId?.() ||
            !student.classroom_id ||
            student.classroom_id === config.actors.classroomId(),
        ).length || 6,
    );
  const { columns, right, back } = classroomLayout(classSize);
  const door =
    frame === 'classroom'
      ? config.classroom?.door || { x: 2, z: 7 }
      : { x: 2.8, z: 3 };
  const centerX = (right - 15.5) / 2,
    centerZ = (back - 7.8) / 2;
  const roomWidth = right + 15.5,
    roomDepth = back + 7.8;
  const overview = () => {
    const extent = frame === 'classroom' ? Math.max(roomWidth, roomDepth) : 15;
    controls.target.set(
      frame === 'classroom' ? centerX : 0,
      0,
      frame === 'classroom' ? centerZ : 0,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3(extent * 0.83, extent * 0.95, extent * 1.2));
    controls.maxDistance = Math.max(70, extent * 4);
    camera.far = Math.max(180, extent * 8);
    camera.updateProjectionMatrix();
  };
  overview();
  if (frame === 'classroom') {
    box(centerX, -0.25, centerZ, roomWidth, 0.5, roomDepth, '#c3b896');
    box(
      centerX,
      0.02,
      centerZ,
      roomWidth - 0.3,
      0.06,
      roomDepth - 0.3,
      '#eee4c8',
    );
    for (let x = -15; x < right; x += 1.2)
      box(x, 0.061, centerZ, 0.018, 0.01, roomDepth - 0.5, '#d6ceb5');
    box(centerX, 2, -7.7, roomWidth, 4, 0.2, '#f7f0db');
    box(-15.4, 1.85, centerZ, 0.18, 3.7, roomDepth - 0.5, '#f2ead4');
    box(right - 0.1, 0.55, centerZ, 0.18, 1.1, roomDepth - 0.5, '#e0d6b7');
    for (const z of [-3.4, 2.1]) {
      box(-15.27, 2.3, z, 0.08, 1.9, 3.7, '#bddddd');
      for (const dz of [-1.85, 0, 1.85])
        box(-15.16, 2.3, z + dz, 0.12, 2, 0.08, '#fffbee');
      box(-15.16, 2.3, z, 0.12, 0.09, 3.8, '#fffbee');
    }
    box(-7, 2.5, -7.5, 9.9, 2.6, 0.16, '#b29561');
    board = sign(
      -7,
      2.5,
      -7.39,
      9.55,
      2.25,
      '今日课堂\n观察 · 表达 · 交流',
      '#355e4d',
      '#fff5dc',
    );
    sign(-7, 4.36, -7.65, 10, 0.6, config.schoolTitle, '#f3ecd6', '#5a7460');
    box(centerX, -0.1, back + 1.1, roomWidth, 0.2, 3, '#d2c9ad');
    for (const dx of [-1.3, 1.3])
      box(door.x + dx, 1.7, door.z, 0.16, 3.4, 0.25, '#a88e69');
    box(door.x, 3.35, door.z, 2.75, 0.18, 0.25, '#a88e69');
    sign(
      door.x,
      3.85,
      door.z + 0.16,
      3.2,
      0.55,
      config.classroom?.name || '教室入口',
      '#f7f0db',
      '#566b52',
    );
    sign(
      centerX,
      1.15,
      back + 2.55,
      Math.min(8, roomWidth - 1),
      0.6,
      `${config.classroom?.floor || 1} 楼走廊 · 通往校园`,
      '#e3ddc9',
      '#62775f',
    );
    box(-7, 0.11, -6.2, 12, 0.2, 2.5, '#c5aa7c');
    box(-12, 1.15, -5.6, 1.6, 0.15, 1, '#b79462');
    box(-12, 0.6, -5.6, 1.4, 1, 0.85, '#d5b483');
    const colors = [
      '#8ca99c',
      '#c69f81',
      '#96aabc',
      '#a7b483',
      '#b8a0b3',
      '#d4b576',
    ];
    for (let i = 0; i < classSize; i++)
      desk(
        -11 + (i % columns) * 4,
        -1 + Math.floor(i / columns) * 4,
        colors[i % colors.length],
      );
    plant(2.3, -6.6);
    plant(-14.3, 6.6);
    box(2, 1, -5.6, 1.5, 2, 1, '#ad9979');
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 5; i++)
        box(
          1.47 + i * 0.21,
          0.35 + r * 0.59,
          -5.02,
          0.15,
          0.46,
          0.65,
          colors[(i + r) % 6],
        );
  } else {
    box(0, -0.25, 0, 10, 0.5, 10, '#c4ae8e');
    box(0, 0.02, 0, 9.8, 0.06, 9.8, '#eadcc2');
    for (let x = -4.5; x < 5; x += 0.7)
      box(x, 0.057, 0, 0.012, 0.009, 9.8, '#d7c6a7');
    box(0, 1.8, -4.9, 10, 3.6, 0.18, '#faf0dd');
    box(-4.9, 1.25, 0, 0.18, 2.5, 10, '#e6dbc1');
    box(4.9, 0.4, 0, 0.18, 0.8, 10, '#d6c7a8');
    box(-3.1, 2.1, -4.78, 2.25, 1.8, 0.08, '#b1d5d4');
    for (const dx of [-1.12, 0, 1.12])
      box(-3.1 + dx, 2.1, -4.68, 0.08, 1.9, 0.12, '#fff8e7');
    box(-3.1, 2.1, -4.68, 2.3, 0.08, 0.12, '#fff8e7');
    box(2.7, 0.36, -1.6, 2.5, 0.7, 4.8, '#ac9573');
    box(2.7, 0.81, -1.5, 2.4, 0.28, 4.7, '#f5ecd5');
    box(2.7, 1, -0.9, 2.35, 0.19, 3.4, '#8ea9a3');
    box(2.7, 1.04, -3.3, 1.6, 0.2, 0.65, '#f5e7c9');
    box(-3.4, 1.35, -1.8, 1.5, 2.7, 1, '#b99b74');
    for (let r = 0; r < 4; r++) {
      box(-3.4, 0.35 + r * 0.62, -1.3, 1.4, 0.07, 1, '#d2b78e');
      for (let i = 0; i < 4; i++)
        box(
          -3.9 + i * 0.3,
          0.61 + r * 0.62,
          -1.16,
          0.21,
          0.43,
          0.58,
          ['#809f97', '#cdac7b', '#9aaabe', '#c49585'][i],
        );
    }
    desk(0, -0.2, '#8ca89a');
    box(0.64, 1.16, -0.3, 0.33, 0.055, 0.58, '#334943');
    box(0.64, 1.194, -0.3, 0.28, 0.01, 0.49, '#b8e5d5');
    box(-1.1, 1.25, -0.6, 0.11, 0.8, 0.1, '#bc9d67');
    box(-1.1, 1.7, -0.6, 0.55, 0.28, 0.5, '#f3dda6');
    plant(-4, 3.6);
    box(-0.2, 0.075, 2.3, 4, 0.025, 2.6, '#c7d2bd');
    board = sign(0.5, 2.7, -4.78, 4.6, 0.95, '家中学习', '#faf0dd', '#62775f');
    for (const dx of [-0.9, 0.9])
      box(door.x + dx, 1.5, door.z, 0.13, 3, 0.2, '#a58f70');
    box(door.x, 2.95, door.z, 1.95, 0.15, 0.2, '#a58f70');
    sign(
      door.x,
      3.3,
      door.z + 0.14,
      2.2,
      0.5,
      '家门 · 青河市',
      '#f8efd9',
      '#62775f',
    );
  }
  const boxes = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(boxes);
  for (const color of new Set(boxParts.map((part) => part.color))) {
    const parts = boxParts.filter((part) => part.color === color);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    materials.push(material);
    const mesh = new THREE.InstancedMesh(boxes, material, parts.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const transform = new THREE.Object3D();
    parts.forEach((part, index) => {
      transform.position.set(part.x, part.y, part.z);
      transform.scale.set(part.w, part.h, part.d);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  const actors = createDayActors(scene, frame, config.actors);
  const portalGeometry = new THREE.BoxGeometry(
    frame === 'classroom' ? 2.6 : 1.8,
    3,
    0.25,
  );
  geometries.push(portalGeometry);
  const portalMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materials.push(portalMaterial);
  const portal = new THREE.Mesh(portalGeometry, portalMaterial);
  portal.position.set(door.x, 1.5, door.z);
  scene.add(portal);
  const ctx = overlay.getContext('2d')!;
  let width = 1,
    height = 1,
    raf = 0,
    last = performance.now(),
    title = '',
    disposed = false;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const ratio = Math.min(devicePixelRatio, 2);
    overlay.width = width * ratio;
    overlay.height = height * ratio;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const raycaster = new THREE.Raycaster();
  let down: { x: number; y: number } | null = null;
  const pointerDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const pointerUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
      down = null;
      return;
    }
    down = null;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / width) * 2 - 1,
        (-(e.clientY - r.top) / height) * 2 + 1,
      ),
      camera,
    );
    if (!actors.pick(raycaster) && raycaster.intersectObject(portal).length)
      config.onExit?.();
  };
  const lost = (e: Event) => {
    e.preventDefault();
    config.onError('3D 画面暂时中断，请切换场景重试。');
  };
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('webglcontextlost', lost);
  function render(now: number) {
    if (disposed) return;
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    actors.update(dt, now / 1000);
    const next = config.title();
    if (next !== title) {
      title = next;
      board(title);
    }
    controls.update();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const ratio = overlay.width / width;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    actors.labels(ctx, camera, width, height);
    canvas.dataset.scene = frame;
    canvas.dataset.classroomId =
      frame === 'classroom' ? config.classroom?.id || '' : '';
    canvas.dataset.facilityId =
      frame === 'classroom'
        ? config.classroom?.facility_id || ''
        : config.actors.homeId?.() || '';
    canvas.dataset.floor =
      frame === 'classroom' ? String(config.classroom?.floor || 1) : '1';
    canvas.dataset.ready = 'true';
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);
  return {
    focus: overview,
    focusStudent(id: string) {
      const position = actors.position(id);
      if (!position) return;
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(position);
      camera.position.copy(position).add(offset);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('webglcontextlost', lost);
      controls.dispose();
      actors.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
