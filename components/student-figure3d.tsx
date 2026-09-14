'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudentAppearance } from '@/lib/world/learning-contract';
import type { DayStudent } from '@/lib/world/school-day-contract';

export default function StudentFigure3D({
  name,
  appearance,
  color = '#609ce8',
}: {
  name: string;
  appearance?: Partial<StudentAppearance>;
  color?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<{ reset: () => void; rotate: () => void } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const skin = appearance?.skin ?? '#e8be99';
  const hair = appearance?.hair ?? '#403830';
  const clothing = appearance?.clothing ?? color;
  const height = appearance?.height ?? 1;
  useEffect(() => {
    let stopped = false;
    let dispose: (() => void) | undefined;
    void Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('@/lib/world/day-actors3d'),
    ])
      .then(([THREE, { OrbitControls }, { createDayActors }]) => {
        if (stopped || !canvas.current) return;
        const element = canvas.current;
        const renderer = new THREE.WebGLRenderer({
          canvas: element,
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor('#edf1e8');
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        const orbit = new OrbitControls(camera, element);
        orbit.enableDamping = true;
        orbit.enablePan = false;
        orbit.minDistance = 3.5;
        orbit.maxDistance = 12;
        orbit.maxPolarAngle = Math.PI * 0.78;
        const reset = () => {
          camera.position.set(4, 3.4, 6);
          orbit.target.set(0, 1.3, 0);
          orbit.update();
        };
        reset();
        scene.add(new THREE.HemisphereLight('#fff9e9', '#647266', 3));
        const light = new THREE.DirectionalLight('#fff8e8', 3);
        light.position.set(-4, 7, 6);
        scene.add(light);
        const floorGeometry = new THREE.CylinderGeometry(1.65, 1.75, 0.15, 48);
        const floorMaterial = new THREE.MeshStandardMaterial({
          color: '#dce6d4',
          roughness: 0.9,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.y = -0.04;
        scene.add(floor);
        const actor: DayStudent & { appearance: StudentAppearance } = {
          id: 'portrait',
          name,
          color: clothing,
          appearance: { skin, hair, clothing, height },
          school_building_id: '',
          home_building_id: '',
          location: { scene: 'campus', place_id: '', x: 0, z: 0, heading: 0 },
          classwork: [],
        };
        const figures = createDayActors(scene, 'campus', {
          students: () => [actor],
          selected: () => '',
          simTime: () => 0,
          onSelect: () => {},
        });
        const resize = () => {
          const bounds = element.parentElement!.getBoundingClientRect();
          const width = Math.max(1, bounds.width),
            panelHeight = Math.max(1, bounds.height);
          renderer.setSize(width, panelHeight, false);
          camera.aspect = width / panelHeight;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element.parentElement!);
        resize();
        let frame = 0;
        const render = () => {
          if (stopped) return;
          figures.update(1 / 60, 0);
          orbit.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        render();
        controls.current = {
          reset,
          rotate: () => {
            const offset = camera.position.clone().sub(orbit.target);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
            camera.position.copy(orbit.target).add(offset);
            orbit.update();
          },
        };
        setReady(true);
        setError('');
        dispose = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          figures.dispose();
          floorGeometry.dispose();
          floorMaterial.dispose();
          orbit.dispose();
          renderer.dispose();
        };
      })
      .catch((reason) => {
        if (!stopped)
          setError(
            reason instanceof Error ? reason.message : '人物视图暂时无法打开',
          );
      });
    return () => {
      stopped = true;
      controls.current = null;
      dispose?.();
    };
  }, [name, skin, hair, clothing, height]);
  return (
    <div className="learner-figure" aria-label={`${name}的立体人物`}>
      <div className="learner-figure-scene">
        <canvas
          ref={canvas}
          aria-label="立体学生，可拖动旋转、滚轮缩放"
          tabIndex={0}
        />
        {(!ready || error) && (
          <p role={error ? 'alert' : 'status'}>{error || '正在打开人物…'}</p>
        )}
      </div>
      <div className="learner-figure-controls">
        <span>拖动旋转 · 滚轮缩放</span>
        <button
          onClick={() => controls.current?.rotate()}
          aria-label="旋转学生人物"
        >
          旋转
        </button>
        <button
          onClick={() => controls.current?.reset()}
          aria-label="恢复学生人物视角"
        >
          复位
        </button>
      </div>
    </div>
  );
}
