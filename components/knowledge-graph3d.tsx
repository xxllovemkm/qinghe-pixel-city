'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Expand,
  Focus,
  GitBranch,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  Star,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  KnowledgeGraphData,
  KnowledgeGraphNode,
  KnowledgeGraphScope,
  KnowledgeGraphView,
  createKnowledge3D,
} from '@/lib/world/knowledge3d';
import type { PracticePlan } from '@/lib/world/learning-contract';
import '@/app/knowledge-graph.css';

export type KnowledgeGraphPracticePlan = PracticePlan & {
  node_key?: string | null;
  scope_id?: string;
};
export type KnowledgeGraph3DProps = {
  runId?: string;
  view: KnowledgeGraphView;
  graph?: KnowledgeGraphData | null;
  studentName?: string;
  practicePlans?: KnowledgeGraphPracticePlan[];
  onEvidence?: (id: string) => void;
  onExpandNode?: (node: KnowledgeGraphNode) => void;
};

const percent = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
    : '尚无记录';
const subjectName = (subject: string) =>
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
    }) as Record<string, string>
  )[subject] ?? subject;

function NodeStars({ value }: { value?: number | null }) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return <span className="knowledge3d-unknown">尚无记录</span>;
  const count = Math.max(0, Math.min(3, Math.round(value)));
  return (
    <span className="knowledge3d-stars" aria-label={`${count} 颗星，共 3 颗`}>
      {[0, 1, 2].map((index) => (
        <Star
          key={index}
          size={17}
          data-lit={index < count}
          aria-hidden="true"
        />
      ))}
      <span>{count}/3</span>
    </span>
  );
}

function Evidence({
  ids,
  onEvidence,
}: {
  ids?: string[];
  onEvidence?: (id: string) => void;
}) {
  if (!ids?.length) return null;
  return (
    <div className="knowledge3d-evidence">
      {ids.slice(-8).map((id, index) => (
        <button
          key={id}
          disabled={!onEvidence}
          onClick={() => onEvidence?.(id)}
        >
          依据 {Math.max(0, ids.length - 8) + index + 1}
        </button>
      ))}
      {ids.length > 8 && <span>共 {ids.length} 条</span>}
    </div>
  );
}

function ScopeDetails({
  scope,
  view,
  onEvidence,
}: {
  scope: KnowledgeGraphScope;
  view: KnowledgeGraphView;
  onEvidence?: (id: string) => void;
}) {
  return (
    <div className="knowledge3d-scope">
      <div>
        <strong>{scope.title || scope.skill || scope.id}</strong>
        {view === 'truth' ? (
          <span className="knowledge3d-value">
            {scope.observed === false ? '尚无记录' : percent(scope.mastery)}
          </span>
        ) : (
          <NodeStars value={scope.observed === false ? null : scope.stars} />
        )}
      </div>
      {scope.objective && <p>{scope.objective}</p>}
      {view === 'app' && (
        <>
          <Evidence ids={scope.evidence_ids} onEvidence={onEvidence} />
          {scope.updated_day != null && (
            <small>
              第 {scope.updated_day} 天更新
              {typeof scope.confidence === 'number'
                ? ` · 证据置信度 ${percent(scope.confidence)}`
                : ''}
            </small>
          )}
        </>
      )}
    </div>
  );
}

export default function KnowledgeGraph3D(props: KnowledgeGraph3DProps) {
  return (
    <KnowledgeGraphCard
      key={`${props.runId ?? 'public'}:${props.view}:${props.graph?.student_id ?? ''}:${props.graph?.graph_version ?? ''}`}
      {...props}
    />
  );
}

function KnowledgeGraphCard({
  view,
  graph,
  studentName,
  practicePlans = [],
  onEvidence,
  onExpandNode,
}: KnowledgeGraph3DProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createKnowledge3D> | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const validGraph = graph?.view === view ? graph : null;
  const subjects = useMemo(
    () =>
      [...new Set(validGraph?.nodes.map((node) => node.subject) ?? [])].sort(),
    [validGraph],
  );
  const visibleGraph = useMemo<KnowledgeGraphData>(() => {
    const nodes = (validGraph?.nodes ?? []).filter(
      (node) => subject === 'all' || node.subject === subject,
    );
    const ids = new Set(nodes.map((node) => node.id));
    return {
      schema: validGraph?.schema ?? 'qinghe-profile-graph/1',
      view,
      student_id: validGraph?.student_id ?? '',
      graph_version: validGraph?.graph_version,
      nodes,
      edges: (validGraph?.edges ?? []).filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    };
  }, [validGraph, subject, view]);
  const currentGraph = useRef(visibleGraph);
  const currentSelection = useRef(selectedId);
  const selectedNode = visibleGraph.nodes.find(
    (node) => node.id === selectedId,
  );
  const results = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    if (!text) return [];
    return (validGraph?.nodes ?? [])
      .filter((node) =>
        [
          node.name,
          node.subject,
          node.key,
          ...(node.scopes ?? []).flatMap((scope) => [
            scope.title,
            scope.objective,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(text),
      )
      .slice(0, 8);
  }, [query, validGraph]);
  const currentPlans =
    view === 'app' && selectedNode
      ? practicePlans.filter(
          (plan) =>
            plan.student_id === validGraph?.student_id &&
            (plan.node_key === selectedNode.key ||
              plan.node_key === selectedNode.id ||
              selectedNode.scopes?.some(
                (scope) =>
                  scope.id === plan.scope_id || scope.skill === plan.skill,
              )),
        )
      : [];
  const priorNodes = selectedNode
    ? visibleGraph.edges
        .filter(
          (edge) =>
            edge.target === selectedNode.id && edge.relation === 'prerequisite',
        )
        .map((edge) =>
          visibleGraph.nodes.find((node) => node.id === edge.source),
        )
        .filter((node): node is KnowledgeGraphNode => !!node)
    : [];
  const nextNodes = selectedNode
    ? visibleGraph.edges
        .filter(
          (edge) =>
            edge.source === selectedNode.id && edge.relation === 'prerequisite',
        )
        .map((edge) =>
          visibleGraph.nodes.find((node) => node.id === edge.target),
        )
        .filter((node): node is KnowledgeGraphNode => !!node)
    : [];
  const relatedRelations = selectedNode
    ? visibleGraph.edges.filter(
        (edge) =>
          edge.relation !== 'prerequisite' &&
          (edge.source === selectedNode.id || edge.target === selectedNode.id),
      )
    : [];

  useEffect(() => {
    currentGraph.current = visibleGraph;
    currentSelection.current = selectedId;
  }, [visibleGraph, selectedId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    let stopped = false;
    let renderer: ReturnType<typeof createKnowledge3D> | undefined;
    void import('@/lib/world/knowledge3d')
      .then(({ createKnowledge3D: create }) => {
        if (stopped) return;
        renderer = create({
          canvas,
          labels,
          onSelect: (id) => setSelectedId(id),
          onError: (message) => {
            if (!stopped) setError(message);
          },
        });
        engine.current = renderer;
        renderer.setGraph(currentGraph.current);
        renderer.setSelected(currentSelection.current);
        setReady(true);
        setError('');
      })
      .catch(() => {
        if (!stopped) setError('3D 图谱暂时无法显示，请检查浏览器硬件加速。');
      });
    return () => {
      stopped = true;
      renderer?.dispose();
      if (engine.current === renderer) engine.current = null;
    };
  }, [expanded]);
  useEffect(() => {
    engine.current?.setGraph(visibleGraph);
    if (
      pendingFocus.current &&
      visibleGraph.nodes.some((node) => node.id === pendingFocus.current)
    ) {
      engine.current?.focusNode(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [visibleGraph, selectedId]);
  useEffect(() => {
    engine.current?.setSelected(selectedId);
  }, [selectedId]);
  useEffect(() => {
    if (!expanded) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
      }
      if (event.key === 'Tab') {
        const elements = [
          ...(cardRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, select, [tabindex="0"]',
          ) ?? []),
        ].filter(
          (element) => !element.hidden && element.getClientRects().length,
        );
        const first = elements[0];
        const last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === cardRef.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus({ preventScroll: true });
    };
  }, [expanded]);

  function selectNode(node: KnowledgeGraphNode) {
    pendingFocus.current = node.id;
    setSelectedId(node.id);
    setQuery('');
    if (subject !== 'all' && subject !== node.subject) setSubject('all');
    engine.current?.focusNode(node.id);
  }
  function openEvidence(id: string) {
    if (expanded) setExpanded(false);
    onEvidence?.(id);
  }
  const viewLabel = {
    truth: '真实学习状态',
    app: 'APP 学习记忆',
    teacher: '教师课堂观察',
    public: '公共知识结构',
  }[view];
  const judgmentLabel = (value?: string) =>
    (
      ({
        unknown: '尚无证据',
        encountered: '已接触，待判断',
        exposed: '已接触，待判断',
        exposed_pending: '已接触，待判断',
        direct: '直接表现证据',
        direct_evidence: '直接表现证据',
        inferred: '关联推断',
        hypothesis: '待验证假设',
        conflicting: '证据存在矛盾',
      }) as Record<string, string>
    )[value ?? ''] ?? value;
  const content = (
    <div
      className={`knowledge3d ${expanded ? 'knowledge3d-expanded' : ''}`}
      ref={cardRef}
      role={expanded ? 'dialog' : 'region'}
      aria-modal={expanded || undefined}
      aria-label={`${studentName ? studentName + '的' : ''}${viewLabel}知识图谱`}
      tabIndex={-1}
    >
      <div className="knowledge3d-heading">
        <div>
          <span>KNOWLEDGE ATLAS</span>
          <h3>
            {viewLabel}
            <small>3D 知识图谱</small>
          </h3>
        </div>
        <button
          className="knowledge3d-expand"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? '收起知识图谱' : '展开知识图谱'}
        >
          {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      <div className="knowledge3d-toolbar">
        <label className="knowledge3d-search">
          <Search size={14} />
          <input
            aria-label="搜索知识点"
            placeholder="搜索知识点、学习目标"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="清空知识点搜索" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
          {query.trim() && (
            <div
              className="knowledge3d-search-results"
              aria-label="知识点搜索结果"
            >
              {results.length ? (
                results.map((node) => (
                  <button key={node.id} onClick={() => selectNode(node)}>
                    <strong>{node.name}</strong>
                    <span>{subjectName(node.subject)}</span>
                  </button>
                ))
              ) : (
                <p>未找到对应知识点</p>
              )}
            </div>
          )}
        </label>
        <select
          aria-label="筛选知识图谱学科"
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setSelectedId(null);
          }}
        >
          <option value="all">全部学科</option>
          {subjects.map((name) => (
            <option key={name} value={name}>
              {subjectName(name)}
            </option>
          ))}
        </select>
      </div>
      <div className="knowledge3d-relation-legend" aria-label="知识关系图例">
        <span>
          <i className="relation-prerequisite" />
          先修
        </span>
        <span>
          <i className="relation-contains" />
          包含
        </span>
        <span>
          <i className="relation-sequence" />
          课程顺序
        </span>
      </div>
      {view !== 'public' && (
        <div className="knowledge3d-relation-legend" aria-label="知识证据图例">
          <span>
            <i style={{ background: '#789970' }} />
            直接证据
          </span>
          <span>
            <i style={{ background: '#a780b5' }} />
            关联推断
          </span>
          <span>
            <i style={{ background: '#c79450' }} />
            待验证假设
          </span>
          <span>星级表示作答进展</span>
        </div>
      )}
      <div className="knowledge3d-workspace">
        <div className="knowledge3d-map">
          <canvas
            ref={canvasRef}
            aria-label="立体知识节点图，可拖动旋转、滚轮缩放并点击节点"
            tabIndex={0}
          />
          <div ref={labelsRef} className="knowledge3d-labels" />
          <div className="knowledge3d-map-stats">
            <span>{visibleGraph.nodes.length} 个节点</span>
            <span>{visibleGraph.edges.length} 条关系</span>
          </div>
          <div className="knowledge3d-map-controls">
            <button
              aria-label="旋转知识图谱"
              onClick={() => engine.current?.rotate()}
            >
              <RotateCw size={15} />
            </button>
            <button
              aria-label="放大知识图谱"
              onClick={() => engine.current?.zoom(1.3)}
            >
              <ZoomIn size={15} />
            </button>
            <button
              aria-label="缩小知识图谱"
              onClick={() => engine.current?.zoom(1 / 1.3)}
            >
              <ZoomOut size={15} />
            </button>
            <button
              aria-label="查看完整知识图谱"
              onClick={() => engine.current?.fit()}
            >
              <Focus size={15} />
            </button>
          </div>
          <div className="knowledge3d-map-hint">
            拖动旋转 · 滚轮缩放
            <small>
              前置知识 <ArrowRight size={11} /> 后续知识
            </small>
          </div>
          {(error || !ready || !visibleGraph.nodes.length) && (
            <div
              className="knowledge3d-map-message"
              role={error ? 'alert' : 'status'}
            >
              {error ||
                (!ready
                  ? '正在打开知识图谱…'
                  : validGraph
                    ? '当前范围尚无知识节点'
                    : '当前视图数据正在准备')}
            </div>
          )}
        </div>
        <aside className="knowledge3d-detail" aria-label="知识节点详情">
          {selectedNode ? (
            <>
              <div className="knowledge3d-detail-title">
                <span>{subjectName(selectedNode.subject)}</span>
                <button
                  aria-label="关闭知识节点详情"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={14} />
                </button>
                <h4>{selectedNode.name}</h4>
                {onExpandNode && (
                  <button onClick={() => onExpandNode(selectedNode)}>
                    展开这段学习道路
                  </button>
                )}
              </div>
              {view !== 'public' && (
                <div className="knowledge3d-node-progress">
                  <span>
                    {view === 'truth' ? '当前真实掌握度' : '当前记录星级'}
                  </span>
                  {view === 'truth' ? (
                    <strong>
                      {selectedNode.observed === false
                        ? '尚无记录'
                        : percent(selectedNode.mastery)}
                    </strong>
                  ) : (
                    <NodeStars
                      value={
                        selectedNode.observed === false
                          ? null
                          : selectedNode.stars
                      }
                    />
                  )}
                </div>
              )}
              <p className="knowledge3d-note">
                {view === 'public'
                  ? '知识结构、层级归属和学习路径'
                  : view === 'truth'
                    ? '依据该学生当前真实画像中的学习范围展示。'
                    : view === 'teacher'
                      ? '依据教师实际观察到的课堂表现更新。'
                      : '依据 APP 交互中留下的学习证据更新。'}
                {!!selectedNode.coverage?.total_scopes &&
                  `已记录 ${selectedNode.coverage.observed_scopes}/${selectedNode.coverage.total_scopes} 个学习范围。`}
                {selectedNode.node_kind !== 'learning_scope' &&
                  selectedNode.coverage?.complete === false &&
                  '综合节点按学习范围展开查看。'}
                {selectedNode.assessment_status === 'insufficient_samples' &&
                  '题量尚未达到掌握判断要求。'}
              </p>
              {(selectedNode.judgment || selectedNode.node_state?.judgment) && (
                <p className="knowledge3d-note">
                  {judgmentLabel(
                    selectedNode.judgment ?? selectedNode.node_state?.judgment,
                  )}
                  {typeof (
                    selectedNode.estimate ?? selectedNode.node_state?.estimate
                  ) === 'number' &&
                    ` · 掌握估计 ${percent(selectedNode.estimate ?? selectedNode.node_state?.estimate)}`}
                </p>
              )}
              <Evidence
                ids={
                  selectedNode.node_state?.evidence_ids ??
                  (view !== 'app' ? selectedNode.evidence_ids : [])
                }
                onEvidence={onEvidence ? openEvidence : undefined}
              />
              {!!(selectedNode.history ?? selectedNode.node_state?.history)
                ?.length && (
                <details className="knowledge3d-detail-section">
                  <summary>判断历史</summary>
                  {[
                    ...(selectedNode.history ??
                      selectedNode.node_state?.history ??
                      []),
                  ]
                    .reverse()
                    .map((row, i) => (
                      <p key={`${row.event_id ?? ''}-${i}`}>
                        {row.day != null && `第 ${row.day} 天 · `}
                        {judgmentLabel(row.judgment)} {row.reason}
                        <Evidence
                          ids={
                            row.evidence_ids ??
                            (row.event_id ? [row.event_id] : [])
                          }
                          onEvidence={onEvidence ? openEvidence : undefined}
                        />
                      </p>
                    ))}
                </details>
              )}
              {selectedNode.total !== undefined && (
                <p className="knowledge3d-note">
                  {selectedNode.total} 题 · 答对 {selectedNode.correct ?? 0} ·
                  答错 {selectedNode.wrong ?? 0}
                  {selectedNode.accuracy != null &&
                    ` · 正确率 ${percent(selectedNode.accuracy)}`}
                </p>
              )}
              {!!relatedRelations.length && (
                <section className="knowledge3d-detail-section">
                  <h5>知识结构</h5>
                  {relatedRelations.map((edge) => {
                    const outgoing = edge.source === selectedNode.id;
                    const node = visibleGraph.nodes.find(
                      (row) =>
                        row.id === (outgoing ? edge.target : edge.source),
                    );
                    if (!node) return null;
                    const label =
                      edge.relation === 'contains'
                        ? outgoing
                          ? '包含'
                          : '归属'
                        : edge.relation === 'course_sequence'
                          ? outgoing
                            ? '后续课程'
                            : '前序课程'
                          : '相关';
                    return (
                      <div
                        className="knowledge3d-path"
                        key={`${edge.relation}:${node.id}`}
                      >
                        <span>{label}</span>
                        <button onClick={() => selectNode(node)}>
                          {node.name}
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    );
                  })}
                </section>
              )}
              {(selectedNode.scopes?.length ?? 0) > 0 && (
                <section className="knowledge3d-detail-section">
                  <h5>学习范围</h5>
                  {selectedNode.scopes!.map((scope) => (
                    <ScopeDetails
                      key={scope.id}
                      scope={scope}
                      view={view}
                      onEvidence={onEvidence ? openEvidence : undefined}
                    />
                  ))}
                </section>
              )}
              {(priorNodes.length > 0 || nextNodes.length > 0) && (
                <section className="knowledge3d-detail-section">
                  <h5>
                    <GitBranch size={12} />
                    学习路径
                  </h5>
                  {priorNodes.length > 0 && (
                    <div className="knowledge3d-path">
                      <span>前置知识</span>
                      {priorNodes.map((node) => (
                        <button key={node.id} onClick={() => selectNode(node)}>
                          {node.name}
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  {nextNodes.length > 0 && (
                    <div className="knowledge3d-path">
                      <span>后续知识</span>
                      {nextNodes.map((node) => (
                        <button key={node.id} onClick={() => selectNode(node)}>
                          {node.name}
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {view === 'app' && (
                <>
                  <Evidence
                    ids={selectedNode.evidence_ids}
                    onEvidence={onEvidence ? openEvidence : undefined}
                  />
                  <section className="knowledge3d-detail-section">
                    <h5>个性化练习计划</h5>
                    {currentPlans.length ? (
                      currentPlans.map((plan) => (
                        <div key={plan.id} className="knowledge3d-plan">
                          <div>
                            <strong>
                              {
                                {
                                  continue_learning: '继续学习',
                                  consolidation: '巩固练习',
                                  variation: '变式练习',
                                  retention: '间隔复习',
                                }[plan.purpose]
                              }
                            </strong>
                            <span>
                              {plan.status === 'completed'
                                ? '已完成'
                                : `第 ${plan.due_day} 天`}
                            </span>
                          </div>
                          <p>{plan.objective}</p>
                        </div>
                      ))
                    ) : (
                      <p className="knowledge3d-note">当前节点尚无练习安排。</p>
                    )}
                  </section>
                </>
              )}
            </>
          ) : (
            <div className="knowledge3d-detail-empty">
              <Maximize2 size={23} />
              <h4>选择一个知识节点</h4>
              <p>
                点击图中的节点，查看
                {view === 'public'
                  ? '知识结构、层级归属和学习路径'
                  : view === 'truth'
                    ? '真实掌握程度和学习范围'
                    : '当前星级、学习证据和练习计划'}
                。
              </p>
              <small>也可以搜索知识点，或选择学科聚焦。</small>
            </div>
          )}
        </aside>
      </div>
      <div className="knowledge3d-footer">
        <span>
          <i />
          {viewLabel}
        </span>
        {view !== 'public' && <span>浅色节点 · 尚无记录</span>}
        {validGraph?.graph_version && (
          <small title={validGraph.graph_version}>
            图谱 {validGraph.graph_version}
          </small>
        )}
      </div>
    </div>
  );
  return expanded && typeof document !== 'undefined'
    ? createPortal(
        <div className="knowledge3d-backdrop">{content}</div>,
        document.body,
      )
    : content;
}
