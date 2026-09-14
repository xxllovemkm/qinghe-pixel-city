'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { educationRequest } from '@/lib/education-api';
import type {
  DayAnswer,
  DayAssignment,
  DayStudent,
} from '@/lib/world/school-day-contract';
import type {
  LearningEvaluation,
  SchoolDayProfile,
} from '@/lib/world/learning-contract';
import { answerText, QuestionContent } from './school-day-phone';
import StudyMarkdown from './study-markdown';
import MaterialInbox from './material-inbox';
import LearnerCharacterCard from './learner-character-card';
import PersonalKnowledgeGraph from './personal-knowledge-graph';
import './learning-profile.css';

type Props = {
  api?: string;
  runId: string;
  student: DayStudent;
  version: number;
  onDiscussMaterial?: (assignmentId: string, itemId: string) => void;
};
const failure = (reason: unknown) =>
  reason instanceof Error ? reason.message : '学习记录读取失败';
const judgmentName = (value: string) =>
  (
    ({
      observed: '已有表现证据',
      hypothesis: '待验证判断',
      needs_verification: '需要进一步核验',
    }) as Record<string, string>
  )[value] ?? '学习观察';
const eventName = (value: string) =>
  (
    ({
      teacher_instruction: '课堂讲授',
      teacher_feedback: '教师反馈',
      classwork_answer: '随堂作答',
      homework_answer: '家庭作业原答',
      student_answer: '学生作答',
      homework_submitted: '整份作业提交',
      app_review: 'APP 批改',
      app_message: 'APP 交流',
      student_message: '学生表达',
      app_memory_updated: 'APP 学习记录',
      arrived_home: '到家',
      entered_classroom: '进入课堂',
      school_arrived: '到校',
      home_arrived: '到家',
    }) as Record<string, string>
  )[value] ?? '学习事件';

export default function LearningProfile(props: Props) {
  return (
    <ProfileSession key={`${props.runId}:${props.student.id}`} {...props} />
  );
}

function Answer({ value }: { value?: DayAnswer }) {
  const text = value ? answerText(value.answer ?? value.text) : '';
  const kind = value?.response_kind;
  return (
    <div className="learning-original-answer">
      <strong>
        {kind === 'partial'
          ? '部分作答'
          : kind === 'question' || kind === 'help'
            ? '学生提问'
            : '学生原答'}
      </strong>
      <StudyMarkdown text={text || '尚未作答'} />
      {value?.steps && (
        <StudyMarkdown
          text={
            Array.isArray(value.steps)
              ? value.steps
                  .map((step, index) => `${index + 1}. ${step}`)
                  .join('\n')
              : value.steps
          }
        />
      )}
    </div>
  );
}

function Assignment({
  assignment,
  onDiscuss,
}: {
  assignment: DayAssignment;
  onDiscuss?: Props['onDiscussMaterial'];
}) {
  const answers = assignment.answers || [];
  const complete = answers.filter(
    (row) =>
      row.response_kind === 'answer' &&
      answerText(row.answer ?? row.text).trim(),
  ).length;
  const reviews = assignment.review?.items || [];
  const scored = reviews.filter((row) => typeof row.score === 'number');
  const correctnessScale =
    assignment.score_scale === 'one_point_per_item' ||
    assignment.score_scale === 'mixed' ||
    assignment.items.some((item) => item.score_scale === 'one_point_per_item');
  return (
    <details className="learning-record-card">
      <summary>
        <strong>{assignment.title || '学习作业'}</strong>
        <span>
          {assignment.day ? `第 ${assignment.day} 天 · ` : ''}已答 {complete}/
          {assignment.items.length} · 已判定 {scored.length}/
          {assignment.items.length}
        </span>
      </summary>
      {!!scored.length && (
        <p>
          {correctnessScale ? (
            <>
              已判定题目中，
              {scored.filter((row) => row.correct === true).length}/
              {scored.length} 题正确
            </>
          ) : (
            <>
              已判部分{' '}
              {scored.reduce((total, row) => total + (row.score ?? 0), 0)} /{' '}
              {scored.reduce(
                (total, row) =>
                  total +
                  (row.max_score ??
                    assignment.items.find((item) => item.id === row.item_id)
                      ?.max_score ??
                    0),
                0,
              )}{' '}
              分
            </>
          )}{' '}
          · 待判 {Math.max(0, assignment.items.length - scored.length)} 题
        </p>
      )}
      {assignment.items.map((item, index) => {
        const review = reviews.find((row) => row.item_id === item.id);
        return (
          <article className="learning-question" key={item.id}>
            <h4>第 {index + 1} 题</h4>
            <QuestionContent question={item} />
            <Answer value={answers.find((row) => row.item_id === item.id)} />
            {review && (
              <div className="learning-feedback">
                <strong>
                  APP 批改 ·{' '}
                  {review.correct === true
                    ? '正确'
                    : review.correct === false
                      ? '需要订正'
                      : '待判断'}
                  {typeof review.score === 'number' &&
                    (item.score_scale === 'source_points' ||
                      !correctnessScale) &&
                    ` · ${review.score}/${review.max_score ?? item.max_score} 分`}
                </strong>
                {review.explanation && (
                  <StudyMarkdown text={review.explanation} />
                )}
              </div>
            )}
            {onDiscuss && (
              <button
                onClick={() => onDiscuss(assignment.assignment_id, item.id)}
              >
                到学习 APP 查看这道题
              </button>
            )}
          </article>
        );
      })}
    </details>
  );
}

function ProfileSession({ runId, student, version, onDiscussMaterial }: Props) {
  const [profile, setProfile] = useState<SchoolDayProfile | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [section, setSection] = useState<
    'character' | 'truth' | 'app' | 'records' | 'materials' | 'evaluation'
  >('character');
  const [evidenceId, setEvidenceId] = useState('');
  const [graphFocus, setGraphFocus] = useState({ key: '', version: 0 });
  const focusKnowledge = (key: string) =>
    setGraphFocus((previous) => ({ key, version: previous.version + 1 }));
  const evidenceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ run_id: runId });
    void educationRequest<SchoolDayProfile>(
      `/students/${encodeURIComponent(student.id)}/profile?${params}`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (
          controller.signal.aborted ||
          data.run_id !== runId ||
          data.student_id !== student.id
        )
          return;
        setProfile((previous) =>
          previous && previous.version > data.version ? previous : data,
        );
        setError('');
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(failure(reason));
      });
    return () => controller.abort();
  }, [runId, student.id, version, retry]);
  useEffect(() => {
    if (evidenceId)
      evidenceRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
  }, [evidenceId]);

  const observed = profile?.student;
  const assignments = observed?.assignments ?? student.assignments ?? [];
  const events = profile?.events ?? [];
  const evidence = events.find((event) => event.id === evidenceId);
  const memory = observed?.app_memory;
  const learner = profile?.learner_profiles;
  const evidenceButtons = (ids: string[]) => (
    <div className="learning-evidence-links">
      {ids.map((id, index) => (
        <button key={id} onClick={() => setEvidenceId(id)}>
          查看依据 {index + 1}
        </button>
      ))}
    </div>
  );
  return (
    <section
      className="learning-profile"
      aria-label={`${student.name}的学情与证据`}
      data-run-id={runId}
      data-student-id={student.id}
    >
      <header className="learning-profile-heading">
        <div>
          <h3>{student.name} · 学习画像</h3>
          <p>
            {observed?.history?.length ?? 0} 节课堂经历 · {assignments.length}{' '}
            份作业 ·{' '}
            {observed?.app_session?.transcript.length ??
              student.app_session?.transcript.length ??
              0}{' '}
            条 APP 交流
          </p>
        </div>
      </header>
      <nav className="learning-profile-nav" aria-label="学情观察内容">
        {(
          [
            ['character', '人物设定'],
            ['truth', '真实画像'],
            ['app', 'APP 预测画像'],
            ['records', '学习记录'],
            ['materials', '个人材料'],
            ['evaluation', '运行评测'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry((value) => value + 1)}>
            重新读取
          </button>
        </p>
      )}
      {!profile && !error && (
        <p className="learning-muted">正在读取当前学生的学习记录…</p>
      )}
      {section === 'character' && (
        <LearnerCharacterCard
          student={student}
          character={learner?.character}
          nodeNames={Object.fromEntries(
            (learner?.truth.graph.nodes ?? []).map((node) => [
              node.id,
              node.name,
            ]),
          )}
        />
      )}
      {section === 'truth' &&
        (learner ? (
          <PersonalKnowledgeGraph
            key={`truth:${runId}:${student.id}`}
            view="truth"
            profiles={learner}
            studentName={student.name}
            onEvidence={setEvidenceId}
          />
        ) : (
          <p className="learner-state-note">
            这份运行尚未保存连续真实掌握状态。学习经历保存在学习记录中。
          </p>
        ))}
      {evidenceId && (
        <section
          ref={evidenceRef}
          className="learning-evidence-detail"
          aria-label="学习证据"
        >
          <button
            className="learning-close"
            aria-label="关闭学习证据"
            onClick={() => setEvidenceId('')}
          >
            ×
          </button>
          <h4>学习证据</h4>
          {evidence ? (
            <>
              <p>
                {typeof evidence.day === 'number'
                  ? `第 ${evidence.day} 天 · `
                  : ''}
                {eventName(String(evidence.kind ?? evidence.type ?? ''))}
              </p>
              {evidence.response && typeof evidence.response === 'object' ? (
                <Answer value={evidence.response as DayAnswer} />
              ) : (
                <StudyMarkdown
                  text={
                    evidence.text || evidence.content || '该事件记录了学习过程。'
                  }
                />
              )}
            </>
          ) : (
            <p>当前学生可见记录中暂未找到这条依据。</p>
          )}
        </section>
      )}
      {section === 'records' && (
        <>
          <details className="learning-record-card" open>
            <summary>
              <strong>课堂经历</strong>
              <span>{observed?.history?.length ?? 0} 节</span>
            </summary>
            {observed?.history?.length ? (
              observed.history.map((row) => (
                <p key={`${row.day}:${row.lesson_id}`}>
                  第 {row.day} 天 · {row.title || '课堂学习'}
                </p>
              ))
            ) : (
              <p className="learning-muted">课堂参与发生后会留下记录。</p>
            )}
            {(observed?.classwork ?? [])
              .filter((group) => 'answers' in group)
              .map(
                (group, index) =>
                  'answers' in group && (
                    <details
                      className="learning-classwork"
                      key={group.lesson_key || index}
                    >
                      <summary>
                        随堂练习 · {group.answers.length} 次作答
                      </summary>
                      {group.items.map((item, itemIndex) => (
                        <article className="learning-question" key={item.id}>
                          <h4>第 {itemIndex + 1} 题</h4>
                          <QuestionContent question={item} />
                          <Answer
                            value={group.answers.find(
                              (answer) => answer.item_id === item.id,
                            )}
                          />
                        </article>
                      ))}
                    </details>
                  ),
              )}
          </details>
          <h4>作业与批改</h4>
          {assignments.length ? (
            assignments.map((assignment) => (
              <Assignment
                key={assignment.assignment_id}
                assignment={assignment}
                onDiscuss={onDiscussMaterial}
              />
            ))
          ) : (
            <p className="learning-muted">本次运行的作业会随课堂进程出现。</p>
          )}
          <details className="learning-record-card">
            <summary>
              <strong>学习过程证据</strong>
              <span>{events.length} 条</span>
            </summary>
            {events.map((event, index) => (
              <article className="learning-event" key={event.id ?? index}>
                <small>
                  {typeof event.day === 'number' ? `第 ${event.day} 天 · ` : ''}
                  {eventName(String(event.kind ?? event.type ?? ''))}
                </small>
                <StudyMarkdown
                  text={event.text || event.content || '已记录学习活动'}
                />
                {event.id && (
                  <button onClick={() => setEvidenceId(event.id!)}>
                    查看记录
                  </button>
                )}
              </article>
            ))}
          </details>
        </>
      )}
      {section === 'app' && (
        <>
          {learner ? (
            <PersonalKnowledgeGraph
              key={`app:${runId}:${student.id}`}
              view="app"
              profiles={learner}
              studentName={student.name}
              onEvidence={setEvidenceId}
              focusId={graphFocus.key}
              focusVersion={graphFocus.version}
            />
          ) : (
            <p className="learner-state-note">
              APP的掌握预测将在本人学习证据关联到目标后展示。
            </p>
          )}
          <h4>APP 对本人学习证据的判断</h4>
          {memory?.summary ? (
            <div>
              <small className="learning-muted">APP 当时记录的原始摘要</small>
              <StudyMarkdown text={memory.summary} />
            </div>
          ) : (
            <p className="learning-muted">
              APP 收到本人作业与交流后形成学习判断。
            </p>
          )}
          {(memory?.records ?? []).map((record) => (
            <article className="learning-memory" key={record.id}>
              <small>
                {judgmentName(record.judgment)}
                {record.day ? ` · 第 ${record.day} 天` : ''}
              </small>
              <StudyMarkdown text={record.claim} />
              {record.next_action && <p>接下来：{record.next_action}</p>}
              {evidenceButtons(record.evidence_ids)}
              {record.knowledge_targets?.map((target) => (
                <p key={target.node_id}>
                  {target.reason}
                  {learner?.app.graph.nodes.some(
                    (node) => node.id === target.node_id,
                  ) && (
                    <button onClick={() => focusKnowledge(target.node_id)}>
                      查看掌握预测
                    </button>
                  )}
                </p>
              ))}
            </article>
          ))}
        </>
      )}
      {section === 'materials' && (
        <MaterialInbox
          runId={runId}
          student={student}
          onDiscussMaterial={onDiscussMaterial}
        />
      )}
      {section === 'evaluation' && (
        <RunEvaluations runId={runId} studentId={student.id} />
      )}
    </section>
  );
}

const verdictName = (value: string) =>
  (
    ({ pass: '通过', needs_review: '需复核', fail: '发现问题' }) as Record<
      string,
      string
    >
  )[value] ?? '待判定';
const evaluationName = (value: string) =>
  (
    ({
      lesson: '课程与教案',
      grading: '逐题批改',
      tutoring: 'APP 辅导',
    }) as Record<string, string>
  )[value] ?? '教学评测';
function Finding({ value }: { value: unknown }) {
  if (typeof value === 'string') return <StudyMarkdown text={value} />;
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  return (
    <div className="learning-finding">
      {typeof row.item_id === 'string' && <small>题目 {row.item_id}</small>}
      {typeof row.issue === 'string' && <StudyMarkdown text={row.issue} />}
      {[
        'source_quote',
        'artifact_quote',
        'student_quote',
        'assistant_quote',
      ].map(
        (key) =>
          typeof row[key] === 'string' && (
            <blockquote key={key}>{row[key]}</blockquote>
          ),
      )}
      {typeof row.recommendation === 'string' && (
        <p>建议：{row.recommendation}</p>
      )}
    </div>
  );
}

function RunEvaluations({
  runId,
  studentId,
}: {
  runId: string;
  studentId: string;
}) {
  const [records, setRecords] = useState<LearningEvaluation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [workers, setWorkers] = useState(4);
  const alive = useRef(true);
  const revision = useRef(0);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++revision.current;
      const data = await educationRequest<{
        run_id: string;
        evaluations: LearningEvaluation[];
      }>(
        `/evaluations?${new URLSearchParams({ run_id: runId })}`,
        undefined,
        signal,
      );
      if (
        alive.current &&
        !signal?.aborted &&
        data.run_id === runId &&
        seq === revision.current
      ) {
        setRecords(data.evaluations);
        setError('');
      }
    },
    [runId],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const load = () =>
      void refresh(controller.signal).catch((reason) => {
        if (!controller.signal.aborted) setError(failure(reason));
      });
    load();
    const timer = window.setInterval(load, 2500);
    return () => {
      alive.current = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  const act = async (action: 'prepare' | 'run', evaluationId?: string) => {
    setBusy(true);
    setError('');
    try {
      await educationRequest('/evaluation', {
        action,
        run_id: runId,
        request_id: crypto.randomUUID(),
        ...(action === 'prepare'
          ? { student_ids: [studentId] }
          : { evaluation_id: evaluationId, workers }),
      });
      if (alive.current) await refresh();
    } catch (reason) {
      if (alive.current) setError(failure(reason));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section className="learning-evaluations" aria-label="当前运行评测">
      <h4>当前运行的教学评测</h4>
      <p>
        根据原始教学设计、本人作业与实际 APP 对话，分别复核课程、批改和辅导。
      </p>
      <div className="learning-evaluation-actions">
        <button disabled={busy} onClick={() => void act('prepare')}>
          {busy ? '正在处理…' : '准备当前学生评测'}
        </button>
        <label>
          评测并发
          <input
            type="number"
            min={1}
            max={200}
            value={workers}
            onChange={(event) =>
              setWorkers(
                Math.max(1, Math.min(200, Number(event.target.value) || 1)),
              )
            }
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!records.length && (
        <p className="learning-muted">本次运行的评测记录会显示在这里。</p>
      )}
      {records.map((record) => (
        <details className="learning-record-card" key={record.id} open>
          <summary>
            <strong>课程、批改与辅导</strong>
            <span>
              {record.progress?.completed ?? 0}/
              {record.progress?.total ?? record.manifest?.total_jobs ?? 0}{' '}
              项已完成
            </span>
          </summary>
          <p className="learning-muted">
            {typeof record.manifest?.created_at === 'number' &&
              Number.isFinite(record.manifest.created_at) &&
              `冻结于 ${new Date(record.manifest.created_at * 1000).toLocaleString('zh-CN', { hour12: false })}`}
            {record.source_version != null &&
              ` · 源运行版本 ${record.source_version}`}{' '}
            · 评测依据这份冻结快照
          </p>
          <p>
            {record.manifest?.student_ids?.length ?? 0} 名学生 · 待处理{' '}
            {record.progress?.pending ?? record.manifest?.total_jobs ?? 0} 项 ·
            异常 {record.progress?.errors ?? 0} 项
          </p>
          {record.error && <p role="alert">{record.error}</p>}
          {!['running', 'complete', 'completed'].includes(record.status) && (
            <button disabled={busy} onClick={() => void act('run', record.id)}>
              运行这份评测
            </button>
          )}
          {(record.results ?? []).map((result) => (
            <details className="learning-evaluation-result" key={result.job_id}>
              <summary>
                {evaluationName(result.kind)} ·{' '}
                {verdictName(result.result.verdict)}
              </summary>
              {result.result.summary && (
                <StudyMarkdown text={result.result.summary} />
              )}
              {result.result.observed_progress && (
                <StudyMarkdown text={result.result.observed_progress} />
              )}
              {result.result.findings.map((finding, index) => (
                <Finding value={finding} key={index} />
              ))}
              {result.result.items?.map((item) => (
                <article key={item.item_id}>
                  <strong>
                    题目 {item.item_id} ·{' '}
                    {item.app_grade_agrees === true
                      ? '批改一致'
                      : item.app_grade_agrees === false
                        ? '需核对批改'
                        : '独立复核'}
                  </strong>
                  {item.explanation && (
                    <StudyMarkdown text={item.explanation} />
                  )}
                </article>
              ))}
            </details>
          ))}
        </details>
      ))}
    </section>
  );
}
