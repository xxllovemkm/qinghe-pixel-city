'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Building2,
  RotateCcw,
  RotateCw,
  School,
  TreePine,
  MousePointer2,
  Home,
  Landmark,
  Layers3,
  Compass,
  Plus,
  Minus,
  Maximize,
  Pause,
  Play,
  Sun,
  Moon,
  Users,
  Move,
  MapPin,
  Clock3,
  ChevronRight,
  X,
  HelpCircle,
  Trash2,
  Navigation,
  Check,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { type Tool, type Building, TYPE_NAMES } from '@/lib/world/model';
import { createCity3D, type City3DEngine } from '@/lib/world/scene3d';
const places = [
  { name: '青禾小学', sub: '启蒙与成长', color: '#efb961', icon: School },
  { name: '明德初中', sub: '探索更大的世界', color: '#80b9d2', icon: School },
  { name: '青河一中', sub: '青春与理想', color: '#e29179', icon: School },
  { name: '青河大学', sub: '知识与创新', color: '#b3a2d3', icon: Landmark },
];
const descriptions: Record<string, string> = {
  home: '街角的小院、沿路的花圃，还有窗后亮着的灯。这里是青河居民生活的地方。',
  primary: '有彩色教学楼、小型球场和活动庭院的社区小学。',
  middle: '教学楼与绿茵操场相伴，连接住宅社区与城市主街。',
  high: '红色跑道围绕着运动场，校门外就是宽阔的青河大道。',
  university: '东岸的开放校园，拥有教学楼、图书馆、中心喷泉与运动场。',
  hall: '青河市的公共地标，门前的喷泉广场是居民会面的地方。',
  tower: '矗立在东岸步道旁的钟楼，从桥上也能看见它的尖顶。',
  library: '河畔的公共阅读空间，树荫与安静的庭院围绕着它。',
  shop: '面向街道的小店，让城市的日常生活更丰富。',
};
function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            className={`icon-button ${active ? 'active' : ''}`}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export default function City() {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    miniRef = useRef<HTMLCanvasElement>(null),
    overlayRef = useRef<HTMLCanvasElement>(null),
    engine = useRef<City3DEngine | null>(null);
  const [renderError, setRenderError] = useState('');
  const [tool, setTool] = useState<Tool>('explore'),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1),
    [labels, setLabels] = useState(true),
    [grid, setGrid] = useState(false),
    [night, setNight] = useState(false),
    [layers, setLayers] = useState(false),
    [help, setHelp] = useState(false),
    [selected, setSelected] = useState<Building | null>(null),
    [toast, setToast] = useState(''),
    [stats, setStats] = useState({ population: 0, trees: 0, buildings: 0 }),
    [clock, setClock] = useState(8 * 60 + 30),
    [zoom, setZoom] = useState(100),
    [coords, setCoords] = useState({ x: 1200, y: 850 });
  const live = useRef({ tool, paused, speed, labels, grid, night });
  live.current = { tool, paused, speed, labels, grid, night };
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const announce = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  useEffect(() => {
    try {
      engine.current = createCity3D({
        canvas: canvasRef.current!,
        mini: miniRef.current!,
        overlay: overlayRef.current!,
        options: () => live.current,
        announce,
        onSelect: setSelected,
        onClock: setClock,
        onZoom: setZoom,
        onCoords: setCoords,
        onStats: setStats,
        onPause: () => setPaused((v) => !v),
        onTool: setTool,
        onError: setRenderError,
      });
    } catch (error) {
      console.error('3D city could not start', error);
      setRenderError(
        '无法启动 3D 画面，请在支持 WebGL 2 的浏览器中启用硬件加速后重新加载。',
      );
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
      clearTimeout(toastTimer.current);
    };
  }, [announce]);
  const focusPlace = (name: string) => {
    const b = engine.current?.world.buildings.find((b) => b.name === name);
    if (b) engine.current?.focus(b);
  };
  const h = Math.floor(clock / 60) % 24,
    m = clock % 60,
    isDark = night || h >= 19 || h < 6;
  return (
    <TooltipProvider delay={200}>
      <main className="city-app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <Building2 size={25} />
            </div>
            <div>
              <h1>
                青河市<span>QINGHE</span>
              </h1>
              <p>3D 体素世界 · 自由沙盒</p>
            </div>
          </div>
          <div className="world-badge">
            <span className="status-dot" />
            立体城市 · 360° 漫游
            <span className="tiny-divider" />
            种子 2417
          </div>
          <div className="top-actions">
            <span className="weather">
              {isDark ? <Moon size={18} /> : <Sun size={18} />}
              <span>{isDark ? '晴朗夜空' : '晴 · 微风'}</span>
            </span>
            <button
              className="mode-button"
              onClick={() => {
                setTool(tool === 'explore' ? 'home' : 'explore');
                announce(
                  tool === 'explore'
                    ? '选择空地，放置你的第一栋住宅'
                    : '已切换到探索模式',
                );
              }}
            >
              <span className="mode-dot" />
              {tool === 'explore' ? '自由探索' : '建造模式'}
              <ChevronRight size={14} />
            </button>
          </div>
        </header>
        <section className="world-view" aria-label="青河市交互沙盒地图">
          <canvas
            ref={canvasRef}
            className={`world-canvas ${tool !== 'explore' ? 'building-cursor' : ''}`}
            aria-label="立体像素城市。左键拖动旋转，右键拖动平移，滚轮缩放。Q/E 旋转，R/F 俯仰，WASD 移动。"
            tabIndex={0}
          />
          <canvas
            ref={overlayRef}
            className="world-labels"
            aria-hidden="true"
          />
          {renderError && (
            <div className="render-error panel" role="alert">
              <Building2 size={32} />
              <p>{renderError}</p>
              <button onClick={() => window.location.reload()}>
                重新加载 3D 世界
              </button>
            </div>
          )}
          <aside className="city-overview panel">
            <div className="eyebrow">
              <span className="status-dot" />
              城市概况<span className="live-tag">LIVE</span>
            </div>
            <div className="overview-title">
              一座城市，
              <br />
              无数个小日常。
            </div>
            <div className="city-stats">
              <div>
                <Users size={15} />
                <strong>{stats.population}</strong>
                <span>居民</span>
              </div>
              <div>
                <Building2 size={15} />
                <strong>{stats.buildings}</strong>
                <span>建筑</span>
              </div>
              <div>
                <TreePine size={15} />
                <strong>{stats.trees}</strong>
                <span>树木</span>
              </div>
            </div>
            <div className="overview-foot">
              <span className="soft-dot" />
              {paused
                ? '时间已暂停'
                : h < 7
                  ? '城市正在醒来'
                  : h < 17
                    ? '街道上，人来人往'
                    : h < 20
                      ? '晚风吹过河畔'
                      : '万家灯火，夜色温柔'}
            </div>
          </aside>
          <nav className="side-tools panel" aria-label="地图工具">
            <IconButton
              label="城市全景 · 0"
              onClick={() => engine.current?.focus()}
            >
              <Compass size={20} />
            </IconButton>
            <IconButton
              label="地图图层"
              active={layers}
              onClick={() => setLayers(!layers)}
            >
              <Layers3 size={20} />
            </IconButton>
            <IconButton
              label="切换夜景"
              active={night}
              onClick={() => setNight(!night)}
            >
              {night ? <Moon size={20} /> : <Sun size={20} />}
            </IconButton>
            <IconButton
              label="向左旋转 · Q"
              onClick={() => engine.current?.orbit(Math.PI / 8)}
            >
              <RotateCcw size={20} />
            </IconButton>
            <IconButton
              label="向右旋转 · E"
              onClick={() => engine.current?.orbit(-Math.PI / 8)}
            >
              <RotateCw size={20} />
            </IconButton>
            <div className="tool-divider" />
            <IconButton
              label="操作指南"
              active={help}
              onClick={() => setHelp(!help)}
            >
              <HelpCircle size={20} />
            </IconButton>
          </nav>
          {layers && (
            <div className="layers-panel panel">
              <div className="small-panel-title">
                地图图层
                <button aria-label="关闭图层" onClick={() => setLayers(false)}>
                  <X size={15} />
                </button>
              </div>
              <label>
                建筑名称
                <Switch
                  checked={labels}
                  onCheckedChange={setLabels}
                  aria-label="建筑名称"
                />
              </label>
              <label>
                建造网格
                <Switch
                  checked={grid}
                  onCheckedChange={setGrid}
                  aria-label="建造网格"
                />
              </label>
              <label>
                夜景模式
                <Switch
                  checked={night}
                  onCheckedChange={setNight}
                  aria-label="夜景模式"
                />
              </label>
            </div>
          )}
          {help && (
            <div className="help-panel panel">
              <div className="small-panel-title">
                在青河漫游
                <button
                  aria-label="关闭操作指南"
                  onClick={() => setHelp(false)}
                >
                  <X size={15} />
                </button>
              </div>
              <p>
                左键拖动旋转，右键拖动平移。
                <br />
                滚轮缩放；触屏单指旋转、双指缩放平移。
                <br />
                点击建筑查看详情。
                <br />
                点击缩略地图，快速抵达。
              </p>
              <div className="key-row">
                <kbd>W A S D</kbd>
                <span>移动视野</span>
              </div>
              <div className="key-row">
                <kbd>Q / E</kbd>
                <span>左右旋转</span>
              </div>
              <div className="key-row">
                <kbd>R / F</kbd>
                <span>调整俯仰</span>
              </div>
              <div className="key-row">
                <kbd>空格</kbd>
                <span>暂停 / 继续</span>
              </div>
              <div className="key-row">
                <kbd>1 — 4</kbd>
                <span>切换工具</span>
              </div>
              <div className="key-row">
                <kbd>0</kbd>
                <span>城市全景</span>
              </div>
            </div>
          )}
          <aside className="right-stack">
            <div className="minimap-panel panel">
              <div className="minimap-title">
                <span>
                  <Navigation size={15} />
                  城市缩略图
                </span>
                <span className="north">N ↑</span>
              </div>
              <canvas
                ref={miniRef}
                width={264}
                height={187}
                className="minimap"
                aria-label="点击缩略地图定位"
                role="img"
              />
              <div className="minimap-foot">
                <span>青河 · 镜头范围</span>
                <span>点击定位</span>
              </div>
            </div>
            <div className="places-panel panel">
              <div className="eyebrow">
                城市里的学校<span>04</span>
              </div>
              {places.map((p, i) => (
                <button
                  className="place-item"
                  key={p.name}
                  onClick={() => focusPlace(p.name)}
                >
                  <span
                    className="place-icon"
                    style={{ color: p.color, background: p.color + '12' }}
                  >
                    <p.icon size={19} />
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.sub}</small>
                  </span>
                  <span className="place-level">
                    {['小学', '初中', '高中', '大学'][i]}
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              <div className="places-footer">
                <MapPin size={12} />
                点击学校，近看立体校园
              </div>
            </div>
          </aside>
          <div className="compass-mark">
            <span>N</span>
            <Navigation size={29} />
            <span>青河 / QINGHE</span>
          </div>
          <div className="zoom-controls panel">
            <IconButton label="放大" onClick={() => engine.current?.zoom(1.2)}>
              <Plus size={19} />
            </IconButton>
            <span>{zoom}%</span>
            <IconButton
              label="缩小"
              onClick={() => engine.current?.zoom(1 / 1.2)}
            >
              <Minus size={19} />
            </IconButton>
            <span className="zoom-divider" />
            <IconButton
              label="适应城市全景"
              onClick={() => engine.current?.focus()}
            >
              <Maximize size={16} />
            </IconButton>
          </div>
          <div className="bottom-dock">
            <div className="tool-hint">
              <Move size={13} />
              {tool === 'explore'
                ? '左键旋转 · 右键平移 · 滚轮缩放'
                : tool === 'tree'
                  ? '点击空地种树 · 拖动旋转视角'
                  : tool === 'home'
                    ? '点击空地建住宅 · 拖动旋转视角'
                    : '点击移除你放置的房屋或树木'}
            </div>
            <div className="build-tools panel">
              {(
                [
                  { id: 'explore', name: '探索', icon: MousePointer2 },
                  { id: 'tree', name: '种树', icon: TreePine },
                  { id: 'home', name: '住宅', icon: Home },
                  { id: 'erase', name: '移除', icon: Trash2 },
                ] as const
              ).map((t, i) => (
                <button
                  key={t.id}
                  aria-pressed={tool === t.id}
                  className={`build-tool ${tool === t.id ? 'selected' : ''}`}
                  onClick={() => setTool(t.id)}
                >
                  <span className="tool-number">{i + 1}</span>
                  <t.icon size={23} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="time-panel panel">
            <div className="clock-icon">
              {isDark ? <Moon size={21} /> : <Sun size={23} />}
            </div>
            <div className="time-readout">
              <strong>
                {String(h).padStart(2, '0')}
                <span>:</span>
                {String(m).padStart(2, '0')}
              </strong>
              <small>
                第 {Math.floor(clock / 1440) + 1} 天 ·{' '}
                {isDark ? '夜晚' : '白昼'}
              </small>
            </div>
            <div className="time-divider" />
            <IconButton
              label={paused ? '继续模拟 · 空格' : '暂停模拟 · 空格'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </IconButton>
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={`speed-button ${speed === s ? 'chosen' : ''}`}
              >
                {s}×
              </button>
            ))}
          </div>
          {toast && (
            <div className="toast panel" role="status">
              <Check size={16} />
              {toast}
            </div>
          )}
        </section>
        <footer className="statusbar">
          <span>
            <span className="status-dot" />
            {paused ? '模拟已暂停' : '模拟运行中'}
            <span className="status-separator">/</span>自由沙盒
          </span>
          <span className="coordinate">
            X {coords.x.toString().padStart(4, '0')}
            <span>Y {coords.y.toString().padStart(4, '0')}</span>
          </span>
          <span>3D 体素城市 · 自由视角</span>
        </footer>
        <Sheet
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent className="building-sheet">
            <SheetHeader>
              <div className="detail-icon">
                {selected &&
                ['primary', 'middle', 'high', 'university'].includes(
                  selected.kind,
                ) ? (
                  <School size={34} />
                ) : (
                  <Building2 size={34} />
                )}
              </div>
              <div className="eyebrow">
                {selected && TYPE_NAMES[selected.kind]}
              </div>
              <SheetTitle className="detail-title">{selected?.name}</SheetTitle>
              <SheetDescription className="detail-description">
                {selected && descriptions[selected.kind]}
              </SheetDescription>
            </SheetHeader>
            <div className="detail-content">
              <div className="detail-fact">
                <Users size={18} />
                <span>
                  {selected?.kind === 'home'
                    ? '居住人数'
                    : ['primary', 'middle', 'high', 'university'].includes(
                          selected?.kind || '',
                        )
                      ? '规划学生容量'
                      : '空间容量'}
                </span>
                <strong>{selected?.people} 人</strong>
              </div>
              <div className="detail-fact">
                <MapPin size={18} />
                <span>城市坐标</span>
                <strong>
                  {selected?.x}, {selected?.y}
                </strong>
              </div>
              <div className="detail-fact">
                <Clock3 size={18} />
                <span>当前世界时间</span>
                <strong>
                  {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                </strong>
              </div>
              <button
                className="detail-focus"
                onClick={() => {
                  if (selected) engine.current?.focus(selected);
                  setSelected(null);
                }}
              >
                在地图上查看
                <Navigation size={16} />
              </button>
              <p className="detail-note">
                城市中的居民与车辆沿街道实时移动。此处人数为场景设定，学校容量不计入常住人口。
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </TooltipProvider>
  );
}
