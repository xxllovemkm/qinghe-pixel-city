import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type KnowledgeGraphView = 'truth' | 'teacher' | 'app' | 'public';
export type KnowledgeGraphScope = {
  id: string;
  skill?: string;
  title?: string;
  objective?: string;
  stars?: number | null;
  mastery?: number;
  initial_mastery?: number;
  observed?: boolean;
  confidence?: number;
  evidence_ids?: string[];
  coverage?: string[];
  updated_day?: number;
  assessment_status?: string;
  total?: number;
  correct?: number;
  wrong?: number;
  accuracy?: number | null;
  min_items?: number;
  judgment?: string;
  evidence_type?: string;
  estimate?: number | null;
  history?: { event_id?: string; day?: number; reason?: string; judgment?: string; evidence_ids?: string[] }[];
};
export type KnowledgeGraphNode = {
  id: string;
  key?: string;
  name: string;
  subject: string;
  subject_id?: string;
  node_kind?: 'knowledge_point' | 'learning_scope' | 'learning_objective' | 'topic' | 'subject';
  learned?: boolean;
  basis?: string;
  parent_key?: string;
  stars?: number | null;
  mastery?: number | null;
  initial_mastery?: number | null;
  observed?: boolean;
  coverage?: { observed_scopes: number; total_scopes: number; complete?: boolean };
  aggregation?: string;
  scopes?: KnowledgeGraphScope[];
  evidence_ids?: string[];
  assessment_status?: string;
  total?: number;
  correct?: number;
  wrong?: number;
  accuracy?: number | null;
  min_items?: number;
  judgment?: string;
  evidence_type?: string;
  estimate?: number | null;
  confidence?: number;
  history?: { event_id?: string; day?: number; reason?: string; judgment?: string; evidence_ids?: string[] }[];
  node_state?: { judgment?: string; estimate?: number | null; evidence_type?: string; evidence_ids?: string[]; history?: KnowledgeGraphNode['history'] };
};
export type KnowledgeGraphEdge = {
  source: string;
  target: string;
  relation: 'prerequisite' | 'contains' | 'course_sequence' | 'related';
  origins?: string[];
  confidence?: number;
  rationale?: string;
};
export type KnowledgeGraphData = {
  schema: string;
  view: KnowledgeGraphView;
  student_id: string;
  graph_version?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

const palette = [
  '#d49e52',
  '#668eaf',
  '#89a273',
  '#b590b5',
  '#6ba5a0',
  '#c4816e',
  '#8591ba',
  '#c2ad71',
];

export const knowledgeSubjectName = (subject: string) =>
  (
    ({
      mathematics: '数学',
      math: '数学',
      chinese: '语文',
      english: '英语',
      science: '科学',
      politics: '道德与法治',
      information_technology: '信息科技',
      music: '音乐',
      physics: '物理',
      chemistry: '化学',
      biology: '生物',
      history: '历史',
      geography: '地理',
    }) as Record<string, string>
  )[subject] ?? subject;

export function knowledgeNodeProgress(
  node: KnowledgeGraphNode,
  view: KnowledgeGraphView,
): number | null {
  const measured = view === 'truth' || (view === 'app' && node.learned === true);
  const value = measured ? node.mastery : node.stars;
  if (
    node.observed === false ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  )
    return null;
  return Math.max(0, Math.min(1, measured ? value : value / 3));
}

function hash(value: string) {
  let result = 2166136261;
  for (const char of value)
    result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0) / 4294967295;
}

  /** Arrange learning targets by their typed relationships within each subject. */
function positionsFor(graph: KnowledgeGraphData) {
  const subjects = [...new Set(graph.nodes.map((node) => node.subject))].sort();
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const pending = new Map(nodes.map((node) => [node.id, 0]));
  const ranks = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    if (
      edge.relation === 'related' ||
      !ids.has(edge.source) ||
      !ids.has(edge.target) ||
      edge.source === edge.target
    )
      continue;
    children.set(edge.source, [
      ...(children.get(edge.source) ?? []),
      edge.target,
    ]);
    pending.set(edge.target, (pending.get(edge.target) ?? 0) + 1);
  }
  const queue = nodes
    .filter((node) => pending.get(node.id) === 0)
    .map((node) => node.id);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    for (const child of children.get(id) ?? []) {
      ranks.set(
        child,
        Math.max(ranks.get(child) ?? 0, Math.min(12, (ranks.get(id) ?? 0) + 1)),
      );
      pending.set(child, (pending.get(child) ?? 1) - 1);
      if (pending.get(child) === 0) queue.push(child);
    }
  }
  const groups = new Map(
    subjects.map((subject) => [
      subject,
      nodes.filter((node) => node.subject === subject),
    ]),
  );
  const maxCount = Math.max(
    1,
    ...[...groups.values()].map((group) => group.length),
  );
  const clusterRadius =
    subjects.length > 1
      ? Math.max(6, Math.sqrt(maxCount) * 2.5) * (1 + subjects.length / 5)
      : 0;
  const positions = new Map<string, THREE.Vector3>();
  subjects.forEach((subject, subjectIndex) => {
    const group = groups.get(subject)!;
    const angle = (subjectIndex / subjects.length) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.cos(angle) * clusterRadius,
      ((subjectIndex % 3) - 1) * 1.3,
      Math.sin(angle) * clusterRadius,
    );
    const rankGroups = new Map<number, KnowledgeGraphNode[]>();
    for (const node of group) {
      const rank = ranks.get(node.id) ?? 0;
      rankGroups.set(rank, [...(rankGroups.get(rank) ?? []), node]);
    }
    for (const [rank, members] of rankGroups) {
      members.forEach((node, index) => {
        const theta =
          index * Math.PI * (3 - Math.sqrt(5)) + hash(subject) * Math.PI;
        const spread = members.length === 1 ? 0.7 : 1.8 * Math.sqrt(index + 1);
        positions.set(
          node.id,
          center
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(theta) * spread,
                rank * 3.5 + (hash(node.id) - 0.5) * 2,
                Math.sin(theta) * spread,
              ),
            ),
        );
      });
    }
  });
  return { positions, subjects };
}

type Setup = {
  canvas: HTMLCanvasElement;
  labels: HTMLDivElement;
  onSelect: (id: string) => void;
  onError: (message: string) => void;
};

export function createKnowledge3D({
  canvas,
  labels,
  onSelect,
  onError,
}: Setup) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor('#edf1e8');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.7;
  controls.minDistance = 3;
  controls.maxDistance = 1800;
  controls.maxPolarAngle = Math.PI * 0.91;
  scene.add(new THREE.HemisphereLight('#fff9e9', '#536b61', 2.8));
  const light = new THREE.DirectionalLight('#fff6dc', 3);
  light.position.set(-20, 40, 25);
  scene.add(light);
  const graphRoot = new THREE.Group();
  scene.add(graphRoot);
  const nodeGeometry = new THREE.IcosahedronGeometry(0.7, 2);
  const nodeMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.54,
    metalness: 0.08,
  });
  const ringGeometry = new THREE.TorusGeometry(1.05, 0.055, 6, 40);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#31594d' });
  const selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
  selectionRing.visible = false;
  scene.add(selectionRing);
  const arrowGeometry = new THREE.ConeGeometry(0.23, 0.7, 7);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const scratch = new THREE.Object3D();
  const positions = new Map<string, THREE.Vector3>();
  let graph: KnowledgeGraphData | null = null;
  let mesh: THREE.InstancedMesh | null = null;
  let selected: string | null = null;
  let nodeLabels: {
    node: KnowledgeGraphNode;
    button: HTMLButtonElement;
    position: THREE.Vector3;
  }[] = [];
  let edgeObjects: {
    edge: KnowledgeGraphEdge;
    line: THREE.Mesh | THREE.Line;
    arrow: THREE.Mesh;
    material: THREE.MeshBasicMaterial | THREE.LineDashedMaterial;
    arrowMaterial: THREE.MeshBasicMaterial;
  }[] = [];
  let resources: (THREE.Material | THREE.BufferGeometry)[] = [];
  let center = new THREE.Vector3();
  let radius = 8;
  let width = 1;
  let height = 1;
  let frame = 0;
  let disposed = false;
  let lastLabels = 0;
  let lastSignature = '';
  let tween: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  let down = { x: 0, y: 0, button: 0 };

  function fit(immediate = false) {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov =
      2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const direction = new THREE.Vector3(0.65, 0.72, 1).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    let distance = 12;
    for (const point of positions.values()) {
      const offset = point.clone().sub(center);
      const depth = offset.dot(direction);
      distance = Math.max(
        distance,
        depth +
          (Math.abs(offset.dot(right)) + 1.4) / Math.tan(horizontalFov / 2),
        depth + (Math.abs(offset.dot(up)) + 1.8) / Math.tan(verticalFov / 2),
      );
    }
    const position = center
      .clone()
      .add(direction.multiplyScalar(distance * 1.12));
    if (immediate) {
      camera.position.copy(position);
      controls.target.copy(center);
      controls.update();
    } else tween = { position, target: center.clone() };
  }

  function setSelected(id: string | null) {
    selected = id;
    const position = id ? positions.get(id) : undefined;
    selectionRing.visible = !!position;
    if (position) selectionRing.position.copy(position);
    for (const item of edgeObjects) {
      const incident = id === item.edge.source || id === item.edge.target;
      item.material.opacity = id ? (incident ? 0.92 : 0.27) : 0.58;
      item.arrowMaterial.opacity = id ? (incident ? 1 : 0.3) : 0.8;
      item.material.color.set(incident ? '#637d52' : '#9cae97');
    }
    lastLabels = 0;
  }

  function focusNode(id: string) {
    const position = positions.get(id);
    if (!position) return;
    setSelected(id);
    const direction = camera.position.clone().sub(controls.target).normalize();
    tween = {
      position: position
        .clone()
        .add(direction.multiplyScalar(Math.min(18, Math.max(9, radius * 0.6)))),
      target: position.clone(),
    };
  }

  function setGraph(data: KnowledgeGraphData) {
    const signature = JSON.stringify(data);
    if (signature === lastSignature) return;
    const identityChanged =
      !graph ||
      graph.student_id !== data.student_id ||
      graph.view !== data.view;
    const previousPositions = identityChanged ? new Map<string, THREE.Vector3>() : new Map(positions);
    lastSignature = signature;
    graph = data;
    graphRoot.clear();
    for (const resource of resources) resource.dispose();
    resources = [];
    mesh?.dispose();
    mesh = null;
    edgeObjects = [];
    labels.replaceChildren();
    nodeLabels = [];
    positions.clear();
    const layout = positionsFor(data);
    for (const [id, position] of layout.positions) positions.set(id, previousPositions.get(id) ?? position);
    const subjectOrder = [
      '数学',
      '语文',
      '英语',
      '科学',
      '道德与法治',
      '信息科技',
      '音乐',
      '历史',
    ];
    const colors = new Map(
      layout.subjects.map((subject) => {
        const index = subjectOrder.indexOf(knowledgeSubjectName(subject));
        return [
          subject,
          palette[
            index >= 0 ? index : Math.floor(hash(subject) * palette.length)
          ],
        ];
      }),
    );
    if (data.nodes.length) {
      mesh = new THREE.InstancedMesh(
        nodeGeometry,
        nodeMaterial,
        data.nodes.length,
      );
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      data.nodes.forEach((node, index) => {
        const progress = knowledgeNodeProgress(node, data.view);
        scratch.position.copy(positions.get(node.id)!);
        scratch.scale.setScalar(
          (node.node_kind === 'learning_scope' ? 0.7 : 1.1) * (progress == null ? 0.73 : 0.83 + progress * 0.25),
        );
        scratch.updateMatrix();
        mesh!.setMatrixAt(index, scratch.matrix);
        const kind = node.judgment ?? node.node_state?.judgment ?? node.evidence_type;
        const color = new THREE.Color(kind === 'hypothesis' ? '#c79450' : kind === 'inferred' ? '#a780b5' : colors.get(node.subject));
        color.lerp(
          new THREE.Color('#d4dcd0'),
          progress == null ? 0.82 : 0.42 * (1 - progress),
        );
        mesh!.setColorAt(index, color);
        const button = document.createElement('button');
        button.type = 'button';
        button.hidden = true;
        button.className = 'knowledge3d-node-label';
        button.title = node.name;
        button.dataset.nodeId = node.id;
        button.dataset.evidenceKind = kind ?? (node.observed ? 'direct' : 'unknown');
        button.textContent =
          (node.name.length > 20 ? node.name.slice(0, 19) + '…' : node.name) +
          (node.learned === true && typeof node.mastery === 'number' && Number.isFinite(node.mastery)
            ? ` · ${Math.floor(node.mastery * 100)}%` : '');
        button.setAttribute('aria-label', `查看知识点：${node.name}` +
          (node.learned === true && typeof node.mastery === 'number' && Number.isFinite(node.mastery)
            ? `，掌握度${Math.floor(node.mastery * 100)}%` : ''));
        button.addEventListener('click', () => {
          onSelect(node.id);
          focusNode(node.id);
        });
        labels.appendChild(button);
        nodeLabels.push({ node, button, position: positions.get(node.id)! });
      });
      graphRoot.add(mesh);
    }
    for (const edge of data.edges) {
      const from = positions.get(edge.source);
      const to = positions.get(edge.target);
      if (!from || !to || from.distanceTo(to) < 0.1) continue;
      const midpoint = from.clone().add(to).multiplyScalar(0.5);
      const direction = to.clone().sub(from);
      const offset = new THREE.Vector3(
        -direction.z,
        direction.length() * 0.13,
        direction.x,
      )
        .normalize()
        .multiplyScalar(Math.min(1.6, direction.length() * 0.12));
      midpoint.add(offset);
      const curve = new THREE.QuadraticBezierCurve3(from, midpoint, to);
      const color = edge.relation === 'contains' ? '#a99b87' : edge.relation === 'course_sequence' ? '#729cb7' : '#789970';
      const dashed = edge.relation !== 'prerequisite';
      const geometry = dashed
        ? new THREE.BufferGeometry().setFromPoints(curve.getPoints(36))
        : new THREE.TubeGeometry(curve, 14, 0.045, 5, false);
      const material = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.68, dashSize: edge.relation === 'contains' ? 0.22 : 0.65, gapSize: 0.18 })
        : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58 });
      const line = dashed
        ? new THREE.Line(geometry, material as THREE.LineDashedMaterial)
        : new THREE.Mesh(geometry, material as THREE.MeshBasicMaterial);
      if (line instanceof THREE.Line) line.computeLineDistances();
      const arrowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
      });
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.visible = edge.relation !== 'contains' && edge.relation !== 'related';
      const arrowT = Math.max(0.5, 1 - 1.05 / direction.length());
      arrow.position.copy(curve.getPoint(arrowT));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        curve.getTangent(arrowT).normalize(),
      );
      graphRoot.add(line, arrow);
      resources.push(geometry, material, arrowMaterial);
      edgeObjects.push({ edge, line, arrow, material, arrowMaterial });
    }
    const bounds = new THREE.Box3();
    for (const position of positions.values()) bounds.expandByPoint(position);
    if (!bounds.isEmpty()) {
      center = bounds.getCenter(new THREE.Vector3());
      radius = Math.max(
        4,
        bounds.getSize(new THREE.Vector3()).length() / 2 + 1,
      );
    } else {
      center = new THREE.Vector3();
      radius = 8;
    }
    setSelected(selected && positions.has(selected) ? selected : null);
    if (
      identityChanged ||
      controls.target.distanceTo(center) > radius * 1.5
    )
      fit(true);
    else if (data.nodes.length < 2) fit(true);
  }

  function updateLabels(time: number) {
    if (time - lastLabels < 60) return;
    lastLabels = time;
    const neighborIds = new Set<string>();
    if (selected)
      for (const edge of graph?.edges ?? []) {
        if (edge.source === selected) neighborIds.add(edge.target);
        if (edge.target === selected) neighborIds.add(edge.source);
      }
    const rects: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = [];
    const items = [...nodeLabels].sort((a, b) =>
      a.node.id === selected
        ? -1
        : b.node.id === selected
          ? 1
          : camera.position.distanceToSquared(a.position) -
            camera.position.distanceToSquared(b.position),
    );
    let count = 0;
    for (const item of items) {
      const projected = item.position
        .clone()
        .add(new THREE.Vector3(0, 1.05, 0))
        .project(camera);
      const x = ((projected.x + 1) * width) / 2;
      const y = ((1 - projected.y) * height) / 2;
      const important =
        item.node.id === selected || neighborIds.has(item.node.id);
      const labelWidth = Math.min(210, item.node.name.length * 10 + 16);
      const rect = {
        left: x - labelWidth / 2,
        right: x + labelWidth / 2,
        top: y - 22,
        bottom: y + 2,
      };
      const overlap = rects.some(
        (other) =>
          rect.left < other.right &&
          rect.right > other.left &&
          rect.top < other.bottom &&
          rect.bottom > other.top,
      );
      const visible =
        projected.z > -1 &&
        projected.z < 1 &&
        x > 8 &&
        x < width - 8 &&
        y > 16 &&
        y < height - 12 &&
        (important || count < 32) &&
        (!overlap || item.node.id === selected);
      item.button.hidden = !visible;
      item.button.dataset.selected = String(item.node.id === selected);
      if (visible) {
        item.button.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        rects.push(rect);
        count++;
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const first = width === 1;
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (first) fit(true);
    lastLabels = 0;
  }
  function onDown(event: PointerEvent) {
    down = { x: event.clientX, y: event.clientY, button: event.button };
    tween = null;
  }
  function onUp(event: PointerEvent) {
    if (
      !mesh ||
      down.button !== 0 ||
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5
    )
      return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(mesh)[0];
    if (hit?.instanceId != null) {
      const node = graph?.nodes[hit.instanceId];
      if (node) {
        onSelect(node.id);
        setSelected(node.id);
      }
    }
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    onError('图谱画面暂时中断，可重新打开视图。');
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('webglcontextlost', onContextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function animate(time: number) {
    if (disposed) return;
    if (tween) {
      camera.position.lerp(tween.position, 0.12);
      controls.target.lerp(tween.target, 0.12);
      if (camera.position.distanceTo(tween.position) < 0.025) tween = null;
    }
    controls.update();
    selectionRing.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    updateLabels(time);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return {
    setGraph,
    setSelected,
    focusNode,
    fit: () => fit(),
    zoom: (factor: number) => {
      const direction = camera.position.clone().sub(controls.target);
      const length = THREE.MathUtils.clamp(
        direction.length() / factor,
        controls.minDistance,
        controls.maxDistance,
      );
      tween = {
        position: controls.target.clone().add(direction.setLength(length)),
        target: controls.target.clone(),
      };
    },
    rotate: () => {
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6);
      tween = {
        position: controls.target.clone().add(offset),
        target: controls.target.clone(),
      };
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      labels.replaceChildren();
      for (const resource of resources) resource.dispose();
      mesh?.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      arrowGeometry.dispose();
      renderer.dispose();
    },
  };
}
