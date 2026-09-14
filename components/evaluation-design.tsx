import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  X,
  Layers,
  Users,
  Brain,
  MessageCircle,
  Target,
  ChartNoAxesCombined,
} from 'lucide-react';
import SchoolDayPhone from './school-day-phone';
import PersonalKnowledgeGraph from './personal-knowledge-graph';
import StudyMarkdown from './study-markdown';
import {
  examples,
  type Demo,
  type BranchDemo,
  type RecordDemo,
  type NodeDemo,
} from '@/lib/evaluation-design/examples';
import type { DayStudent, DayTurn } from '@/lib/world/school-day-contract';
import type { LearnerProfiles } from '@/lib/world/learning-contract';
import './school-day.css';
import './learning-profile.css';
import './evaluation-design.css';

type Metric = {
  id: string;
  name: string;
  method: string;
  criteria: string[];
  calculation: string;
  group: string;
  stage: string;
};
declare const __EVALUATION_META__: Metric[];
const metrics = __EVALUATION_META__;
type View = 'chat' | 'memory' | 'profile' | 'measure';
const groups = [
  { id: 'behavior', name: '行为真实性', side: '学生', icon: Users },
  {
    id: 'dynamics',
    name: '学习变化机制',
    side: '学生',
    icon: ChartNoAxesCombined,
  },
  {
    id: 'learnlm',
    name: '教学交互 · LearnLM',
    side: 'APP',
    icon: MessageCircle,
  },
  { id: 'diagnosis', name: '知识关联与困难诊断', side: 'APP', icon: Target },
  { id: 'memory', name: 'Memory', side: 'APP', icon: Layers },
  { id: 'profile', name: '学情画像', side: 'APP', icon: Brain },
  {
    id: 'effect',
    name: '持续教学效果',
    side: 'APP',
    icon: ChartNoAxesCombined,
  },
];
const viewNames: Record<View, string> = {
  chat: '手机交互',
  memory: 'Memory',
  profile: '学情画像',
  measure: '量化记录',
};
function readHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  return metrics.some((m) => m.id === id) ? id : 'M2';
}
function turnsFor(branch: BranchDemo): DayTurn[] {
  return (branch.turns || []).map((line, index) => ({
    id: `T${index + 1}`,
    role: line.startsWith('S|') ? 'student' : 'assistant',
    text: line.slice(2),
    assignment_id: 'demo-work',
    item_id: 'q1',
  }));
}
function makeStudent(demo: Demo, turns: DayTurn[], name = '林悦'): DayStudent {
  const first = turns.find((t) => t.role === 'student')?.text || '';
  const own = /\d.*[=＝]/.test(first) ? first : '';
  return {
    id: 'student-demo',
    name,
    color: '#799b84',
    school_building_id: 'school',
    home_building_id: 'home',
    location: { scene: 'home', place_id: 'home', x: 0, z: 0 },
    classwork: [],
    homework: {
      assignment_id: 'demo-work',
      title: '五年级 · 分数学习',
      day: 1,
      status: own ? 'submitted' : 'preparing',
      score_scale: 'one_point_per_item',
      items: [
        {
          id: 'q1',
          type: 'calculation',
          prompt: demo.question || '计算 1/2 + 1/3，并说明你的想法。',
          max_score: 1,
        },
      ],
      answers: own
        ? [{ item_id: 'q1', answer: own, response_kind: 'answer' }]
        : [],
      review: { items: [] },
    },
    app_session: { id: 'case-session', transcript: turns },
  };
}
function profilesFor(nodes: NodeDemo[], truth = false): LearnerProfiles {
  const g = {
    schema: 'qinghe-demo',
    view: truth ? ('truth' as const) : ('app' as const),
    student_id: 'student-demo',
    nodes: nodes
      .filter((n) => n.value !== null)
      .map((n, i) => ({
        id: `k${i}`,
        name: n.name,
        subject: 'mathematics',
        learned: true,
        mastery: n.value!,
        stars: [0.6, 0.8, 0.95].filter((t) => n.value! >= t).length,
        basis: truth ? 'simulated_learning' : 'scored_visible_evidence',
        evidence_ids: n.refs,
      })),
    edges: [] as { source: string; target: string; relation: 'prerequisite' }[],
  };
  const prerequisite = g.nodes.find((n) => n.name === '等值解释');
  const target = g.nodes.find((n) => n.name === '通分计算');
  if (prerequisite && target)
    g.edges.push({
      source: prerequisite.id,
      target: target.id,
      relation: 'prerequisite',
    });
  return {
    run_id: 'evaluation-example',
    student_id: 'student-demo',
    model_version: 'illustrative',
    character: null,
    rubric: {
      version: 'illustrative',
      status: 'example',
      stars: [
        { stars: 1, minimum: 0.6, label: '初步掌握' },
        { stars: 2, minimum: 0.8, label: '较为熟练' },
        { stars: 3, minimum: 0.95, label: '充分掌握' },
      ],
      truth: {
        description: '这里呈现构造病例中的模拟器状态。',
        initial: '起点由共同情境给出。',
        learning: '比较实际学习经历与后续独立作答。',
        forgetting: '时效判断需要后续保持证据。',
        fatigue: '状态数值与行为证据分别解释。',
      },
      app: {
        description: '节点数值由本案例设定，证据与判断用于展示评分边界。',
        prediction: '画像指数与任务成功概率分别解释。',
        recency: '最近验证时间与历史经历共同保留。',
        dialogue: '学生自述理解与独立作答证据分别保存。',
      },
      validation:
        '此处星级复用模拟界面的显示方式，不代表本指标的 rubric 得分。',
    },
    truth: { status: 'available', graph: { ...g, view: 'truth' } },
    app: { status: 'available', graph: { ...g, view: 'app' } },
  };
}
function Memory({
  records,
  onEvidence,
}: {
  records: RecordDemo[];
  onEvidence: (id: string) => void;
}) {
  if (!records.length)
    return (
      <div className="ed-empty">
        <Layers size={30} />
        <h3>等待形成学习记录</h3>
        <p>
          原始经历已经在情境中给出。推进至结果，查看 APP 实际写入的 Memory。
        </p>
      </div>
    );
  return (
    <div className="ed-memory learning-profile">
      <div className="ed-pane-heading">
        <span>APP 对本人学习证据的判断</span>
        <b>{records.length} 条记录</b>
      </div>
      {records.map((row, i) => (
        <article className="learning-memory" key={i} data-record-index={i}>
          <small>
            {row.kind || '已有表现证据'} · 记录 {String(i + 1).padStart(2, '0')}
          </small>
          <StudyMarkdown text={row.claim} />
          {row.next && (
            <p className="ed-next">
              <ArrowUpRight size={14} />
              接下来：{row.next}
            </p>
          )}
          <div className="learning-evidence-links">
            {row.refs.map((id) => (
              <button key={id} onClick={() => onEvidence(id)}>
                依据 {id}
              </button>
            ))}
            {!row.refs.length && (
              <span className="ed-no-evidence">此条记录未关联原始证据</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
function Profile({
  nodes,
  onEvidence,
  truth,
}: {
  nodes: NodeDemo[];
  onEvidence: (id: string) => void;
  truth: boolean;
}) {
  const profile = useMemo(() => profilesFor(nodes, truth), [nodes, truth]);
  return (
    <div className="ed-profile">
      <PersonalKnowledgeGraph
        view={truth ? 'truth' : 'app'}
        profiles={profile}
        studentName="林悦"
        onEvidence={onEvidence}
      />
      <div className="ed-node-claims">
        {nodes.map((n, i) => (
          <article key={i}>
            <div>
              <b>{n.name}</b>
              <span>
                {n.value === null ? '未知' : `${Math.round(n.value * 100)}%`} ·{' '}
                {n.confidence || '证据有限'}
              </span>
            </div>
            <p>{n.claim}</p>
            <div className="learning-evidence-links">
              {n.refs.map((id) => (
                <button key={id} onClick={() => onEvidence(id)}>
                  依据 {id}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="ed-numeric-note">
        节点数值为案例设定；用于呈现画像差异，独立于 rubric 分数。
      </p>
    </div>
  );
}
function Measures({ branch }: { branch: BranchDemo }) {
  const d = branch.measure;
  if (!d) return <div className="ed-empty">本案例以行为证据判分。</div>;
  return (
    <div className="ed-measure">
      <div className="ed-measure-result">
        <small>由下方案例数据计算</small>
        <strong>{d.result}</strong>
        <p>{d.formula}</p>
      </div>
      <div className="ed-data-table">
        <table>
          <thead>
            <tr>
              {d.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ed-numeric-note">
        {d.rows.length} 条构造数据 · 表格可滚动查看全部记录
      </p>
    </div>
  );
}
function Branch({
  metric,
  demo,
  side,
  view,
  after,
  turnCount,
  onEvidence,
}: {
  metric: Metric;
  demo: Demo;
  side: 'high' | 'low';
  view: View;
  after: boolean;
  turnCount: number;
  onEvidence: (id: string) => void;
}) {
  const branch = demo[side];
  const [observedStudent, setObservedStudent] = useState('林悦');
  const turns = useMemo(
    () =>
      turnsFor(branch).flatMap((t) => {
        if (metric.id !== 'S2' || t.role === 'assistant') return [t];
        const names = ['林悦', '陈安'];
        const start = t.text.indexOf(observedStudent + '：');
        if (start < 0)
          return names.some((name) => t.text.includes(name + '：')) ? [] : [t];
        const rest = t.text.slice(start + 3);
        const next = rest.search(/[；。]?(?:林悦|陈安)：/);
        return [{ ...t, text: next >= 0 ? rest.slice(0, next) : rest }];
      }),
    [branch, metric.id, observedStudent],
  );
  const visibleTurns = turns.slice(0, turnCount);
  const student = makeStudent(demo, visibleTurns, observedStudent);
  const scope = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (turnCount >= turns.length) {
      const t = setTimeout(
        () =>
          scope.current?.querySelector('.sd-phone-feed')?.scrollTo({ top: 0 }),
        80,
      );
      return () => clearTimeout(t);
    }
  }, [metric.id, view, turns.length, turnCount]);
  const score = metric.criteria.length
    ? `${side === 'high' ? 5 : 1} / 5`
    : branch.score || branch.measure?.result || '0';
  return (
    <section
      ref={scope}
      className={`ed-branch ${side}`}
      aria-label={side === 'high' ? '高质量表现' : '低质量表现'}
    >
      <header>
        <div>
          <span className="ed-branch-dot" />
          <h3>{side === 'high' ? '高质量表现' : '低质量表现'}</h3>
        </div>
        <b className="ed-score">{score}</b>
      </header>
      <div className={`ed-stage view-${view}`}>
        {view === 'chat' && (
          <div className="ed-phone-wrap">
            {metric.id === 'S2' && (
              <label className="ed-student-switch">
                观察学生{' '}
                <select
                  aria-label="观察学生"
                  value={observedStudent}
                  onChange={(e) => setObservedStudent(e.target.value)}
                >
                  <option>林悦</option>
                  <option>陈安</option>
                </select>
              </label>
            )}
            <SchoolDayPhone
              runId={`${metric.id}-${side}`}
              student={student}
              time="18:32"
              onSend={async () => {}}
              disabled
              disabledReason="案例回放"
              busy={false}
              focus={{ assignmentId: 'demo-work', itemId: 'q1', nonce: 0 }}
            />
          </div>
        )}
        {view === 'memory' && (
          <Memory
            records={after ? branch.records || [] : demo.before || []}
            onEvidence={onEvidence}
          />
        )}
        {view === 'profile' && (
          <Profile
            nodes={after ? branch.nodes || [] : demo.prior || []}
            onEvidence={onEvidence}
            truth={metric.group === 'dynamics' || metric.group === 'behavior'}
          />
        )}
        {view === 'measure' && <Measures branch={branch} />}
      </div>
      <div className="ed-branch-footer">
        {view === 'chat'
          ? `${visibleTurns.length} / ${turns.length} 条发言`
          : view === 'memory' || view === 'profile'
            ? after
              ? '当前查看：更新后的状态'
              : '当前查看：共同起始状态'
            : '当前查看：逐条观测与计算'}
        <span>{metric.id}</span>
      </div>
    </section>
  );
}
function EvidenceDialog({
  evidence,
  text,
  id,
  onClose,
}: {
  evidence: { side: 'high' | 'low'; id: string };
  text: string;
  id: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label="原始证据"
      className="ed-evidence-dialog"
    >
      <header>
        <div>
          <small>
            原始证据 · {evidence.side === 'high' ? '高质量分支' : '低质量分支'}
          </small>
          <h2>{evidence.id}</h2>
        </div>
        <button aria-label="关闭证据" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <p>{text}</p>
      <small>当前指标 {id} · 来源为本页构造情境</small>
    </dialog>
  );
}
function App() {
  const [id, setId] = useState(readHash);
  const [view, setView] = useState<View>(examples[id].view || 'chat');
  const [after, setAfter] = useState(true);
  const [side, setSide] = useState<'high' | 'low'>('high');
  const [evidence, setEvidence] = useState<{
    side: 'high' | 'low';
    id: string;
  } | null>(null);
  const metric = metrics.find((m) => m.id === id)!;
  const demo = examples[id];
  const group = groups.find((g) => g.id === metric.group)!;
  const views = (['chat', 'memory', 'profile', 'measure'] as View[]).filter(
    (v) =>
      v === 'chat'
        ? demo.high.turns || demo.low.turns
        : v === 'memory'
          ? demo.high.records || demo.low.records
          : v === 'profile'
            ? demo.high.nodes || demo.low.nodes
            : demo.high.measure || demo.low.measure,
  );
  const select = (next: string) => {
    setId(next);
    location.hash = next;
    setView(examples[next].view || 'chat');
    setAfter(true);
    setSide('high');
    setEvidence(null);
  };
  useEffect(() => {
    const onHash = () => {
      const next = readHash();
      setId(next);
      setView(examples[next].view || 'chat');
      setAfter(true);
      setSide('high');
      setEvidence(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const rawEvidence = evidence
    ? evidence.id.startsWith('T')
      ? turnsFor(demo[evidence.side]).find((t) => t.id === evidence.id)?.text
      : (demo.events || []).find((e) => e.startsWith(evidence.id + ' ·'))
    : '';
  const index = metrics.findIndex((m) => m.id === id);
  return (
    <main className="school-day ed-app">
      <section className="ed-indicator">
        <nav className="ed-navigation" aria-label="指标翻页">
          <select
            aria-label="选择指标"
            value={id}
            onChange={(e) => select(e.target.value)}
          >
            {groups.map((g) => (
              <optgroup key={g.id} label={`${g.side} · ${g.name}`}>
                {metrics
                  .filter((m) => m.group === g.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} · {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            aria-label="上一指标"
            disabled={index === 0}
            onClick={() => select(metrics[index - 1].id)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="下一指标"
            disabled={index === metrics.length - 1}
            onClick={() => select(metrics[index + 1].id)}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
        <div className="ed-indicator-content" key={id}>
          <div className="ed-eyebrow">
            <span>
              {group.side} · {group.name}
            </span>
            <span>
              {index + 1} / {metrics.length}
            </span>
          </div>
          <h1>{metric.name}</h1>
          <h2>测什么 · 怎么测</h2>
          <StudyMarkdown text={metric.method} />
        </div>
      </section>
      <section className="ed-rubric" aria-label="评分项">
        <header>
          <h2>
            评分项 <small>Rubric</small>
          </h2>
          <span>
            {metric.criteria.length
              ? '1–5 分'
              : metric.id.includes('-E')
                ? '0 / 1'
                : '直接量化'}
          </span>
        </header>
        <div className="ed-rubric-content" key={id}>
          {metric.criteria.length ? (
            <>
              <p className="ed-score-rule">基础 1 分，每满足一项加 1 分。</p>
              <ol className="ed-checklist">
                {metric.criteria.map((c, i) => (
                  <li key={c}>
                    <b>{String.fromCharCode(65 + i)}</b>
                    <p>{c}</p>
                    <span>+1</span>
                  </li>
                ))}
              </ol>
              <div className="ed-score-scale">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n}>
                    <b>{n} 分</b>
                    <span>{n - 1} 项</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <StudyMarkdown
              text={
                metric.calculation ||
                '完整证据窗口内：错误发生记 1，未发生记 0。错误率越低越好。'
              }
            />
          )}
        </div>
      </section>
      <section className="ed-examples" aria-label="示例">
        <header className="ed-examples-heading">
          <h2>示例</h2>
          <span>构造案例 · 评分参照</span>
        </header>
        <div className="ed-scenario" key={`scenario-${id}`}>
          <b>共同情境</b>
          <p>{demo.initial}</p>
          {!!demo.events?.length && (
            <details>
              <summary>情境证据 · {demo.events.length} 条</summary>
              {demo.events.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </details>
          )}
        </div>
        <div className="ed-workbench-tools">
          <div className="ed-view-tabs" role="tablist" aria-label="案例视图">
            {views.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
              >
                {viewNames[v]}
              </button>
            ))}
          </div>
          {(view === 'memory' || view === 'profile') && (
            <div className="ed-state-switch">
              <button aria-pressed={!after} onClick={() => setAfter(false)}>
                更新前
              </button>
              <button aria-pressed={after} onClick={() => setAfter(true)}>
                更新后
              </button>
            </div>
          )}
          <div className="ed-side-switch" aria-label="示例切换">
            <button
              aria-pressed={side === 'high'}
              onClick={() => setSide('high')}
            >
              高质量
            </button>
            <button
              aria-pressed={side === 'low'}
              onClick={() => setSide('low')}
            >
              低质量
            </button>
          </div>
        </div>
        <div className={`ed-comparison show-${side}`} key={`comparison-${id}`}>
          {(['high', 'low'] as const).map((s) => (
            <Branch
              key={s}
              metric={metric}
              demo={demo}
              side={s}
              view={view}
              after={after}
              turnCount={999}
              onEvidence={(eid) => setEvidence({ side: s, id: eid })}
            />
          ))}
        </div>
      </section>
      {evidence && (
        <EvidenceDialog
          evidence={evidence}
          id={id}
          text={
            rawEvidence ||
            (evidence.id === 'E1'
              ? `起始条件：${demo.initial}`
              : '该分支未关联到这条原始记录。')
          }
          onClose={() => setEvidence(null)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
