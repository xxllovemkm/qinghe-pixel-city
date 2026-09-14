'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  createKnowledge3D,
  KnowledgeGraphData,
} from '@/lib/world/knowledge3d';
import type {
  LearnerProfiles,
  LearnerKnowledgeNode,
} from '@/lib/world/learning-contract';
import '@/app/knowledge-graph.css';

const percent = (value: number) => `${Math.floor(value * 100)}%`;
const subjectName = (subject: string) =>
  (
    ({
      mathematics: '数学',
      chinese: '语文',
      english: '英语',
      physics: '物理',
      chemistry: '化学',
      biology: '生物',
      history: '历史',
      geography: '地理',
      politics: '道德与法治',
      science: '科学',
      music: '音乐',
      art: '美术',
      information_technology: '信息科技',
      physical_education: '体育与健康',
    }) as Record<string, string>
  )[subject] ?? subject;
const basisName = (value?: string) =>
  (
    ({
      declared_initial_conditions: '人物初始学习设定',
      simulated_learning: '学习过程中的模拟状态',
      scored_visible_evidence: '本人作答与APP评分证据',
      declared_exposure_prior: '接触证据的初始预测',
    }) as Record<string, string>
  )[value ?? ''] ?? '学习状态';

export default function PersonalKnowledgeGraph({
  view,
  profiles,
  studentName,
  onEvidence,
  focusId,
  focusVersion = 0,
}: {
  view: 'truth' | 'app';
  profiles: LearnerProfiles;
  studentName: string;
  onEvidence?: (id: string) => void;
  focusId?: string;
  focusVersion?: number;
}) {
  const source = profiles[view];
  const graph = useMemo(() => {
    const nodes = source.graph.nodes.filter(
      (node) =>
        node.learned === true &&
        typeof node.mastery === 'number' &&
        Number.isFinite(node.mastery) &&
        node.mastery >= 0 &&
        node.mastery <= 1,
    );
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...source.graph,
      view,
      nodes,
      edges: source.graph.edges.filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    };
  }, [source.graph, view]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createKnowledge3D> | null>(null);
  const currentGraph = useRef<KnowledgeGraphData>(graph);
  const selectedRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const selected =
    graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  useEffect(() => {
    currentGraph.current = graph;
    engine.current?.setGraph(graph);
  }, [graph]);
  useEffect(() => {
    selectedRef.current = selected?.id ?? null;
    engine.current?.setSelected(selectedRef.current);
  }, [selected?.id]);
  useEffect(() => {
    let stopped = false;
    void import('@/lib/world/knowledge3d')
      .then(({ createKnowledge3D }) => {
        if (stopped || !canvas.current || !labels.current) return;
        try {
          engine.current = createKnowledge3D({
            canvas: canvas.current,
            labels: labels.current,
            onSelect: setSelectedId,
            onError: setError,
          });
          engine.current.setGraph(currentGraph.current);
          engine.current.setSelected(selectedRef.current);
          setReady(true);
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : '知识图谱暂时无法打开',
          );
        }
      })
      .catch((reason) => {
        if (!stopped)
          setError(
            reason instanceof Error ? reason.message : '知识图谱暂时无法打开',
          );
      });
    return () => {
      stopped = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      focusId &&
      currentGraph.current.nodes.some((node) => node.id === focusId)
    ) {
      const frame = requestAnimationFrame(() => {
        setSelectedId(focusId);
        engine.current?.focusNode(focusId);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [focusId, focusVersion, ready]);
  const select = (node: LearnerKnowledgeNode) => {
    setSelectedId(node.id);
    engine.current?.focusNode(node.id);
  };
  const title = view === 'truth' ? '真实画像' : 'APP 预测画像';
  const total = graph.nodes.length;
  const average = total
    ? graph.nodes.reduce((sum, node) => sum + node.mastery, 0) / total
    : null;
  return (
    <section
      className="learner-personal-graph"
      aria-label={`${studentName}的${title}`}
      data-profile-view={view}
    >
      <header className="learner-view-heading">
        <div>
          <h4>{title} · 3D 知识图</h4>
          <p>
            {view === 'truth'
              ? '模拟器记录人物已经学过的目标，并用掌握状态驱动后续表现。'
              : 'APP根据学生实际分享的题目、原答和批改形成掌握预测。'}
          </p>
        </div>
        <div className="learner-view-stat">
          <strong>{total}</strong>
          <span>已学目标</span>
          {average !== null && <small>本图均值 {percent(average)}</small>}
        </div>
      </header>
      {source.status === 'historical_state_unavailable' && (
        <p className="learner-state-note">
          这份历史运行没有保存连续真实掌握状态。新的学习过程将从有记录的时刻开始展示。
        </p>
      )}
      {source.status === 'tracked_from_checkpoint' && (
        <p className="learner-state-note">
          真实状态从模拟第 {Math.floor((source.since_sim_time ?? 0) / 1440) + 1}{' '}
          天的保存时刻开始追踪。
        </p>
      )}
      {view === 'truth' && typeof profiles.truth.fatigue === 'number' && (
        <p className="learner-fatigue">
          当前疲劳 <strong>{percent(profiles.truth.fatigue)}</strong>
          <meter
            min={0}
            max={1}
            value={profiles.truth.fatigue}
            aria-label="当前疲劳"
          />
        </p>
      )}
      <div className="learner-graph-workspace">
        <div className="learner-graph-map">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label={`${title}立体知识节点，可旋转缩放并选择`}
          />
          <div ref={labels} className="knowledge3d-labels" />
          <div className="learner-graph-controls">
            <button
              onClick={() => engine.current?.rotate()}
              aria-label={`旋转${title}知识图`}
            >
              旋转
            </button>
            <button
              onClick={() => engine.current?.zoom(1.3)}
              aria-label={`放大${title}知识图`}
            >
              ＋
            </button>
            <button
              onClick={() => engine.current?.zoom(1 / 1.3)}
              aria-label={`缩小${title}知识图`}
            >
              −
            </button>
            <button
              onClick={() => engine.current?.fit()}
              aria-label={`查看全部${title}节点`}
            >
              全图
            </button>
          </div>
          <small className="learner-graph-hint">
            拖动旋转 · 滚轮缩放 · 点击查看掌握与依据
          </small>
          {(error || !ready || !total) && (
            <p
              className="learner-graph-message"
              role={error ? 'alert' : 'status'}
            >
              {error ||
                (!ready
                  ? '正在打开知识图谱…'
                  : view === 'truth'
                    ? '学习发生后，已学目标和掌握度会出现在这里。'
                    : 'APP关联到本人学习证据后，目标和掌握预测会出现在这里。')}
            </p>
          )}
        </div>
        {selected && (
          <aside
            className="learner-node-detail"
            aria-label={`${title}节点详情`}
          >
            <small>{subjectName(selected.subject)}</small>
            <h4>{selected.name}</h4>
            <div className="learner-mastery-number">
              <span>{view === 'truth' ? '真实掌握度' : 'APP掌握预测'}</span>
              <strong>{percent(selected.mastery)}</strong>
            </div>
            <meter
              min={0}
              max={1}
              value={selected.mastery}
              aria-label={`${selected.name}掌握度`}
            />
            <p
              className="learner-stars"
              aria-label={`${selected.stars}星，共3星`}
            >
              {'★'.repeat(selected.stars)}
              {'☆'.repeat(3 - selected.stars)}
              <span>{selected.stars}/3</span>
            </p>
            <p>{basisName(selected.basis)}</p>
            {view === 'app' && (
              <small>
                有效评分证据权重{' '}
                {selected.effective_evidence?.toFixed(2) ?? '0.00'}
              </small>
            )}
            {selected.source?.quote && (
              <div className="learner-source-quote">
                <strong>教学设计 · 原始目标</strong>
                <blockquote>{selected.source.quote}</blockquote>
              </div>
            )}
            {!!selected.evidence_ids?.length && (
              <div className="learning-evidence-links">
                {selected.evidence_ids.slice(-6).map((id, index) => (
                  <button
                    key={id}
                    disabled={!onEvidence}
                    onClick={() => onEvidence?.(id)}
                  >
                    学习依据 {index + 1}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
      {!!total && (
        <div className="learner-node-list" aria-label={`${title}已学目标列表`}>
          {graph.nodes.map((node) => (
            <button
              key={node.id}
              aria-pressed={selected?.id === node.id}
              onClick={() => select(node)}
            >
              <span>{node.name}</span>
              <strong>{percent(node.mastery)}</strong>
            </button>
          ))}
        </div>
      )}
      <details className="learner-rubric">
        <summary>掌握量规与更新方式</summary>
        <p>{profiles.rubric[view].description}</p>
        <div className="learner-star-rubric">
          {profiles.rubric.stars.map((row) => (
            <span key={row.stars}>
              <strong>
                {row.stars} 星 · {percent(row.minimum)}起
              </strong>
              {row.label}
            </span>
          ))}
        </div>
        {view === 'truth' ? (
          <>
            <p>{profiles.rubric.truth.initial}</p>
            <p>{profiles.rubric.truth.learning}</p>
            <p>{profiles.rubric.truth.forgetting}</p>
            <p>{profiles.rubric.truth.fatigue}</p>
          </>
        ) : (
          <>
            <p>{profiles.rubric.app.prediction}</p>
            <p>{profiles.rubric.app.recency}</p>
            <p>{profiles.rubric.app.dialogue}</p>
          </>
        )}
        <p className="learning-muted">{profiles.rubric.validation}</p>
      </details>
    </section>
  );
}
